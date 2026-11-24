/**
 * routes/admin/driveCleanup.ts
 * Admin-only: bulk Google Drive cleanup covering ALL teacher uploads —
 * feed photos/videos, teacher media, social media posts, notes, homework.
 * Uses audit_logs as the universal file index.
 *
 * Flow:
 *  1. GET  /preview?older_than_days=N  — show what will be deleted, grouped by folder type
 *  2. POST /notify                     — schedule deletion, send parent flash messages class-by-class
 *  3. POST /execute                    — perform the actual Drive deletes
 */
import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { deleteDriveFile } from '../../lib/driveDelete';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/admin/drive-cleanup/preview?older_than_days=30
// Returns a summary of all Drive files older than the threshold, grouped by type.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/preview', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const older_than_days = Math.max(7, Number(req.query.older_than_days) || 30);

    const rows = await pool.query(
      `SELECT
         entity_type,
         COUNT(*)::int AS file_count,
         MIN(created_at)::date AS oldest,
         MAX(created_at)::date AS newest,
         SUM(COALESCE((metadata->>'file_size')::bigint, 0)) AS total_bytes
       FROM audit_logs
       WHERE school_id = $1
         AND storage_path LIKE 'google_drive:%'
         AND action = 'upload_photo'
         AND created_at < NOW() - INTERVAL '1 day' * $2
       GROUP BY entity_type
       ORDER BY file_count DESC`,
      [school_id, older_than_days],
    );

    // Also get feed breakdown by class for the notification step
    const feedRows = await pool.query(
      `SELECT
         c.name AS class_name,
         s.label AS section_label,
         COUNT(DISTINCT fp.id)::int AS post_count,
         COUNT(fpi.id)::int AS file_count,
         MIN(fp.created_at)::date AS oldest_post
       FROM feed_posts fp
       JOIN sections s ON s.id = fp.section_id
       JOIN classes c ON c.id = fp.class_id
       JOIN feed_post_images fpi ON fpi.post_id = fp.id
       WHERE fp.school_id = $1
         AND fp.drive_files_deleted = false
         AND fp.created_at < NOW() - INTERVAL '1 day' * $2
         AND fpi.storage_path LIKE 'google_drive:%'
       GROUP BY c.name, s.label
       ORDER BY c.name, s.label`,
      [school_id, older_than_days],
    );

    const totalFiles = rows.rows.reduce((s: number, r: any) => s + r.file_count, 0);
    const totalBytes = rows.rows.reduce((s: number, r: any) => s + Number(r.total_bytes || 0), 0);

    return res.json({
      older_than_days,
      total_files: totalFiles,
      total_mb: Math.round(totalBytes / 1024 / 1024 * 10) / 10,
      by_type: rows.rows,
      feed_by_class: feedRows.rows,
    });
  } catch (err) {
    console.error('[drive-cleanup preview]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/admin/drive-cleanup/notify
// Schedule the cleanup and notify parents with a deadline popup.
// Body: { older_than_days: number (min 7), delete_after_days: number (min 2) }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/notify', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const { older_than_days = 30, delete_after_days = 7 } = req.body;

    if (older_than_days < 7)  return res.status(400).json({ error: 'older_than_days must be at least 7' });
    if (delete_after_days < 2) return res.status(400).json({ error: 'delete_after_days must be at least 2' });

    const deleteAfterDate = new Date(Date.now() + delete_after_days * 86400000);
    const deleteAfterStr  = deleteAfterDate.toISOString().split('T')[0];
    const deleteByFormatted = deleteAfterDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    // Get Drive root folder for parent download link
    const driveConfig = await pool.query(
      `SELECT google_drive_folder_id FROM school_settings WHERE school_id=$1`,
      [school_id],
    );
    const rootFolderId = driveConfig.rows[0]?.google_drive_folder_id || null;

    // Schedule feed posts for deletion
    const feedPostsResult = await pool.query(
      `UPDATE feed_posts
       SET drive_cleanup_scheduled_at = now(), drive_delete_after = $1
       WHERE school_id = $2
         AND drive_files_deleted = false
         AND drive_delete_after IS NULL
         AND created_at < NOW() - INTERVAL '1 day' * $3
         AND id IN (
           SELECT DISTINCT post_id FROM feed_post_images
           WHERE storage_path LIKE 'google_drive:%'
         )
       RETURNING id, section_id`,
      [deleteAfterStr, school_id, older_than_days],
    );

    // Build class → section mapping for notifications
    const feedByClass: Record<string, { section_ids: Set<string>; section_labels: string[] }> = {};
    if (feedPostsResult.rows.length > 0) {
      const sectionIds = [...new Set(feedPostsResult.rows.map((r: any) => r.section_id).filter(Boolean))];
      const sectionRows = await pool.query(
        `SELECT s.id, s.label, c.name AS class_name
         FROM sections s JOIN classes c ON c.id = s.class_id
         WHERE s.id = ANY($1::uuid[])`,
        [sectionIds],
      );
      for (const sr of sectionRows.rows) {
        if (!feedByClass[sr.class_name]) feedByClass[sr.class_name] = { section_ids: new Set(), section_labels: [] };
        if (!feedByClass[sr.class_name].section_ids.has(sr.id)) {
          feedByClass[sr.class_name].section_ids.add(sr.id);
          feedByClass[sr.class_name].section_labels.push(sr.label);
        }
      }
    }

    // Send one flash message per class
    let flashCount = 0;
    for (const [className, info] of Object.entries(feedByClass)) {
      const sectionLabel = info.section_labels.join(', ');
      const driveUrl = rootFolderId ? `https://drive.google.com/drive/folders/${rootFolderId}` : null;

      const title = `Action required: Download class photos/videos by ${deleteByFormatted}`;
      const body = [
        `Dear Parents of ${className} (${sectionLabel}),`,
        ``,
        `To free up storage, the school will permanently delete photos and videos uploaded by teachers from Google Drive on ${deleteByFormatted}.`,
        ``,
        `Please download any photos or videos you wish to keep before this date.`,
        driveUrl ? `\nClass Drive folder: ${driveUrl}` : ``,
        ``,
        `Files you have already saved to your device are not affected. After ${deleteByFormatted}, photos will only be viewable in the Oakit feed until they expire.`,
      ].filter(l => l !== undefined).join('\n');

      await pool.query(
        `INSERT INTO flash_messages (school_id, title, body, target_roles, start_date, end_date, created_by)
         VALUES ($1, $2, $3, 'parent', CURRENT_DATE, $4::date, $5)`,
        [school_id, title, body, deleteAfterStr, user_id],
      );
      flashCount++;
    }

    // If no feed posts matched, still send a general notification if Drive files exist in audit_logs
    if (flashCount === 0) {
      const auditCount = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM audit_logs
         WHERE school_id=$1 AND storage_path LIKE 'google_drive:%'
           AND action='upload_photo'
           AND created_at < NOW() - INTERVAL '1 day' * $2`,
        [school_id, older_than_days],
      );
      if (auditCount.rows[0]?.cnt > 0) {
        const driveUrl = rootFolderId ? `https://drive.google.com/drive/folders/${rootFolderId}` : null;
        await pool.query(
          `INSERT INTO flash_messages (school_id, title, body, target_roles, start_date, end_date, created_by)
           VALUES ($1, $2, $3, 'parent', CURRENT_DATE, $4::date, $5)`,
          [
            school_id,
            `Action required: Download school photos/videos by ${deleteByFormatted}`,
            [
              `Dear Parents,`,
              ``,
              `The school will permanently delete photos and videos from Google Drive on ${deleteByFormatted}.`,
              `Please download any media you wish to keep before this date.`,
              driveUrl ? `\nDrive folder: ${driveUrl}` : ``,
            ].join('\n'),
            deleteAfterStr,
            user_id,
          ],
        );
        flashCount = 1;
      }
    }

    return res.json({
      feed_posts_scheduled: feedPostsResult.rows.length,
      delete_after: deleteAfterStr,
      flash_messages_sent: flashCount,
      message: `Cleanup scheduled for ${deleteByFormatted}. ${flashCount} parent notification(s) sent.`,
    });
  } catch (err) {
    console.error('[drive-cleanup notify]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/admin/drive-cleanup/execute
// Delete ALL Drive files from audit_logs older than older_than_days.
// Covers feed posts, teacher media, social media, notes — everything.
// Body: { older_than_days: number (min 7), confirmed: true }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { older_than_days = 30, confirmed } = req.body;

    if (!confirmed) return res.status(400).json({ error: 'confirmed: true is required' });
    if (older_than_days < 7) return res.status(400).json({ error: 'older_than_days must be at least 7' });

    // Fetch all Drive file IDs from audit_logs older than the threshold
    const auditRows = await pool.query(
      `SELECT id, storage_path, entity_type, metadata
       FROM audit_logs
       WHERE school_id = $1
         AND storage_path LIKE 'google_drive:%'
         AND action = 'upload_photo'
         AND created_at < NOW() - INTERVAL '1 day' * $2
       ORDER BY created_at ASC`,
      [school_id, older_than_days],
    );

    if (!auditRows.rows.length) {
      return res.json({ deleted: 0, errors: 0, message: 'No files found to delete.' });
    }

    let deleted = 0;
    let errors  = 0;
    const deletedAuditIds: string[] = [];

    for (const row of auditRows.rows) {
      const fileId = row.storage_path.replace('google_drive:', '');
      try {
        await deleteDriveFile(fileId, school_id);
        deleted++;
        deletedAuditIds.push(row.id);
      } catch (e: any) {
        // 404 means already gone — count as deleted
        if (e?.response?.status === 404 || e?.message?.includes('404')) {
          deleted++;
          deletedAuditIds.push(row.id);
        } else {
          console.error(`[drive-cleanup execute] ${fileId}:`, e?.message);
          errors++;
        }
      }
    }

    // Mark audit log entries as cleaned
    if (deletedAuditIds.length) {
      await pool.query(
        `UPDATE audit_logs SET storage_path = storage_path || ':deleted' WHERE id = ANY($1::uuid[])`,
        [deletedAuditIds],
      );
    }

    // Mark feed_post_images as deleted for affected files
    const deletedStoragePaths = deletedAuditIds.map(id => {
      const row = auditRows.rows.find((r: any) => r.id === id);
      return row?.storage_path || null;
    }).filter(Boolean);

    if (deletedStoragePaths.length) {
      // Mark feed posts whose images are all deleted
      await pool.query(
        `UPDATE feed_posts SET drive_files_deleted = true
         WHERE id IN (
           SELECT DISTINCT post_id FROM feed_post_images
           WHERE storage_path = ANY($1::text[])
         ) AND school_id = $2`,
        [deletedStoragePaths, school_id],
      );

      // Mark social media posts as media_deleted
      await pool.query(
        `UPDATE social_media_posts SET media_deleted = true
         WHERE school_id = $1
           AND media_paths && $2::text[]`,
        [school_id, deletedStoragePaths],
      );
    }

    console.log(`[drive-cleanup execute] school=${school_id} deleted=${deleted} errors=${errors} total=${auditRows.rows.length}`);

    return res.json({
      deleted,
      errors,
      total_scanned: auditRows.rows.length,
      message: errors
        ? `Deleted ${deleted} file(s) from Google Drive. ${errors} file(s) could not be deleted (may already be gone).`
        : `Successfully deleted ${deleted} file(s) from Google Drive.`,
    });
  } catch (err) {
    console.error('[drive-cleanup execute]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

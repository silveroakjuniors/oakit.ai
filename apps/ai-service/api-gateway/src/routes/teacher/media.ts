import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { uploadToGoogleDrive } from '../../lib/storage';
import { compressVideo, formatBytes, isFfmpegAvailable } from '../../lib/videoCompress';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher', 'class teacher', 'supporting teacher'));

// Upload limit: 50MB for photos/videos
const upload = multer({
  dest: '/tmp/oakit-uploads/',
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedVideo = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedImage.includes(file.mimetype) || allowedVideo.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only photos (JPEG, PNG, WebP, GIF) and videos (MP4, WebM, MOV) are allowed'));
    }
  },
});

/**
 * POST /api/v1/teacher/media/upload
 * Upload a photo or video to Google Drive
 * 
 * Request body:
 * - media: File field containing the photo/video
 * - event_name: (optional) Event name for subfolder
 */
router.post('/upload', (req: Request, res: Response, next: any) => {
  upload.single('media')(req, res, (err: any) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File must be under 50 MB' });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const file = req.file;
    const { event_name } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check Google Drive is enabled for this school
    const config = await pool.query(
      `SELECT google_drive_enabled, google_drive_folder_id, google_drive_class_folder 
       FROM school_settings WHERE school_id = $1`,
      [school_id]
    );

    if (config.rows.length === 0 || !config.rows[0].google_drive_enabled || !config.rows[0].google_drive_folder_id) {
      return res.status(400).json({ 
        error: 'Google Drive is not configured for this school. Please contact admin.' 
      });
    }

    const folderId = config.rows[0].google_drive_folder_id;
    const today = new Date().toISOString().split('T')[0];

    // Look up the teacher's primary section → class name + section label
    const sectionRow = await pool.query(
      `SELECT c.name AS class_name, s.label AS section_label
       FROM sections s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN teacher_sections ts ON ts.section_id = s.id AND ts.teacher_id = $1
       WHERE s.school_id = $2
         AND (ts.teacher_id IS NOT NULL OR s.class_teacher_id = $1)
       LIMIT 1`,
      [user_id, school_id]
    );

    // Build folder path: ClassName - Section Label / YYYY-MM-DD [/ EventName]
    let classFolderName = config.rows[0].google_drive_class_folder || 'Classes';
    if (sectionRow.rows.length > 0) {
      const { class_name, section_label } = sectionRow.rows[0];
      // e.g. "Nursery - Section A" or "Play Group" (if only one section)
      classFolderName = section_label
        ? `${class_name} - ${section_label}`
        : class_name;
    }

    let driveFolderName = `${classFolderName}/${today}`;
    if (event_name && typeof event_name === 'string' && event_name.trim()) {
      driveFolderName += `/${event_name.trim()}`;
    }

    console.log('[media upload] school=%s folder_id=%s path=%s', school_id, folderId, driveFolderName);

    // ── Compress video if possible ────────────────────────────────────────────
    let localPath = file.path;
    let originalSize = file.size;
    let finalSize = file.size;
    const isVideo = file.mimetype.startsWith('video/');

    if (isVideo) {
      try {
        const ffAvailable = await isFfmpegAvailable();
        if (ffAvailable) {
          const compressed = await compressVideo(file.path);
          localPath = compressed.outputPath;
          originalSize = compressed.inputSize;
          finalSize = compressed.outputSize;
          const savings = Math.round((1 - finalSize / originalSize) * 100);
          console.log(`[media upload] compressed video: ${formatBytes(originalSize)} → ${formatBytes(finalSize)} (${savings}% smaller)`);
        }
      } catch (compressErr: any) {
        console.error('[media upload] video compression failed, uploading original:', compressErr.message);
        localPath = file.path; // fall back to original
      }
    }

    // ── Build sequential filename: YYYY-MM-DD_ClassName_N.ext ────────────────
    // Count existing files in this folder for the sequence number
    const ext = isVideo ? '.mp4' : path.extname(file.originalname) || '.jpg';
    const classSlug = classFolderName.replace(/[^a-zA-Z0-9]/g, '_');
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_logs
       WHERE school_id = $1 AND action = 'upload_photo'
         AND entity_type = 'google_drive_media'
         AND created_at::date = CURRENT_DATE
         AND metadata->>'folder_path' LIKE $2`,
      [school_id, `${classFolderName}%`]
    ).catch(() => ({ rows: [{ count: '0' }] }));
    const seq = parseInt(countResult.rows[0]?.count || '0') + 1;
    const friendlyName = `${today}_${classSlug}_${seq}${ext}`;

    // Upload to Google Drive
    const result = await uploadToGoogleDrive({
      schoolId: school_id,
      localPath,
      originalName: friendlyName,
      mimeType: isVideo ? 'video/mp4' : file.mimetype,
      actorId: user_id,
      actorName: (req.user as any).name || 'Teacher',
      actorRole: req.user!.role,
      folderId: folderId,
      driveFolderName: driveFolderName,
    });

    // Save the class subfolder ID so parents/teachers can get a direct link
    if (result.classFolderId) {
      const classFolderUrl = `https://drive.google.com/drive/folders/${result.classFolderId}`;
      await pool.query(
        `INSERT INTO drive_class_folders (school_id, section_id, class_name, drive_folder_id, drive_folder_url, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (school_id, class_name) DO UPDATE
         SET drive_folder_id = EXCLUDED.drive_folder_id,
             drive_folder_url = EXCLUDED.drive_folder_url,
             updated_at = now()`,
        [school_id, sectionRow.rows[0]?.section_id || null, classFolderName, result.classFolderId, classFolderUrl]
      ).catch(e => console.error('[drive_class_folders upsert]', e));
    }

    const classFolderUrl = result.classFolderId
      ? `https://drive.google.com/drive/folders/${result.classFolderId}`
      : `https://drive.google.com/drive/folders/${folderId}`;

    return res.status(201).json({
      success: true,
      file_id: result.driveFileId,
      drive_url: result.driveUrl,
      display_url: result.driveUrl,
      file_name: friendlyName,
      folder_path: driveFolderName,
      class_folder: classFolderName,
      class_folder_url: classFolderUrl,
      file_type: isVideo ? 'video' : 'image',
      original_size: formatBytes(originalSize),
      compressed_size: formatBytes(finalSize),
      savings_pct: isVideo && finalSize < originalSize ? Math.round((1 - finalSize / originalSize) * 100) : 0,
    });
  } catch (err: any) {
    const detail = err?.response?.data?.error || err?.response?.data || err?.message || err;
    console.error('[media upload error]', JSON.stringify(detail));
    return res.status(500).json({ error: err.message || 'Upload failed. Please try again.' });
  }
});

/**
 * GET /api/v1/teacher/media/config
 * Get Google Drive configuration for the current school
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;

    // Upsert a settings row if one doesn't exist yet
    await pool.query(
      `INSERT INTO school_settings (school_id) VALUES ($1) ON CONFLICT (school_id) DO NOTHING`,
      [school_id]
    );

    const config = await pool.query(
      `SELECT 
        COALESCE(google_drive_enabled, false)    AS google_drive_enabled,
        google_drive_folder_id,
        google_drive_class_folder,
        google_drive_auth IS NOT NULL            AS auth_configured
       FROM school_settings
       WHERE school_id = $1`,
      [school_id]
    );

    // Look up teacher's class/section for the path preview
    const sectionRow = await pool.query(
      `SELECT c.name AS class_name, s.label AS section_label
       FROM sections s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN teacher_sections ts ON ts.section_id = s.id AND ts.teacher_id = $1
       WHERE s.school_id = $2
         AND (ts.teacher_id IS NOT NULL OR s.class_teacher_id = $1)
       LIMIT 1`,
      [user_id, school_id]
    );

    const row = config.rows[0] ?? {
      google_drive_enabled: false,
      google_drive_folder_id: null,
      google_drive_class_folder: null,
      auth_configured: false,
    };

    let class_folder_name = row.google_drive_class_folder || 'Classes';
    if (sectionRow.rows.length > 0) {
      const { class_name, section_label } = sectionRow.rows[0];
      class_folder_name = section_label ? `${class_name} - ${section_label}` : class_name;
    }

    // Build a shareable Drive folder URL — prefer class subfolder if known, else root folder
    let drive_folder_url: string | null = null;
    if (row.google_drive_folder_id) {
      // Try to get class-specific subfolder (graceful fallback if table doesn't exist yet)
      let classFolderId: string | null = null;
      try {
        const classFolderRow = await pool.query(
          `SELECT drive_folder_id FROM drive_class_folders
           WHERE school_id = $1 AND class_name = $2 LIMIT 1`,
          [school_id, class_folder_name]
        );
        if (classFolderRow.rows.length > 0) {
          classFolderId = classFolderRow.rows[0].drive_folder_id;
        }
      } catch {
        // drive_class_folders table may not exist yet — use root folder
      }

      drive_folder_url = classFolderId
        ? `https://drive.google.com/drive/folders/${classFolderId}`
        : `https://drive.google.com/drive/folders/${row.google_drive_folder_id}`;
    }

    console.log('[media config] school_id=%s enabled=%s folder=%s auth=%s class=%s',
      school_id, row.google_drive_enabled, row.google_drive_folder_id, row.auth_configured, class_folder_name);

    return res.json({ ...row, class_folder_name, drive_folder_url });
  } catch (err) {
    console.error('[media config]', err);
    return res.status(500).json({ error: 'Failed to load configuration' });
  }
});

/**
 * GET /api/v1/teacher/media/list
 * Get list of media uploaded to Google Drive (optional: filtered by note_id)
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { note_id } = req.query;

    // Query audit logs for media uploads from this school
    let query = `
      SELECT 
        al.id,
        al.metadata,
        al.created_at
      FROM audit_logs al
      WHERE al.school_id = $1 
        AND al.action = 'upload_photo'
        AND al.entity_type = 'google_drive_media'
    `;
    const params = [school_id];

    if (note_id) {
      query += ` AND al.entity_id = $2`;
      params.push(String(note_id));
    }

    query += ` ORDER BY al.created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    // Extract file info from metadata
    const media = result.rows.map((row: any) => ({
      id: row.id,
      file_name: row.metadata?.file_name || 'Unknown file',
      file_size: row.metadata?.file_size || 0,
      drive_file_id: row.metadata?.drive_file_id,
      drive_url: row.metadata?.drive_url,
      created_at: row.created_at,
    }));

    return res.json({ media });
  } catch (err) {
    console.error('[media list]', err);
    return res.status(500).json({ error: 'Failed to load media list' });
  }
});

export default router;

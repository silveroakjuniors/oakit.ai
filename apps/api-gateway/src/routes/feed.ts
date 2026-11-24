import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify, forceResetGuard, schoolScope } from '../middleware/auth';
import { pool } from '../lib/db';
import { uploadToGoogleDrive } from '../lib/storage';
import { compressVideo, isFfmpegAvailable, formatBytes } from '../lib/videoCompress';

/**
 * Normalize any stored media URL to a signed proxy URL.
 * Handles: old thumbnail URLs, old download URLs, old proxy URLs, gdrive: scheme, new proxy paths.
 * Returns a relative path like /api/v1/drive-proxy?id=X&school=Y&sig=Z
 */
function normalizeToProxyUrl(url: string, schoolId: string): string {
  if (!url) return url;

  const PROXY_SECRET = process.env.JWT_SECRET || 'change_me';

  function sign(fileId: string): string {
    const sig = crypto.createHmac('sha256', PROXY_SECRET)
      .update(`${fileId}:${schoolId}`)
      .digest('hex').slice(0, 16);
    return `/api/v1/drive-proxy?id=${fileId}&school=${schoolId}&sig=${sig}`;
  }

  // Already a correctly-signed proxy path — use as-is
  if (url.startsWith('/api/v1/drive-proxy')) return url;

  // gdrive: scheme
  if (url.startsWith('gdrive:')) return sign(url.slice(7));

  // Extract Drive file ID from any URL format
  const idMatch =
    url.match(/drive-proxy\?id=([a-zA-Z0-9_-]{10,})/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/) ||
    url.match(/\/d\/([a-zA-Z0-9_-]{20,})/);

  if (idMatch) return sign(idMatch[1]);

  // Non-Drive URL (Supabase, local) — return as-is
  return url;
}

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope);

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'oakit-uploads';
const UPLOAD_TMP = path.resolve('./uploads/feed-tmp');
if (!fs.existsSync(UPLOAD_TMP)) fs.mkdirSync(UPLOAD_TMP, { recursive: true });

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || key === 'your_service_role_key_here') return null;
  return createClient(url, key);
}

// ── Image compression (Req 1.3 — max 300KB) ──────────────────────────────────
const MAX_IMAGE_BYTES = 300 * 1024; // 300 KB
const MAX_VIDEO_SIZE = 25 * 1024 * 1024; // 25 MB (standard WhatsApp video size)
const VIDEO_RETENTION_DAYS = 5; // Videos auto-delete after 5 days
const VIDEO_MIMETYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'];
const IMAGE_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function compressImage(inputPath: string, mimeType: string): Promise<Buffer> {
  try {
    // Dynamic import so the app still starts if sharp isn't installed yet
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sharp = require('sharp');
    const buf = fs.readFileSync(inputPath);
    if (buf.length <= MAX_IMAGE_BYTES) return buf; // already small enough

    // Try progressive quality reduction
    const isJpeg = mimeType === 'image/jpeg';
    const isPng  = mimeType === 'image/png';

    let quality = 80;
    let result: Buffer = buf;
    while (quality >= 30) {
      if (isJpeg) {
        result = await sharp(buf).jpeg({ quality, progressive: true }).toBuffer();
      } else if (isPng) {
        result = await sharp(buf).png({ quality, compressionLevel: 9 }).toBuffer();
      } else {
        result = await sharp(buf).webp({ quality }).toBuffer();
      }
      if (result.length <= MAX_IMAGE_BYTES) break;
      quality -= 10;
    }

    // If still too large, resize to max 1200px wide
    if (result.length > MAX_IMAGE_BYTES) {
      result = await sharp(buf).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
    }
    return result;
  } catch {
    // sharp not available — return raw buffer
    return fs.readFileSync(inputPath);
  }
}

const upload = multer({
  dest: UPLOAD_TMP,
  limits: { fileSize: MAX_VIDEO_SIZE, files: 5 },
  fileFilter: (_req, file, cb) => {
    if ([...IMAGE_MIMETYPES, ...VIDEO_MIMETYPES].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Files must be JPEG, PNG, WebP images or MP4, MOV, WebM videos'));
  },
});

// ── helpers ───────────────────────────────────────────────────────────────────

async function getSettings(schoolId: string) {
  const r = await pool.query(
    `SELECT section_daily_limit, school_daily_limit, retention_days
     FROM feed_settings WHERE school_id = $1`,
    [schoolId]
  );
  return r.rows[0] || { section_daily_limit: 5, school_daily_limit: 10, retention_days: 20 };
}

async function getPosterName(userId: string, role: string): Promise<string> {
  try {
    if (role === 'parent') {
      const r = await pool.query(`SELECT name FROM parent_users WHERE id = $1`, [userId]);
      return r.rows[0]?.name || 'Parent';
    }
    const r = await pool.query(`SELECT name FROM users WHERE id = $1`, [userId]);
    return r.rows[0]?.name || 'Teacher';
  } catch {
    return 'Teacher';
  }
}

async function resolveVisibleSectionIds(user: any): Promise<string[] | null> {
  if (user.role === 'admin' || user.role === 'principal') return null;
  if (user.role === 'teacher') {
    const r = await pool.query(
      `SELECT DISTINCT s.id FROM sections s
       LEFT JOIN teacher_sections ts ON ts.section_id = s.id AND ts.teacher_id = $1
       WHERE s.school_id = $2 AND (ts.teacher_id IS NOT NULL OR s.class_teacher_id = $1)`,
      [user.user_id, user.school_id]
    );
    return r.rows.map((x: any) => x.id);
  }
  if (user.role === 'parent') {
    const r = await pool.query(
      `SELECT DISTINCT st.section_id FROM students st
       JOIN parent_student_links psl ON psl.student_id = st.id
       WHERE psl.parent_id = $1 AND st.school_id = $2`,
      [user.user_id, user.school_id]
    );
    return r.rows.map((x: any) => x.section_id);
  }
  return [];
}

function encodeCursor(createdAt: string, id: string) {
  return Buffer.from(`${createdAt}|${id}`).toString('base64');
}

function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const [createdAt, id] = Buffer.from(cursor, 'base64').toString().split('|');
    return { createdAt, id };
  } catch {
    return null;
  }
}

async function uploadFeedImage(
  localPath: string, schoolId: string, postId: string, scope: string,
  sectionId: string | null, filename: string, mimeType: string,
  skipCompression: boolean = false,
  actorId?: string, actorName?: string, actorRole?: string,
  sectionLabel?: string, className?: string,
  seqNum?: number,
): Promise<{ storagePath: string; cdnUrl: string; originalSize: number; finalSize: number; compressed: boolean }> {

  // ── Google Drive only — no Supabase storage ───────────────────────────────
  const driveConfig = await pool.query(
    `SELECT google_drive_enabled, google_drive_folder_id
     FROM school_settings WHERE school_id = $1`,
    [schoolId]
  );
  const cfg = driveConfig.rows[0];

  if (!cfg?.google_drive_enabled || !cfg?.google_drive_folder_id) {
    fs.unlink(localPath, () => {});
    throw new Error(
      'Google Drive is not configured. Please ask your admin to set it up in Settings → Google Drive.'
    );
  }

  const isVideo = mimeType.startsWith('video/');
  const today = new Date().toISOString().split('T')[0];
  const originalSize = fs.statSync(localPath).size;

  // Skip server-side compression if already an MP4 (compressed client-side)
  // This avoids Render's 30s response timeout for video processing
  let finalPath = localPath;
  let compressed = false;
  const isAlreadyMp4 = mimeType === 'video/mp4' || filename.toLowerCase().endsWith('.mp4');

  if (isVideo && !skipCompression && !isAlreadyMp4) {
    // Only compress non-MP4 formats (MOV, WebM, 3GP) that weren't compressed client-side
    try {
      const ffAvailable = await isFfmpegAvailable();
      if (ffAvailable) {
        const compressionPromise = compressVideo(localPath);
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('compression timeout')), 20000)
        );
        const result = await Promise.race([compressionPromise, timeoutPromise]);
        if (result) {
          finalPath = result.outputPath;
          compressed = true;
          console.log(`[feed-upload] server compressed: ${formatBytes(result.inputSize)} → ${formatBytes(result.outputSize)}`);
        }
      }
    } catch (compressErr: any) {
      console.log(`[feed-upload] server compression skipped (${compressErr.message})`);
      finalPath = localPath;
    }
  } else if (isVideo) {
    console.log(`[feed-upload] skipping server compression - already MP4 (compressed client-side)`);
  }

  // ── Build Oaklets_ filename: Oaklets_ClassName_SectionLabel_N.ext ─────────
  const classSlug = className
    ? (sectionLabel ? `${className}_${sectionLabel}` : className).replace(/[^a-zA-Z0-9]/g, '_')
    : 'Class';
  const classSlugBase = `Oaklets_${classSlug}`;
  const ext = isVideo ? '.mp4' : (path.extname(filename) || '.jpg');
  const seq = seqNum || 1;
  const smartFilename = `${classSlugBase}_${seq}${ext}`;

  // ── Upload to Drive: Oaklets_ClassName_SectionLabel / YYYY-MM-DD / Photos|Videos
  const mediaSubfolder = isVideo ? 'Videos' : 'Photos';
  const driveFolderName = `${classSlugBase}/${today}/${mediaSubfolder}`;

  const result = await uploadToGoogleDrive({
    schoolId,
    localPath: finalPath,
    originalName: smartFilename,
    mimeType: isVideo ? 'video/mp4' : mimeType,
    actorId,
    actorName,
    actorRole,
    folderId: cfg.google_drive_folder_id,
    driveFolderName,
  });

  console.log(`[feed-upload] Google Drive: ${smartFilename} → ${result.directUrl}`);
  const finalSize = (() => { try { return fs.statSync(finalPath).size; } catch { return originalSize; } })();
  return {
    storagePath: result.storagePath,
    cdnUrl: result.directUrl || result.driveUrl,
    originalSize,
    finalSize,
    compressed,
  };
}

// ── GET /api/v1/feed ──────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  const user = req.user!;
  const cursorParam = req.query.cursor as string | undefined;
  const PAGE = 10;

  try {
    const sectionIds = await resolveVisibleSectionIds(user);
    const isAdmin = sectionIds === null;
    const userType = user.role === 'parent' ? 'parent' : 'staff';

    const params: any[] = [user.school_id];
    let scopeFilter: string;

    if (isAdmin) {
      scopeFilter = `fp.school_id = $1`;
    } else if (sectionIds && sectionIds.length > 0) {
      params.push(sectionIds);
      scopeFilter = `fp.school_id = $1 AND (fp.post_scope = 'school' OR fp.section_id = ANY($2::uuid[]))`;
    } else {
      scopeFilter = `fp.school_id = $1 AND fp.post_scope = 'school'`;
    }

    const userIdIdx = params.length + 1;
    const userTypeIdx = params.length + 2;
    params.push(user.user_id, userType);

    let cursorFilter = '';
    if (cursorParam) {
      const decoded = decodeCursor(cursorParam);
      if (decoded) {
        const p1 = params.length + 1;
        const p2 = params.length + 2;
        params.push(decoded.createdAt, decoded.id);
        cursorFilter = `AND (fp.created_at < $${p1} OR (fp.created_at = $${p1} AND fp.id < $${p2}))`;
      }
    }

    const limitIdx = params.length + 1;
    params.push(PAGE + 1);

    const q = `
      SELECT fp.id, fp.caption, fp.created_at, fp.expires_at, fp.post_scope,
             fp.poster_name, fp.poster_role, fp.section_id,
             s.label AS section_label,
             COALESCE(lc.cnt, 0) AS like_count,
             CASE WHEN ml.user_id IS NOT NULL THEN true ELSE false END AS liked_by_me,
             COALESCE(ig.cnt, 0) AS instagram_shares,
             COALESCE(fb.cnt, 0) AS facebook_shares,
             COALESCE(dl.cnt, 0) AS downloads,
             ARRAY_AGG(fpi.cdn_url ORDER BY fpi.display_order)
               FILTER (WHERE fpi.cdn_url IS NOT NULL) AS images,
             ARRAY_AGG(fpi.media_type ORDER BY fpi.display_order)
               FILTER (WHERE fpi.cdn_url IS NOT NULL) AS media_types
      FROM feed_posts fp
      LEFT JOIN sections s ON s.id = fp.section_id
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS cnt FROM feed_likes GROUP BY post_id
      ) lc ON lc.post_id = fp.id
      LEFT JOIN feed_likes ml
        ON ml.post_id = fp.id
        AND ml.user_id = $${userIdIdx}
        AND ml.user_type = $${userTypeIdx}
      LEFT JOIN (SELECT post_id, COUNT(*)::int AS cnt FROM feed_engagements WHERE action = 'instagram_share' GROUP BY post_id) ig ON ig.post_id = fp.id
      LEFT JOIN (SELECT post_id, COUNT(*)::int AS cnt FROM feed_engagements WHERE action = 'facebook_share' GROUP BY post_id) fb ON fb.post_id = fp.id
      LEFT JOIN (SELECT post_id, COUNT(*)::int AS cnt FROM feed_engagements WHERE action = 'download' GROUP BY post_id) dl ON dl.post_id = fp.id
      LEFT JOIN feed_post_images fpi ON fpi.post_id = fp.id
      WHERE ${scopeFilter}
        AND fp.expires_at > now()
        ${cursorFilter}
      GROUP BY fp.id, fp.caption, fp.created_at, fp.expires_at, fp.post_scope,
               fp.poster_name, fp.poster_role, fp.section_id, s.label, lc.cnt, ml.user_id, ig.cnt, fb.cnt, dl.cnt
      ORDER BY fp.created_at DESC, fp.id DESC
      LIMIT $${limitIdx}
    `;

    const result = await pool.query(q, params);
    const rows = result.rows;
    const hasMore = rows.length > PAGE;
    const posts = rows.slice(0, PAGE).map((r: any) => ({
      id: r.id,
      caption: r.caption,
      created_at: r.created_at,
      expires_at: r.expires_at,
      post_scope: r.post_scope,
      section_label: r.section_label || null,
      poster_name: r.poster_name,
      poster_role: r.poster_role,
      // Normalize all stored URLs to signed proxy paths — handles old & new records
      images: (r.images || []).map((u: string) => normalizeToProxyUrl(u, user.school_id!)),
      media_types: r.media_types || [],
      like_count: Number(r.like_count),
      liked_by_me: Boolean(r.liked_by_me),
      instagram_shares: Number(r.instagram_shares || 0),
      facebook_shares: Number(r.facebook_shares || 0),
      downloads: Number(r.downloads || 0),
    }));

    const lastPost = posts[posts.length - 1];
    const next_cursor = hasMore && lastPost
      ? encodeCursor(lastPost.created_at, lastPost.id)
      : null;

    return res.json({ posts, next_cursor });
  } catch (err: any) {
    console.error('[feed GET]', err);
    return res.status(500).json({ error: 'Failed to load feed' });
  }
});

// ── POST /api/v1/feed/posts ───────────────────────────────────────────────────

router.post('/posts', upload.array('images', 5), async (req: Request, res: Response) => {
  const user = req.user!;
  const files = (req.files as Express.Multer.File[]) || [];
  const uploadedPaths: string[] = [];

  try {
    if (files.length === 0) {
      return res.status(400).json({ error: 'At least one image or video is required' });
    }

    // Validate: videos limited to 1 per post, max 25MB each
    const videoFiles = files.filter(f => VIDEO_MIMETYPES.includes(f.mimetype));
    const imageFiles = files.filter(f => IMAGE_MIMETYPES.includes(f.mimetype));
    if (videoFiles.length > 1) {
      return res.status(400).json({ error: 'Maximum 1 video per post' });
    }
    const hasVideo = videoFiles.length > 0;

    const caption = (req.body.caption || '').trim().slice(0, 500) || null;
    const isAdmin = user.role === 'admin' || user.role === 'principal';
    const settings = await getSettings(user.school_id!);
    const posterName = await getPosterName(user.user_id, user.role);

    let sectionId: string | null = null;
    let classId: string | null = null;
    let postScope: 'section' | 'school';

    if (isAdmin) {
      postScope = 'school';
      if (files.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 images per post' });
      }
      const dayCount = await pool.query(
        `SELECT COUNT(*) FROM feed_posts
         WHERE school_id = $1 AND post_scope = 'school' AND DATE(created_at) = CURRENT_DATE`,
        [user.school_id]
      );
      if (Number(dayCount.rows[0].count) >= settings.school_daily_limit) {
        return res.status(429).json({ error: 'Daily school post limit reached', limit: settings.school_daily_limit });
      }
    } else {
      postScope = 'section';
      if (files.length > 5) {
        return res.status(400).json({ error: 'Maximum 5 images per post' });
      }

      sectionId = req.body.section_id || null;
      if (!sectionId) {
        const sec = await pool.query(
          `SELECT s.id, s.class_id FROM sections s
           LEFT JOIN teacher_sections ts ON ts.section_id = s.id AND ts.teacher_id = $1
           WHERE s.school_id = $2 AND (ts.teacher_id IS NOT NULL OR s.class_teacher_id = $1)
           LIMIT 1`,
          [user.user_id, user.school_id]
        );
        if (sec.rows.length === 0) {
          return res.status(403).json({ error: 'Not authorized for any section' });
        }
        sectionId = sec.rows[0].id;
        classId = sec.rows[0].class_id;
      } else {
        const sec = await pool.query(
          `SELECT s.id, s.class_id FROM sections s
           LEFT JOIN teacher_sections ts ON ts.section_id = s.id AND ts.teacher_id = $1
           WHERE s.id = $2 AND s.school_id = $3
             AND (ts.teacher_id IS NOT NULL OR s.class_teacher_id = $1)`,
          [user.user_id, sectionId, user.school_id]
        );
        if (sec.rows.length === 0) {
          return res.status(403).json({ error: 'Not authorized for this section' });
        }
        classId = sec.rows[0].class_id;
      }

      const dayCount = await pool.query(
        `SELECT COUNT(*) FROM feed_posts
         WHERE section_id = $1 AND school_id = $2 AND DATE(created_at) = CURRENT_DATE`,
        [sectionId, user.school_id]
      );
      if (Number(dayCount.rows[0].count) >= settings.section_daily_limit) {
        return res.status(429).json({ error: 'Daily section post limit reached', limit: settings.section_daily_limit });
      }
    }

    // Videos get shorter retention (5 days), images use default (20 days)
    const retentionDays = hasVideo ? VIDEO_RETENTION_DAYS : settings.retention_days;
    const expiresAt = new Date(Date.now() + retentionDays * 86400000);

    // Resolve class + section names for Drive folder structure
    let sectionLabelForDrive = '';
    let classNameForDrive = '';
    if (sectionId) {
      const nameRow = await pool.query(
        `SELECT s.label, c.name AS class_name
         FROM sections s JOIN classes c ON c.id = s.class_id
         WHERE s.id = $1`,
        [sectionId]
      );
      if (nameRow.rows.length > 0) {
        sectionLabelForDrive = nameRow.rows[0].label || '';
        classNameForDrive = nameRow.rows[0].class_name || '';
      }
    }

    const postResult = await pool.query(
      `INSERT INTO feed_posts
         (school_id, section_id, class_id, posted_by, poster_name, poster_role, post_scope, caption, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [user.school_id, sectionId, classId, user.user_id, posterName, user.role, postScope, caption, expiresAt]
    );
    const postId = postResult.rows[0].id;

    const imageRows: { storagePath: string; cdnUrl: string; order: number; mediaType: string }[] = [];
    let totalOriginalBytes = 0;
    let totalFinalBytes = 0;
    let anyCompressed = false;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = VIDEO_MIMETYPES.includes(file.mimetype);
      const result = await uploadFeedImage(
        file.path, user.school_id, postId, postScope, sectionId,
        file.originalname || `media${i}${isVideo ? '.mp4' : '.jpg'}`, file.mimetype,
        isVideo,
        user.user_id, posterName, user.role,
        sectionLabelForDrive, classNameForDrive,
        i + 1
      );
      uploadedPaths.push(result.storagePath);
      imageRows.push({ storagePath: result.storagePath, cdnUrl: result.cdnUrl, order: i, mediaType: isVideo ? 'video' : 'image' });
      totalOriginalBytes += result.originalSize;
      totalFinalBytes += result.finalSize;
      if (result.compressed) anyCompressed = true;
      fs.unlink(file.path, () => {});
    }

    for (const img of imageRows) {
      await pool.query(
        `INSERT INTO feed_post_images (post_id, storage_path, cdn_url, display_order, media_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [postId, img.storagePath, img.cdnUrl, img.order, img.mediaType]
      );
    }

    return res.status(201).json({
      id: postId,
      images: imageRows.map(i => i.cdnUrl),
      caption,
      post_scope: postScope,
      poster_name: posterName,
      created_at: new Date().toISOString(),
      // Size info for debugging
      original_size: formatBytes(totalOriginalBytes),
      final_size: formatBytes(totalFinalBytes),
      compressed: anyCompressed,
      savings_pct: totalOriginalBytes > 0 ? Math.round((1 - totalFinalBytes / totalOriginalBytes) * 100) : 0,
    });
  } catch (err: any) {
    const supabase = getSupabase();
    if (supabase && uploadedPaths.length > 0) {
      await Promise.allSettled(uploadedPaths.map(p => supabase!.storage.from(BUCKET).remove([p])));
    }
    for (const f of files) { try { fs.unlinkSync(f.path); } catch {} }
    console.error('[feed POST]', err);
    if (err.message?.includes('Images must be')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || 'Upload failed, post was not saved' });
  }
});

// ── POST /api/v1/feed/posts/:id/like ─────────────────────────────────────────

router.post('/posts/:id/like', async (req: Request, res: Response) => {
  const user = req.user!;
  const postId = req.params.id;
  const userType = user.role === 'parent' ? 'parent' : 'staff';

  try {
    const postCheck = await pool.query(
      `SELECT id FROM feed_posts WHERE id = $1 AND school_id = $2 AND expires_at > now()`,
      [postId, user.school_id]
    );
    if (postCheck.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    const existing = await pool.query(
      `SELECT id FROM feed_likes WHERE post_id = $1 AND user_id = $2 AND user_type = $3`,
      [postId, user.user_id, userType]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `DELETE FROM feed_likes WHERE post_id = $1 AND user_id = $2 AND user_type = $3`,
        [postId, user.user_id, userType]
      );
    } else {
      await pool.query(
        `INSERT INTO feed_likes (post_id, user_id, user_type, school_id)
         VALUES ($1, $2, $3, $4) ON CONFLICT (post_id, user_id, user_type) DO NOTHING`,
        [postId, user.user_id, userType, user.school_id]
      );
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM feed_likes WHERE post_id = $1`, [postId]
    );
    return res.json({
      like_count: Number(countResult.rows[0].count),
      liked_by_me: existing.rows.length === 0,
    });
  } catch (err) {
    console.error('[feed like]', err);
    return res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// ── DELETE /api/v1/feed/posts/:id ─────────────────────────────────────────────

router.delete('/posts/:id', async (req: Request, res: Response) => {
  const user = req.user!;
  const postId = req.params.id;
  const isAdmin = user.role === 'admin' || user.role === 'principal';

  try {
    const postCheck = await pool.query(
      `SELECT id, posted_by FROM feed_posts WHERE id = $1 AND school_id = $2`,
      [postId, user.school_id]
    );
    if (postCheck.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    if (!isAdmin && postCheck.rows[0].posted_by !== user.user_id) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    const images = await pool.query(
      `SELECT storage_path FROM feed_post_images WHERE post_id = $1`, [postId]
    );
    const supabase = getSupabase();
    if (supabase) {
      const paths = images.rows
        .map((r: any) => r.storage_path)
        .filter((p: string) => p && !p.startsWith('/') && !p.includes('\\'));
      if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
    }

    await pool.query(`DELETE FROM feed_posts WHERE id = $1`, [postId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('[feed delete]', err);
    return res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ── Feed settings (admin only) ────────────────────────────────────────────────

router.get('/settings', async (req: Request, res: Response) => {
  const user = req.user!;
  if (!['admin', 'principal'].includes(user.role)) return res.status(403).json({ error: 'Admin only' });
  return res.json(await getSettings(user.school_id!));
});

router.put('/settings', async (req: Request, res: Response) => {
  const user = req.user!;
  if (!['admin', 'principal'].includes(user.role)) return res.status(403).json({ error: 'Admin only' });
  const { section_daily_limit, school_daily_limit, retention_days } = req.body;
  await pool.query(
    `INSERT INTO feed_settings (school_id, section_daily_limit, school_daily_limit, retention_days)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (school_id) DO UPDATE SET
       section_daily_limit = EXCLUDED.section_daily_limit,
       school_daily_limit  = EXCLUDED.school_daily_limit,
       retention_days      = EXCLUDED.retention_days`,
    [user.school_id, section_daily_limit || 5, school_daily_limit || 10, retention_days || 20]
  );
  return res.json({ success: true });
});

// ── GET /api/v1/feed/stats — admin post count + storage estimate (Req 8.5) ────
router.get('/stats', async (req: Request, res: Response) => {
  const user = req.user!;
  if (!['admin', 'principal'].includes(user.role)) return res.status(403).json({ error: 'Admin only' });
  try {
    const result = await pool.query(
      `SELECT
         fp.section_id,
         s.label AS section_label,
         fp.post_scope,
         COUNT(fp.id)::int AS post_count,
         COUNT(fpi.id)::int AS image_count
       FROM feed_posts fp
       LEFT JOIN sections s ON s.id = fp.section_id
       LEFT JOIN feed_post_images fpi ON fpi.post_id = fp.id
       WHERE fp.school_id = $1 AND fp.expires_at > now()
       GROUP BY fp.section_id, s.label, fp.post_scope
       ORDER BY fp.post_scope, s.label`,
      [user.school_id]
    );

    const totalPosts = result.rows.reduce((s: number, r: any) => s + r.post_count, 0);
    const totalImages = result.rows.reduce((s: number, r: any) => s + r.image_count, 0);
    // Rough estimate: avg 150KB per compressed image
    const storageEstimateKb = totalImages * 150;

    return res.json({
      total_active_posts: totalPosts,
      total_images: totalImages,
      storage_estimate_kb: storageEstimateKb,
      storage_estimate_mb: Math.round(storageEstimateKb / 1024 * 10) / 10,
      by_section: result.rows,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/v1/feed/posts/:id/engage ── Track shares & downloads ────────────

router.post('/posts/:id/engage', async (req: Request, res: Response) => {
  const user = req.user!;
  const postId = req.params.id;
  const { action } = req.body;

  if (!['instagram_share', 'facebook_share', 'download'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be instagram_share, facebook_share, or download' });
  }

  const userType = (user.role === 'parent') ? 'parent' : 'staff';

  try {
    await pool.query(
      `INSERT INTO feed_engagements (post_id, user_id, user_type, school_id, action)
       VALUES ($1, $2, $3, $4, $5)`,
      [postId, user.user_id, userType, user.school_id, action]
    );

    // Return updated counts
    const counts = await pool.query(
      `SELECT action, COUNT(*)::int AS cnt FROM feed_engagements WHERE post_id = $1 GROUP BY action`,
      [postId]
    );
    const result: Record<string, number> = { instagram_share: 0, facebook_share: 0, download: 0 };
    counts.rows.forEach((r: any) => { result[r.action] = r.cnt; });

    return res.json(result);
  } catch (err) {
    console.error('[feed engage]', err);
    return res.status(500).json({ error: 'Failed to track engagement' });
  }
});

// ── POST /api/v1/feed/generate-caption ── Ask Oakie for a feed caption ────────

router.post('/generate-caption', async (req: Request, res: Response) => {
  try {
    const { has_video, file_count, current_caption } = req.body;
    const axios = (await import('axios')).default;
    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    try {
      const aiResp = await axios.post(`${AI_URL}/internal/query`, {
        message: `You are writing a short Instagram-style caption for a preschool class feed post. The teacher typed: "${current_caption || 'classroom activity'}". Write a warm, engaging 2-3 sentence caption that describes this activity in a parent-friendly way. Include what the children might be learning. Do NOT use emojis. Return ONLY the caption text.`,
        school_id: req.user!.school_id,
        teacher_id: req.user!.user_id,
      }, { timeout: 15000 });

      const caption = (aiResp.data?.answer || aiResp.data?.response || '').trim().slice(0, 500);
      if (caption) return res.json({ caption });
    } catch { /* AI service unavailable — use fallback */ }

    // Smart fallback — incorporate teacher's text
    const topic = (current_caption || '').trim();
    if (topic) {
      const templates = [
        `Today our little learners explored "${topic}" through hands-on activities. Watch them discover and grow every single day!`,
        `A fun and engaging session on "${topic}" in class today. Our children are building strong foundations through play and curiosity.`,
        `"${topic}" was the highlight of our classroom today. These young minds never stop surprising us with their enthusiasm to learn!`,
        `Our class had a wonderful time learning about "${topic}" today. Every child participated with such joy and curiosity.`,
      ];
      return res.json({ caption: templates[Math.floor(Math.random() * templates.length)] });
    }

    const fallbacks = [
      'A wonderful day of learning and laughter in our classroom today!',
      'Moments that make teaching special. Watch our little learners grow every day.',
      'Learning through play and exploration. Today was a beautiful day in class!',
      'Our classroom was full of energy and curiosity today. So proud of these young minds!',
    ];
    return res.json({ caption: fallbacks[Math.floor(Math.random() * fallbacks.length)] });
  } catch (err) {
    console.error('[feed generate-caption]', err);
    return res.status(500).json({ error: 'Failed to generate caption' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/feed/drive-cleanup/notify
// Admin schedules a Drive cleanup: marks affected posts with a delete-after
// date and sends a flash message popup to parents of each section.
// Body: { older_than_days: number (min 7), delete_after_days: number (min 2) }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/drive-cleanup/notify', async (req: Request, res: Response) => {
  const user = req.user!;
  if (!['admin', 'principal'].includes(user.role)) return res.status(403).json({ error: 'Admin only' });

  try {
    const { older_than_days = 30, delete_after_days = 7 } = req.body;

    if (older_than_days < 7) return res.status(400).json({ error: 'older_than_days must be at least 7' });
    if (delete_after_days < 2) return res.status(400).json({ error: 'delete_after_days must be at least 2' });

    const school_id = user.school_id;
    const deleteAfterDate = new Date(Date.now() + delete_after_days * 86400000);
    const deleteAfterStr = deleteAfterDate.toISOString().split('T')[0]; // YYYY-MM-DD

    // Find posts older than the threshold that still have Drive files
    const postsRows = await pool.query(
      `SELECT fp.id, fp.section_id, fp.class_id, fp.created_at,
              s.label AS section_label, c.name AS class_name,
              ss.google_drive_folder_id,
              COUNT(fpi.id) FILTER (WHERE fpi.storage_path LIKE 'google_drive:%')::int AS drive_file_count
       FROM feed_posts fp
       JOIN sections s ON s.id = fp.section_id
       JOIN classes c ON c.id = fp.class_id
       JOIN school_settings ss ON ss.school_id = fp.school_id
       JOIN feed_post_images fpi ON fpi.post_id = fp.id
       WHERE fp.school_id = $1
         AND fp.drive_files_deleted = false
         AND fp.created_at < NOW() - INTERVAL '1 day' * $2
       GROUP BY fp.id, s.label, c.name, ss.google_drive_folder_id
       HAVING COUNT(fpi.id) FILTER (WHERE fpi.storage_path LIKE 'google_drive:%') > 0
       ORDER BY c.name, s.label, fp.created_at DESC`,
      [school_id, older_than_days],
    );

    if (!postsRows.rows.length) {
      return res.json({ scheduled: 0, message: 'No Drive files found older than the specified days.' });
    }

    // Mark all matching posts with the delete-after date
    const postIds = postsRows.rows.map((r: any) => r.id);
    await pool.query(
      `UPDATE feed_posts
       SET drive_cleanup_scheduled_at = now(), drive_delete_after = $1
       WHERE id = ANY($2::uuid[])`,
      [deleteAfterStr, postIds],
    );

    // Build class-grouped summary for flash messages
    const byClass: Record<string, { class_name: string; section_label: string; file_count: number; drive_folder_id: string | null }[]> = {};
    for (const row of postsRows.rows) {
      const key = row.class_name;
      if (!byClass[key]) byClass[key] = [];
      const existing = byClass[key].find((e: any) => e.section_label === row.section_label);
      if (existing) {
        existing.file_count += row.drive_file_count;
      } else {
        byClass[key].push({
          class_name: row.class_name,
          section_label: row.section_label,
          file_count: row.drive_file_count,
          drive_folder_id: row.google_drive_folder_id,
        });
      }
    }

    // Send one flash message per class to parents of that class
    const totalFiles = postsRows.rows.reduce((s: number, r: any) => s + r.drive_file_count, 0);
    const deleteByFormatted = deleteAfterDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    for (const [className, sections] of Object.entries(byClass)) {
      const sectionLabels = sections.map((s: any) => s.section_label).join(', ');
      const fileCount = sections.reduce((s: number, e: any) => s + e.file_count, 0);
      const driveUrl = sections[0].drive_folder_id
        ? `https://drive.google.com/drive/folders/${sections[0].drive_folder_id}`
        : null;

      const title = `Important: Download your child's photos/videos by ${deleteByFormatted}`;
      const body = `Dear Parents of ${className} (${sectionLabels}),\n\nTo free up storage space, the school will permanently delete ${fileCount} photo(s)/video(s) from Google Drive on ${deleteByFormatted}.\n\nPlease download any photos or videos you would like to keep before this date.${driveUrl ? `\n\nClass Drive folder: ${driveUrl}` : ''}\n\nFiles already downloaded or saved to your device are not affected.`;

      // Get section IDs for this class to target only affected parents
      const sectionIds = (await pool.query(
        `SELECT s.id FROM sections s JOIN classes c ON c.id = s.class_id
         WHERE c.name = $1 AND c.school_id = $2`,
        [className, school_id],
      )).rows.map((r: any) => r.id);

      await pool.query(
        `INSERT INTO flash_messages (school_id, title, body, target_roles, start_date, end_date, created_by)
         VALUES ($1, $2, $3, 'parent', CURRENT_DATE, $4::date, $5)`,
        [school_id, title, body, deleteAfterStr, user.user_id],
      );
    }

    console.log(`[feed-cleanup] school=${school_id} scheduled ${postIds.length} posts for deletion by ${deleteAfterStr}`);

    return res.json({
      scheduled: postIds.length,
      total_files: totalFiles,
      delete_after: deleteAfterStr,
      flash_messages_sent: Object.keys(byClass).length,
      message: `Scheduled deletion of ${totalFiles} file(s) across ${postIds.length} post(s). Parents notified — files will be deleted on ${deleteByFormatted}.`,
    });
  } catch (err) {
    console.error('[feed-cleanup notify]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/feed/drive-cleanup/execute
// Delete Drive files for all posts whose drive_delete_after date has passed.
// Can be called manually by admin or triggered automatically.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/drive-cleanup/execute', async (req: Request, res: Response) => {
  const user = req.user!;
  if (!['admin', 'principal'].includes(user.role)) return res.status(403).json({ error: 'Admin only' });

  try {
    const school_id = user.school_id;

    const postsRows = await pool.query(
      `SELECT fp.id, fpi.storage_path
       FROM feed_posts fp
       JOIN feed_post_images fpi ON fpi.post_id = fp.id
       WHERE fp.school_id = $1
         AND fp.drive_files_deleted = false
         AND fp.drive_delete_after IS NOT NULL
         AND fp.drive_delete_after <= CURRENT_DATE
         AND fpi.storage_path LIKE 'google_drive:%'`,
      [school_id],
    );

    if (!postsRows.rows.length) {
      return res.json({ deleted: 0, message: 'No files are due for deletion yet.' });
    }

    const { deleteDriveFile } = await import('../lib/driveDelete');
    let deleted = 0;
    let errors = 0;
    const donePostIds = new Set<string>();
    const errorPostIds = new Set<string>();

    for (const row of postsRows.rows) {
      const fileId = row.storage_path.replace('google_drive:', '');
      try {
        await deleteDriveFile(fileId, school_id);
        deleted++;
        donePostIds.add(row.id);
      } catch (e: any) {
        console.error(`[feed-cleanup execute] Failed to delete ${fileId}:`, e?.message);
        errors++;
        errorPostIds.add(row.id);
      }
    }

    // Mark posts fully cleaned (even if some files errored — they may already be gone)
    if (donePostIds.size) {
      await pool.query(
        `UPDATE feed_posts SET drive_files_deleted = true WHERE id = ANY($1::uuid[])`,
        [Array.from(donePostIds)],
      );
    }

    console.log(`[feed-cleanup execute] school=${school_id} deleted=${deleted} errors=${errors}`);

    return res.json({
      deleted,
      errors,
      message: errors
        ? `Deleted ${deleted} file(s). ${errors} file(s) could not be deleted (may already be gone from Drive).`
        : `Deleted ${deleted} file(s) from Google Drive.`,
    });
  } catch (err) {
    console.error('[feed-cleanup execute]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/feed/drive-cleanup/preview
// Preview what would be scheduled for cleanup
// ─────────────────────────────────────────────────────────────────────────────
router.get('/drive-cleanup/preview', async (req: Request, res: Response) => {
  const user = req.user!;
  if (!['admin', 'principal'].includes(user.role)) return res.status(403).json({ error: 'Admin only' });

  try {
    const { older_than_days = 30 } = req.query;
    const school_id = user.school_id;

    const rows = await pool.query(
      `SELECT c.name AS class_name, s.label AS section_label,
              COUNT(DISTINCT fp.id)::int AS post_count,
              COUNT(fpi.id) FILTER (WHERE fpi.storage_path LIKE 'google_drive:%')::int AS file_count,
              MIN(fp.created_at)::date AS oldest_post,
              MAX(fp.created_at)::date AS newest_post
       FROM feed_posts fp
       JOIN sections s ON s.id = fp.section_id
       JOIN classes c ON c.id = fp.class_id
       JOIN feed_post_images fpi ON fpi.post_id = fp.id
       WHERE fp.school_id = $1
         AND fp.drive_files_deleted = false
         AND fp.created_at < NOW() - INTERVAL '1 day' * $2
       GROUP BY c.name, s.label
       HAVING COUNT(fpi.id) FILTER (WHERE fpi.storage_path LIKE 'google_drive:%') > 0
       ORDER BY c.name, s.label`,
      [school_id, Number(older_than_days)],
    );

    const totalFiles = rows.rows.reduce((s: number, r: any) => s + r.file_count, 0);
    const totalPosts = rows.rows.reduce((s: number, r: any) => s + r.post_count, 0);

    return res.json({
      by_class: rows.rows,
      total_posts: totalPosts,
      total_files: totalFiles,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

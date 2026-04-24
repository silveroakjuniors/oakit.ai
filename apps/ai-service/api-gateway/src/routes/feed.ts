import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify, forceResetGuard, schoolScope } from '../middleware/auth';
import { pool } from '../lib/db';

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
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Images must be JPEG, PNG or WebP'));
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
  sectionId: string | null, filename: string, mimeType: string
): Promise<{ storagePath: string; cdnUrl: string }> {
  const supabase = getSupabase();
  const ext = path.extname(filename) || '.jpg';
  const safeName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
  const storagePath = scope === 'school'
    ? `${schoolId}/memory-feed/school/${postId}/${safeName}`
    : `${schoolId}/memory-feed/sections/${sectionId}/${postId}/${safeName}`;

  const buf = await compressImage(localPath, mimeType); // Req 1.3 — compress to ≤300KB

  if (!supabase) {
    const dir = path.resolve('./uploads/feed', postId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, safeName);
    fs.writeFileSync(dest, buf);
    return { storagePath: dest, cdnUrl: `/uploads/feed/${postId}/${safeName}` };
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return { storagePath, cdnUrl: data.publicUrl };
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
             ARRAY_AGG(fpi.cdn_url ORDER BY fpi.display_order)
               FILTER (WHERE fpi.cdn_url IS NOT NULL) AS images
      FROM feed_posts fp
      LEFT JOIN sections s ON s.id = fp.section_id
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS cnt FROM feed_likes GROUP BY post_id
      ) lc ON lc.post_id = fp.id
      LEFT JOIN feed_likes ml
        ON ml.post_id = fp.id
        AND ml.user_id = $${userIdIdx}
        AND ml.user_type = $${userTypeIdx}
      LEFT JOIN feed_post_images fpi ON fpi.post_id = fp.id
      WHERE ${scopeFilter}
        AND fp.expires_at > now()
        ${cursorFilter}
      GROUP BY fp.id, fp.caption, fp.created_at, fp.expires_at, fp.post_scope,
               fp.poster_name, fp.poster_role, fp.section_id, s.label, lc.cnt, ml.user_id
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
      images: r.images || [],
      like_count: Number(r.like_count),
      liked_by_me: Boolean(r.liked_by_me),
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
      return res.status(400).json({ error: 'At least one image is required' });
    }

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

    const expiresAt = new Date(Date.now() + settings.retention_days * 86400000);

    const postResult = await pool.query(
      `INSERT INTO feed_posts
         (school_id, section_id, class_id, posted_by, poster_name, poster_role, post_scope, caption, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [user.school_id, sectionId, classId, user.user_id, posterName, user.role, postScope, caption, expiresAt]
    );
    const postId = postResult.rows[0].id;

    const imageRows: { storagePath: string; cdnUrl: string; order: number }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const { storagePath, cdnUrl } = await uploadFeedImage(
        file.path, user.school_id, postId, postScope, sectionId,
        file.originalname || `image${i}.jpg`, file.mimetype
      );
      uploadedPaths.push(storagePath);
      imageRows.push({ storagePath, cdnUrl, order: i });
      fs.unlink(file.path, () => {});
    }

    for (const img of imageRows) {
      await pool.query(
        `INSERT INTO feed_post_images (post_id, storage_path, cdn_url, display_order)
         VALUES ($1, $2, $3, $4)`,
        [postId, img.storagePath, img.cdnUrl, img.order]
      );
    }

    return res.status(201).json({
      id: postId,
      images: imageRows.map(i => i.cdnUrl),
      caption,
      post_scope: postScope,
      poster_name: posterName,
      created_at: new Date().toISOString(),
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

export default router;

/**
 * routes/teacher/socialMedia.ts
 * Teacher routes for Social Media Publisher module.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { socialMediaModuleGuard } from '../../middleware/socialMediaModuleGuard';
import { uploadFile } from '../../lib/storage';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher', 'principal', 'admin'), socialMediaModuleGuard);

const upload = multer({
  dest: '/tmp/oakit-sm-uploads/',
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.mp4', '.mov', '.jpg', '.jpeg', '.png', '.webp'];
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only MP4, MOV, JPG, PNG, WEBP files are allowed'));
  },
});
try { fs.mkdirSync('/tmp/oakit-sm-uploads/', { recursive: true }); } catch { /* exists */ }

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/teacher/social-media/quota
// Today's remaining quota for the teacher
// ─────────────────────────────────────────────────────────────────────────────
router.get('/quota', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    // Get school timezone
    const tzRow = await pool.query(
      `SELECT timezone FROM schools WHERE id=$1`,
      [school_id],
    ).catch(() => ({ rows: [{ timezone: 'Asia/Kolkata' }] }));
    const tz = tzRow.rows[0]?.timezone || 'Asia/Kolkata';

    const counts = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE media_type='video')::int           AS video_used,
         COUNT(*) FILTER (WHERE media_type='image_carousel')::int  AS image_used
       FROM social_media_posts
       WHERE teacher_id=$1 AND school_id=$2
         AND status != 'rejected'
         AND submitted_at::timestamptz AT TIME ZONE $3 >= (CURRENT_DATE AT TIME ZONE $3)`,
      [user_id, school_id, tz],
    );
    const { video_used, image_used } = counts.rows[0];
    return res.json({
      video:          { used: video_used,  limit: 1, remaining: Math.max(0, 1 - video_used) },
      image_carousel: { used: image_used,  limit: 2, remaining: Math.max(0, 2 - image_used) },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/teacher/social-media/platforms
// Enabled platforms for this school
// ─────────────────────────────────────────────────────────────────────────────
router.get('/platforms', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const rows = await pool.query(
      `SELECT platform, handle FROM social_media_configs
       WHERE school_id=$1 AND enabled=true AND access_token IS NOT NULL`,
      [school_id],
    );
    return res.json(rows.rows.map((r: any) => ({ platform: r.platform, handle: r.handle })));
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/teacher/social-media/upload
// Upload media files to Supabase storage
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upload', upload.array('media', 5), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ error: 'No files uploaded' });

    const paths: string[] = [];

    for (const file of files) {
      const result = await uploadFile({
        schoolId: school_id,
        folder: 'notes',
        localPath: file.path,
        originalName: file.originalname,
        mimeType: file.mimetype,
      });
      paths.push(result.storagePath);
    }

    return res.json({ paths, count: paths.length });
  } catch (err: any) {
    console.error('[sm upload]', err);
    return res.status(500).json({ error: err?.message || 'Upload failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/teacher/social-media/posts/generate-caption
// AI generates polished caption + hashtags
// ─────────────────────────────────────────────────────────────────────────────
router.post('/posts/generate-caption', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { raw_caption, media_type, platforms = [] } = req.body;
    if (!raw_caption?.trim()) return res.status(400).json({ error: 'raw_caption is required' });

    // Get school name
    const schoolRow = await pool.query('SELECT name FROM schools WHERE id=$1', [school_id]);
    const schoolName = schoolRow.rows[0]?.name || 'Silver Oak Juniors';

    const platformNote = platforms.includes('twitter')
      ? 'Note: Twitter/X requires the total caption + hashtags to be under 280 characters.'
      : '';

    const prompt = `You are a social media manager for a preschool called "${schoolName}".
Write a warm, engaging caption for the following post.

Teacher's notes: ${raw_caption}
Post type: ${media_type === 'video' ? 'Video/Reel' : 'Photo carousel'}
${platformNote}

Requirements:
- Keep the main caption under 300 characters
- Tone: warm, celebratory, parent-friendly, educational
- Do NOT use emojis (school policy)
- Include the school name naturally
- Generate 20-25 relevant hashtags (education, preschool, school-specific)

Respond ONLY with valid JSON in this exact format:
{"caption": "...", "hashtags": ["#tag1", "#tag2"]}`;

    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const aiRes = await fetch(`${AI_URL}/internal/generate-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, student_name: schoolName, structured: false }),
      signal: AbortSignal.timeout(30000),
    });
    const aiData = await aiRes.json() as any;
    const rawText = (aiData?.response || '').trim();

    // Parse JSON from AI response
    let caption = '';
    let hashtags: string[] = [];
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        caption = parsed.caption || '';
        hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 30) : [];
      }
    } catch {
      caption = rawText.substring(0, 300);
    }

    if (!caption) return res.status(500).json({ error: 'AI could not generate caption. Please write one manually.' });

    return res.json({ caption, hashtags });
  } catch (err: any) {
    console.error('[sm generate-caption]', err);
    return res.status(500).json({ error: 'Caption generation failed. Please write one manually.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/teacher/social-media/posts
// Submit a post for approval
// ─────────────────────────────────────────────────────────────────────────────
router.post('/posts', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { media_type, media_paths, raw_caption, ai_caption, hashtags, platforms } = req.body;

    if (!media_type || !['video', 'image_carousel'].includes(media_type)) {
      return res.status(400).json({ error: 'media_type must be video or image_carousel' });
    }
    if (!media_paths?.length) return res.status(400).json({ error: 'media_paths required' });
    if (!raw_caption?.trim()) return res.status(400).json({ error: 'caption required' });
    if (!platforms?.length) return res.status(400).json({ error: 'Select at least one platform' });

    if (media_type === 'image_carousel' && media_paths.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 images per carousel' });
    }

    // Get school timezone for quota check
    const tzRow = await pool.query(`SELECT timezone FROM schools WHERE id=$1`, [school_id])
      .catch(() => ({ rows: [{ timezone: 'Asia/Kolkata' }] }));
    const tz = tzRow.rows[0]?.timezone || 'Asia/Kolkata';

    // Check quota
    const quota = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE media_type='video')::int          AS video_used,
         COUNT(*) FILTER (WHERE media_type='image_carousel')::int AS image_used
       FROM social_media_posts
       WHERE teacher_id=$1 AND school_id=$2 AND status!='rejected'
         AND submitted_at::timestamptz AT TIME ZONE $3 >= (CURRENT_DATE AT TIME ZONE $3)`,
      [user_id, school_id, tz],
    );
    const { video_used, image_used } = quota.rows[0];
    if (media_type === 'video' && video_used >= 1) {
      return res.status(429).json({ error: 'Daily video limit reached (1 per day). Try again tomorrow.' });
    }
    if (media_type === 'image_carousel' && image_used >= 2) {
      return res.status(429).json({ error: 'Daily image post limit reached (2 per day). Try again tomorrow.' });
    }

    // Verify platforms are enabled for this school
    const enabledRows = await pool.query(
      `SELECT platform FROM social_media_configs WHERE school_id=$1 AND enabled=true AND access_token IS NOT NULL`,
      [school_id],
    );
    const enabledPlatforms = new Set(enabledRows.rows.map((r: any) => r.platform));
    const invalidPlatforms = (platforms as string[]).filter(p => !enabledPlatforms.has(p));
    if (invalidPlatforms.length) {
      return res.status(400).json({ error: `Platforms not configured: ${invalidPlatforms.join(', ')}` });
    }

    // Insert post
    const postResult = await pool.query(
      `INSERT INTO social_media_posts
         (school_id, teacher_id, media_type, media_paths, raw_caption, ai_caption, hashtags, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending_approval')
       RETURNING id`,
      [school_id, user_id, media_type, media_paths, raw_caption.trim(), ai_caption || null, hashtags || []],
    );
    const postId = postResult.rows[0].id;

    // Insert per-platform records
    for (const platform of platforms as string[]) {
      await pool.query(
        `INSERT INTO social_media_post_platforms (post_id, school_id, platform) VALUES ($1,$2,$3)`,
        [postId, school_id, platform],
      );
    }

    return res.status(201).json({ id: postId, message: 'Post submitted for admin approval' });
  } catch (err: any) {
    console.error('[sm create post]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/teacher/social-media/posts
// Teacher's own post history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const result = await pool.query(
      `SELECT smp.id, smp.media_type, smp.media_paths, smp.raw_caption, smp.ai_caption,
              smp.final_caption, smp.hashtags, smp.status, smp.rejection_reason,
              smp.submitted_at, smp.published_at,
              COALESCE(
                json_agg(json_build_object('platform', pf.platform, 'status', pf.status, 'error', pf.error_message))
                FILTER (WHERE pf.id IS NOT NULL), '[]'
              ) AS platforms
       FROM social_media_posts smp
       LEFT JOIN social_media_post_platforms pf ON pf.post_id = smp.id
       WHERE smp.teacher_id=$1 AND smp.school_id=$2
       GROUP BY smp.id
       ORDER BY smp.submitted_at DESC
       LIMIT 50`,
      [user_id, school_id],
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { uploadFile, deleteFile, getPublicUrl } from '../../lib/storage';
import { uploadRateLimit } from '../../middleware/rateLimit';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin'));

const logoUpload = multer({
  dest: '/tmp/oakit-uploads/',
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Logo must be JPEG, PNG, SVG or WebP'));
  },
});

// GET /api/v1/admin/settings
router.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;

    // Get school profile — use safe column access in case migration 036 hasn't run
    let school: any = {};
    try {
      const schoolRow = await pool.query(
        `SELECT name, subdomain, contact, logo_path, primary_color, tagline FROM schools WHERE id = $1`,
        [school_id]
      );
      school = schoolRow.rows[0] ?? {};
    } catch {
      // Fallback if branding columns don't exist yet (migration 036 not run)
      const schoolRow = await pool.query(
        `SELECT name, subdomain, contact FROM schools WHERE id = $1`,
        [school_id]
      );
      school = schoolRow.rows[0] ?? {};
    }

    // Get settings
    const settingsRow = await pool.query(
      `SELECT notes_expiry_days, ai_plan_mode, voice_enabled, instagram_handle FROM school_settings WHERE school_id = $1`,
      [school_id]
    );
    if (settingsRow.rows.length === 0) {
      await pool.query(
        `INSERT INTO school_settings (school_id, notes_expiry_days) VALUES ($1, 14) ON CONFLICT DO NOTHING`,
        [school_id]
      );
    }

    return res.json({
      school_name: school.name ?? '',
      subdomain: school.subdomain ?? '',
      contact_email: school.contact?.email ?? '',
      contact_phone: school.contact?.phone ?? '',
      contact_address: school.contact?.address ?? '',
      notes_expiry_days: settingsRow.rows[0]?.notes_expiry_days ?? 14,
      ai_plan_mode: settingsRow.rows[0]?.ai_plan_mode ?? 'standard',
      voice_enabled: settingsRow.rows[0]?.voice_enabled ?? false,
      logo_url: school.logo_path ? getPublicUrl(school.logo_path) : null,
      primary_color: school.primary_color ?? '#1A3C2E',
      tagline: school.tagline ?? '',
      instagram_handle: settingsRow.rows[0]?.instagram_handle ?? '',
    });
  } catch (err) {
    console.error('[settings GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/admin/settings
router.put('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { school_name, contact_email, contact_phone, contact_address, notes_expiry_days, primary_color, tagline, instagram_handle } = req.body;

    // Update school profile if provided
    if (school_name !== undefined || contact_email !== undefined || contact_phone !== undefined || contact_address !== undefined || primary_color !== undefined || tagline !== undefined) {
      const schoolRow = await pool.query('SELECT contact FROM schools WHERE id = $1', [school_id]);
      const existingContact = schoolRow.rows[0]?.contact ?? {};
      const newContact = {
        ...existingContact,
        ...(contact_email !== undefined ? { email: contact_email } : {}),
        ...(contact_phone !== undefined ? { phone: contact_phone } : {}),
        ...(contact_address !== undefined ? { address: contact_address } : {}),
      };
      await pool.query(
        `UPDATE schools SET
          name = COALESCE($1, name),
          contact = $2,
          primary_color = COALESCE(NULLIF($3,''), primary_color),
          tagline = COALESCE($4, tagline)
         WHERE id = $5`,
        [school_name || null, JSON.stringify(newContact), primary_color || '', tagline ?? null, school_id]
      );
    }
    if (notes_expiry_days !== undefined) {
      const days = parseInt(notes_expiry_days);
      if (isNaN(days) || days < 1 || days > 365) {
        return res.status(400).json({ error: 'notes_expiry_days must be between 1 and 365' });
      }
      await pool.query(
        `INSERT INTO school_settings (school_id, notes_expiry_days, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (school_id) DO UPDATE
         SET notes_expiry_days = EXCLUDED.notes_expiry_days, updated_at = now()`,
        [school_id, days]
      );
    }

    const { ai_plan_mode } = req.body;
    if (ai_plan_mode !== undefined) {
      if (!['standard', 'ai_enhanced'].includes(ai_plan_mode)) {
        return res.status(400).json({ error: 'ai_plan_mode must be standard or ai_enhanced' });
      }
      await pool.query(
        `INSERT INTO school_settings (school_id, ai_plan_mode, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (school_id) DO UPDATE
         SET ai_plan_mode = EXCLUDED.ai_plan_mode, updated_at = now()`,
        [school_id, ai_plan_mode]
      );
    }

    // Voice feature toggle
    const { voice_enabled } = req.body;
    if (voice_enabled !== undefined) {
      await pool.query(
        `INSERT INTO school_settings (school_id, voice_enabled, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (school_id) DO UPDATE
         SET voice_enabled = EXCLUDED.voice_enabled, updated_at = now()`,
        [school_id, Boolean(voice_enabled)]
      );
    }

    // Instagram handle
    if (instagram_handle !== undefined) {
      // Strip leading @ if user typed it
      const handle = (instagram_handle as string).replace(/^@/, '').trim();
      await pool.query(
        `INSERT INTO school_settings (school_id, instagram_handle, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (school_id) DO UPDATE
         SET instagram_handle = EXCLUDED.instagram_handle, updated_at = now()`,
        [school_id, handle || null]
      );
    }

    // Return updated settings
    const updated = await pool.query(
      `SELECT s.name as school_name, s.subdomain, s.contact, s.logo_path, s.primary_color, s.tagline,
              COALESCE(ss.notes_expiry_days, 14) as notes_expiry_days,
              COALESCE(ss.ai_plan_mode, 'standard') as ai_plan_mode,
              COALESCE(ss.voice_enabled, false) as voice_enabled,
              ss.instagram_handle
       FROM schools s
       LEFT JOIN school_settings ss ON ss.school_id = s.id
       WHERE s.id = $1`,
      [school_id]
    );
    const r = updated.rows[0];
    return res.json({
      school_name: r.school_name,
      subdomain: r.subdomain,
      contact_email: r.contact?.email ?? '',
      contact_phone: r.contact?.phone ?? '',
      contact_address: r.contact?.address ?? '',
      notes_expiry_days: r.notes_expiry_days,
      ai_plan_mode: r.ai_plan_mode ?? 'standard',
      voice_enabled: r.voice_enabled ?? false,
      logo_url: r.logo_path ? getPublicUrl(r.logo_path) : null,
      primary_color: r.primary_color ?? '#1A3C2E',
      tagline: r.tagline ?? '',
      instagram_handle: r.instagram_handle ?? '',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/settings/logo — upload school logo
router.post('/logo', uploadRateLimit, (req: Request, res: Response, next: any) => {
  logoUpload.single('logo')(req, res, (err: any) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Logo must be under 2 MB' });
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // Delete old logo from Supabase
    try {
      const oldRow = await pool.query('SELECT logo_path FROM schools WHERE id = $1', [school_id]);
      await deleteFile(oldRow.rows[0]?.logo_path);
    } catch { /* column may not exist yet */ }

    const { storagePath, publicUrl } = await uploadFile({
      schoolId: school_id,
      folder: 'logos',
      localPath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      actorId: req.user!.user_id,
      actorRole: 'admin',
      entityType: 'school_logo',
      entityId: school_id,
    });

    await pool.query('UPDATE schools SET logo_path = $1 WHERE id = $2', [storagePath, school_id]);
    console.log(`[logo upload] school=${school_id} path=${storagePath}`);
    return res.json({ logo_url: publicUrl });
  } catch (err) {
    console.error('[logo upload]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/settings/ai-plan-mode — get per-class AI mode for all classes
router.get('/ai-plan-mode', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;

    // Get all classes with their AI mode (join with class_ai_settings if exists)
    const r = await pool.query(
      `SELECT c.id as class_id, c.name as class_name,
              COALESCE(cas.ai_plan_mode, ss.ai_plan_mode, 'standard') as ai_plan_mode
       FROM classes c
       LEFT JOIN class_ai_settings cas ON cas.class_id = c.id
       LEFT JOIN school_settings ss ON ss.school_id = c.school_id
       WHERE c.school_id = $1
       ORDER BY c.name`,
      [school_id]
    );

    // Also return school-level default
    const schoolSettings = await pool.query(
      `SELECT COALESCE(ai_plan_mode, 'standard') as ai_plan_mode FROM school_settings WHERE school_id = $1`,
      [school_id]
    );

    return res.json({
      school_default: schoolSettings.rows[0]?.ai_plan_mode ?? 'standard',
      classes: r.rows,
    });
  } catch (err) {
    console.error('[settings] GET ai-plan-mode', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/admin/settings/ai-plan-mode — set AI mode for a class or school default
router.put('/ai-plan-mode', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, ai_plan_mode } = req.body;

    if (!['standard', 'ai_enhanced'].includes(ai_plan_mode)) {
      return res.status(400).json({ error: 'ai_plan_mode must be standard or ai_enhanced' });
    }

    if (class_id) {
      // Per-class setting
      await pool.query(
        `INSERT INTO class_ai_settings (class_id, school_id, ai_plan_mode, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (class_id) DO UPDATE SET ai_plan_mode = EXCLUDED.ai_plan_mode, updated_at = now()`,
        [class_id, school_id, ai_plan_mode]
      );
    } else {
      // School-level default
      await pool.query(
        `INSERT INTO school_settings (school_id, ai_plan_mode, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (school_id) DO UPDATE SET ai_plan_mode = EXCLUDED.ai_plan_mode, updated_at = now()`,
        [school_id, ai_plan_mode]
      );
    }

    return res.json({ ok: true, class_id: class_id || null, ai_plan_mode });
  } catch (err) {
    console.error('[settings] PUT ai-plan-mode', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

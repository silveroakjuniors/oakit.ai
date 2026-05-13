import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, roleGuard('super_admin'));

// GET / — list all schools with optional ?status= and ?search= filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query as Record<string, string>;
    const params: any[] = [];
    const conditions: string[] = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`name ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT id, name, subdomain, status, plan_type, billing_status, created_at
       FROM schools ${where} ORDER BY created_at DESC`,
      params
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / — create school
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, plan_type, contact } = req.body;
    if (!name || !plan_type) {
      return res.status(400).json({ error: 'name and plan_type are required' });
    }

    // Check duplicate name
    const dup = await pool.query('SELECT id FROM schools WHERE name = $1', [name]);
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: 'School with this name already exists' });
    }

    // Generate subdomain from name
    const subdomain = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // school_code = same as subdomain (used for login)
    const school_code = subdomain;

    // Check subdomain/school_code uniqueness
    const subDup = await pool.query('SELECT id FROM schools WHERE subdomain = $1 OR school_code = $1', [subdomain]);
    if (subDup.rows.length > 0) {
      // Append a short random suffix to make it unique
      const suffix = Math.floor(Math.random() * 900 + 100);
      const uniqueCode = `${subdomain}-${suffix}`;
      const result2 = await pool.query(
        `INSERT INTO schools (name, subdomain, school_code, plan_type, status, contact)
         VALUES ($1, $2, $3, $4, 'active', $5)
         RETURNING id, name, subdomain, school_code, status, plan_type, billing_status, created_at`,
        [name, uniqueCode, uniqueCode, plan_type, contact ? JSON.stringify(contact) : null]
      );
      const schoolId2 = result2.rows[0].id;
      await pool.query(`INSERT INTO school_ai_wallet (school_id, balance_paise, lifetime_recharged_paise) VALUES ($1, 200000, 200000) ON CONFLICT DO NOTHING`, [schoolId2]).catch(() => {});
      await pool.query(`INSERT INTO school_settings (school_id, notes_expiry_days) VALUES ($1, 14) ON CONFLICT DO NOTHING`, [schoolId2]).catch(() => {});
      return res.status(201).json(result2.rows[0]);
    }

    const result = await pool.query(
      `INSERT INTO schools (name, subdomain, school_code, plan_type, status, contact)
       VALUES ($1, $2, $3, $4, 'active', $5)
       RETURNING id, name, subdomain, school_code, status, plan_type, billing_status, created_at`,
      [name, subdomain, school_code, plan_type, contact ? JSON.stringify(contact) : null]
    );
    const schoolId = result.rows[0].id;

    // ── Seed default roles for the new school ────────────────────────────────
    await pool.query(`
      INSERT INTO roles (school_id, name, permissions, portal_access) VALUES
        ($1, 'admin',      '["read:all","write:all","manage:users","manage:classes","manage:curriculum","manage:calendar","manage:finance","manage:hr"]', 'admin'),
        ($1, 'principal',  '["read:all","read:dashboard","query:ai","manage:hr","manage:finance"]', 'principal'),
        ($1, 'teacher',    '["read:own","write:own","query:ai"]', 'teacher'),
        ($1, 'parent',     '["read:own"]', 'parent'),
        ($1, 'staff',      '["read:own","write:own"]', 'staff'),
        ($1, 'accountant', '["read:all","manage:finance","view:salary"]', 'admin')
      ON CONFLICT DO NOTHING
    `, [schoolId]).catch(e => console.error('[school create] roles seed', e));

    // Seed default AI credits (₹2,000 = 200,000 paise) and school settings
    await pool.query(
      `INSERT INTO school_ai_wallet (school_id, balance_paise, lifetime_recharged_paise)
       VALUES ($1, 200000, 200000) ON CONFLICT (school_id) DO NOTHING`,
      [schoolId]
    ).catch(() => {});
    await pool.query(
      `INSERT INTO ai_credit_transactions (school_id, type, amount_paise, balance_after_paise, description)
       VALUES ($1, 'recharge', 200000, 200000, 'Default startup credits (₹2,000)')`,
      [schoolId]
    ).catch(() => {});
    await pool.query(
      `INSERT INTO school_settings (school_id, notes_expiry_days) VALUES ($1, 14) ON CONFLICT DO NOTHING`,
      [schoolId]
    ).catch(() => {});

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id — school details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.name, s.subdomain,
              COALESCE(s.school_code, s.subdomain) as school_code,
              s.status, s.plan_type, s.billing_status, s.plan_updated_at, s.contact, s.created_at,
              COALESCE(ss.translation_enabled, true) as translation_enabled
       FROM schools s
       LEFT JOIN school_settings ss ON ss.school_id = s.id
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id/features — toggle feature flags (translation_enabled, etc.)
router.patch('/:id/features', async (req: Request, res: Response) => {
  try {
    const { translation_enabled } = req.body;
    if (typeof translation_enabled !== 'boolean') {
      return res.status(400).json({ error: 'translation_enabled must be a boolean' });
    }
    await pool.query(
      `INSERT INTO school_settings (school_id, translation_enabled, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (school_id) DO UPDATE
       SET translation_enabled = EXCLUDED.translation_enabled, updated_at = now()`,
      [req.params.id, translation_enabled]
    );
    return res.json({ ok: true, translation_enabled });
  } catch (err) {
    console.error('[super-admin] PATCH features', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id — update status, plan_type, billing_status, school_code
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { status, plan_type, billing_status, school_code } = req.body;
    const current = await pool.query('SELECT plan_type, school_code FROM schools WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'School not found' });

    // Check school_code uniqueness if changing
    if (school_code && school_code !== current.rows[0].school_code) {
      const dup = await pool.query('SELECT id FROM schools WHERE school_code = $1 AND id != $2', [school_code, req.params.id]);
      if (dup.rows.length > 0) return res.status(409).json({ error: 'School code already in use' });
    }

    const planChanged = plan_type && plan_type !== current.rows[0].plan_type;
    const result = await pool.query(
      `UPDATE schools SET
        status       = COALESCE($1, status),
        plan_type    = COALESCE($2, plan_type),
        billing_status = COALESCE($3, billing_status),
        plan_updated_at = CASE WHEN $5 THEN now() ELSE plan_updated_at END
       WHERE id = $6
       RETURNING id, name, subdomain, COALESCE(school_code, subdomain) as school_code, status, plan_type, billing_status, plan_updated_at`,
      [status ?? null, plan_type ?? null, billing_status ?? null, school_code ?? null, planChanged, req.params.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[super-admin PATCH /:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id/salary-pin — super_admin only: clear a school's salary PIN (lost PIN recovery)
router.delete('/:id/salary-pin', async (req: Request, res: Response) => {
  try {
    const school = await pool.query('SELECT id, name FROM schools WHERE id = $1', [req.params.id]);
    if (school.rows.length === 0) return res.status(404).json({ error: 'School not found' });

    const result = await pool.query(
      'DELETE FROM principal_pin WHERE school_id = $1 RETURNING school_id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No salary PIN is set for this school' });
    }

    // Also clear any active salary PIN sessions for users in this school
    // (best-effort — Redis keys are per-user so we log the action instead)
    console.log(`[super-admin] Salary PIN reset for school ${req.params.id} (${school.rows[0].name}) by super_admin ${req.user?.id}`);

    return res.json({
      success: true,
      message: `Salary PIN cleared for ${school.rows[0].name}. The principal will be prompted to set a new PIN on next access.`,
    });
  } catch (err) {
    console.error('[super-admin] DELETE salary-pin', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/activate
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const school = await pool.query('SELECT status FROM schools WHERE id = $1', [req.params.id]);
    if (school.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    if (school.rows[0].status === 'active') return res.status(409).json({ error: 'School is already active' });
    await pool.query("UPDATE schools SET status = 'active' WHERE id = $1", [req.params.id]);
    return res.json({ message: 'School activated' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/deactivate
router.post('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    const school = await pool.query('SELECT status FROM schools WHERE id = $1', [req.params.id]);
    if (school.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    if (school.rows[0].status === 'inactive') return res.status(409).json({ error: 'School is already inactive' });
    await pool.query("UPDATE schools SET status = 'inactive' WHERE id = $1", [req.params.id]);
    return res.json({ message: 'School deactivated' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/users — list users for a school
router.get('/:id/users', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.mobile, u.role, u.is_active, u.created_at
       FROM users u WHERE u.school_id = $1 ORDER BY u.created_at DESC`,
      [req.params.id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/users — create user scoped to school
router.post('/:id/users', async (req: Request, res: Response) => {
  try {
    const { name, email, mobile, role } = req.body;
    const userRole = role || 'admin';
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!mobile && !email) return res.status(400).json({ error: 'mobile or email is required' });

    // Look up the role_id for this school
    const roleRow = await pool.query(
      `SELECT id FROM roles WHERE school_id = $1 AND name = $2 LIMIT 1`,
      [req.params.id, userRole]
    );
    if (roleRow.rows.length === 0) {
      return res.status(400).json({ error: `Role '${userRole}' not found for this school. Run the setup wizard first.` });
    }
    const role_id = roleRow.rows[0].id;

    // Hash password = mobile number (or a default)
    const bcrypt = await import('bcryptjs');
    const password = mobile || 'Admin@1234';
    const password_hash = await bcrypt.default.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (school_id, name, email, mobile, role_id, password_hash, is_active, force_password_reset)
       VALUES ($1, $2, $3, $4, $5, $6, true, true)
       RETURNING id, name, email, mobile, is_active, created_at`,
      [req.params.id, name, email ?? null, mobile ?? null, role_id, password_hash]
    );
    return res.status(201).json({
      ...result.rows[0],
      role: userRole,
      initial_password: password,
      note: 'User will be prompted to change password on first login',
    });
  } catch (err) {
    console.error('[super-admin POST /:id/users]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

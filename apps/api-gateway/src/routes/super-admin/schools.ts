import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, roleGuard('super_admin'));

// GET / -- list all schools
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query as Record<string, string>;
    const params: any[] = [];
    const conditions: string[] = [];
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`name ILIKE $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT id, name, subdomain, status, plan_type, billing_status, created_at FROM schools ${where} ORDER BY created_at DESC`,
      params
    );
    return res.json(result.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: 'Internal server error' }); }
});

// POST / -- create school
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, plan_type, contact, school_type } = req.body;
    if (!name || !plan_type) return res.status(400).json({ error: 'name and plan_type are required' });

    const dup = await pool.query('SELECT id FROM schools WHERE name = $1', [name]);
    if (dup.rows.length > 0) return res.status(409).json({ error: 'School with this name already exists' });

    const subdomain = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const school_code = subdomain;

    const subDup = await pool.query('SELECT id FROM schools WHERE subdomain = $1 OR school_code = $1', [subdomain]);
    let finalCode = school_code;
    if (subDup.rows.length > 0) {
      finalCode = `${subdomain}-${Math.floor(Math.random() * 900 + 100)}`;
    }

    const result = await pool.query(
      `INSERT INTO schools (name, subdomain, school_code, school_type, plan_type, status, contact)
       VALUES ($1, $2, $3, $4, $5, 'active', $6)
       RETURNING id, name, subdomain, school_code, school_type, status, plan_type, billing_status, created_at`,
      [name, finalCode, finalCode, school_type || 'preschool', plan_type, contact ? JSON.stringify(contact) : null]
    );
    const schoolId = result.rows[0].id;

    // Seed default roles
    await pool.query(`
      INSERT INTO roles (school_id, name, permissions, portal_access) VALUES
        ($1, 'admin',      '["read:all","write:all","manage:users","manage:classes","manage:curriculum","manage:calendar","manage:finance","manage:hr"]', 'admin'),
        ($1, 'principal',  '["read:all","read:dashboard","query:ai","manage:hr","manage:finance"]', 'principal'),
        ($1, 'teacher',    '["read:own","write:own","query:ai"]', 'teacher'),
        ($1, 'parent',     '["read:own"]', 'parent'),
        ($1, 'staff',      '["read:own","write:own"]', 'admin'),
        ($1, 'accountant', '["read:all","manage:finance","view:salary"]', 'admin')
      ON CONFLICT DO NOTHING
    `, [schoolId]).catch(e => console.error('[school create] roles seed', e));

    await pool.query(`INSERT INTO school_ai_wallet (school_id, balance_paise, lifetime_recharged_paise) VALUES ($1, 200000, 200000) ON CONFLICT DO NOTHING`, [schoolId]).catch(() => {});
    await pool.query(`INSERT INTO ai_credit_transactions (school_id, type, amount_paise, balance_after_paise, description) VALUES ($1, 'recharge', 200000, 200000, 'Default startup credits')`, [schoolId]).catch(() => {});
    await pool.query(`INSERT INTO school_settings (school_id, notes_expiry_days) VALUES ($1, 14) ON CONFLICT DO NOTHING`, [schoolId]).catch(() => {});

    return res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /:id -- school details
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
  } catch (err) { return res.status(500).json({ error: 'Internal server error' }); }
});

// PATCH /:id/features -- toggle feature flags
router.patch('/:id/features', async (req: Request, res: Response) => {
  try {
    const { translation_enabled } = req.body;
    if (typeof translation_enabled !== 'boolean') return res.status(400).json({ error: 'translation_enabled must be a boolean' });
    await pool.query(
      `INSERT INTO school_settings (school_id, translation_enabled, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (school_id) DO UPDATE SET translation_enabled = EXCLUDED.translation_enabled, updated_at = now()`,
      [req.params.id, translation_enabled]
    );
    return res.json({ ok: true, translation_enabled });
  } catch (err) { console.error('[super-admin] PATCH features', err); return res.status(500).json({ error: 'Internal server error' }); }
});

// PATCH /:id -- update name, status, plan_type, billing_status, school_code
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { name, status, plan_type, billing_status, school_code } = req.body;
    const current = await pool.query('SELECT plan_type, school_code FROM schools WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'School not found' });

    if (school_code && school_code !== current.rows[0].school_code) {
      const dup = await pool.query('SELECT id FROM schools WHERE school_code = $1 AND id != $2', [school_code, req.params.id]);
      if (dup.rows.length > 0) return res.status(409).json({ error: 'School code already in use' });
    }

    const planChanged = plan_type && plan_type !== current.rows[0].plan_type;
    const result = await pool.query(
      `UPDATE schools SET
        name           = COALESCE($1::text, name),
        status         = COALESCE($2::text, status),
        plan_type      = COALESCE($3::text, plan_type),
        billing_status = COALESCE($4::text, billing_status),
        plan_updated_at = CASE WHEN $5::boolean THEN now() ELSE plan_updated_at END
       WHERE id = $6
       RETURNING id, name, subdomain, COALESCE(school_code, subdomain) as school_code, status, plan_type, billing_status, plan_updated_at`,
      [name ?? null, status ?? null, plan_type ?? null, billing_status ?? null, planChanged, req.params.id]
    );

    if (school_code && result.rows.length > 0) {
      try {
        await pool.query(`UPDATE schools SET school_code = $1::text, subdomain = $1::text WHERE id = $2`, [school_code, req.params.id]);
        result.rows[0].school_code = school_code;
      } catch (scErr: any) { console.warn('[super-admin PATCH] school_code update skipped:', scErr.message); }
    }
    return res.json(result.rows[0]);
  } catch (err) { console.error('[super-admin PATCH /:id]', err); return res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /:id/salary-pin
router.delete('/:id/salary-pin', async (req: Request, res: Response) => {
  try {
    const school = await pool.query('SELECT id, name FROM schools WHERE id = $1', [req.params.id]);
    if (school.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    const result = await pool.query('DELETE FROM principal_pin WHERE school_id = $1 RETURNING school_id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No salary PIN is set for this school' });
    return res.json({ success: true, message: `Salary PIN cleared for ${school.rows[0].name}.` });
  } catch (err) { console.error('[super-admin] DELETE salary-pin', err); return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /:id/activate
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const school = await pool.query('SELECT status FROM schools WHERE id = $1', [req.params.id]);
    if (school.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    if (school.rows[0].status === 'active') return res.status(409).json({ error: 'School is already active' });
    await pool.query("UPDATE schools SET status = 'active' WHERE id = $1", [req.params.id]);
    return res.json({ message: 'School activated' });
  } catch (err) { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /:id/deactivate
router.post('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    const school = await pool.query('SELECT status FROM schools WHERE id = $1', [req.params.id]);
    if (school.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    if (school.rows[0].status === 'inactive') return res.status(409).json({ error: 'School is already inactive' });
    await pool.query("UPDATE schools SET status = 'inactive' WHERE id = $1", [req.params.id]);
    return res.json({ message: 'School deactivated' });
  } catch (err) { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /:id/users
router.get('/:id/users', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.mobile, u.role, u.is_active, u.created_at FROM users u WHERE u.school_id = $1 ORDER BY u.created_at DESC`,
      [req.params.id]
    );
    return res.json(result.rows);
  } catch (err) { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /:id/users -- create user scoped to school
router.post('/:id/users', async (req: Request, res: Response) => {
  try {
    const { name, email, mobile, role } = req.body;
    const userRole = role || 'admin';
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!mobile && !email) return res.status(400).json({ error: 'mobile or email is required' });

    let roleRow = await pool.query(`SELECT id FROM roles WHERE school_id = $1 AND name = $2 LIMIT 1`, [req.params.id, userRole]);

    if (roleRow.rows.length === 0) {
      await pool.query(`
        INSERT INTO roles (school_id, name, permissions, portal_access) VALUES
          ($1, 'admin',      '["read:all","write:all","manage:users","manage:classes","manage:curriculum","manage:calendar","manage:finance","manage:hr"]', 'admin'),
          ($1, 'principal',  '["read:all","read:dashboard","query:ai","manage:hr","manage:finance"]', 'principal'),
          ($1, 'teacher',    '["read:own","write:own","query:ai"]', 'teacher'),
          ($1, 'parent',     '["read:own"]', 'parent'),
          ($1, 'staff',      '["read:own","write:own"]', 'admin'),
          ($1, 'accountant', '["read:all","manage:finance","view:salary"]', 'admin')
        ON CONFLICT DO NOTHING
      `, [req.params.id]);
      roleRow = await pool.query(`SELECT id FROM roles WHERE school_id = $1 AND name = $2 LIMIT 1`, [req.params.id, userRole]);
    }

    if (roleRow.rows.length === 0) return res.status(400).json({ error: `Role '${userRole}' could not be created.` });
    const role_id = roleRow.rows[0].id;

    const bcrypt = await import('bcryptjs');
    const password = mobile || 'Admin@1234';
    const password_hash = await bcrypt.default.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (school_id, name, email, mobile, role_id, password_hash, is_active, force_password_reset)
       VALUES ($1, $2, $3, $4, $5, $6, true, false)
       RETURNING id, name, email, mobile, is_active, created_at`,
      [req.params.id, name, email ?? null, mobile ?? null, role_id, password_hash]
    );
    return res.status(201).json({ ...result.rows[0], role: userRole, initial_password: password });
  } catch (err) { console.error('[super-admin POST /:id/users]', err); return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;

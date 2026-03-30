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

    const result = await pool.query(
      `INSERT INTO schools (name, subdomain, plan_type, status, contact)
       VALUES ($1, $2, $3, 'active', $4)
       RETURNING id, name, subdomain, status, plan_type, billing_status, created_at`,
      [name, subdomain, plan_type, contact ? JSON.stringify(contact) : null]
    );
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
      `SELECT id, name, subdomain, status, plan_type, billing_status, plan_updated_at, contact, created_at
       FROM schools WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id — update status, plan_type, billing_status
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { status, plan_type, billing_status } = req.body;
    const current = await pool.query('SELECT plan_type FROM schools WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'School not found' });

    const planChanged = plan_type && plan_type !== current.rows[0].plan_type;
    const result = await pool.query(
      `UPDATE schools SET
        status = COALESCE($1, status),
        plan_type = COALESCE($2, plan_type),
        billing_status = COALESCE($3, billing_status),
        plan_updated_at = CASE WHEN $4 THEN now() ELSE plan_updated_at END
       WHERE id = $5
       RETURNING id, name, status, plan_type, billing_status, plan_updated_at`,
      [status ?? null, plan_type ?? null, billing_status ?? null, planChanged, req.params.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
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
    const { name, email, mobile, role, role_id } = req.body;
    if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
    const result = await pool.query(
      `INSERT INTO users (school_id, name, email, mobile, role, role_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, mobile, role, is_active, created_at`,
      [req.params.id, name, email ?? null, mobile ?? null, role, role_id ?? null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

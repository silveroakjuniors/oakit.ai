/**
 * Super-admin franchise management
 * GET    /api/v1/super-admin/franchises              — list all franchises
 * POST   /api/v1/super-admin/franchises              — create franchise
 * GET    /api/v1/super-admin/franchises/:id          — franchise detail
 * PATCH  /api/v1/super-admin/franchises/:id          — update name/contact
 * POST   /api/v1/super-admin/franchises/:id/recharge — top up franchise wallet
 * POST   /api/v1/super-admin/franchises/:id/assign-school   — assign school to franchise
 * DELETE /api/v1/super-admin/franchises/:id/assign-school/:schoolId — remove school
 * POST   /api/v1/super-admin/franchises/:id/admin    — create franchise_admin user
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, roleGuard } from '../../middleware/auth';
import { rechargeWallet } from '../../lib/aiCredits';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(jwtVerify, roleGuard('super_admin'));

// ── List all franchises ───────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        f.id, f.name, f.contact, f.created_at,
        COUNT(DISTINCT s.id)::int                                    AS total_schools,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active')::int AS active_schools,
        COALESCE(fw.balance_paise, 0)::bigint                        AS wallet_balance_paise,
        COALESCE(fw.lifetime_recharged_paise, 0)::bigint             AS lifetime_recharged_paise,
        -- Total balance across all schools in franchise
        COALESCE(SUM(w.balance_paise), 0)::bigint                    AS schools_total_balance_paise,
        -- Blocked schools
        COUNT(DISTINCT s.id) FILTER (WHERE w.blocked = true)::int    AS blocked_schools,
        -- Franchise admin count
        (SELECT COUNT(*)::int FROM users WHERE franchise_id = f.id AND role = 'franchise_admin') AS admin_count
      FROM franchises f
      LEFT JOIN schools s ON s.franchise_id = f.id
      LEFT JOIN school_ai_wallet w ON w.school_id = s.id
      LEFT JOIN franchise_ai_wallet fw ON fw.franchise_id = f.id
      GROUP BY f.id, f.name, f.contact, f.created_at, fw.balance_paise, fw.lifetime_recharged_paise
      ORDER BY f.name
    `);

    return res.json(result.rows.map((r: any) => ({
      ...r,
      wallet_balance_inr: (r.wallet_balance_paise / 100).toFixed(2),
      lifetime_recharged_inr: (r.lifetime_recharged_paise / 100).toFixed(2),
      schools_total_balance_inr: (r.schools_total_balance_paise / 100).toFixed(2),
    })));
  } catch (err) {
    console.error('[super-admin/franchises]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Create franchise ──────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, contact } = req.body;
    const { user_id } = req.user!;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

    const dup = await pool.query('SELECT id FROM franchises WHERE name = $1', [name.trim()]);
    if (dup.rows.length > 0) return res.status(409).json({ error: 'Franchise name already exists' });

    const result = await pool.query(
      `INSERT INTO franchises (name, contact, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, contact, created_at`,
      [name.trim(), contact ? JSON.stringify(contact) : null, user_id]
    );

    // Auto-create wallet
    await pool.query(
      'INSERT INTO franchise_ai_wallet (franchise_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [result.rows[0].id]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[super-admin/franchises POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Get franchise detail ──────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const franchise = await pool.query(
      `SELECT f.id, f.name, f.contact, f.created_at,
              fw.balance_paise, fw.lifetime_used_paise, fw.lifetime_recharged_paise
       FROM franchises f
       LEFT JOIN franchise_ai_wallet fw ON fw.franchise_id = f.id
       WHERE f.id = $1`,
      [req.params.id]
    );
    if (franchise.rows.length === 0) return res.status(404).json({ error: 'Franchise not found' });

    const schools = await pool.query(
      `SELECT s.id, s.name, s.status,
              COALESCE(w.balance_paise, 0) AS balance_paise,
              COALESCE(w.blocked, false) AS blocked
       FROM schools s
       LEFT JOIN school_ai_wallet w ON w.school_id = s.id
       WHERE s.franchise_id = $1 ORDER BY s.name`,
      [req.params.id]
    );

    const admins = await pool.query(
      `SELECT id, name, email, mobile, is_active, created_at
       FROM users WHERE franchise_id = $1 AND role = 'franchise_admin'`,
      [req.params.id]
    );

    const f = franchise.rows[0];
    return res.json({
      id: f.id, name: f.name, contact: f.contact, created_at: f.created_at,
      wallet_balance_inr: ((f.balance_paise || 0) / 100).toFixed(2),
      lifetime_used_inr: ((f.lifetime_used_paise || 0) / 100).toFixed(2),
      lifetime_recharged_inr: ((f.lifetime_recharged_paise || 0) / 100).toFixed(2),
      schools: schools.rows.map((s: any) => ({
        ...s,
        balance_inr: (s.balance_paise / 100).toFixed(2),
      })),
      admins: admins.rows,
    });
  } catch (err) {
    console.error('[super-admin/franchises/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Update franchise ──────────────────────────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { name, contact } = req.body;
    const result = await pool.query(
      `UPDATE franchises SET
         name    = COALESCE($1, name),
         contact = COALESCE($2, contact)
       WHERE id = $3
       RETURNING id, name, contact`,
      [name ?? null, contact ? JSON.stringify(contact) : null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Franchise not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Recharge franchise wallet ─────────────────────────────────────────────────
router.post('/:id/recharge', async (req: Request, res: Response) => {
  try {
    const { amount_inr, description } = req.body;
    const { user_id } = req.user!;

    if (!amount_inr || isNaN(Number(amount_inr)) || Number(amount_inr) <= 0) {
      return res.status(400).json({ error: 'amount_inr must be a positive number' });
    }

    const franchise = await pool.query('SELECT id, name FROM franchises WHERE id = $1', [req.params.id]);
    if (franchise.rows.length === 0) return res.status(404).json({ error: 'Franchise not found' });

    const amountPaise = Math.round(Number(amount_inr) * 100);

    const result = await pool.query(
      `INSERT INTO franchise_ai_wallet (franchise_id, balance_paise, lifetime_recharged_paise)
       VALUES ($1, $2, $2)
       ON CONFLICT (franchise_id) DO UPDATE SET
         balance_paise            = franchise_ai_wallet.balance_paise + $2,
         lifetime_recharged_paise = franchise_ai_wallet.lifetime_recharged_paise + $2,
         updated_at               = now()
       RETURNING balance_paise`,
      [req.params.id, amountPaise]
    );

    await pool.query(
      `INSERT INTO franchise_credit_transactions
         (franchise_id, type, amount_paise, balance_after_paise, description, actor_id)
       VALUES ($1, 'recharge', $2, $3, $4, $5)`,
      [req.params.id, amountPaise, result.rows[0].balance_paise,
       description || `Recharged ₹${amount_inr} by super admin`, user_id]
    );

    return res.json({
      success: true,
      franchise_name: franchise.rows[0].name,
      amount_inr: Number(amount_inr),
      balance_inr: (result.rows[0].balance_paise / 100).toFixed(2),
    });
  } catch (err) {
    console.error('[super-admin/franchises/:id/recharge]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Assign school to franchise ────────────────────────────────────────────────
router.post('/:id/assign-school', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.body;
    if (!school_id) return res.status(400).json({ error: 'school_id required' });

    const franchise = await pool.query('SELECT id FROM franchises WHERE id = $1', [req.params.id]);
    if (franchise.rows.length === 0) return res.status(404).json({ error: 'Franchise not found' });

    // Req 1.5 — check if school already belongs to another franchise
    const existing = await pool.query(
      'SELECT franchise_id FROM franchise_memberships WHERE school_id = $1',
      [school_id]
    );
    if (existing.rows.length > 0 && existing.rows[0].franchise_id !== req.params.id) {
      return res.status(409).json({ error: 'School is already a member of a franchise' });
    }

    await pool.query(
      `INSERT INTO franchise_memberships (franchise_id, school_id)
       VALUES ($1, $2) ON CONFLICT (school_id) DO NOTHING`,
      [req.params.id, school_id]
    );
    // Keep schools.franchise_id in sync
    await pool.query(
      'UPDATE schools SET franchise_id = $1 WHERE id = $2',
      [req.params.id, school_id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Remove school from franchise (Req 8.5) ────────────────────────────────────
router.delete('/:id/assign-school/:schoolId', async (req: Request, res: Response) => {
  try {
    await pool.query(
      'DELETE FROM franchise_memberships WHERE school_id = $1 AND franchise_id = $2',
      [req.params.schoolId, req.params.id]
    );
    await pool.query(
      'UPDATE schools SET franchise_id = NULL WHERE id = $1 AND franchise_id = $2',
      [req.params.schoolId, req.params.id]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── List member schools (Req 8.3) ─────────────────────────────────────────────
router.get('/:id/schools', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT s.id AS school_id, s.name AS school_name, s.status AS school_status,
              s.plan_type, fm.joined_at
       FROM franchise_memberships fm
       JOIN schools s ON s.id = fm.school_id
       WHERE fm.franchise_id = $1
       ORDER BY s.name`,
      [req.params.id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Deactivate franchise (Req 8.6) ────────────────────────────────────────────
router.post('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `UPDATE franchises SET status = 'inactive' WHERE id = $1 RETURNING id, name, status`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Franchise not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Activate franchise ────────────────────────────────────────────────────────
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `UPDATE franchises SET status = 'active' WHERE id = $1 RETURNING id, name, status`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Franchise not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Create franchise_admin user ───────────────────────────────────────────────
router.post('/:id/admin', async (req: Request, res: Response) => {
  try {
    const { name, email, mobile, password } = req.body;
    if (!name || (!email && !mobile)) {
      return res.status(400).json({ error: 'name and email or mobile required' });
    }

    const franchise = await pool.query('SELECT id FROM franchises WHERE id = $1', [req.params.id]);
    if (franchise.rows.length === 0) return res.status(404).json({ error: 'Franchise not found' });

    const passwordHash = password ? await bcrypt.hash(password, 12) : null;

    const result = await pool.query(
      `INSERT INTO users (name, email, mobile, role, franchise_id, password_hash, school_id)
       VALUES ($1, $2, $3, 'franchise_admin', $4, $5, NULL)
       RETURNING id, name, email, mobile, role, is_active, created_at`,
      [name, email ?? null, mobile ?? null, req.params.id, passwordHash]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    console.error('[super-admin/franchises/:id/admin]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

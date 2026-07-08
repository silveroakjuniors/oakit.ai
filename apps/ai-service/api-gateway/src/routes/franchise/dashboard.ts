/**
 * Franchise Admin — AI Credits Dashboard
 * All routes are READ-ONLY for franchise_admin.
 * Super-admin can also hit these routes.
 *
 * GET  /api/v1/franchise/dashboard          — summary across all schools in franchise
 * GET  /api/v1/franchise/schools            — list schools with credit status
 * GET  /api/v1/franchise/schools/:id        — single school detail
 * GET  /api/v1/franchise/wallet             — franchise-level wallet (budget allocated by super-admin)
 * GET  /api/v1/franchise/transactions       — franchise-level credit history
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, franchiseScope } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, franchiseScope);

// Helper — get franchise_id from JWT (franchise_admin) or query param (super_admin)
function getFranchiseId(req: Request): string | null {
  if (req.user!.role === 'super_admin') {
    return (req.query.franchise_id as string) || null;
  }
  return (req.user as any).franchise_id || null;
}

// ── GET /dashboard — aggregate summary ───────────────────────────────────────
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) return res.status(400).json({ error: 'franchise_id required' });

    const summary = await pool.query(`
      SELECT
        f.id AS franchise_id,
        f.name AS franchise_name,
        -- Schools
        COUNT(DISTINCT s.id)::int                                    AS total_schools,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active')::int AS active_schools,
        -- Students & teachers
        COALESCE(SUM(student_counts.cnt), 0)::int                    AS total_students,
        COALESCE(SUM(teacher_counts.cnt), 0)::int                    AS total_teachers,
        -- Wallet totals
        COALESCE(SUM(w.balance_paise), 0)::bigint                    AS total_balance_paise,
        COALESCE(SUM(w.lifetime_used_paise), 0)::bigint              AS total_used_paise,
        COALESCE(SUM(w.lifetime_recharged_paise), 0)::bigint         AS total_recharged_paise,
        -- Blocked schools
        COUNT(DISTINCT s.id) FILTER (WHERE w.blocked = true)::int    AS blocked_schools,
        -- Low balance schools
        COUNT(DISTINCT s.id) FILTER (
          WHERE w.balance_paise <= COALESCE(p.low_balance_threshold_paise, 50000)
            AND w.balance_paise > 0
        )::int                                                        AS low_balance_schools,
        -- This month's usage
        COALESCE((
          SELECT SUM(ul.cost_paise) FROM ai_usage_logs ul
          JOIN schools sc ON sc.id = ul.school_id
          WHERE sc.franchise_id = f.id
            AND ul.created_at >= date_trunc('month', now())
        ), 0)::bigint                                                 AS this_month_paise,
        COALESCE((
          SELECT COUNT(*) FROM ai_usage_logs ul
          JOIN schools sc ON sc.id = ul.school_id
          WHERE sc.franchise_id = f.id
            AND ul.created_at >= date_trunc('month', now())
            AND ul.outcome = 'allowed'
        ), 0)::int                                                    AS this_month_calls,
        -- Franchise wallet
        COALESCE(fw.balance_paise, 0)::bigint                        AS franchise_balance_paise,
        COALESCE(fw.lifetime_recharged_paise, 0)::bigint             AS franchise_lifetime_recharged_paise
      FROM franchises f
      LEFT JOIN schools s ON s.franchise_id = f.id
      LEFT JOIN school_ai_wallet w ON w.school_id = s.id
      LEFT JOIN school_ai_pricing p ON p.school_id = s.id
      LEFT JOIN franchise_ai_wallet fw ON fw.franchise_id = f.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM students WHERE school_id = s.id
      ) student_counts ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM users WHERE school_id = s.id AND role = 'teacher'
      ) teacher_counts ON true
      WHERE f.id = $1
      GROUP BY f.id, f.name, fw.balance_paise, fw.lifetime_recharged_paise
    `, [franchiseId]);

    if (summary.rows.length === 0) {
      return res.status(404).json({ error: 'Franchise not found' });
    }

    // Daily usage last 30 days (franchise-wide)
    const daily = await pool.query(`
      SELECT DATE(ul.created_at) AS day,
             COUNT(*)::int AS calls,
             SUM(ul.cost_paise)::bigint AS total_paise,
             COUNT(DISTINCT ul.school_id)::int AS active_schools
      FROM ai_usage_logs ul
      JOIN schools s ON s.id = ul.school_id
      WHERE s.franchise_id = $1
        AND ul.created_at >= now() - interval '30 days'
      GROUP BY DATE(ul.created_at)
      ORDER BY day
    `, [franchiseId]);

    // Top endpoint this month
    const topEndpoints = await pool.query(`
      SELECT ul.endpoint,
             COUNT(*)::int AS calls,
             SUM(ul.cost_paise)::bigint AS total_paise
      FROM ai_usage_logs ul
      JOIN schools s ON s.id = ul.school_id
      WHERE s.franchise_id = $1
        AND ul.created_at >= date_trunc('month', now())
      GROUP BY ul.endpoint
      ORDER BY total_paise DESC
      LIMIT 8
    `, [franchiseId]);

    const row = summary.rows[0];
    return res.json({
      franchise_id: row.franchise_id,
      franchise_name: row.franchise_name,
      total_schools: row.total_schools,
      active_schools: row.active_schools,
      total_students: row.total_students,
      total_teachers: row.total_teachers,
      blocked_schools: row.blocked_schools,
      low_balance_schools: row.low_balance_schools,
      // Wallet in ₹
      total_balance_inr: (row.total_balance_paise / 100).toFixed(2),
      total_used_inr: (row.total_used_paise / 100).toFixed(2),
      total_recharged_inr: (row.total_recharged_paise / 100).toFixed(2),
      this_month_calls: row.this_month_calls,
      this_month_inr: (row.this_month_paise / 100).toFixed(2),
      franchise_balance_inr: (row.franchise_balance_paise / 100).toFixed(2),
      franchise_lifetime_recharged_inr: (row.franchise_lifetime_recharged_paise / 100).toFixed(2),
      daily_usage: daily.rows.map((r: any) => ({
        day: r.day,
        calls: r.calls,
        inr: (r.total_paise / 100).toFixed(2),
        active_schools: r.active_schools,
      })),
      top_endpoints: topEndpoints.rows.map((r: any) => ({
        endpoint: r.endpoint,
        calls: r.calls,
        inr: (r.total_paise / 100).toFixed(2),
      })),
    });
  } catch (err) {
    console.error('[franchise/dashboard]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /schools — all schools in franchise with credit status ────────────────
router.get('/schools', async (req: Request, res: Response) => {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) return res.status(400).json({ error: 'franchise_id required' });

    const result = await pool.query(`
      SELECT
        s.id, s.name, s.subdomain, s.status, s.plan_type,
        COALESCE(w.balance_paise, 0)::bigint            AS balance_paise,
        COALESCE(w.lifetime_used_paise, 0)::bigint      AS lifetime_used_paise,
        COALESCE(w.lifetime_recharged_paise, 0)::bigint AS lifetime_recharged_paise,
        COALESCE(w.blocked, false)                      AS blocked,
        COALESCE(w.low_balance_alerted, false)          AS low_balance_alerted,
        COALESCE(p.low_balance_threshold_paise, 50000)  AS low_balance_threshold_paise,
        -- This month
        COALESCE((
          SELECT SUM(cost_paise) FROM ai_usage_logs
          WHERE school_id = s.id AND created_at >= date_trunc('month', now())
        ), 0)::bigint AS this_month_paise,
        COALESCE((
          SELECT COUNT(*) FROM ai_usage_logs
          WHERE school_id = s.id AND created_at >= date_trunc('month', now()) AND outcome = 'allowed'
        ), 0)::int AS this_month_calls,
        (SELECT COUNT(*)::int FROM students WHERE school_id = s.id) AS total_students,
        (SELECT COUNT(*)::int FROM users WHERE school_id = s.id AND role = 'teacher') AS total_teachers
      FROM schools s
      LEFT JOIN school_ai_wallet w ON w.school_id = s.id
      LEFT JOIN school_ai_pricing p ON p.school_id = s.id
      WHERE s.franchise_id = $1
      ORDER BY s.name
    `, [franchiseId]);

    return res.json(result.rows.map((r: any) => ({
      ...r,
      balance_inr: (r.balance_paise / 100).toFixed(2),
      lifetime_used_inr: (r.lifetime_used_paise / 100).toFixed(2),
      lifetime_recharged_inr: (r.lifetime_recharged_paise / 100).toFixed(2),
      this_month_inr: (r.this_month_paise / 100).toFixed(2),
      low_balance_threshold_inr: (r.low_balance_threshold_paise / 100).toFixed(2),
      credit_status: r.blocked ? 'blocked'
        : r.balance_paise <= r.low_balance_threshold_paise ? 'low'
        : 'healthy',
    })));
  } catch (err) {
    console.error('[franchise/schools]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /schools/:id — single school detail (must belong to franchise) ────────
router.get('/schools/:id', async (req: Request, res: Response) => {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) return res.status(400).json({ error: 'franchise_id required' });

    // Verify school belongs to this franchise
    const schoolRow = await pool.query(
      `SELECT id, name, franchise_id FROM schools WHERE id = $1`,
      [req.params.id]
    );
    if (schoolRow.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    if (schoolRow.rows[0].franchise_id !== franchiseId && req.user!.role !== 'super_admin') {
      return res.status(403).json({ error: 'School does not belong to your franchise' });
    }

    // Wallet + pricing
    const wallet = await pool.query(`
      SELECT w.balance_paise, w.lifetime_used_paise, w.lifetime_recharged_paise,
             w.blocked, w.low_balance_alerted, w.updated_at,
             p.cost_per_1k_input_paise, p.cost_per_1k_output_paise,
             p.flat_cost_paise, p.low_balance_threshold_paise
      FROM school_ai_wallet w
      LEFT JOIN school_ai_pricing p ON p.school_id = w.school_id
      WHERE w.school_id = $1
    `, [req.params.id]);

    // Last 10 transactions
    const txns = await pool.query(`
      SELECT type, amount_paise, balance_after_paise, description, endpoint, created_at
      FROM ai_credit_transactions
      WHERE school_id = $1
      ORDER BY created_at DESC LIMIT 10
    `, [req.params.id]);

    // Daily usage last 30 days
    const daily = await pool.query(`
      SELECT DATE(created_at) AS day,
             COUNT(*)::int AS calls,
             SUM(cost_paise)::bigint AS total_paise
      FROM ai_usage_logs
      WHERE school_id = $1 AND created_at >= now() - interval '30 days'
      GROUP BY DATE(created_at) ORDER BY day
    `, [req.params.id]);

    // By endpoint this month
    const byEndpoint = await pool.query(`
      SELECT endpoint, COUNT(*)::int AS calls, SUM(cost_paise)::bigint AS total_paise
      FROM ai_usage_logs
      WHERE school_id = $1 AND created_at >= date_trunc('month', now())
      GROUP BY endpoint ORDER BY total_paise DESC
    `, [req.params.id]);

    const w = wallet.rows[0] || {};
    return res.json({
      school: { id: schoolRow.rows[0].id, name: schoolRow.rows[0].name },
      balance_inr: ((w.balance_paise || 0) / 100).toFixed(2),
      lifetime_used_inr: ((w.lifetime_used_paise || 0) / 100).toFixed(2),
      lifetime_recharged_inr: ((w.lifetime_recharged_paise || 0) / 100).toFixed(2),
      blocked: w.blocked || false,
      low_balance_alerted: w.low_balance_alerted || false,
      low_balance_threshold_inr: ((w.low_balance_threshold_paise || 50000) / 100).toFixed(2),
      flat_cost_paise: w.flat_cost_paise || 5,
      transactions: txns.rows.map((r: any) => ({
        type: r.type,
        amount_inr: (Math.abs(r.amount_paise) / 100).toFixed(2),
        balance_after_inr: (r.balance_after_paise / 100).toFixed(2),
        description: r.description,
        endpoint: r.endpoint,
        date: r.created_at,
      })),
      daily_usage: daily.rows.map((r: any) => ({
        day: r.day,
        calls: r.calls,
        inr: (r.total_paise / 100).toFixed(2),
      })),
      by_endpoint: byEndpoint.rows.map((r: any) => ({
        endpoint: r.endpoint,
        calls: r.calls,
        inr: (r.total_paise / 100).toFixed(2),
      })),
    });
  } catch (err) {
    console.error('[franchise/schools/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /wallet — franchise-level wallet ──────────────────────────────────────
router.get('/wallet', async (req: Request, res: Response) => {
  try {
    const franchiseId = getFranchiseId(req);
    if (!franchiseId) return res.status(400).json({ error: 'franchise_id required' });

    const wallet = await pool.query(
      `SELECT balance_paise, lifetime_used_paise, lifetime_recharged_paise, updated_at
       FROM franchise_ai_wallet WHERE franchise_id = $1`,
      [franchiseId]
    );

    const txns = await pool.query(
      `SELECT type, amount_paise, balance_after_paise, description, school_id, created_at
       FROM franchise_credit_transactions
       WHERE franchise_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [franchiseId]
    );

    const w = wallet.rows[0] || { balance_paise: 0, lifetime_used_paise: 0, lifetime_recharged_paise: 0 };
    return res.json({
      balance_inr: (w.balance_paise / 100).toFixed(2),
      lifetime_used_inr: (w.lifetime_used_paise / 100).toFixed(2),
      lifetime_recharged_inr: (w.lifetime_recharged_paise / 100).toFixed(2),
      updated_at: w.updated_at,
      transactions: txns.rows.map((r: any) => ({
        type: r.type,
        amount_inr: (Math.abs(r.amount_paise) / 100).toFixed(2),
        balance_after_inr: (r.balance_after_paise / 100).toFixed(2),
        description: r.description,
        school_id: r.school_id,
        date: r.created_at,
      })),
    });
  } catch (err) {
    console.error('[franchise/wallet]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

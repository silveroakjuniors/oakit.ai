/**
 * Super-admin billing routes
 * GET  /api/v1/super-admin/billing/schools          — all schools with wallet summary
 * GET  /api/v1/super-admin/billing/schools/:id      — single school wallet detail
 * POST /api/v1/super-admin/billing/schools/:id/recharge — add credits
 * PUT  /api/v1/super-admin/billing/schools/:id/pricing  — update per-school pricing
 * GET  /api/v1/super-admin/billing/platform-stats   — platform-wide AI usage
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, roleGuard } from '../../middleware/auth';
import { rechargeWallet } from '../../lib/aiCredits';

const router = Router();
router.use(jwtVerify, roleGuard('super_admin'));

// ── All schools with wallet summary ──────────────────────────────────────────
router.get('/schools', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id, s.name, s.subdomain, s.status, s.plan_type,
        COALESCE(w.balance_paise, 0)              AS balance_paise,
        COALESCE(w.lifetime_used_paise, 0)        AS lifetime_used_paise,
        COALESCE(w.lifetime_recharged_paise, 0)   AS lifetime_recharged_paise,
        COALESCE(w.blocked, false)                AS blocked,
        COALESCE(w.low_balance_alerted, false)    AS low_balance_alerted,
        COALESCE(p.flat_cost_paise, 5)            AS flat_cost_paise,
        COALESCE(p.low_balance_threshold_paise, 50000) AS low_balance_threshold_paise,
        -- This month's usage
        COALESCE((
          SELECT SUM(cost_paise) FROM ai_usage_logs
          WHERE school_id = s.id
            AND created_at >= date_trunc('month', now())
        ), 0) AS this_month_paise,
        -- This month's call count
        COALESCE((
          SELECT COUNT(*) FROM ai_usage_logs
          WHERE school_id = s.id
            AND created_at >= date_trunc('month', now())
            AND outcome = 'allowed'
        ), 0)::int AS this_month_calls,
        -- Total students
        (SELECT COUNT(*) FROM students WHERE school_id = s.id)::int AS total_students,
        -- Total teachers
        (SELECT COUNT(*) FROM users WHERE school_id = s.id AND role = 'teacher')::int AS total_teachers
      FROM schools s
      LEFT JOIN school_ai_wallet w ON w.school_id = s.id
      LEFT JOIN school_ai_pricing p ON p.school_id = s.id
      ORDER BY s.name
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error('[billing] schools list', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Single school wallet detail ───────────────────────────────────────────────
router.get('/schools/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const school = await pool.query(
      `SELECT s.id, s.name, s.subdomain, s.status, s.plan_type,
              w.balance_paise, w.lifetime_used_paise, w.lifetime_recharged_paise,
              w.blocked, w.low_balance_alerted, w.updated_at,
              p.cost_per_1k_input_paise, p.cost_per_1k_output_paise,
              p.flat_cost_paise, p.low_balance_threshold_paise
       FROM schools s
       LEFT JOIN school_ai_wallet w ON w.school_id = s.id
       LEFT JOIN school_ai_pricing p ON p.school_id = s.id
       WHERE s.id = $1`,
      [id]
    );
    if (school.rows.length === 0) return res.status(404).json({ error: 'School not found' });

    // Last 20 transactions
    const txns = await pool.query(
      `SELECT t.id, t.type, t.amount_paise, t.balance_after_paise,
              t.description, t.endpoint, t.created_at,
              u.name as actor_name
       FROM ai_credit_transactions t
       LEFT JOIN users u ON u.id = t.actor_id
       WHERE t.school_id = $1
       ORDER BY t.created_at DESC LIMIT 20`,
      [id]
    );

    // Usage by endpoint (this month)
    const byEndpoint = await pool.query(
      `SELECT endpoint,
              COUNT(*)::int AS calls,
              SUM(cost_paise)::bigint AS total_paise
       FROM ai_usage_logs
       WHERE school_id = $1 AND created_at >= date_trunc('month', now())
       GROUP BY endpoint ORDER BY total_paise DESC`,
      [id]
    );

    // Daily usage (last 30 days)
    const daily = await pool.query(
      `SELECT DATE(created_at) AS day,
              COUNT(*)::int AS calls,
              SUM(cost_paise)::bigint AS total_paise
       FROM ai_usage_logs
       WHERE school_id = $1 AND created_at >= now() - interval '30 days'
       GROUP BY DATE(created_at) ORDER BY day`,
      [id]
    );

    return res.json({
      school: school.rows[0],
      transactions: txns.rows,
      usage_by_endpoint: byEndpoint.rows,
      daily_usage: daily.rows,
    });
  } catch (err) {
    console.error('[billing] school detail', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Recharge a school's wallet ────────────────────────────────────────────────
router.post('/schools/:id/recharge', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount_inr, description } = req.body;
    const { user_id } = req.user!;

    if (!amount_inr || isNaN(Number(amount_inr)) || Number(amount_inr) <= 0) {
      return res.status(400).json({ error: 'amount_inr must be a positive number' });
    }

    const amountPaise = Math.round(Number(amount_inr) * 100);

    const school = await pool.query('SELECT id, name FROM schools WHERE id = $1', [id]);
    if (school.rows.length === 0) return res.status(404).json({ error: 'School not found' });

    const result = await rechargeWallet({
      schoolId: id,
      amountPaise,
      actorId: user_id,
      description: description || `Recharged ₹${amount_inr} by super admin`,
    });

    return res.json({
      success: true,
      school_name: school.rows[0].name,
      amount_inr: Number(amount_inr),
      balance_inr: (result.balance_paise / 100).toFixed(2),
      balance_paise: result.balance_paise,
    });
  } catch (err) {
    console.error('[billing] recharge', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Update per-school pricing ─────────────────────────────────────────────────
router.put('/schools/:id/pricing', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.user!;
    const {
      cost_per_1k_input_paise,
      cost_per_1k_output_paise,
      flat_cost_paise,
      low_balance_threshold_paise,
    } = req.body;

    await pool.query(
      `INSERT INTO school_ai_pricing
         (school_id, cost_per_1k_input_paise, cost_per_1k_output_paise,
          flat_cost_paise, low_balance_threshold_paise, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (school_id) DO UPDATE SET
         cost_per_1k_input_paise   = COALESCE($2, school_ai_pricing.cost_per_1k_input_paise),
         cost_per_1k_output_paise  = COALESCE($3, school_ai_pricing.cost_per_1k_output_paise),
         flat_cost_paise           = COALESCE($4, school_ai_pricing.flat_cost_paise),
         low_balance_threshold_paise = COALESCE($5, school_ai_pricing.low_balance_threshold_paise),
         updated_at                = now(),
         updated_by                = $6`,
      [id,
       cost_per_1k_input_paise ?? null,
       cost_per_1k_output_paise ?? null,
       flat_cost_paise ?? null,
       low_balance_threshold_paise ?? null,
       user_id]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[billing] pricing update', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Platform-wide AI stats ────────────────────────────────────────────────────
router.get('/platform-stats', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        -- Total revenue collected (all recharges)
        COALESCE((SELECT SUM(amount_paise) FROM ai_credit_transactions WHERE type = 'recharge'), 0)
          AS total_recharged_paise,
        -- Total AI cost consumed
        COALESCE((SELECT SUM(lifetime_used_paise) FROM school_ai_wallet), 0)
          AS total_used_paise,
        -- Total outstanding balance
        COALESCE((SELECT SUM(balance_paise) FROM school_ai_wallet), 0)
          AS total_balance_paise,
        -- Schools with zero balance (blocked)
        (SELECT COUNT(*) FROM school_ai_wallet WHERE blocked = true)::int
          AS blocked_schools,
        -- Schools with low balance
        (SELECT COUNT(*) FROM school_ai_wallet w
         JOIN school_ai_pricing p ON p.school_id = w.school_id
         WHERE w.balance_paise <= p.low_balance_threshold_paise AND w.balance_paise > 0)::int
          AS low_balance_schools,
        -- This month's total calls
        (SELECT COUNT(*) FROM ai_usage_logs
         WHERE created_at >= date_trunc('month', now()) AND outcome = 'allowed')::int
          AS this_month_calls,
        -- This month's total cost
        COALESCE((SELECT SUM(cost_paise) FROM ai_usage_logs
         WHERE created_at >= date_trunc('month', now())), 0)
          AS this_month_paise,
        -- Top endpoint this month
        (SELECT endpoint FROM ai_usage_logs
         WHERE created_at >= date_trunc('month', now())
         GROUP BY endpoint ORDER BY COUNT(*) DESC LIMIT 1)
          AS top_endpoint
    `);

    // Daily usage last 30 days (platform-wide)
    const daily = await pool.query(`
      SELECT DATE(created_at) AS day,
             COUNT(*)::int AS calls,
             SUM(cost_paise)::bigint AS total_paise,
             COUNT(DISTINCT school_id)::int AS active_schools
      FROM ai_usage_logs
      WHERE created_at >= now() - interval '30 days'
      GROUP BY DATE(created_at) ORDER BY day
    `);

    return res.json({ ...result.rows[0], daily_usage: daily.rows });
  } catch (err) {
    console.error('[billing] platform stats', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

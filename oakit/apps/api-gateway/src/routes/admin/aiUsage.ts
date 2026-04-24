/**
 * Admin/Principal AI usage routes (school-scoped, read-only)
 * GET /api/v1/admin/ai-usage — wallet + usage summary for this school
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'));

router.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;

    const wallet = await pool.query(
      `SELECT w.balance_paise, w.lifetime_used_paise, w.lifetime_recharged_paise,
              w.blocked, w.low_balance_alerted,
              p.low_balance_threshold_paise, p.flat_cost_paise
       FROM school_ai_wallet w
       LEFT JOIN school_ai_pricing p ON p.school_id = w.school_id
       WHERE w.school_id = $1`,
      [school_id]
    );

    if (wallet.rows.length === 0) {
      return res.json({
        balance_paise: 0, balance_inr: '0.00',
        lifetime_used_paise: 0, lifetime_used_inr: '0.00',
        blocked: false, this_month_calls: 0, this_month_paise: 0,
        daily_usage: [], by_endpoint: [],
      });
    }

    const w = wallet.rows[0];

    // This month's usage
    const monthly = await pool.query(
      `SELECT COUNT(*)::int AS calls, COALESCE(SUM(cost_paise),0)::bigint AS total_paise
       FROM ai_usage_logs
       WHERE school_id = $1 AND created_at >= date_trunc('month', now()) AND outcome = 'allowed'`,
      [school_id]
    );

    // Daily usage last 30 days
    const daily = await pool.query(
      `SELECT DATE(created_at) AS day,
              COUNT(*)::int AS calls,
              SUM(cost_paise)::bigint AS total_paise
       FROM ai_usage_logs
       WHERE school_id = $1 AND created_at >= now() - interval '30 days'
       GROUP BY DATE(created_at) ORDER BY day`,
      [school_id]
    );

    // By endpoint this month
    const byEndpoint = await pool.query(
      `SELECT endpoint,
              COUNT(*)::int AS calls,
              SUM(cost_paise)::bigint AS total_paise
       FROM ai_usage_logs
       WHERE school_id = $1 AND created_at >= date_trunc('month', now())
       GROUP BY endpoint ORDER BY total_paise DESC LIMIT 10`,
      [school_id]
    );

    // Last 5 recharges
    const recharges = await pool.query(
      `SELECT amount_paise, balance_after_paise, description, created_at
       FROM ai_credit_transactions
       WHERE school_id = $1 AND type = 'recharge'
       ORDER BY created_at DESC LIMIT 5`,
      [school_id]
    );

    return res.json({
      balance_paise: w.balance_paise,
      balance_inr: (w.balance_paise / 100).toFixed(2),
      lifetime_used_paise: w.lifetime_used_paise,
      lifetime_used_inr: (w.lifetime_used_paise / 100).toFixed(2),
      lifetime_recharged_paise: w.lifetime_recharged_paise,
      lifetime_recharged_inr: (w.lifetime_recharged_paise / 100).toFixed(2),
      blocked: w.blocked,
      low_balance_alerted: w.low_balance_alerted,
      low_balance_threshold_inr: (w.low_balance_threshold_paise / 100).toFixed(2),
      this_month_calls: monthly.rows[0]?.calls ?? 0,
      this_month_paise: monthly.rows[0]?.total_paise ?? 0,
      this_month_inr: ((monthly.rows[0]?.total_paise ?? 0) / 100).toFixed(2),
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
      recent_recharges: recharges.rows.map((r: any) => ({
        amount_inr: (r.amount_paise / 100).toFixed(2),
        balance_after_inr: (r.balance_after_paise / 100).toFixed(2),
        description: r.description,
        date: r.created_at,
      })),
    });
  } catch (err) {
    console.error('[admin/ai-usage]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

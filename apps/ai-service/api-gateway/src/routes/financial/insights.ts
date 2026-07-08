import { Router } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, permissionGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify);

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

async function checkAiCredits(schoolId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT balance FROM ai_credits WHERE school_id = $1`, [schoolId]
  ).catch(() => ({ rows: [] }));
  return result.rows.length > 0 && parseFloat(result.rows[0].balance) > 0;
}

// ── GET /insights — AI financial insights ────────────────────────────────────
router.get('/insights', permissionGuard('VIEW_REPORTS'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const role = req.user!.role;

    const hasCredits = await checkAiCredits(schoolId);
    if (!hasCredits) {
      return res.status(402).json({
        error: 'AI credits exhausted. Please recharge to access financial insights.',
        code: 'INSUFFICIENT_AI_CREDITS',
      });
    }

    // Aggregate financial data for AI
    const [revenueResult, expenseResult, pendingResult] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM fee_payments
         WHERE school_id = $1 AND deleted_at IS NULL
         AND payment_date >= DATE_TRUNC('month', CURRENT_DATE)`,
        [schoolId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
         WHERE school_id = $1 AND deleted_at IS NULL
         AND date >= DATE_TRUNC('month', CURRENT_DATE)`,
        [schoolId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(outstanding_balance), 0) AS total FROM student_fee_accounts
         WHERE school_id = $1 AND deleted_at IS NULL AND status != 'paid'`,
        [schoolId]
      ),
    ]);

    const financialContext = {
      school_id: schoolId,
      current_month_revenue: parseFloat(revenueResult.rows[0].total),
      current_month_expenses: parseFloat(expenseResult.rows[0].total),
      total_pending: parseFloat(pendingResult.rows[0].total),
      role,
    };

    // Call AI service with 10s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/financial-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(financialContext),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!aiRes.ok) throw new Error(`AI service error: ${aiRes.status}`);
      const insights: any = await aiRes.json();

      // Admin only gets collection insights
      if (role === 'admin') {
        return res.json({
          collection_performance: insights.collection_performance || null,
        });
      }

      return res.json(insights);
    } catch (aiErr: any) {
      clearTimeout(timeout);
      if (aiErr.name === 'AbortError') {
        return res.status(504).json({ error: 'AI service timed out' });
      }
      // Return basic insights if AI service unavailable
      return res.json({
        revenue_forecast: null,
        expense_forecast: null,
        collection_performance: {
          current_month_revenue: financialContext.current_month_revenue,
          total_pending: financialContext.total_pending,
        },
        note: 'AI insights temporarily unavailable',
      });
    }
  } catch (err) {
    console.error('[insights GET /insights]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /assistant — AI financial assistant ──────────────────────────────────
router.post('/assistant', permissionGuard('VIEW_REPORTS'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { query } = req.body as { query: string };

    if (!query || typeof query !== 'string' || query.trim().length === 0)
      return res.status(400).json({ error: 'query is required' });

    const hasCredits = await checkAiCredits(schoolId);
    if (!hasCredits) {
      return res.status(402).json({
        error: 'AI credits exhausted. Please recharge to use the Financial Assistant.',
        code: 'INSUFFICIENT_AI_CREDITS',
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/financial-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, school_id: schoolId }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!aiRes.ok) throw new Error(`AI service error: ${aiRes.status}`);
      const data: any = await aiRes.json();

      return res.json({
        answer: data.answer || 'I don\'t have enough data to answer that question.',
      });
    } catch (aiErr: any) {
      clearTimeout(timeout);
      if (aiErr.name === 'AbortError') {
        return res.status(504).json({ error: 'AI assistant timed out. Please try again.' });
      }
      return res.json({
        answer: 'The financial assistant is temporarily unavailable. Please try again later.',
      });
    }
  } catch (err) {
    console.error('[insights POST /assistant]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

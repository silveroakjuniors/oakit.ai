import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { pool } from '../../lib/db';
import { jwtVerify, permissionGuard } from '../../middleware/auth';
import { generateReportPDF } from '../../lib/pdfService';
import type { BrandingContext, GeneratorContext, ReportData } from '../../lib/pdfService';

const router = Router();
router.use(jwtVerify, permissionGuard('VIEW_REPORTS'));

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'oakit-uploads';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || key === 'your_service_role_key_here') return null;
  return createClient(url, key);
}

function principalOnly(req: any, res: any, next: () => void) {
  if (req.user?.role !== 'principal' && req.user?.role !== 'super_admin')
    return res.status(403).json({ error: 'This report is restricted to the Principal' });
  return next();
}

// ── GET /revenue ──────────────────────────────────────────────────────────────
router.get('/revenue', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { from, to } = req.query as Record<string, string>;
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(fp.amount), 0) AS total_collected,
         COALESCE(SUM(sfa.outstanding_balance), 0) AS total_pending,
         CASE WHEN SUM(sfa.assigned_amount) > 0
              THEN ROUND(SUM(fp.amount) / SUM(sfa.assigned_amount) * 100, 2)
              ELSE 0 END AS collection_rate
       FROM student_fee_accounts sfa
       LEFT JOIN fee_payments fp ON fp.fee_head_id = sfa.fee_head_id
         AND fp.student_id = sfa.student_id AND fp.school_id = sfa.school_id
         AND fp.deleted_at IS NULL
         ${from ? `AND fp.payment_date >= '${from}'` : ''}
         ${to   ? `AND fp.payment_date <= '${to}'`   : ''}
       WHERE sfa.school_id = $1 AND sfa.deleted_at IS NULL`,
      [schoolId]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[reports GET /revenue]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /expenses ─────────────────────────────────────────────────────────────
router.get('/expenses', principalOnly, async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { from, to } = req.query as Record<string, string>;
    let query = `SELECT category, SUM(amount) AS total,
                   DATE_TRUNC('month', date) AS month
                 FROM expenses WHERE school_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [schoolId];
    let idx = 2;
    if (from) { query += ` AND date >= $${idx++}`; params.push(from); }
    if (to)   { query += ` AND date <= $${idx++}`; params.push(to); }
    query += ` GROUP BY category, DATE_TRUNC('month', date) ORDER BY month DESC`;
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[reports GET /expenses]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /profit-loss ──────────────────────────────────────────────────────────
router.get('/profit-loss', principalOnly, async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { from, to } = req.query as Record<string, string>;
    const incomeResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_income FROM fee_payments
       WHERE school_id = $1 AND deleted_at IS NULL
       ${from ? `AND payment_date >= '${from}'` : ''}
       ${to   ? `AND payment_date <= '${to}'`   : ''}`,
      [schoolId]
    );
    const expenseResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM expenses
       WHERE school_id = $1 AND deleted_at IS NULL
       ${from ? `AND date >= '${from}'` : ''}
       ${to   ? `AND date <= '${to}'`   : ''}`,
      [schoolId]
    );
    const income = parseFloat(incomeResult.rows[0].total_income);
    const expenses = parseFloat(expenseResult.rows[0].total_expenses);
    return res.json({ total_income: income, total_expenses: expenses, net_profit: income - expenses });
  } catch (err) {
    console.error('[reports GET /profit-loss]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /daily-collection ─────────────────────────────────────────────────────
router.get('/daily-collection', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { date } = req.query as { date?: string };
    const targetDate = date || new Date().toISOString().split('T')[0];
    const result = await pool.query(
      `SELECT fp.*, s.name AS student_name, fh.name AS fee_head_name
       FROM fee_payments fp
       JOIN students s ON s.id = fp.student_id
       JOIN fee_heads fh ON fh.id = fp.fee_head_id
       WHERE fp.school_id = $1 AND fp.payment_date = $2 AND fp.deleted_at IS NULL
       ORDER BY fp.created_at DESC`,
      [schoolId, targetDate]
    );
    return res.json({ date: targetDate, payments: result.rows, total: result.rows.reduce((s: number, r: any) => s + parseFloat(r.amount), 0) });
  } catch (err) {
    console.error('[reports GET /daily-collection]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /monthly-collection ───────────────────────────────────────────────────
router.get('/monthly-collection', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { year, month } = req.query as Record<string, string>;
    let query = `SELECT DATE_TRUNC('month', payment_date) AS month, SUM(amount) AS total, COUNT(*) AS count
                 FROM fee_payments WHERE school_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [schoolId];
    let idx = 2;
    if (year)  { query += ` AND EXTRACT(YEAR FROM payment_date) = $${idx++}`;  params.push(parseInt(year)); }
    if (month) { query += ` AND EXTRACT(MONTH FROM payment_date) = $${idx++}`; params.push(parseInt(month)); }
    query += ` GROUP BY DATE_TRUNC('month', payment_date) ORDER BY month DESC`;
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[reports GET /monthly-collection]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /annual-collection ────────────────────────────────────────────────────
router.get('/annual-collection', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { year } = req.query as { year?: string };
    let query = `SELECT EXTRACT(YEAR FROM payment_date) AS year, SUM(amount) AS total, COUNT(*) AS count
                 FROM fee_payments WHERE school_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [schoolId];
    if (year) { query += ` AND EXTRACT(YEAR FROM payment_date) = $2`; params.push(parseInt(year)); }
    query += ` GROUP BY EXTRACT(YEAR FROM payment_date) ORDER BY year DESC`;
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[reports GET /annual-collection]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /student-pending ──────────────────────────────────────────────────────
router.get('/student-pending', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const result = await pool.query(
      `SELECT s.id, s.name AS student_name, SUM(sfa.outstanding_balance) AS total_outstanding
       FROM student_fee_accounts sfa JOIN students s ON s.id = sfa.student_id
       WHERE sfa.school_id = $1 AND sfa.deleted_at IS NULL AND sfa.outstanding_balance > 0
       GROUP BY s.id, s.name ORDER BY total_outstanding DESC`,
      [schoolId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[reports GET /student-pending]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /class-collection ─────────────────────────────────────────────────────
router.get('/class-collection', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const result = await pool.query(
      `SELECT c.id, c.name AS class_name,
              COALESCE(SUM(fp.amount), 0) AS total_collected,
              COALESCE(SUM(sfa.outstanding_balance), 0) AS total_pending
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.id AND s.school_id = $1
       LEFT JOIN student_fee_accounts sfa ON sfa.student_id = s.id AND sfa.school_id = $1 AND sfa.deleted_at IS NULL
       LEFT JOIN fee_payments fp ON fp.student_id = s.id AND fp.school_id = $1 AND fp.deleted_at IS NULL
       WHERE c.school_id = $1
       GROUP BY c.id, c.name ORDER BY c.name`,
      [schoolId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[reports GET /class-collection]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /activity-revenue ─────────────────────────────────────────────────────
router.get('/activity-revenue', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const result = await pool.query(
      `SELECT fh.name AS activity_name, COALESCE(SUM(fp.amount), 0) AS total_revenue
       FROM fee_heads fh
       LEFT JOIN fee_payments fp ON fp.fee_head_id = fh.id AND fp.school_id = $1 AND fp.deleted_at IS NULL
       WHERE fh.school_id = $1 AND fh.type = 'activity' AND fh.deleted_at IS NULL
       GROUP BY fh.id, fh.name ORDER BY total_revenue DESC`,
      [schoolId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[reports GET /activity-revenue]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /daycare-usage ────────────────────────────────────────────────────────
router.get('/daycare-usage', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { from, to } = req.query as Record<string, string>;
    let query = `SELECT ur.student_id, s.name AS student_name, SUM(ur.quantity) AS total_hours
                 FROM usage_records ur JOIN students s ON s.id = ur.student_id
                 WHERE ur.school_id = $1 AND ur.service_type = 'daycare'`;
    const params: any[] = [schoolId];
    let idx = 2;
    if (from) { query += ` AND ur.date >= $${idx++}`; params.push(from); }
    if (to)   { query += ` AND ur.date <= $${idx++}`; params.push(to); }
    query += ` GROUP BY ur.student_id, s.name ORDER BY total_hours DESC`;
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[reports GET /daycare-usage]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /reconciliation-summary ───────────────────────────────────────────────
router.get('/reconciliation-summary', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const bankResult = await pool.query(
      `SELECT match_status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
       FROM bank_reconciliation_items WHERE school_id = $1 GROUP BY match_status`,
      [schoolId]
    );
    const cashResult = await pool.query(
      `SELECT COALESCE(SUM(variance), 0) AS total_variance,
              COUNT(*) FILTER (WHERE status = 'mismatch') AS mismatch_count
       FROM cash_reconciliation_logs WHERE school_id = $1`,
      [schoolId]
    );
    return res.json({ bank: bankResult.rows, cash: cashResult.rows[0] });
  } catch (err) {
    console.error('[reports GET /reconciliation-summary]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /:type/pdf — Generate and stream report PDF ───────────────────────────
router.get('/:type/pdf', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { type } = req.params;
    const { from, to } = req.query as Record<string, string>;

    const schoolResult = await pool.query(`SELECT name, address FROM schools WHERE id = $1`, [schoolId]);
    const school = schoolResult.rows[0] || { name: 'School', address: '' };

    const branding: BrandingContext = { school_name: school.name, school_address: school.address || '', logo_url: null };
    const ctx: GeneratorContext = {
      generated_by_name: (req.user as any).name || 'System',
      generated_by_role: req.user!.role,
      generated_at: new Date(),
    };

    const reportData: ReportData = {
      title: type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' Report',
      date_range: from && to ? `${from} to ${to}` : 'All time',
      headers: ['Item', 'Value'],
      rows: [['Report generated', new Date().toLocaleDateString('en-IN')]],
      summary: { 'Report Type': type, 'School': school.name },
    };

    const pdfBuffer = await generateReportPDF(reportData, branding, ctx);

    // Audit log for expense report views
    if (type === 'expenses') {
      await pool.query(
        `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, after_data)
         VALUES ($1,$2,$3,'VIEW_EXPENSE_REPORT','expense',$4)`,
        [schoolId, req.user!.id, req.user!.role, JSON.stringify({ type, from, to })]
      ).catch(() => {});
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[reports GET /:type/pdf]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

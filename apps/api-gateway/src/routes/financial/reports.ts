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

    // Get total pending from student_fee_accounts (no join needed)
    const pendingResult = await pool.query(
      `SELECT
         COALESCE(SUM(outstanding_balance), 0) AS total_pending,
         COALESCE(SUM(assigned_amount), 0) AS total_assigned
       FROM student_fee_accounts
       WHERE school_id = $1 AND deleted_at IS NULL`,
      [schoolId]
    );

    // Get total collected from fee_payments
    const params: any[] = [schoolId];
    let idx = 2;
    let dateFilter = '';
    if (from) { dateFilter += ` AND payment_date >= $${idx++}`; params.push(from); }
    if (to)   { dateFilter += ` AND payment_date <= $${idx++}`; params.push(to); }
    const collectedResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_collected
       FROM fee_payments
       WHERE school_id = $1 AND deleted_at IS NULL${dateFilter}`,
      params
    );

    const totalPending = parseFloat(pendingResult.rows[0].total_pending);
    const totalAssigned = parseFloat(pendingResult.rows[0].total_assigned);
    const totalCollected = parseFloat(collectedResult.rows[0].total_collected);
    const collectionRate = totalAssigned > 0 ? Math.round((totalCollected / totalAssigned) * 10000) / 100 : 0;

    return res.json({
      total_collected: totalCollected,
      total_pending: totalPending,
      collection_rate: collectionRate,
    });
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
    const params: any[] = [schoolId];
    let idx = 2;
    let dateFilter = '';
    if (from) { dateFilter += ` AND date >= $${idx++}`; params.push(from); }
    if (to)   { dateFilter += ` AND date <= $${idx++}`; params.push(to); }
    const query = `SELECT category, SUM(amount) AS total,
                   DATE_TRUNC('month', date) AS month
                 FROM expenses WHERE school_id = $1 AND deleted_at IS NULL${dateFilter}
                 GROUP BY category, DATE_TRUNC('month', date) ORDER BY month DESC`;
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
    const incomeParams: any[] = [schoolId];
    const expenseParams: any[] = [schoolId];
    let incomeFilter = '';
    let expenseFilter = '';
    let idx = 2;
    if (from) {
      incomeFilter  += ` AND payment_date >= $${idx}`;
      expenseFilter += ` AND date >= $${idx}`;
      incomeParams.push(from);
      expenseParams.push(from);
      idx++;
    }
    if (to) {
      incomeFilter  += ` AND payment_date <= $${idx}`;
      expenseFilter += ` AND date <= $${idx}`;
      incomeParams.push(to);
      expenseParams.push(to);
      idx++;
    }
    const incomeResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_income FROM fee_payments
       WHERE school_id = $1 AND deleted_at IS NULL${incomeFilter}`,
      incomeParams
    );
    const expenseResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM expenses
       WHERE school_id = $1 AND deleted_at IS NULL${expenseFilter}`,
      expenseParams
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
      `SELECT
         ROW_NUMBER() OVER (ORDER BY fp.created_at DESC) AS sl_no,
         fp.*, s.name AS student_name, fh.name AS fee_head_name
       FROM fee_payments fp
       JOIN students s ON s.id = fp.student_id
       JOIN fee_heads fh ON fh.id = fp.fee_head_id
       WHERE fp.school_id = $1 AND fp.payment_date = $2 AND fp.deleted_at IS NULL
       ORDER BY fp.created_at DESC`,
      [schoolId, targetDate]
    );
    return res.json({
      date: targetDate,
      payments: result.rows,
      total: result.rows.reduce((s: number, r: any) => s + parseFloat(r.amount), 0),
    });
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
      `SELECT
         ROW_NUMBER() OVER (ORDER BY SUM(sfa.outstanding_balance) DESC) AS sl_no,
         s.id, s.name AS student_name,
         c.name AS class_name,
         SUM(sfa.outstanding_balance) AS total_outstanding
       FROM student_fee_accounts sfa
       JOIN students s ON s.id = sfa.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE sfa.school_id = $1 AND sfa.deleted_at IS NULL AND sfa.outstanding_balance > 0
       GROUP BY s.id, s.name, c.name
       ORDER BY total_outstanding DESC`,
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
      `SELECT
         ROW_NUMBER() OVER (ORDER BY c.name ASC) AS sl_no,
         c.id, c.name AS class_name,
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
      `SELECT
         ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(fp.amount), 0) DESC) AS sl_no,
         fh.name AS activity_name,
         COALESCE(SUM(fp.amount), 0) AS total_revenue
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
    const params: any[] = [schoolId];
    let idx = 2;
    let dateFilter = '';
    if (from) { dateFilter += ` AND ur.date >= $${idx++}`; params.push(from); }
    if (to)   { dateFilter += ` AND ur.date <= $${idx++}`; params.push(to); }
    const query = `SELECT ur.student_id, s.name AS student_name, SUM(ur.quantity) AS total_hours
                 FROM usage_records ur JOIN students s ON s.id = ur.student_id
                 WHERE ur.school_id = $1 AND ur.service_type = 'daycare'${dateFilter}
                 GROUP BY ur.student_id, s.name ORDER BY total_hours DESC`;
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[reports GET /daycare-usage]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /fee-summary — Total collected + instalment-wise pending ──────────────
router.get('/fee-summary', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;

    const [collectedResult, assignedResult, instalmentResult] = await Promise.all([
      // Total actually collected (from fee_payments directly)
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_collected
         FROM fee_payments
         WHERE school_id = $1 AND deleted_at IS NULL`,
        [schoolId]
      ),
      // Total assigned and outstanding (from student_fee_accounts)
      pool.query(
        `SELECT
           COALESCE(SUM(assigned_amount), 0)     AS total_assigned,
           COALESCE(SUM(outstanding_balance), 0) AS total_outstanding
         FROM student_fee_accounts
         WHERE school_id = $1 AND deleted_at IS NULL`,
        [schoolId]
      ),
      // Instalment-wise: join through fee_heads to scope by school
      pool.query(
        `SELECT
           fi.id AS instalment_id,
           fi.instalment_number,
           COALESCE(fi.label, 'Instalment ' || fi.instalment_number) AS label,
           fi.due_date,
           fi.amount AS per_student_amount,
           fh.id    AS fee_head_id,
           fh.name  AS fee_head_name,
           COUNT(DISTINCT sfa.student_id)::int AS student_count
         FROM fee_instalments fi
         JOIN fee_heads fh
           ON fh.id = fi.fee_head_id
           AND fh.school_id = $1
           AND fh.deleted_at IS NULL
         JOIN student_fee_accounts sfa
           ON sfa.fee_head_id = fi.fee_head_id
           AND sfa.school_id = $1
           AND sfa.deleted_at IS NULL
         GROUP BY fi.id, fi.instalment_number, fi.label, fi.due_date, fi.amount, fh.id, fh.name
         ORDER BY fi.due_date ASC NULLS LAST, fi.instalment_number ASC`,
        [schoolId]
      ),
    ]);

    // For each instalment, compute paid vs pending
    const instalments = await Promise.all(
      instalmentResult.rows.map(async (inst: any) => {
        const studentCount = inst.student_count;
        const perStudent = parseFloat(inst.per_student_amount);
        const totalDue = perStudent * studentCount;
        const instNum = inst.instalment_number;

        // Total paid for this fee head across all students
        const paidResult = await pool.query(
          `SELECT COALESCE(SUM(amount), 0) AS total_paid
           FROM fee_payments
           WHERE fee_head_id = $1 AND school_id = $2 AND deleted_at IS NULL`,
          [inst.fee_head_id, schoolId]
        );
        const totalPaidForHead = parseFloat(paidResult.rows[0].total_paid);

        // Attribute payments to instalments in order
        const paidUpToThis = Math.min(totalPaidForHead, instNum * totalDue);
        const paidUpToPrev = Math.min(totalPaidForHead, (instNum - 1) * totalDue);
        const paidForThis  = Math.max(0, paidUpToThis - paidUpToPrev);
        const pendingForThis = Math.max(0, totalDue - paidForThis);

        return {
          instalment_number:       instNum,
          label:                   inst.label,
          due_date:                inst.due_date,
          fee_head_name:           inst.fee_head_name,
          student_count:           studentCount,
          total_instalment_amount: Math.round(totalDue * 100) / 100,
          total_paid:              Math.round(paidForThis * 100) / 100,
          total_pending:           Math.round(pendingForThis * 100) / 100,
        };
      })
    );

    return res.json({
      total_collected:   parseFloat(collectedResult.rows[0].total_collected),
      total_assigned:    parseFloat(assignedResult.rows[0].total_assigned),
      total_outstanding: parseFloat(assignedResult.rows[0].total_outstanding),
      instalments,
    });
  } catch (err) {
    console.error('[reports GET /fee-summary]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /reconciliation-pending ───────────────────────────────────────────────
// Returns admin-recorded UPI/bank payments pending reconciliation,
// GROUPED by reference_number so sibling/split payments appear as one entry.
// Each group shows: reference, total_amount, payment_date, mode, and the
// individual payment rows (student name, fee head, amount).
router.get('/reconciliation-pending', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;

    // Fetch all individual pending payments
    const result = await pool.query(
      `SELECT
         fp.id, fp.reference_number, fp.amount, fp.payment_mode,
         fp.payment_date, fp.receipt_number, fp.created_at,
         s.name AS student_name,
         c.name AS class_name,
         fh.name AS fee_head_name
       FROM fee_payments fp
       JOIN students s ON s.id = fp.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       JOIN fee_heads fh ON fh.id = fp.fee_head_id
       WHERE fp.school_id = $1
         AND fp.needs_reconciliation = true
         AND fp.reconciled_at IS NULL
         AND fp.deleted_at IS NULL
       ORDER BY fp.reference_number NULLS LAST, fp.created_at DESC`,
      [schoolId]
    );

    // Group by reference_number (null refs each get their own group keyed by id)
    const groups: Record<string, {
      reference_number: string | null;
      total_amount: number;
      payment_mode: string;
      payment_date: string;
      payment_ids: string[];
      rows: any[];
    }> = {};

    for (const row of result.rows) {
      const key = row.reference_number || `__no_ref_${row.id}`;
      if (!groups[key]) {
        groups[key] = {
          reference_number: row.reference_number || null,
          total_amount: 0,
          payment_mode: row.payment_mode,
          payment_date: row.payment_date,
          payment_ids: [],
          rows: [],
        };
      }
      groups[key].total_amount += parseFloat(row.amount);
      groups[key].payment_ids.push(row.id);
      groups[key].rows.push({
        id: row.id,
        student_name: row.student_name,
        class_name: row.class_name,
        fee_head_name: row.fee_head_name,
        amount: parseFloat(row.amount),
        receipt_number: row.receipt_number,
      });
    }

    const payments = Object.values(groups).map(g => ({
      ...g,
      total_amount: Math.round(g.total_amount * 100) / 100,
    }));

    return res.json({
      count: result.rows.length,
      group_count: payments.length,
      total_amount: payments.reduce((s, g) => s + g.total_amount, 0),
      payments,
    });
  } catch (err) {
    console.error('[reports GET /reconciliation-pending]', err);
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

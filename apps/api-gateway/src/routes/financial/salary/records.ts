import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { pool } from '../../../lib/db';
import { jwtVerify, permissionGuard } from '../../../middleware/auth';
import { salaryPinGuard } from '../../../middleware/salaryPinGuard';
import { calculateMonthlySalary } from '../../../lib/salaryCalculation';
import { generatePayslipPDF } from '../../../lib/pdfService';
import type { BrandingContext, GeneratorContext, PayslipData } from '../../../lib/pdfService';
import { redis } from '../../../lib/redis';

const router = Router();
router.use(jwtVerify);

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'oakit-uploads';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || key === 'your_service_role_key_here') return null;
  return createClient(url, key);
}

async function uploadPdfBuffer(buffer: Buffer, storagePath: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) return `/payslips/${storagePath}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: 'application/pdf', upsert: true,
  });
  if (error) throw new Error(`PDF upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

// ── POST /generate/:userId/:year/:month — Generate salary record ──────────────
router.post('/generate/:userId/:year/:month', salaryPinGuard, permissionGuard('VIEW_SALARY'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { userId, year, month } = req.params;

    // Prevent duplicates
    const existing = await pool.query(
      `SELECT id FROM salary_records WHERE school_id = $1 AND user_id = $2 AND year = $3 AND month = $4 AND deleted_at IS NULL`,
      [schoolId, userId, parseInt(year), parseInt(month)]
    );
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'Salary record already exists for this staff member and month' });

    // Fetch salary config
    const configResult = await pool.query(
      `SELECT * FROM staff_salary_config WHERE school_id = $1 AND user_id = $2 ORDER BY effective_from DESC LIMIT 1`,
      [schoolId, userId]
    );
    if (configResult.rows.length === 0)
      return res.status(404).json({ error: 'Salary config not found for this staff member' });
    const config = configResult.rows[0];

    // Fetch working days
    const wdResult = await pool.query(
      `SELECT * FROM monthly_working_days WHERE school_id = $1 AND year = $2 AND month = $3`,
      [schoolId, parseInt(year), parseInt(month)]
    );
    if (wdResult.rows.length === 0)
      return res.status(404).json({ error: 'Working days not configured for this month' });
    const wd = wdResult.rows[0];

    const { present_days = 0, absent_days = 0, leave_days = 0, deduction_choice = 'deduct', override_amount } = req.body;

    const calc = calculateMonthlySalary({
      gross_salary: parseFloat(config.gross_salary),
      present_days: parseInt(present_days),
      absent_days: parseInt(absent_days),
      leave_days: parseInt(leave_days),
      working_days: parseInt(wd.working_days),
      deduction_choice,
      override_amount: override_amount != null ? parseFloat(override_amount) : null,
    });

    const result = await pool.query(
      `INSERT INTO salary_records (school_id, user_id, year, month, gross_salary, present_days, absent_days,
         leave_days, working_days, per_day_rate, deduction_amount, net_salary, override_amount,
         deduction_choice, status, payslip_status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft','draft',$15)
       RETURNING *`,
      [schoolId, userId, parseInt(year), parseInt(month), config.gross_salary,
       present_days, absent_days, leave_days, wd.working_days,
       calc.per_day_rate, calc.deduction_amount, calc.net_salary,
       override_amount ?? null, deduction_choice, req.user!.id]
    );

    await pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, after_data)
       VALUES ($1,$2,$3,'GENERATE_SALARY','salary',$4,$5)`,
      [schoolId, req.user!.id, req.user!.role, result.rows[0].id,
       JSON.stringify({ year, month, net_salary: calc.net_salary })]
    ).catch(() => {});

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[salary/records POST /generate]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET / — List salary records for a month ───────────────────────────────────
router.get('/', salaryPinGuard, permissionGuard('VIEW_SALARY'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { year, month } = req.query as { year?: string; month?: string };

    let query = `SELECT sr.*, u.name AS staff_name, u.role AS staff_role
                 FROM salary_records sr JOIN users u ON u.id = sr.user_id
                 WHERE sr.school_id = $1 AND sr.deleted_at IS NULL`;
    const params: any[] = [schoolId];
    let idx = 2;

    if (year)  { query += ` AND sr.year = $${idx++}`;  params.push(parseInt(year)); }
    if (month) { query += ` AND sr.month = $${idx++}`; params.push(parseInt(month)); }
    query += ` ORDER BY sr.created_at DESC`;

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[salary/records GET /]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /:id — Update deduction choice or override amount ─────────────────────
router.put('/:id', salaryPinGuard, permissionGuard('EDIT_SALARY'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;
    const { deduction_choice, override_amount, present_days, absent_days, leave_days } = req.body;

    const existing = await pool.query(
      `SELECT * FROM salary_records WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [id, schoolId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Salary record not found' });

    const rec = existing.rows[0];

    // Recalculate with updated inputs
    const calc = calculateMonthlySalary({
      gross_salary: parseFloat(rec.gross_salary),
      present_days: present_days !== undefined ? parseInt(present_days) : parseInt(rec.present_days),
      absent_days: absent_days !== undefined ? parseInt(absent_days) : parseInt(rec.absent_days),
      leave_days: leave_days !== undefined ? parseInt(leave_days) : parseInt(rec.leave_days),
      working_days: parseInt(rec.working_days),
      deduction_choice: deduction_choice || rec.deduction_choice,
      override_amount: override_amount !== undefined ? parseFloat(override_amount) : rec.override_amount,
    });

    const result = await pool.query(
      `UPDATE salary_records SET
         deduction_choice = $1, override_amount = $2,
         present_days = $3, absent_days = $4, leave_days = $5,
         per_day_rate = $6, deduction_amount = $7, net_salary = $8
       WHERE id = $9 AND school_id = $10 RETURNING *`,
      [deduction_choice || rec.deduction_choice, override_amount ?? rec.override_amount,
       present_days ?? rec.present_days, absent_days ?? rec.absent_days, leave_days ?? rec.leave_days,
       calc.per_day_rate, calc.deduction_amount, calc.net_salary, id, schoolId]
    );

    await pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, before_data, after_data)
       VALUES ($1,$2,$3,'EDIT_SALARY','salary',$4,$5,$6)`,
      [schoolId, req.user!.id, req.user!.role, id,
       JSON.stringify(rec), JSON.stringify(result.rows[0])]
    ).catch(() => {});

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[salary/records PUT /:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /:id/mark-paid — Mark salary as paid and generate payslip ────────────
router.post('/:id/mark-paid', salaryPinGuard, permissionGuard('VIEW_SALARY'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;
    const { payment_mode, payment_date } = req.body;

    if (!payment_mode || !payment_date)
      return res.status(400).json({ error: 'payment_mode and payment_date are required' });

    const recResult = await pool.query(
      `SELECT sr.*, u.name AS staff_name, u.role AS staff_role
       FROM salary_records sr JOIN users u ON u.id = sr.user_id
       WHERE sr.id = $1 AND sr.school_id = $2 AND sr.deleted_at IS NULL`,
      [id, schoolId]
    );
    if (recResult.rows.length === 0) return res.status(404).json({ error: 'Salary record not found' });
    const rec = recResult.rows[0];

    const schoolResult = await pool.query(`SELECT name, address FROM schools WHERE id = $1`, [schoolId]);
    const school = schoolResult.rows[0] || { name: 'School', address: '' };

    const configResult = await pool.query(
      `SELECT components FROM staff_salary_config WHERE school_id = $1 AND user_id = $2 ORDER BY effective_from DESC LIMIT 1`,
      [schoolId, rec.user_id]
    );
    const components: Array<{ name: string; amount: number }> = configResult.rows[0]?.components || [];

    const branding: BrandingContext = { school_name: school.name, school_address: school.address || '', logo_url: null };
    const ctx: GeneratorContext = {
      generated_by_name: (req.user as any).name || 'System',
      generated_by_role: req.user!.role,
      generated_at: new Date(),
    };
    const payslipData: PayslipData = {
      staff_name: rec.staff_name,
      role: rec.staff_role,
      employee_id: rec.user_id,
      month_year: `${rec.month}/${rec.year}`,
      working_days: parseInt(rec.working_days),
      present_days: parseInt(rec.present_days),
      absent_days: parseInt(rec.absent_days),
      leave_days: parseInt(rec.leave_days),
      gross_salary: parseFloat(rec.gross_salary),
      per_day_rate: parseFloat(rec.per_day_rate),
      components,
      deductions: rec.deduction_amount > 0
        ? [{ name: 'Absent Day Deduction', amount: parseFloat(rec.deduction_amount) }]
        : [],
      net_salary: parseFloat(rec.net_salary),
      payment_mode,
      payment_date: new Date(payment_date),
    };

    const pdfBuffer = await generatePayslipPDF(payslipData, branding, ctx);
    const payslipUrl = await uploadPdfBuffer(
      pdfBuffer, `payslips/${schoolId}/${rec.user_id}_${rec.year}_${rec.month}.pdf`
    );

    const result = await pool.query(
      `UPDATE salary_records SET status = 'paid', payment_mode = $1, payment_date = $2,
         payslip_url = $3, payslip_status = 'draft'
       WHERE id = $4 AND school_id = $5 RETURNING *`,
      [payment_mode, payment_date, payslipUrl, id, schoolId]
    );

    await pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, after_data)
       VALUES ($1,$2,$3,'MARK_SALARY_PAID','salary',$4,$5)`,
      [schoolId, req.user!.id, req.user!.role, id,
       JSON.stringify({ payment_mode, payment_date, payslip_url: payslipUrl })]
    ).catch(() => {});

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[salary/records POST /:id/mark-paid]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /:id — Soft-delete salary record (Finance_Manager blocked) ─────────
router.delete('/:id', salaryPinGuard, permissionGuard('VIEW_SALARY'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;

    if (req.user!.role === 'finance_manager')
      return res.status(403).json({ error: 'Finance managers cannot delete salary records' });

    const result = await pool.query(
      `UPDATE salary_records SET deleted_at = now() WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL RETURNING *`,
      [id, schoolId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Salary record not found' });

    await pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id)
       VALUES ($1,$2,$3,'DELETE_SALARY','salary',$4)`,
      [schoolId, req.user!.id, req.user!.role, id]
    ).catch(() => {});

    return res.json({ success: true, id });
  } catch (err) {
    console.error('[salary/records DELETE /:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /:id/push-payslip — Release payslip to staff ────────────────────────
router.post('/:id/push-payslip', salaryPinGuard, permissionGuard('PUSH_PAYSLIP'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE salary_records SET payslip_status = 'released'
       WHERE id = $1 AND school_id = $2 AND payslip_status = 'draft' AND deleted_at IS NULL
       RETURNING *`,
      [id, schoolId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Salary record not found or payslip already released' });

    // In-app notification to staff (best-effort via audit log)
    await pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, after_data)
       VALUES ($1,$2,$3,'PUSH_PAYSLIP','salary',$4,$5)`,
      [schoolId, req.user!.id, req.user!.role, id,
       JSON.stringify({ staff_user_id: result.rows[0].user_id })]
    ).catch(() => {});

    return res.json({ success: true, record: result.rows[0] });
  } catch (err) {
    console.error('[salary/records POST /:id/push-payslip]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /my-payslips — Staff view their own released payslips ─────────────────
router.get('/my-payslips', async (req, res) => {
  try {
    const userId = req.user!.id;
    const schoolId = req.user!.school_id;

    const result = await pool.query(
      `SELECT id, year, month, net_salary, payment_mode, payment_date, payslip_url, payslip_status
       FROM salary_records
       WHERE user_id = $1 AND school_id = $2 AND payslip_status = 'released' AND deleted_at IS NULL
       ORDER BY year DESC, month DESC`,
      [userId, schoolId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[salary/records GET /my-payslips]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

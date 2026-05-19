/**
 * Super-admin platform billing routes
 * Manages per-school billing config, invoices, GST settings
 *
 * GET    /api/v1/super-admin/platform-billing/:schoolId/config   — get billing config
 * PUT    /api/v1/super-admin/platform-billing/:schoolId/config   — save billing config
 * GET    /api/v1/super-admin/platform-billing/:schoolId/invoices — list invoices
 * POST   /api/v1/super-admin/platform-billing/:schoolId/invoices — generate invoice
 * PATCH  /api/v1/super-admin/platform-billing/invoices/:id       — update invoice status
 * GET    /api/v1/super-admin/platform-billing/overview           — all schools billing summary
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, roleGuard('super_admin'));

// ── Platform billing overview ─────────────────────────────────────────────────
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id, s.name, s.subdomain,
        COALESCE(s.school_code, s.subdomain) as school_code,
        s.status, s.plan_type,
        (SELECT COUNT(*)::int FROM students WHERE school_id = s.id AND is_active = true) as active_students,
        COALESCE(pbc.per_student_paise, 0) as per_student_paise,
        COALESCE(pbc.setup_fee_paise, 0) as setup_fee_paise,
        COALESCE(pbc.gst_enabled, false) as gst_enabled,
        COALESCE(pbc.gst_percentage, 18) as gst_percentage,
        COALESCE(pbc.billing_cycle, 'monthly') as billing_cycle,
        -- Outstanding invoices
        (SELECT COUNT(*)::int FROM platform_invoices pi WHERE pi.school_id = s.id AND pi.status IN ('sent','overdue')) as outstanding_invoices,
        (SELECT COALESCE(SUM(total_paise),0)::bigint FROM platform_invoices pi WHERE pi.school_id = s.id AND pi.status IN ('sent','overdue')) as outstanding_paise,
        -- Total paid
        (SELECT COALESCE(SUM(total_paise),0)::bigint FROM platform_invoices pi WHERE pi.school_id = s.id AND pi.status = 'paid') as total_paid_paise
      FROM schools s
      LEFT JOIN platform_billing_config pbc ON pbc.school_id = s.id
      ORDER BY s.name
    `);
    return res.json(result.rows.map((r: any) => ({
      ...r,
      per_student_inr: (r.per_student_paise / 100).toFixed(2),
      setup_fee_inr: (r.setup_fee_paise / 100).toFixed(2),
      outstanding_inr: (r.outstanding_paise / 100).toFixed(2),
      total_paid_inr: (r.total_paid_paise / 100).toFixed(2),
      monthly_revenue_inr: ((r.per_student_paise * r.active_students) / 100).toFixed(2),
    })));
  } catch (err) {
    console.error('[platform-billing overview]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Get billing config for a school ──────────────────────────────────────────
router.get('/:schoolId/config', async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const school = await pool.query(
      `SELECT id, name, COALESCE(school_code, subdomain) as school_code,
              (SELECT COUNT(*)::int FROM students WHERE school_id = $1 AND is_active = true) as active_students
       FROM schools WHERE id = $1`,
      [schoolId]
    );
    if (!school.rows.length) return res.status(404).json({ error: 'School not found' });

    const config = await pool.query(
      'SELECT * FROM platform_billing_config WHERE school_id = $1',
      [schoolId]
    );

    return res.json({
      school: school.rows[0],
      config: config.rows[0] || {
        per_student_paise: 0,
        setup_fee_paise: 0,
        ai_credits_included_paise: 200000,
        gst_enabled: false,
        gst_percentage: 18.00,
        school_gstin: null,
        platform_gstin: null,
        billing_cycle: 'monthly',
        notes: null,
      },
    });
  } catch (err) {
    console.error('[platform-billing config GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Save billing config for a school ─────────────────────────────────────────
router.put('/:schoolId/config', async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const {
      per_student_paise,
      setup_fee_paise,
      ai_credits_included_paise,
      gst_enabled,
      gst_percentage,
      school_gstin,
      platform_gstin,
      billing_cycle,
      notes,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO platform_billing_config
         (school_id, per_student_paise, setup_fee_paise, ai_credits_included_paise,
          gst_enabled, gst_percentage, school_gstin, platform_gstin, billing_cycle, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (school_id) DO UPDATE SET
         per_student_paise          = COALESCE($2, platform_billing_config.per_student_paise),
         setup_fee_paise            = COALESCE($3, platform_billing_config.setup_fee_paise),
         ai_credits_included_paise  = COALESCE($4, platform_billing_config.ai_credits_included_paise),
         gst_enabled                = COALESCE($5, platform_billing_config.gst_enabled),
         gst_percentage             = COALESCE($6, platform_billing_config.gst_percentage),
         school_gstin               = $7,
         platform_gstin             = $8,
         billing_cycle              = COALESCE($9, platform_billing_config.billing_cycle),
         notes                      = $10,
         updated_at                 = now()
       RETURNING *`,
      [schoolId,
       per_student_paise ?? null, setup_fee_paise ?? null, ai_credits_included_paise ?? null,
       gst_enabled ?? null, gst_percentage ?? null,
       school_gstin ?? null, platform_gstin ?? null,
       billing_cycle ?? null, notes ?? null]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[platform-billing config PUT]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── List invoices for a school ────────────────────────────────────────────────
router.get('/:schoolId/invoices', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM platform_invoices WHERE school_id = $1 ORDER BY created_at DESC`,
      [req.params.schoolId]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Generate invoice for a school ─────────────────────────────────────────────
router.post('/:schoolId/invoices', async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const { period_from, period_to, notes, include_setup_fee, include_ai_credits } = req.body;

    if (!period_from || !period_to) {
      return res.status(400).json({ error: 'period_from and period_to are required' });
    }

    // Get school + config
    const school = await pool.query(
      `SELECT s.name, COALESCE(s.school_code, s.subdomain) as school_code,
              (SELECT COUNT(*)::int FROM students WHERE school_id = $1 AND is_active = true) as active_students
       FROM schools s WHERE s.id = $1`,
      [schoolId]
    );
    if (!school.rows.length) return res.status(404).json({ error: 'School not found' });

    const configRow = await pool.query(
      'SELECT * FROM platform_billing_config WHERE school_id = $1',
      [schoolId]
    );
    const config = configRow.rows[0] || {
      per_student_paise: 0, setup_fee_paise: 0, ai_credits_included_paise: 200000,
      gst_enabled: false, gst_percentage: 18, school_gstin: null, platform_gstin: null,
    };

    const studentCount = school.rows[0].active_students;
    const lineItems: any[] = [];
    let subtotal = 0;

    // Per-student charge
    if (config.per_student_paise > 0) {
      const amount = config.per_student_paise * studentCount;
      lineItems.push({
        description: `Per-student charge (${studentCount} students × ₹${(config.per_student_paise / 100).toFixed(2)})`,
        quantity: studentCount,
        unit_price_paise: config.per_student_paise,
        amount_paise: amount,
      });
      subtotal += amount;
    }

    // Setup fee (one-time)
    if (include_setup_fee && config.setup_fee_paise > 0) {
      lineItems.push({
        description: 'One-time setup fee',
        quantity: 1,
        unit_price_paise: config.setup_fee_paise,
        amount_paise: config.setup_fee_paise,
      });
      subtotal += config.setup_fee_paise;
    }

    // AI credits
    if (include_ai_credits && config.ai_credits_included_paise > 0) {
      lineItems.push({
        description: `Oakie AI credits (₹${(config.ai_credits_included_paise / 100).toFixed(2)})`,
        quantity: 1,
        unit_price_paise: config.ai_credits_included_paise,
        amount_paise: config.ai_credits_included_paise,
      });
      subtotal += config.ai_credits_included_paise;
    }

    // GST
    const gstPaise = config.gst_enabled
      ? Math.round(subtotal * (config.gst_percentage / 100))
      : 0;
    const total = subtotal + gstPaise;

    // Generate invoice number: INV-YYYYMM-XXXX
    const invoiceSeq = await pool.query(
      `SELECT COUNT(*)::int + 1 as seq FROM platform_invoices WHERE school_id = $1`,
      [schoolId]
    );
    const seq = String(invoiceSeq.rows[0].seq).padStart(4, '0');
    const month = new Date(period_from).toISOString().slice(0, 7).replace('-', '');
    const invoiceNumber = `INV-${month}-${seq}`;

    const result = await pool.query(
      `INSERT INTO platform_invoices
         (school_id, invoice_number, period_from, period_to, line_items,
          subtotal_paise, gst_paise, total_paise,
          gst_enabled, gst_percentage, school_gstin, platform_gstin,
          student_count, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft')
       RETURNING *`,
      [schoolId, invoiceNumber, period_from, period_to, JSON.stringify(lineItems),
       subtotal, gstPaise, total,
       config.gst_enabled, config.gst_percentage, config.school_gstin, config.platform_gstin,
       studentCount, notes || null]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[platform-billing invoice POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Update invoice status ─────────────────────────────────────────────────────
router.patch('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;
    const valid = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
    if (status && !valid.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
    }
    const result = await pool.query(
      `UPDATE platform_invoices
       SET status    = COALESCE($1, status),
           notes     = COALESCE($2, notes),
           paid_at   = CASE WHEN $1 = 'paid' THEN now() ELSE paid_at END,
           updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [status ?? null, notes ?? null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

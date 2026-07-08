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
      // Revenue per billing cycle (monthly=1x, quarterly=3x, annual=12x)
      cycle_multiplier: r.billing_cycle === 'annual' ? 12 : r.billing_cycle === 'quarterly' ? 3 : 1,
      monthly_revenue_inr: ((r.per_student_paise * r.active_students) / 100).toFixed(2),
      cycle_revenue_inr: ((r.per_student_paise * r.active_students * (r.billing_cycle === 'annual' ? 12 : r.billing_cycle === 'quarterly' ? 3 : 1)) / 100).toFixed(2),
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
    // Convert paise → rupees for display
    return res.json(result.rows.map((r: any) => ({
      ...r,
      subtotal: r.subtotal_paise / 100,
      discount: 0, // legacy invoices have no discount
      discount_type: null,
      discount_description: null,
      gst_amount: r.gst_paise / 100,
      total: r.total_paise / 100,
      // line_items stored as rupees in new invoices, paise in old — detect by checking amounts
      line_items: (r.line_items || []).map((li: any) => ({
        ...li,
        // If amount_paise exists (old format), convert; if amount exists (new format), use directly
        amount: li.amount !== undefined ? li.amount : (li.amount_paise || 0) / 100,
        unit_price: li.unit_price !== undefined ? li.unit_price : (li.unit_price_paise || 0) / 100,
      })),
    })));
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Generate invoice for a school ─────────────────────────────────────────────
router.post('/:schoolId/invoices', async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const {
      period_from, period_to, notes,
      include_setup_fee, include_ai_credits,
      discount_type, discount_value, discount_description,
    } = req.body;

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
      billing_cycle: 'monthly',
    };

    // Convert paise config to rupees for invoice
    const perStudentRs = config.per_student_paise / 100;
    const setupFeeRs = config.setup_fee_paise / 100;
    const aiCreditsRs = config.ai_credits_included_paise / 100;

    const studentCount = school.rows[0].active_students;
    const cycleMultiplier = config.billing_cycle === 'annual' ? 12
      : config.billing_cycle === 'quarterly' ? 3 : 1;
    const cycleLabel = config.billing_cycle === 'annual' ? 'Annual'
      : config.billing_cycle === 'quarterly' ? 'Quarterly' : 'Monthly';

    // Build line items (all amounts in rupees)
    const lineItems: any[] = [];
    let subtotal = 0;

    if (perStudentRs > 0) {
      const unitPrice = perStudentRs * cycleMultiplier;
      const amount = unitPrice * studentCount;
      lineItems.push({
        description: `${cycleLabel} per-student charge (${studentCount} students × ₹${perStudentRs.toFixed(2)}/month × ${cycleMultiplier} months)`,
        quantity: studentCount,
        unit_price: unitPrice,
        amount,
      });
      subtotal += amount;
    }

    if (include_setup_fee && setupFeeRs > 0) {
      lineItems.push({
        description: 'One-time setup fee',
        quantity: 1,
        unit_price: setupFeeRs,
        amount: setupFeeRs,
      });
      subtotal += setupFeeRs;
    }

    if (include_ai_credits && aiCreditsRs > 0) {
      lineItems.push({
        description: `Oakie AI credits (₹${aiCreditsRs.toFixed(2)})`,
        quantity: 1,
        unit_price: aiCreditsRs,
        amount: aiCreditsRs,
      });
      subtotal += aiCreditsRs;
    }

    // Calculate discount (in rupees)
    let discountRs = 0;
    if (discount_type && discount_type !== 'none' && discount_value > 0) {
      if (discount_type === 'percentage') {
        discountRs = Math.round((subtotal * discount_value / 100) * 100) / 100;
      } else if (discount_type === 'flat') {
        discountRs = Math.min(Number(discount_value), subtotal);
      } else if (discount_type === 'months') {
        // Free months = N months of per-student charge
        discountRs = Math.round(perStudentRs * studentCount * Number(discount_value) * 100) / 100;
        discountRs = Math.min(discountRs, subtotal);
      }
    }

    const afterDiscount = subtotal - discountRs;
    const gstAmount = config.gst_enabled
      ? Math.round(afterDiscount * (config.gst_percentage / 100) * 100) / 100
      : 0;
    const total = Math.round((afterDiscount + gstAmount) * 100) / 100;

    // Invoice number: INV-YYYYMM-XXXX
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
      [
        schoolId, invoiceNumber, period_from, period_to,
        JSON.stringify(lineItems),
        // Store as rupees * 100 = paise for DB compatibility, but we return rupees to frontend
        Math.round(subtotal * 100),
        Math.round(gstAmount * 100),
        Math.round(total * 100),
        config.gst_enabled, config.gst_percentage,
        config.school_gstin, config.platform_gstin,
        studentCount, notes || null,
      ]
    );

    const row = result.rows[0];
    // Return amounts in rupees for frontend display
    return res.status(201).json({
      ...row,
      line_items: lineItems, // already in rupees
      subtotal,
      discount: discountRs,
      discount_type: discount_type || null,
      discount_description: discount_description || null,
      gst_amount: gstAmount,
      total,
    });
  } catch (err) {
    console.error('[platform-billing invoice POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Delete invoice ────────────────────────────────────────────────────────────
router.delete('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `DELETE FROM platform_invoices WHERE id = $1 AND status IN ('draft','cancelled')
       RETURNING id, invoice_number`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(400).json({ error: 'Only draft or cancelled invoices can be deleted' });
    }
    return res.json({ success: true, deleted: result.rows[0].invoice_number });
  } catch (err) {
    console.error('[platform-billing DELETE invoice]', err);
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

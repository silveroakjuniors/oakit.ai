/**
 * Staff HR routes — leave requests & offer letters
 * Accessible by any authenticated staff (teacher, principal, admin).
 * Principal/admin can also manage (approve/reject leave, create offer letters).
 */
import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';
import { generateOfferLetterPDF } from '../../lib/pdfService';
import type { BrandingContext, GeneratorContext, OfferLetterData } from '../../lib/pdfService';
import { createClient } from '@supabase/supabase-js';

const router = Router();
router.use(jwtVerify, schoolScope);

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'oakit-uploads';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || key === 'your_service_role_key_here') return null;
  return createClient(url, key);
}

// ── GET /api/v1/staff/hr/my-payslips ─────────────────────────────────────────
router.get('/my-payslips', async (req: Request, res: Response) => {
  try {
    const { id: userId } = req.user!;
    const result = await pool.query(
      `SELECT id, year, month, gross_salary, net_salary, present_days, absent_days,
              leave_days, deduction_amount, status, payment_date, payslip_url, payslip_status
       FROM salary_records
       WHERE user_id = $1 AND deleted_at IS NULL AND payslip_status = 'released'
       ORDER BY year DESC, month DESC`,
      [userId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[hr] GET /my-payslips', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/v1/staff/hr/my-offer-letters ────────────────────────────────────
router.get('/my-offer-letters', async (req: Request, res: Response) => {
  try {
    const { id: userId } = req.user!;
    const result = await pool.query(
      `SELECT id, role, start_date, gross_salary, components, employment_terms,
              pdf_url, status, signed_at, created_at
       FROM staff_offer_letters
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[hr] GET /my-offer-letters', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/v1/staff/hr/offer-letters/:id/sign ─────────────────────────────
router.post('/offer-letters/:id/sign', async (req: Request, res: Response) => {
  try {
    const { id: userId } = req.user!;
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE staff_offer_letters
       SET status = 'signed', signed_at = now(), updated_at = now()
       WHERE id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING *`,
      [id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Offer letter not found or already actioned' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[hr] POST /offer-letters/:id/sign', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/v1/staff/hr/offer-letters/:id/decline ──────────────────────────
router.post('/offer-letters/:id/decline', async (req: Request, res: Response) => {
  try {
    const { id: userId } = req.user!;
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE staff_offer_letters
       SET status = 'declined', updated_at = now()
       WHERE id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING *`,
      [id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Offer letter not found or already actioned' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[hr] POST /offer-letters/:id/decline', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/v1/staff/hr/my-leaves ───────────────────────────────────────────
router.get('/my-leaves', async (req: Request, res: Response) => {
  try {
    const { id: userId } = req.user!;
    const result = await pool.query(
      `SELECT id, leave_type, from_date, to_date, days, reason, status,
              review_note, reviewed_at, created_at
       FROM staff_leave_requests
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[hr] GET /my-leaves', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/v1/staff/hr/my-leaves ──────────────────────────────────────────
router.post('/my-leaves', async (req: Request, res: Response) => {
  try {
    const { id: userId, school_id } = req.user!;
    const { leave_type, from_date, to_date, reason } = req.body;
    if (!leave_type || !from_date || !to_date) return res.status(400).json({ error: 'leave_type, from_date, to_date required' });
    if (from_date > to_date) return res.status(400).json({ error: 'from_date must be before to_date' });
    const result = await pool.query(
      `INSERT INTO staff_leave_requests (school_id, user_id, leave_type, from_date, to_date, reason)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [school_id, userId, leave_type, from_date, to_date, reason || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[hr] POST /my-leaves', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Principal/Admin: GET all offer letters ────────────────────────────────────
router.get('/offer-letters', roleGuard('principal', 'admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT ol.*, u.name as staff_name, u.email as staff_email,
              cb.name as created_by_name
       FROM staff_offer_letters ol
       JOIN users u ON u.id = ol.user_id
       LEFT JOIN users cb ON cb.id = ol.created_by
       WHERE ol.school_id = $1
       ORDER BY ol.created_at DESC`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[hr] GET /offer-letters', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Principal/Admin: GET all leave requests ───────────────────────────────────
router.get('/leaves', roleGuard('principal', 'admin'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT lr.*, u.name as staff_name, u.email as staff_email
       FROM staff_leave_requests lr
       JOIN users u ON u.id = lr.user_id
       WHERE lr.school_id = $1
       ORDER BY lr.created_at DESC`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[hr] GET /leaves', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Principal/Admin: PATCH leave status ──────────────────────────────────────
router.patch('/leaves/:id', roleGuard('principal', 'admin'), async (req: Request, res: Response) => {
  try {
    const { school_id, id: reviewerId } = req.user!;
    const { id } = req.params;
    const { status, review_note } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'status must be approved or rejected' });
    const result = await pool.query(
      `UPDATE staff_leave_requests
       SET status = $1, review_note = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now()
       WHERE id = $4 AND school_id = $5 AND status = 'pending'
       RETURNING *`,
      [status, review_note || null, reviewerId, id, school_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Leave request not found or already reviewed' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[hr] PATCH /leaves/:id', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Principal/Admin: POST create offer letter ─────────────────────────────────
router.post('/offer-letters', roleGuard('principal', 'admin'), async (req: Request, res: Response) => {
  try {
    const { school_id, id: createdBy } = req.user!;
    const { user_id, role, start_date, gross_salary, components, employment_terms } = req.body;
    if (!user_id || !role || !start_date || !gross_salary) {
      return res.status(400).json({ error: 'user_id, role, start_date, gross_salary required' });
    }

    // Generate PDF
    let pdfUrl: string | null = null;
    try {
      const staffRow = await pool.query('SELECT name FROM users WHERE id = $1', [user_id]);
      const schoolRow = await pool.query('SELECT name FROM schools WHERE id = $1', [school_id]);
      const staffName = staffRow.rows[0]?.name || 'Staff Member';
      const schoolName = schoolRow.rows[0]?.name || 'School';

      const offerData: OfferLetterData = {
        school_name: schoolName,
        staff_name: staffName,
        role,
        start_date: new Date(start_date),
        salary_breakdown: (components || []).map((c: any) => ({ component: c.name, amount: c.amount })),
        employment_terms: employment_terms || 'Standard employment terms apply.',
      };
      const branding: BrandingContext = { school_name: schoolName, school_address: '', logo_url: null };
      const ctx: GeneratorContext = { generated_by_name: schoolName, generated_by_role: 'Admin', generated_at: new Date() };
      const pdfBuffer = await generateOfferLetterPDF(offerData, branding, ctx);

      const supabase = getSupabase();
      if (supabase) {
        const path = `offer-letters/${school_id}/${user_id}-${Date.now()}.pdf`;
        await supabase.storage.from(BUCKET).upload(path, pdfBuffer, { contentType: 'application/pdf', upsert: true });
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        pdfUrl = data.publicUrl;
      }
    } catch (pdfErr) {
      console.error('[hr] PDF generation failed', pdfErr);
    }

    const result = await pool.query(
      `INSERT INTO staff_offer_letters
         (school_id, user_id, role, start_date, gross_salary, components, employment_terms, pdf_url, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [school_id, user_id, role, start_date, gross_salary,
       JSON.stringify(components || []), employment_terms || null, pdfUrl, createdBy]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[hr] POST /offer-letters', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

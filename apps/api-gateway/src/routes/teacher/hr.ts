/**
 * Teacher HR routes — staff can view their own payslips, offer letters, and manage leave.
 * GET  /api/v1/teacher/hr/payslips          — own released payslips
 * GET  /api/v1/teacher/hr/offer-letters     — own offer letters
 * POST /api/v1/teacher/hr/offer-letters/:id/sign    — sign an offer letter
 * POST /api/v1/teacher/hr/offer-letters/:id/decline — decline an offer letter
 * GET  /api/v1/teacher/hr/leave             — own leave requests
 * POST /api/v1/teacher/hr/leave             — apply for leave
 * DELETE /api/v1/teacher/hr/leave/:id       — cancel a pending request
 * POST /api/v1/teacher/hr/resignations      — submit resignation
 * GET  /api/v1/teacher/hr/resignations      — own resignation records
 */
import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope } from '../../middleware/auth';
import { generateOfferLetterPDFWithBranding, BrandingContext } from '../../lib/pdfService';
import { calcNoticePeriodDays } from '../../lib/noticePeriod';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(jwtVerify, schoolScope);

const BUCKET = 'oakit-uploads';

/** Upload a PDF buffer to Supabase storage; returns public URL or null on failure. */
async function uploadPdfBuffer(buffer: Buffer, storagePath: string): Promise<string | null> {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key || key === 'your_service_role_key_here') return null;
    const supabase = createClient(url, key);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });
    if (error) {
      console.error('[teacher/hr uploadPdfBuffer] upload error', error.message);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (err) {
    console.error('[teacher/hr uploadPdfBuffer]', err);
    return null;
  }
}

// ── GET /payslips ─────────────────────────────────────────────────────────────
router.get('/payslips', async (req: Request, res: Response) => {
  try {
    const { id: userId, school_id } = req.user!;
    const result = await pool.query(
      `SELECT id, year, month, gross_salary, present_days, absent_days, leave_days,
              working_days, per_day_rate, deduction_amount, net_salary,
              status, payment_mode, payment_date::text, payslip_url, payslip_status
       FROM salary_records
       WHERE school_id = $1 AND user_id = $2
         AND payslip_status = 'released' AND deleted_at IS NULL
       ORDER BY year DESC, month DESC`,
      [school_id, userId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[teacher/hr GET /payslips]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /offer-letters ────────────────────────────────────────────────────────
router.get('/offer-letters', async (req: Request, res: Response) => {
  try {
    const { id: userId, school_id } = req.user!;
    const result = await pool.query(
      `SELECT id, role, start_date::text, gross_salary, components,
              employment_terms, pdf_url, status, signed_at, created_at
       FROM staff_offer_letters
       WHERE school_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [school_id, userId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[teacher/hr GET /offer-letters]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /offer-letters/:id/sign ──────────────────────────────────────────────
router.post('/offer-letters/:id/sign', async (req: Request, res: Response) => {
  try {
    const { id: userId, school_id } = req.user!;
    const { id } = req.params;
    const { signature_type, signature_value } = req.body;

    // Validate signature
    if (!signature_type || !['typed', 'drawn'].includes(signature_type) || !signature_value || !signature_value.trim()) {
      return res.status(400).json({ error: 'Invalid or empty signature', code: 'EMPTY_SIGNATURE' });
    }
    if (signature_type === 'drawn' && !signature_value.startsWith('data:image/png;base64,')) {
      return res.status(400).json({ error: 'Invalid or empty signature', code: 'EMPTY_SIGNATURE' });
    }

    // Fetch offer letter
    const letterRow = await pool.query(
      `SELECT * FROM staff_offer_letters WHERE id = $1 AND user_id = $2 AND school_id = $3`,
      [id, userId, school_id]
    );
    if (letterRow.rows.length === 0)
      return res.status(404).json({ error: 'Offer letter not found', code: 'OFFER_LETTER_NOT_FOUND' });
    if (letterRow.rows[0].status !== 'pending')
      return res.status(409).json({ error: 'Offer letter already actioned', code: 'ALREADY_ACTIONED' });

    // Update with signature
    const updated = await pool.query(
      `UPDATE staff_offer_letters
       SET status = 'signed', signed_at = now(), signature_type = $1, signature_value = $2, updated_at = now()
       WHERE id = $3 AND school_id = $4 AND user_id = $5
       RETURNING *`,
      [signature_type, signature_value, id, school_id, userId]
    );
    const letter = updated.rows[0];

    // Regenerate PDF with signature block
    try {
      const schoolRow = await pool.query(
        `SELECT name, logo_path, contact->>'address' as address FROM schools WHERE id = $1`,
        [school_id]
      );
      const school = schoolRow.rows[0] || {};
      const branding: BrandingContext = {
        school_name: school.name || '',
        school_address: school.address || '',
        logo_url: school.logo_path || null,
      };
      const staffRow = await pool.query(`SELECT name FROM users WHERE id = $1`, [userId]);
      const staff_name = staffRow.rows[0]?.name || 'Staff Member';

      const data = {
        staff_name,
        role: letter.role || '',
        start_date: new Date(letter.start_date),
        salary_breakdown: (letter.components || []).map((c: any) => ({
          component: c.component || c.name || '',
          amount: Number(c.amount) || 0,
        })),
        employment_terms: letter.employment_terms || '',
        school_name: branding.school_name,
        signature: {
          type: signature_type as 'typed' | 'drawn',
          value: signature_value,
          signed_at: new Date(),
          signer_name: staff_name,
        },
      };

      const pdfBuffer = await generateOfferLetterPDFWithBranding(data, branding);
      const storagePath = `offer-letters/signed/${school_id}/${uuidv4()}.pdf`;
      const signed_pdf_url = await uploadPdfBuffer(pdfBuffer, storagePath);

      if (signed_pdf_url) {
        await pool.query(
          `UPDATE staff_offer_letters SET signed_pdf_url = $1 WHERE id = $2`,
          [signed_pdf_url, id]
        );
        letter.signed_pdf_url = signed_pdf_url;
      }
    } catch (pdfErr) {
      console.error('[teacher/hr POST /offer-letters/:id/sign] PDF regeneration failed', pdfErr);
    }

    // Insert employment record
    await pool.query(
      `INSERT INTO employment_records (event_type, offer_letter_id, user_id, school_id, event_date)
       VALUES ('offer_signed', $1, $2, $3, CURRENT_DATE)`,
      [id, userId, school_id]
    ).catch(e => console.error('[teacher/hr POST /offer-letters/:id/sign] employment_records insert', e));

    return res.json(letter);
  } catch (err) {
    console.error('[teacher/hr POST /offer-letters/:id/sign]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /offer-letters/:id/decline ──────────────────────────────────────────
router.post('/offer-letters/:id/decline', async (req: Request, res: Response) => {
  try {
    const { id: userId, school_id } = req.user!;
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE staff_offer_letters
       SET status = 'declined', updated_at = now()
       WHERE id = $1 AND school_id = $2 AND user_id = $3 AND status = 'pending'
       RETURNING *`,
      [id, school_id, userId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Offer letter not found or already actioned' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[teacher/hr POST /offer-letters/:id/decline]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /leave ────────────────────────────────────────────────────────────────
router.get('/leave', async (req: Request, res: Response) => {
  try {
    const { id: userId, school_id } = req.user!;
    const result = await pool.query(
      `SELECT id, leave_type, from_date::text, to_date::text, days, reason,
              status, review_note, reviewed_at, created_at
       FROM staff_leave_requests
       WHERE school_id = $1 AND user_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [school_id, userId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[teacher/hr GET /leave]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /leave ───────────────────────────────────────────────────────────────
router.post('/leave', async (req: Request, res: Response) => {
  try {
    const { id: userId, school_id } = req.user!;
    const { leave_type, from_date, to_date, reason } = req.body;
    if (!leave_type || !from_date || !to_date)
      return res.status(400).json({ error: 'leave_type, from_date, to_date are required' });
    if (from_date > to_date)
      return res.status(400).json({ error: 'from_date must be before to_date' });
    const result = await pool.query(
      `INSERT INTO staff_leave_requests (school_id, user_id, leave_type, from_date, to_date, reason)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [school_id, userId, leave_type, from_date, to_date, reason || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[teacher/hr POST /leave]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /leave/:id ─────────────────────────────────────────────────────────
router.delete('/leave/:id', async (req: Request, res: Response) => {
  try {
    const { id: userId, school_id } = req.user!;
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM staff_leave_requests
       WHERE id = $1 AND school_id = $2 AND user_id = $3 AND status = 'pending'
       RETURNING id`,
      [id, school_id, userId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Request not found or already reviewed' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[teacher/hr DELETE /leave/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /resignations ────────────────────────────────────────────────────────
router.post('/resignations', async (req: Request, res: Response) => {
  try {
    const { id: userId, school_id } = req.user!;
    const { last_working_day, reason } = req.body;
    if (!last_working_day)
      return res.status(400).json({ error: 'last_working_day is required' });

    // Check for existing pending resignation
    const existing = await pool.query(
      `SELECT id FROM employment_records
       WHERE user_id = $1 AND event_type = 'resignation' AND resignation_status = 'pending'`,
      [userId]
    );
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'You already have an active resignation', code: 'RESIGNATION_EXISTS' });

    // Fetch default notice period
    const settingsRow = await pool.query(
      `SELECT default_notice_period FROM hr_settings WHERE school_id = $1`,
      [school_id]
    );
    const default_notice_period = settingsRow.rows[0]?.default_notice_period ?? 30;

    const notice_period_days = calcNoticePeriodDays(new Date(), new Date(last_working_day));

    const result = await pool.query(
      `INSERT INTO employment_records
         (event_type, user_id, school_id, last_working_day, notice_period_days, default_notice_period,
          resignation_reason, resignation_status, event_date)
       VALUES ('resignation', $1, $2, $3, $4, $5, $6, 'pending', CURRENT_DATE)
       RETURNING *`,
      [userId, school_id, last_working_day, notice_period_days, default_notice_period, reason || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[teacher/hr POST /resignations]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /resignations ─────────────────────────────────────────────────────────
router.get('/resignations', async (req: Request, res: Response) => {
  try {
    const { id: userId, school_id } = req.user!;
    const result = await pool.query(
      `SELECT * FROM employment_records
       WHERE user_id = $1 AND school_id = $2 AND event_type = 'resignation'
       ORDER BY created_at DESC`,
      [userId, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[teacher/hr GET /resignations]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

/**
 * Principal HR routes — manage offer letters and review leave requests.
 * GET  /api/v1/principal/hr/staff                  — list active staff (non-parent)
 * GET  /api/v1/principal/hr/templates              — list offer letter templates
 * POST /api/v1/principal/hr/templates              — create template
 * PUT  /api/v1/principal/hr/templates/:id          — update template
 * DELETE /api/v1/principal/hr/templates/:id        — delete template
 * GET  /api/v1/principal/hr/offer-letters          — all offer letters for school
 * POST /api/v1/principal/hr/offer-letters/preview  — preview offer letter PDF
 * POST /api/v1/principal/hr/offer-letters          — create offer letter for a staff member
 * GET  /api/v1/principal/hr/offer-letters/signed   — signed copies archive
 * GET  /api/v1/principal/hr/leave                  — all leave requests
 * PATCH /api/v1/principal/hr/leave/:id             — approve or reject
 * GET  /api/v1/principal/hr/resignations           — list all resignations
 * PATCH /api/v1/principal/hr/resignations/:id/acknowledge — acknowledge resignation
 * POST /api/v1/principal/hr/staff/:id/terminate    — terminate staff member
 * GET  /api/v1/principal/hr/staff/:id/employment-history — employment history
 * GET  /api/v1/principal/hr/settings               — HR settings
 * PUT  /api/v1/principal/hr/settings               — update HR settings
 */
import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';
import { validateTerms, findMissingVariables } from '../../lib/templateSubstitution';
import { generateOfferLetterPDFWithBranding, BrandingContext } from '../../lib/pdfService';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('principal', 'admin'));

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
      console.error('[uploadPdfBuffer] upload error', error.message);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (err) {
    console.error('[uploadPdfBuffer]', err);
    return null;
  }
}

/** Fetch school branding for PDF generation. */
async function fetchSchoolBranding(schoolId: string): Promise<BrandingContext> {
  const row = await pool.query(
    `SELECT name, logo_path, contact->>'address' as address FROM schools WHERE id = $1`,
    [schoolId]
  );
  const school = row.rows[0] || {};
  return {
    school_name: school.name || '',
    school_address: school.address || '',
    logo_url: school.logo_path || null,
  };
}

// ── GET /staff ────────────────────────────────────────────────────────────────
router.get('/staff', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.mobile, r.name as role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.school_id = $1 AND u.is_active = true AND r.name != 'parent'
       ORDER BY u.name ASC`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[principal/hr GET /staff]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /templates ────────────────────────────────────────────────────────────
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT id, name, body, created_by, created_at, updated_at
       FROM offer_letter_templates
       WHERE school_id = $1
       ORDER BY created_at DESC`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[principal/hr GET /templates]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /templates ───────────────────────────────────────────────────────────
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const { school_id, id: createdBy } = req.user!;
    const { name, body } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    if (!body || !body.trim()) return res.status(400).json({ error: 'body is required' });
    const result = await pool.query(
      `INSERT INTO offer_letter_templates (school_id, name, body, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [school_id, name.trim(), body.trim(), createdBy]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[principal/hr POST /templates]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /templates/:id ────────────────────────────────────────────────────────
router.put('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { id } = req.params;
    const { name, body } = req.body;
    const result = await pool.query(
      `UPDATE offer_letter_templates
       SET name = COALESCE($1, name), body = COALESCE($2, body), updated_at = now()
       WHERE id = $3 AND school_id = $4
       RETURNING *`,
      [name || null, body || null, id, school_id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Template not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[principal/hr PUT /templates/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /templates/:id ─────────────────────────────────────────────────────
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM offer_letter_templates WHERE id = $1 AND school_id = $2 RETURNING id`,
      [id, school_id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Template not found' });
    return res.status(204).send();
  } catch (err) {
    console.error('[principal/hr DELETE /templates/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /offer-letters ────────────────────────────────────────────────────────
router.get('/offer-letters', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT ol.*, u.name as staff_name, u.email as staff_email
       FROM staff_offer_letters ol
       JOIN users u ON u.id = ol.user_id
       WHERE ol.school_id = $1
       ORDER BY ol.created_at DESC`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[principal/hr GET /offer-letters]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /offer-letters/preview ───────────────────────────────────────────────
router.post('/offer-letters/preview', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { user_id, role, start_date, gross_salary, components, employment_terms } = req.body;

    const branding = await fetchSchoolBranding(school_id);

    const staffRow = await pool.query(
      `SELECT name FROM users WHERE id = $1 AND school_id = $2`,
      [user_id, school_id]
    );
    const staff_name = staffRow.rows[0]?.name || 'Staff Member';

    const data = {
      staff_name,
      role: role || '',
      start_date: new Date(start_date),
      salary_breakdown: (components || []).map((c: any) => ({
        component: c.component || c.name || '',
        amount: Number(c.amount) || 0,
      })),
      employment_terms: employment_terms || '',
      school_name: branding.school_name,
    };

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generateOfferLetterPDFWithBranding(data, branding);
    } catch (pdfErr) {
      console.error('[principal/hr POST /offer-letters/preview] PDF generation failed', pdfErr);
      return res.status(500).json({ error: 'PDF generation failed', code: 'PDF_GENERATION_FAILED' });
    }

    const storagePath = `offer-letters/previews/${school_id}/${uuidv4()}.pdf`;
    const preview_pdf_url = await uploadPdfBuffer(pdfBuffer, storagePath);

    return res.json({ preview_pdf_url });
  } catch (err) {
    console.error('[principal/hr POST /offer-letters/preview]', err);
    return res.status(500).json({ error: 'PDF generation failed', code: 'PDF_GENERATION_FAILED' });
  }
});

// ── POST /offer-letters ───────────────────────────────────────────────────────
router.post('/offer-letters', async (req: Request, res: Response) => {
  try {
    const { school_id, id: createdBy } = req.user!;
    const { user_id, role, start_date, gross_salary, components, employment_terms, template_id } = req.body;
    if (!user_id || !role || !start_date || !gross_salary)
      return res.status(400).json({ error: 'user_id, role, start_date, gross_salary are required' });

    // Validate employment_terms
    if (!validateTerms(employment_terms || ''))
      return res.status(400).json({ error: 'Employment terms cannot be blank', code: 'EMPTY_TERMS' });

    // Verify staff belongs to this school
    const staffCheck = await pool.query(
      `SELECT id, name FROM users WHERE id = $1 AND school_id = $2`, [user_id, school_id]
    );
    if (staffCheck.rows.length === 0)
      return res.status(404).json({ error: 'Staff member not found' });

    // Verify template ownership if provided
    if (template_id) {
      const tplCheck = await pool.query(
        `SELECT id FROM offer_letter_templates WHERE id = $1 AND school_id = $2`,
        [template_id, school_id]
      );
      if (tplCheck.rows.length === 0)
        return res.status(404).json({ error: 'Template not found' });
    }

    // Check for missing template variables
    const missing = findMissingVariables(employment_terms, {});
    if (missing.length > 0)
      return res.status(400).json({ error: 'Missing template variables', code: 'MISSING_VARIABLES', missing });

    // Generate PDF
    const branding = await fetchSchoolBranding(school_id);
    const staff_name = staffCheck.rows[0].name;
    const data = {
      staff_name,
      role,
      start_date: new Date(start_date),
      salary_breakdown: (components || []).map((c: any) => ({
        component: c.component || c.name || '',
        amount: Number(c.amount) || 0,
      })),
      employment_terms,
      school_name: branding.school_name,
    };

    let pdf_url: string | null = null;
    let pdf_warning: string | undefined;
    try {
      const pdfBuffer = await generateOfferLetterPDFWithBranding(data, branding);
      const storagePath = `offer-letters/${school_id}/${uuidv4()}.pdf`;
      pdf_url = await uploadPdfBuffer(pdfBuffer, storagePath);
    } catch (pdfErr) {
      console.error('[principal/hr POST /offer-letters] PDF generation failed', pdfErr);
      pdf_warning = 'PDF generation failed; offer letter saved without PDF.';
    }

    const result = await pool.query(
      `INSERT INTO staff_offer_letters
         (school_id, user_id, role, start_date, gross_salary, components, employment_terms, created_by, template_id, pdf_url, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending') RETURNING *`,
      [school_id, user_id, role, start_date, gross_salary,
       JSON.stringify(components || []), employment_terms, createdBy,
       template_id || null, pdf_url]
    );
    const newLetter = result.rows[0];

    // Insert employment record
    await pool.query(
      `INSERT INTO employment_records (event_type, offer_letter_id, user_id, school_id, event_date)
       VALUES ('offer_sent', $1, $2, $3, CURRENT_DATE)`,
      [newLetter.id, user_id, school_id]
    ).catch(e => console.error('[principal/hr POST /offer-letters] employment_records insert', e));

    const response: any = { ...newLetter };
    if (pdf_warning) response.pdf_warning = pdf_warning;
    return res.status(201).json(response);
  } catch (err) {
    console.error('[principal/hr POST /offer-letters]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /offer-letters/signed ─────────────────────────────────────────────────
router.get('/offer-letters/signed', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { name, role } = req.query as Record<string, string>;

    let query = `
      SELECT ol.id, u.name as staff_name, ol.role, ol.signed_at, ol.signed_pdf_url
      FROM staff_offer_letters ol
      JOIN users u ON u.id = ol.user_id
      WHERE ol.school_id = $1 AND ol.status = 'signed'`;
    const params: any[] = [school_id];

    if (name) {
      params.push(`%${name}%`);
      query += ` AND u.name ILIKE $${params.length}`;
    }
    if (role) {
      params.push(`%${role}%`);
      query += ` AND ol.role ILIKE $${params.length}`;
    }

    query += ` ORDER BY ol.signed_at DESC`;

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[principal/hr GET /offer-letters/signed]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /leave ────────────────────────────────────────────────────────────────
router.get('/leave', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { status } = req.query as Record<string, string>;
    const result = await pool.query(
      `SELECT lr.*, u.name as staff_name, u.email as staff_email
       FROM staff_leave_requests lr
       JOIN users u ON u.id = lr.user_id
       WHERE lr.school_id = $1 ${status ? 'AND lr.status = $2' : ''}
       ORDER BY lr.created_at DESC LIMIT 100`,
      status ? [school_id, status] : [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[principal/hr GET /leave]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /leave/:id ──────────────────────────────────────────────────────────
router.patch('/leave/:id', async (req: Request, res: Response) => {
  try {
    const { school_id, id: reviewedBy } = req.user!;
    const { id } = req.params;
    const { status, review_note } = req.body;
    if (!['approved', 'rejected'].includes(status))
      return res.status(400).json({ error: 'status must be approved or rejected' });
    const result = await pool.query(
      `UPDATE staff_leave_requests
       SET status = $1, review_note = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now()
       WHERE id = $4 AND school_id = $5 AND status = 'pending'
       RETURNING *`,
      [status, review_note || null, reviewedBy, id, school_id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Request not found or already reviewed' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[principal/hr PATCH /leave/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /resignations ─────────────────────────────────────────────────────────
router.get('/resignations', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT er.*, u.name as staff_name, u.email as staff_email
       FROM employment_records er
       JOIN users u ON u.id = er.user_id
       WHERE er.school_id = $1 AND er.event_type = 'resignation'
       ORDER BY er.created_at DESC`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[principal/hr GET /resignations]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /resignations/:id/acknowledge ──────────────────────────────────────
router.patch('/resignations/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE employment_records
       SET resignation_status = 'acknowledged'
       WHERE id = $1 AND school_id = $2 AND event_type = 'resignation'
       RETURNING *`,
      [id, school_id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Resignation not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[principal/hr PATCH /resignations/:id/acknowledge]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /staff/:id/terminate ─────────────────────────────────────────────────
router.post('/staff/:id/terminate', async (req: Request, res: Response) => {
  try {
    const { school_id, id: terminatedBy } = req.user!;
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || !reason.trim())
      return res.status(400).json({ error: 'reason is required' });

    const staffCheck = await pool.query(
      `SELECT id, is_active FROM users WHERE id = $1 AND school_id = $2`,
      [id, school_id]
    );
    if (staffCheck.rows.length === 0)
      return res.status(404).json({ error: 'Staff member not found' });
    if (!staffCheck.rows[0].is_active)
      return res.status(409).json({ error: 'Staff member is already inactive', code: 'ALREADY_INACTIVE' });

    await pool.query(
      `INSERT INTO employment_records
         (event_type, termination_reason, terminated_by, event_date, user_id, school_id)
       VALUES ('termination', $1, $2, CURRENT_DATE, $3, $4)`,
      [reason.trim(), terminatedBy, id, school_id]
    );

    await pool.query(
      `UPDATE users SET is_active = false WHERE id = $1 AND school_id = $2`,
      [id, school_id]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[principal/hr POST /staff/:id/terminate]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /staff/:id/employment-history ─────────────────────────────────────────
router.get('/staff/:id/employment-history', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM employment_records
       WHERE user_id = $1 AND school_id = $2
       ORDER BY created_at ASC`,
      [id, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[principal/hr GET /staff/:id/employment-history]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /settings ─────────────────────────────────────────────────────────────
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT * FROM hr_settings WHERE school_id = $1`,
      [school_id]
    );
    if (result.rows.length === 0)
      return res.json({ default_notice_period: 30 });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[principal/hr GET /settings]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /settings ─────────────────────────────────────────────────────────────
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { default_notice_period } = req.body;
    const parsed = parseInt(default_notice_period, 10);
    if (!Number.isInteger(parsed) || parsed <= 0)
      return res.status(400).json({ error: 'default_notice_period must be a positive integer' });
    const result = await pool.query(
      `INSERT INTO hr_settings (school_id, default_notice_period)
       VALUES ($1, $2)
       ON CONFLICT (school_id) DO UPDATE SET default_notice_period = $2
       RETURNING *`,
      [school_id, parsed]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[principal/hr PUT /settings]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

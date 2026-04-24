import { Router } from 'express';
import { pool } from '../../lib/db';

const router = Router();

// ── POST /api/v1/public/enquiries ─────────────────────────────────────────────
// Public endpoint — no authentication required.
// Parents submit an enquiry for their child from the school's public enquiry page.
// The school is identified by the `school_code` (subdomain) in the request body.
router.post('/', async (req, res) => {
  try {
    const {
      school_code,
      student_name,
      child_age,
      parent_name,
      contact_number,
      class_of_interest,
    } = req.body as {
      school_code: string;
      student_name: string;
      child_age?: string | number;
      parent_name: string;
      contact_number: string;
      class_of_interest?: string;
    };

    // Validate required fields
    if (!school_code || !student_name || !parent_name || !contact_number) {
      return res.status(400).json({
        error: 'school_code, student_name, parent_name, and contact_number are required',
      });
    }

    // Basic contact number validation
    const cleaned = String(contact_number).replace(/\D/g, '');
    if (cleaned.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit contact number' });
    }

    // Look up school by subdomain
    const schoolResult = await pool.query(
      `SELECT id, name, status FROM schools WHERE subdomain = $1`,
      [school_code.toLowerCase().trim()]
    );

    if (schoolResult.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    const school = schoolResult.rows[0];

    if (school.status === 'inactive') {
      return res.status(403).json({ error: 'School is not currently accepting enquiries' });
    }

    // Insert enquiry
    const result = await pool.query(
      `INSERT INTO enquiries (
         school_id, student_name, parent_name, contact_number,
         class_of_interest, child_age, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'open')
       RETURNING id, student_name, parent_name, contact_number, class_of_interest, child_age, status, created_at`,
      [
        school.id,
        student_name.trim(),
        parent_name.trim(),
        cleaned,
        class_of_interest?.trim() ?? null,
        child_age ? String(child_age).trim() : null,
      ]
    );

    return res.status(201).json({
      success: true,
      enquiry_id: result.rows[0].id,
      school_name: school.name,
      message: 'Your enquiry has been submitted successfully. Our team will contact you shortly.',
    });
  } catch (err) {
    console.error('[public enquiries POST /]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/v1/public/school-info ────────────────────────────────────────────
// Returns basic school info for the enquiry form (name, logo, etc.)
router.get('/school-info', async (req, res) => {
  try {
    const { school_code } = req.query as { school_code?: string };

    if (!school_code) {
      return res.status(400).json({ error: 'school_code is required' });
    }

    const result = await pool.query(
      `SELECT name, logo_path, primary_color, tagline, contact
       FROM schools WHERE subdomain = $1 AND status != 'inactive'`,
      [school_code.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }

    const school = result.rows[0];

    return res.json({
      name: school.name,
      tagline: school.tagline ?? null,
      primary_color: school.primary_color ?? null,
      contact: school.contact ?? null,
    });
  } catch (err) {
    console.error('[public enquiries GET /school-info]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

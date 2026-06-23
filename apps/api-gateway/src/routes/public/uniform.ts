import { Router } from 'express';
import { pool } from '../../lib/db';

const router = Router();

// ── POST /api/v1/public/uniform ───────────────────────────────────────────────
// Public — no auth required.
// Parents submit child measurements; stored for school staff to review.
router.post('/', async (req, res) => {
  try {
    const {
      school_code,
      child_name,
      class_name,
      parent_name,
      contact_number,
      height_cm,
      weight_kg,
      chest_cm,
      shirt_length_cm,
      pant_length_cm,
    } = req.body as {
      school_code: string;
      child_name: string;
      class_name: string;
      parent_name: string;
      contact_number: string;
      height_cm?: number;
      weight_kg?: number;
      chest_cm?: number;
      shirt_length_cm?: number;
      pant_length_cm?: number;
    };

    if (!school_code || !child_name || !class_name || !parent_name || !contact_number) {
      return res.status(400).json({
        error: 'school_code, child_name, class_name, parent_name, and contact_number are required',
      });
    }

    const cleaned = String(contact_number).replace(/\D/g, '');
    if (cleaned.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit contact number' });
    }

    // Look up school
    const schoolRow = await pool.query(
      'SELECT id FROM schools WHERE school_code = $1 AND status != $2',
      [school_code.toLowerCase().trim(), 'inactive']
    );
    if (schoolRow.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    const school_id = schoolRow.rows[0].id;

    // ── Duplicate check: same child_name + contact_number ─────────────────────
    // Siblings are allowed (different child_name). Twins must use different names.
    const dupCheck = await pool.query(
      `SELECT id, child_name, class_name, parent_name, contact_number, status, created_at
       FROM uniform_sizing_requests
       WHERE school_code = $1
         AND LOWER(TRIM(child_name)) = LOWER(TRIM($2))
         AND contact_number = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [school_code.toLowerCase().trim(), child_name.trim(), cleaned]
    );

    if (dupCheck.rows.length > 0) {
      const existing = dupCheck.rows[0];
      return res.status(409).json({
        duplicate: true,
        message: `A sizing request for ${existing.child_name} with this contact number already exists.`,
        existing: {
          id: existing.id,
          child_name: existing.child_name,
          class_name: existing.class_name,
          parent_name: existing.parent_name,
          contact_number: existing.contact_number,
          status: existing.status,
          created_at: existing.created_at,
        },
      });
    }

    // Save to DB
    const result = await pool.query(
      `INSERT INTO uniform_sizing_requests
         (school_id, school_code, child_name, class_name, parent_name, contact_number,
          height_cm, weight_kg, chest_cm, shirt_length_cm, pant_length_cm)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        school_id, school_code.toLowerCase().trim(),
        child_name.trim(), class_name.trim(),
        parent_name.trim(), cleaned,
        height_cm || null, weight_kg || null,
        chest_cm || null, shirt_length_cm || null, pant_length_cm || null,
      ]
    );

    return res.status(201).json({
      id: result.rows[0].id,
      message: 'Uniform sizing request submitted successfully',
    });
  } catch (err) {
    console.error('[uniform sizing]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/v1/public/uniform/size-chart ─────────────────────────────────────
router.get('/size-chart', (_req, res) => {
  return res.json({ message: 'Size chart available at school office' });
});

export default router;

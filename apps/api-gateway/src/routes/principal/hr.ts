/**
 * Principal HR routes — manage offer letters and review leave requests.
 * GET  /api/v1/principal/hr/offer-letters          — all offer letters for school
 * POST /api/v1/principal/hr/offer-letters          — create offer letter for a staff member
 * GET  /api/v1/principal/hr/leave                  — all leave requests
 * PATCH /api/v1/principal/hr/leave/:id             — approve or reject
 */
import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('principal', 'admin'));

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

// ── POST /offer-letters ───────────────────────────────────────────────────────
router.post('/offer-letters', async (req: Request, res: Response) => {
  try {
    const { school_id, id: createdBy } = req.user!;
    const { user_id, role, start_date, gross_salary, components, employment_terms } = req.body;
    if (!user_id || !role || !start_date || !gross_salary)
      return res.status(400).json({ error: 'user_id, role, start_date, gross_salary are required' });

    // Verify staff belongs to this school
    const staffCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND school_id = $2`, [user_id, school_id]
    );
    if (staffCheck.rows.length === 0)
      return res.status(404).json({ error: 'Staff member not found' });

    const result = await pool.query(
      `INSERT INTO staff_offer_letters
         (school_id, user_id, role, start_date, gross_salary, components, employment_terms, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [school_id, user_id, role, start_date, gross_salary,
       JSON.stringify(components || []), employment_terms || '', createdBy]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[principal/hr POST /offer-letters]', err);
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

export default router;

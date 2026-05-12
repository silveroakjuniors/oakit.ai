/**
 * Teacher HR routes — staff can view their own payslips, offer letters, and manage leave.
 * GET  /api/v1/teacher/hr/payslips          — own released payslips
 * GET  /api/v1/teacher/hr/offer-letters     — own offer letters
 * POST /api/v1/teacher/hr/offer-letters/:id/sign   — sign an offer letter
 * GET  /api/v1/teacher/hr/leave             — own leave requests
 * POST /api/v1/teacher/hr/leave             — apply for leave
 * DELETE /api/v1/teacher/hr/leave/:id       — cancel a pending request
 */
import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, schoolScope);

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
    const result = await pool.query(
      `UPDATE staff_offer_letters
       SET status = 'signed', signed_at = now(), updated_at = now()
       WHERE id = $1 AND school_id = $2 AND user_id = $3 AND status = 'pending'
       RETURNING *`,
      [id, school_id, userId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Offer letter not found or already actioned' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[teacher/hr POST /offer-letters/:id/sign]', err);
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

export default router;

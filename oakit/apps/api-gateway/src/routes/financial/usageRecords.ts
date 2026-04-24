import { Router } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, permissionGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify);

// ── POST / — Teacher logs daycare hours or activity attendance ────────────────
router.post('/', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const role = req.user!.role;

    // Only teachers and admins may submit usage records
    if (!['teacher', 'admin', 'principal'].includes(role))
      return res.status(403).json({ error: 'Only teachers and admins can log usage records' });

    const { student_id, fee_head_id, service_type, date, quantity } = req.body;

    if (!student_id || !fee_head_id || !service_type || !date || quantity === undefined)
      return res.status(400).json({ error: 'student_id, fee_head_id, service_type, date, quantity are required' });

    if (!['daycare', 'activity'].includes(service_type))
      return res.status(400).json({ error: 'service_type must be daycare or activity' });

    if (parseFloat(quantity) <= 0)
      return res.status(400).json({ error: 'quantity must be > 0' });

    const d = new Date(date);
    const billing_period_year = d.getFullYear();
    const billing_period_month = d.getMonth() + 1;

    const result = await pool.query(
      `INSERT INTO usage_records (school_id, student_id, fee_head_id, service_type, date, quantity,
         submitted_by, billing_period_year, billing_period_month)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [schoolId, student_id, fee_head_id, service_type, date, quantity,
       req.user!.id, billing_period_year, billing_period_month]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[usageRecords POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /student/:studentId — View usage for a student ───────────────────────
router.get('/student/:studentId', permissionGuard('VIEW_FEES'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { studentId } = req.params;
    const { from, to, service_type } = req.query as Record<string, string>;

    let query = `SELECT ur.*, fh.name AS fee_head_name
                 FROM usage_records ur
                 LEFT JOIN fee_heads fh ON fh.id = ur.fee_head_id
                 WHERE ur.student_id = $1 AND ur.school_id = $2`;
    const params: any[] = [studentId, schoolId];
    let idx = 3;

    if (from)         { query += ` AND ur.date >= $${idx++}`;          params.push(from); }
    if (to)           { query += ` AND ur.date <= $${idx++}`;          params.push(to); }
    if (service_type) { query += ` AND ur.service_type = $${idx++}`;   params.push(service_type); }

    query += ` ORDER BY ur.date DESC`;

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[usageRecords GET /student/:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /billing-summary/:year/:month — Aggregate usage per student ───────────
router.get('/billing-summary/:year/:month', permissionGuard('VIEW_FEES'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { year, month } = req.params;

    const result = await pool.query(
      `SELECT ur.student_id, s.name AS student_name, ur.fee_head_id, fh.name AS fee_head_name,
              ur.service_type, SUM(ur.quantity) AS total_quantity,
              fh.rate, SUM(ur.quantity) * COALESCE(fh.rate, 0) AS total_charge
       FROM usage_records ur
       JOIN students s ON s.id = ur.student_id
       JOIN fee_heads fh ON fh.id = ur.fee_head_id
       WHERE ur.school_id = $1 AND ur.billing_period_year = $2 AND ur.billing_period_month = $3
       GROUP BY ur.student_id, s.name, ur.fee_head_id, fh.name, ur.service_type, fh.rate
       ORDER BY s.name`,
      [schoolId, parseInt(year), parseInt(month)]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[usageRecords GET /billing-summary]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

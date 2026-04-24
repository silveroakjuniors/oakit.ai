import { Router } from 'express';
import { pool } from '../../../lib/db';
import { jwtVerify, permissionGuard } from '../../../middleware/auth';
import { salaryPinGuard } from '../../../middleware/salaryPinGuard';

const router = Router();
router.use(jwtVerify, salaryPinGuard, permissionGuard('VIEW_SALARY'));

// ── POST /staff/:userId/config — Set staff salary config ─────────────────────
router.post('/staff/:userId/config', permissionGuard('EDIT_SALARY'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { userId } = req.params;
    const { gross_salary, components, effective_from } = req.body;

    if (!gross_salary || gross_salary <= 0)
      return res.status(400).json({ error: 'gross_salary must be > 0' });
    if (!effective_from)
      return res.status(400).json({ error: 'effective_from is required' });

    const result = await pool.query(
      `INSERT INTO staff_salary_config (school_id, user_id, gross_salary, components, effective_from)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (school_id, user_id, effective_from)
       DO UPDATE SET gross_salary = $3, components = $4, updated_at = now()
       RETURNING *`,
      [schoolId, userId, gross_salary, JSON.stringify(components || []), effective_from]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[salary/config POST /staff/:id/config]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /staff/:userId/config — Get staff salary config ──────────────────────
router.get('/staff/:userId/config', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT * FROM staff_salary_config
       WHERE school_id = $1 AND user_id = $2
       ORDER BY effective_from DESC LIMIT 1`,
      [schoolId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Salary config not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[salary/config GET /staff/:id/config]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /working-days — Set monthly working days ──────────────────────────────
router.put('/working-days', permissionGuard('EDIT_SALARY'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { year, month, working_days, calculation_method } = req.body;

    if (!year || !month || !working_days || !calculation_method)
      return res.status(400).json({ error: 'year, month, working_days, calculation_method are required' });

    const validMethods = ['weekday_count', 'calendar_days', 'custom_working_days'];
    if (!validMethods.includes(calculation_method))
      return res.status(400).json({ error: `calculation_method must be one of: ${validMethods.join(', ')}` });

    const result = await pool.query(
      `INSERT INTO monthly_working_days (school_id, year, month, working_days, calculation_method)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (school_id, year, month)
       DO UPDATE SET working_days = $4, calculation_method = $5
       RETURNING *`,
      [schoolId, year, month, working_days, calculation_method]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[salary/config PUT /working-days]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /working-days — Get working days config ───────────────────────────────
router.get('/working-days', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { year, month } = req.query as { year?: string; month?: string };

    let query = `SELECT * FROM monthly_working_days WHERE school_id = $1`;
    const params: any[] = [schoolId];
    let idx = 2;

    if (year)  { query += ` AND year = $${idx++}`;  params.push(parseInt(year)); }
    if (month) { query += ` AND month = $${idx++}`; params.push(parseInt(month)); }

    query += ` ORDER BY year DESC, month DESC`;

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[salary/config GET /working-days]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

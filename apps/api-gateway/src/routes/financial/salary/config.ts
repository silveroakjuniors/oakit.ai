import { Router } from 'express';
import { pool } from '../../../lib/db';
import { jwtVerify, permissionGuard } from '../../../middleware/auth';
import { salaryPinGuard } from '../../../middleware/salaryPinGuard';

const router = Router();
router.use(jwtVerify, salaryPinGuard, permissionGuard('VIEW_SALARY'));

// ── GET /staff — List all staff with their latest salary config ───────────────
router.get('/staff', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const result = await pool.query(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY u.name ASC) AS sl_no,
         u.id AS user_id,
         u.name AS staff_name,
         r.name AS role,
         ssc.gross_salary,
         ssc.components,
         ssc.effective_from,
         ssc.created_at AS config_created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN LATERAL (
         SELECT gross_salary, components, effective_from, created_at
         FROM staff_salary_config
         WHERE school_id = $1 AND user_id = u.id
         ORDER BY effective_from DESC
         LIMIT 1
       ) ssc ON true
       WHERE u.school_id = $1
         AND r.name NOT IN ('principal', 'super_admin', 'franchise_admin', 'parent', 'student')
         AND u.is_active = true
       ORDER BY u.name ASC`,
      [schoolId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[salary/config GET /staff]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

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

    // Verify user belongs to this school
    const userCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND school_id = $2 AND is_active = true`,
      [userId, schoolId]
    );
    if (userCheck.rows.length === 0)
      return res.status(404).json({ error: 'Staff member not found' });

    const result = await pool.query(
      `INSERT INTO staff_salary_config (school_id, user_id, gross_salary, components, effective_from)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (school_id, user_id, effective_from)
       DO UPDATE SET gross_salary = $3, components = $4, updated_at = now()
       RETURNING *`,
      [schoolId, userId, gross_salary, JSON.stringify(components || []), effective_from]
    );

    await pool.query(
      `INSERT INTO audit_logs (school_id, user_id, actor_role, action, module, affected_record_id, after_data)
       VALUES ($1,$2,$3,'SET_SALARY_CONFIG','salary',$4,$5)`,
      [schoolId, req.user!.id, req.user!.role, result.rows[0].id,
       JSON.stringify({ user_id: userId, gross_salary, effective_from })]
    ).catch(() => {});

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[salary/config POST /staff/:id/config]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /staff/:userId/config — Get staff salary config history ───────────────
router.get('/staff/:userId/config', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY effective_from DESC) AS sl_no,
         *
       FROM staff_salary_config
       WHERE school_id = $1 AND user_id = $2
       ORDER BY effective_from DESC`,
      [schoolId, userId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Salary config not found' });
    // Return latest config as primary, full history as array
    return res.json({ config: result.rows[0], history: result.rows });
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

    if (parseInt(month) < 1 || parseInt(month) > 12)
      return res.status(400).json({ error: 'month must be between 1 and 12' });

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

    const params: any[] = [schoolId];
    let idx = 2;
    let filters = '';

    if (year)  { filters += ` AND year = $${idx++}`;  params.push(parseInt(year)); }
    if (month) { filters += ` AND month = $${idx++}`; params.push(parseInt(month)); }

    const result = await pool.query(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY year DESC, month DESC) AS sl_no,
         *
       FROM monthly_working_days
       WHERE school_id = $1${filters}
       ORDER BY year DESC, month DESC`,
      params
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[salary/config GET /working-days]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

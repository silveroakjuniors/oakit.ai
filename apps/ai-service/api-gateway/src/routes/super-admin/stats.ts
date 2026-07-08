import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, roleGuard('super_admin'));

// GET / — platform-wide stats
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM schools)::int                                    AS total_schools,
        (SELECT COUNT(*) FROM schools WHERE status = 'active')::int           AS active_schools,
        (SELECT COUNT(*) FROM users WHERE role = 'teacher')::int              AS total_teachers,
        (SELECT COUNT(*) FROM students)::int                                  AS total_students,
        (SELECT COUNT(*) FROM daily_completions)::int                         AS total_day_plans
    `);
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

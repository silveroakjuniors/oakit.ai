import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('principal', 'admin'));

// GET /api/v1/principal/teachers/engagement
router.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const today = await getToday(school_id);

    // Get all teachers with their streak data
    const result = await pool.query(
      `SELECT
         u.id, u.name, u.mobile,
         COALESCE(ts.current_streak, 0) as current_streak,
         COALESCE(ts.best_streak, 0) as best_streak,
         ts.last_completed_date,
         r.name as role_name,
         -- 30-day completion rate
         (SELECT COUNT(DISTINCT dc.completion_date)::float
          FROM daily_completions dc
          JOIN sections sec ON sec.id = dc.section_id
          WHERE dc.teacher_id = u.id
            AND dc.completion_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date
         ) as completions_30d,
         -- Days since last completion
         CASE WHEN ts.last_completed_date IS NULL THEN 999
              ELSE ($2::date - ts.last_completed_date)
         END as days_since_last
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN teacher_streaks ts ON ts.teacher_id = u.id AND ts.school_id = u.school_id
       WHERE u.school_id = $1 AND r.name IN ('teacher','class teacher','supporting teacher')
       ORDER BY u.name`,
      [school_id, today]
    );

    // Count school days in last 30 days for rate calculation
    const schoolDaysRow = await pool.query(
      `SELECT COUNT(DISTINCT dp.plan_date)::int as school_days
       FROM day_plans dp
       JOIN sections sec ON sec.id = dp.section_id
       WHERE sec.school_id = $1
         AND dp.plan_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date`,
      [school_id, today]
    );
    const schoolDays = Math.max(schoolDaysRow.rows[0]?.school_days ?? 1, 1);

    const teachers = result.rows.map((t: any) => ({
      ...t,
      completion_rate_30d: Math.round((t.completions_30d / schoolDays) * 100),
      amber_warning: t.days_since_last >= 3 && t.days_since_last < 999,
    }));

    return res.json({ teachers, school_days_30d: schoolDays });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

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
         -- 30-day completion rate (count distinct days this teacher completed)
         (SELECT COUNT(DISTINCT dc.completion_date)::float
          FROM daily_completions dc
          WHERE dc.teacher_id = u.id
            AND dc.school_id = $1
            AND dc.completion_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date
         ) as completions_30d,
         -- Days since last completion
         CASE WHEN ts.last_completed_date IS NULL THEN 999
              ELSE ($2::date - ts.last_completed_date::date)::int
         END as days_since_last
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN teacher_streaks ts ON ts.teacher_id = u.id AND ts.school_id = u.school_id
       WHERE u.school_id = $1 AND r.name IN ('teacher','class teacher','supporting teacher') AND u.is_active = true
       ORDER BY u.name`,
      [school_id, today]
    );

    // Count school days in last 30 days for rate calculation
    // Use school calendar working_days to determine actual school days, not just plan dates
    let schoolDays = 1;
    try {
      const calRow = await pool.query(
        `SELECT working_days FROM school_calendar
         WHERE school_id = $1 AND start_date <= $2 AND end_date >= $2 LIMIT 1`,
        [school_id, today]
      );
      const workingDays: number[] = calRow.rows[0]?.working_days || [1, 2, 3, 4, 5];

      // Count working days in the last 30 days (excluding holidays)
      const holidayRow = await pool.query(
        `SELECT holidays FROM school_calendar
         WHERE school_id = $1 AND start_date <= $2 AND end_date >= $2 LIMIT 1`,
        [school_id, today]
      );
      const holidays: string[] = (holidayRow.rows[0]?.holidays || []).map((h: any) => typeof h === 'string' ? h.split('T')[0] : '');

      const todayDate = new Date(today + 'T12:00:00');
      let count = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - i);
        const dow = d.getDay();
        const dateStr = d.toISOString().split('T')[0];
        if (workingDays.includes(dow) && !holidays.includes(dateStr)) {
          count++;
        }
      }
      schoolDays = Math.max(count, 1);
    } catch {
      // Fallback: assume ~22 working days in 30 calendar days
      schoolDays = 22;
    }

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

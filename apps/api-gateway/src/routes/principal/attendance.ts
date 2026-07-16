import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('principal', 'admin'));

// GET /overview — attendance overview for all sections for a given date (defaults to today)
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const school_id = req.user!.school_id;
    const today = await getToday(school_id!);
    const date = (req.query.date as string) || today;

    const result = await pool.query(
      `SELECT
         s.id          AS section_id,
         s.label       AS section_label,
         c.name        AS class_name,
         u.name        AS class_teacher_name,
         COALESCE(s.flagged, false) AS flagged,
         s.flag_note,
         CASE WHEN COUNT(ar.id) > 0 THEN 'submitted' ELSE 'pending' END AS status,
         COUNT(ar.id) FILTER (WHERE ar.status = 'present')::int AS present_count,
         COUNT(ar.id) FILTER (WHERE ar.status = 'absent')::int  AS absent_count,
         (SELECT COUNT(*)::int FROM students st WHERE st.section_id = s.id AND st.is_active = true) AS total_students
       FROM sections s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN users u ON u.id = s.class_teacher_id
       LEFT JOIN attendance_records ar ON ar.section_id = s.id AND ar.attend_date = $2
       WHERE s.school_id = $1
       GROUP BY s.id, s.label, c.name, u.name, s.flagged, s.flag_note
       ORDER BY c.name, s.label`,
      [school_id, date]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /stats — historical attendance stats for a date range + class breakdown
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const school_id = req.user!.school_id;
    const today = await getToday(school_id!);

    // Support explicit from/to range OR legacy days param
    const toDate   = (req.query.to   as string) || today;
    const fromDate = (req.query.from as string) || (() => {
      const days = Math.min(parseInt(req.query.days as string) || 30, 365);
      const d = new Date(toDate + 'T12:00:00');
      d.setDate(d.getDate() - days + 1);
      return d.toISOString().split('T')[0];
    })();

    // Daily school-wide attendance % for the range
    const dailyResult = await pool.query(
      `SELECT
         ar.attend_date::text AS date,
         COUNT(*) FILTER (WHERE ar.status = 'present')::int AS present,
         COUNT(*) FILTER (WHERE ar.status = 'absent')::int  AS absent,
         COUNT(*)::int AS total
       FROM attendance_records ar
       JOIN sections s ON s.id = ar.section_id
       WHERE s.school_id = $1
         AND ar.attend_date BETWEEN $2::date AND $3::date
       GROUP BY ar.attend_date
       ORDER BY ar.attend_date`,
      [school_id, fromDate, toDate]
    );

    // Class-wise attendance % for the range
    const classResult = await pool.query(
      `SELECT
         c.name AS class_name,
         COUNT(*) FILTER (WHERE ar.status = 'present')::int AS present,
         COUNT(*) FILTER (WHERE ar.status = 'absent')::int  AS absent,
         COUNT(*)::int AS total,
         ROUND(COUNT(*) FILTER (WHERE ar.status = 'present') * 100.0 / NULLIF(COUNT(*), 0), 1)::float AS attendance_pct
       FROM attendance_records ar
       JOIN sections s ON s.id = ar.section_id
       JOIN classes c ON c.id = s.class_id
       WHERE s.school_id = $1
         AND ar.attend_date BETWEEN $2::date AND $3::date
       GROUP BY c.name
       ORDER BY c.name`,
      [school_id, fromDate, toDate]
    );

    // Summary: today, this week, this month (always relative to today)
    const summaryResult = await pool.query(
      `SELECT
         ROUND(COUNT(*) FILTER (WHERE ar.status = 'present' AND ar.attend_date = $2) * 100.0 /
           NULLIF(COUNT(*) FILTER (WHERE ar.attend_date = $2), 0), 1)::float AS today_pct,
         ROUND(COUNT(*) FILTER (WHERE ar.status = 'present' AND ar.attend_date >= date_trunc('week', $2::date)) * 100.0 /
           NULLIF(COUNT(*) FILTER (WHERE ar.attend_date >= date_trunc('week', $2::date)), 0), 1)::float AS week_pct,
         ROUND(COUNT(*) FILTER (WHERE ar.status = 'present' AND ar.attend_date >= date_trunc('month', $2::date)) * 100.0 /
           NULLIF(COUNT(*) FILTER (WHERE ar.attend_date >= date_trunc('month', $2::date)), 0), 1)::float AS month_pct,
         COUNT(*) FILTER (WHERE ar.status = 'absent' AND ar.attend_date = $2)::int AS absent_today,
         COUNT(*) FILTER (WHERE ar.status = 'present' AND ar.attend_date = $2)::int AS present_today
       FROM attendance_records ar
       JOIN sections s ON s.id = ar.section_id
       WHERE s.school_id = $1`,
      [school_id, today]
    );

    // Range-level avg
    const rangeTotal = dailyResult.rows.reduce((s: number, r: any) => s + r.total, 0);
    const rangePresent = dailyResult.rows.reduce((s: number, r: any) => s + r.present, 0);
    const range_pct = rangeTotal > 0 ? Math.round((rangePresent / rangeTotal) * 100) : null;

    return res.json({
      today,
      from: fromDate,
      to: toDate,
      range_pct,
      summary: summaryResult.rows[0] || { today_pct: 0, week_pct: 0, month_pct: 0, absent_today: 0, present_today: 0 },
      daily: dailyResult.rows,
      by_class: classResult.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('principal', 'admin'));

// GET /activity — teacher activity feed for today
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const school_id = req.user!.school_id;
    const today = await getToday(school_id!);

    // Check if today is a working day
    const workingDayRow = await pool.query(
      `SELECT COUNT(*) > 0 AS is_working
       FROM school_calendar
       WHERE school_id = $1
         AND $2::date BETWEEN start_date AND end_date
         AND EXTRACT(DOW FROM $2::date)::int = ANY(working_days)`,
      [school_id, today]
    );
    const isWorkingDay = workingDayRow.rows[0]?.is_working ?? true;

    // Get all teachers with at least one active section
    const result = await pool.query(
      `SELECT
         u.id          AS teacher_id,
         u.name        AS teacher_name,
         s.id          AS section_id,
         s.name        AS section_name,
         dc.id         AS completion_id,
         COALESCE(array_length(dc.covered_chunk_ids, 1), 0) AS chunks_covered
       FROM users u
       JOIN teacher_sections ts ON ts.teacher_id = u.id
       JOIN sections s ON s.id = ts.section_id AND s.school_id = $1 AND s.is_active = true
       LEFT JOIN daily_completions dc ON dc.section_id = s.id AND dc.completion_date = $2
       WHERE u.school_id = $1 AND u.role = 'teacher'
       ORDER BY u.name, s.name`,
      [school_id, today]
    );

    // Group by teacher
    const teacherMap = new Map<string, any>();
    for (const row of result.rows) {
      if (!teacherMap.has(row.teacher_id)) {
        teacherMap.set(row.teacher_id, {
          teacher_id: row.teacher_id,
          teacher_name: row.teacher_name,
          sections: [],
        });
      }
      const teacher = teacherMap.get(row.teacher_id);
      const status = !isWorkingDay
        ? 'not_working_day'
        : row.completion_id
        ? 'submitted'
        : 'behind';
      teacher.sections.push({
        section_id: row.section_id,
        section_name: row.section_name,
        status,
        chunks_covered: row.chunks_covered,
      });
    }

    return res.json(Array.from(teacherMap.values()));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

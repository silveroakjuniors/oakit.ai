import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, schoolScope, roleGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

// GET / — attendance history for linked children (last 30 calendar days)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    const today = await getToday(school_id!);

    // Get linked children
    const links = await pool.query(
      `SELECT psl.student_id, st.name AS student_name
       FROM parent_student_links psl
       JOIN students st ON st.id = psl.student_id
       WHERE psl.parent_id = $1`,
      [user_id]
    );

    const result = [];
    for (const link of links.rows) {
      const { student_id, student_name } = link;

      const records = await pool.query(
        `SELECT
           attend_date,
           status,
           COALESCE(is_late, false)  AS is_late,
           arrived_at
         FROM attendance_records
         WHERE student_id = $1
           AND attend_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date
         ORDER BY attend_date DESC`,
        [student_id, today]
      );

      const total = records.rows.length;
      const present = records.rows.filter((r: any) => r.status === 'present').length;
      const absent = records.rows.filter((r: any) => r.status === 'absent').length;
      const late = records.rows.filter((r: any) => r.is_late).length;
      const onTime = present - late;
      const attendance_pct = total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0;
      const punctuality_pct = present > 0 ? Math.round((onTime / present) * 100 * 10) / 10 : 0;

      result.push({
        student_id,
        student_name,
        records: records.rows,
        attendance_pct,
        punctuality_pct,
        stats: { total, present, absent, late, on_time: onTime },
      });
    }

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

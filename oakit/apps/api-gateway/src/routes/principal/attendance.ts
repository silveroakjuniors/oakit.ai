import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('principal', 'admin'));

// GET /overview — attendance overview for all sections in the school
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const school_id = req.user!.school_id;
    const today = await getToday(school_id!);

    const result = await pool.query(
      `SELECT
         s.id          AS section_id,
         s.label       AS section_label,
         c.name        AS class_name,
         u.name        AS class_teacher_name,
         COALESCE(s.flagged, false)   AS flagged,
         s.flag_note,
         CASE WHEN ar.id IS NOT NULL THEN 'submitted' ELSE 'pending' END AS status,
         COALESCE(ar.present_count, 0)  AS present_count,
         COALESCE(ar.absent_count, 0)   AS absent_count
       FROM sections s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN users u ON u.id = s.class_teacher_id
       LEFT JOIN LATERAL (
         SELECT
           id,
           COUNT(*) FILTER (WHERE status = 'present') AS present_count,
           COUNT(*) FILTER (WHERE status = 'absent')  AS absent_count
         FROM attendance_records
         WHERE section_id = s.id AND attend_date = $2
         GROUP BY id
         LIMIT 1
       ) ar ON true
       WHERE s.school_id = $1
       ORDER BY c.name, s.label`,
      [school_id, today]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

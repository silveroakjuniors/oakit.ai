import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

// GET /api/v1/parent/homework/history?student_id=&limit=30
// Returns homework submission history for a child — for parent portal
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id, limit = '30' } = req.query as Record<string, string>;

    if (!student_id) return res.status(400).json({ error: 'student_id is required' });

    // Verify parent owns this student
    const link = await pool.query(
      `SELECT 1 FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`,
      [user_id, student_id, school_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    const result = await pool.query(
      `SELECT hs.homework_date, hs.status, hs.teacher_note, hs.recorded_at,
              th.formatted_text as homework_text
       FROM homework_submissions hs
       LEFT JOIN students s ON s.id = hs.student_id
       LEFT JOIN teacher_homework th ON th.section_id = s.section_id AND th.homework_date = hs.homework_date
       WHERE hs.student_id = $1
       ORDER BY hs.homework_date DESC
       LIMIT $2`,
      [student_id, parseInt(limit)]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/homework/missed?student_id= — only not_submitted + partial
router.get('/missed', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.query as Record<string, string>;
    if (!student_id) return res.status(400).json({ error: 'student_id is required' });

    const link = await pool.query(
      `SELECT 1 FROM parent_student_links psl JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`,
      [user_id, student_id, school_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    const result = await pool.query(
      `SELECT hs.homework_date, hs.status, hs.teacher_note,
              th.formatted_text as homework_text
       FROM homework_submissions hs
       LEFT JOIN students s ON s.id = hs.student_id
       LEFT JOIN teacher_homework th ON th.section_id = s.section_id AND th.homework_date = hs.homework_date
       WHERE hs.student_id = $1 AND hs.status IN ('not_submitted', 'partial')
       ORDER BY hs.homework_date DESC
       LIMIT 20`,
      [student_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

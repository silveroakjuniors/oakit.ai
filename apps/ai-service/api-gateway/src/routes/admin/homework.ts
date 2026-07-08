/**
 * Admin/Principal homework list (Req 6.1, 6.3, 6.4)
 * GET /api/v1/admin/homework?date=&class_id=&section_id=
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'));

// GET /api/v1/admin/homework/stats — Completion stats per class for last 15 days
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id } = req.query as Record<string, string>;

    let classFilter = '';
    const params: any[] = [school_id];
    if (class_id) { params.push(class_id); classFilter = `AND sec.class_id = $${params.length}`; }

    const result = await pool.query(
      `SELECT c.id AS class_id, c.name AS class_name, sec.id AS section_id, sec.label AS section_label,
              COUNT(DISTINCT hs.student_id) FILTER (WHERE hs.status = 'completed')::int AS completed,
              COUNT(DISTINCT hs.student_id) FILTER (WHERE hs.status = 'partial')::int AS partial,
              COUNT(DISTINCT hs.student_id) FILTER (WHERE hs.status = 'not_submitted')::int AS not_done,
              COUNT(DISTINCT hs.homework_date)::int AS days_tracked
       FROM sections sec
       JOIN classes c ON c.id = sec.class_id
       LEFT JOIN homework_submissions hs ON hs.section_id = sec.id AND hs.school_id = $1
         AND hs.homework_date >= CURRENT_DATE - 15
       WHERE sec.school_id = $1 ${classFilter}
       GROUP BY c.id, c.name, sec.id, sec.label
       ORDER BY c.name, sec.label`,
      params
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[admin/homework/stats]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/homework/stats/students?section_id=&date= — Student-level drill-down
router.get('/stats/students', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { section_id, date } = req.query as Record<string, string>;
    if (!section_id) return res.status(400).json({ error: 'section_id required' });

    const params: any[] = [school_id, section_id];
    let dateFilter = 'AND hs.homework_date >= CURRENT_DATE - 15';
    if (date) { params.push(date); dateFilter = `AND hs.homework_date = $${params.length}`; }

    const result = await pool.query(
      `SELECT s.id, s.name,
              COUNT(*) FILTER (WHERE hs.status = 'completed')::int AS completed,
              COUNT(*) FILTER (WHERE hs.status = 'partial')::int AS partial,
              COUNT(*) FILTER (WHERE hs.status = 'not_submitted')::int AS not_done
       FROM students s
       LEFT JOIN homework_submissions hs ON hs.student_id = s.id AND hs.school_id = $1 ${dateFilter}
       WHERE s.section_id = $2 AND s.school_id = $1 AND s.is_active = true
       GROUP BY s.id, s.name
       ORDER BY s.name`,
      params
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[admin/homework/stats/students]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { date, class_id, section_id } = req.query as Record<string, string>;

    const params: any[] = [school_id];
    const conditions: string[] = ['th.school_id = $1'];

    if (date) { params.push(date); conditions.push(`th.homework_date = $${params.length}`); }
    else { conditions.push(`th.homework_date >= CURRENT_DATE - 7`); }
    if (section_id) { params.push(section_id); conditions.push(`th.section_id = $${params.length}`); }
    if (class_id) { params.push(class_id); conditions.push(`s.class_id = $${params.length}`); }

    const result = await pool.query(
      `SELECT th.id, th.chunk_id, COALESCE(th.topic_label, 'Homework') AS topic_label, th.homework_date,
              th.raw_text, th.formatted_text, th.teacher_comments,
              u.name AS teacher_name,
              c.name AS class_name, sec.label AS section_label
       FROM teacher_homework th
       JOIN sections sec ON sec.id = th.section_id
       JOIN classes c ON c.id = sec.class_id
       JOIN users u ON u.id = th.teacher_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY th.homework_date DESC, c.name, sec.label`,
      params
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[admin/homework]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

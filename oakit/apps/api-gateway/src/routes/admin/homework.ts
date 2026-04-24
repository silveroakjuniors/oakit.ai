/**
 * Admin/Principal homework list (Req 6.1, 6.3, 6.4)
 * GET /api/v1/admin/homework?date=&class_id=&section_id=
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'));

router.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { date, class_id, section_id } = req.query as Record<string, string>;

    const params: any[] = [school_id];
    const conditions: string[] = ['th.school_id = $1', 'th.chunk_id IS NOT NULL'];

    if (date) { params.push(date); conditions.push(`th.homework_date = $${params.length}`); }
    if (section_id) { params.push(section_id); conditions.push(`th.section_id = $${params.length}`); }
    if (class_id) { params.push(class_id); conditions.push(`s.class_id = $${params.length}`); }

    const result = await pool.query(
      `SELECT th.id, th.chunk_id, th.topic_label, th.homework_date,
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

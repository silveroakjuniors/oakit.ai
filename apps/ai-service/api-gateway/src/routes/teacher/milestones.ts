import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher'));

async function getMilestoneData(studentId: string, schoolId: string) {
  const studentRow = await pool.query(
    `SELECT s.id, c.name as class_name FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = $1 AND s.school_id = $2`,
    [studentId, schoolId]
  );
  if (studentRow.rows.length === 0) return null;
  const classLevel = studentRow.rows[0].class_name;

  const milestones = await pool.query(
    `SELECT m.id, m.domain, m.description, m.position, m.is_custom, m.term,
            sm.achieved_at, sm.teacher_id, sm.achievement_comment,
            sm.parent_note, sm.parent_noted_at,
            u.name as achieved_by
     FROM milestones m
     LEFT JOIN student_milestones sm ON sm.milestone_id = m.id AND sm.student_id = $1
     LEFT JOIN users u ON u.id = sm.teacher_id
     WHERE (m.school_id IS NULL OR m.school_id = $2) AND m.class_level = $3
     ORDER BY m.domain, m.position`,
    [studentId, schoolId, classLevel]
  );

  const total = milestones.rows.length;
  const achieved = milestones.rows.filter((r: any) => r.achieved_at).length;
  const pct = total > 0 ? Math.round((achieved / total) * 100) : 0;

  return { class_level: classLevel, milestones: milestones.rows, total, achieved, completion_pct: pct };
}

// GET /api/v1/teacher/milestones/:studentId
router.get('/:studentId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const data = await getMilestoneData(req.params.studentId, school_id);
    if (!data) return res.status(404).json({ error: 'Student not found' });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/teacher/milestones/:studentId/:milestoneId/achieve
// Body: { achievement_comment?: string }
router.post('/:studentId/:milestoneId/achieve', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { achievement_comment } = req.body;
    await pool.query(
      `INSERT INTO student_milestones (student_id, milestone_id, teacher_id, achievement_comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (student_id, milestone_id)
       DO UPDATE SET achievement_comment = EXCLUDED.achievement_comment, achieved_at = CURRENT_DATE, teacher_id = EXCLUDED.teacher_id`,
      [req.params.studentId, req.params.milestoneId, user_id, achievement_comment || null]
    );
    const data = await getMilestoneData(req.params.studentId, school_id);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/teacher/milestones/:studentId/:milestoneId/achieve — uncheck milestone
router.delete('/:studentId/:milestoneId/achieve', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    await pool.query(
      `DELETE FROM student_milestones WHERE student_id = $1 AND milestone_id = $2`,
      [req.params.studentId, req.params.milestoneId]
    );
    const data = await getMilestoneData(req.params.studentId, school_id);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/teacher/milestones/custom — create a custom milestone
// Body: { class_level, domain, description, term? }
router.post('/custom', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { class_level, domain, description, term } = req.body;
    if (!class_level || !domain || !description?.trim()) {
      return res.status(400).json({ error: 'class_level, domain, description required' });
    }
    const result = await pool.query(
      `INSERT INTO milestones (school_id, class_level, domain, description, is_custom, term, position)
       VALUES ($1, $2, $3, $4, true, $5,
         (SELECT COALESCE(MAX(position), 0) + 1 FROM milestones WHERE school_id = $1 AND class_level = $2 AND domain = $3))
       RETURNING *`,
      [school_id, class_level, domain, description.trim(), term || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[milestone custom create]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/teacher/milestones/custom/:milestoneId — edit custom milestone title
// Only allowed if NOT achieved by any student
router.put('/custom/:milestoneId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { description, term } = req.body;
    if (!description?.trim()) return res.status(400).json({ error: 'description required' });

    // Check it's a custom milestone belonging to this school
    const mRow = await pool.query(
      `SELECT id, is_custom FROM milestones WHERE id = $1 AND school_id = $2`,
      [req.params.milestoneId, school_id]
    );
    if (!mRow.rows.length) return res.status(404).json({ error: 'Milestone not found' });
    if (!mRow.rows[0].is_custom) return res.status(403).json({ error: 'Cannot edit predefined milestones' });

    // Check if any student has achieved this milestone
    const achieved = await pool.query(
      `SELECT 1 FROM student_milestones WHERE milestone_id = $1 LIMIT 1`,
      [req.params.milestoneId]
    );
    if (achieved.rows.length > 0) {
      return res.status(409).json({ error: 'Cannot edit a milestone that has been achieved. Uncheck it first.' });
    }

    await pool.query(
      `UPDATE milestones SET description = $1, term = $2 WHERE id = $3`,
      [description.trim(), term || null, req.params.milestoneId]
    );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/teacher/milestones/custom/:milestoneId — delete custom milestone
router.delete('/custom/:milestoneId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const mRow = await pool.query(
      `SELECT id, is_custom FROM milestones WHERE id = $1 AND school_id = $2`,
      [req.params.milestoneId, school_id]
    );
    if (!mRow.rows.length) return res.status(404).json({ error: 'Milestone not found' });
    if (!mRow.rows[0].is_custom) return res.status(403).json({ error: 'Cannot delete predefined milestones' });
    await pool.query(`DELETE FROM milestones WHERE id = $1`, [req.params.milestoneId]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

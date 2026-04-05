import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';

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
    `SELECT m.id, m.domain, m.description, m.position, m.is_custom,
            sm.achieved_at, sm.teacher_id,
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
router.post('/:studentId/:milestoneId/achieve', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    await pool.query(
      `INSERT INTO student_milestones (student_id, milestone_id, teacher_id)
       VALUES ($1, $2, $3) ON CONFLICT (student_id, milestone_id) DO NOTHING`,
      [req.params.studentId, req.params.milestoneId, user_id]
    );
    const data = await getMilestoneData(req.params.studentId, school_id);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/teacher/milestones/:studentId/:milestoneId/achieve
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

export default router;

/**
 * Parent milestone routes
 * Parents can view their child's milestones and add progress notes.
 * Teachers assign and achieve milestones; parents record home practice notes.
 */
import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

// GET /api/v1/parent/milestones/:studentId
// Returns all milestones for the child, grouped by domain, with achievement + parent note status
router.get('/:studentId', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { studentId } = req.params;

    // Verify parent owns this student
    const link = await pool.query(
      `SELECT 1 FROM parent_student_links psl JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`,
      [user_id, studentId, school_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    const studentRow = await pool.query(
      `SELECT s.id, c.name as class_name FROM students s JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1 AND s.school_id = $2`,
      [studentId, school_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const classLevel = studentRow.rows[0].class_name;

    const milestones = await pool.query(
      `SELECT m.id, m.domain, m.description, m.position, m.is_custom, m.term,
              sm.achieved_at, sm.achievement_comment, sm.parent_note, sm.parent_noted_at,
              u.name as achieved_by
       FROM milestones m
       LEFT JOIN student_milestones sm ON sm.milestone_id = m.id AND sm.student_id = $1
       LEFT JOIN users u ON u.id = sm.teacher_id
       WHERE (m.school_id IS NULL OR m.school_id = $2)
         AND m.class_level = $3
         AND m.shared_with_parent = true
       ORDER BY m.domain, m.position`,
      [studentId, school_id, classLevel]
    );

    const total = milestones.rows.length;
    const achieved = milestones.rows.filter((r: any) => r.achieved_at).length;
    const pct = total > 0 ? Math.round((achieved / total) * 100) : 0;

    return res.json({
      class_level: classLevel,
      milestones: milestones.rows,
      total,
      achieved,
      completion_pct: pct,
    });
  } catch (err) {
    console.error('[parent/milestones GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/parent/milestones/:studentId/:milestoneId/note
// Parent adds a progress note (e.g. "Practiced at home today, getting better")
router.post('/:studentId/:milestoneId/note', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { studentId, milestoneId } = req.params;
    const { note } = req.body;

    if (!note?.trim()) return res.status(400).json({ error: 'note is required' });

    // Verify parent owns this student
    const link = await pool.query(
      `SELECT 1 FROM parent_student_links psl JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`,
      [user_id, studentId, school_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    // Upsert — create a student_milestone record if it doesn't exist (not achieved yet, just noted)
    await pool.query(
      `INSERT INTO student_milestones (student_id, milestone_id, teacher_id, parent_note, parent_noted_at, achieved_at)
       VALUES ($1, $2, $3, $4, now(), NULL)
       ON CONFLICT (student_id, milestone_id)
       DO UPDATE SET parent_note = $4, parent_noted_at = now(), updated_at = now()`,
      [studentId, milestoneId, user_id, note.trim()]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('[parent/milestones POST note]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

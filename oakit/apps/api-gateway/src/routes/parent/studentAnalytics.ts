import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

// GET /api/v1/parent/student-analytics/:studentId
router.get('/:studentId', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    // Verify parent owns this student
    const link = await pool.query(
      `SELECT s.class_id FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`,
      [user_id, req.params.studentId, school_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    // Check portal enabled for this class
    const config = await pool.query(
      'SELECT enabled FROM student_portal_config WHERE school_id = $1 AND class_id = $2',
      [school_id, link.rows[0].class_id]
    );
    if (!config.rows[0]?.enabled) {
      return res.status(403).json({ error: 'Student portal is not enabled for this class' });
    }

    // Quiz history
    const attempts = await pool.query(
      `SELECT qa.id, q.subject, qa.total_marks, qa.scored_marks, qa.submitted_at,
              CASE WHEN qa.total_marks > 0 THEN ROUND((qa.scored_marks::numeric / qa.total_marks) * 100) ELSE 0 END as percentage,
              q.is_assigned
       FROM quiz_attempts qa
       JOIN quizzes q ON q.id = qa.quiz_id
       WHERE qa.student_id = $1 AND qa.school_id = $2 AND qa.status = 'submitted'
       ORDER BY qa.submitted_at DESC`,
      [req.params.studentId, school_id]
    );

    const total = attempts.rows.length;
    const avg = total > 0
      ? Math.round(attempts.rows.reduce((s: number, a: any) => s + Number(a.percentage), 0) / total)
      : 0;

    // Subject breakdown
    const subjectMap: Record<string, { scored: number; total: number }> = {};
    for (const a of attempts.rows) {
      const s = a.subject || 'General';
      if (!subjectMap[s]) subjectMap[s] = { scored: 0, total: 0 };
      subjectMap[s].scored += Number(a.scored_marks);
      subjectMap[s].total += Number(a.total_marks);
    }
    const subject_breakdown = Object.entries(subjectMap).map(([subject, v]) => ({
      subject,
      avg_pct: v.total > 0 ? Math.round((v.scored / v.total) * 100) : 0,
      needs_revision: v.total > 0 && v.scored / v.total < 0.5,
    }));

    return res.json({
      total_quizzes: total,
      average_pct: avg,
      subject_breakdown,
      attempts: attempts.rows,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

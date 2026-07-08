import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin'));

// GET /api/v1/admin/quizzes — list all quizzes in the school
router.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT q.id, q.subject, q.is_assigned, q.status, q.created_at,
              q.time_limit_mins, q.due_date, q.date_from, q.date_to,
              q.created_by_role,
              sec.label as section_label, c.name as class_name,
              u.name as teacher_name,
              (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) as question_count,
              (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.status = 'submitted') as attempts_count,
              (SELECT ROUND(AVG(qa.scored_marks::numeric / NULLIF(qa.total_marks,0) * 100)) FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.status = 'submitted') as avg_pct
       FROM quizzes q
       JOIN sections sec ON sec.id = q.section_id
       JOIN classes c ON c.id = sec.class_id
       LEFT JOIN users u ON u.id::text = q.created_by_id::text AND q.created_by_role = 'teacher'
       WHERE q.school_id = $1
       ORDER BY q.created_at DESC
       LIMIT 100`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/quizzes/:quizId/results — results for a specific quiz
router.get('/:quizId/results', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT qa.id as attempt_id, s.name as student_name,
              qa.total_marks, qa.scored_marks, qa.submitted_at, qa.status,
              CASE WHEN qa.total_marks > 0 THEN ROUND((qa.scored_marks::numeric / qa.total_marks) * 100) ELSE 0 END as pct
       FROM quiz_attempts qa
       JOIN students s ON s.id = qa.student_id
       WHERE qa.quiz_id = $1 AND qa.school_id = $2
       ORDER BY pct DESC`,
      [req.params.quizId, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

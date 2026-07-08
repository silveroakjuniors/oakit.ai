import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher', 'admin'));

const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

// POST /api/v1/teacher/quiz/assign
router.post('/assign', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id, role } = req.user!;
    const { section_id, subject, topic_ids, question_types, time_limit_mins, due_date, date_from, date_to } = req.body;

    if (!section_id || !topic_ids?.length || !question_types?.length) {
      return res.status(400).json({ error: 'section_id, topic_ids, and question_types are required' });
    }

    // Verify teacher has access to section
    if (role === 'teacher') {
      const sections = await getTeacherSections(user_id, school_id);
      if (!sections.some(s => s.section_id === section_id)) {
        return res.status(403).json({ error: 'Not authorized for this section' });
      }
    }

    const classRow = await pool.query(
      'SELECT c.name FROM sections s JOIN classes c ON c.id = s.class_id WHERE s.id = $1',
      [section_id]
    );
    const class_name = classRow.rows[0]?.name || 'Unknown';

    // Create quiz in draft state
    const quizResult = await pool.query(
      `INSERT INTO quizzes (school_id, section_id, created_by_role, created_by_id, subject, date_from, date_to, topic_ids, question_types, time_limit_mins, is_assigned, due_date, status)
       VALUES ($1, $2, 'teacher', $3, $4, $5, $6, $7::uuid[], $8, $9, true, $10, 'draft')
       RETURNING id`,
      [school_id, section_id, user_id, subject || 'General', date_from, date_to, topic_ids, question_types, time_limit_mins || null, due_date || null]
    );
    const quiz_id = quizResult.rows[0].id;

    // Fetch chunks
    const chunks = await pool.query(
      'SELECT id, topic_label, content FROM curriculum_chunks WHERE id = ANY($1::uuid[]) ORDER BY chunk_index',
      [topic_ids]
    );

    // Generate questions
    let questions: any[] = [];
    try {
      const aiResp = await axios.post(`${AI()}/internal/generate-quiz`, {
        quiz_id, chunk_ids: topic_ids, chunks: chunks.rows,
        question_types, subject, class_name,
      }, { timeout: 60000 });
      questions = aiResp.data.questions || [];
    } catch {
      for (const chunk of chunks.rows) {
        questions.push({
          chunk_id: chunk.id, subject,
          question: `Describe what you know about "${chunk.topic_label}".`,
          q_type: question_types[0] || '1_mark', marks: 1,
          answer_key: chunk.topic_label, explanation: '',
        });
      }
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await pool.query(
        `INSERT INTO quiz_questions (quiz_id, chunk_id, subject, question, q_type, marks, answer_key, explanation, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [quiz_id, q.chunk_id || null, q.subject || subject, q.question, q.q_type, q.marks || 1, q.answer_key, q.explanation || '', i]
      );
    }

    const storedQuestions = await pool.query(
      'SELECT id, question, q_type, marks, position FROM quiz_questions WHERE quiz_id = $1 ORDER BY position',
      [quiz_id]
    );

    return res.status(201).json({ quiz_id, status: 'draft', questions: storedQuestions.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/teacher/quiz/:quizId/activate
router.post('/:quizId/activate', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id, role } = req.user!;

    const quiz = await pool.query(
      'SELECT id, section_id, created_by_id FROM quizzes WHERE id = $1 AND school_id = $2',
      [req.params.quizId, school_id]
    );
    if (quiz.rows.length === 0) return res.status(404).json({ error: 'Quiz not found' });

    if (role === 'teacher') {
      const sections = await getTeacherSections(user_id, school_id);
      if (!sections.some(s => s.section_id === quiz.rows[0].section_id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    await pool.query(
      "UPDATE quizzes SET status = 'active' WHERE id = $1",
      [req.params.quizId]
    );
    return res.json({ message: 'Quiz activated — students can now take the test' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/quiz/analytics/:sectionId
router.get('/analytics/:sectionId', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id, role } = req.user!;

    if (role === 'teacher') {
      const sections = await getTeacherSections(user_id, school_id);
      if (!sections.some(s => s.section_id === req.params.sectionId)) {
        return res.status(403).json({ error: 'Not authorized for this section' });
      }
    }

    const result = await pool.query(
      `SELECT s.id as student_id, s.name as student_name,
              COUNT(qa.id) as total_quizzes,
              COALESCE(AVG(CASE WHEN qa.total_marks > 0 THEN (qa.scored_marks::numeric / qa.total_marks) * 100 END), 0)::int as avg_pct,
              COALESCE(SUM(qa.scored_marks), 0) as total_scored,
              COALESCE(SUM(qa.total_marks), 0) as total_possible
       FROM students s
       LEFT JOIN quiz_attempts qa ON qa.student_id = s.id AND qa.school_id = $1 AND qa.status = 'submitted'
       WHERE s.section_id = $2 AND s.school_id = $1 AND s.is_active = true
       GROUP BY s.id, s.name
       ORDER BY s.name`,
      [school_id, req.params.sectionId]
    );

    // Subject breakdown per student
    const subjectResult = await pool.query(
      `SELECT qa.student_id, q.subject,
              SUM(qa.scored_marks) as scored, SUM(qa.total_marks) as total
       FROM quiz_attempts qa
       JOIN quizzes q ON q.id = qa.quiz_id
       WHERE q.section_id = $1 AND qa.school_id = $2 AND qa.status = 'submitted'
       GROUP BY qa.student_id, q.subject`,
      [req.params.sectionId, school_id]
    );

    const subjectMap: Record<string, any[]> = {};
    for (const r of subjectResult.rows) {
      if (!subjectMap[r.student_id]) subjectMap[r.student_id] = [];
      subjectMap[r.student_id].push({
        subject: r.subject,
        avg_pct: r.total > 0 ? Math.round((r.scored / r.total) * 100) : 0,
        needs_revision: r.total > 0 && r.scored / r.total < 0.5,
      });
    }

    const students = result.rows.map((s: any) => ({
      ...s,
      subject_breakdown: subjectMap[s.student_id] || [],
    }));

    // Class-level summary
    const classAvg = students.length > 0
      ? Math.round(students.reduce((sum: number, s: any) => sum + Number(s.avg_pct), 0) / students.length)
      : 0;

    return res.json({ students, class_avg_pct: classAvg });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

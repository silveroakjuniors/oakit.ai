import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, schoolScope, roleGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('student'));

const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

// GET /api/v1/student/quiz/assigned — assigned tests for this student
router.get('/assigned', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const student_id = (req.user as any).student_id;
    const section_id = (req.user as any).section_id;
    if (!student_id || !section_id) return res.status(400).json({ error: 'Invalid token' });

    const result = await pool.query(
      `SELECT q.id as quiz_id, q.subject, q.time_limit_mins as time_limit_minutes, q.due_date, q.created_at,
              CASE WHEN qa.status = 'submitted' THEN 'completed'
                   WHEN qa.status = 'in_progress' THEN 'active'
                   ELSE 'pending' END as status
       FROM quizzes q
       LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_id = $1
       WHERE q.section_id = $2 AND q.school_id = $3 AND q.is_assigned = true AND q.status = 'active'
       ORDER BY q.created_at DESC`,
      [student_id, section_id, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/student/quiz/topics?subject=&from=&to=
router.get('/topics', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const section_id = (req.user as any).section_id;
    const { subject, from, to } = req.query as Record<string, string>;
    if (!section_id) return res.status(400).json({ error: 'Invalid token' });

    const today = await getToday(school_id);
    const dateFrom = from || today.slice(0, 8) + '01';
    const dateTo = to || today;

    const result = await pool.query(
      `SELECT DISTINCT cc.id, cc.topic_label, cc.content, dc.completion_date
       FROM daily_completions dc
       JOIN curriculum_chunks cc ON cc.id = ANY(dc.covered_chunk_ids)
       WHERE dc.section_id = $1
         AND dc.completion_date >= $2
         AND dc.completion_date <= $3
         ${subject ? "AND (cc.topic_label ILIKE $4 OR cc.content ILIKE $4)" : ''}
       ORDER BY dc.completion_date, cc.topic_label`,
      subject
        ? [section_id, dateFrom, dateTo, `%${subject}%`]
        : [section_id, dateFrom, dateTo]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/student/quiz/generate
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const student_id = (req.user as any).student_id;
    const section_id = (req.user as any).section_id;
    const { subject, topic_ids, question_types, date_from, date_to } = req.body;

    if (!topic_ids?.length || !question_types?.length) {
      return res.status(400).json({ error: 'topic_ids and question_types are required' });
    }

    // Get class info for age-appropriate generation
    const classRow = await pool.query(
      'SELECT c.name as class_name FROM sections s JOIN classes c ON c.id = s.class_id WHERE s.id = $1',
      [section_id]
    );
    const class_name = classRow.rows[0]?.class_name || 'Unknown';

    // Create quiz record
    const quizResult = await pool.query(
      `INSERT INTO quizzes (school_id, section_id, created_by_role, created_by_id, subject, date_from, date_to, topic_ids, question_types, is_assigned, status)
       VALUES ($1, $2, 'student', $3, $4, $5, $6, $7::uuid[], $8, false, 'active')
       RETURNING id`,
      [school_id, section_id, student_id, subject || 'General', date_from, date_to, topic_ids, question_types]
    );
    const quiz_id = quizResult.rows[0].id;

    // Fetch chunk content for AI
    const chunks = await pool.query(
      'SELECT id, topic_label, content FROM curriculum_chunks WHERE id = ANY($1::uuid[]) ORDER BY chunk_index',
      [topic_ids]
    );

    // Call AI to generate questions
    let questions: any[] = [];
    try {
      const aiResp = await axios.post(`${AI()}/internal/generate-quiz`, {
        quiz_id, chunk_ids: topic_ids, chunks: chunks.rows,
        question_types, subject, class_name,
      }, { timeout: 60000 });
      questions = aiResp.data.questions || [];
    } catch (e) {
      // Fallback: simple questions from topic labels
      for (const chunk of chunks.rows) {
        questions.push({
          chunk_id: chunk.id, subject,
          question: `What did you learn about "${chunk.topic_label}"?`,
          q_type: '1_mark', marks: 1,
          answer_key: chunk.topic_label,
          explanation: `This topic was covered in class.`,
        });
      }
    }

    // Store questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await pool.query(
        `INSERT INTO quiz_questions (quiz_id, chunk_id, subject, question, q_type, marks, answer_key, explanation, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [quiz_id, q.chunk_id || null, q.subject || subject, q.question, q.q_type, q.marks || 1, q.answer_key, q.explanation || '', i]
      );
    }

    // Return quiz without answer keys
    const storedQuestions = await pool.query(
      'SELECT id, question, q_type, marks, position FROM quiz_questions WHERE quiz_id = $1 ORDER BY position',
      [quiz_id]
    );

    return res.status(201).json({ quiz_id, questions: storedQuestions.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/student/quiz/:quizId/start
router.post('/:quizId/start', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const student_id = (req.user as any).student_id;

    const quiz = await pool.query(
      'SELECT id, time_limit_mins, status, is_assigned FROM quizzes WHERE id = $1 AND school_id = $2',
      [req.params.quizId, school_id]
    );
    if (quiz.rows.length === 0) return res.status(404).json({ error: 'Quiz not found' });
    if (quiz.rows[0].status !== 'active') return res.status(400).json({ error: 'Quiz is not active' });

    // Create or return existing attempt
    const existing = await pool.query(
      'SELECT id, status FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2',
      [req.params.quizId, student_id]
    );
    if (existing.rows.length > 0 && existing.rows[0].status !== 'in_progress') {
      return res.status(400).json({ error: 'You have already completed this quiz' });
    }

    let attempt_id = existing.rows[0]?.id;
    if (!attempt_id) {
      const attemptResult = await pool.query(
        'INSERT INTO quiz_attempts (quiz_id, student_id, school_id) VALUES ($1, $2, $3) RETURNING id',
        [req.params.quizId, student_id, school_id]
      );
      attempt_id = attemptResult.rows[0].id;
    }

    // Return questions without answer keys
    const questions = await pool.query(
      'SELECT id, question, q_type, marks, position FROM quiz_questions WHERE quiz_id = $1 ORDER BY position',
      [req.params.quizId]
    );

    return res.json({
      attempt_id,
      quiz_id: req.params.quizId,
      time_limit_mins: quiz.rows[0].time_limit_mins,
      is_assigned: quiz.rows[0].is_assigned,
      questions: questions.rows,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/student/quiz/:quizId/submit
router.post('/:quizId/submit', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const student_id = (req.user as any).student_id;
    const { answers } = req.body; // [{ question_id, answer }]

    if (!Array.isArray(answers)) return res.status(400).json({ error: 'answers array is required' });

    // Verify attempt
    const attempt = await pool.query(
      'SELECT id, status FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2 AND school_id = $3',
      [req.params.quizId, student_id, school_id]
    );
    if (attempt.rows.length === 0) return res.status(404).json({ error: 'Attempt not found — start the quiz first' });
    if (attempt.rows[0].status !== 'in_progress') return res.status(400).json({ error: 'Quiz already submitted' });
    const attempt_id = attempt.rows[0].id;

    // Fetch questions with answer keys
    const questions = await pool.query(
      'SELECT id, question, q_type, marks, answer_key, explanation FROM quiz_questions WHERE quiz_id = $1',
      [req.params.quizId]
    );
    const qMap = new Map(questions.rows.map((q: any) => [q.id, q]));

    // Get class info
    const section_id = (req.user as any).section_id;
    const classRow = await pool.query(
      'SELECT c.name FROM sections s JOIN classes c ON c.id = s.class_id WHERE s.id = $1',
      [section_id]
    );
    const class_name = classRow.rows[0]?.name || 'Unknown';

    // Call AI to evaluate
    let evaluations: any[] = [];
    try {
      const aiResp = await axios.post(`${AI()}/internal/evaluate-quiz`, {
        questions: questions.rows,
        student_answers: answers,
        class_name,
      }, { timeout: 60000 });
      evaluations = aiResp.data.evaluations || [];
    } catch {
      // Fallback: simple exact match
      evaluations = answers.map((a: any) => {
        const q = qMap.get(a.question_id);
        if (!q) return { question_id: a.question_id, is_correct: false, marks_awarded: 0, ai_feedback: '' };
        const correct = (a.answer || '').trim().toLowerCase() === (q.answer_key || '').trim().toLowerCase();
        return { question_id: a.question_id, is_correct: correct, marks_awarded: correct ? q.marks : 0, ai_feedback: correct ? 'Correct!' : `Answer: ${q.answer_key}` };
      });
    }

    // Store answers
    let total_marks = 0;
    let scored_marks = 0;
    for (const ev of evaluations) {
      const q = qMap.get(ev.question_id);
      if (!q) continue;
      total_marks += q.marks;
      scored_marks += ev.marks_awarded || 0;
      await pool.query(
        `INSERT INTO quiz_answers (attempt_id, question_id, student_answer, is_correct, marks_awarded, ai_feedback)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [attempt_id, ev.question_id,
         answers.find((a: any) => a.question_id === ev.question_id)?.answer || '',
         ev.is_correct, ev.marks_awarded || 0, ev.ai_feedback || '']
      );
    }

    // Update attempt
    await pool.query(
      `UPDATE quiz_attempts SET status = 'submitted', submitted_at = now(), total_marks = $1, scored_marks = $2
       WHERE id = $3`,
      [total_marks, scored_marks, attempt_id]
    );

    // Build result with correct answers
    const result = evaluations.map((ev: any) => {
      const q = qMap.get(ev.question_id);
      return {
        question_id: ev.question_id,
        question: q?.question,
        q_type: q?.q_type,
        marks: q?.marks,
        student_answer: answers.find((a: any) => a.question_id === ev.question_id)?.answer || '',
        correct_answer: q?.answer_key,
        explanation: q?.explanation,
        is_correct: ev.is_correct,
        marks_awarded: ev.marks_awarded,
        ai_feedback: ev.ai_feedback,
      };
    });

    // Identify weak areas (subjects scored < 50%)
    const subjectScores: Record<string, { scored: number; total: number }> = {};
    for (const ev of evaluations) {
      const q = qMap.get(ev.question_id);
      const subj = q?.subject || 'General';
      if (!subjectScores[subj]) subjectScores[subj] = { scored: 0, total: 0 };
      subjectScores[subj].scored += ev.marks_awarded || 0;
      subjectScores[subj].total += q?.marks || 1;
    }
    const weak_areas = Object.entries(subjectScores)
      .filter(([, v]) => v.total > 0 && v.scored / v.total < 0.5)
      .map(([subject]) => subject);

    return res.json({
      attempt_id, total_marks, scored_marks,
      percentage: total_marks > 0 ? Math.round((scored_marks / total_marks) * 100) : 0,
      result, weak_areas,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/student/quiz/results
router.get('/results', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const student_id = (req.user as any).student_id;

    const result = await pool.query(
      `SELECT qa.id as attempt_id, qa.quiz_id, q.subject, q.is_assigned,
              qa.total_marks, qa.scored_marks, qa.submitted_at, qa.status,
              CASE WHEN qa.total_marks > 0 THEN ROUND((qa.scored_marks::numeric / qa.total_marks) * 100) ELSE 0 END as percentage
       FROM quiz_attempts qa
       JOIN quizzes q ON q.id = qa.quiz_id
       WHERE qa.student_id = $1 AND qa.school_id = $2 AND qa.status = 'submitted'
       ORDER BY qa.submitted_at DESC`,
      [student_id, school_id]
    );

    // Aggregate stats
    const attempts = result.rows;
    const total = attempts.length;
    const avg = total > 0 ? Math.round(attempts.reduce((s: number, a: any) => s + Number(a.percentage), 0) / total) : 0;

    // Subject breakdown
    const subjectMap: Record<string, { total: number; scored: number; count: number }> = {};
    for (const a of attempts) {
      const s = a.subject || 'General';
      if (!subjectMap[s]) subjectMap[s] = { total: 0, scored: 0, count: 0 };
      subjectMap[s].total += Number(a.total_marks);
      subjectMap[s].scored += Number(a.scored_marks);
      subjectMap[s].count++;
    }
    const subject_breakdown = Object.entries(subjectMap).map(([subject, v]) => ({
      subject,
      count: v.count,
      avg_pct: v.total > 0 ? Math.round((v.scored / v.total) * 100) : 0,
      needs_revision: v.total > 0 && v.scored / v.total < 0.5,
    }));

    return res.json({ total_quizzes: total, average_pct: avg, subject_breakdown, attempts });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

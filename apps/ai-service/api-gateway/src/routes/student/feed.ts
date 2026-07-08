import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, schoolScope, roleGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('student'));

// GET /api/v1/student/me — student profile
router.get('/me', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const student_id = (req.user as any).student_id;
    const section_id = (req.user as any).section_id;
    if (!student_id) return res.status(400).json({ error: 'Invalid token' });

    const result = await pool.query(
      `SELECT s.name, c.name as class_name, sec.label as section_label
       FROM students s
       JOIN classes c ON c.id = s.class_id
       JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = $1 AND s.school_id = $2`,
      [student_id, school_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found' });

    // Verify portal still enabled
    const configRow = await pool.query(
      `SELECT spc.enabled FROM student_portal_config spc
       JOIN students s ON s.class_id = spc.class_id
       WHERE s.id = $1 AND spc.school_id = $2`,
      [student_id, school_id]
    );
    if (!configRow.rows[0]?.enabled) {
      return res.status(403).json({ error: 'Access to the student portal has been disabled for your class.' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

function addSchoolDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().split('T')[0];
}

// GET /api/v1/student/feed?date=YYYY-MM-DD
router.get('/feed', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const student_id = (req.user as any).student_id;
    const section_id = (req.user as any).section_id;
    if (!student_id || !section_id) return res.status(400).json({ error: 'Invalid token' });

    const today = await getToday(school_id);
    const requestedDate = (req.query.date as string) || today;

    // Enforce max 5 school days ahead
    const maxDate = addSchoolDays(today, 5);
    if (requestedDate > maxDate) {
      return res.json({ date: requestedDate, blocked: true, message: 'Topics for this date are not yet available.' });
    }

    // Get completion for the date
    const compRow = await pool.query(
      'SELECT covered_chunk_ids FROM daily_completions WHERE section_id = $1 AND completion_date = $2',
      [section_id, requestedDate]
    );

    let topics: any[] = [];
    if (compRow.rows.length > 0 && compRow.rows[0].covered_chunk_ids?.length > 0) {
      const chunks = await pool.query(
        `SELECT cc.id, cc.topic_label, cc.content, cd.title as doc_title
         FROM curriculum_chunks cc
         JOIN curriculum_documents cd ON cd.id = cc.document_id
         WHERE cc.id = ANY($1::uuid[]) ORDER BY cc.chunk_index`,
        [compRow.rows[0].covered_chunk_ids]
      );
      topics = chunks.rows;
    }

    // Homework for the date
    const hwRow = await pool.query(
      'SELECT raw_text, formatted_text, homework_date FROM teacher_homework WHERE section_id = $1 AND homework_date = $2',
      [section_id, requestedDate]
    );

    // Notes for the date
    const notesRow = await pool.query(
      `SELECT id, note_text, file_name, file_size, expires_at
       FROM teacher_notes WHERE section_id = $1 AND note_date = $2 AND expires_at > now()
       ORDER BY created_at DESC`,
      [section_id, requestedDate]
    );

    // Student's homework submission status for this date
    const submissionRow = await pool.query(
      'SELECT status, teacher_note FROM homework_submissions WHERE student_id = $1 AND homework_date = $2',
      [student_id, requestedDate]
    );

    return res.json({
      date: requestedDate,
      topics,
      homework: hwRow.rows[0] || null,
      homework_status: submissionRow.rows[0] || null,
      notes: notesRow.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/student/feed/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/feed/summary', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const section_id = (req.user as any).section_id;
    if (!section_id) return res.status(400).json({ error: 'Invalid token' });

    const today = await getToday(school_id);
    const from = (req.query.from as string) || today.slice(0, 8) + '01'; // start of month
    const to = (req.query.to as string) || today;

    const completions = await pool.query(
      `SELECT dc.completion_date, dc.covered_chunk_ids
       FROM daily_completions dc
       WHERE dc.section_id = $1 AND dc.completion_date >= $2 AND dc.completion_date <= $3
       ORDER BY dc.completion_date`,
      [section_id, from, to]
    );

    const allChunkIds: string[] = [];
    for (const c of completions.rows) {
      if (c.covered_chunk_ids) allChunkIds.push(...c.covered_chunk_ids);
    }
    const unique = [...new Set(allChunkIds)];

    let chunks: any[] = [];
    if (unique.length > 0) {
      const r = await pool.query(
        `SELECT cc.id, cc.topic_label, cc.content, cd.title as doc_title
         FROM curriculum_chunks cc
         JOIN curriculum_documents cd ON cd.id = cc.document_id
         WHERE cc.id = ANY($1::uuid[]) ORDER BY cc.chunk_index`,
        [unique]
      );
      chunks = r.rows;
    }

    return res.json({
      from, to,
      total_days: completions.rows.length,
      total_topics: unique.length,
      topics: chunks,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/student/homework/history
router.get('/homework/history', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const student_id = (req.user as any).student_id;
    const section_id = (req.user as any).section_id;
    if (!student_id || !section_id) return res.status(400).json({ error: 'Invalid token' });

    const result = await pool.query(
      `SELECT th.homework_date, th.formatted_text as homework_text, th.raw_text,
              hs.status as submission_status, hs.teacher_note
       FROM teacher_homework th
       LEFT JOIN homework_submissions hs ON hs.student_id = $1 AND hs.homework_date = th.homework_date
       WHERE th.section_id = $2 AND th.homework_date >= (CURRENT_DATE - INTERVAL '30 days')
       ORDER BY th.homework_date DESC`,
      [student_id, section_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

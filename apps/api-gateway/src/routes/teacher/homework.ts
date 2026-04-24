/**
 * Teacher per-chunk homework routes (Topic Homework Generation spec)
 *
 * POST /api/v1/teacher/homework/generate        — AI draft for a chunk (Req 2)
 * GET  /api/v1/teacher/homework/chunk/:chunkId  — existing record for today (Req 1.2)
 * POST /api/v1/teacher/homework/submit          — format, save, deliver (Req 3–5)
 * PUT  /api/v1/teacher/homework/:id             — edit + resend (Req 7)
 * GET  /api/v1/teacher/homework/today           — all chunk homework for today (Req 6.5)
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher'));

const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

async function resolveSection(userId: string, schoolId: string, sectionId?: string): Promise<string | null> {
  const sections = await getTeacherSections(userId, schoolId);
  if (!sections.length) return null;
  if (sectionId) return sections.find(s => s.section_id === sectionId)?.section_id ?? null;
  return sections[0].section_id;
}

// ── POST /generate — AI draft for a topic chunk (Req 2) ──────────────────────
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { chunk_id, topic_label, content, section_id: reqSectionId } = req.body;
    if (!chunk_id || !topic_label) {
      return res.status(400).json({ error: 'chunk_id and topic_label are required' });
    }

    // Get class name for context
    const sectionId = await resolveSection(req.user!.user_id, school_id, reqSectionId);
    let className = 'Nursery';
    if (sectionId) {
      const cls = await pool.query(
        `SELECT c.name FROM sections s JOIN classes c ON c.id = s.class_id WHERE s.id = $1`,
        [sectionId]
      );
      if (cls.rows[0]) className = cls.rows[0].name;
    }

    try {
      const aiResp = await axios.post(`${AI()}/internal/generate-topic-homework`, {
        topic_label, content: content || '', class_name: className, school_id, section_id: sectionId || '',
      }, { timeout: 16000 });
      return res.json({ draft_text: aiResp.data.draft_text });
    } catch (err: any) {
      if (err.response?.status === 504 || err.code === 'ECONNABORTED') {
        return res.status(504).json({ error: 'AI generation timed out. Please retry.' });
      }
      // Fallback draft
      return res.json({ draft_text: `Practice ${topic_label} at home for 10 minutes.` });
    }
  } catch (err) {
    console.error('[homework/generate]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /today — all chunk homework records for today (Req 6.5) ───────────────
router.get('/today', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const sectionId = await resolveSection(user_id, school_id, req.query.section_id as string);
    if (!sectionId) return res.json([]);

    const result = await pool.query(
      `SELECT id, chunk_id, topic_label, raw_text, formatted_text, teacher_comments, homework_date, updated_at
       FROM teacher_homework
       WHERE section_id = $1 AND homework_date = $2 AND chunk_id IS NOT NULL
       ORDER BY updated_at DESC`,
      [sectionId, today]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /chunk/:chunkId — existing record for today (Req 1.2) ─────────────────
router.get('/chunk/:chunkId', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const sectionId = await resolveSection(user_id, school_id, req.query.section_id as string);
    if (!sectionId) return res.status(404).json(null);

    const result = await pool.query(
      `SELECT id, chunk_id, topic_label, raw_text, formatted_text, teacher_comments, homework_date
       FROM teacher_homework
       WHERE section_id = $1 AND chunk_id = $2 AND homework_date = $3`,
      [sectionId, req.params.chunkId, today]
    );
    return res.json(result.rows[0] || null);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /submit — format, save, deliver to parents (Req 3–5) ─────────────────
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const { chunk_id, topic_label, raw_text, teacher_comments, section_id: reqSectionId } = req.body;

    // Req 3.5 — non-empty validation
    if (!raw_text?.trim()) return res.status(400).json({ error: 'Homework text cannot be empty' });
    if (!chunk_id) return res.status(400).json({ error: 'chunk_id is required' });

    const sectionId = await resolveSection(user_id, school_id, reqSectionId);
    if (!sectionId) return res.status(404).json({ error: 'No section assigned' });

    // Req 4.1–4.3 — AI format
    let formattedText = raw_text.trim();
    let formattingSkipped = false;
    try {
      const aiResp = await axios.post(`${AI()}/internal/format-homework`, {
        raw_text: raw_text.trim(),
        school_id, section_id: sectionId,
      }, { timeout: 15000 });
      if (aiResp.data?.formatted_text) formattedText = aiResp.data.formatted_text;
    } catch {
      formattingSkipped = true; // Req 4.6 — fall back to raw text
    }

    // Req 4.5 — save homework record
    const hwResult = await pool.query(
      `INSERT INTO teacher_homework
         (school_id, section_id, teacher_id, homework_date, chunk_id, topic_label, raw_text, formatted_text, teacher_comments)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT ON CONSTRAINT teacher_homework_chunk_date_unique DO UPDATE
       SET raw_text = EXCLUDED.raw_text,
           formatted_text = EXCLUDED.formatted_text,
           teacher_comments = EXCLUDED.teacher_comments,
           updated_at = now()
       RETURNING id`,
      [school_id, sectionId, user_id, today, chunk_id, topic_label || null,
       raw_text.trim(), formattedText, teacher_comments?.trim() || null]
    );
    const homeworkId = hwResult.rows[0].id;

    // Save history snapshot
    await pool.query(
      `INSERT INTO homework_history (homework_id, school_id, raw_text, formatted_text, teacher_comments, saved_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [homeworkId, school_id, raw_text.trim(), formattedText, teacher_comments?.trim() || null, user_id]
    );

    // Req 5.1–5.3 — deliver to unique parents in section
    const parents = await pool.query(
      `SELECT DISTINCT psl.parent_id
       FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE s.section_id = $1`,
      [sectionId]
    );

    const messageBody = teacher_comments?.trim()
      ? `${formattedText}\n\n📝 Teacher's note: ${teacher_comments.trim()}`
      : formattedText;

    const failedParents: string[] = [];
    let parentsNotified = 0;

    for (const row of parents.rows) {
      try {
        await pool.query(
          `INSERT INTO messages (school_id, sender_id, sender_role, recipient_id, recipient_role, body, metadata)
           VALUES ($1,$2,'teacher',$3,'parent',$4,$5)`,
          [school_id, user_id, row.parent_id, messageBody,
           JSON.stringify({ type: 'homework', chunk_id, topic_label, homework_date: today })]
        );
        parentsNotified++;
      } catch {
        failedParents.push(row.parent_id);
      }
    }

    return res.status(201).json({
      homework_record: { id: homeworkId, chunk_id, topic_label, raw_text: raw_text.trim(), formatted_text: formattedText },
      parents_notified: parentsNotified,
      failed_parents: failedParents,
      formatting_skipped: formattingSkipped,
    });
  } catch (err) {
    console.error('[homework/submit]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /:id — edit + re-format + re-deliver (Req 7) ─────────────────────────
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { raw_text, teacher_comments } = req.body;

    if (!raw_text?.trim()) return res.status(400).json({ error: 'Homework text cannot be empty' });

    // Fetch existing record
    const existing = await pool.query(
      `SELECT id, section_id, chunk_id, topic_label, raw_text, formatted_text, teacher_comments
       FROM teacher_homework WHERE id = $1 AND school_id = $2 AND teacher_id = $3`,
      [req.params.id, school_id, user_id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Homework record not found' });
    const hw = existing.rows[0];

    // Req 7.4 — snapshot current state to history before updating
    await pool.query(
      `INSERT INTO homework_history (homework_id, school_id, raw_text, formatted_text, teacher_comments, saved_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [hw.id, school_id, hw.raw_text, hw.formatted_text, hw.teacher_comments, user_id]
    );

    // Re-format
    let formattedText = raw_text.trim();
    let formattingSkipped = false;
    try {
      const aiResp = await axios.post(`${AI()}/internal/format-homework`, {
        raw_text: raw_text.trim(), school_id, section_id: hw.section_id,
      }, { timeout: 15000 });
      if (aiResp.data?.formatted_text) formattedText = aiResp.data.formatted_text;
    } catch { formattingSkipped = true; }

    // Update record
    await pool.query(
      `UPDATE teacher_homework
       SET raw_text = $1, formatted_text = $2, teacher_comments = $3, updated_at = now()
       WHERE id = $4`,
      [raw_text.trim(), formattedText, teacher_comments?.trim() || null, hw.id]
    );

    // Req 7.3 — updated message with marker
    const messageBody = `📝 Updated Homework:\n\n${formattedText}${teacher_comments?.trim() ? `\n\n📝 Teacher's note: ${teacher_comments.trim()}` : ''}`;

    const parents = await pool.query(
      `SELECT DISTINCT psl.parent_id
       FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE s.section_id = $1`,
      [hw.section_id]
    );

    const failedParents: string[] = [];
    let parentsNotified = 0;
    for (const row of parents.rows) {
      try {
        await pool.query(
          `INSERT INTO messages (school_id, sender_id, sender_role, recipient_id, recipient_role, body, metadata)
           VALUES ($1,$2,'teacher',$3,'parent',$4,$5)`,
          [school_id, user_id, row.parent_id, messageBody,
           JSON.stringify({ type: 'homework_update', chunk_id: hw.chunk_id, topic_label: hw.topic_label })]
        );
        parentsNotified++;
      } catch { failedParents.push(row.parent_id); }
    }

    return res.json({
      homework_record: { id: hw.id, chunk_id: hw.chunk_id, topic_label: hw.topic_label, raw_text: raw_text.trim(), formatted_text: formattedText },
      parents_notified: parentsNotified,
      failed_parents: failedParents,
      formatting_skipped: formattingSkipped,
    });
  } catch (err) {
    console.error('[homework/put]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

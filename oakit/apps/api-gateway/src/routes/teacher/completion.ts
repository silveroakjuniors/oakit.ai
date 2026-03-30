import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher'));

async function resolveSection(
  sections: { section_id: string }[],
  querySectionId?: string
): Promise<{ section_id: string } | { error: string; status: number }> {
  if (sections.length === 0) return { error: 'No section assigned', status: 404 };
  if (sections.length === 1) return { section_id: sections[0].section_id };
  if (!querySectionId) return { error: 'section_id required — you are assigned to multiple sections', status: 400 };
  const found = sections.find(s => s.section_id === querySectionId);
  if (!found) return { error: 'Not authorized for this section', status: 403 };
  return { section_id: found.section_id };
}

// POST /api/v1/teacher/completion
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);

    const { covered_chunk_ids, completion_date, settling_day_note } = req.body;
    const date = completion_date || today;

    // Reject future dates — can only mark completion for today or past days
    if (date > today) {
      return res.status(400).json({ error: 'Cannot mark completion for a future date' });
    }

    // Reject dates more than 7 days in the past
    const dateDiff = (new Date(today).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
    if (dateDiff > 7) {
      return res.status(400).json({ error: 'Cannot mark completion for dates more than 7 days in the past. Please contact your admin.' });
    }

    if (!Array.isArray(covered_chunk_ids)) {
      return res.status(400).json({ error: 'covered_chunk_ids array is required' });
    }

    // Resolve section — if section_id provided, verify ownership directly
    let section_id: string | null = null;
    if (req.body.section_id) {
      // Verify teacher has access to this section (class teacher or supporting)
      const check = await pool.query(
        `SELECT s.id FROM sections s
         LEFT JOIN teacher_sections ts ON ts.section_id = s.id AND ts.teacher_id = $1
         WHERE s.id = $2 AND s.school_id = $3
           AND (s.class_teacher_id = $1 OR ts.teacher_id = $1)`,
        [user_id, req.body.section_id, school_id]
      );
      if (check.rows.length === 0) return res.status(403).json({ error: 'Not authorized for this section' });
      section_id = req.body.section_id;
    } else {
      // Auto-resolve from teacher's sections
      const sections = await getTeacherSections(user_id, school_id);
      const resolved = await resolveSection(sections, undefined);
      if ('error' in resolved) return res.status(resolved.status).json({ error: resolved.error });
      section_id = resolved.section_id;
    }

    const result = await pool.query(
      `INSERT INTO daily_completions (school_id, section_id, teacher_id, completion_date, covered_chunk_ids, settling_day_note)
       VALUES ($1, $2, $3, $4, $5::uuid[], $6)
       ON CONFLICT (section_id, completion_date) DO UPDATE
       SET covered_chunk_ids = EXCLUDED.covered_chunk_ids, settling_day_note = EXCLUDED.settling_day_note, edited_at = now()
       RETURNING *`,
      [school_id, section_id, user_id, date, covered_chunk_ids, settling_day_note || null]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/teacher/completion/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { covered_chunk_ids } = req.body;
    if (!Array.isArray(covered_chunk_ids)) {
      return res.status(400).json({ error: 'covered_chunk_ids array is required' });
    }

    const existing = await pool.query(
      'SELECT id, submitted_at, teacher_id FROM daily_completions WHERE id = $1 AND school_id = $2',
      [req.params.id, school_id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Completion not found' });

    const rec = existing.rows[0];
    if (rec.teacher_id !== user_id) return res.status(403).json({ error: 'Not your completion' });

    const submittedAt = new Date(rec.submitted_at);
    const now = new Date();
    const diffHours = (now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60);
    if (diffHours > 24) {
      return res.status(403).json({ error: 'Edit window has closed' });
    }

    const result = await pool.query(
      'UPDATE daily_completions SET covered_chunk_ids = $1::uuid[], edited_at = now() WHERE id = $2 RETURNING *',
      [covered_chunk_ids, req.params.id]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/completion/pending
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);

    const sections = await getTeacherSections(user_id, school_id);
    const resolved = await resolveSection(sections, req.query.section_id as string | undefined);
    if ('error' in resolved) return res.status(resolved.status).json({ error: resolved.error });
    const { section_id } = resolved;

    // Get all past day plans
    const plans = await pool.query(
      `SELECT dp.id, dp.plan_date, dp.chunk_ids
       FROM day_plans dp
       WHERE dp.section_id = $1 AND dp.plan_date < $2
       ORDER BY dp.plan_date ASC`,
      [section_id, today]
    );

    // Get all completed chunk IDs for this section
    const completions = await pool.query(
      'SELECT covered_chunk_ids FROM daily_completions WHERE section_id = $1',
      [section_id]
    );
    const coveredIds = new Set<string>(
      completions.rows.flatMap((r: any) => r.covered_chunk_ids || [])
    );

    const pending = [];
    for (const plan of plans.rows) {
      const uncovered = (plan.chunk_ids || []).filter((id: string) => !coveredIds.has(id));
      if (uncovered.length === 0) continue;

      const chunks = await pool.query(
        'SELECT id, topic_label, content FROM curriculum_chunks WHERE id = ANY($1::uuid[]) ORDER BY chunk_index',
        [uncovered]
      );
      pending.push({
        plan_date: plan.plan_date,
        chunks: chunks.rows,
      });
    }

    return res.json(pending);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

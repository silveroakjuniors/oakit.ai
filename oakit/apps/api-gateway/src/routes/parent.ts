import { Router, Request, Response } from 'express';
import { pool } from '../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

// GET /api/v1/parent/absences
router.get('/absences', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    // Get linked students
    const links = await pool.query(
      `SELECT psl.student_id, s.name as student_name
       FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1`,
      [user_id]
    );

    const absences = [];
    for (const link of links.rows) {
      const absenceRows = await pool.query(
        `SELECT ar.attend_date, ar.status
         FROM attendance_records ar
         WHERE ar.student_id = $1 AND ar.status = 'absent'
         ORDER BY ar.attend_date DESC`,
        [link.student_id]
      );

      for (const absence of absenceRows.rows) {
        // Get covered chunks for that date in the student's section
        const sectionRow = await pool.query(
          'SELECT section_id FROM students WHERE id = $1',
          [link.student_id]
        );
        const section_id = sectionRow.rows[0]?.section_id;

        let covered_chunks: any[] = [];
        if (section_id) {
          const completion = await pool.query(
            'SELECT covered_chunk_ids FROM daily_completions WHERE section_id = $1 AND completion_date = $2',
            [section_id, absence.attend_date]
          );
          if (completion.rows.length > 0 && completion.rows[0].covered_chunk_ids?.length > 0) {
            const chunks = await pool.query(
              'SELECT id, topic_label FROM curriculum_chunks WHERE id = ANY($1::uuid[])',
              [completion.rows[0].covered_chunk_ids]
            );
            covered_chunks = chunks.rows;
          }
        }

        absences.push({
          student_id: link.student_id,
          student_name: link.student_name,
          date: absence.attend_date,
          covered_chunks,
        });
      }
    }

    return res.json(absences);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/parent/missed-topics/:id/done
router.post('/missed-topics/:id/done', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;
    const result = await pool.query(
      `UPDATE missed_topic_tasks SET is_done = true, done_at = now()
       WHERE id = $1 AND parent_id = $2
       RETURNING *`,
      [req.params.id, user_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/missed-topics/completed
router.get('/missed-topics/completed', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;
    const result = await pool.query(
      `SELECT mtt.*, cc.topic_label, s.name as student_name
       FROM missed_topic_tasks mtt
       JOIN curriculum_chunks cc ON cc.id = mtt.chunk_id
       JOIN students s ON s.id = mtt.student_id
       WHERE mtt.parent_id = $1 AND mtt.is_done = true
       ORDER BY mtt.done_at DESC`,
      [user_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

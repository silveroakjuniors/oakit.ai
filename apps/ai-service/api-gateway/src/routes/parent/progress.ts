import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

// GET / — curriculum progress for linked children (current academic year)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    // Get current academic year date range
    const calRow = await pool.query(
      `SELECT start_date, end_date, academic_year
       FROM school_calendar
       WHERE school_id = $1 AND now()::date BETWEEN start_date AND end_date
       LIMIT 1`,
      [school_id]
    );
    const yearStart = calRow.rows[0]?.start_date ?? null;
    const yearEnd = calRow.rows[0]?.end_date ?? null;

    // Get linked children with their sections
    const links = await pool.query(
      `SELECT psl.student_id, st.name AS student_name, st.section_id
       FROM parent_student_links psl
       JOIN students st ON st.id = psl.student_id
       WHERE psl.parent_id = $1`,
      [user_id]
    );

    const result = [];
    for (const link of links.rows) {
      const { student_id, student_name, section_id } = link;

      // Total chunks in curriculum for this section's class
      const totalRow = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM curriculum_chunks cc
         JOIN curriculum_documents cd ON cd.id = cc.document_id
         JOIN sections sec ON sec.class_id = cd.class_id
         WHERE sec.id = $1 AND cd.school_id = $2`,
        [section_id, school_id]
      );
      const total_chunks = totalRow.rows[0].total;

      if (total_chunks === 0) {
        result.push({ student_id, student_name, section_id, coverage_pct: 0, has_curriculum: false });
        continue;
      }

      // Covered chunks within current academic year
      const coveredRow = await pool.query(
        `SELECT COUNT(DISTINCT chunk_id)::int AS covered
         FROM (
           SELECT unnest(covered_chunk_ids) AS chunk_id
           FROM daily_completions
           WHERE section_id = $1
             AND ($2::date IS NULL OR completion_date >= $2::date)
             AND ($3::date IS NULL OR completion_date <= $3::date)
         ) sub`,
        [section_id, yearStart, yearEnd]
      );
      const covered = coveredRow.rows[0].covered;
      const coverage_pct = Math.round((covered / total_chunks) * 100 * 10) / 10;

      result.push({ student_id, student_name, section_id, coverage_pct, has_curriculum: true, total_chunks, covered });
    }

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

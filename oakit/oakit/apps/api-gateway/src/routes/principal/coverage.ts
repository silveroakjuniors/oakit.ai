import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('principal', 'admin'));

// GET / — curriculum coverage report for all sections
router.get('/', async (req: Request, res: Response) => {
  try {
    const school_id = req.user!.school_id;

    const result = await pool.query(
      `SELECT
         s.id                                                          AS section_id,
         s.name                                                        AS section_name,
         s.flagged,
         s.flag_note,
         COUNT(DISTINCT cc.id)::int                                    AS total_chunks,
         COUNT(DISTINCT dc_chunks.chunk_id)::int                       AS covered_chunks,
         CASE
           WHEN COUNT(DISTINCT cc.id) = 0 THEN 0
           ELSE ROUND(
             COUNT(DISTINCT dc_chunks.chunk_id)::numeric /
             COUNT(DISTINCT cc.id)::numeric * 100, 1
           )
         END                                                           AS coverage_pct,
         CASE WHEN COUNT(DISTINCT cc.id) = 0 THEN false ELSE true END AS has_curriculum,
         MAX(dc.completion_date)                                       AS last_completion_date
       FROM sections s
       LEFT JOIN curriculum_chunks cc ON cc.section_id = s.id
       LEFT JOIN daily_completions dc ON dc.section_id = s.id
       LEFT JOIN LATERAL (
         SELECT unnest(dc2.covered_chunk_ids) AS chunk_id
         FROM daily_completions dc2
         WHERE dc2.section_id = s.id
       ) dc_chunks ON true
       WHERE s.school_id = $1 AND s.is_active = true
       GROUP BY s.id, s.name, s.flagged, s.flag_note
       ORDER BY s.name`,
      [school_id]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

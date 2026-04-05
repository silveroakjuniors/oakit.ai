import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { redis } from '../../lib/redis';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'));

function coverageBand(pct: number): 'green' | 'amber' | 'red' {
  if (pct >= 75) return 'green';
  if (pct >= 40) return 'amber';
  return 'red';
}

// GET /api/v1/admin/dashboard/coverage
router.get('/coverage', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT
         sec.id as section_id, sec.label as section_label,
         c.name as class_name,
         COUNT(DISTINCT cc.id)::int as total_chunks,
         COUNT(DISTINCT dc_chunks.chunk_id)::int as covered_chunks
       FROM sections sec
       JOIN classes c ON c.id = sec.class_id
       LEFT JOIN curriculum_documents cd ON cd.class_id = sec.class_id AND cd.school_id = $1
       LEFT JOIN curriculum_chunks cc ON cc.document_id = cd.id
       LEFT JOIN (
         SELECT unnest(covered_chunk_ids) as chunk_id, section_id
         FROM daily_completions WHERE school_id = $1
       ) dc_chunks ON dc_chunks.chunk_id = cc.id AND dc_chunks.section_id = sec.id
       WHERE sec.school_id = $1
       GROUP BY sec.id, sec.label, c.name, c.id
       ORDER BY c.name, sec.label`,
      [school_id]
    );
    const rows = result.rows.map((r: any) => {
      const pct = r.total_chunks > 0 ? Math.round((r.covered_chunks / r.total_chunks) * 100) : 0;
      return { ...r, coverage_pct: pct, band: coverageBand(pct), alert: pct < 40 && r.total_chunks > 0 };
    });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/dashboard/coverage/:sectionId — drill-down: covered topics
router.get('/coverage/:sectionId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { sectionId } = req.params;

    // Section info
    const secRow = await pool.query(
      `SELECT sec.label, c.name as class_name, u.name as teacher_name
       FROM sections sec
       JOIN classes c ON c.id = sec.class_id
       LEFT JOIN users u ON u.id = sec.class_teacher_id
       WHERE sec.id = $1 AND sec.school_id = $2`,
      [sectionId, school_id]
    );
    if (secRow.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
    const sec = secRow.rows[0];

    // All chunks for this section's class, with covered status
    const chunksRow = await pool.query(
      `SELECT
         cc.id, cc.topic_label, cc.page_start,
         cd.filename as doc_title,
         CASE WHEN dc.chunk_id IS NOT NULL THEN true ELSE false END as covered,
         dc.completion_date
       FROM curriculum_documents cd
       JOIN curriculum_chunks cc ON cc.document_id = cd.id
       LEFT JOIN (
         SELECT u.chunk_id, MAX(dc2.completion_date)::text as completion_date
         FROM daily_completions dc2,
              unnest(dc2.covered_chunk_ids) AS u(chunk_id)
         WHERE dc2.section_id = $1 AND dc2.school_id = $2
         GROUP BY u.chunk_id
       ) dc ON dc.chunk_id = cc.id
       WHERE cd.class_id = (SELECT class_id FROM sections WHERE id = $1)
         AND cd.school_id = $2
         AND cd.status = 'ready'
       ORDER BY cd.filename, cc.page_start`,
      [sectionId, school_id]
    );

    const chunks = chunksRow.rows;
    const total = chunks.length;
    const covered = chunks.filter((c: any) => c.covered).length;

    // Group by document
    const byDoc: Record<string, any[]> = {};
    for (const c of chunks) {
      if (!byDoc[c.doc_title]) byDoc[c.doc_title] = [];
      byDoc[c.doc_title].push(c);
    }

    return res.json({
      section_label: sec.label,
      class_name: sec.class_name,
      teacher_name: sec.teacher_name,
      total_chunks: total,
      covered_chunks: covered,
      coverage_pct: total > 0 ? Math.round((covered / total) * 100) : 0,
      documents: Object.entries(byDoc).map(([title, topics]) => ({
        title,
        total: topics.length,
        covered: topics.filter((t: any) => t.covered).length,
        topics: topics.map((t: any) => ({
          id: t.id,
          label: t.topic_label || `Page ${t.page_start}`,
          covered: t.covered,
          completion_date: t.completion_date,
        })),
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/attendance-trend', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const today = await getToday(school_id);
    const result = await pool.query(
      `SELECT
         attend_date::text as date,
         COUNT(*) FILTER (WHERE status = 'present') as present,
         COUNT(*) FILTER (WHERE status = 'absent') as absent,
         COUNT(*) FILTER (WHERE is_late = true) as late
       FROM attendance_records
       WHERE school_id = $1 AND attend_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date
       GROUP BY attend_date ORDER BY attend_date ASC`,
      [school_id, today]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/dashboard/today
router.get('/today', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const cacheKey = `dashboard:today:${school_id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const today = await getToday(school_id);
    const [studentsPresent, attSections, planSections, totalSections] = await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT student_id)::int as count FROM attendance_records WHERE school_id = $1 AND attend_date = $2 AND status = 'present'`, [school_id, today]),
      pool.query(`SELECT COUNT(DISTINCT section_id)::int as count FROM attendance_records WHERE school_id = $1 AND attend_date = $2`, [school_id, today]),
      pool.query(`SELECT COUNT(DISTINCT section_id)::int as count FROM daily_completions WHERE school_id = $1 AND completion_date = $2`, [school_id, today]),
      pool.query(`SELECT COUNT(*)::int as count FROM sections WHERE school_id = $1`, [school_id]),
    ]);

    const data = {
      students_present: studentsPresent.rows[0].count,
      sections_attendance_submitted: attSections.rows[0].count,
      sections_plans_completed: planSections.rows[0].count,
      total_sections: totalSections.rows[0].count,
      date: today,
    };
    await redis.setEx(cacheKey, 60, JSON.stringify(data));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('teacher'));

const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

// POST /api/v1/teacher/coverage
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { log_text, section_id } = req.body;
    if (!log_text || !section_id) {
      return res.status(400).json({ error: 'log_text and section_id are required' });
    }
    const today = new Date().toISOString().split('T')[0];

    const logResult = await pool.query(
      `INSERT INTO coverage_logs (school_id, section_id, teacher_id, log_date, log_text)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [school_id, section_id, user_id, today, log_text]
    );
    const coverage_log_id = logResult.rows[0].id;

    // Trigger coverage analysis
    let analysisResults: unknown[] = [];
    try {
      const aiResp = await axios.post(`${AI()}/internal/analyze-coverage`, {
        coverage_log_id, log_text, section_id, log_date: today,
      }, { timeout: 30000 });
      analysisResults = aiResp.data.results || [];
    } catch (aiErr) {
      console.error('Coverage analysis failed:', aiErr);
    }

    return res.status(201).json({ coverage_log_id, results: analysisResults });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'Coverage log already submitted for today' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/teacher/coverage/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { log_text } = req.body;
    if (!log_text) return res.status(400).json({ error: 'log_text is required' });

    // Check 24h edit window
    const existing = await pool.query(
      'SELECT id, submitted_at, section_id, log_date FROM coverage_logs WHERE id = $1 AND teacher_id = $2 AND school_id = $3',
      [req.params.id, user_id, school_id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Log not found' });

    const submitted = new Date(existing.rows[0].submitted_at);
    const hoursSince = (Date.now() - submitted.getTime()) / 3600000;
    if (hoursSince > 24) return res.status(403).json({ error: 'Edit window has expired (24 hours)' });

    await pool.query(
      'UPDATE coverage_logs SET log_text = $1, edited_at = now() WHERE id = $2',
      [log_text, req.params.id]
    );

    // Re-run analysis
    try {
      await axios.post(`${AI()}/internal/analyze-coverage`, {
        coverage_log_id: req.params.id,
        log_text,
        section_id: existing.rows[0].section_id,
        log_date: existing.rows[0].log_date,
      }, { timeout: 30000 });
    } catch (aiErr) {
      console.error('Re-analysis failed:', aiErr);
    }

    return res.json({ message: 'Coverage log updated' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/coverage/history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT cl.id, cl.log_date, cl.log_text, cl.flagged, cl.submitted_at, cl.edited_at,
              s.label as section_label, c.name as class_name,
              json_agg(json_build_object('chunk_id', cs.chunk_id, 'status', cs.status, 'score', cs.similarity_score)) as coverage
       FROM coverage_logs cl
       JOIN sections s ON cl.section_id = s.id
       JOIN classes c ON s.class_id = c.id
       LEFT JOIN coverage_statuses cs ON cs.coverage_log_id = cl.id
       WHERE cl.teacher_id = $1 AND cl.school_id = $2
       GROUP BY cl.id, s.label, c.name
       ORDER BY cl.log_date DESC LIMIT $3 OFFSET $4`,
      [user_id, school_id, limit, offset]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

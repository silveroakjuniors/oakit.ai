import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin'));

const ALL_STEPS = ['school_profile', 'classes_sections', 'staff_accounts', 'curriculum_upload', 'calendar_setup'];

// GET /api/v1/admin/setup/progress
router.get('/progress', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const row = await pool.query('SELECT * FROM setup_wizard_progress WHERE school_id = $1', [school_id]);
    if (row.rows.length === 0) return res.json({ completed_steps: [], last_step: null, completed_at: null });
    return res.json(row.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/setup/progress — mark a step complete
router.post('/progress', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { step } = req.body;
    if (!step || !ALL_STEPS.includes(step)) {
      return res.status(400).json({ error: `Invalid step. Must be one of: ${ALL_STEPS.join(', ')}` });
    }
    const result = await pool.query(
      `INSERT INTO setup_wizard_progress (school_id, completed_steps, last_step, updated_at)
       VALUES ($1, ARRAY[$2::text], $2, now())
       ON CONFLICT (school_id) DO UPDATE
       SET completed_steps = array_append(
         array_remove(setup_wizard_progress.completed_steps, $2::text), $2::text
       ),
       last_step = $2,
       updated_at = now()
       RETURNING *`,
      [school_id, step]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/setup/status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const row = await pool.query('SELECT completed_steps FROM setup_wizard_progress WHERE school_id = $1', [school_id]);
    const completed = row.rows[0]?.completed_steps ?? [];
    const allDone = ALL_STEPS.every(s => completed.includes(s));
    const pending = ALL_STEPS.filter(s => !completed.includes(s));
    return res.json({ complete: allDone, completed_steps: completed, pending_steps: pending, all_steps: ALL_STEPS });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

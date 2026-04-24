/**
 * Teacher supplementary activity override routes (Req 6, 7)
 *
 * POST /api/v1/teacher/supplementary/:plan_id/complete  — mark completed (Req 7.5)
 * POST /api/v1/teacher/supplementary/:plan_id/skip      — skip with note (Req 7.4)
 * POST /api/v1/teacher/supplementary/:plan_id/replace   — replace activity (Req 7.3)
 * POST /api/v1/teacher/supplementary/:plan_id/undo      — undo override (Req 7.7)
 * GET  /api/v1/teacher/supplementary/:plan_id/pool-activities — list pool activities for replace (Req 7.2)
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher'));

// Helper — verify teacher owns the section for this plan
async function verifyTeacherPlan(planId: string, userId: string, schoolId: string) {
  const sections = await getTeacherSections(userId, schoolId);
  const sectionIds = sections.map(s => s.section_id);
  if (!sectionIds.length) return null;

  const result = await pool.query(
    `SELECT sp.id, sp.section_id, sp.activity_id, sp.pool_assignment_id,
            sp.status, sp.plan_date, sp.override_note
     FROM supplementary_plans sp
     WHERE sp.id = $1 AND sp.school_id = $2 AND sp.section_id = ANY($3::uuid[])`,
    [planId, schoolId, sectionIds]
  );
  return result.rows[0] || null;
}

// ── GET /:plan_id/pool-activities — list other activities in same pool (Req 7.2) ─
router.get('/:plan_id/pool-activities', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const plan = await verifyTeacherPlan(req.params.plan_id, user_id, school_id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const result = await pool.query(
      `SELECT a.id, a.title, a.description, a.position
       FROM activities a
       JOIN pool_assignments pa ON pa.id = $1
       WHERE a.activity_pool_id = pa.activity_pool_id
         AND a.id != $2
       ORDER BY a.position, a.created_at`,
      [plan.pool_assignment_id, plan.activity_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /:plan_id/complete — mark completed (Req 7.5) ───────────────────────
router.post('/:plan_id/complete', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const plan = await verifyTeacherPlan(req.params.plan_id, user_id, school_id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const result = await pool.query(
      `UPDATE supplementary_plans
       SET status = 'completed', completed_at = now(), completed_by = $1
       WHERE id = $2
       RETURNING id, status, completed_at`,
      [user_id, plan.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /:plan_id/skip — skip with optional note (Req 7.4, 7.6) ─────────────
router.post('/:plan_id/skip', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { note } = req.body;

    // Req 7.6 — note max 200 chars
    if (note && note.length > 200) {
      return res.status(400).json({ error: 'Skip note must be 200 characters or less' });
    }

    const plan = await verifyTeacherPlan(req.params.plan_id, user_id, school_id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const result = await pool.query(
      `UPDATE supplementary_plans
       SET status = 'skipped', override_note = $1
       WHERE id = $2
       RETURNING id, status, override_note`,
      [note?.trim() || null, plan.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /:plan_id/replace — replace with another activity (Req 7.3) ─────────
router.post('/:plan_id/replace', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { activity_id } = req.body;
    if (!activity_id) return res.status(400).json({ error: 'activity_id is required' });

    const plan = await verifyTeacherPlan(req.params.plan_id, user_id, school_id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    // Verify new activity belongs to same pool
    const actCheck = await pool.query(
      `SELECT a.id FROM activities a
       JOIN pool_assignments pa ON pa.id = $1
       WHERE a.id = $2 AND a.activity_pool_id = pa.activity_pool_id`,
      [plan.pool_assignment_id, activity_id]
    );
    if (!actCheck.rows.length) {
      return res.status(400).json({ error: 'Activity does not belong to the same pool' });
    }

    const result = await pool.query(
      `UPDATE supplementary_plans
       SET activity_id = $1, status = 'replaced', completed_by = $2
       WHERE id = $3
       RETURNING id, activity_id, status`,
      [activity_id, user_id, plan.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /:plan_id/undo — undo override on same day (Req 7.7, 7.8) ───────────
router.post('/:plan_id/undo', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);

    const plan = await verifyTeacherPlan(req.params.plan_id, user_id, school_id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    // Only allow undo on same calendar day
    const planDate = String(plan.plan_date).split('T')[0];
    if (planDate !== today) {
      return res.status(400).json({ error: 'Overrides can only be undone on the same day they were submitted' });
    }

    const result = await pool.query(
      `UPDATE supplementary_plans
       SET status = 'scheduled', override_note = NULL, completed_at = NULL, completed_by = NULL
       WHERE id = $1
       RETURNING id, status`,
      [plan.id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

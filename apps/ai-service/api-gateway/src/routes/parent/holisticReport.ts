/**
 * routes/parent/holisticReport.ts
 * Parent read-only access to shared holistic reports for their child.
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/parent/holistic-report
// List all shared holistic reports for the parent's linked children
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    // Get all children linked to this parent
    const children = await pool.query(
      `SELECT student_id FROM parent_student_links WHERE parent_id=$1`,
      [user_id],
    );
    if (!children.rows.length) return res.json([]);
    const studentIds = children.rows.map((r: any) => r.student_id);

    const result = await pool.query(
      `SELECT hr.id, hr.student_id, hr.term, hr.academic_year,
              hr.shared_at, hr.updated_at,
              s.name AS student_name,
              c.name AS class_name, sec.label AS section_label
       FROM holistic_reports hr
       JOIN students  s   ON s.id   = hr.student_id
       JOIN classes   c   ON c.id   = hr.class_id
       JOIN sections  sec ON sec.id = hr.section_id
       WHERE hr.student_id = ANY($1::uuid[])
         AND hr.school_id = $2
         AND hr.status = 'shared'
       ORDER BY hr.academic_year DESC, hr.shared_at DESC`,
      [studentIds, school_id],
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[parent holistic-report list]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/parent/holistic-report/:id
// View a specific shared report (full details)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    // Verify this report belongs to one of the parent's children
    const children = await pool.query(
      `SELECT student_id FROM parent_student_links WHERE parent_id=$1`,
      [user_id],
    );
    const studentIds = children.rows.map((r: any) => r.student_id);

    const report = await pool.query(
      `SELECT hr.*,
              s.name AS student_name, s.photo_url,
              c.name AS class_name, c.id AS class_id,
              sec.label AS section_label,
              sch.name AS school_name
       FROM holistic_reports hr
       JOIN students  s   ON s.id   = hr.student_id
       JOIN classes   c   ON c.id   = hr.class_id
       JOIN sections  sec ON sec.id = hr.section_id
       JOIN schools   sch ON sch.id = hr.school_id
       WHERE hr.id=$1
         AND hr.school_id=$2
         AND hr.status='shared'
         AND hr.student_id=ANY($3::uuid[])`,
      [req.params.id, school_id, studentIds],
    );

    if (!report.rows.length) return res.status(404).json({ error: 'Report not found' });
    const r = report.rows[0];

    // Also load the template domains so the parent view can show labels
    const templateRow = await pool.query(
      `SELECT domains FROM holistic_report_templates
       WHERE school_id=$1 AND class_id=$2 AND academic_year=$3`,
      [school_id, r.class_id, r.academic_year],
    );
    const domains = templateRow.rows[0]?.domains ?? [];

    return res.json({ ...r, domains });
  } catch (err) {
    console.error('[parent holistic-report get]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

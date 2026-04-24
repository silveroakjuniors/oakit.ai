/**
 * Franchise school management routes (Req 4, 5, 7, 12, 13)
 *
 * POST /api/v1/franchise/schools                        — create school (Req 4)
 * GET  /api/v1/franchise/schools/:id/teaching-days      — teaching days (Req 12)
 * GET  /api/v1/schools/:school_id/franchise-privacy-status — privacy notice (Req 7.3)
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, franchiseScope } from '../../middleware/auth';

const router = Router();

// ── POST /schools — franchise admin creates a new school (Req 4) ──────────────
router.post('/', jwtVerify, forceResetGuard, franchiseScope, async (req: Request, res: Response) => {
  try {
    const franchiseId = (req.user as any).franchise_id;
    const { name, plan_type, contact } = req.body;

    if (!name?.trim() || !plan_type) {
      return res.status(400).json({ error: 'name and plan_type are required' });
    }

    // Req 4.4 — duplicate name check
    const dup = await pool.query('SELECT id FROM schools WHERE name = $1', [name.trim()]);
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: 'School with this name already exists' });
    }

    // Req 4.3 — same slug logic as super_admin
    const subdomain = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const schoolResult = await pool.query(
      `INSERT INTO schools (name, subdomain, plan_type, status, contact, franchise_id, created_by_franchise_admin)
       VALUES ($1, $2, $3, 'active', $4, $5, true)
       RETURNING id, name, subdomain, status, plan_type, created_at`,
      [name.trim(), subdomain, plan_type, contact ? JSON.stringify(contact) : null, franchiseId]
    );

    const schoolId = schoolResult.rows[0].id;

    // Req 4.1 — auto-create franchise_memberships record
    await pool.query(
      `INSERT INTO franchise_memberships (franchise_id, school_id)
       VALUES ($1, $2) ON CONFLICT (school_id) DO NOTHING`,
      [franchiseId, schoolId]
    );

    // Auto-create AI wallet + pricing for new school
    await pool.query(
      'INSERT INTO school_ai_wallet (school_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [schoolId]
    );
    await pool.query(
      'INSERT INTO school_ai_pricing (school_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [schoolId]
    );

    return res.status(201).json(schoolResult.rows[0]);
  } catch (err) {
    console.error('[franchise/schools POST]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /schools/:id/teaching-days — aggregate counts only, no PII (Req 12.8) ─
router.get('/:id/teaching-days', jwtVerify, forceResetGuard, franchiseScope, async (req: Request, res: Response) => {
  try {
    const franchiseId = (req.user as any).franchise_id;

    // Verify school belongs to this franchise
    const membership = await pool.query(
      `SELECT 1 FROM franchise_memberships WHERE franchise_id = $1 AND school_id = $2`,
      [franchiseId, req.params.id]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied: school is not a member of your franchise' });
    }

    // Check if calendar is configured (Req 12.3)
    const calRow = await pool.query(
      `SELECT start_date, end_date FROM school_calendar WHERE school_id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (calRow.rows.length === 0) {
      return res.json({ calendar_configured: false, message: 'Calendar not set' });
    }

    const { start_date, end_date } = calRow.rows[0];

    // Count total working days (Mon–Fri between start and end)
    const workingDaysRow = await pool.query(
      `SELECT COUNT(*)::int AS total_working_days
       FROM generate_series($1::date, $2::date, '1 day'::interval) AS d
       WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5`,
      [start_date, end_date]
    );

    // Count special days by type (aggregate counts only — no names/dates per Req 12.5)
    const specialRow = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE day_type = 'holiday')::int          AS holidays_count,
         COUNT(*) FILTER (WHERE day_type = 'settling')::int         AS settling_days_count,
         COUNT(*) FILTER (WHERE day_type = 'sports')::int           AS sports_days_count,
         COUNT(*) FILTER (WHERE day_type = 'red_day')::int          AS red_days_count,
         COUNT(*) FILTER (WHERE day_type = 'half_day')::int         AS half_days_count,
         COUNT(*) FILTER (WHERE day_type NOT IN
           ('holiday','settling','sports','red_day','half_day'))::int AS other_special_days_count
       FROM special_days
       WHERE school_id = $1 AND day_date BETWEEN $2 AND $3`,
      [req.params.id, start_date, end_date]
    );

    const s = specialRow.rows[0];
    const totalWorking = workingDaysRow.rows[0].total_working_days;
    const fullDayDeductions = s.holidays_count + s.settling_days_count +
      s.sports_days_count + s.red_days_count + s.other_special_days_count;
    const halfDayDeductions = s.half_days_count * 0.5;
    const netTeachingDays = Math.max(0, totalWorking - fullDayDeductions - halfDayDeductions);

    // Get franchise chunk count for curriculum_coverage_fit (Req 13)
    const chunkRow = await pool.query(
      `SELECT COUNT(*)::int AS total_chunks
       FROM curriculum_chunks cc
       JOIN curriculum_documents cd ON cd.id = cc.document_id
       WHERE cd.franchise_id = $1 AND cd.status = 'approved'`,
      [franchiseId]
    );
    const totalChunks = chunkRow.rows[0].total_chunks;

    let curriculum_coverage_fit: 'exact' | 'under' | 'over' | 'unknown' = 'unknown';
    if (totalChunks > 0) {
      if (netTeachingDays === totalChunks) curriculum_coverage_fit = 'exact';
      else if (netTeachingDays > totalChunks) curriculum_coverage_fit = 'under'; // more days than content
      else curriculum_coverage_fit = 'over'; // more content than days
    }

    return res.json({
      calendar_configured: true,
      total_working_days: totalWorking,
      holidays_count: s.holidays_count,
      settling_days_count: s.settling_days_count,
      sports_days_count: s.sports_days_count,
      red_days_count: s.red_days_count,
      half_days_count: s.half_days_count,
      other_special_days_count: s.other_special_days_count,
      net_teaching_days: netTeachingDays,
      total_franchise_chunks: totalChunks,
      chunks_per_day: totalChunks > 0 && netTeachingDays > 0
        ? Math.round((totalChunks / netTeachingDays) * 100) / 100
        : null,
      curriculum_coverage_fit,
    });
  } catch (err) {
    console.error('[franchise/schools/:id/teaching-days]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

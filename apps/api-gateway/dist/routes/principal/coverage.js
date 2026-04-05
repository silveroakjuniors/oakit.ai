"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const today_1 = require("../../lib/today");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.schoolScope, (0, auth_1.roleGuard)('principal', 'admin'));
// GET / — curriculum coverage report for all sections
router.get('/', async (req, res) => {
    try {
        const school_id = req.user.school_id;
        const today = await (0, today_1.getToday)(school_id);
        // Get start of current week (Monday)
        const todayDate = new Date(today + 'T12:00:00');
        const dow = todayDate.getDay(); // 0=Sun
        const diffToMon = dow === 0 ? -6 : 1 - dow;
        const weekStart = new Date(todayDate);
        weekStart.setDate(todayDate.getDate() + diffToMon);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEndStr = weekEnd.toISOString().split('T')[0];
        const result = await db_1.pool.query(`SELECT
         s.id                                                           AS section_id,
         s.label                                                        AS section_label,
         c.name                                                         AS class_name,
         -- class teacher
         ct.name                                                        AS class_teacher_name,
         -- curriculum coverage
         COUNT(DISTINCT cc.id)::int                                     AS total_chunks,
         COUNT(DISTINCT dc_chunks.chunk_id)::int                        AS covered_chunks,
         CASE
           WHEN COUNT(DISTINCT cc.id) = 0 THEN 0
           ELSE ROUND(
             COUNT(DISTINCT dc_chunks.chunk_id)::numeric /
             COUNT(DISTINCT cc.id)::numeric * 100, 1
           )
         END                                                            AS coverage_pct,
         CASE WHEN COUNT(DISTINCT cc.id) = 0 THEN false ELSE true END  AS has_curriculum,
         MAX(dc.completion_date)                                        AS last_completion_date,
         -- this week: count of day plans
         COUNT(DISTINCT dp_week.id)::int                                AS plans_this_week,
         -- this week: special days
         COUNT(DISTINCT sd_week.id)::int                                AS special_days_this_week,
         -- flagging (only if migration 019 applied)
         COALESCE(s.flagged, false)                                     AS flagged,
         s.flag_note
       FROM sections s
       JOIN classes c ON c.id = s.class_id
       -- class teacher
       LEFT JOIN users ct ON ct.id = s.class_teacher_id
       -- curriculum chunks via class
       LEFT JOIN curriculum_documents cd
         ON cd.class_id = s.class_id AND cd.school_id = $1 AND cd.status = 'ready'
       LEFT JOIN curriculum_chunks cc ON cc.document_id = cd.id
       -- all completions
       LEFT JOIN daily_completions dc ON dc.section_id = s.id
       -- covered chunk ids
       LEFT JOIN LATERAL (
         SELECT unnest(dc2.covered_chunk_ids) AS chunk_id
         FROM daily_completions dc2
         WHERE dc2.section_id = s.id
       ) dc_chunks ON true
       -- this week's day plans
       LEFT JOIN day_plans dp_week
         ON dp_week.section_id = s.id
         AND dp_week.plan_date BETWEEN $2 AND $3
       -- this week's special days (school-wide)
       LEFT JOIN special_days sd_week
         ON sd_week.school_id = $1
         AND sd_week.day_date BETWEEN $2 AND $3
       WHERE s.school_id = $1
       GROUP BY s.id, s.label, c.name, ct.name, s.flagged, s.flag_note
       ORDER BY c.name, s.label`, [school_id, weekStartStr, weekEndStr]);
        return res.json(result.rows);
    }
    catch (err) {
        console.error('Coverage error:', err.message);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// GET /:section_id — detailed coverage for a single section (day-by-day plan)
router.get('/:section_id', async (req, res) => {
    try {
        const school_id = req.user.school_id;
        const { section_id } = req.params;
        // Verify section belongs to school
        const secRow = await db_1.pool.query(`SELECT s.id, s.label, c.name AS class_name, ct.name AS class_teacher_name
       FROM sections s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN users ct ON ct.id = s.class_teacher_id
       WHERE s.id = $1 AND s.school_id = $2`, [section_id, school_id]);
        if (secRow.rows.length === 0)
            return res.status(404).json({ error: 'Section not found' });
        const section = secRow.rows[0];
        // Day-by-day plans with full completion details
        const plansResult = await db_1.pool.query(`SELECT
         dp.plan_date,
         dp.status,
         dp.chunk_ids,
         -- completion info
         dc.id              AS completion_id,
         dc.covered_chunk_ids,
         dc.submitted_at,
         dc.edited_at,
         -- who submitted
         submitter.name     AS submitted_by_name,
         submitter.id       AS submitted_by_id,
         -- late submission flag: submitted after the plan_date
         CASE
           WHEN dc.submitted_at IS NOT NULL
             AND dc.submitted_at::date > dp.plan_date
           THEN true ELSE false
         END                AS submitted_late,
         -- days late
         CASE
           WHEN dc.submitted_at IS NOT NULL
             AND dc.submitted_at::date > dp.plan_date
           THEN (dc.submitted_at::date - dp.plan_date)::int
           ELSE 0
         END                AS days_late,
         -- topic labels for this day's chunks
         COALESCE(
           json_agg(
             json_build_object('id', cc.id, 'topic_label', cc.topic_label)
             ORDER BY cc.chunk_index
           ) FILTER (WHERE cc.id IS NOT NULL),
           '[]'
         )                  AS chunks,
         -- special day on this date
         sd.label           AS special_day_label,
         sd.day_type        AS special_day_type,
         -- supplementary activities on this date
         COALESCE(
           (SELECT json_agg(json_build_object(
             'pool_name', ap.name,
             'activity_title', a.title,
             'status', sp.status
           ))
           FROM supplementary_plans sp
           JOIN activities a ON a.id = sp.activity_id
           JOIN pool_assignments pa ON pa.id = sp.pool_assignment_id
           JOIN activity_pools ap ON ap.id = pa.activity_pool_id
           WHERE sp.section_id = dp.section_id AND sp.plan_date = dp.plan_date),
           '[]'::json
         )                  AS supplementary_activities
       FROM day_plans dp
       LEFT JOIN daily_completions dc
         ON dc.section_id = dp.section_id AND dc.completion_date = dp.plan_date
       LEFT JOIN users submitter ON submitter.id = dc.teacher_id
       LEFT JOIN curriculum_chunks cc ON cc.id = ANY(dp.chunk_ids)
       LEFT JOIN special_days sd
         ON sd.school_id = dp.school_id AND sd.day_date = dp.plan_date
       WHERE dp.section_id = $1 AND dp.school_id = $2
       GROUP BY dp.id, dp.plan_date, dp.status, dp.chunk_ids,
                dc.id, dc.covered_chunk_ids, dc.submitted_at, dc.edited_at,
                submitter.name, submitter.id, sd.label, sd.day_type
       ORDER BY dp.plan_date DESC
       LIMIT 60`, [section_id, school_id]);
        // Late submission anomaly: count how many times this teacher submitted late in last 30 days
        const anomalyResult = await db_1.pool.query(`SELECT
         u.id AS teacher_id,
         u.name AS teacher_name,
         COUNT(*) FILTER (WHERE dc.submitted_at::date > dp.plan_date)::int AS late_count,
         COUNT(*)::int AS total_count
       FROM daily_completions dc
       JOIN day_plans dp ON dp.section_id = dc.section_id AND dp.plan_date = dc.completion_date
       JOIN users u ON u.id = dc.teacher_id
       WHERE dc.section_id = $1
         AND dp.plan_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY u.id, u.name`, [section_id]);
        const anomalies = anomalyResult.rows
            .filter((r) => r.late_count >= 3)
            .map((r) => ({
            teacher_name: r.teacher_name,
            late_count: r.late_count,
            total_count: r.total_count,
            message: `${r.teacher_name} has submitted completion ${r.late_count} out of ${r.total_count} times after the plan date in the last 30 days. Parents may not be getting timely updates.`,
        }));
        return res.json({
            section,
            plans: plansResult.rows,
            anomalies,
        });
    }
    catch (err) {
        console.error('Coverage detail error:', err.message);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
exports.default = router;

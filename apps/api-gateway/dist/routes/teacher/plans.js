"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const teacherSection_1 = require("../../lib/teacherSection");
const today_1 = require("../../lib/today");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.schoolScope, (0, auth_1.roleGuard)('teacher', 'principal'));
const PLAN_QUERY = `
  SELECT dp.id, dp.plan_date::text AS plan_date, dp.status, dp.chunk_ids, dp.section_id,
         dp.admin_note, dp.chunk_label_overrides,
         COALESCE(json_agg(json_build_object(
           'id', cc.id,
           'chunk_index', cc.chunk_index,
           'topic_label', COALESCE((dp.chunk_label_overrides->>(cc.id::text)), cc.topic_label),
           'content', cc.content,
           'page_start', cc.page_start,
           'page_end', cc.page_end,
           'activity_ids', cc.activity_ids
         ) ORDER BY cc.chunk_index) FILTER (WHERE cc.id IS NOT NULL), '[]') as chunks
  FROM day_plans dp
  LEFT JOIN curriculum_chunks cc ON cc.id = ANY(dp.chunk_ids)
  WHERE dp.section_id = $1 AND dp.plan_date = $2 AND dp.school_id = $3
  GROUP BY dp.id
`;
async function resolveSection(user_id, school_id, requested) {
    const sections = await (0, teacherSection_1.getTeacherSections)(user_id, school_id);
    if (sections.length === 0)
        return null;
    if (sections.length === 1)
        return sections[0].section_id;
    return (requested && sections.find(s => s.section_id === requested))
        ? requested
        : sections[0].section_id;
}
// GET /api/v1/teacher/plan/today
router.get('/today', async (req, res) => {
    try {
        const { user_id, school_id } = req.user;
        const today = await (0, today_1.getToday)(school_id);
        console.log(`[Plans] effective today=${today} school=${school_id}`);
        const section_id = await resolveSection(user_id, school_id, req.query.section_id);
        if (!section_id) {
            return res.json({ plan_date: today, status: 'no_plan', chunks: [], section_id: null });
        }
        console.log(`[Plans] querying section=${section_id} date=${today}`);
        const result = await db_1.pool.query(PLAN_QUERY, [section_id, today, school_id]);
        if (result.rows.length === 0) {
            console.log(`[Plans] no row found`);
            // Still check for supplementary activities
            const suppResult = await db_1.pool.query(`SELECT sp.id AS plan_id, sp.status, sp.override_note,
                a.title AS activity_title, a.description AS activity_description,
                ap.name AS pool_name
         FROM supplementary_plans sp
         JOIN activities a ON a.id = sp.activity_id
         JOIN pool_assignments pa ON pa.id = sp.pool_assignment_id
         JOIN activity_pools ap ON ap.id = pa.activity_pool_id
         WHERE sp.section_id = $1 AND sp.plan_date = $2
         ORDER BY ap.name, a.position`, [section_id, today]);
            return res.json({ plan_date: today, status: 'no_plan', chunks: [], section_id, supplementary_activities: suppResult.rows });
        }
        const row = result.rows[0];
        console.log(`[Plans] found status=${row.status} chunk_ids=${JSON.stringify(row.chunk_ids)} chunks_joined=${row.chunks?.length}`);
        // If no chunks, enrich with special_days label
        if (!row.chunk_ids?.length) {
            const special = await db_1.pool.query(`SELECT label, day_type FROM special_days WHERE school_id=$1 AND day_date=$2 LIMIT 1`, [school_id, today]);
            if (special.rows.length > 0) {
                row.status = special.rows[0].day_type;
                row.special_label = special.rows[0].label;
            }
        }
        // Attach supplementary activities for this section + date
        const suppResult = await db_1.pool.query(`SELECT sp.id AS plan_id, sp.status, sp.override_note,
              a.title AS activity_title, a.description AS activity_description,
              ap.name AS pool_name
       FROM supplementary_plans sp
       JOIN activities a ON a.id = sp.activity_id
       JOIN pool_assignments pa ON pa.id = sp.pool_assignment_id
       JOIN activity_pools ap ON ap.id = pa.activity_pool_id
       WHERE sp.section_id = $1 AND sp.plan_date = $2
       ORDER BY ap.name, a.position`, [section_id, today]);
        row.supplementary_activities = suppResult.rows;
        return res.json(row);
    }
    catch (err) {
        console.error('[Plans] error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/teacher/plan/:date
router.get('/:date', async (req, res) => {
    try {
        const { user_id, school_id } = req.user;
        const section_id = await resolveSection(user_id, school_id, req.query.section_id);
        if (!section_id) {
            return res.json({ plan_date: req.params.date, status: 'no_plan', chunks: [] });
        }
        const result = await db_1.pool.query(PLAN_QUERY, [section_id, req.params.date, school_id]);
        if (result.rows.length === 0) {
            return res.json({ plan_date: req.params.date, status: 'no_plan', chunks: [] });
        }
        return res.json(result.rows[0]);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;

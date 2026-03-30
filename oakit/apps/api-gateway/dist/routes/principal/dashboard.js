"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.schoolScope, (0, auth_1.roleGuard)('principal', 'admin'));
// GET /api/v1/principal/dashboard
router.get('/', async (req, res) => {
    try {
        const { school_id } = req.user;
        const result = await db_1.pool.query(`SELECT
         s.id as section_id,
         s.label as section_label,
         c.name as class_name,
         COUNT(DISTINCT cc.id) as total_chunks,
         COUNT(DISTINCT cs.chunk_id) FILTER (WHERE cs.status = 'covered') as covered_chunks,
         MAX(cl.log_date) as last_log_date,
         CASE
           WHEN MAX(cl.log_date) IS NULL THEN true
           WHEN (CURRENT_DATE - MAX(cl.log_date)) > 3 THEN true
           ELSE false
         END as is_inactive
       FROM sections s
       JOIN classes c ON s.class_id = c.id
       LEFT JOIN day_plans dp ON dp.section_id = s.id
       LEFT JOIN curriculum_chunks cc ON cc.id = ANY(dp.chunk_ids)
       LEFT JOIN coverage_logs cl ON cl.section_id = s.id
       LEFT JOIN coverage_statuses cs ON cs.coverage_log_id = cl.id AND cs.chunk_id = cc.id
       WHERE s.school_id = $1
       GROUP BY s.id, s.label, c.name, c.id
       ORDER BY c.name, s.label`, [school_id]);
        const sections = result.rows.map(r => ({
            ...r,
            completion_pct: r.total_chunks > 0
                ? Math.round((r.covered_chunks / r.total_chunks) * 100)
                : 0,
        }));
        return res.json(sections);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/principal/sections/:id/timeline
router.get('/sections/:id/timeline', async (req, res) => {
    try {
        const { school_id } = req.user;
        const result = await db_1.pool.query(`SELECT
         dp.plan_date,
         dp.status as plan_status,
         dp.chunk_ids,
         cl.id as log_id,
         cl.log_text,
         cl.flagged,
         cl.submitted_at
       FROM day_plans dp
       LEFT JOIN coverage_logs cl ON cl.section_id = dp.section_id AND cl.log_date = dp.plan_date
       WHERE dp.section_id = $1 AND dp.school_id = $2
       ORDER BY dp.plan_date DESC
       LIMIT 60`, [req.params.id, school_id]);
        return res.json(result.rows);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/principal/inactive
router.get('/inactive', async (req, res) => {
    try {
        const { school_id } = req.user;
        const result = await db_1.pool.query(`SELECT s.id, s.label, c.name as class_name, MAX(cl.log_date) as last_log_date
       FROM sections s
       JOIN classes c ON s.class_id = c.id
       LEFT JOIN coverage_logs cl ON cl.section_id = s.id
       WHERE s.school_id = $1
       GROUP BY s.id, s.label, c.name
       HAVING MAX(cl.log_date) IS NULL OR (CURRENT_DATE - MAX(cl.log_date)) > 3`, [school_id]);
        return res.json(result.rows);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const today_1 = require("../../lib/today");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.schoolScope, (0, auth_1.roleGuard)('principal', 'admin'));
// GET /overview — attendance overview for all sections in the school
router.get('/overview', async (req, res) => {
    try {
        const school_id = req.user.school_id;
        const today = await (0, today_1.getToday)(school_id);
        const result = await db_1.pool.query(`SELECT
         s.id          AS section_id,
         s.name        AS section_name,
         s.flagged,
         s.flag_note,
         CASE WHEN ar.id IS NOT NULL THEN 'submitted' ELSE 'pending' END AS status,
         COALESCE(ar.present_count, 0)  AS present_count,
         COALESCE(ar.absent_count, 0)   AS absent_count
       FROM sections s
       LEFT JOIN LATERAL (
         SELECT
           id,
           COUNT(*) FILTER (WHERE status = 'present') AS present_count,
           COUNT(*) FILTER (WHERE status = 'absent')  AS absent_count
         FROM attendance_records
         WHERE section_id = s.id AND attend_date = $2
         GROUP BY id
         LIMIT 1
       ) ar ON true
       WHERE s.school_id = $1 AND s.is_active = true
       ORDER BY s.name`, [school_id, today]);
        return res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;

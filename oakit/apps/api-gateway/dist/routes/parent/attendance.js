"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const today_1 = require("../../lib/today");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.forceResetGuard, auth_1.schoolScope, (0, auth_1.roleGuard)('parent'));
// GET / — attendance history for linked children (last 30 calendar days)
router.get('/', async (req, res) => {
    try {
        const { user_id, school_id } = req.user;
        const today = await (0, today_1.getToday)(school_id);
        // Get linked children
        const links = await db_1.pool.query(`SELECT psl.student_id, st.name AS student_name
       FROM parent_student_links psl
       JOIN students st ON st.id = psl.student_id
       WHERE psl.parent_id = $1`, [user_id]);
        const result = [];
        for (const link of links.rows) {
            const { student_id, student_name } = link;
            const records = await db_1.pool.query(`SELECT attend_date, status
         FROM attendance_records
         WHERE student_id = $1
           AND attend_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date
         ORDER BY attend_date DESC`, [student_id, today]);
            const total = records.rows.length;
            const present = records.rows.filter((r) => r.status === 'present').length;
            const attendance_pct = total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0;
            result.push({
                student_id,
                student_name,
                records: records.rows,
                attendance_pct,
            });
        }
        return res.json(result);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;

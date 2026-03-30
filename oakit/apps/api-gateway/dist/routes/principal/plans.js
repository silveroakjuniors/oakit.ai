"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const today_1 = require("../../lib/today");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.schoolScope, (0, auth_1.roleGuard)('principal', 'admin'));
// GET /:section_id — get day plan for a section on ?date= (default today)
router.get('/:section_id', async (req, res) => {
    try {
        const school_id = req.user.school_id;
        const { section_id } = req.params;
        // Verify section belongs to principal's school
        const sectionRow = await db_1.pool.query('SELECT id, school_id FROM sections WHERE id = $1', [section_id]);
        if (sectionRow.rows.length === 0)
            return res.status(404).json({ error: 'Section not found' });
        if (sectionRow.rows[0].school_id !== school_id) {
            return res.status(403).json({ error: 'Access denied: cross-school request' });
        }
        // Determine date
        const date = req.query.date;
        let planDate;
        if (date) {
            planDate = date;
        }
        else {
            planDate = await (0, today_1.getToday)(school_id);
        }
        const result = await db_1.pool.query(`SELECT dp.id, dp.section_id, dp.plan_date, dp.topic_labels, dp.created_at
       FROM day_plans dp
       WHERE dp.section_id = $1 AND dp.plan_date = $2`, [section_id, planDate]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'No plan found for this date' });
        return res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;

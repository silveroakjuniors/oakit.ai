"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, (0, auth_1.roleGuard)('super_admin'));
// GET / — platform-wide stats
router.get('/', async (_req, res) => {
    try {
        const result = await db_1.pool.query(`
      SELECT
        (SELECT COUNT(*) FROM schools)::int                                    AS total_schools,
        (SELECT COUNT(*) FROM schools WHERE status = 'active')::int           AS active_schools,
        (SELECT COUNT(*) FROM users WHERE role = 'teacher')::int              AS total_teachers,
        (SELECT COUNT(*) FROM students)::int                                  AS total_students,
        (SELECT COUNT(*) FROM daily_completions)::int                         AS total_day_plans
    `);
        return res.json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;

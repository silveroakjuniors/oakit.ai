"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.forceResetGuard, auth_1.schoolScope, (0, auth_1.roleGuard)('parent'));
// GET / — unread notifications for the authenticated parent
router.get('/', async (req, res) => {
    try {
        const { user_id } = req.user;
        const result = await db_1.pool.query(`SELECT
         pn.id,
         pn.completion_date,
         pn.chunks_covered,
         pn.is_read,
         pn.created_at,
         s.name AS section_name
       FROM parent_notifications pn
       JOIN sections s ON s.id = pn.section_id
       WHERE pn.parent_id = $1 AND pn.is_read = false
       ORDER BY pn.created_at DESC`, [user_id]);
        return res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /:id/read — mark notification as read
router.post('/:id/read', async (req, res) => {
    try {
        const { user_id } = req.user;
        const result = await db_1.pool.query(`UPDATE parent_notifications SET is_read = true
       WHERE id = $1 AND parent_id = $2
       RETURNING id`, [req.params.id, user_id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        return res.json({ message: 'Notification marked as read' });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;

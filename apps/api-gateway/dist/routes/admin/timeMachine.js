"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const today_1 = require("../../lib/today");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.schoolScope, (0, auth_1.roleGuard)('admin', 'teacher', 'principal'));
// GET — all roles can read (teachers need this to know effective date)
router.get('/', async (req, res) => {
    const { school_id } = req.user;
    res.json(await (0, today_1.getTimeMachineStatus)(school_id));
});
// POST — admin only
router.post('/', (0, auth_1.roleGuard)('admin'), async (req, res) => {
    const { school_id } = req.user;
    const { date, ttl_hours = 24 } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
    }
    const ttlSeconds = Math.min(Math.max(Number(ttl_hours) || 24, 1), 72) * 3600;
    await (0, today_1.setTimeMachine)(school_id, date, ttlSeconds);
    const status = await (0, today_1.getTimeMachineStatus)(school_id);
    return res.json(status);
});
// DELETE — admin only
router.delete('/', (0, auth_1.roleGuard)('admin'), async (req, res) => {
    const { school_id } = req.user;
    await (0, today_1.clearTimeMachine)(school_id);
    res.json({ active: false, mock_date: null, expires_at: null, ttl_seconds: 0 });
});
exports.default = router;

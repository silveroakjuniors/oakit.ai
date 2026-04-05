"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const db_1 = require("../../lib/db");
const jwt_1 = require("../../lib/jwt");
const redis_1 = require("../../lib/redis");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, (0, auth_1.roleGuard)('super_admin'));
// POST /:school_id — start impersonation session
router.post('/:school_id', async (req, res) => {
    try {
        const { school_id } = req.params;
        const super_admin_id = req.user.user_id;
        const school = await db_1.pool.query('SELECT id, status FROM schools WHERE id = $1', [school_id]);
        if (school.rows.length === 0)
            return res.status(404).json({ error: 'School not found' });
        if (school.rows[0].status !== 'active') {
            return res.status(403).json({ error: 'Cannot impersonate inactive school' });
        }
        const jti = (0, uuid_1.v4)();
        const TTL = '2h';
        const token = (0, jwt_1.signToken)({ user_id: super_admin_id, school_id, role: 'admin', permissions: [], jti }, TTL);
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
        await db_1.pool.query(`INSERT INTO impersonation_logs (super_admin_id, school_id, jti)
       VALUES ($1, $2, $3)`, [super_admin_id, school_id, jti]);
        return res.json({ token, expires_at: expiresAt.toISOString() });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /exit — revoke current impersonation token
router.post('/exit', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(400).json({ error: 'No token provided' });
        }
        const token = authHeader.slice(7);
        let payload;
        try {
            payload = (0, jwt_1.verifyToken)(token);
        }
        catch {
            return res.status(401).json({ error: 'Invalid token' });
        }
        if (!payload.jti)
            return res.status(400).json({ error: 'Not an impersonation token' });
        // Calculate remaining TTL for Redis expiry
        const exp = payload.exp;
        const ttlSeconds = Math.max(exp - Math.floor(Date.now() / 1000), 1);
        await redis_1.redis.sAdd('impersonation:revoked', payload.jti);
        await redis_1.redis.expire('impersonation:revoked', ttlSeconds);
        await db_1.pool.query(`UPDATE impersonation_logs SET exited_at = now() WHERE jti = $1`, [payload.jti]);
        return res.json({ message: 'Impersonation session ended' });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;

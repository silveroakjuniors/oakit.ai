"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtVerify = jwtVerify;
exports.forceResetGuard = forceResetGuard;
exports.schoolScope = schoolScope;
exports.roleGuard = roleGuard;
exports.permissionGuard = permissionGuard;
const jwt_1 = require("../lib/jwt");
const redis_1 = require("../lib/redis");
// Verify JWT and attach user to request
async function jwtVerify(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization token' });
    }
    const token = authHeader.slice(7);
    try {
        const payload = (0, jwt_1.verifyToken)(token);
        if (payload.jti) {
            const revoked = await redis_1.redis.sIsMember('impersonation:revoked', payload.jti);
            if (revoked) {
                return res.status(401).json({ error: 'Token has been revoked' });
            }
        }
        req.user = payload;
        return next();
    }
    catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
// Force-reset guard
function forceResetGuard(req, res, next) {
    if (!req.user)
        return next();
    const payload = req.user;
    if (payload.force_password_reset === true) {
        if (req.path === '/change-password' && req.method === 'POST')
            return next();
        return res.status(403).json({ error: 'Password change required', force_password_reset: true });
    }
    return next();
}
// Inject school_id from JWT and reject cross-school access
function schoolScope(req, res, next) {
    if (!req.user)
        return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role === 'super_admin')
        return next();
    const paramSchoolId = req.params.school_id || req.body?.school_id;
    if (paramSchoolId && paramSchoolId !== req.user.school_id) {
        return res.status(403).json({ error: 'Access denied: cross-school request' });
    }
    return next();
}
// Role guard factory
function roleGuard(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        return next();
    };
}
// Permission guard factory
function permissionGuard(permission) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        const perms = req.user.permissions || [];
        if (!perms.includes(permission)) {
            return res.status(403).json({ error: `Missing permission: ${permission}` });
        }
        return next();
    };
}

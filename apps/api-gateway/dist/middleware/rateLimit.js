"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRateLimit = exports.aiRateLimit = exports.loginRateLimit = exports.authRateLimit = exports.apiRateLimit = void 0;
exports.loginThrottle = loginThrottle;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const redis_1 = require("../lib/redis");
// OWASP A05: Security Misconfiguration — proper rate limits
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 12;
const FALLBACK_LOGIN_BUCKETS = new Map();
function loginKey(req) {
    const schoolCode = (req.body?.school_code || '').toString().toLowerCase().trim();
    const identifier = (req.body?.mobile || req.body?.email || '').toString().toLowerCase().trim();
    return `${schoolCode}:${identifier}:${req.ip || 'unknown'}`;
}
/** Global API rate limit — 200 req / 15 min per IP */
exports.apiRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
    // Don't double-throttle auth requests; login has its own dedicated limiter.
    skip: (req) => req.path === '/health' || req.path.startsWith('/api/v1/auth'),
});
/** Auth endpoints (except login) — moderate: 100 req / 15 min per IP */
exports.authRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth requests, please try again later' },
});
/** Login endpoint — strict: 10 attempts / 15 min per school+user+IP */
exports.loginRateLimit = (0, express_rate_limit_1.default)({
    windowMs: LOGIN_WINDOW_MS,
    max: LOGIN_MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later' },
    keyGenerator: loginKey,
});
/**
 * Production login limiter backed by Redis (shared across instances).
 * Falls back to in-memory limiter when Redis is unavailable.
 */
async function loginThrottle(req, res, next) {
    const key = `rl:login:${loginKey(req)}`;
    const now = Date.now();
    try {
        const count = await redis_1.redis.incr(key);
        if (count === 1) {
            await redis_1.redis.pExpire(key, LOGIN_WINDOW_MS);
        }
        const ttlMs = Math.max(0, Number(await redis_1.redis.pTTL(key)) || 0);
        const remaining = Math.max(0, LOGIN_MAX_ATTEMPTS - Number(count));
        res.setHeader('X-RateLimit-Limit', String(LOGIN_MAX_ATTEMPTS));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + ttlMs) / 1000)));
        if (Number(count) > LOGIN_MAX_ATTEMPTS) {
            return res.status(429).json({ error: 'Too many login attempts, please try again later' });
        }
        return next();
    }
    catch {
        // Safe fallback: process-local bucket, avoids hard dependency on Redis availability.
        const bucket = FALLBACK_LOGIN_BUCKETS.get(key);
        if (!bucket || bucket.resetAt <= now) {
            FALLBACK_LOGIN_BUCKETS.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
            return next();
        }
        bucket.count += 1;
        if (bucket.count > LOGIN_MAX_ATTEMPTS) {
            return res.status(429).json({ error: 'Too many login attempts, please try again later' });
        }
        return next();
    }
}
/** AI query endpoint — 30 req / 5 min per IP (prevents AI abuse) */
exports.aiRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many AI requests, please slow down' },
    keyGenerator: (req) => {
        // Rate limit by user ID if available, otherwise by IP
        const user = req.user;
        return user?.user_id || req.ip || 'unknown';
    },
});
/** File upload endpoints — 20 uploads / 10 min per IP */
exports.uploadRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 10 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many uploads, please try again later' },
});

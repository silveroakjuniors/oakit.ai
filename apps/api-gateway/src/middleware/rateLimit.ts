// @ts-ignore: express-rate-limit types may not be available in all environments
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis';

// OWASP A05: Security Misconfiguration — proper rate limits
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const FALLBACK_LOGIN_BUCKETS = new Map<string, { count: number; resetAt: number }>();

// Get real client IP (behind proxy/load balancer)
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first.trim();
  }
  return req.ip || 'unknown';
}

// Login rate limit key: per school + per user mobile/email (NOT per IP)
// This way 500 different parents can login simultaneously from different mobiles
// But a single mobile number is limited to 10 attempts
function loginKey(req: Request) {
  const schoolCode = (req.body?.school_code || '').toString().toLowerCase().trim();
  const identifier = (req.body?.mobile || req.body?.email || '').toString().toLowerCase().trim();
  return `${schoolCode}:${identifier}`;
}

/** Global API rate limit — 1000 req / 15 min per real client IP */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: { error: 'Too many requests, please try again later' },
  // Don't double-throttle auth requests; login has its own dedicated limiter.
  skip: (req: Request) => req.path === '/health' || req.path.startsWith('/api/v1/auth'),
});

/** Auth endpoints (except login) — moderate: 200 req / 15 min per real client IP */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: { error: 'Too many auth requests, please try again later' },
  // Skip login — it has its own dedicated per-user limiter (loginThrottle)
  skip: (req: Request) => req.path === '/login' || req.path === '/student-login',
});

/** Login endpoint — strict: 10 attempts / 15 min per school+user+IP */
export const loginRateLimit = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
  keyGenerator: loginKey,
});

/**
 * Production login limiter backed by Redis (shared across instances).
 * Falls back to in-memory limiter when Redis is unavailable.
 */
export async function loginThrottle(req: Request, res: Response, next: NextFunction) {
  const key = `rl:login:${loginKey(req)}`;
  const now = Date.now();

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pExpire(key, LOGIN_WINDOW_MS);
    }

    const ttlMs = Math.max(0, Number(await redis.pTTL(key)) || 0);
    const remaining = Math.max(0, LOGIN_MAX_ATTEMPTS - Number(count));
    res.setHeader('X-RateLimit-Limit', String(LOGIN_MAX_ATTEMPTS));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + ttlMs) / 1000)));

    if (Number(count) > LOGIN_MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many login attempts, please try again later' });
    }
    return next();
  } catch {
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
export const aiRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests, please slow down' },
  keyGenerator: (req: Request) => {
    // Rate limit by user ID if available, otherwise by IP
    const user = (req as any).user;
    return user?.user_id || req.ip || 'unknown';
  },
});

/** File upload endpoints — 20 uploads / 10 min per IP */
export const uploadRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads, please try again later' },
});

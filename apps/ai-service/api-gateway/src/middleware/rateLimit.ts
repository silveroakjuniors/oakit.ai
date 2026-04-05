import rateLimit from 'express-rate-limit';

// OWASP A05: Security Misconfiguration — proper rate limits

/** Global API rate limit — 200 req / 15 min per IP */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: (req) => req.path === '/health', // don't rate-limit health checks
});

/** Auth endpoints — strict: 10 attempts / 15 min per IP */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

/** AI query endpoint — 30 req / 5 min per IP (prevents AI abuse) */
export const aiRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests, please slow down' },
  keyGenerator: (req) => {
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

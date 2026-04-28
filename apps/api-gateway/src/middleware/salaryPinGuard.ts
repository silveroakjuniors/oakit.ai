import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis';

/**
 * salaryPinGuard — ensures the requesting user has an active salary PIN session.
 *
 * The session is created by POST /api/v1/financial/salary/pin/verify and stored
 * in Redis under `salary_pin_session:{userId}` with an 8-hour TTL.
 *
 * Returns 403 with code SALARY_PIN_REQUIRED if no session exists.
 * Bypasses for super_admin only.
 */
export async function salaryPinGuard(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  const role = req.user?.role;

  // Only super_admin bypasses the PIN requirement
  if (role === 'super_admin') return next();

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const session = await redis.get(`salary_pin_session:${userId}`);
    if (!session) {
      return res.status(403).json({
        error: 'Salary PIN verification required. Please verify your PIN to access salary data.',
        code: 'SALARY_PIN_REQUIRED',
      });
    }
    return next();
  } catch (err) {
    console.error('[salaryPinGuard] Redis error:', err);
    // Redis unavailable — fail open so salary access isn't permanently blocked
    return next();
  }
}

import { Request, Response, NextFunction } from 'express';
import { pool } from '../lib/db';
import { redis } from '../lib/redis';

/**
 * financialModuleGuard — checks whether the financial module is enabled for
 * the requesting user's school before allowing access to financial routes.
 *
 * - Bypasses for `super_admin` and `franchise_admin` (no school_id on those tokens).
 * - Caches the enabled/disabled flag in Redis under `financial_module:{school_id}`
 *   with a 60-second TTL to avoid hitting the DB on every request.
 * - If no row exists in `financial_module_settings` for the school, defaults to
 *   enabled (treats missing row as `is_enabled = true`).
 * - Returns 403 with `FINANCIAL_MODULE_DISABLED` code when the module is off.
 */
export async function financialModuleGuard(req: Request, res: Response, next: NextFunction) {
  const schoolId = req.user?.school_id;

  // super_admin and franchise_admin have no school_id — bypass the check
  if (!schoolId) return next();

  const cacheKey = `financial_module:${schoolId}`;

  try {
    const cached = await redis.get(cacheKey);

    let isEnabled: boolean;
    if (cached !== null) {
      isEnabled = cached === '1';
    } else {
      const result = await pool.query(
        'SELECT is_enabled FROM financial_module_settings WHERE school_id = $1',
        [schoolId]
      );
      // No row → treat as enabled (default true)
      isEnabled = result.rows.length === 0 || result.rows[0].is_enabled === true;
      await redis.setEx(cacheKey, 60, isEnabled ? '1' : '0');
    }

    if (!isEnabled) {
      return res.status(403).json({
        error: 'Financial module is not enabled for this school. Contact your administrator.',
        code: 'FINANCIAL_MODULE_DISABLED',
      });
    }

    return next();
  } catch (err) {
    // On unexpected errors, fail open (let the route handler deal with it)
    // to avoid blocking all financial requests due to a transient Redis/DB issue.
    console.error('[financialModuleGuard] Error checking module status:', err);
    return next();
  }
}

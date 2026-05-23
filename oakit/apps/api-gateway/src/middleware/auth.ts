import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../lib/jwt';
import { redis } from '../lib/redis';
import { DEFAULT_ROLE_PERMISSIONS } from '../lib/permissions';

// Extend Express Request to carry auth context
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { force_password_reset?: boolean };
    }
  }
}

// Verify JWT and attach user to request
export async function jwtVerify(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);

    // Check revoked impersonation tokens
    if (payload.jti) {
      const revoked = await redis.sIsMember('impersonation:revoked', payload.jti);
      if (revoked) {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
    }

    // Single-session enforcement: check if this session is still the active one
    if (payload.sid && payload.user_id) {
      try {
        const activeSession = await redis.get(`session:${payload.user_id}`);
        if (activeSession && activeSession !== payload.sid) {
          return res.status(401).json({ error: 'Session expired — logged in from another device', code: 'SESSION_REPLACED' });
        }
      } catch {
        // Redis unavailable — skip session check, allow request through
      }
    }

    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Force-reset guard
export function forceResetGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next();
  const payload = req.user as any;
  if (payload.force_password_reset === true) {
    if (req.path === '/change-password' && req.method === 'POST') return next();
    return res.status(403).json({ error: 'Password change required', force_password_reset: true });
  }
  return next();
}

// Inject school_id from JWT and reject cross-school access
export function schoolScope(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  // super_admin and franchise_admin are not scoped to a single school
  if (req.user.role === 'super_admin' || req.user.role === 'franchise_admin') return next();
  const paramSchoolId = req.params.school_id || req.body?.school_id;
  if (paramSchoolId && paramSchoolId !== req.user.school_id) {
    return res.status(403).json({ error: 'Access denied: cross-school request' });
  }
  return next();
}

// Franchise scope guard — ensures franchise_admin only sees schools in their franchise
export function franchiseScope(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role === 'super_admin') return next(); // super_admin bypasses all
  if (req.user.role !== 'franchise_admin') {
    return res.status(403).json({ error: 'Franchise admin access required' });
  }
  if (!(req.user as any).franchise_id) {
    return res.status(403).json({ error: 'No franchise assigned to this account' });
  }
  return next();
}

// Role guard factory
export function roleGuard(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}

// Permission guard factory
// Checks the JWT permissions array first, then falls back to DEFAULT_ROLE_PERMISSIONS
// for the user's role. This ensures principal always has full financial access even
// if the DB role row was seeded before financial permissions were introduced.
// Also applies per-user DB overrides stored in the JWT payload (financial_permissions).
export function permissionGuard(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const jwtPerms: string[] = (req.user as any).permissions || [];
    const role: string = req.user.role || '';
    const roleDefaults: string[] = DEFAULT_ROLE_PERMISSIONS[role] || [];

    // Merge JWT perms + role defaults
    const merged = new Set([...jwtPerms, ...roleDefaults]);

    // Apply per-user DB overrides for non-privileged roles.
    // Privileged roles (principal, admin, super_admin) cannot have permissions removed.
    const PRIVILEGED_ROLES = new Set(['principal', 'admin', 'super_admin']);
    if (!PRIVILEGED_ROLES.has(role)) {
      try {
        const { pool } = await import('../lib/db');
        const result = await pool.query(
          `SELECT financial_permissions FROM users WHERE id = $1`,
          [req.user.id]
        );
        const overrides: Record<string, boolean> = result.rows[0]?.financial_permissions || {};
        Object.entries(overrides).forEach(([perm, granted]) => {
          if (granted) merged.add(perm);
          else merged.delete(perm);
        });
      } catch {
        // On DB error, fall through with role defaults — fail open for non-privileged
      }
    }

    if (!merged.has(permission)) {
      return res.status(403).json({ error: `Missing permission: ${permission}` });
    }
    return next();
  };
}

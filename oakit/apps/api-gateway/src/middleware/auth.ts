import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../lib/jwt';

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
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Force-reset guard: if JWT has force_password_reset: true, block all routes
// except POST /auth/change-password
export function forceResetGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next();
  const payload = req.user as any;
  if (payload.force_password_reset === true) {
    // Allow change-password endpoint
    if (req.path === '/change-password' && req.method === 'POST') {
      return next();
    }
    return res.status(403).json({
      error: 'Password change required',
      force_password_reset: true,
    });
  }
  return next();
}

// Inject school_id from JWT and reject cross-school access
export function schoolScope(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const paramSchoolId = req.params.school_id || req.body?.school_id;
  if (paramSchoolId && paramSchoolId !== req.user.school_id) {
    return res.status(403).json({ error: 'Access denied: cross-school request' });
  }
  return next();
}

// Role guard factory — returns middleware that allows only specified roles
export function roleGuard(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}

// Permission guard factory
export function permissionGuard(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const perms: string[] = (req.user as any).permissions || [];
    if (!perms.includes(permission)) {
      return res.status(403).json({ error: `Missing permission: ${permission}` });
    }
    return next();
  };
}

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const REFRESH_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

export interface JwtPayload {
  user_id: string;
  id?: string; // alias for user_id — some routes use req.user!.id
  school_id: string | null; // null for super_admin and franchise_admin
  role: string;
  permissions: string[];
  franchise_id?: string | null; // set for franchise_admin users
  force_password_reset?: boolean;
  jti?: string;
}

export interface SuperAdminJwtPayload extends Omit<JwtPayload, 'school_id'> {
  school_id: null;
}

export function signToken(payload: JwtPayload | SuperAdminJwtPayload, expiresIn?: string): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn ?? JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function signRefreshToken(user_id: string): string {
  return jwt.sign({ user_id }, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

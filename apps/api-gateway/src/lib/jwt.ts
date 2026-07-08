import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const REFRESH_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Production safety: prevent startup with weak/default JWT secret
if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change_me' || process.env.JWT_SECRET.length < 32) {
    console.error('FATAL: JWT_SECRET must be set to a strong value (32+ chars) in production.');
    process.exit(1);
  }
}

export interface JwtPayload {
  user_id: string;
  id?: string; // alias for user_id — some routes use req.user!.id
  school_id: string | null; // null for super_admin and franchise_admin
  role: string;
  permissions: string[];
  franchise_id?: string | null; // set for franchise_admin users
  force_password_reset?: boolean;
  jti?: string;
  sid?: string; // session id — used for single-session enforcement
}

export interface SuperAdminJwtPayload extends Omit<JwtPayload, 'school_id'> {
  school_id: null;
}

export function signToken(payload: JwtPayload | SuperAdminJwtPayload, expiresIn?: string): string {
  const withSid = { ...payload, sid: payload.sid || uuidv4() };
  return jwt.sign(withSid, JWT_SECRET, { expiresIn: expiresIn ?? JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function signRefreshToken(user_id: string): string {
  return jwt.sign({ user_id }, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

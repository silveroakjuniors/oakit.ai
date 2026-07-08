/**
 * piiGuard.ts — Franchise Admin PII Protection (Req 6)
 *
 * Blocks franchise_admin requests to any endpoint that returns individual
 * student, teacher, or parent records. Logs every blocked attempt to audit_logs.
 *
 * Default-deny: any endpoint not explicitly whitelisted is blocked for franchise_admin.
 * Whitelisted endpoints return only aggregate counts or school-entity fields.
 */

import { Request, Response, NextFunction } from 'express';
import { pool } from '../lib/db';

const PII_ERROR = { error: 'PII data is proprietary to each school' };

// Endpoints that ARE allowed for franchise_admin (aggregate/school-entity only)
// Everything else is blocked.
const FRANCHISE_ALLOWED_PATTERNS: RegExp[] = [
  // Franchise own routes
  /^\/api\/v1\/franchise\//,
  // Super-admin routes (franchise_admin shouldn't hit these, but super_admin can)
  /^\/api\/v1\/super-admin\//,
  // Auth
  /^\/api\/v1\/auth\//,
  // Health
  /^\/health/,
  // School privacy status (Req 7.3)
  /^\/api\/v1\/schools\/[^/]+\/franchise-privacy-status$/,
];

// Patterns that are ALWAYS blocked for franchise_admin (individual PII)
const PII_PATTERNS: RegExp[] = [
  /\/students/,
  /\/teachers/,
  /\/parents/,
  /\/attendance/,
  /\/messages/,
  /\/notes/,
  /\/homework/,
  /\/observations/,
  /\/milestones/,
  /\/child-journey/,
  /\/emergency-contacts/,
  /\/notifications/,
  /\/progress/,
  /\/quiz/,
  /\/feed/,
  /\/ai\//,
  /\/coverage/,
  /\/plans/,
  /\/completion/,
  /\/streaks/,
  /\/suggestions/,
  /\/resources/,
  /\/videos/,
  /\/export/,
  /\/reports/,
  /\/audit/,
  /\/announcements/,
  /\/settings/,
  /\/setup/,
  /\/users/,
  /\/classes/,
  /\/calendar/,
  /\/supplementary/,
  /\/textbook-planner/,
  /\/smart-alerts/,
  /\/student-portal/,
  /\/time-machine/,
];

async function logBlockedPiiAttempt(req: Request): Promise<void> {
  try {
    const user = req.user as any;
    await pool.query(
      `INSERT INTO audit_logs (school_id, actor_id, actor_role, action, entity_type, metadata)
       VALUES (NULL, $1, 'franchise_admin', 'franchise_pii_blocked', 'api_endpoint', $2)`,
      [
        user?.user_id,
        JSON.stringify({
          franchise_id: user?.franchise_id,
          attempted_endpoint: req.path,
          http_method: req.method,
          timestamp: new Date().toISOString(),
        }),
      ]
    );
  } catch { /* non-critical — don't fail the request */ }
}

export function piiGuard(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;

  // Only applies to franchise_admin
  if (!user || user.role !== 'franchise_admin') return next();

  const path = req.path;

  // Check if explicitly allowed
  if (FRANCHISE_ALLOWED_PATTERNS.some(p => p.test(path))) return next();

  // Check if it's a PII endpoint — block and log
  if (PII_PATTERNS.some(p => p.test(path))) {
    logBlockedPiiAttempt(req); // fire-and-forget
    return res.status(403).json(PII_ERROR);
  }

  // Default deny for anything not explicitly allowed (Req 6.7)
  logBlockedPiiAttempt(req);
  return res.status(403).json(PII_ERROR);
}

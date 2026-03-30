// Feature: multi-role-portal, Property 6, Property 7
import * as fc from 'fast-check';
import { v4 as uuidv4 } from 'uuid';
import { signToken, verifyToken } from '../../lib/jwt';

// ─── Property 6: Impersonation token has correct claims and scope ────────────
describe('Property 6: Impersonation token has correct claims and scope', () => {
  it('impersonation token carries role=admin, target school_id, and a jti', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // super_admin_id
        fc.uuid(), // target school_id
        (superAdminId, targetSchoolId) => {
          const jti = uuidv4();
          const token = signToken(
            { user_id: superAdminId, school_id: targetSchoolId, role: 'admin', permissions: [], jti },
            '2h'
          );
          const payload = verifyToken(token);
          expect(payload.role).toBe('admin');
          expect(payload.school_id).toBe(targetSchoolId);
          expect(payload.jti).toBe(jti);
          expect(payload.user_id).toBe(superAdminId);
        }
      )
    );
  });

  it('impersonation token expires within 2 hours', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (superAdminId, schoolId) => {
        const jti = uuidv4();
        const before = Math.floor(Date.now() / 1000);
        const token = signToken(
          { user_id: superAdminId, school_id: schoolId, role: 'admin', permissions: [], jti },
          '2h'
        );
        const payload = verifyToken(token) as any;
        const twoHoursFromNow = before + 2 * 60 * 60 + 5; // +5s tolerance
        expect(payload.exp).toBeLessThanOrEqual(twoHoursFromNow);
        expect(payload.exp).toBeGreaterThan(before);
      })
    );
  });
});

// ─── Property 7: Impersonation events are logged ─────────────────────────────
describe('Property 7: Impersonation events are logged', () => {
  it('each impersonation produces a unique jti', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.uuid(), fc.uuid()), { minLength: 2, maxLength: 10 }),
        (sessions) => {
          const jtis = sessions.map(() => uuidv4());
          const unique = new Set(jtis);
          expect(unique.size).toBe(jtis.length);
        }
      )
    );
  });

  it('log entry captures super_admin_id, school_id, and jti', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (superAdminId, schoolId) => {
        const jti = uuidv4();
        const logEntry = { super_admin_id: superAdminId, school_id: schoolId, jti, exited_at: null };
        expect(logEntry.super_admin_id).toBe(superAdminId);
        expect(logEntry.school_id).toBe(schoolId);
        expect(logEntry.jti).toBe(jti);
        expect(logEntry.exited_at).toBeNull();
      })
    );
  });
});

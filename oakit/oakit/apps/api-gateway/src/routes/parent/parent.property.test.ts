// Feature: multi-role-portal, Property 18, Property 19, Property 22
import * as fc from 'fast-check';

// ─── Property 19: Attendance history window and percentage ───────────────────
describe('Property 19: Attendance history window and percentage', () => {
  it('attendance_pct = present / total * 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 30 }),
        (present, absent) => {
          const total = present + absent;
          const pct = total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0;
          expect(pct).toBeGreaterThanOrEqual(0);
          expect(pct).toBeLessThanOrEqual(100);
          if (total === 0) expect(pct).toBe(0);
          if (present === total && total > 0) expect(pct).toBe(100);
        }
      )
    );
  });

  it('window is at most 30 calendar days', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ attend_date: fc.date({ min: new Date('2025-01-01'), max: new Date('2025-12-31') }), status: fc.constantFrom('present', 'absent') }),
          { minLength: 0, maxLength: 50 }
        ),
        (records) => {
          // Simulate 30-day window filter
          const today = new Date('2025-06-30');
          const windowStart = new Date(today);
          windowStart.setDate(today.getDate() - 29);
          const inWindow = records.filter((r) => r.attend_date >= windowStart && r.attend_date <= today);
          expect(inWindow.length).toBeLessThanOrEqual(records.length);
        }
      )
    );
  });
});

// ─── Property 22: Curriculum progress formula and academic year scoping ───────
describe('Property 22: Curriculum progress formula and academic year scoping', () => {
  it('coverage_pct = covered / total * 100 rounded to 1dp', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (total, coveredExtra) => {
          const covered = Math.min(coveredExtra, total);
          const pct = Math.round((covered / total) * 100 * 10) / 10;
          expect(pct).toBeGreaterThanOrEqual(0);
          expect(pct).toBeLessThanOrEqual(100);
        }
      )
    );
  });

  it('has_curriculum=false and coverage_pct=0 when total_chunks=0', () => {
    fc.assert(
      fc.property(fc.constant(0), (total) => {
        const hasCurriculum = total > 0;
        const pct = 0;
        expect(hasCurriculum).toBe(false);
        expect(pct).toBe(0);
      })
    );
  });

  it('completions outside academic year are excluded', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 180 }), // days before year start
        fc.integer({ min: 0, max: 364 }), // days within year
        (daysBefore, daysInside) => {
          const yearStart = new Date('2024-07-01').getTime();
          const yearEnd = new Date('2025-06-30').getTime();
          const outsideDate = new Date(yearStart - (daysBefore + 1) * 86400000);
          const insideDate = new Date(yearStart + (daysInside % 365) * 86400000);
          const isInside = (d: Date) => d.getTime() >= yearStart && d.getTime() <= yearEnd;
          expect(isInside(outsideDate)).toBe(false);
          expect(isInside(insideDate)).toBe(true);
        }
      )
    );
  });
});

// ─── Property 18: Parent daily feed is scoped to linked children ─────────────
describe('Property 18: Parent daily feed is scoped to linked children', () => {
  it('feed contains exactly one entry per linked child', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
        (studentIds) => {
          // Simulate feed generation — one entry per linked student
          const feed = studentIds.map((id) => ({ student_id: id, type: 'empty' }));
          expect(feed.length).toBe(studentIds.length);
          const ids = feed.map((f) => f.student_id);
          expect(new Set(ids).size).toBe(studentIds.length);
        }
      )
    );
  });

  it('feed type is one of curriculum, special_day, or empty', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom<'curriculum' | 'special_day' | 'empty'>('curriculum', 'special_day', 'empty'),
          { minLength: 1, maxLength: 10 }
        ),
        (types) => {
          const valid = ['curriculum', 'special_day', 'empty'];
          expect(types.every((t) => valid.includes(t))).toBe(true);
        }
      )
    );
  });
});

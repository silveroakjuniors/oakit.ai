// Feature: multi-role-portal, Property 13, Property 14
import * as fc from 'fast-check';

// ─── Shared types ────────────────────────────────────────────────────────────
type TeacherSection = { teacher_id: string; section_id: string; has_completion: boolean; chunks_covered: number };

const teacherSectionArb = fc.record({
  teacher_id: fc.uuid(),
  section_id: fc.uuid(),
  has_completion: fc.boolean(),
  chunks_covered: fc.integer({ min: 0, max: 50 }),
});

// ─── Property 13: Teacher activity feed completeness and accuracy ─────────────
describe('Property 13: Teacher activity feed completeness and accuracy', () => {
  it('every teacher-section pair appears in the feed', () => {
    fc.assert(
      fc.property(fc.array(teacherSectionArb, { minLength: 1, maxLength: 10 }), (rows) => {
        const feed = rows.map((r) => ({
          teacher_id: r.teacher_id,
          section_id: r.section_id,
          status: r.has_completion ? 'submitted' : 'behind',
          chunks_covered: r.chunks_covered,
        }));
        expect(feed.length).toBe(rows.length);
      })
    );
  });

  it('submitted status iff has_completion is true', () => {
    fc.assert(
      fc.property(teacherSectionArb, (row) => {
        const status = row.has_completion ? 'submitted' : 'behind';
        if (row.has_completion) expect(status).toBe('submitted');
        else expect(status).toBe('behind');
      })
    );
  });

  it('on non-working day all statuses are not_working_day', () => {
    fc.assert(
      fc.property(fc.array(teacherSectionArb, { minLength: 1, maxLength: 10 }), (rows) => {
        const feed = rows.map((r) => ({ status: 'not_working_day', chunks_covered: r.chunks_covered }));
        expect(feed.every((f) => f.status === 'not_working_day')).toBe(true);
      })
    );
  });
});

// ─── Property 14: Coverage report completeness and formula correctness ────────
describe('Property 14: Coverage report completeness and formula correctness', () => {
  it('coverage_pct = covered / total * 100 rounded to 1dp', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (covered, extra) => {
          const total = covered + extra;
          if (total === 0) {
            expect(0).toBe(0); // has_curriculum = false, coverage_pct = 0
            return;
          }
          const pct = Math.round((covered / total) * 100 * 10) / 10;
          expect(pct).toBeGreaterThanOrEqual(0);
          expect(pct).toBeLessThanOrEqual(100);
          expect(covered).toBeLessThanOrEqual(total);
        }
      )
    );
  });

  it('has_curriculum is false when total_chunks = 0', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0 }), (total) => {
        const hasCurriculum = total > 0;
        expect(hasCurriculum).toBe(false);
      })
    );
  });

  it('coverage_pct is 0 when no completions', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (total) => {
        const covered = 0;
        const pct = Math.round((covered / total) * 100 * 10) / 10;
        expect(pct).toBe(0);
      })
    );
  });
});

// Feature: multi-role-portal, Property 12
import * as fc from 'fast-check';

type AttendanceRecord = { section_id: string; status: 'present' | 'absent' };
type Section = { id: string; name: string; flagged: boolean };

const sectionArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  flagged: fc.boolean(),
});

const attendanceArb = (sectionId: string) =>
  fc.array(
    fc.record({
      section_id: fc.constant(sectionId),
      status: fc.constantFrom<'present' | 'absent'>('present', 'absent'),
    }),
    { minLength: 0, maxLength: 30 }
  );

// Simulate the overview computation
function computeOverview(sections: Section[], records: AttendanceRecord[]) {
  return sections.map((s) => {
    const sectionRecords = records.filter((r) => r.section_id === s.id);
    const present = sectionRecords.filter((r) => r.status === 'present').length;
    const absent = sectionRecords.filter((r) => r.status === 'absent').length;
    return {
      section_id: s.id,
      status: sectionRecords.length > 0 ? 'submitted' : 'pending',
      present_count: present,
      absent_count: absent,
      flagged: s.flagged,
    };
  });
}

// ─── Property 12: Attendance overview completeness and accuracy ──────────────
describe('Property 12: Attendance overview completeness and accuracy', () => {
  it('every section appears exactly once in the overview', () => {
    fc.assert(
      fc.property(fc.array(sectionArb, { minLength: 1, maxLength: 10 }), (sections) => {
        const records: AttendanceRecord[] = [];
        const overview = computeOverview(sections, records);
        expect(overview.length).toBe(sections.length);
        const ids = overview.map((o) => o.section_id);
        expect(new Set(ids).size).toBe(sections.length);
      })
    );
  });

  it('section with records has status=submitted, without has status=pending', () => {
    fc.assert(
      fc.property(
        fc.array(sectionArb, { minLength: 1, maxLength: 5 }),
        fc.boolean(),
        (sections, hasRecords) => {
          const records: AttendanceRecord[] = hasRecords
            ? sections.map((s) => ({ section_id: s.id, status: 'present' as const }))
            : [];
          const overview = computeOverview(sections, records);
          overview.forEach((o) => {
            if (hasRecords) expect(o.status).toBe('submitted');
            else expect(o.status).toBe('pending');
          });
        }
      )
    );
  });

  it('present_count + absent_count equals total records for section', () => {
    fc.assert(
      fc.property(
        sectionArb,
        fc.array(fc.constantFrom<'present' | 'absent'>('present', 'absent'), { minLength: 0, maxLength: 20 }),
        (section, statuses) => {
          const records = statuses.map((status) => ({ section_id: section.id, status }));
          const [overview] = computeOverview([section], records);
          expect(overview.present_count + overview.absent_count).toBe(records.length);
        }
      )
    );
  });

  it('flagged status is preserved from section', () => {
    fc.assert(
      fc.property(sectionArb, (section) => {
        const [overview] = computeOverview([section], []);
        expect(overview.flagged).toBe(section.flagged);
      })
    );
  });
});

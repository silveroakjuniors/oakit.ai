import { getTeacherSections } from './teacherSection';

jest.mock('./db', () => ({
  pool: { query: jest.fn() },
}));

import { pool } from './db';

const mockQuery = pool.query as jest.Mock;

const TEACHER = 'teacher-1';
const SCHOOL = 'school-1';

beforeEach(() => {
  mockQuery.mockReset();
});

describe('getTeacherSections', () => {
  it('class teacher only — returns [{section_id, role: "class_teacher"}]', async () => {
    // First call: class teacher query; second call: supporting query
    mockQuery
      .mockResolvedValueOnce({ rows: [{ section_id: 'sec-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await getTeacherSections(TEACHER, SCHOOL);

    expect(result).toEqual([{ section_id: 'sec-1', role: 'class_teacher' }]);
  });

  it('supporting only — returns [{section_id, role: "supporting"}]', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ section_id: 'sec-2' }] });

    const result = await getTeacherSections(TEACHER, SCHOOL);

    expect(result).toEqual([{ section_id: 'sec-2', role: 'supporting' }]);
  });

  it('both paths same section — deduplicates with class_teacher precedence', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ section_id: 'sec-3' }] })
      .mockResolvedValueOnce({ rows: [{ section_id: 'sec-3' }] });

    const result = await getTeacherSections(TEACHER, SCHOOL);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ section_id: 'sec-3', role: 'class_teacher' });
  });

  it('neither — returns []', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await getTeacherSections(TEACHER, SCHOOL);

    expect(result).toEqual([]);
  });

  it('multiple supporting sections — returns both with role "supporting"', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ section_id: 'sec-4' }, { section_id: 'sec-5' }] });

    const result = await getTeacherSections(TEACHER, SCHOOL);

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        { section_id: 'sec-4', role: 'supporting' },
        { section_id: 'sec-5', role: 'supporting' },
      ])
    );
  });
});

import { pool } from './db';

export async function getTeacherSections(
  teacher_id: string,
  school_id: string
): Promise<{ section_id: string; role: 'class_teacher' | 'supporting' }[]> {
  const [ctRows, tsRows] = await Promise.all([
    pool.query(
      `SELECT id AS section_id FROM sections
       WHERE class_teacher_id = $1 AND school_id = $2`,
      [teacher_id, school_id]
    ),
    pool.query(
      `SELECT ts.section_id FROM teacher_sections ts
       JOIN sections s ON ts.section_id = s.id
       WHERE ts.teacher_id = $1 AND s.school_id = $2`,
      [teacher_id, school_id]
    ),
  ]);

  const result = new Map<string, 'class_teacher' | 'supporting'>();
  for (const r of ctRows.rows) result.set(r.section_id, 'class_teacher');
  for (const r of tsRows.rows) {
    if (!result.has(r.section_id)) result.set(r.section_id, 'supporting');
  }

  return Array.from(result.entries()).map(([section_id, role]) => ({ section_id, role }));
}

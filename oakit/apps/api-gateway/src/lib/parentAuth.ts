/**
 * parentAuth.ts — Parent ownership verification helpers
 *
 * Centralises the repeated parent_student_links ownership check that was
 * previously copy-pasted across every parent route file.
 */

import { pool } from './db';

/**
 * Returns true if the given parent is linked to the given student
 * within the given school. Used to gate all parent-scoped endpoints.
 */
export async function verifyParentOwnsStudent(
  parentId: string,
  studentId: string,
  schoolId: string,
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM parent_student_links psl
     JOIN students s ON s.id = psl.student_id
     WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`,
    [parentId, studentId, schoolId],
  );
  return result.rows.length > 0;
}

/**
 * Returns all student IDs (and names) linked to a parent within a school.
 * Useful for list endpoints that need to scope data to the parent's children.
 */
export async function getParentStudents(
  parentId: string,
  schoolId: string,
): Promise<{ student_id: string; student_name: string }[]> {
  const result = await pool.query(
    `SELECT psl.student_id, s.name AS student_name
     FROM parent_student_links psl
     JOIN students s ON s.id = psl.student_id
     WHERE psl.parent_id = $1 AND s.school_id = $2 AND s.is_active = true`,
    [parentId, schoolId],
  );
  return result.rows;
}

/**
 * Returns true if the parent has at least one child in the given section.
 * Used to gate section-level endpoints (e.g. class announcements).
 */
export async function verifyParentHasChildInSection(
  parentId: string,
  sectionId: string,
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM parent_student_links psl
     JOIN students s ON s.id = psl.student_id
     WHERE psl.parent_id = $1 AND s.section_id = $2 LIMIT 1`,
    [parentId, sectionId],
  );
  return result.rows.length > 0;
}

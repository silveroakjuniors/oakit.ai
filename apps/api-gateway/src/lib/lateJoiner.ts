/**
 * Late Joiner Detection
 *
 * Determines whether a student is a "late joiner" — i.e., their admission date
 * falls more than 60 calendar days after the academic year start date.
 *
 * Pure functions — no DB access.
 */

export interface LateJoinerResult {
  is_late_joiner: boolean;
  days_late?: number;
  suggestion?: string;
}

/**
 * Returns the number of calendar days between two dates.
 * Returns a positive number when date2 > date1.
 * Uses UTC timestamps to avoid DST-related off-by-one errors.
 *
 * @param date1 - The earlier reference date.
 * @param date2 - The later date to measure from date1.
 * @returns Calendar days from date1 to date2 (positive when date2 > date1).
 */
export function daysBetween(date1: Date, date2: Date): number {
  return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Classifies a student as a late joiner when their admission_date is more than
 * 60 calendar days after the academic year start_date.
 *
 * @param admissionDate - The student's admission date.
 * @param academicYearStartDate - The start date of the current academic year.
 * @returns A LateJoinerResult indicating whether the student is a late joiner,
 *          and if so, how many days late and a suggested action.
 */
export function checkLateJoiner(
  admissionDate: Date,
  academicYearStartDate: Date,
): LateJoinerResult {
  const days = daysBetween(academicYearStartDate, admissionDate);

  if (days > 60) {
    return {
      is_late_joiner: true,
      days_late: days,
      suggestion:
        'Consider assigning term fee or applying a concession for the missed period.',
    };
  }

  return { is_late_joiner: false };
}

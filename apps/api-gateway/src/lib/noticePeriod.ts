/**
 * Notice Period Calculation
 *
 * Utility for computing the number of calendar days between a resignation
 * submission date and the staff member's last working day.
 */

/**
 * Calculate the notice period in calendar days.
 *
 * @param submissionDate - The date the resignation was submitted.
 * @param lastWorkingDay - The staff member's last working day.
 * @returns Number of calendar days between the two dates (non-negative).
 *          Returns 0 if lastWorkingDay is before submissionDate.
 */
export function calcNoticePeriodDays(submissionDate: Date, lastWorkingDay: Date): number {
  const days = Math.round(
    (lastWorkingDay.getTime() - submissionDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(0, days);
}

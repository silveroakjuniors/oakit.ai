/**
 * calendar/helpers.ts — Shared helpers for calendar sub-routes
 */

import { pool } from '../../../lib/db';

/**
 * When a full-day special day is added for a date that already has a scheduled plan,
 * mark that plan as the special day type (clear its chunks) and do NOT carry chunks
 * forward — carrying forward causes pile-up on the next teaching day.
 * Instead, the admin is warned to regenerate the affected months.
 * Returns the number of sections affected.
 */
export async function carryForwardDate(school_id: string, date: string): Promise<number> {
  const plans = await pool.query(
    `SELECT dp.id, dp.section_id, dp.chunk_ids, dp.status
     FROM day_plans dp
     JOIN sections s ON s.id = dp.section_id
     WHERE s.school_id = $1 AND dp.plan_date = $2
       AND dp.status = 'scheduled'
       AND dp.chunk_ids != '{}'`,
    [school_id, date],
  );

  if (plans.rows.length === 0) return 0;

  // Mark each affected plan as needing regeneration — clear chunks, set status to 'stale'
  // so the teacher sees "plan needs update" rather than wrong content.
  // Do NOT merge chunks onto the next day — that causes pile-up.
  for (const plan of plans.rows) {
    await pool.query(
      `UPDATE day_plans SET chunk_ids = '{}', status = 'stale' WHERE id = $1`,
      [plan.id],
    );
  }

  return plans.rows.length;
}

/**
 * Compute per-month status for each month in the academic year range.
 */
export function computeMonthsInRange(
  rangeStart: Date,
  rangeEnd: Date,
  wdSet: Set<number>,
  holidaySet: Set<string>,
  fullDaySpecialSet: Set<string>,
  planMap: Map<string, string[]>,
): Array<{ year: number; month: number; status: 'has_curriculum' | 'special_only' | 'no_working_days' }> {
  const result: Array<{ year: number; month: number; status: 'has_curriculum' | 'special_only' | 'no_working_days' }> = [];

  const startYear = rangeStart.getFullYear();
  const startMonth = rangeStart.getMonth();
  const endYear = rangeEnd.getFullYear();
  const endMonth = rangeEnd.getMonth();

  for (let y = startYear; y <= endYear; y++) {
    const mStart = y === startYear ? startMonth : 0;
    const mEnd = y === endYear ? endMonth : 11;

    for (let m = mStart; m <= mEnd; m++) {
      const monthStart = new Date(y, m, 1);
      const monthEnd = new Date(y, m + 1, 0);
      const iterStart = monthStart < rangeStart ? rangeStart : monthStart;
      const iterEnd = monthEnd > rangeEnd ? rangeEnd : monthEnd;

      let workingDayCount = 0;
      let hasCurriculum = false;
      let allSpecial = true;

      for (let d = new Date(iterStart); d <= iterEnd; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay() === 0 ? 7 : d.getDay();
        const iso = d.toISOString().split('T')[0];

        if (!wdSet.has(dow) || holidaySet.has(iso)) continue;

        workingDayCount++;

        const chunkIds = planMap.get(iso);
        if (chunkIds && chunkIds.length > 0) {
          hasCurriculum = true;
          allSpecial = false;
        } else if (!fullDaySpecialSet.has(iso)) {
          allSpecial = false;
        }
      }

      let status: 'has_curriculum' | 'special_only' | 'no_working_days';
      if (workingDayCount === 0) status = 'no_working_days';
      else if (hasCurriculum) status = 'has_curriculum';
      else if (allSpecial) status = 'special_only';
      else status = 'no_working_days';

      result.push({ year: y, month: m + 1, status });
    }
  }

  return result;
}

/**
 * calendar/helpers.ts — Shared helpers for calendar sub-routes
 */

import { pool } from '../../../lib/db';

/**
 * When a holiday or special day is added for a date that already has day plans,
 * carry the chunks from that date forward to the next available working day.
 * Returns the number of sections affected.
 */
export async function carryForwardDate(school_id: string, date: string): Promise<number> {
  const plans = await pool.query(
    `SELECT dp.id, dp.section_id, dp.chunk_ids
     FROM day_plans dp
     JOIN sections s ON s.id = dp.section_id
     WHERE s.school_id = $1 AND dp.plan_date = $2 AND dp.chunk_ids != '{}'`,
    [school_id, date],
  );

  if (plans.rows.length === 0) return 0;

  for (const plan of plans.rows) {
    const next = await pool.query(
      `SELECT id, chunk_ids FROM day_plans
       WHERE section_id = $1 AND plan_date > $2 AND status = 'scheduled'
       ORDER BY plan_date LIMIT 1`,
      [plan.section_id, date],
    );

    if (next.rows.length > 0) {
      const existing: string[] = next.rows[0].chunk_ids || [];
      const displaced: string[] = plan.chunk_ids || [];
      const merged = [...displaced, ...existing.filter((c: string) => !displaced.includes(c))];
      await pool.query('UPDATE day_plans SET chunk_ids = $1 WHERE id = $2', [merged, next.rows[0].id]);
    }

    await pool.query(
      `UPDATE day_plans SET chunk_ids = '{}', status = 'holiday' WHERE id = $1`,
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

/**
 * calendar/specialDays.ts — Special days CRUD routes
 * GET    /api/v1/admin/calendar/:year/special-days
 * POST   /api/v1/admin/calendar/:year/special-days
 * DELETE /api/v1/admin/calendar/:year/special-days/:id
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../../lib/db';
import { carryForwardDate } from './helpers';

export const specialDaysRouter = Router({ mergeParams: true });

// GET /:year/special-days
specialDaysRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT id, day_date::text as day_date, day_type, label, activity_note,
              to_char(start_time, 'HH24:MI') as start_time, to_char(end_time, 'HH24:MI') as end_time,
              duration_type, revision_topics
       FROM special_days WHERE school_id = $1 AND academic_year = $2 ORDER BY day_date`,
      [school_id, req.params.year],
    );

    // Group consecutive dates with same label+type into ranges
    const rows = result.rows;
    const groups: any[] = [];
    for (const row of rows) {
      const last = groups[groups.length - 1];
      if (
        last &&
        last.label === row.label &&
        last.day_type === row.day_type &&
        last.activity_note === row.activity_note &&
        last.start_time === row.start_time &&
        last.end_time === row.end_time &&
        last.duration_type === row.duration_type
      ) {
        last.to_date = row.day_date;
        last.count++;
        last.ids.push(row.id);
      } else {
        groups.push({
          ids: [row.id],
          from_date: row.day_date,
          to_date: row.day_date,
          day_type: row.day_type,
          label: row.label,
          activity_note: row.activity_note,
          start_time: row.start_time,
          end_time: row.end_time,
          duration_type: row.duration_type,
          revision_topics: row.revision_topics,
          count: 1,
        });
      }
    }
    return res.json(groups);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:year/special-days
specialDaysRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { day_date, from_date, to_date, day_type, label, activity_note, start_time, end_time, duration_type, revision_topics } = req.body;

    if (!day_type || !label) return res.status(400).json({ error: 'day_type and label are required' });

    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(day_type)) {
      return res.status(400).json({ error: 'day_type must be alphanumeric/underscore/hyphen, max 50 chars' });
    }

    const resolvedDurationType: string = duration_type || 'full_day';
    if (!['full_day', 'half_day'].includes(resolvedDurationType)) {
      return res.status(400).json({ error: 'duration_type must be full_day or half_day' });
    }

    const resolvedRevisionTopics: string[] = Array.isArray(revision_topics) ? revision_topics : [];
    for (const topic of resolvedRevisionTopics) {
      if (typeof topic === 'string' && topic.length > 200) {
        return res.status(400).json({ error: 'revision_topics entries must be ≤ 200 characters' });
      }
    }

    // Build list of dates
    const allDates: string[] = [];
    if (from_date && to_date) {
      for (let d = new Date(from_date); d <= new Date(to_date); d.setDate(d.getDate() + 1)) {
        allDates.push(d.toISOString().split('T')[0]);
      }
    } else if (day_date) {
      allDates.push(day_date);
    } else {
      return res.status(400).json({ error: 'Either day_date or from_date+to_date is required' });
    }

    // Filter out non-working days
    const calRow = await pool.query(
      'SELECT working_days FROM school_calendar WHERE school_id = $1 AND academic_year = $2',
      [school_id, req.params.year],
    );
    const workingDayNums: Set<number> = calRow.rows.length > 0
      ? new Set<number>(calRow.rows[0].working_days)
      : new Set<number>([1, 2, 3, 4, 5]);

    const holidayRows = await pool.query(
      'SELECT holiday_date::text FROM holidays WHERE school_id = $1 AND academic_year = $2',
      [school_id, req.params.year],
    );
    const holidaySet = new Set<string>(holidayRows.rows.map((r: any) => r.holiday_date.split('T')[0]));

    const dates: string[] = [];
    const skipped: string[] = [];
    for (const d of allDates) {
      const dt = new Date(d + 'T12:00:00');
      const dow = dt.getDay() === 0 ? 7 : dt.getDay();
      if (!workingDayNums.has(dow) || holidaySet.has(d)) skipped.push(d);
      else dates.push(d);
    }

    if (dates.length === 0) {
      return res.status(400).json({
        error: 'None of the selected dates are working days.',
        skipped,
      });
    }

    const inserted: any[] = [];
    for (const d of dates) {
      const result = await pool.query(
        `INSERT INTO special_days (school_id, academic_year, day_date, day_type, label, activity_note, start_time, end_time, duration_type, revision_topics)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (school_id, academic_year, day_date) DO UPDATE
         SET day_type = EXCLUDED.day_type, label = EXCLUDED.label, activity_note = EXCLUDED.activity_note,
             start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
             duration_type = EXCLUDED.duration_type, revision_topics = EXCLUDED.revision_topics
         RETURNING *`,
        [school_id, req.params.year, d, day_type, label, activity_note || null, start_time || null, end_time || null, resolvedDurationType, resolvedRevisionTopics],
      );
      inserted.push(result.rows[0]);
    }

    let impacted = 0;
    for (const d of dates) {
      impacted += await carryForwardDate(school_id, d);
    }

    return res.status(201).json({
      created: inserted.length,
      skipped_non_working: skipped,
      plans_affected: impacted,
      message: skipped.length > 0
        ? `${inserted.length} day(s) added (${skipped.length} non-working day(s) skipped). ${impacted > 0 ? `${impacted} section plan(s) carried forward.` : ''}`
        : impacted > 0
          ? `${inserted.length} day(s) added. ${impacted} section plan(s) carried forward.`
          : `${inserted.length} day(s) added.`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:year/special-days/:id
specialDaysRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    await pool.query('DELETE FROM special_days WHERE id = $1 AND school_id = $2', [req.params.id, school_id]);
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

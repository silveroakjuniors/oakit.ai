/**
 * calendar/setup.ts — School calendar configuration routes
 * GET /api/v1/admin/calendar
 * POST /api/v1/admin/calendar
 * GET /api/v1/admin/calendar/summary
 * GET /api/v1/admin/calendar/academic-years
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../../lib/db';

export const setupRouter = Router();

// GET /api/v1/admin/calendar/academic-years
setupRouter.get('/academic-years', (_req: Request, res: Response) => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let i = 0; i < 10; i++) {
    const y = currentYear + i;
    const next = (y + 1) % 100;
    years.push(`${y}-${String(next).padStart(2, '0')}`);
  }
  return res.json(years);
});

// GET /api/v1/admin/calendar/summary
setupRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const calRow = await pool.query(
      'SELECT academic_year, working_days, start_date, end_date FROM school_calendar WHERE school_id = $1 ORDER BY start_date DESC LIMIT 1',
      [school_id],
    );
    if (calRow.rows.length === 0) return res.json(null);
    const { academic_year, working_days, start_date, end_date } = calRow.rows[0];
    const wdSet = new Set<number>(working_days);

    const holidayRows = await pool.query(
      'SELECT holiday_date::text FROM holidays WHERE school_id = $1 AND academic_year = $2',
      [school_id, academic_year],
    );
    const holidaySet = new Set(holidayRows.rows.map((r: any) => r.holiday_date));

    const specialRows = await pool.query(
      `SELECT day_type, COUNT(*)::int as count FROM special_days
       WHERE school_id = $1 AND academic_year = $2 GROUP BY day_type`,
      [school_id, academic_year],
    );
    const specialCounts: Record<string, number> = {};
    for (const r of specialRows.rows) specialCounts[r.day_type] = r.count;

    let workingDayCount = 0;
    for (let d = new Date(start_date); d <= new Date(end_date); d.setDate(d.getDate() + 1)) {
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      const iso = d.toISOString().split('T')[0];
      if (wdSet.has(dow) && !holidaySet.has(iso)) workingDayCount++;
    }

    return res.json({ academic_year, working_day_count: workingDayCount, holiday_count: holidayRows.rows.length, special_days: specialCounts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/calendar
setupRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT id, school_id, academic_year, working_days,
              start_date::text AS start_date, end_date::text AS end_date, holidays
       FROM school_calendar WHERE school_id = $1 ORDER BY academic_year DESC`,
      [school_id],
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/calendar
setupRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { academic_year, working_days, start_date, end_date } = req.body;
    if (!academic_year || !working_days || !start_date || !end_date) {
      return res.status(400).json({ error: 'academic_year, working_days, start_date, end_date are required' });
    }
    const result = await pool.query(
      `INSERT INTO school_calendar (school_id, academic_year, working_days, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (school_id, academic_year) DO UPDATE
       SET working_days = EXCLUDED.working_days, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date
       RETURNING id, school_id, academic_year, working_days,
                 start_date::text AS start_date, end_date::text AS end_date`,
      [school_id, academic_year, working_days, start_date, end_date],
    );

    const holidayRows = await pool.query(
      'SELECT holiday_date FROM holidays WHERE school_id = $1 AND academic_year = $2',
      [school_id, academic_year],
    );
    const holidaySet = new Set(holidayRows.rows.map((r: any) => r.holiday_date.toISOString().split('T')[0]));

    const wdSet = new Set<number>(working_days);
    let workingDayCount = 0;
    for (let d = new Date(start_date); d <= new Date(end_date); d.setDate(d.getDate() + 1)) {
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      const iso = d.toISOString().split('T')[0];
      if (wdSet.has(dow) && !holidaySet.has(iso)) workingDayCount++;
    }

    return res.json({ ...result.rows[0], working_day_count: workingDayCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

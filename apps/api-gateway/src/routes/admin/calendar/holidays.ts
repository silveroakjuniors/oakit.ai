/**
 * calendar/holidays.ts — Holiday CRUD + import routes
 * GET    /api/v1/admin/calendar/:year/holidays
 * POST   /api/v1/admin/calendar/:year/holidays
 * PUT    /api/v1/admin/calendar/:year/holidays/:id
 * DELETE /api/v1/admin/calendar/:year/holidays/:id
 * POST   /api/v1/admin/calendar/:year/holidays/import
 * GET    /api/v1/admin/calendar/:year/holidays/export
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../../../lib/db';
import { carryForwardDate } from './helpers';

export const holidaysRouter = Router({ mergeParams: true });

const AI = () => {
  const url = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
  } catch {
    return 'http://localhost:8000';
  }
  return url;
};

const upload = multer({
  dest: '/tmp/oakit-uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Only .xlsx, .xls or .csv files are allowed'));
  },
});

try { fs.mkdirSync('/tmp/oakit-uploads/', { recursive: true }); } catch { /* already exists */ }

// GET /:year/holidays/export
holidaysRouter.get('/export', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { year } = req.params;

    const calRow = await pool.query(
      'SELECT working_days FROM school_calendar WHERE school_id = $1 ORDER BY start_date DESC LIMIT 1',
      [school_id],
    );
    const workingDayNums: number[] = calRow.rows[0]?.working_days || [1, 2, 3, 4, 5];

    const result = await pool.query(
      'SELECT holiday_date, event_name FROM holidays WHERE school_id = $1 AND academic_year = $2 ORDER BY holiday_date',
      [school_id, year],
    );

    const holidays = result.rows.filter((h: any) => {
      const dt = new Date(h.holiday_date);
      const dow = dt.getDay() === 0 ? 7 : dt.getDay();
      return workingDayNums.includes(dow);
    });

    const aiResp = await axios.post(`${AI()}/internal/export-holiday-pdf`, {
      academic_year: year,
      holidays: holidays.map((h: any) => ({
        date: new Date(h.holiday_date).toISOString().split('T')[0],
        event_name: h.event_name,
      })),
    }, { responseType: 'arraybuffer', timeout: 15000 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="holidays-${year}.pdf"`);
    return res.send(Buffer.from(aiResp.data));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:year/holidays
holidaysRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { year } = req.params;
    const result = await pool.query(
      `SELECT id, holiday_date::text as holiday_date, event_name, created_at
       FROM holidays WHERE school_id = $1 AND academic_year = $2 ORDER BY holiday_date`,
      [school_id, year],
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:year/holidays
holidaysRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { year } = req.params;
    const { holiday_date, event_name } = req.body;
    if (!holiday_date || !event_name) {
      return res.status(400).json({ error: 'holiday_date and event_name are required' });
    }
    const result = await pool.query(
      `INSERT INTO holidays (school_id, academic_year, holiday_date, event_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (school_id, academic_year, holiday_date) DO UPDATE SET event_name = EXCLUDED.event_name
       RETURNING id, holiday_date::text as holiday_date, event_name`,
      [school_id, year, holiday_date, event_name],
    );

    const impacted = await carryForwardDate(school_id, holiday_date);

    return res.status(201).json({
      ...result.rows[0],
      plans_affected: impacted,
      message: impacted > 0
        ? `Holiday added. ${impacted} section plan(s) carried forward to the next working day.`
        : 'Holiday added.',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:year/holidays/:id
holidaysRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { year, id } = req.params;
    const { holiday_date, event_name } = req.body;
    if (!holiday_date || !event_name) return res.status(400).json({ error: 'holiday_date and event_name are required' });
    const result = await pool.query(
      `UPDATE holidays SET holiday_date = $1, event_name = $2
       WHERE id = $3 AND school_id = $4 AND academic_year = $5
       RETURNING id, holiday_date::text as holiday_date, event_name`,
      [holiday_date, event_name, id, school_id, year],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Holiday not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:year/holidays/:id
holidaysRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { year, id } = req.params;
    await pool.query(
      'DELETE FROM holidays WHERE id = $1 AND school_id = $2 AND academic_year = $3',
      [id, school_id, year],
    );
    return res.json({ message: 'Holiday deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:year/holidays/import
holidaysRouter.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  const file = req.file;
  try {
    const { school_id } = req.user!;
    const { year } = req.params;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const { parseSpreadsheet, findHeader, parseDate, sanitizeCell } = require('../../../lib/spreadsheetImport');
    const content = require('fs').readFileSync(file.path);
    const { rows, headers, error: parseError } = parseSpreadsheet(content);

    if (parseError) return res.status(400).json({ error: parseError });

    const dateCol = findHeader(headers, ['date']);
    const nameCol = findHeader(headers, ['description', 'event_name', 'event name', 'event', 'name', 'holiday name', 'holiday']);
    const typeCol = findHeader(headers, ['type', 'day type', 'category']);

    if (!dateCol) return res.status(400).json({ error: `Missing 'date' column. Found: ${headers.join(', ')}` });
    if (!nameCol) return res.status(400).json({ error: `Missing 'description' column. Found: ${headers.join(', ')}` });

    const skipped: any[] = [];
    let created = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const eventName = sanitizeCell(row[nameCol], 255);
      const rowType = sanitizeCell(row[typeCol ?? ''] || '', 50).toLowerCase();
      const rawDate = sanitizeCell(row[dateCol] || '', 20);

      if (!eventName) { skipped.push({ row: i + 2, reason: 'Missing event name' }); continue; }
      if (['working day', 'working', 'school day'].includes(rowType)) {
        skipped.push({ row: i + 2, reason: `Skipped: type '${rowType}' is not a holiday` }); continue;
      }

      const parsedDate = parseDate(rawDate);
      if (!parsedDate) { skipped.push({ row: i + 2, reason: `Invalid date '${rawDate}' — use DD-MM-YYYY` }); continue; }

      const dow = new Date(parsedDate).getDay();
      if (dow === 0 || dow === 6) {
        skipped.push({ row: i + 2, reason: `Skipped: ${parsedDate} is a weekend` }); continue;
      }

      try {
        const result = await pool.query(
          `INSERT INTO holidays (school_id, academic_year, holiday_date, event_name)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (school_id, academic_year, holiday_date) DO NOTHING
           RETURNING id`,
          [school_id, year, parsedDate, eventName],
        );
        if (result.rowCount && result.rowCount > 0) created++;
        else skipped.push({ row: i + 2, reason: `Duplicate: ${parsedDate} already exists` });
      } catch (e: any) {
        skipped.push({ row: i + 2, reason: `DB insert failed: ${e?.message || e}` });
      }
    }

    return res.json({ created, skipped });
  } catch (err: unknown) {
    console.error('[holiday-import]', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Import failed' });
  } finally {
    if (file) fs.unlink(file.path, () => {});
  }
});

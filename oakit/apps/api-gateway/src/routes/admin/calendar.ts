import { Router, Request, Response } from 'express';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin'));

const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

const upload = multer({ dest: '/tmp/oakit-uploads/' });

/**
 * When a holiday or special day is added for a date that already has day plans,
 * carry the chunks from that date forward to the next available working day.
 * Returns the number of sections affected.
 */
async function _carryForwardDate(pool: any, school_id: string, date: string): Promise<number> {
  // Find all day plans for this school on this date that have chunks
  const plans = await pool.query(
    `SELECT dp.id, dp.section_id, dp.chunk_ids
     FROM day_plans dp
     JOIN sections s ON s.id = dp.section_id
     WHERE s.school_id = $1 AND dp.plan_date = $2 AND dp.chunk_ids != '{}'`,
    [school_id, date]
  );

  if (plans.rows.length === 0) return 0;

  for (const plan of plans.rows) {
    // Find the next day plan for this section that is after this date
    const next = await pool.query(
      `SELECT id, chunk_ids FROM day_plans
       WHERE section_id = $1 AND plan_date > $2 AND status = 'scheduled'
       ORDER BY plan_date LIMIT 1`,
      [plan.section_id, date]
    );

    if (next.rows.length > 0) {
      // Prepend displaced chunks to the next day's plan (avoid duplicates)
      const existing: string[] = next.rows[0].chunk_ids || [];
      const displaced: string[] = plan.chunk_ids || [];
      const merged = [...displaced, ...existing.filter((c: string) => !displaced.includes(c))];
      await pool.query(
        'UPDATE day_plans SET chunk_ids = $1 WHERE id = $2',
        [merged, next.rows[0].id]
      );
    }

    // Clear the holiday day's plan
    await pool.query(
      `UPDATE day_plans SET chunk_ids = '{}', status = 'holiday' WHERE id = $1`,
      [plan.id]
    );
  }

  return plans.rows.length;
}

// GET /api/v1/admin/calendar/plan-summary
// Returns pre-generation summary: chunk count vs available days, fit, and recommendation.
// Query params: class_id (required), academic_year (required), month (optional), plan_year (optional)
router.get('/plan-summary', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, academic_year, month, plan_year } = req.query as Record<string, string | undefined>;

    if (!class_id || !academic_year) {
      return res.status(400).json({ error: 'class_id and academic_year are required' });
    }

    // 1. Get school calendar for this school + academic_year
    const calRow = await pool.query(
      `SELECT start_date, end_date, working_days FROM school_calendar
       WHERE school_id = $1 AND academic_year = $2`,
      [school_id, academic_year]
    );
    if (calRow.rows.length === 0) {
      return res.status(404).json({ error: 'School calendar not configured for this academic year' });
    }
    const { start_date, end_date, working_days } = calRow.rows[0];
    const wdSet = new Set<number>(working_days as number[]);

    // 2. Get holidays for the academic year
    const holidayRows = await pool.query(
      `SELECT holiday_date FROM holidays WHERE school_id = $1 AND academic_year = $2`,
      [school_id, academic_year]
    );
    const holidaySet = new Set<string>(
      holidayRows.rows.map((r: any) => new Date(r.holiday_date).toISOString().split('T')[0])
    );

    // 3. Get special days for the academic year, grouped by duration_type
    const specialRows = await pool.query(
      `SELECT day_date, day_type, duration_type FROM special_days
       WHERE school_id = $1 AND academic_year = $2`,
      [school_id, academic_year]
    );

    // Build special day maps
    const fullDaySpecialSet = new Set<string>();
    const halfDaySpecialSet = new Set<string>();
    // breakdown: { [day_type]: { full_day: number, half_day: number } }
    const specialDayBreakdown: Record<string, { full_day: number; half_day: number }> = {};

    for (const r of specialRows.rows) {
      const iso = new Date(r.day_date).toISOString().split('T')[0];
      const durationType: string = r.duration_type || 'full_day';
      const dayType: string = r.day_type;

      if (durationType === 'half_day') {
        halfDaySpecialSet.add(iso);
      } else {
        fullDaySpecialSet.add(iso);
      }

      if (!specialDayBreakdown[dayType]) {
        specialDayBreakdown[dayType] = { full_day: 0, half_day: 0 };
      }
      if (durationType === 'half_day') {
        specialDayBreakdown[dayType].half_day++;
      } else {
        specialDayBreakdown[dayType].full_day++;
      }
    }

    // 4. Get curriculum chunk count for the class
    const chunkRow = await pool.query(
      `SELECT COUNT(*)::int as total_chunks FROM curriculum_chunks WHERE class_id = $1`,
      [class_id]
    );
    const totalChunks: number = chunkRow.rows[0]?.total_chunks ?? 0;

    // Handle zero-chunks edge case
    if (totalChunks === 0) {
      return res.json({
        total_chunks: 0,
        fit: 'under',
        recommendation: 'No curriculum uploaded for this class.',
      });
    }

    // 5. Compute working days in the range (respecting optional month filter)
    let rangeStart = new Date(start_date);
    let rangeEnd = new Date(end_date);

    if (month && plan_year) {
      const m = parseInt(month, 10);
      const y = parseInt(plan_year, 10);
      const monthStart = new Date(y, m - 1, 1);
      const monthEnd = new Date(y, m, 0); // last day of month
      if (monthStart > rangeStart) rangeStart = monthStart;
      if (monthEnd < rangeEnd) rangeEnd = monthEnd;
    }

    let workingDaysCount = 0;
    let fullDaySpecialCount = 0;
    let halfDaySpecialCount = 0;

    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon..7=Sun
      const iso = d.toISOString().split('T')[0];

      if (!wdSet.has(dow) || holidaySet.has(iso)) continue;

      workingDaysCount++;

      if (fullDaySpecialSet.has(iso)) {
        fullDaySpecialCount++;
      } else if (halfDaySpecialSet.has(iso)) {
        halfDaySpecialCount++;
      }
    }

    // 6. Compute net_curriculum_days
    // net = working_days - full_day_specials + 0.5 * half_day_specials
    // (full-day specials consume a working day but give 0 curriculum days;
    //  half-day specials consume a working day but give 0.5 curriculum days)
    const netCurriculumDays = workingDaysCount - fullDaySpecialCount + 0.5 * halfDaySpecialCount;

    // 7. Compute fit
    let fit: 'exact' | 'under' | 'over';
    if (totalChunks === netCurriculumDays) {
      fit = 'exact';
    } else if (totalChunks < netCurriculumDays) {
      fit = 'under';
    } else {
      fit = 'over';
    }

    // 8. Generate recommendation
    let recommendation: string;
    if (fit === 'exact') {
      recommendation = 'Curriculum fits exactly — every available day will receive one chunk.';
    } else if (fit === 'under') {
      recommendation = 'Curriculum is shorter than available days. Chunks will cycle. Consider adding more curriculum content.';
    } else {
      recommendation = 'Curriculum is longer than available days. Not all content will be covered. Consider adding more special days or extending the calendar.';
    }

    return res.json({
      total_chunks: totalChunks,
      total_working_days: workingDaysCount,
      net_curriculum_days: netCurriculumDays,
      special_day_breakdown: specialDayBreakdown,
      fit,
      recommendation,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/calendar/coverage-report
// Query params: class_id (required), section_id (required), academic_year (required)
router.get('/coverage-report', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, section_id, academic_year } = req.query as Record<string, string | undefined>;

    if (!class_id || !section_id || !academic_year) {
      return res.status(400).json({ error: 'class_id, section_id, and academic_year are required' });
    }

    // 1. Get school calendar for date range and working days config
    const calRow = await pool.query(
      `SELECT start_date, end_date, working_days FROM school_calendar
       WHERE school_id = $1 AND academic_year = $2`,
      [school_id, academic_year]
    );
    if (calRow.rows.length === 0) {
      return res.status(404).json({ error: 'School calendar not configured for this academic year' });
    }
    const { start_date, end_date, working_days } = calRow.rows[0];
    const wdSet = new Set<number>(working_days as number[]);

    // 2. Get holidays for the academic year
    const holidayRows = await pool.query(
      `SELECT holiday_date FROM holidays WHERE school_id = $1 AND academic_year = $2`,
      [school_id, academic_year]
    );
    const holidaySet = new Set<string>(
      holidayRows.rows.map((r: any) => new Date(r.holiday_date).toISOString().split('T')[0])
    );

    // 3. Get special days (full-day only — these are working days with empty chunk_ids)
    const specialRows = await pool.query(
      `SELECT day_date, duration_type FROM special_days
       WHERE school_id = $1 AND academic_year = $2`,
      [school_id, academic_year]
    );
    const fullDaySpecialSet = new Set<string>();
    for (const r of specialRows.rows) {
      const iso = new Date(r.day_date).toISOString().split('T')[0];
      if ((r.duration_type || 'full_day') === 'full_day') {
        fullDaySpecialSet.add(iso);
      }
    }

    // 4. Get all day_plans for this section in the academic year, ordered by plan_date
    const planRows = await pool.query(
      `SELECT plan_date::text as plan_date, chunk_ids
       FROM day_plans
       WHERE section_id = $1 AND school_id = $2
         AND plan_date >= $3 AND plan_date <= $4
       ORDER BY plan_date`,
      [section_id, school_id, start_date, end_date]
    );

    // 5. Get total chunks for the class
    const chunkRow = await pool.query(
      `SELECT COUNT(*)::int as total_chunks FROM curriculum_chunks WHERE class_id = $1`,
      [class_id]
    );
    const totalChunks: number = chunkRow.rows[0]?.total_chunks ?? 0;

    // If no plans exist, return empty arrays
    if (planRows.rows.length === 0) {
      // Still compute months from the calendar range
      const months = _computeMonthsInRange(new Date(start_date), new Date(end_date), wdSet, holidaySet, fullDaySpecialSet, new Map());
      return res.json({
        months,
        cycled_days: [],
        unique_chunks_covered: 0,
        total_chunks: totalChunks,
      });
    }

    // 6. Build a map of date -> chunk_ids from day_plans
    const planMap = new Map<string, string[]>();
    for (const row of planRows.rows) {
      const iso = row.plan_date.split('T')[0];
      planMap.set(iso, row.chunk_ids || []);
    }

    // 7. Detect cycled days: collect chunk_ids in chronological order;
    //    flag any date whose chunks ALL appeared on an earlier date
    const seenChunks = new Set<string>();
    const cycledDays: Array<{ date: string; chunk_ids: string[] }> = [];

    for (const row of planRows.rows) {
      const iso = row.plan_date.split('T')[0];
      const chunkIds: string[] = row.chunk_ids || [];
      if (chunkIds.length === 0) continue;

      const allSeen = chunkIds.every(id => seenChunks.has(id));
      if (allSeen) {
        cycledDays.push({ date: iso, chunk_ids: chunkIds });
      } else {
        for (const id of chunkIds) seenChunks.add(id);
      }
    }

    const uniqueChunksCovered = seenChunks.size;

    // 8. Compute per-month status
    const months = _computeMonthsInRange(new Date(start_date), new Date(end_date), wdSet, holidaySet, fullDaySpecialSet, planMap);

    return res.json({
      months,
      cycled_days: cycledDays,
      unique_chunks_covered: uniqueChunksCovered,
      total_chunks: totalChunks,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Compute per-month status for each month in the academic year range.
 * - has_curriculum: any day_plan in that month has non-empty chunk_ids
 * - special_only: all working days are full-day special days (empty chunk_ids)
 * - no_working_days: no working days exist in that month
 */
function _computeMonthsInRange(
  rangeStart: Date,
  rangeEnd: Date,
  wdSet: Set<number>,
  holidaySet: Set<string>,
  fullDaySpecialSet: Set<string>,
  planMap: Map<string, string[]>
): Array<{ year: number; month: number; status: 'has_curriculum' | 'special_only' | 'no_working_days' }> {
  const result: Array<{ year: number; month: number; status: 'has_curriculum' | 'special_only' | 'no_working_days' }> = [];

  // Enumerate each month in the range
  const startYear = rangeStart.getFullYear();
  const startMonth = rangeStart.getMonth(); // 0-indexed
  const endYear = rangeEnd.getFullYear();
  const endMonth = rangeEnd.getMonth(); // 0-indexed

  for (let y = startYear; y <= endYear; y++) {
    const mStart = y === startYear ? startMonth : 0;
    const mEnd = y === endYear ? endMonth : 11;

    for (let m = mStart; m <= mEnd; m++) {
      // Clamp day iteration to the academic year range
      const monthStart = new Date(y, m, 1);
      const monthEnd = new Date(y, m + 1, 0); // last day of month
      const iterStart = monthStart < rangeStart ? rangeStart : monthStart;
      const iterEnd = monthEnd > rangeEnd ? rangeEnd : monthEnd;

      let workingDayCount = 0;
      let hasCurriculum = false;
      let allSpecial = true;

      for (let d = new Date(iterStart); d <= iterEnd; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon..7=Sun
        const iso = d.toISOString().split('T')[0];

        if (!wdSet.has(dow) || holidaySet.has(iso)) continue;

        workingDayCount++;

        const chunkIds = planMap.get(iso);
        if (chunkIds && chunkIds.length > 0) {
          hasCurriculum = true;
          allSpecial = false;
        } else if (!fullDaySpecialSet.has(iso)) {
          // Working day that is not a special day and has no curriculum
          allSpecial = false;
        }
      }

      let status: 'has_curriculum' | 'special_only' | 'no_working_days';
      if (workingDayCount === 0) {
        status = 'no_working_days';
      } else if (hasCurriculum) {
        status = 'has_curriculum';
      } else if (allSpecial) {
        status = 'special_only';
      } else {
        // Working days exist but no curriculum and not all special — treat as no_working_days equivalent
        status = 'no_working_days';
      }

      result.push({ year: y, month: m + 1, status });
    }
  }

  return result;
}

// GET /api/v1/admin/calendar/plans — list all generated plan summaries (class/section/month)
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;

    // Get all sections with class teacher, supporting teachers, curriculum doc, and plan months
    const sectionsResult = await pool.query(
      `SELECT
         s.id as section_id,
         s.label as section_label,
         c.id as class_id,
         c.name as class_name,
         ct.name as class_teacher_name,
         ct.id as class_teacher_id,
         COALESCE(
           (SELECT json_agg(json_build_object('id', su.id, 'name', su.name))
            FROM teacher_sections ts2
            JOIN users su ON su.id = ts2.teacher_id
            WHERE ts2.section_id = s.id AND su.id IS DISTINCT FROM s.class_teacher_id),
           '[]'
         ) as supporting_teachers,
         cd.filename as curriculum_filename,
         cd.total_chunks,
         cd.status as curriculum_status
       FROM sections s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN users ct ON ct.id = s.class_teacher_id
       LEFT JOIN curriculum_documents cd ON cd.class_id = c.id AND cd.school_id = s.school_id AND cd.status = 'ready'
       WHERE s.school_id = $1
       ORDER BY c.name, s.label`,
      [school_id]
    );

    // Get plan months per section
    const plansResult = await pool.query(
      `SELECT
         s.id as section_id,
         EXTRACT(YEAR FROM dp.plan_date)::int as plan_year,
         EXTRACT(MONTH FROM dp.plan_date)::int as plan_month,
         COUNT(dp.id) as days_count
       FROM day_plans dp
       JOIN sections s ON s.id = dp.section_id
       WHERE s.school_id = $1 AND dp.chunk_ids != '{}'
       GROUP BY s.id, plan_year, plan_month
       ORDER BY plan_year, plan_month`,
      [school_id]
    );

    // Group plans by section
    const plansBySection = new Map<string, any[]>();
    for (const p of plansResult.rows) {
      if (!plansBySection.has(p.section_id)) plansBySection.set(p.section_id, []);
      plansBySection.get(p.section_id)!.push(p);
    }

    const sections = sectionsResult.rows.map((s: any) => ({
      ...s,
      plans: plansBySection.get(s.section_id) || [],
    }));

    return res.json(sections);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/calendar/plans/:section_id — view plans for a section by month
router.get('/plans/:section_id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { section_id } = req.params;
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // last day of month

    const result = await pool.query(
      `SELECT dp.plan_date, dp.status,
              COALESCE(json_agg(json_build_object('topic_label', cc.topic_label) ORDER BY cc.chunk_index)
                FILTER (WHERE cc.id IS NOT NULL), '[]') as chunks
       FROM day_plans dp
       LEFT JOIN curriculum_chunks cc ON cc.id = ANY(dp.chunk_ids)
       WHERE dp.section_id = $1 AND dp.school_id = $2
         AND EXTRACT(MONTH FROM dp.plan_date) = $3
         AND EXTRACT(YEAR FROM dp.plan_date) = $4
         AND dp.chunk_ids != '{}'
       GROUP BY dp.plan_date, dp.status
       ORDER BY dp.plan_date`,
      [section_id, school_id, month, year]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/calendar/plans/:section_id/export — export monthly plan as PDF
router.get('/plans/:section_id/export', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { section_id } = req.params;
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Get section + class info
    const secRow = await pool.query(
      `SELECT s.label, c.name as class_name FROM sections s JOIN classes c ON c.id = s.class_id WHERE s.id = $1 AND s.school_id = $2`,
      [section_id, school_id]
    );
    if (secRow.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
    const { label, class_name } = secRow.rows[0];

    // Get school calendar working days config
    const calRow = await pool.query(
      `SELECT working_days, academic_year FROM school_calendar
       WHERE school_id = $1 ORDER BY start_date DESC LIMIT 1`,
      [school_id]
    );
    const workingDayNums: number[] = calRow.rows[0]?.working_days || [1,2,3,4,5]; // 1=Mon..7=Sun
    const academicYear = calRow.rows[0]?.academic_year || '';

    // Get holidays for this academic year
    const holidayRows = await pool.query(
      'SELECT holiday_date, event_name FROM holidays WHERE school_id = $1 AND academic_year = $2',
      [school_id, academicYear]
    );
    const holidayMap = new Map<string, string>();
    for (const h of holidayRows.rows) {
      const iso = new Date(h.holiday_date).toISOString().split('T')[0];
      holidayMap.set(iso, h.event_name);
    }

    // Get day plans with chunks for this month
    const planRows = await pool.query(
      `SELECT dp.plan_date::text as plan_date,
              COALESCE(json_agg(json_build_object(
                'topic_label', cc.topic_label,
                'content', cc.content,
                'activity_ids', cc.activity_ids
              ) ORDER BY cc.chunk_index)
                FILTER (WHERE cc.id IS NOT NULL), '[]') as chunks
       FROM day_plans dp
       LEFT JOIN curriculum_chunks cc ON cc.id = ANY(dp.chunk_ids)
       WHERE dp.section_id = $1 AND dp.school_id = $2
         AND EXTRACT(MONTH FROM dp.plan_date) = $3
         AND EXTRACT(YEAR FROM dp.plan_date) = $4
       GROUP BY dp.plan_date ORDER BY dp.plan_date`,
      [section_id, school_id, month, year]
    );
    const planMap = new Map<string, any[]>();
    for (const row of planRows.rows) {
      const iso = row.plan_date.split('T')[0];
      planMap.set(iso, row.chunks || []);
    }

    // Build full calendar for the month — every day
    const daysInMonth = new Date(year, month, 0).getDate();
    const allDays: { date: string; type: 'working' | 'weekend' | 'holiday'; label?: string; chunks?: any[] }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month - 1, d);
      const iso = dt.toISOString().split('T')[0];
      // JS: 0=Sun,1=Mon..6=Sat → convert to 1=Mon..7=Sun
      const dow = dt.getDay() === 0 ? 7 : dt.getDay();

      if (holidayMap.has(iso)) {
        allDays.push({ date: iso, type: 'holiday', label: holidayMap.get(iso) });
      } else if (!workingDayNums.includes(dow)) {
        allDays.push({ date: iso, type: 'weekend' });
      } else {
        const chunks = planMap.get(iso) || [];
        allDays.push({ date: iso, type: 'working', chunks });
      }
    }

    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    const aiResp = await axios.post(`${AI()}/internal/export-monthly-pdf`, {
      section_id, section_label: label, class_name,
      month_name: `${monthName} ${year}`,
      plans: allDays,
    }, { responseType: 'arraybuffer', timeout: 30000 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="plan-${class_name}-${label}-${year}-${month}.pdf"`);
    return res.send(Buffer.from(aiResp.data));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/calendar/academic-years
router.get('/academic-years', async (_req: Request, res: Response) => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let i = 0; i < 10; i++) {
    const y = currentYear + i;
    const next = (y + 1) % 100;
    years.push(`${y}-${String(next).padStart(2, '0')}`);
  }
  return res.json(years);
});

// POST /api/v1/admin/calendar
router.post('/', async (req: Request, res: Response) => {
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
       SET working_days = EXCLUDED.working_days, start_date = EXCLUDED.start_date,
           end_date = EXCLUDED.end_date
       RETURNING *`,
      [school_id, academic_year, working_days, start_date, end_date]
    );

    // Calculate total working days (excluding holidays)
    const holidayRows = await pool.query(
      'SELECT holiday_date FROM holidays WHERE school_id = $1 AND academic_year = $2',
      [school_id, academic_year]
    );
    const holidaySet = new Set(holidayRows.rows.map((r: any) => r.holiday_date.toISOString().split('T')[0]));

    const wdSet = new Set<number>(working_days);
    let workingDayCount = 0;
    const start = new Date(start_date);
    const end = new Date(end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon..7=Sun
      const iso = d.toISOString().split('T')[0];
      if (wdSet.has(dow) && !holidaySet.has(iso)) workingDayCount++;
    }

    return res.json({ ...result.rows[0], working_day_count: workingDayCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/calendar/summary — counts for the current academic year
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const calRow = await pool.query(
      'SELECT academic_year, working_days, start_date, end_date FROM school_calendar WHERE school_id = $1 ORDER BY start_date DESC LIMIT 1',
      [school_id]
    );
    if (calRow.rows.length === 0) return res.json(null);
    const { academic_year, working_days, start_date, end_date } = calRow.rows[0];
    const wdSet = new Set<number>(working_days);

    const holidayRows = await pool.query(
      'SELECT holiday_date::text FROM holidays WHERE school_id = $1 AND academic_year = $2',
      [school_id, academic_year]
    );
    const holidaySet = new Set(holidayRows.rows.map((r: any) => r.holiday_date));

    const specialRows = await pool.query(
      `SELECT day_type, COUNT(*)::int as count FROM special_days
       WHERE school_id = $1 AND academic_year = $2 GROUP BY day_type`,
      [school_id, academic_year]
    );
    const specialCounts: Record<string, number> = {};
    for (const r of specialRows.rows) specialCounts[r.day_type] = r.count;

    let workingDayCount = 0;
    const start = new Date(start_date);
    const end = new Date(end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
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
router.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      'SELECT * FROM school_calendar WHERE school_id = $1 ORDER BY academic_year DESC',
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/calendar/generate-plans
// Accepts class_id alone (generates for ALL sections) or class_id + section_id (one section)
// Optional: month (1-12) and year (YYYY) to generate only for a specific month
// Returns immediately — generation runs in background.
router.post('/generate-plans', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, section_id, academic_year, month, plan_year, force } = req.body;
    if (!class_id || !academic_year) {
      return res.status(400).json({ error: 'class_id and academic_year are required' });
    }

    // Resolve sections to generate for
    let sections: { id: string }[];
    if (section_id) {
      sections = [{ id: section_id }];
    } else {
      const result = await pool.query(
        'SELECT id FROM sections WHERE class_id = $1 AND school_id = $2',
        [class_id, school_id]
      );
      sections = result.rows;
    }

    if (sections.length === 0) {
      return res.status(400).json({ error: 'No sections found for this class' });
    }

    // Check if plans already exist for this month (monthly mode only)
    if (month && plan_year && !force) {
      const existing = await pool.query(
        `SELECT COUNT(*) as cnt FROM day_plans dp
         JOIN sections s ON s.id = dp.section_id
         WHERE s.class_id = $1 AND s.school_id = $2
           AND EXTRACT(MONTH FROM dp.plan_date) = $3
           AND EXTRACT(YEAR FROM dp.plan_date) = $4
           AND dp.chunk_ids != '{}'`,
        [class_id, school_id, month, plan_year]
      );
      if (parseInt(existing.rows[0].cnt) > 0) {
        const monthName = new Date(2000, month - 1).toLocaleString('default', { month: 'long' });
        return res.status(409).json({
          plans_exist: true,
          message: `Plans already exist for ${monthName} ${plan_year}. Regenerating will erase all completion records and attendance for this month.`,
          month, plan_year,
        });
      }
    }

    // If force=true and monthly, wipe existing plans + completions for this month
    if (month && plan_year && force) {
      for (const s of sections) {
        // Delete daily completions for this month
        await pool.query(
          `DELETE FROM daily_completions
           WHERE section_id = $1 AND school_id = $2
             AND EXTRACT(MONTH FROM completion_date) = $3
             AND EXTRACT(YEAR FROM completion_date) = $4`,
          [s.id, school_id, month, plan_year]
        );
        // Delete day plans for this month
        await pool.query(
          `DELETE FROM day_plans
           WHERE section_id = $1 AND school_id = $2
             AND EXTRACT(MONTH FROM plan_date) = $3
             AND EXTRACT(YEAR FROM plan_date) = $4`,
          [s.id, school_id, month, plan_year]
        );
      }
    }

    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const mode = month ? 'monthly' : 'full_year';

    // Fire and forget
    Promise.all(
      sections.map(s =>
        axios.post(`${AI_URL}/internal/generate-plans`, {
          class_id, section_id: s.id, school_id, academic_year,
          month: month || null,
          plan_year: plan_year || null,
        }, { timeout: 120000 }).catch(err =>
          console.error(`Plan generation failed for section ${s.id}:`, err.message)
        )
      )
    ).then(() => console.log(`Plan generation (${mode}) complete for class ${class_id}`));

    const modeLabel = month
      ? `${new Date(2000, month - 1).toLocaleString('default', { month: 'long' })} ${plan_year || ''}`
      : 'full year';

    return res.json({
      message: `Generating ${modeLabel} plans for ${sections.length} section(s). Runs in the background.`,
      sections: sections.length,
      mode,
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/calendar/refresh-planner — re-carry-forward all special days & holidays for a class
router.post('/refresh-planner', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, academic_year } = req.body;
    if (!class_id || !academic_year) return res.status(400).json({ error: 'class_id and academic_year are required' });

    // Get all special days and holidays for this academic year
    const specialRows = await pool.query(
      `SELECT day_date::text FROM special_days WHERE school_id = $1 AND academic_year = $2 ORDER BY day_date`,
      [school_id, academic_year]
    );
    const holidayRows = await pool.query(
      `SELECT holiday_date::text as day_date FROM holidays WHERE school_id = $1 AND academic_year = $2 ORDER BY holiday_date`,
      [school_id, academic_year]
    );

    const allDates = [
      ...specialRows.rows.map((r: any) => r.day_date),
      ...holidayRows.rows.map((r: any) => r.day_date),
    ].sort();

    let totalImpacted = 0;
    for (const date of allDates) {
      totalImpacted += await _carryForwardDate(pool, school_id, date);
    }

    return res.json({
      message: `Planner refreshed. ${totalImpacted} section plan(s) carried forward across ${allDates.length} special/holiday dates.`,
      dates_processed: allDates.length,
      plans_shifted: totalImpacted,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/calendar/absence
router.post('/absence', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { section_id, absence_date } = req.body;
    if (!section_id || !absence_date) {
      return res.status(400).json({ error: 'section_id and absence_date are required' });
    }
    const plan = await pool.query(
      'SELECT id, chunk_ids FROM day_plans WHERE section_id = $1 AND plan_date = $2 AND school_id = $3',
      [section_id, absence_date, school_id]
    );
    if (plan.rows.length === 0) {
      return res.status(404).json({ error: 'No day plan found for that date' });
    }
    await axios.post(`${AI()}/internal/carry-forward`, {
      section_id,
      plan_date: absence_date,
      pending_chunk_ids: plan.rows[0].chunk_ids,
    }, { timeout: 15000 });
    return res.json({ message: 'Absence recorded, chunks carried forward' });
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? err.message : 'Internal server error';
    return res.status(500).json({ error: msg });
  }
});

// GET /api/v1/admin/calendar/plan-status/:class_id — check how many sections have plans generated
router.get('/plan-status/:class_id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT s.id, s.label, c.name as class_name,
              COUNT(dp.id) as plans_count,
              MIN(dp.plan_date) as first_plan,
              MAX(dp.plan_date) as last_plan
       FROM sections s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN day_plans dp ON dp.section_id = s.id
       WHERE s.class_id = $1 AND s.school_id = $2
       GROUP BY s.id, s.label, c.name
       ORDER BY s.label`,
      [req.params.class_id, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// GET /api/v1/admin/calendar/:year/holidays/export — export holiday list as PDF (no weekends)
router.get('/:year/holidays/export', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { year } = req.params;

    const calRow = await pool.query(
      'SELECT working_days FROM school_calendar WHERE school_id = $1 ORDER BY start_date DESC LIMIT 1',
      [school_id]
    );
    const workingDayNums: number[] = calRow.rows[0]?.working_days || [1,2,3,4,5];

    const result = await pool.query(
      'SELECT holiday_date, event_name FROM holidays WHERE school_id = $1 AND academic_year = $2 ORDER BY holiday_date',
      [school_id, year]
    );

    // Filter out weekends
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

router.get('/:year/holidays', async (req: Request, res: Response) => {  try {
    const { school_id } = req.user!;
    const { year } = req.params;
    const result = await pool.query(
      `SELECT id, holiday_date::text as holiday_date, event_name, created_at
       FROM holidays WHERE school_id = $1 AND academic_year = $2 ORDER BY holiday_date`,
      [school_id, year]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/calendar/:year/holidays
router.post('/:year/holidays', async (req: Request, res: Response) => {
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
      [school_id, year, holiday_date, event_name]
    );

    // Auto carry-forward: if day plans exist for this date, move their chunks to the next working day
    const impacted = await _carryForwardDate(pool, school_id, holiday_date);

    return res.status(201).json({
      ...result.rows[0],
      plans_affected: impacted,
      message: impacted > 0
        ? `Holiday added. ${impacted} section plan(s) carried forward to the next working day.`
        : 'Holiday added.'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/admin/calendar/:year/holidays/:id — edit a holiday
router.put('/:year/holidays/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { year, id } = req.params;
    const { holiday_date, event_name } = req.body;
    if (!holiday_date || !event_name) return res.status(400).json({ error: 'holiday_date and event_name are required' });
    const result = await pool.query(
      `UPDATE holidays SET holiday_date = $1, event_name = $2
       WHERE id = $3 AND school_id = $4 AND academic_year = $5
       RETURNING id, holiday_date::text as holiday_date, event_name`,
      [holiday_date, event_name, id, school_id, year]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Holiday not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/admin/calendar/:year/holidays/:id
router.delete('/:year/holidays/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { year, id } = req.params;
    await pool.query(
      'DELETE FROM holidays WHERE id = $1 AND school_id = $2 AND academic_year = $3',
      [id, school_id, year]
    );
    return res.json({ message: 'Holiday deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/calendar/:year/holidays/import
router.post('/:year/holidays/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { year } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // Forward to AI service for parsing
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream(file.path), { filename: file.originalname || 'holidays.xlsx' });

    let parseResult: { valid_rows: any[]; invalid_rows: any[] };
    try {
      const aiResp = await axios.post(`${AI()}/internal/import-holidays`, form, {
        headers: form.getHeaders(),
        timeout: 30000,
      });
      parseResult = aiResp.data;
    } finally {
      fs.unlink(file.path, () => {});
    }

    // Bulk insert valid rows
    let created = 0;
    for (const row of parseResult.valid_rows) {
      try {
        await pool.query(
          `INSERT INTO holidays (school_id, academic_year, holiday_date, event_name)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (school_id, academic_year, holiday_date) DO NOTHING`,
          [school_id, year, row.date, row.event_name]
        );
        created++;
      } catch { /* skip duplicates */ }
    }

    return res.json({
      created,
      skipped: parseResult.invalid_rows,
    });
  } catch (err: unknown) {
    console.error(err);
    const msg = axios.isAxiosError(err) ? err.response?.data?.detail || err.message : 'Internal server error';
    return res.status(500).json({ error: msg });
  }
});

// GET /api/v1/admin/calendar/:year/special-days — grouped by label/type/range
router.get('/:year/special-days', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT id, day_date::text as day_date, day_type, label, activity_note,
              to_char(start_time, 'HH24:MI') as start_time, to_char(end_time, 'HH24:MI') as end_time,
              duration_type, revision_topics
       FROM special_days WHERE school_id = $1 AND academic_year = $2 ORDER BY day_date`,
      [school_id, req.params.year]
    );

    // Group consecutive dates with same label+type into ranges
    const rows = result.rows;
    const groups: any[] = [];
    for (const row of rows) {
      const last = groups[groups.length - 1];
      if (last && last.label === row.label && last.day_type === row.day_type && last.activity_note === row.activity_note && last.start_time === row.start_time && last.end_time === row.end_time && last.duration_type === row.duration_type) {
        last.to_date = row.day_date;
        last.count++;
        last.ids.push(row.id);
      } else {
        groups.push({ ids: [row.id], from_date: row.day_date, to_date: row.day_date, day_type: row.day_type, label: row.label, activity_note: row.activity_note, start_time: row.start_time, end_time: row.end_time, duration_type: row.duration_type, revision_topics: row.revision_topics, count: 1 });
      }
    }
    return res.json(groups);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/calendar/:year/special-days
// Supports single date (day_date) or date range (from_date + to_date)
router.post('/:year/special-days', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { day_date, from_date, to_date, day_type, label, activity_note, start_time, end_time, duration_type, revision_topics } = req.body;

    if (!day_type || !label) {
      return res.status(400).json({ error: 'day_type and label are required' });
    }

    // Validate day_type against allowed pattern
    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(day_type)) {
      return res.status(400).json({ error: 'day_type must be alphanumeric/underscore/hyphen, max 50 chars' });
    }

    // Validate duration_type
    const resolvedDurationType: string = duration_type || 'full_day';
    if (!['full_day', 'half_day'].includes(resolvedDurationType)) {
      return res.status(400).json({ error: 'duration_type must be full_day or half_day' });
    }

    // Validate revision_topics entries
    const resolvedRevisionTopics: string[] = Array.isArray(revision_topics) ? revision_topics : [];
    for (const topic of resolvedRevisionTopics) {
      if (typeof topic === 'string' && topic.length > 200) {
        return res.status(400).json({ error: 'revision_topics entries must be ≤ 200 characters' });
      }
    }

    // Build list of dates to insert
    const dates: string[] = [];
    if (from_date && to_date) {
      const start = new Date(from_date);
      const end = new Date(to_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }
    } else if (day_date) {
      dates.push(day_date);
    } else {
      return res.status(400).json({ error: 'Either day_date or from_date+to_date is required' });
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
        [school_id, req.params.year, d, day_type, label, activity_note || null, start_time || null, end_time || null, resolvedDurationType, resolvedRevisionTopics]
      );
      inserted.push(result.rows[0]);
    }

    // Carry forward chunks for ALL special day types (settling, revision, exam, event)
    let impacted = 0;
    for (const d of dates) {
      impacted += await _carryForwardDate(pool, school_id, d);
    }

    return res.status(201).json({
      created: inserted.length,
      plans_affected: impacted,
      message: impacted > 0
        ? `${inserted.length} day(s) added. ${impacted} section plan(s) carried forward.`
        : `${inserted.length} day(s) added.`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/admin/calendar/:year/special-days/:id
router.delete('/:year/special-days/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    await pool.query(
      'DELETE FROM special_days WHERE id = $1 AND school_id = $2',
      [req.params.id, school_id]
    );
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

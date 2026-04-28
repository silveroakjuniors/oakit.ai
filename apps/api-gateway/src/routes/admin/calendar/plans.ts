/**
 * calendar/plans.ts — Day plan routes (generate, view, edit, delete, export)
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../../../lib/db';
import { carryForwardDate, computeMonthsInRange } from './helpers';

export const plansRouter = Router();

const AI = () => {
  const url = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
  } catch { return 'http://localhost:8000'; }
  return url;
};

// GET /plan-summary
plansRouter.get('/plan-summary', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, section_id, academic_year, month, plan_year } = req.query as Record<string, string | undefined>;

    if (!class_id || !academic_year) return res.status(400).json({ error: 'class_id and academic_year are required' });

    const calRow = await pool.query(
      `SELECT start_date, end_date, working_days FROM school_calendar WHERE school_id = $1 AND academic_year = $2`,
      [school_id, academic_year]
    );
    if (calRow.rows.length === 0) return res.status(404).json({ error: 'School calendar not configured for this academic year' });
    const { start_date, end_date, working_days } = calRow.rows[0];
    const wdSet = new Set<number>(working_days as number[]);

    const holidayRows = await pool.query(`SELECT holiday_date FROM holidays WHERE school_id = $1 AND academic_year = $2`, [school_id, academic_year]);
    const holidaySet = new Set<string>(holidayRows.rows.map((r: any) => new Date(r.holiday_date).toISOString().split('T')[0]));

    const specialRows = await pool.query(`SELECT day_date, day_type, duration_type FROM special_days WHERE school_id = $1 AND academic_year = $2`, [school_id, academic_year]);
    const fullDaySpecialSet = new Set<string>();
    const halfDaySpecialSet = new Set<string>();
    const specialDayBreakdown: Record<string, { full_day: number; half_day: number }> = {};

    for (const r of specialRows.rows) {
      const iso = new Date(r.day_date).toISOString().split('T')[0];
      const durationType: string = r.duration_type || 'full_day';
      const dayType: string = r.day_type;
      if (durationType === 'half_day') halfDaySpecialSet.add(iso);
      else fullDaySpecialSet.add(iso);
      if (!specialDayBreakdown[dayType]) specialDayBreakdown[dayType] = { full_day: 0, half_day: 0 };
      if (durationType === 'half_day') specialDayBreakdown[dayType].half_day++;
      else specialDayBreakdown[dayType].full_day++;
    }

    const chunkRow = await pool.query(`SELECT COUNT(*)::int as total_chunks FROM curriculum_chunks WHERE class_id = $1`, [class_id]);
    const totalChunks: number = chunkRow.rows[0]?.total_chunks ?? 0;

    if (totalChunks === 0) {
      return res.json({ total_chunks: 0, chunks_already_assigned: 0, chunks_remaining: 0, fit: 'under', recommendation: 'No curriculum uploaded for this class.' });
    }

    let chunksAlreadyAssigned = 0;
    let lastAssignedDate: string | null = null;

    if (month && plan_year && section_id) {
      const m = parseInt(month, 10);
      const y = parseInt(plan_year, 10);
      const monthStart = new Date(y, m - 1, 1).toISOString().split('T')[0];
      const assignedRow = await pool.query(
        `SELECT COUNT(DISTINCT unnested_chunk) as assigned_count FROM day_plans dp, LATERAL unnest(dp.chunk_ids) AS unnested_chunk WHERE dp.section_id = $1 AND dp.school_id = $2 AND dp.plan_date < $3 AND dp.chunk_ids != '{}'`,
        [section_id, school_id, monthStart]
      );
      chunksAlreadyAssigned = parseInt(assignedRow.rows[0]?.assigned_count ?? '0', 10);
      const lastDateRow = await pool.query(
        `SELECT MAX(plan_date)::text as last_date FROM day_plans WHERE section_id = $1 AND school_id = $2 AND plan_date < $3 AND chunk_ids != '{}'`,
        [section_id, school_id, monthStart]
      );
      lastAssignedDate = lastDateRow.rows[0]?.last_date ?? null;
    }

    const chunksRemaining = Math.max(0, totalChunks - chunksAlreadyAssigned);

    let rangeStart = new Date(start_date);
    let rangeEnd = new Date(end_date);
    if (month && plan_year) {
      const m = parseInt(month, 10);
      const y = parseInt(plan_year, 10);
      const monthStart = new Date(y, m - 1, 1);
      const monthEnd = new Date(y, m, 0);
      if (monthStart > rangeStart) rangeStart = monthStart;
      if (monthEnd < rangeEnd) rangeEnd = monthEnd;
    }

    let workingDaysCount = 0, fullDaySpecialCount = 0, halfDaySpecialCount = 0, holidayCountInRange = 0;
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      const iso = d.toISOString().split('T')[0];
      if (!wdSet.has(dow)) continue;
      if (holidaySet.has(iso)) { holidayCountInRange++; continue; }
      workingDaysCount++;
      if (fullDaySpecialSet.has(iso)) fullDaySpecialCount++;
      else if (halfDaySpecialSet.has(iso)) halfDaySpecialCount++;
    }

    const netCurriculumDays = workingDaysCount - fullDaySpecialCount + 0.5 * halfDaySpecialCount;

    let fullYearCurriculumDays = 0;
    for (let d = new Date(start_date); d <= new Date(end_date); d.setDate(d.getDate() + 1)) {
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      const iso = d.toISOString().split('T')[0];
      if (!wdSet.has(dow) || holidaySet.has(iso)) continue;
      if (!fullDaySpecialSet.has(iso)) fullYearCurriculumDays++;
      else if (halfDaySpecialSet.has(iso)) fullYearCurriculumDays += 0.5;
    }

    const chunksPerDay = fullYearCurriculumDays > 0 ? Math.ceil(totalChunks / fullYearCurriculumDays) : 1;
    const chunksThisMonth = Math.min(Math.round(netCurriculumDays * chunksPerDay), chunksRemaining);
    const chunksAfterThisMonth = Math.max(0, chunksRemaining - chunksThisMonth);
    const avgChunksPerMonth = netCurriculumDays > 0 ? chunksThisMonth : 0;
    const monthsToFinish = avgChunksPerMonth > 0 ? Math.ceil(chunksAfterThisMonth / avgChunksPerMonth) : null;

    let fit: 'exact' | 'under' | 'over';
    if (totalChunks === Math.round(fullYearCurriculumDays)) fit = 'exact';
    else if (totalChunks < fullYearCurriculumDays) fit = 'under';
    else fit = 'over';

    const recommendation = fit === 'exact'
      ? 'Curriculum fits exactly — every available day will receive one chunk.'
      : fit === 'under'
        ? 'Curriculum is shorter than available days. Chunks will cycle. Consider adding more curriculum content.'
        : 'Curriculum is longer than available days. Not all content will be covered this year.';

    return res.json({
      total_chunks: totalChunks, chunks_already_assigned: chunksAlreadyAssigned, chunks_remaining: chunksRemaining,
      chunks_this_month: chunksThisMonth, chunks_after_this_month: chunksAfterThisMonth, months_to_finish: monthsToFinish,
      last_assigned_date: lastAssignedDate, total_working_days: workingDaysCount, holiday_count: holidayCountInRange,
      net_curriculum_days: netCurriculumDays, special_day_breakdown: specialDayBreakdown, fit, recommendation,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /coverage-report
plansRouter.get('/coverage-report', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, section_id, academic_year } = req.query as Record<string, string | undefined>;
    if (!class_id || !section_id || !academic_year) return res.status(400).json({ error: 'class_id, section_id, and academic_year are required' });

    const calRow = await pool.query(`SELECT start_date, end_date, working_days FROM school_calendar WHERE school_id = $1 AND academic_year = $2`, [school_id, academic_year]);
    if (calRow.rows.length === 0) return res.status(404).json({ error: 'School calendar not configured for this academic year' });
    const { start_date, end_date, working_days } = calRow.rows[0];
    const wdSet = new Set<number>(working_days as number[]);

    const holidayRows = await pool.query(`SELECT holiday_date FROM holidays WHERE school_id = $1 AND academic_year = $2`, [school_id, academic_year]);
    const holidaySet = new Set<string>(holidayRows.rows.map((r: any) => new Date(r.holiday_date).toISOString().split('T')[0]));

    const specialRows = await pool.query(`SELECT day_date, duration_type FROM special_days WHERE school_id = $1 AND academic_year = $2`, [school_id, academic_year]);
    const fullDaySpecialSet = new Set<string>();
    for (const r of specialRows.rows) {
      const iso = new Date(r.day_date).toISOString().split('T')[0];
      if ((r.duration_type || 'full_day') === 'full_day') fullDaySpecialSet.add(iso);
    }

    const planRows = await pool.query(
      `SELECT plan_date::text as plan_date, chunk_ids FROM day_plans WHERE section_id = $1 AND school_id = $2 AND plan_date >= $3 AND plan_date <= $4 ORDER BY plan_date`,
      [section_id, school_id, start_date, end_date]
    );

    const chunkRow = await pool.query(`SELECT COUNT(*)::int as total_chunks FROM curriculum_chunks WHERE class_id = $1`, [class_id]);
    const totalChunks: number = chunkRow.rows[0]?.total_chunks ?? 0;

    if (planRows.rows.length === 0) {
      const months = computeMonthsInRange(new Date(start_date), new Date(end_date), wdSet, holidaySet, fullDaySpecialSet, new Map());
      return res.json({ months, cycled_days: [], unique_chunks_covered: 0, total_chunks: totalChunks });
    }

    const planMap = new Map<string, string[]>();
    for (const row of planRows.rows) planMap.set(row.plan_date.split('T')[0], row.chunk_ids || []);

    const seenChunks = new Set<string>();
    const cycledDays: Array<{ date: string; chunk_ids: string[] }> = [];
    for (const row of planRows.rows) {
      const iso = row.plan_date.split('T')[0];
      const chunkIds: string[] = row.chunk_ids || [];
      if (chunkIds.length === 0) continue;
      const allSeen = chunkIds.every((id: string) => seenChunks.has(id));
      if (allSeen) cycledDays.push({ date: iso, chunk_ids: chunkIds });
      else for (const id of chunkIds) seenChunks.add(id);
    }

    const months = computeMonthsInRange(new Date(start_date), new Date(end_date), wdSet, holidaySet, fullDaySpecialSet, planMap);
    return res.json({ months, cycled_days: cycledDays, unique_chunks_covered: seenChunks.size, total_chunks: totalChunks });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /plans
plansRouter.get('/plans', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const sectionsResult = await pool.query(
      `SELECT s.id as section_id, s.label as section_label, c.id as class_id, c.name as class_name,
              ct.name as class_teacher_name, ct.id as class_teacher_id,
              COALESCE((SELECT json_agg(json_build_object('id', su.id, 'name', su.name)) FROM teacher_sections ts2 JOIN users su ON su.id = ts2.teacher_id WHERE ts2.section_id = s.id AND su.id IS DISTINCT FROM s.class_teacher_id), '[]') as supporting_teachers,
              cd.filename as curriculum_filename, cd.total_chunks, cd.status as curriculum_status
       FROM sections s JOIN classes c ON c.id = s.class_id
       LEFT JOIN users ct ON ct.id = s.class_teacher_id
       LEFT JOIN curriculum_documents cd ON cd.class_id = c.id AND cd.school_id = s.school_id AND cd.status = 'ready'
       WHERE s.school_id = $1 ORDER BY c.name, s.label`,
      [school_id]
    );
    const plansResult = await pool.query(
      `SELECT s.id as section_id, EXTRACT(YEAR FROM dp.plan_date)::int as plan_year, EXTRACT(MONTH FROM dp.plan_date)::int as plan_month, COUNT(dp.id) as days_count
       FROM day_plans dp JOIN sections s ON s.id = dp.section_id
       WHERE s.school_id = $1 AND dp.chunk_ids != '{}' GROUP BY s.id, plan_year, plan_month ORDER BY plan_year, plan_month`,
      [school_id]
    );
    const plansBySection = new Map<string, any[]>();
    for (const p of plansResult.rows) {
      if (!plansBySection.has(p.section_id)) plansBySection.set(p.section_id, []);
      plansBySection.get(p.section_id)!.push(p);
    }
    return res.json(sectionsResult.rows.map((s: any) => ({ ...s, plans: plansBySection.get(s.section_id) || [] })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /plans/:section_id
plansRouter.get('/plans/:section_id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { section_id } = req.params;
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const result = await pool.query(
      `SELECT dp.plan_date::text AS plan_date, dp.status, dp.chunk_ids, dp.chunk_label_overrides,
              COALESCE(json_agg(json_build_object('id', cc.id, 'topic_label', COALESCE((dp.chunk_label_overrides->>(cc.id::text)), cc.topic_label), 'original_label', cc.topic_label, 'content', cc.content, 'chunk_index', cc.chunk_index) ORDER BY cc.chunk_index) FILTER (WHERE cc.id IS NOT NULL), '[]') AS chunks,
              sd.label AS special_day_label, sd.day_type AS special_day_type, sd.activity_note AS special_day_note,
              dp.admin_note, dc.id AS completion_id, dc.submitted_at::text AS completed_at, submitter.name AS completed_by
       FROM day_plans dp
       LEFT JOIN curriculum_chunks cc ON cc.id = ANY(dp.chunk_ids)
       LEFT JOIN special_days sd ON sd.school_id = dp.school_id AND sd.day_date = dp.plan_date
       LEFT JOIN daily_completions dc ON dc.section_id = dp.section_id AND dc.completion_date = dp.plan_date
       LEFT JOIN users submitter ON submitter.id = dc.teacher_id
       WHERE dp.section_id = $1 AND dp.school_id = $2
         AND dp.plan_date >= make_date($4, $3, 1)
         AND dp.plan_date < make_date(CASE WHEN $3 = 12 THEN $4 + 1 ELSE $4 END, CASE WHEN $3 = 12 THEN 1 ELSE $3 + 1 END, 1)
       GROUP BY dp.id, dp.plan_date::text, dp.status, dp.chunk_ids, dp.chunk_label_overrides, dp.admin_note, sd.label, sd.day_type, sd.activity_note, dc.id, dc.submitted_at, submitter.name
       ORDER BY dp.plan_date::text`,
      [section_id, school_id, month, year]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /plans/:section_id/export
plansRouter.get('/plans/:section_id/export', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { section_id } = req.params;
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const secRow = await pool.query(`SELECT s.label, c.name as class_name FROM sections s JOIN classes c ON c.id = s.class_id WHERE s.id = $1 AND s.school_id = $2`, [section_id, school_id]);
    if (secRow.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
    const { label, class_name } = secRow.rows[0];

    const calRow = await pool.query(`SELECT working_days, academic_year FROM school_calendar WHERE school_id = $1 ORDER BY start_date DESC LIMIT 1`, [school_id]);
    const workingDayNums: number[] = calRow.rows[0]?.working_days || [1,2,3,4,5];
    const academicYear = calRow.rows[0]?.academic_year || '';

    const holidayRows = await pool.query('SELECT holiday_date, event_name FROM holidays WHERE school_id = $1 AND academic_year = $2', [school_id, academicYear]);
    const holidayMap = new Map<string, string>();
    for (const h of holidayRows.rows) holidayMap.set(new Date(h.holiday_date).toISOString().split('T')[0], h.event_name);

    const planRows = await pool.query(
      `SELECT dp.plan_date::text as plan_date, COALESCE(json_agg(json_build_object('topic_label', cc.topic_label, 'content', cc.content, 'activity_ids', cc.activity_ids) ORDER BY cc.chunk_index) FILTER (WHERE cc.id IS NOT NULL), '[]') as chunks
       FROM day_plans dp LEFT JOIN curriculum_chunks cc ON cc.id = ANY(dp.chunk_ids)
       WHERE dp.section_id = $1 AND dp.school_id = $2 AND EXTRACT(MONTH FROM dp.plan_date) = $3 AND EXTRACT(YEAR FROM dp.plan_date) = $4
       GROUP BY dp.plan_date ORDER BY dp.plan_date`,
      [section_id, school_id, month, year]
    );
    const planMap = new Map<string, any[]>();
    for (const row of planRows.rows) planMap.set(row.plan_date.split('T')[0], row.chunks || []);

    const daysInMonth = new Date(year, month, 0).getDate();
    const allDays: { date: string; type: 'working' | 'weekend' | 'holiday'; label?: string; chunks?: any[] }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month - 1, d);
      const iso = dt.toISOString().split('T')[0];
      const dow = dt.getDay() === 0 ? 7 : dt.getDay();
      if (holidayMap.has(iso)) allDays.push({ date: iso, type: 'holiday', label: holidayMap.get(iso) });
      else if (!workingDayNums.includes(dow)) allDays.push({ date: iso, type: 'weekend' });
      else allDays.push({ date: iso, type: 'working', chunks: planMap.get(iso) || [] });
    }

    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    const aiResp = await axios.post(`${AI()}/internal/export-monthly-pdf`, {
      section_id, section_label: label, class_name, month_name: `${monthName} ${year}`, plans: allDays,
    }, { responseType: 'arraybuffer', timeout: 30000 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="plan-${class_name}-${label}-${year}-${month}.pdf"`);
    return res.send(Buffer.from(aiResp.data));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /generate-plans
plansRouter.post('/generate-plans', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, section_id, academic_year, month, plan_year, force } = req.body;
    if (!class_id || !academic_year) return res.status(400).json({ error: 'class_id and academic_year are required' });

    let sections: { id: string }[];
    if (section_id) {
      sections = [{ id: section_id }];
    } else {
      const result = await pool.query('SELECT id FROM sections WHERE class_id = $1 AND school_id = $2', [class_id, school_id]);
      sections = result.rows;
    }
    if (sections.length === 0) return res.status(400).json({ error: 'No sections found for this class' });

    if (month && plan_year && !force) {
      const existing = await pool.query(
        `SELECT COUNT(*) as cnt FROM day_plans dp JOIN sections s ON s.id = dp.section_id WHERE s.class_id = $1 AND s.school_id = $2 AND EXTRACT(MONTH FROM dp.plan_date) = $3 AND EXTRACT(YEAR FROM dp.plan_date) = $4 AND dp.chunk_ids != '{}'`,
        [class_id, school_id, month, plan_year]
      );
      if (parseInt(existing.rows[0].cnt) > 0) {
        const monthName = new Date(2000, month - 1).toLocaleString('default', { month: 'long' });
        return res.status(409).json({ plans_exist: true, message: `Plans already exist for ${monthName} ${plan_year}. Regenerating will erase all completion records and attendance for this month.`, month, plan_year });
      }
    }

    if (month && plan_year && force) {
      for (const s of sections) {
        await pool.query(`DELETE FROM daily_completions WHERE section_id = $1 AND school_id = $2 AND EXTRACT(MONTH FROM completion_date) = $3 AND EXTRACT(YEAR FROM completion_date) = $4`, [s.id, school_id, month, plan_year]);
        await pool.query(`DELETE FROM day_plans WHERE section_id = $1 AND school_id = $2 AND EXTRACT(MONTH FROM plan_date) = $3 AND EXTRACT(YEAR FROM plan_date) = $4`, [s.id, school_id, month, plan_year]);
      }
    }

    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const mode = month ? 'monthly' : 'full_year';
    Promise.all(sections.map(s =>
      axios.post(`${AI_URL}/internal/generate-plans`, { class_id, section_id: s.id, school_id, academic_year, month: month || null, plan_year: plan_year || null }, { timeout: 120000 })
        .catch(err => console.error(`Plan generation failed for section ${s.id}:`, err.message))
    )).then(() => console.log(`Plan generation (${mode}) complete for class ${class_id}`));

    const modeLabel = month ? `${new Date(2000, month - 1).toLocaleString('default', { month: 'long' })} ${plan_year || ''}` : 'full year';
    return res.json({ message: `Generating ${modeLabel} plans for ${sections.length} section(s). Runs in the background.`, sections: sections.length, mode });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /refresh-planner
plansRouter.post('/refresh-planner', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id, academic_year } = req.body;
    if (!class_id || !academic_year) return res.status(400).json({ error: 'class_id and academic_year are required' });

    const specialRows = await pool.query(`SELECT day_date::text FROM special_days WHERE school_id = $1 AND academic_year = $2 ORDER BY day_date`, [school_id, academic_year]);
    const holidayRows = await pool.query(`SELECT holiday_date::text as day_date FROM holidays WHERE school_id = $1 AND academic_year = $2 ORDER BY holiday_date`, [school_id, academic_year]);
    const allDates = [...specialRows.rows.map((r: any) => r.day_date), ...holidayRows.rows.map((r: any) => r.day_date)].sort();

    let totalImpacted = 0;
    for (const date of allDates) totalImpacted += await carryForwardDate(school_id, date);

    return res.json({ message: `Planner refreshed. ${totalImpacted} section plan(s) carried forward across ${allDates.length} special/holiday dates.`, dates_processed: allDates.length, plans_shifted: totalImpacted });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /absence
plansRouter.post('/absence', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { section_id, absence_date } = req.body;
    if (!section_id || !absence_date) return res.status(400).json({ error: 'section_id and absence_date are required' });
    const plan = await pool.query('SELECT id, chunk_ids FROM day_plans WHERE section_id = $1 AND plan_date = $2 AND school_id = $3', [section_id, absence_date, school_id]);
    if (plan.rows.length === 0) return res.status(404).json({ error: 'No day plan found for that date' });
    await axios.post(`${AI()}/internal/carry-forward`, { section_id, plan_date: absence_date, pending_chunk_ids: plan.rows[0].chunk_ids }, { timeout: 15000 });
    return res.json({ message: 'Absence recorded, chunks carried forward' });
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? (err as any).message : 'Internal server error';
    return res.status(500).json({ error: msg });
  }
});

// PUT /plans/:section_id/:plan_date
plansRouter.put('/plans/:section_id/:plan_date', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { section_id, plan_date } = req.params;
    const { chunk_ids, admin_note, chunk_label_overrides } = req.body;

    const completed = await pool.query('SELECT id FROM daily_completions WHERE section_id = $1 AND completion_date = $2', [section_id, plan_date]);
    if (completed.rows.length > 0) return res.status(409).json({ error: 'This day has already been completed by the teacher and cannot be edited.' });

    const today = new Date().toISOString().split('T')[0];
    if (plan_date < today) return res.status(409).json({ error: 'Cannot edit plans for past dates.' });

    const updates: string[] = [];
    const params: any[] = [];
    if (Array.isArray(chunk_ids)) { params.push(chunk_ids); updates.push(`chunk_ids = ${params.length}::uuid[]`); }
    if (admin_note !== undefined) { params.push(admin_note); updates.push(`admin_note = ${params.length}`); }
    if (chunk_label_overrides !== undefined && typeof chunk_label_overrides === 'object') { params.push(JSON.stringify(chunk_label_overrides)); updates.push(`chunk_label_overrides = ${params.length}::jsonb`); }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    params.push(section_id, plan_date, school_id);
    const result = await pool.query(
      `UPDATE day_plans SET ${updates.join(', ')} WHERE section_id = ${params.length - 2} AND plan_date = ${params.length - 1} AND school_id = ${params.length} RETURNING id, plan_date, chunk_ids, chunk_label_overrides`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /plans/class/:class_id/stats
plansRouter.get('/plans/class/:class_id/stats', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id } = req.params;
    const sections = await pool.query('SELECT id FROM sections WHERE class_id = $1 AND school_id = $2', [class_id, school_id]);
    const sectionIds = sections.rows.map((r: any) => r.id);
    if (sectionIds.length === 0) return res.json({ plans: 0, completions: 0, first_date: null, last_date: null });
    const planStats = await pool.query(`SELECT COUNT(*)::int as plans, MIN(plan_date)::text as first_date, MAX(plan_date)::text as last_date FROM day_plans WHERE section_id = ANY($1::uuid[]) AND school_id = $2`, [sectionIds, school_id]);
    const completionStats = await pool.query(`SELECT COUNT(*)::int as completions FROM daily_completions WHERE section_id = ANY($1::uuid[]) AND school_id = $2`, [sectionIds, school_id]);
    return res.json({ plans: planStats.rows[0].plans, completions: completionStats.rows[0].completions, first_date: planStats.rows[0].first_date, last_date: planStats.rows[0].last_date });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /plans/class/:class_id
plansRouter.delete('/plans/class/:class_id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id } = req.params;
    const sections = await pool.query('SELECT id FROM sections WHERE class_id = $1 AND school_id = $2', [class_id, school_id]);
    const sectionIds = sections.rows.map((r: any) => r.id);
    if (sectionIds.length === 0) return res.json({ deleted: 0, message: 'No sections found' });
    await pool.query('DELETE FROM daily_completions WHERE section_id = ANY($1::uuid[]) AND school_id = $2', [sectionIds, school_id]);
    const result = await pool.query('DELETE FROM day_plans WHERE section_id = ANY($1::uuid[]) AND school_id = $2 RETURNING id', [sectionIds, school_id]);
    return res.json({ deleted: result.rows.length, message: `Deleted ${result.rows.length} day plans` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /plans/:section_id/month
plansRouter.delete('/plans/:section_id/month', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { section_id } = req.params;
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    if (!month || !year) return res.status(400).json({ error: 'month and year are required' });
    await pool.query(`DELETE FROM daily_completions WHERE section_id = $1 AND school_id = $2 AND EXTRACT(MONTH FROM completion_date) = $3 AND EXTRACT(YEAR FROM completion_date) = $4`, [section_id, school_id, month, year]);
    const result = await pool.query(`DELETE FROM day_plans WHERE section_id = $1 AND school_id = $2 AND EXTRACT(MONTH FROM plan_date) = $3 AND EXTRACT(YEAR FROM plan_date) = $4 RETURNING id`, [section_id, school_id, month, year]);
    return res.json({ deleted: result.rows.length, message: `Deleted ${result.rows.length} day plans for this month` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /plan-status/:class_id
plansRouter.get('/plan-status/:class_id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT s.id, s.label, c.name as class_name, COUNT(dp.id) as plans_count, MIN(dp.plan_date) as first_plan, MAX(dp.plan_date) as last_plan
       FROM sections s JOIN classes c ON c.id = s.class_id LEFT JOIN day_plans dp ON dp.section_id = s.id
       WHERE s.class_id = $1 AND s.school_id = $2 GROUP BY s.id, s.label, c.name ORDER BY s.label`,
      [req.params.class_id, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

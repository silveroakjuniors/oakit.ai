import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher', 'class teacher', 'supporting teacher'));

/**
 * GET /api/v1/teacher/calendar?month=6&year=2025&section_id=...
 *
 * Returns a month view for the teacher:
 * - Each day in the month with its plan status (scheduled, completed, holiday, special, no_plan)
 * - Holidays and special days for the month
 * - Coverage stats for the month
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);

    // Resolve section
    const sections = await getTeacherSections(user_id, school_id);
    const requestedSectionId = req.query.section_id as string | undefined;
    let section_id: string | null = null;
    if (requestedSectionId && sections.some(s => s.section_id === requestedSectionId)) {
      section_id = requestedSectionId;
    } else {
      section_id = sections[0]?.section_id || null;
    }

    if (!section_id) {
      return res.json({ days: [], holidays: [], special_days: [], stats: { total: 0, completed: 0, pending: 0 } });
    }

    // Determine month/year
    const todayDate = new Date(today + 'T12:00:00');
    const month = parseInt(req.query.month as string) || (todayDate.getMonth() + 1);
    const year  = parseInt(req.query.year  as string) || todayDate.getFullYear();

    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // Get academic year for this school
    const calRow = await pool.query(
      `SELECT academic_year FROM school_calendar
       WHERE school_id = $1 AND start_date <= $2 AND end_date >= $3 LIMIT 1`,
      [school_id, monthEnd, monthStart]
    );
    const academic_year = calRow.rows[0]?.academic_year || null;

    // Day plans for this section in this month
    const plansResult = await pool.query(
      `SELECT
         dp.plan_date::text AS plan_date,
         dp.status,
         dp.chunk_ids,
         COALESCE(array_length(dp.chunk_ids, 1), 0) AS chunk_count,
         dc.id IS NOT NULL AS completed,
         COALESCE(array_length(dc.covered_chunk_ids, 1), 0) AS covered_count
       FROM day_plans dp
       LEFT JOIN daily_completions dc
         ON dc.section_id = dp.section_id AND dc.completion_date = dp.plan_date
       WHERE dp.section_id = $1
         AND dp.plan_date >= $2 AND dp.plan_date <= $3
       ORDER BY dp.plan_date`,
      [section_id, monthStart, monthEnd]
    );

    // Holidays
    const holidaysResult = academic_year ? await pool.query(
      `SELECT holiday_date::text AS date, event_name AS label
       FROM holidays
       WHERE school_id = $1 AND academic_year = $2
         AND holiday_date >= $3 AND holiday_date <= $4
       ORDER BY holiday_date`,
      [school_id, academic_year, monthStart, monthEnd]
    ) : { rows: [] };

    // Special days
    const specialResult = academic_year ? await pool.query(
      `SELECT day_date::text AS date, label, day_type, duration_type, activity_note
       FROM special_days
       WHERE school_id = $1 AND academic_year = $2
         AND day_date >= $3 AND day_date <= $4
       ORDER BY day_date`,
      [school_id, academic_year, monthStart, monthEnd]
    ) : { rows: [] };

    // Build lookup maps
    const holidaySet = new Set(holidaysResult.rows.map((r: any) => r.date));
    const specialMap = new Map(specialResult.rows.map((r: any) => [r.date, r]));
    const planMap = new Map(plansResult.rows.map((r: any) => [r.plan_date, r]));

    // Build day-by-day array for the month
    const days = [];
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = new Date(dateStr + 'T12:00:00').getDay(); // 0=Sun, 6=Sat
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = holidaySet.has(dateStr);
      const special = specialMap.get(dateStr);
      const plan = planMap.get(dateStr);
      const isToday = dateStr === today;
      const isPast = dateStr < today;

      let dayType: string;
      if (isWeekend) dayType = 'weekend';
      else if (isHoliday) dayType = 'holiday';
      else if (special) dayType = special.duration_type === 'half_day' ? 'half_day_special' : 'special';
      else if (!plan) dayType = 'no_plan';
      else if (plan.completed) dayType = 'completed';
      else if (isPast && plan.chunk_count > 0) dayType = 'missed';
      else dayType = 'scheduled';

      days.push({
        date: dateStr,
        day: d,
        dow,
        is_today: isToday,
        is_past: isPast,
        day_type: dayType,
        plan_status: plan?.status || null,
        chunk_count: plan?.chunk_count || 0,
        covered_count: plan?.covered_count || 0,
        completed: plan?.completed || false,
        holiday_label: isHoliday ? holidaysResult.rows.find((r: any) => r.date === dateStr)?.label : null,
        special_label: special?.label || null,
        special_type: special?.day_type || null,
        activity_note: special?.activity_note || null,
      });
    }

    // Monthly stats
    const workingDays = days.filter(d => !['weekend', 'holiday', 'special'].includes(d.day_type));
    const completedDays = workingDays.filter(d => d.completed);
    const missedDays = workingDays.filter(d => d.day_type === 'missed');

    return res.json({
      month, year, section_id,
      days,
      holidays: holidaysResult.rows,
      special_days: specialResult.rows,
      stats: {
        total_working: workingDays.length,
        completed: completedDays.length,
        missed: missedDays.length,
        pending: workingDays.filter(d => !d.is_past && !d.completed).length,
        completion_pct: workingDays.length > 0
          ? Math.round((completedDays.length / workingDays.filter(d => d.is_past || d.is_today).length || 0) * 100)
          : 0,
      },
    });
  } catch (err: any) {
    console.error('[teacher/calendar]', err);
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
});

// GET /api/v1/teacher/calendar/upcoming?section_id=&page=1&limit=10
// Returns upcoming holidays and special days from today onwards
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const today = await getToday(school_id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get academic year
    const calRow = await pool.query(
      `SELECT academic_year FROM school_calendar WHERE school_id = $1 AND start_date <= $2 AND end_date >= $2 LIMIT 1`,
      [school_id, today]
    );
    const academic_year = calRow.rows[0]?.academic_year;
    if (!academic_year) return res.json({ events: [], total: 0, page, has_more: false });

    // Fetch upcoming holidays
    const holidays = await pool.query(
      `SELECT holiday_date::text AS date, event_name AS label, 'holiday' AS type
       FROM holidays
       WHERE school_id = $1 AND academic_year = $2 AND holiday_date >= $3
       ORDER BY holiday_date`,
      [school_id, academic_year, today]
    );

    // Fetch upcoming special days
    const specials = await pool.query(
      `SELECT day_date::text AS date, label, day_type AS type, activity_note, duration_type
       FROM special_days
       WHERE school_id = $1 AND academic_year = $2 AND day_date >= $3
       ORDER BY day_date`,
      [school_id, academic_year, today]
    );

    // Merge and sort by date
    const allEvents = [
      ...holidays.rows.map((r: any) => ({ date: r.date, label: r.label, type: 'holiday' as const, note: null, duration: null })),
      ...specials.rows.map((r: any) => ({ date: r.date, label: r.label, type: r.type as string, note: r.activity_note, duration: r.duration_type })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const total = allEvents.length;
    const paginated = allEvents.slice(offset, offset + limit);

    return res.json({
      events: paginated,
      total,
      page,
      has_more: offset + limit < total,
    });
  } catch (err) {
    console.error('[teacher/calendar/upcoming]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

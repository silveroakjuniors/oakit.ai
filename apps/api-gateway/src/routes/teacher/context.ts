import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import { getToday, getNowIST } from '../../lib/today';
import { redis } from '../../lib/redis';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher', 'class teacher', 'supporting teacher'));

const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

// GET /api/v1/teacher/context
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    // Get teacher name
    const userRow = await pool.query('SELECT name FROM users WHERE id = $1', [user_id]);
    const teacher_name = userRow.rows[0]?.name || 'Teacher';

    // Resolve ALL sections for this teacher (class teacher + supporting)
    const sections = await getTeacherSections(user_id, school_id);

    // Honour ?section_id= param so teacher can switch between their sections
    const requestedSectionId = req.query.section_id as string | undefined;
    let section_id: string | null = null;
    if (requestedSectionId && sections.some(s => s.section_id === requestedSectionId)) {
      section_id = requestedSectionId;
    } else {
      section_id = sections[0]?.section_id || null;
    }

    // Build all_sections list with class names for the switcher UI
    let all_sections: { section_id: string; section_label: string; class_name: string; role: string }[] = [];
    if (sections.length > 0) {
      const sectionIds = sections.map(s => s.section_id);
      const secRows = await pool.query(
        `SELECT s.id, s.label, c.name AS class_name
         FROM sections s JOIN classes c ON c.id = s.class_id
         WHERE s.id = ANY($1::uuid[])`,
        [sectionIds]
      );
      const secMap = new Map(secRows.rows.map((r: any) => [r.id, { label: r.label, class_name: r.class_name }]));
      all_sections = sections.map(s => ({
        section_id: s.section_id,
        section_label: secMap.get(s.section_id)?.label ?? '',
        class_name: secMap.get(s.section_id)?.class_name ?? '',
        role: s.role,
      }));
    }

    // Check attendance for today (time machine aware)
    const today = await getToday(school_id);
    let attendance_prompt = false;
    let today_completed = false;
    let tomorrow_plan: any = null;

    if (section_id) {
      const attRow = await pool.query(
        'SELECT id FROM attendance_records WHERE section_id = $1 AND attend_date = $2 LIMIT 1',
        [section_id, today]
      );
      const mockActive = !!(await redis.get(`time_machine:${school_id}`));
      const hour = mockActive ? 9 : getNowIST().getHours();

      // Check if today is a working day before showing attendance prompt
      let isWorkingDay = true;
      try {
        const calCheck = await pool.query(
          `SELECT working_days, holidays FROM school_calendar
           WHERE school_id = $1 AND start_date <= $2 AND end_date >= $2 LIMIT 1`,
          [school_id, today]
        );
        if (calCheck.rows.length > 0) {
          const cal = calCheck.rows[0];
          const todayDate = new Date(today + 'T12:00:00');
          const dayOfWeek = todayDate.getDay();
          const workingDays: number[] = cal.working_days || [1, 2, 3, 4, 5];
          if (!workingDays.includes(dayOfWeek)) isWorkingDay = false;
          const holidays: string[] = (cal.holidays || []).map((h: any) => typeof h === 'string' ? h.split('T')[0] : '');
          if (holidays.includes(today)) isWorkingDay = false;
        }
      } catch { /* non-critical */ }

      attendance_prompt = attRow.rows.length === 0 && hour >= 7 && hour < 17 && isWorkingDay;

      // Check if today is already completed
      const completionRow = await pool.query(
        'SELECT id FROM daily_completions WHERE section_id = $1 AND completion_date = $2',
        [section_id, today]
      );
      today_completed = completionRow.rows.length > 0;

      // If today is completed, fetch tomorrow's plan for "prepare for tomorrow"
      if (today_completed) {
        const todayDt = new Date(today + 'T12:00:00');
        let tomorrowDt = new Date(todayDt);
        tomorrowDt.setDate(tomorrowDt.getDate() + 1);
        // Skip weekends
        while (tomorrowDt.getDay() === 0 || tomorrowDt.getDay() === 6) {
          tomorrowDt.setDate(tomorrowDt.getDate() + 1);
        }
        const tomorrowStr = tomorrowDt.toISOString().split('T')[0];

        const tmPlan = await pool.query(
          `SELECT dp.plan_date, dp.status, dp.chunk_ids,
                  COALESCE(json_agg(json_build_object(
                    'id', cc.id, 'topic_label', cc.topic_label, 'content', cc.content
                  ) ORDER BY cc.chunk_index) FILTER (WHERE cc.id IS NOT NULL), '[]') as chunks
           FROM day_plans dp
           LEFT JOIN curriculum_chunks cc ON cc.id = ANY(dp.chunk_ids)
           WHERE dp.section_id = $1 AND dp.plan_date = $2 AND dp.school_id = $3
           GROUP BY dp.id`,
          [section_id, tomorrowStr, school_id]
        );

        if (tmPlan.rows.length > 0) {
          const row = tmPlan.rows[0];
          // Check special day for tomorrow
          if (!row.chunk_ids?.length) {
            const special = await pool.query(
              'SELECT label, day_type FROM special_days WHERE school_id=$1 AND day_date=$2 LIMIT 1',
              [school_id, tomorrowStr]
            );
            if (special.rows.length > 0) {
              row.status = special.rows[0].day_type;
              row.special_label = special.rows[0].label;
            }
          }
          tomorrow_plan = { ...row, plan_date: tomorrowStr };
        }
      }
    }

    // Get greeting from AI service
    let greeting = `Good morning, ${teacher_name}!`;
    let thought_for_day = 'Every day is a new opportunity to inspire a young mind.';

    // Get class name and student count for the greeting
    let class_name = '';
    let student_count = 0;
    if (section_id) {
      const classRow = await pool.query(
        `SELECT c.name FROM sections s JOIN classes c ON c.id = s.class_id WHERE s.id = $1`,
        [section_id]
      );
      class_name = classRow.rows[0]?.name || '';

      const countRow = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM students WHERE section_id = $1 AND is_active = true`,
        [section_id]
      );
      student_count = countRow.rows[0]?.cnt || 0;
    }

    try {
      const aiResp = await axios.get(`${AI()}/internal/greeting`, {
        params: { teacher_name, teacher_id: user_id, class_name, student_count },
        timeout: 5000,
      });
      greeting = aiResp.data.greeting || greeting;
      thought_for_day = aiResp.data.thought_for_day || thought_for_day;
    } catch { /* use defaults */ }

    // Check report readiness reminder — if any student in section has 0 observations
    let readiness_reminder = false;
    let readiness_miss_count = 0;
    if (section_id) {
      try {
        // Count students with no observations at all
        const obsCheck = await pool.query(
          `SELECT COUNT(DISTINCT s.id)::int AS students_without_obs
           FROM students s
           LEFT JOIN student_observations so ON so.student_id = s.id AND so.school_id = $2
           WHERE s.section_id = $1 AND s.is_active = true AND so.id IS NULL`,
          [section_id, school_id]
        );
        readiness_miss_count = obsCheck.rows[0]?.students_without_obs ?? 0;
        readiness_reminder = readiness_miss_count > 0;
      } catch { /* non-critical */ }
    }

    // Check if tomorrow has a holiday or special day (for alert popup)
    let tomorrow_event: { date: string; label: string; type: string } | null = null;
    let tomorrow_birthdays: { name: string; date_of_birth: string }[] = [];
    try {
      const todayDate = new Date(today + 'T12:00:00');
      const tomorrowDate = new Date(todayDate);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      // Skip weekends
      while (tomorrowDate.getDay() === 0 || tomorrowDate.getDay() === 6) {
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      }
      const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

      const calCheck = await pool.query(
        `SELECT academic_year FROM school_calendar WHERE school_id = $1 AND start_date <= $2 AND end_date >= $2 LIMIT 1`,
        [school_id, tomorrowStr]
      );
      if (calCheck.rows.length > 0) {
        const ay = calCheck.rows[0].academic_year;
        const hol = await pool.query(
          `SELECT event_name AS label FROM holidays WHERE school_id = $1 AND academic_year = $2 AND holiday_date = $3`,
          [school_id, ay, tomorrowStr]
        );
        if (hol.rows.length > 0) {
          tomorrow_event = { date: tomorrowStr, label: hol.rows[0].label, type: 'holiday' };
        } else {
          const sp = await pool.query(
            `SELECT label, day_type FROM special_days WHERE school_id = $1 AND academic_year = $2 AND day_date = $3`,
            [school_id, ay, tomorrowStr]
          );
          if (sp.rows.length > 0) {
            tomorrow_event = { date: tomorrowStr, label: sp.rows[0].label, type: sp.rows[0].day_type };
          }
        }
      }

      // Check for student birthdays tomorrow (in teacher's section)
      if (section_id) {
        const tomorrowMonth = tomorrowDate.getMonth() + 1;
        const tomorrowDay = tomorrowDate.getDate();
        const bdayRows = await pool.query(
          `SELECT name, date_of_birth::text FROM students
           WHERE section_id = $1 AND is_active = true AND date_of_birth IS NOT NULL
             AND EXTRACT(MONTH FROM date_of_birth) = $2
             AND EXTRACT(DAY FROM date_of_birth) = $3`,
          [section_id, tomorrowMonth, tomorrowDay]
        );
        tomorrow_birthdays = bdayRows.rows;
      }
    } catch { /* non-critical */ }

    return res.json({ greeting, thought_for_day, attendance_prompt, today, time_machine_active: !!(await redis.get(`time_machine:${school_id}`)), today_completed, tomorrow_plan, section_id, class_name, readiness_reminder, readiness_miss_count, all_sections, tomorrow_event, tomorrow_birthdays });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/context/performance — teacher's own performance vs school avg
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);

    // School days in last 30 days (Mon-Fri, excluding holidays)
    let schoolDays = 22;
    try {
      const calRow = await pool.query(
        `SELECT working_days, holidays FROM school_calendar
         WHERE school_id = $1 AND start_date <= $2 AND end_date >= $2 LIMIT 1`,
        [school_id, today]
      );
      if (calRow.rows.length > 0) {
        const { working_days = [1,2,3,4,5], holidays = [] } = calRow.rows[0];
        const holidayDates = (holidays as any[]).map((h: any) => typeof h === 'string' ? h.split('T')[0] : '');
        const todayDate = new Date(today + 'T12:00:00');
        let count = 0;
        for (let i = 0; i < 30; i++) {
          const d = new Date(todayDate); d.setDate(d.getDate() - i);
          if (working_days.includes(d.getDay()) && !holidayDates.includes(d.toISOString().split('T')[0])) count++;
        }
        schoolDays = Math.max(count, 1);
      }
    } catch { /* use default */ }

    // This teacher's stats — plans, attendance, homework, observations
    const myRow = await pool.query(
      `SELECT
         u.name,
         COALESCE(ts.current_streak, 0) AS current_streak,
         COALESCE(ts.best_streak, 0) AS best_streak,
         ts.last_completed_date,
         (SELECT COUNT(DISTINCT dc.completion_date)::int
          FROM daily_completions dc
          WHERE dc.teacher_id = $1 AND dc.school_id = $2
            AND dc.completion_date BETWEEN ($3::date - 29) AND $3::date
         ) AS completions_30d,
         -- Attendance submission rate (days attendance was submitted vs school days)
         (SELECT COUNT(DISTINCT ar.attend_date)::int
          FROM attendance_records ar
          JOIN sections s2 ON s2.id = ar.section_id
          WHERE s2.class_teacher_id = $1 OR ar.section_id IN (
            SELECT ts2.section_id FROM teacher_sections ts2 WHERE ts2.teacher_id = $1
          )
            AND ar.attend_date BETWEEN ($3::date - 29) AND $3::date
            AND ar.school_id = $2
         ) AS attendance_days_30d,
         -- Homework sent in last 30 days
         (SELECT COUNT(DISTINCT th.homework_date)::int
          FROM teacher_homework th
          WHERE th.teacher_id = $1 AND th.school_id = $2
            AND th.homework_date BETWEEN ($3::date - 29) AND $3::date
         ) AS homework_days_30d,
         -- Observations written in last 30 days
         (SELECT COUNT(*)::int
          FROM student_observations obs
          WHERE obs.teacher_id = $1 AND obs.school_id = $2
            AND obs.obs_date BETWEEN ($3::date - 29) AND $3::date
         ) AS observations_30d
       FROM users u
       LEFT JOIN teacher_streaks ts ON ts.teacher_id = u.id AND ts.school_id = $2
       WHERE u.id = $1`,
      [user_id, school_id, today]
    );

    if (myRow.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    const me = myRow.rows[0];
    const my_rate = Math.round((me.completions_30d / schoolDays) * 100);
    const att_rate = Math.round((me.attendance_days_30d / schoolDays) * 100);
    const hw_rate  = Math.round((me.homework_days_30d / schoolDays) * 100);

    // All teachers' stats for ranking
    const allRows = await pool.query(
      `SELECT
         u.id, u.name,
         (SELECT COUNT(DISTINCT dc.completion_date)::int
          FROM daily_completions dc
          WHERE dc.teacher_id = u.id AND dc.school_id = $1
            AND dc.completion_date BETWEEN ($2::date - 29) AND $2::date
         ) AS completions_30d,
         COALESCE(ts.current_streak, 0) AS current_streak
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN teacher_streaks ts ON ts.teacher_id = u.id AND ts.school_id = $1
       WHERE u.school_id = $1
         AND r.name IN ('teacher','class teacher','supporting teacher')
         AND u.is_active = true`,
      [school_id, today]
    );

    const allRates = allRows.rows.map((t: any) => ({
      id: t.id,
      name: t.name,
      rate: Math.round((t.completions_30d / schoolDays) * 100),
      streak: t.current_streak,
    })).sort((a: any, b: any) => b.rate - a.rate || b.streak - a.streak);

    const total = allRates.length;
    const rank = allRates.findIndex((t: any) => t.id === user_id) + 1;
    const schoolAvg = total > 0 ? Math.round(allRates.reduce((s: number, t: any) => s + t.rate, 0) / total) : 0;
    const top25pct = total > 0 ? allRates[Math.floor(total * 0.25)]?.rate ?? 0 : 0;

    // What's holding back the rank — build reasons array
    const reasons: { factor: string; your_value: string; school_avg: string; impact: 'high' | 'medium' | 'low'; status: 'good' | 'warn' | 'bad' }[] = [];

    // Plan completion
    const avgCompletions = Math.round(allRates.reduce((s: number, t: any) => s + t.rate, 0) / Math.max(total, 1));
    reasons.push({
      factor: 'Daily plan completion',
      your_value: `${my_rate}% (${me.completions_30d}/${schoolDays} days)`,
      school_avg: `${avgCompletions}%`,
      impact: 'high',
      status: my_rate >= avgCompletions ? 'good' : my_rate >= avgCompletions - 15 ? 'warn' : 'bad',
    });

    // Streak
    const avgStreak = Math.round(allRates.reduce((s: number, t: any) => s + t.streak, 0) / Math.max(total, 1));
    const effectiveStreak = me.completions_30d > 0 ? me.current_streak : 0;
    reasons.push({
      factor: 'Consistency streak',
      your_value: `${effectiveStreak} days`,
      school_avg: `${avgStreak} days avg`,
      impact: 'high',
      status: effectiveStreak >= avgStreak ? 'good' : effectiveStreak > 0 ? 'warn' : 'bad',
    });

    // Attendance submission
    reasons.push({
      factor: 'Attendance submission',
      your_value: `${att_rate}% (${me.attendance_days_30d}/${schoolDays} days)`,
      school_avg: '—',
      impact: 'medium',
      status: att_rate >= 90 ? 'good' : att_rate >= 70 ? 'warn' : 'bad',
    });

    // Homework
    reasons.push({
      factor: 'Homework sent to parents',
      your_value: `${hw_rate}% (${me.homework_days_30d}/${schoolDays} days)`,
      school_avg: '—',
      impact: 'medium',
      status: hw_rate >= 70 ? 'good' : hw_rate >= 40 ? 'warn' : 'bad',
    });

    // Observations
    reasons.push({
      factor: 'Student observations',
      your_value: `${me.observations_30d} written`,
      school_avg: '—',
      impact: 'low',
      status: me.observations_30d >= 10 ? 'good' : me.observations_30d >= 5 ? 'warn' : 'bad',
    });

    // Build improvement tips based on weakest areas
    const tips: string[] = [];
    if (my_rate < avgCompletions) {
      const daysNeeded = Math.ceil((avgCompletions - my_rate) * schoolDays / 100);
      tips.push(`Complete your daily plan for ${daysNeeded} more days to reach the school average. Mark topics done in the Plan tab every day.`);
    }
    if (effectiveStreak === 0) {
      tips.push(`Start a streak today — complete today's plan to begin building consistency. Even a 5-day streak moves you up significantly.`);
    } else if (effectiveStreak < avgStreak) {
      tips.push(`Your current streak is ${effectiveStreak} days vs school average of ${avgStreak}. Keep completing plans daily to build your streak.`);
    }
    if (att_rate < 90) {
      const missingAtt = schoolDays - me.attendance_days_30d;
      tips.push(`You have ${missingAtt} school days without attendance submission. Submit attendance every morning before 10am.`);
    }
    if (hw_rate < 70) {
      tips.push(`Sending homework to parents regularly improves your engagement score. Use the Homework & Notes tab after completing your daily plan.`);
    }
    if (me.observations_30d < 5) {
      tips.push(`Add student observations in Child Journey. Aim for 2-3 observations per week to strengthen your student tracking record.`);
    }
    if (tips.length === 0) {
      tips.push(`You are performing excellently! Maintain your streak and keep completing plans every day to stay in the top rankings.`);
    }

    // Daily completion trend last 30 days
    const dailyResult = await pool.query(
      `SELECT completion_date::text AS date, COUNT(DISTINCT section_id)::int AS sections_completed
       FROM daily_completions
       WHERE teacher_id = $1 AND school_id = $2
         AND completion_date BETWEEN ($3::date - 29) AND $3::date
       GROUP BY completion_date
       ORDER BY completion_date`,
      [user_id, school_id, today]
    );

    return res.json({
      name: me.name,
      completion_rate_30d: my_rate,
      completions_30d: me.completions_30d,
      school_days_30d: schoolDays,
      attendance_rate_30d: att_rate,
      homework_rate_30d: hw_rate,
      observations_30d: me.observations_30d,
      current_streak: effectiveStreak,
      best_streak: me.best_streak,
      last_completed_date: me.last_completed_date,
      rank,
      total_teachers: total,
      school_avg_rate: schoolAvg,
      top_25pct_rate: top25pct,
      reasons,
      tips,
      daily: dailyResult.rows,
      all_teachers: allRates,
    });
  } catch (err) {
    console.error('[teacher/performance]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

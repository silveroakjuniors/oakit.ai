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


// GET /api/v1/teacher/context/performance — monthly leaderboard + personal stats
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const monthStart = today.substring(0, 8) + '01';

    // Count school days from 1st of month to today
    let schoolDays = 1;
    try {
      const calRow = await pool.query(
        `SELECT working_days, holidays FROM school_calendar
         WHERE school_id = $1 AND start_date <= $2 AND end_date >= $2 LIMIT 1`,
        [school_id, today]
      );
      const { working_days = [1,2,3,4,5], holidays = [] } = calRow.rows.length > 0 ? calRow.rows[0] : {};
      const holidayDates = (holidays as any[]).map((h: any) => typeof h === 'string' ? h.split('T')[0] : '');
      const todayDate = new Date(today + 'T12:00:00');
      const startDate = new Date(monthStart + 'T12:00:00');
      let count = 0;
      for (let d = new Date(startDate); d <= todayDate; d.setDate(d.getDate() + 1)) {
        if ((working_days as number[]).includes(d.getDay()) && !holidayDates.includes(d.toISOString().split('T')[0])) count++;
      }
      schoolDays = Math.max(count, 1);
    } catch { schoolDays = Math.max(new Date().getDate(), 1); }

    // This teacher's stats for the month
    const myRow = await pool.query(
      `SELECT
         u.name,
         COALESCE(ts.current_streak, 0) AS current_streak,
         COALESCE(ts.best_streak, 0) AS best_streak,
         ts.last_completed_date,
         (SELECT COUNT(DISTINCT dc.completion_date)::int FROM daily_completions dc
          WHERE dc.teacher_id = $1 AND dc.school_id = $2
            AND dc.completion_date BETWEEN $3::date AND $4::date) AS completions_month,
         (SELECT COUNT(DISTINCT ar.attend_date)::int FROM attendance_records ar
          WHERE ar.section_id IN (
            SELECT ts2.section_id FROM teacher_sections ts2 WHERE ts2.teacher_id = $1
            UNION
            SELECT s3.id FROM sections s3 WHERE s3.class_teacher_id = $1)
            AND ar.attend_date BETWEEN $3::date AND $4::date AND ar.school_id = $2) AS attendance_days_month,
         (SELECT COUNT(DISTINCT th.homework_date)::int FROM teacher_homework th
          WHERE th.teacher_id = $1 AND th.school_id = $2
            AND th.homework_date BETWEEN $3::date AND $4::date) AS homework_days_month,
         -- Observations: count students in section who have at least 1 obs this month
         (SELECT COUNT(DISTINCT obs.student_id)::int
          FROM student_observations obs
          JOIN students st ON st.id = obs.student_id
          WHERE obs.teacher_id = $1 AND obs.school_id = $2
            AND obs.obs_date BETWEEN $3::date AND $4::date
            AND st.section_id IN (
              SELECT ts2.section_id FROM teacher_sections ts2 WHERE ts2.teacher_id = $1
              UNION SELECT s3.id FROM sections s3 WHERE s3.class_teacher_id = $1)
         ) AS students_observed_month,
         -- Total active students in teacher's sections
         (SELECT COUNT(DISTINCT st.id)::int
          FROM students st
          WHERE st.is_active = true
            AND st.section_id IN (
              SELECT ts2.section_id FROM teacher_sections ts2 WHERE ts2.teacher_id = $1
              UNION SELECT s3.id FROM sections s3 WHERE s3.class_teacher_id = $1)
         ) AS total_students,
         -- Feed: count distinct school days with at least 1 post
         (SELECT COUNT(DISTINCT fp.created_at::date)::int FROM feed_posts fp
          WHERE fp.posted_by = $1 AND fp.school_id = $2
            AND fp.created_at::date BETWEEN $3::date AND $4::date) AS feed_days_month
       FROM users u
       LEFT JOIN teacher_streaks ts ON ts.teacher_id = u.id AND ts.school_id = $2
       WHERE u.id = $1`,
      [user_id, school_id, monthStart, today]
    );

    if (myRow.rows.length === 0) return res.status(404).json({ error: 'Teacher not found' });
    const me = myRow.rows[0];

    // Get teacher role to adjust scoring weights
    const roleRow = await pool.query(
      `SELECT r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [user_id]
    );
    const teacherRole = roleRow.rows[0]?.role || 'teacher';
    const isSupporting = teacherRole === 'supporting teacher';

    // Composite score — supporting teachers are not responsible for plan completion
    // Class teacher: plans(40) + att(20) + hw(15) + obs(15) + feed(10) = 100
    // Supporting teacher: att(35) + hw(25) + obs(25) + feed(15) = 100
    // Obs: based on % of students observed (every student needs at least 1 obs)
    // Feed: based on % of school days with at least 1 post
    const totalStudents = me.total_students || 1;
    const studentsObserved = me.students_observed_month || 0;
    const feedDays = me.feed_days_month || 0;

    let planScore: number, attScore: number, hwScore: number, obsScore: number, feedScore: number;
    if (isSupporting) {
      planScore = 0;
      attScore  = Math.min(35, Math.round((Math.min(me.attendance_days_month, schoolDays) / schoolDays) * 35));
      hwScore   = Math.min(25, Math.round((Math.min(me.homework_days_month, schoolDays) / schoolDays) * 25));
      obsScore  = Math.min(25, Math.round((studentsObserved / totalStudents) * 25));
      feedScore = Math.min(15, Math.round((feedDays / schoolDays) * 15));
    } else {
      planScore = Math.min(40, Math.round((me.completions_month / schoolDays) * 40));
      attScore  = Math.min(20, Math.round((Math.min(me.attendance_days_month, schoolDays) / schoolDays) * 20));
      hwScore   = Math.min(15, Math.round((Math.min(me.homework_days_month, schoolDays) / schoolDays) * 15));
      obsScore  = Math.min(15, Math.round((studentsObserved / totalStudents) * 15));
      feedScore = Math.min(10, Math.round((feedDays / schoolDays) * 10));
    }
    const totalScore = planScore + attScore + hwScore + obsScore + feedScore;

    const my_rate    = Math.min(100, Math.round((me.completions_month / schoolDays) * 100));
    const att_rate   = Math.min(100, Math.round((me.attendance_days_month / schoolDays) * 100));
    const hw_rate    = Math.min(100, Math.round((me.homework_days_month / schoolDays) * 100));
    const obs_pct    = Math.round((studentsObserved / totalStudents) * 100);
    const feed_pct   = Math.round((feedDays / schoolDays) * 100);
    const effectiveStreak = me.completions_month > 0 ? me.current_streak : 0;

    // All teachers this month — rank by class/section, class teacher owns the score
    const allRows = await pool.query(
      `SELECT
         s.id AS section_id,
         c.name AS class_name,
         s.label AS section_label,
         ct.id AS class_teacher_id,
         ct.name AS class_teacher_name,
         (SELECT string_agg(u2.name, ', ' ORDER BY u2.name)
          FROM teacher_sections ts_sup
          JOIN users u2 ON u2.id = ts_sup.teacher_id
          WHERE ts_sup.section_id = s.id
            AND u2.id != COALESCE(s.class_teacher_id, '00000000-0000-0000-0000-000000000000'::uuid)
            AND u2.is_active = true
         ) AS supporting_teachers,
         (SELECT COUNT(DISTINCT dc.completion_date)::int FROM daily_completions dc
          WHERE dc.teacher_id = ct.id AND dc.school_id = $1
            AND dc.completion_date BETWEEN $2::date AND $3::date) AS completions_month,
         (SELECT COUNT(DISTINCT ar.attend_date)::int FROM attendance_records ar
          WHERE ar.section_id = s.id AND ar.attend_date BETWEEN $2::date AND $3::date AND ar.school_id = $1) AS attendance_days_month,
         (SELECT COUNT(DISTINCT th.homework_date)::int FROM teacher_homework th
          WHERE th.teacher_id = ct.id AND th.school_id = $1
            AND th.homework_date BETWEEN $2::date AND $3::date) AS homework_days_month,
         (SELECT LEAST(COUNT(*), 15)::int FROM student_observations obs
          WHERE obs.teacher_id = ct.id AND obs.school_id = $1
            AND obs.obs_date BETWEEN $2::date AND $3::date) AS obs_score,
         (SELECT LEAST(COUNT(*), 10)::int FROM feed_posts fp
          WHERE fp.posted_by = ct.id AND fp.school_id = $1
            AND fp.created_at::date BETWEEN $2::date AND $3::date) AS feed_score,
         COALESCE(ts.current_streak, 0) AS current_streak
       FROM sections s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN users ct ON ct.id = s.class_teacher_id AND ct.is_active = true
       LEFT JOIN teacher_streaks ts ON ts.teacher_id = ct.id AND ts.school_id = $1
       WHERE s.school_id = $1`,
      [school_id, monthStart, today]
    );

    const sorted = allRows.rows
      .filter((t: any) => t.class_teacher_id)
      .map((t: any) => {
        const ps  = Math.min(40, Math.round((t.completions_month / schoolDays) * 40));
        const as_ = Math.min(20, Math.round((Math.min(t.attendance_days_month, schoolDays) / schoolDays) * 20));
        const hs  = Math.min(15, Math.round((Math.min(t.homework_days_month, schoolDays) / schoolDays) * 15));
        const score = ps + as_ + hs + (t.obs_score || 0) + (t.feed_score || 0);
        // is_me = this teacher is either the class teacher OR a supporting teacher of this section
        const is_me = t.class_teacher_id === user_id;
        return {
          section_id: t.section_id,
          class_name: `${t.class_name} — Sec ${t.section_label}`,
          class_teacher: t.class_teacher_name || '',
          supporting_teachers: t.supporting_teachers || null,
          class_teacher_id: t.class_teacher_id,
          score, rate: Math.min(100, Math.round((t.completions_month / schoolDays) * 100)),
          completions: t.completions_month, streak: t.current_streak, is_me,
        };
      }).sort((a: any, b: any) => b.score - a.score || b.streak - a.streak);

    // Assign dense ranks (no gaps for ties: 1,2,2,2,3 not 1,2,2,2,5)
    let curRank = 1;
    const leaderboard = sorted.map((t: any, i: number) => {
      if (i > 0 && sorted[i].score !== sorted[i-1].score) { curRank++; }
      return {
        rank: curRank,
        name: t.class_name,
        class_teacher: t.class_teacher,
        supporting_teachers: t.supporting_teachers,
        initials: t.class_name.replace(' — ', '').replace('Sec ', '').replace(/[a-z ]/g, '').slice(0, 3),
        score: t.score, rate: t.rate, completions: t.completions, streak: t.streak, is_me: t.is_me,
      };
    });

    const myRank = leaderboard.find((t: any) => t.is_me)?.rank ?? 1;
    const total = sorted.length; // number of sections/classes
    const topScore = sorted[0]?.score ?? 0;
    const myScore = totalScore;
    const daysToTop = myScore < topScore ? topScore - myScore : 0;

    const reasons = isSupporting ? [
      { factor: 'Attendance submission (35pts)', your_value: `${attScore}/35 — ${att_rate}% (${me.attendance_days_month}/${schoolDays} days this month)`, school_avg: '—', impact: 'high' as const, status: (attScore >= 30 ? 'good' : attScore >= 20 ? 'warn' : 'bad') as 'good'|'warn'|'bad' },
      { factor: 'Homework sent to parents (25pts)', your_value: `${hwScore}/25 — ${hw_rate}% (${me.homework_days_month}/${schoolDays} days this month)`, school_avg: '—', impact: 'high' as const, status: (hwScore >= 20 ? 'good' : hwScore >= 12 ? 'warn' : 'bad') as 'good'|'warn'|'bad' },
      { factor: 'Student observations (25pts)', your_value: `${obsScore}/25 — ${studentsObserved}/${totalStudents} students observed this month (1 obs per student needed)`, school_avg: '—', impact: 'medium' as const, status: (studentsObserved >= totalStudents ? 'good' : studentsObserved >= Math.ceil(totalStudents * 0.7) ? 'warn' : 'bad') as 'good'|'warn'|'bad' },
      { factor: 'Class feed posts (15pts)', your_value: `${feedScore}/15 — ${feedDays}/${schoolDays} days had a post this month (1 post per school day)`, school_avg: '—', impact: 'medium' as const, status: (feed_pct >= 90 ? 'good' : feed_pct >= 60 ? 'warn' : 'bad') as 'good'|'warn'|'bad' },
      { factor: 'Plan completion', your_value: 'Not applicable for supporting teachers', school_avg: '—', impact: 'low' as const, status: 'good' as 'good'|'warn'|'bad' },
    ] : [
      { factor: 'Plan completion (40pts)',          your_value: `${planScore}/40 — ${my_rate}% (${me.completions_month}/${schoolDays} days this month)`, school_avg: '—', impact: 'high' as const,   status: (planScore >= 36 ? 'good' : planScore >= 28 ? 'warn' : 'bad') as 'good'|'warn'|'bad' },
      { factor: 'Attendance submission (20pts)',     your_value: `${attScore}/20 — ${att_rate}% (${me.attendance_days_month}/${schoolDays} days this month)`, school_avg: '—', impact: 'high' as const, status: (attScore >= 18 ? 'good' : attScore >= 14 ? 'warn' : 'bad') as 'good'|'warn'|'bad' },
      { factor: 'Homework sent to parents (15pts)',  your_value: `${hwScore}/15 — ${hw_rate}% (${me.homework_days_month}/${schoolDays} days this month)`, school_avg: '—', impact: 'medium' as const,  status: (hwScore >= 12 ? 'good' : hwScore >= 8 ? 'warn' : 'bad') as 'good'|'warn'|'bad' },
      { factor: 'Student observations (15pts)',      your_value: `${obsScore}/15 — ${studentsObserved}/${totalStudents} students observed this month (1 obs per student needed)`, school_avg: '—', impact: 'medium' as const, status: (studentsObserved >= totalStudents ? 'good' : studentsObserved >= Math.ceil(totalStudents * 0.7) ? 'warn' : 'bad') as 'good'|'warn'|'bad' },
      { factor: 'Class feed posts (10pts)',           your_value: `${feedScore}/10 — ${feedDays}/${schoolDays} days had a post this month (1 post per school day)`, school_avg: '—', impact: 'low' as const,   status: (feed_pct >= 90 ? 'good' : feed_pct >= 60 ? 'warn' : 'bad') as 'good'|'warn'|'bad' },
    ];

    const tips: string[] = [];
    if (myRank > 1 && daysToTop > 0) tips.push(`You are ${daysToTop} point${daysToTop !== 1 ? 's' : ''} behind #1. Focus on the areas below to close the gap.`);
    if (!isSupporting && planScore < 40) tips.push(`Complete your plan every school day — each day adds ${Math.round(40/schoolDays)} points.`);

    // Specific missed attendance dates
    if (attScore < (isSupporting ? 35 : 20)) {
      try {
        const missedAtt = await pool.query(
          `SELECT to_char(gs.d::date, 'DD Mon') AS missed_date
           FROM generate_series($3::date, $4::date, '1 day'::interval) gs(d)
           WHERE EXTRACT(DOW FROM gs.d) NOT IN (0, 6)
             AND NOT EXISTS (
               SELECT 1 FROM attendance_records ar
               JOIN sections s2 ON s2.id = ar.section_id
               WHERE ar.attend_date = gs.d::date
                 AND ar.school_id = $2
                 AND (s2.class_teacher_id = $1 OR s2.id IN (
                   SELECT ts2.section_id FROM teacher_sections ts2 WHERE ts2.teacher_id = $1)))
           ORDER BY gs.d DESC LIMIT 5`,
          [user_id, school_id, monthStart, today]
        );
        if (missedAtt.rows.length > 0) {
          const dates = missedAtt.rows.map((r: any) => r.missed_date).join(', ');
          tips.push(`Attendance not submitted on: ${dates}. Submit every morning to earn full attendance points.`);
        }
      } catch {
        tips.push(`Submit attendance every morning — you have ${schoolDays - me.attendance_days_month} missing day${(schoolDays - me.attendance_days_month) !== 1 ? 's' : ''} this month.`);
      }
    }

    // Specific missed homework dates (last 5 school days without homework)
    if (hwScore < (isSupporting ? 25 : 15)) {
      try {
        const missedHw = await pool.query(
          `SELECT to_char(gs.d::date, 'DD Mon') AS missed_date
           FROM generate_series($3::date, $4::date, '1 day'::interval) gs(d)
           WHERE EXTRACT(DOW FROM gs.d) NOT IN (0, 6)
             AND NOT EXISTS (
               SELECT 1 FROM teacher_homework th
               WHERE th.homework_date = gs.d::date
                 AND th.teacher_id = $1 AND th.school_id = $2)
           ORDER BY gs.d DESC LIMIT 5`,
          [user_id, school_id, monthStart, today]
        );
        if (missedHw.rows.length > 0) {
          const dates = missedHw.rows.map((r: any) => r.missed_date).join(', ');
          tips.push(`Homework not sent on: ${dates}. Use Homework & Notes after completing your daily plan.`);
        }
      } catch {
        tips.push(`Send homework to parents more regularly — use Homework & Notes after your plan is done.`);
      }
    }

    if (obsScore < (isSupporting ? 18 : 10)) {
      try {
        // Get names of students not yet observed this month
        const unobservedRows = await pool.query(
          `SELECT st.name FROM students st
           WHERE st.is_active = true
             AND st.section_id IN (
               SELECT ts2.section_id FROM teacher_sections ts2 WHERE ts2.teacher_id = $1
               UNION SELECT s3.id FROM sections s3 WHERE s3.class_teacher_id = $1)
             AND st.id NOT IN (
               SELECT DISTINCT obs.student_id FROM student_observations obs
               WHERE obs.teacher_id = $1 AND obs.school_id = $2
                 AND obs.obs_date BETWEEN $3::date AND $4::date)
           ORDER BY st.name LIMIT 5`,
          [user_id, school_id, monthStart, today]
        );
        const remaining = totalStudents - studentsObserved;
        if (unobservedRows.rows.length > 0) {
          const names = unobservedRows.rows.map((r: any) => r.name).join(', ');
          const more = remaining > 5 ? ` and ${remaining - 5} more` : '';
          tips.push(`${remaining} student${remaining !== 1 ? 's' : ''} have no observation this month: ${names}${more}. Open Child Journey to add one for each.`);
        }
      } catch {
        tips.push(`Observe all ${totalStudents} students — ${totalStudents - studentsObserved} still have no observation this month. Use Child Journey.`);
      }
    }
    if (feedScore < (isSupporting ? 12 : 8)) {
      const missingFeedDays = schoolDays - feedDays;
      tips.push(`${missingFeedDays} school day${missingFeedDays !== 1 ? 's' : ''} had no class feed post this month. Post at least 1 photo or update every school day to earn full feed points.`);
    }
    if (tips.length === 0) tips.push(`Perfect score! You are the Star of the Month. Keep this up!`);

    const dailyResult = await pool.query(
      `SELECT completion_date::text AS date, COUNT(DISTINCT section_id)::int AS sections_completed
       FROM daily_completions WHERE teacher_id = $1 AND school_id = $2
         AND completion_date BETWEEN $3::date AND $4::date
       GROUP BY completion_date ORDER BY completion_date`,
      [user_id, school_id, monthStart, today]
    );

    return res.json({
      name: me.name, month: today.substring(0, 7),
      is_supporting: isSupporting,
      completion_rate_month: my_rate,
      completions_month: me.completions_month,
      school_days_month: schoolDays,
      attendance_rate_month: att_rate,
      homework_rate_month: hw_rate,
      students_observed: studentsObserved,
      total_students: totalStudents,
      feed_days_month: feedDays,
      total_score: myScore,
      current_streak: effectiveStreak,
      best_streak: me.best_streak,
      rank: myRank,
      total_teachers: total,
      days_to_top: daysToTop,
      leaderboard,
      reasons,
      tips,
      daily: dailyResult.rows,
    });
  } catch (err) {
    console.error('[teacher/performance]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

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

export default router;

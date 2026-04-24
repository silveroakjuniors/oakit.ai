import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import { getToday } from '../../lib/today';
import { redis } from '../../lib/redis';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher'));

const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

// GET /api/v1/teacher/context
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    // Get teacher name
    const userRow = await pool.query('SELECT name FROM users WHERE id = $1', [user_id]);
    const teacher_name = userRow.rows[0]?.name || 'Teacher';

    // Resolve sections using unified helper (class teacher + supporting)
    const sections = await getTeacherSections(user_id, school_id);
    const section_id = sections[0]?.section_id || null;

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
      const hour = mockActive ? 9 : new Date().getHours();
      attendance_prompt = attRow.rows.length === 0 && hour >= 7 && hour < 17;

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
    try {
      const aiResp = await axios.get(`${AI()}/internal/greeting`, {
        params: { teacher_name, teacher_id: user_id },
        timeout: 5000,
      });
      greeting = aiResp.data.greeting || greeting;
      thought_for_day = aiResp.data.thought_for_day || thought_for_day;
    } catch { /* use defaults */ }

    // Get class name for the teacher's primary section
    let class_name = '';
    if (section_id) {
      const classRow = await pool.query(
        `SELECT c.name FROM sections s JOIN classes c ON c.id = s.class_id WHERE s.id = $1`,
        [section_id]
      );
      class_name = classRow.rows[0]?.name || '';
    }

    return res.json({ greeting, thought_for_day, attendance_prompt, today, time_machine_active: !!(await redis.get(`time_machine:${school_id}`)), today_completed, tomorrow_plan, section_id, class_name });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('principal', 'admin'));

const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

const THOUGHTS = [
  'A great school is built one teacher at a time.',
  'Leadership is not about being in charge. It is about taking care of those in your charge.',
  'The best teachers teach from the heart, not from the book.',
  'Education is the most powerful weapon which you can use to change the world.',
  'Children are not things to be molded, but people to be unfolded.',
  'The art of teaching is the art of assisting discovery.',
  'Every child deserves a champion — an adult who will never give up on them.',
];

// GET /api/v1/principal/context
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id!);

    // Principal's name
    const userRow = await pool.query('SELECT name FROM users WHERE id = $1', [user_id]);
    const principal_name = userRow.rows[0]?.name || 'Principal';

    // Thought of the day (rotate by day of year)
    const doy = Math.floor((new Date(today).getTime() - new Date(new Date(today).getFullYear(), 0, 0).getTime()) / 86400000);
    const thought_for_day = THOUGHTS[doy % THOUGHTS.length];

    // Today's attendance summary per section with student counts
    const attendanceResult = await pool.query(
      `SELECT
         s.id          AS section_id,
         s.label       AS section_label,
         c.name        AS class_name,
         ct.name       AS class_teacher_name,
         -- total students
         COUNT(DISTINCT st.id)::int                                          AS total_students,
         -- present today
         COUNT(DISTINCT ar.student_id) FILTER (WHERE ar.status = 'present')::int AS present_today,
         -- absent today
         COUNT(DISTINCT ar.student_id) FILTER (WHERE ar.status = 'absent')::int  AS absent_today,
         -- attendance submitted?
         CASE WHEN COUNT(ar.id) > 0 THEN true ELSE false END                AS attendance_submitted
       FROM sections s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN users ct ON ct.id = s.class_teacher_id
       LEFT JOIN students st ON st.section_id = s.id
       LEFT JOIN attendance_records ar ON ar.section_id = s.id AND ar.attend_date = $2
       WHERE s.school_id = $1
       GROUP BY s.id, s.label, c.name, ct.name
       ORDER BY c.name, s.label`,
      [school_id, today]
    );

    // School-level totals
    const totalStudents = attendanceResult.rows.reduce((s: number, r: any) => s + r.total_students, 0);
    const totalPresent = attendanceResult.rows.reduce((s: number, r: any) => s + r.present_today, 0);
    const totalAbsent = attendanceResult.rows.reduce((s: number, r: any) => s + r.absent_today, 0);
    const submittedCount = attendanceResult.rows.filter((r: any) => r.attendance_submitted).length;

    // Today's plan completions
    const completionResult = await pool.query(
      `SELECT section_id FROM daily_completions WHERE school_id=$1 AND completion_date=$2`,
      [school_id, today]
    );
    const completedSectionIds = new Set(completionResult.rows.map((r: any) => r.section_id));

    // Curriculum coverage per section (last 30 days)
    const coverageResult = await pool.query(
      `SELECT
         sec.id as section_id,
         COUNT(DISTINCT cc.id)::int as total_chunks,
         COUNT(DISTINCT dc_chunks.chunk_id)::int as covered_chunks
       FROM sections sec
       LEFT JOIN curriculum_documents cd ON cd.class_id = sec.class_id AND cd.school_id = $1
       LEFT JOIN curriculum_chunks cc ON cc.document_id = cd.id
       LEFT JOIN (
         SELECT unnest(covered_chunk_ids) as chunk_id, section_id
         FROM daily_completions WHERE school_id = $1
       ) dc_chunks ON dc_chunks.chunk_id = cc.id AND dc_chunks.section_id = sec.id
       WHERE sec.school_id = $1
       GROUP BY sec.id`,
      [school_id]
    );
    const coverageMap: Record<string, { total: number; covered: number; pct: number }> = {};
    for (const r of coverageResult.rows) {
      const pct = r.total_chunks > 0 ? Math.round((r.covered_chunks / r.total_chunks) * 100) : 0;
      coverageMap[r.section_id] = { total: r.total_chunks, covered: r.covered_chunks, pct };
    }

    // Teacher streaks
    const streakResult = await pool.query(
      `SELECT ts.teacher_id, ts.current_streak, ts.best_streak, u.name as teacher_name
       FROM teacher_sections tsec
       JOIN users u ON u.id = tsec.teacher_id
       LEFT JOIN teacher_streaks ts ON ts.teacher_id = tsec.teacher_id AND ts.school_id = $1
       WHERE u.school_id = $1
       ORDER BY COALESCE(ts.current_streak,0) DESC`,
      [school_id]
    );

    // Homework sent today
    const hwResult = await pool.query(
      `SELECT section_id FROM teacher_homework WHERE school_id=$1 AND homework_date=$2`,
      [school_id, today]
    );
    const hwSentSectionIds = new Set(hwResult.rows.map((r: any) => r.section_id));

    // Enrich sections with coverage + completion + homework
    const enrichedSections = attendanceResult.rows.map((r: any) => ({
      ...r,
      plan_completed: completedSectionIds.has(r.section_id),
      homework_sent: hwSentSectionIds.has(r.section_id),
      coverage_pct: coverageMap[r.section_id]?.pct ?? null,
      coverage_total: coverageMap[r.section_id]?.total ?? 0,
      coverage_covered: coverageMap[r.section_id]?.covered ?? 0,
    }));

    const plansCompletedCount = enrichedSections.filter((r: any) => r.plan_completed).length;
    const hwSentCount = enrichedSections.filter((r: any) => r.homework_sent).length;

    // Try AI greeting
    let greeting = `Good morning, ${principal_name}!`;
    try {
      const aiResp = await axios.get(`${AI()}/internal/greeting`, {
        params: { teacher_name: principal_name, teacher_id: user_id },
        timeout: 3000,
      });
      greeting = aiResp.data.greeting || greeting;
    } catch { /* use default */ }

    return res.json({
      principal_name,
      greeting,
      thought_for_day,
      today,
      sections: enrichedSections,
      teacher_streaks: streakResult.rows,
      summary: {
        total_students: totalStudents,
        total_present: totalPresent,
        total_absent: totalAbsent,
        attendance_submitted: submittedCount,
        plans_completed: plansCompletedCount,
        homework_sent: hwSentCount,
        total_sections: attendanceResult.rows.length,
      },
    });
  } catch (err: any) {
    console.error('Principal context error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/v1/principal/birthdays?days=7 — students with upcoming birthdays
router.get('/birthdays', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const days = Math.min(parseInt(req.query.days as string || '7'), 30);

    // Check if date_of_birth column exists (migration 045 may not be run yet)
    const colCheck = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name='students' AND column_name='date_of_birth' LIMIT 1`
    );
    if (colCheck.rows.length === 0) {
      return res.json([]); // migration not run yet
    }

    const result = await pool.query(
      `SELECT s.id, s.name, s.date_of_birth::text,
              c.name as class_name, sec.label as section_label,
              EXTRACT(MONTH FROM s.date_of_birth)::int as birth_month,
              EXTRACT(DAY FROM s.date_of_birth)::int as birth_day,
              -- days until next birthday (handles year wrap)
              (DATE_TRUNC('year', CURRENT_DATE) +
                (s.date_of_birth - DATE_TRUNC('year', s.date_of_birth)) +
                CASE WHEN (s.date_of_birth - DATE_TRUNC('year', s.date_of_birth)) <
                          (CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE))
                     THEN INTERVAL '1 year' ELSE INTERVAL '0' END
              )::date - CURRENT_DATE AS days_until
       FROM students s
       JOIN classes c ON c.id = s.class_id
       JOIN sections sec ON sec.id = s.section_id
       WHERE s.school_id = $1
         AND s.is_active = true
         AND s.date_of_birth IS NOT NULL
         AND (
           DATE_TRUNC('year', CURRENT_DATE) +
           (s.date_of_birth - DATE_TRUNC('year', s.date_of_birth)) +
           CASE WHEN (s.date_of_birth - DATE_TRUNC('year', s.date_of_birth)) <
                     (CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE))
                THEN INTERVAL '1 year' ELSE INTERVAL '0' END
         )::date BETWEEN CURRENT_DATE AND CURRENT_DATE + $2
       ORDER BY days_until, s.name`,
      [school_id, days]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[birthdays]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/principal/birthdays/send — send birthday message to student's parents
router.post('/birthdays/send', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const { student_ids, message } = req.body;
    if (!Array.isArray(student_ids) || !message?.trim()) {
      return res.status(400).json({ error: 'student_ids and message required' });
    }

    // Create announcements targeted at each student's parents
    // We use the announcements table with target_audience='parents' scoped to class
    const results = [];
    for (const student_id of student_ids) {
      const studentRow = await pool.query(
        `SELECT s.name, s.class_id FROM students s
         WHERE s.id = $1 AND s.school_id = $2`,
        [student_id, school_id]
      );
      if (studentRow.rows.length === 0) continue;
      const student = studentRow.rows[0];

      await pool.query(
        `INSERT INTO announcements (school_id, author_id, title, body, target_audience, target_class_id, expires_at)
         VALUES ($1, $2, $3, $4, 'class', $5, now() + INTERVAL '3 days')`,
        [school_id, user_id,
         `🎂 Happy Birthday ${student.name}!`,
         message.trim(),
         student.class_id]
      );
      results.push(student.name);
    }

    return res.json({ sent_to: results, count: results.length });
  } catch (err) {
    console.error('[birthdays/send]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/principal/sections — list all sections for report dropdown
router.get('/sections', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT s.id as section_id, s.label as section_label, c.name as class_name
       FROM sections s JOIN classes c ON c.id = s.class_id
       WHERE s.school_id = $1 ORDER BY c.name, s.label`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

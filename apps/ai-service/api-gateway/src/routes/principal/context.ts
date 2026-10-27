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
       LEFT JOIN students st ON st.section_id = s.id AND st.is_active = true
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

    // Day-based completion coverage per section
    const coverageResult = await pool.query(
      `SELECT
         sec.id as section_id,
         (SELECT COUNT(*)::int FROM day_plans dp
          WHERE dp.section_id = sec.id AND dp.school_id = $1
            AND dp.status NOT IN ('holiday', 'weekend')
            AND dp.plan_date <= CURRENT_DATE) as total_planned,
         (SELECT COUNT(*)::int FROM daily_completions dc
          WHERE dc.section_id = sec.id AND dc.school_id = $1) as days_completed
       FROM sections sec
       WHERE sec.school_id = $1`,
      [school_id]
    );
    const coverageMap: Record<string, { total: number; covered: number; pct: number }> = {};
    for (const r of coverageResult.rows) {
      const pct = r.total_planned > 0 ? Math.round((r.days_completed / r.total_planned) * 100) : 0;
      coverageMap[r.section_id] = { total: r.total_planned, covered: r.days_completed, pct };
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

// GET /api/v1/principal/insights — comprehensive dashboard insights
// Returns: fee assignment, instalment status, concessions, parent activity, teacher activity
router.get('/insights', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const today = await getToday(school_id!);
    const thirtyDaysAgo = new Date(new Date(today).getTime() - 30 * 86400000).toISOString().split('T')[0];

    const [
      feeAssignment,
      instalments,
      concessions,
      parentActivity,
      teacherActivity,
    ] = await Promise.all([

      // ── Fee assignment: how many students have fee assigned ──
      pool.query(
        `SELECT
           COUNT(DISTINCT s.id)::int                                          AS total_students,
           COUNT(DISTINCT sfa.student_id)::int                                AS students_with_fee,
           COUNT(DISTINCT s.id) - COUNT(DISTINCT sfa.student_id)::int         AS students_without_fee,
           COALESCE(SUM(sfa.assigned_amount), 0)                              AS total_assigned,
           COALESCE(SUM(sfa.outstanding_balance), 0)                          AS total_outstanding,
           COALESCE(SUM(sfa.assigned_amount - sfa.outstanding_balance), 0)    AS total_collected
         FROM students s
         LEFT JOIN student_fee_accounts sfa
           ON sfa.student_id = s.id AND sfa.school_id = $1 AND sfa.deleted_at IS NULL
         WHERE s.school_id = $1 AND s.is_active = true`,
        [school_id]
      ),

      // ── Instalment-wise collected vs assigned ──
      pool.query(
        `SELECT
           COALESCE(fi.label, 'Instalment ' || fi.instalment_number) AS label,
           fi.instalment_number,
           fi.due_date,
           fh.name AS fee_head_name,
           COUNT(DISTINCT sfa.student_id)::int AS student_count,
           COALESCE(SUM(fi.amount * 1), 0) AS per_student_amount
         FROM fee_instalments fi
         JOIN fee_heads fh ON fh.id = fi.fee_head_id AND fh.school_id = $1 AND fh.deleted_at IS NULL
         JOIN student_fee_accounts sfa ON sfa.fee_head_id = fi.fee_head_id
           AND sfa.school_id = $1 AND sfa.deleted_at IS NULL
         GROUP BY fi.id, fi.instalment_number, fi.label, fi.due_date, fi.amount, fh.name
         ORDER BY fi.due_date ASC NULLS LAST, fi.instalment_number ASC
         LIMIT 12`,
        [school_id]
      ),

      // ── Concessions summary ──
      pool.query(
        `SELECT
           status,
           COUNT(*)::int AS count,
           COALESCE(SUM(CASE WHEN type = 'fixed' THEN value ELSE 0 END), 0) AS fixed_total,
           COALESCE(SUM(CASE WHEN type = 'percentage' THEN value ELSE 0 END), 0) AS pct_total
         FROM concessions
         WHERE school_id = $1 AND deleted_at IS NULL
         GROUP BY status`,
        [school_id]
      ),

      // ── Parent activity (last 30 days) ──
      pool.query(
        `SELECT
           pu.id, pu.name, pu.mobile,
           COUNT(DISTINCT psl.student_id)::int AS children_count,
           STRING_AGG(DISTINCT st.name, ', ') AS children_names,
           COUNT(DISTINCT m.id)::int AS messages_sent_30d,
           CASE
             WHEN pu.force_password_reset = true THEN 'never_logged_in'
             WHEN COUNT(DISTINCT m.id) > 0 THEN 'active'
             ELSE 'inactive'
           END AS activity_status
         FROM parent_users pu
         LEFT JOIN parent_student_links psl ON psl.parent_id = pu.id
         LEFT JOIN students st ON st.id = psl.student_id
         LEFT JOIN messages m ON m.parent_id = pu.id
           AND m.school_id = pu.school_id
           AND m.sent_at >= $2
         WHERE pu.school_id = $1 AND pu.is_active = true
         GROUP BY pu.id, pu.name, pu.mobile, pu.force_password_reset
         ORDER BY messages_sent_30d DESC, pu.name`,
        [school_id, thirtyDaysAgo]
      ).catch(() => ({ rows: [] })),

      // ── Teacher activity (last 30 days) ──
      pool.query(
        `SELECT
           u.id, u.name,
           COUNT(DISTINCT dc.completion_date)::int AS plans_30d,
           COUNT(DISTINCT ar.attend_date)::int AS attendance_30d,
           COUNT(DISTINCT th.homework_date)::int AS homework_30d,
           MAX(dc.completion_date)::text AS last_plan,
           COALESCE(ts.current_streak, 0) AS streak,
           CASE
             WHEN MAX(dc.completion_date) >= ($2::date - INTERVAL '3 days') THEN 'active'
             WHEN MAX(dc.completion_date) >= ($2::date - INTERVAL '7 days') THEN 'low'
             ELSE 'inactive'
           END AS activity_status
         FROM users u
         JOIN roles r ON r.id = u.role_id AND r.name = 'teacher'
         LEFT JOIN daily_completions dc ON dc.teacher_id = u.id
           AND dc.school_id = u.school_id AND dc.completion_date >= $3
         LEFT JOIN attendance_records ar ON ar.teacher_id = u.id
           AND ar.school_id = u.school_id AND ar.attend_date >= $3
         LEFT JOIN teacher_homework th ON th.teacher_id = u.id
           AND th.school_id = u.school_id AND th.homework_date >= $3
         LEFT JOIN teacher_streaks ts ON ts.teacher_id = u.id AND ts.school_id = u.school_id
         WHERE u.school_id = $1 AND u.is_active = true
         GROUP BY u.id, u.name, ts.current_streak
         ORDER BY plans_30d DESC, u.name`,
        [school_id, today, thirtyDaysAgo]
      ).catch(() => ({ rows: [] })),
    ]);

    const fa = feeAssignment.rows[0] || {};

    // Aggregate concessions by status
    const concessionSummary = { pending: 0, approved: 0, rejected: 0, approved_amount: 0, pending_count: 0 };
    for (const row of concessions.rows) {
      if (row.status === 'approved') {
        concessionSummary.approved = row.count;
        concessionSummary.approved_amount = parseFloat(row.fixed_total);
      } else if (row.status === 'pending_approval') {
        concessionSummary.pending = row.count;
        concessionSummary.pending_count = row.count;
      } else if (row.status === 'rejected') {
        concessionSummary.rejected = row.count;
      }
    }

    // Parent activity summary
    const parents = parentActivity.rows;
    const parentSummary = {
      total: parents.length,
      active: parents.filter((p: any) => p.activity_status === 'active').length,
      inactive: parents.filter((p: any) => p.activity_status === 'inactive').length,
      never_logged_in: parents.filter((p: any) => p.activity_status === 'never_logged_in').length,
      list: parents,
    };

    // Teacher activity summary
    const teachers = teacherActivity.rows;
    const teacherSummary = {
      total: teachers.length,
      active: teachers.filter((t: any) => t.activity_status === 'active').length,
      low: teachers.filter((t: any) => t.activity_status === 'low').length,
      inactive: teachers.filter((t: any) => t.activity_status === 'inactive').length,
      list: teachers,
    };

    return res.json({
      fee_assignment: {
        total_students:       parseInt(fa.total_students) || 0,
        students_with_fee:    parseInt(fa.students_with_fee) || 0,
        students_without_fee: parseInt(fa.students_without_fee) || 0,
        total_assigned:       parseFloat(fa.total_assigned) || 0,
        total_outstanding:    parseFloat(fa.total_outstanding) || 0,
        total_collected:      parseFloat(fa.total_collected) || 0,
      },
      instalments: instalments.rows.map((r: any) => ({
        label:            r.label,
        instalment_number: r.instalment_number,
        due_date:         r.due_date,
        fee_head_name:    r.fee_head_name,
        student_count:    r.student_count,
        total_due:        parseFloat(r.per_student_amount) * r.student_count,
      })),
      concessions: concessionSummary,
      parents: parentSummary,
      teachers: teacherSummary,
    });
  } catch (err: any) {
    console.error('[principal/insights]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

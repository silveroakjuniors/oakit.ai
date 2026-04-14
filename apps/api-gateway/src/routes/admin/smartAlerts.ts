import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { redis } from '../../lib/redis';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'));

/**
 * GET /api/v1/admin/smart-alerts
 *
 * Returns AI-computed school intelligence alerts across 5 categories:
 * 1. Students falling behind (low attendance + low coverage)
 * 2. Teachers not completing plans (streak broken, unlogged days)
 * 3. Low attendance trends (section-level 7-day drop)
 * 4. Weak subject detection (quiz scores below 50%)
 * 5. Teacher performance scores (compliance + AI usage + streak)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const cacheKey = `smart-alerts:${school_id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const today = await getToday(school_id);
    const alerts: any[] = [];

    // ── 1. Teachers not completing plans ─────────────────────────────────
    const unloggedTeachers = await pool.query(
      `SELECT
         u.name as teacher_name, u.id as teacher_id,
         sec.label as section_label, c.name as class_name,
         COUNT(dp.id) FILTER (
           WHERE dp.plan_date < $2::date
             AND dp.status NOT IN ('holiday','settling','revision','exam','event','weekend')
             AND dp.chunk_ids != '{}'
             AND NOT EXISTS (
               SELECT 1 FROM daily_completions dc
               WHERE dc.section_id = dp.section_id AND dc.completion_date = dp.plan_date
             )
         )::int as unlogged_days,
         MAX(dc.completion_date)::text as last_completion
       FROM sections sec
       JOIN classes c ON c.id = sec.class_id
       LEFT JOIN users u ON u.id = sec.class_teacher_id
       LEFT JOIN day_plans dp ON dp.section_id = sec.id AND dp.school_id = $1
       LEFT JOIN daily_completions dc ON dc.section_id = sec.id AND dc.school_id = $1
       WHERE sec.school_id = $1
       GROUP BY u.name, u.id, sec.label, c.name
       HAVING COUNT(dp.id) FILTER (
         WHERE dp.plan_date < $2::date
           AND dp.status NOT IN ('holiday','settling','revision','exam','event','weekend')
           AND dp.chunk_ids != '{}'
           AND NOT EXISTS (
             SELECT 1 FROM daily_completions dc2
             WHERE dc2.section_id = dp.section_id AND dc2.completion_date = dp.plan_date
           )
       ) > 2`,
      [school_id, today]
    );

    for (const row of unloggedTeachers.rows) {
      alerts.push({
        type: 'teacher_not_completing',
        severity: row.unlogged_days > 7 ? 'high' : 'medium',
        title: `${row.teacher_name || 'Teacher'} has ${row.unlogged_days} unlogged days`,
        detail: `${row.class_name} – Section ${row.section_label} · Last completion: ${row.last_completion || 'Never'}`,
        teacher_id: row.teacher_id,
        section_label: row.section_label,
        class_name: row.class_name,
        unlogged_days: row.unlogged_days,
      });
    }

    // ── 2. Low attendance trends (7-day rolling average < 70%) ───────────
    const lowAttendance = await pool.query(
      `SELECT
         sec.id as section_id, sec.label as section_label, c.name as class_name,
         u.name as teacher_name,
         COUNT(ar.id) FILTER (WHERE ar.status = 'present')::float /
           NULLIF(COUNT(ar.id), 0) * 100 as attendance_pct_7d,
         COUNT(ar.id) FILTER (WHERE ar.status = 'absent')::int as absent_count
       FROM sections sec
       JOIN classes c ON c.id = sec.class_id
       LEFT JOIN users u ON u.id = sec.class_teacher_id
       LEFT JOIN attendance_records ar ON ar.section_id = sec.id
         AND ar.attend_date BETWEEN ($2::date - INTERVAL '6 days') AND $2::date
       WHERE sec.school_id = $1
       GROUP BY sec.id, sec.label, c.name, u.name
       HAVING COUNT(ar.id) > 0
         AND COUNT(ar.id) FILTER (WHERE ar.status = 'present')::float / NULLIF(COUNT(ar.id), 0) < 0.70`,
      [school_id, today]
    );

    for (const row of lowAttendance.rows) {
      const pct = Math.round(row.attendance_pct_7d);
      alerts.push({
        type: 'low_attendance_trend',
        severity: pct < 50 ? 'high' : 'medium',
        title: `Low attendance in ${row.class_name} – Section ${row.section_label}`,
        detail: `7-day attendance: ${pct}% · ${row.absent_count} absences · Teacher: ${row.teacher_name || 'Unassigned'}`,
        section_id: row.section_id,
        section_label: row.section_label,
        class_name: row.class_name,
        attendance_pct: pct,
      });
    }

    // ── 3. Classes falling behind on curriculum (< 40% coverage) ─────────
    const behindCoverage = await pool.query(
      `SELECT
         sec.id as section_id, sec.label as section_label, c.name as class_name,
         u.name as teacher_name,
         COUNT(DISTINCT cc.id)::int as total_chunks,
         COUNT(DISTINCT dc_chunks.chunk_id)::int as covered_chunks
       FROM sections sec
       JOIN classes c ON c.id = sec.class_id
       LEFT JOIN users u ON u.id = sec.class_teacher_id
       LEFT JOIN curriculum_documents cd ON cd.class_id = sec.class_id AND cd.school_id = $1 AND cd.status = 'ingested'
       LEFT JOIN curriculum_chunks cc ON cc.document_id = cd.id
       LEFT JOIN (
         SELECT unnest(covered_chunk_ids) as chunk_id, section_id
         FROM daily_completions WHERE school_id = $1
       ) dc_chunks ON dc_chunks.chunk_id = cc.id AND dc_chunks.section_id = sec.id
       WHERE sec.school_id = $1
       GROUP BY sec.id, sec.label, c.name, u.name
       HAVING COUNT(DISTINCT cc.id) > 5
         AND COUNT(DISTINCT dc_chunks.chunk_id)::float / NULLIF(COUNT(DISTINCT cc.id), 0) < 0.40`,
      [school_id]
    );

    for (const row of behindCoverage.rows) {
      const pct = row.total_chunks > 0 ? Math.round((row.covered_chunks / row.total_chunks) * 100) : 0;
      alerts.push({
        type: 'class_falling_behind',
        severity: pct < 20 ? 'high' : 'medium',
        title: `${row.class_name} – Section ${row.section_label} is behind on curriculum`,
        detail: `Coverage: ${pct}% (${row.covered_chunks}/${row.total_chunks} topics) · Teacher: ${row.teacher_name || 'Unassigned'}`,
        section_id: row.section_id,
        section_label: row.section_label,
        class_name: row.class_name,
        coverage_pct: pct,
      });
    }

    // ── 4. Weak subject detection (quiz avg < 50%) ────────────────────────
    const weakSubjects = await pool.query(
      `SELECT
         q.subject, sec.label as section_label, c.name as class_name,
         COUNT(qa.id)::int as attempt_count,
         ROUND(AVG(qa.scored_marks::numeric / NULLIF(qa.total_marks, 0) * 100))::int as avg_pct
       FROM quizzes q
       JOIN sections sec ON sec.id = q.section_id
       JOIN classes c ON c.id = sec.class_id
       JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.status = 'submitted'
       WHERE q.school_id = $1
         AND qa.submitted_at > NOW() - INTERVAL '30 days'
       GROUP BY q.subject, sec.label, c.name
       HAVING COUNT(qa.id) >= 3
         AND ROUND(AVG(qa.scored_marks::numeric / NULLIF(qa.total_marks, 0) * 100)) < 50`,
      [school_id]
    );

    for (const row of weakSubjects.rows) {
      alerts.push({
        type: 'weak_subject',
        severity: row.avg_pct < 35 ? 'high' : 'medium',
        title: `Weak performance in ${row.subject} — ${row.class_name} ${row.section_label}`,
        detail: `Average score: ${row.avg_pct}% across ${row.attempt_count} attempts in last 30 days`,
        subject: row.subject,
        section_label: row.section_label,
        class_name: row.class_name,
        avg_pct: row.avg_pct,
      });
    }

    // ── 5. Teacher performance scores — rich multi-factor ────────────────
    const teacherScores = await pool.query(
      `SELECT
         u.id as teacher_id, u.name as teacher_name,
         sec.label as section_label, c.name as class_name,
         sec.id as section_id,

         -- Factor 1: Plan completion compliance (% working days logged, last 30d)
         ROUND(
           COUNT(dc.id)::numeric /
           NULLIF(COUNT(dp.id) FILTER (
             WHERE dp.plan_date <= $2::date
               AND dp.status NOT IN ('holiday','settling','revision','exam','event','weekend')
               AND dp.chunk_ids != '{}'
           ), 0) * 100
         )::int as compliance_pct,

         -- Factor 2: Streak
         COALESCE(ts.current_streak, 0) as current_streak,
         COALESCE(ts.best_streak, 0) as best_streak,

         -- Factor 3: AI usage (last 7 days)
         COUNT(al.id) FILTER (
           WHERE al.action = 'ai_query' AND al.actor_id = u.id
             AND al.created_at > NOW() - INTERVAL '7 days'
             AND (al.metadata->>'outcome') = 'allowed'
         )::int as ai_queries_7d,

         -- Factor 4: Attendance marking (% days attendance submitted, last 30d)
         COUNT(DISTINCT ar.attend_date) FILTER (
           WHERE ar.attend_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date
         )::int as att_days_marked,

         -- Factor 5: Homework sent (last 30d)
         COUNT(DISTINCT th.homework_date) FILTER (
           WHERE th.homework_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date
         )::int as homework_days_sent,

         -- Factor 6: Notes sent (last 30d)
         COUNT(DISTINCT tn.id) FILTER (
           WHERE tn.note_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date
         )::int as notes_sent,

         -- Factor 7: Child journey entries (last 30d)
         COUNT(DISTINCT cj.id) FILTER (
           WHERE cj.entry_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date
         )::int as journey_entries,

         -- Factor 8: Student observations (last 30d)
         COUNT(DISTINCT so.id) FILTER (
           WHERE so.obs_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date
         )::int as observations_made,

         -- Factor 9: Total working days in period (denominator)
         COUNT(dp.id) FILTER (
           WHERE dp.plan_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date
             AND dp.status NOT IN ('holiday','settling','revision','exam','event','weekend')
             AND dp.chunk_ids != '{}'
         )::int as working_days_in_period

       FROM sections sec
       JOIN classes c ON c.id = sec.class_id
       JOIN users u ON u.id = sec.class_teacher_id
       LEFT JOIN day_plans dp ON dp.section_id = sec.id AND dp.school_id = $1
         AND dp.plan_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date
       LEFT JOIN daily_completions dc ON dc.section_id = sec.id AND dc.completion_date = dp.plan_date
       LEFT JOIN teacher_streaks ts ON ts.teacher_id = u.id AND ts.school_id = $1
       LEFT JOIN audit_logs al ON al.school_id = $1 AND al.actor_id = u.id
       LEFT JOIN attendance_records ar ON ar.section_id = sec.id AND ar.teacher_id = u.id
       LEFT JOIN teacher_homework th ON th.section_id = sec.id AND th.teacher_id = u.id
       LEFT JOIN teacher_notes tn ON tn.section_id = sec.id AND tn.teacher_id = u.id
       LEFT JOIN child_journey_entries cj ON cj.section_id = sec.id AND cj.teacher_id = u.id
       LEFT JOIN student_observations so ON so.school_id = $1 AND so.teacher_id = u.id
       WHERE sec.school_id = $1 AND u.id IS NOT NULL
       GROUP BY u.id, u.name, sec.label, c.name, sec.id, ts.current_streak, ts.best_streak`,
      [school_id, today]
    );

    const performanceScores = teacherScores.rows.map((row: any) => {
      const wd = Math.max(row.working_days_in_period ?? 1, 1); // working days denominator

      // ── Factor scores (each 0-100) ──────────────────────────────────────
      // F1: Plan completion compliance (30%)
      const f1_compliance = Math.min(row.compliance_pct ?? 0, 100);

      // F2: Attendance marking timeliness (15%) — % of working days attendance was marked
      const f2_attendance = Math.min(Math.round(((row.att_days_marked ?? 0) / wd) * 100), 100);

      // F3: Homework consistency (15%) — % of working days homework was sent
      const f3_homework = Math.min(Math.round(((row.homework_sent ?? row.homework_days_sent ?? 0) / wd) * 100), 100);

      // F4: Teaching streak (10%) — current streak capped at 30 days
      const f4_streak = Math.min(Math.round(((row.current_streak ?? 0) / 30) * 100), 100);

      // F5: AI engagement (10%) — queries last 7 days, capped at 20
      const f5_ai = Math.min(Math.round(((row.ai_queries_7d ?? 0) / 20) * 100), 100);

      // F6: Student observations & journey entries (10%) — engagement with individual students
      const obs_total = (row.journey_entries ?? 0) + (row.observations_made ?? 0);
      const f6_observations = Math.min(Math.round((obs_total / Math.max(wd * 0.5, 1)) * 100), 100);

      // F7: Notes & communication (10%) — notes sent to parents
      const f7_notes = Math.min(Math.round(((row.notes_sent ?? 0) / Math.max(wd * 0.3, 1)) * 100), 100);

      // ── Weighted total ──────────────────────────────────────────────────
      const score = Math.round(
        f1_compliance   * 0.30 +
        f2_attendance   * 0.15 +
        f3_homework     * 0.15 +
        f4_streak       * 0.10 +
        f5_ai           * 0.10 +
        f6_observations * 0.10 +
        f7_notes        * 0.10
      );

      return {
        teacher_id: row.teacher_id,
        teacher_name: row.teacher_name,
        section_label: row.section_label,
        class_name: row.class_name,
        section_id: row.section_id,
        performance_score: score,
        band: score >= 75 ? 'green' : score >= 50 ? 'amber' : 'red',
        // Individual factor scores for drill-down
        factors: {
          plan_completion:    { score: f1_compliance,   weight: 30, label: 'Plan Completion',       detail: `${row.compliance_pct ?? 0}% of working days logged` },
          attendance_marking: { score: f2_attendance,   weight: 15, label: 'Attendance Marking',    detail: `${row.att_days_marked ?? 0} of ${wd} days marked` },
          homework_sent:      { score: f3_homework,     weight: 15, label: 'Homework Consistency',  detail: `${row.homework_days_sent ?? 0} of ${wd} days sent` },
          teaching_streak:    { score: f4_streak,       weight: 10, label: 'Teaching Streak',       detail: `${row.current_streak ?? 0} day streak (best: ${row.best_streak ?? 0})` },
          ai_engagement:      { score: f5_ai,           weight: 10, label: 'Oakie AI Engagement',   detail: `${row.ai_queries_7d ?? 0} queries this week` },
          student_tracking:   { score: f6_observations, weight: 10, label: 'Student Observations',  detail: `${obs_total} journey entries + observations` },
          parent_comms:       { score: f7_notes,        weight: 10, label: 'Parent Communication',  detail: `${row.notes_sent ?? 0} notes sent to parents` },
        },
        // Raw data
        compliance_pct: row.compliance_pct ?? 0,
        current_streak: row.current_streak ?? 0,
        best_streak: row.best_streak ?? 0,
        ai_queries_7d: row.ai_queries_7d ?? 0,
        att_days_marked: row.att_days_marked ?? 0,
        homework_days_sent: row.homework_days_sent ?? 0,
        notes_sent: row.notes_sent ?? 0,
        journey_entries: row.journey_entries ?? 0,
        observations_made: row.observations_made ?? 0,
        working_days: wd,
      };
    });

    // Add low-performance alerts
    for (const t of performanceScores) {
      if (t.performance_score < 50) {
        alerts.push({
          type: 'low_teacher_performance',
          severity: t.performance_score < 30 ? 'high' : 'medium',
          title: `${t.teacher_name} needs attention`,
          detail: `Performance score: ${t.performance_score}/100 · Compliance: ${t.compliance_pct}% · Streak: ${t.current_streak} days`,
          teacher_id: t.teacher_id,
          section_label: t.section_label,
          class_name: t.class_name,
          performance_score: t.performance_score,
        });
      }
    }

    // Sort: high severity first, then medium
    alerts.sort((a, b) => (a.severity === 'high' ? -1 : 1) - (b.severity === 'high' ? -1 : 1));

    const result = {
      alerts,
      teacher_scores: performanceScores,
      generated_at: new Date().toISOString(),
      summary: {
        total_alerts: alerts.length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        by_type: {
          teacher_not_completing: alerts.filter(a => a.type === 'teacher_not_completing').length,
          low_attendance_trend: alerts.filter(a => a.type === 'low_attendance_trend').length,
          class_falling_behind: alerts.filter(a => a.type === 'class_falling_behind').length,
          weak_subject: alerts.filter(a => a.type === 'weak_subject').length,
          low_teacher_performance: alerts.filter(a => a.type === 'low_teacher_performance').length,
        },
      },
    };

    // Cache for 5 minutes
    await redis.setEx(cacheKey, 300, JSON.stringify(result));
    return res.json(result);
  } catch (err) {
    console.error('[smart-alerts]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/smart-alerts/teacher/:teacherId — performance drill-down
router.get('/teacher/:teacherId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { teacherId } = req.params;
    const today = await getToday(school_id);

    // Get teacher + section info
    const teacherRow = await pool.query(
      `SELECT u.name, sec.label as section_label, c.name as class_name, sec.id as section_id
       FROM users u
       JOIN sections sec ON sec.class_teacher_id = u.id AND sec.school_id = $1
       JOIN classes c ON c.id = sec.class_id
       WHERE u.id = $2 AND u.school_id = $1 LIMIT 1`,
      [school_id, teacherId]
    );
    if (!teacherRow.rows.length) return res.status(404).json({ error: 'Teacher not found' });
    const t = teacherRow.rows[0];

    // Last 30 days daily breakdown
    const dailyRow = await pool.query(
      `SELECT
         dp.plan_date::text as date,
         dp.status,
         CASE WHEN dc.id IS NOT NULL THEN true ELSE false END as completed,
         CASE WHEN ar_count.cnt > 0 THEN true ELSE false END as attendance_marked,
         CASE WHEN th.id IS NOT NULL THEN true ELSE false END as homework_sent,
         dc.submitted_at::text as completed_at
       FROM day_plans dp
       LEFT JOIN daily_completions dc ON dc.section_id = dp.section_id AND dc.completion_date = dp.plan_date
       LEFT JOIN (
         SELECT attend_date, COUNT(*) as cnt FROM attendance_records
         WHERE section_id = $2 AND attend_date BETWEEN ($3::date - INTERVAL '29 days') AND $3::date
         GROUP BY attend_date
       ) ar_count ON ar_count.attend_date = dp.plan_date
       LEFT JOIN teacher_homework th ON th.section_id = dp.section_id AND th.homework_date = dp.plan_date
       WHERE dp.section_id = $2 AND dp.school_id = $1
         AND dp.plan_date BETWEEN ($3::date - INTERVAL '29 days') AND $3::date
         AND dp.status NOT IN ('holiday','settling','revision','exam','event','weekend')
         AND dp.chunk_ids != '{}'
       ORDER BY dp.plan_date DESC`,
      [school_id, t.section_id, today]
    );

    // Homework submissions summary
    const hwRow = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='completed')::int as completed,
         COUNT(*) FILTER (WHERE status='partial')::int as partial,
         COUNT(*) FILTER (WHERE status='not_submitted')::int as not_submitted
       FROM homework_submissions
       WHERE section_id = $1
         AND homework_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date`,
      [t.section_id, today]
    );

    // AI usage breakdown
    const aiRow = await pool.query(
      `SELECT
         DATE_TRUNC('week', created_at)::date::text as week,
         COUNT(*) FILTER (WHERE metadata->>'outcome' = 'allowed')::int as allowed,
         COUNT(*) FILTER (WHERE metadata->>'outcome' = 'blocked_limit')::int as blocked
       FROM audit_logs
       WHERE school_id = $1 AND actor_id = $2 AND action = 'ai_query'
         AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY week ORDER BY week DESC`,
      [school_id, teacherId]
    );

    // Journey + observations
    const engRow = await pool.query(
      `SELECT
         COUNT(DISTINCT cj.id)::int as journey_entries,
         COUNT(DISTINCT cj.student_id)::int as students_with_journey,
         COUNT(DISTINCT so.id)::int as observations,
         COUNT(DISTINCT tn.id)::int as notes_sent
       FROM sections sec
       LEFT JOIN child_journey_entries cj ON cj.section_id = sec.id AND cj.teacher_id = $2
         AND cj.entry_date BETWEEN ($3::date - INTERVAL '29 days') AND $3::date
       LEFT JOIN student_observations so ON so.school_id = $1 AND so.teacher_id = $2
         AND so.obs_date BETWEEN ($3::date - INTERVAL '29 days') AND $3::date
       LEFT JOIN teacher_notes tn ON tn.section_id = sec.id AND tn.teacher_id = $2
         AND tn.note_date BETWEEN ($3::date - INTERVAL '29 days') AND $3::date
       WHERE sec.id = $4`,
      [school_id, teacherId, today, t.section_id]
    );

    return res.json({
      teacher_name: t.name,
      class_name: t.class_name,
      section_label: t.section_label,
      period: `Last 30 days (up to ${today})`,
      scoring_formula: {
        description: 'Performance score is calculated from 7 factors across the last 30 working days',
        factors: [
          { key: 'plan_completion',    weight: '30%', description: 'Percentage of working days where the daily plan was marked as completed' },
          { key: 'attendance_marking', weight: '15%', description: 'Percentage of working days where attendance was submitted on time' },
          { key: 'homework_sent',      weight: '15%', description: 'Percentage of working days where homework was sent to parents' },
          { key: 'teaching_streak',    weight: '10%', description: 'Current consecutive day streak (capped at 30 days = 100%)' },
          { key: 'ai_engagement',      weight: '10%', description: 'Oakie AI queries this week (capped at 20 = 100%) — shows active use of AI assistance' },
          { key: 'student_tracking',   weight: '10%', description: 'Child journey entries + student observations recorded (shows individual student attention)' },
          { key: 'parent_comms',       weight: '10%', description: 'Notes and messages sent to parents (shows communication consistency)' },
        ],
      },
      daily_breakdown: dailyRow.rows,
      homework_submissions: hwRow.rows[0],
      ai_usage_by_week: aiRow.rows,
      engagement: engRow.rows[0],
    });
  } catch (err) {
    console.error('[smart-alerts/teacher]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

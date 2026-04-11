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

    // ── 5. Teacher performance scores ─────────────────────────────────────
    const teacherScores = await pool.query(
      `SELECT
         u.id as teacher_id, u.name as teacher_name,
         sec.label as section_label, c.name as class_name,
         -- Completion compliance: % of working days with completion logged (last 30 days)
         ROUND(
           COUNT(dc.id)::numeric /
           NULLIF(COUNT(dp.id) FILTER (
             WHERE dp.plan_date <= $2::date
               AND dp.status NOT IN ('holiday','settling','revision','exam','event','weekend')
               AND dp.chunk_ids != '{}'
           ), 0) * 100
         )::int as compliance_pct,
         -- Streak
         COALESCE(ts.current_streak, 0) as current_streak,
         -- AI usage (last 7 days)
         COUNT(al.id) FILTER (
           WHERE al.action = 'ai_query'
             AND al.actor_id = u.id
             AND al.created_at > NOW() - INTERVAL '7 days'
             AND (al.metadata->>'outcome') = 'allowed'
         )::int as ai_queries_7d
       FROM sections sec
       JOIN classes c ON c.id = sec.class_id
       JOIN users u ON u.id = sec.class_teacher_id
       LEFT JOIN day_plans dp ON dp.section_id = sec.id AND dp.school_id = $1
         AND dp.plan_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date
       LEFT JOIN daily_completions dc ON dc.section_id = sec.id AND dc.completion_date = dp.plan_date
       LEFT JOIN teacher_streaks ts ON ts.teacher_id = u.id AND ts.school_id = $1
       LEFT JOIN audit_logs al ON al.school_id = $1 AND al.actor_id = u.id
       WHERE sec.school_id = $1 AND u.id IS NOT NULL
       GROUP BY u.id, u.name, sec.label, c.name, ts.current_streak`,
      [school_id, today]
    );

    const performanceScores = teacherScores.rows.map((row: any) => {
      const compliance = row.compliance_pct ?? 0;
      const streak = row.current_streak ?? 0;
      const aiUsage = Math.min(row.ai_queries_7d ?? 0, 20); // cap at 20 for scoring
      // Score: 60% compliance + 20% streak (capped at 30 days) + 20% AI engagement
      const score = Math.round(
        (compliance * 0.6) +
        (Math.min(streak, 30) / 30 * 100 * 0.2) +
        (aiUsage / 20 * 100 * 0.2)
      );
      return {
        teacher_id: row.teacher_id,
        teacher_name: row.teacher_name,
        section_label: row.section_label,
        class_name: row.class_name,
        compliance_pct: compliance,
        current_streak: streak,
        ai_queries_7d: row.ai_queries_7d,
        performance_score: score,
        band: score >= 75 ? 'green' : score >= 50 ? 'amber' : 'red',
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

export default router;

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, schoolScope, roleGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

/**
 * Participation score derivation (0–100):
 *
 * 40% — Journey engagement: teacher daily/weekly/highlight entries for this student
 *        in the last 30 days, capped at 12 entries = 100% of this component.
 *        More entries = teacher is actively noting the child = child is engaged.
 *
 * 30% — Observation coverage: how many of the 10 report categories have at least
 *        one observation recorded. Full coverage = 100% of this component.
 *
 * 20% — Positive sentiment: ratio of observations that do NOT contain negative
 *        keywords (struggles, needs support, difficulty, improvement needed, etc.)
 *        vs total observations. No observations = neutral 60%.
 *
 * 10% — Homework engagement: ratio of homework records with status 'completed'
 *        or 'submitted' vs total assigned in last 30 days. No records = neutral 60%.
 */

const NEGATIVE_KEYWORDS = [
  'struggles', 'struggle', 'needs support', 'needs improvement', 'difficulty',
  'difficult', 'improvement needed', 'not yet', 'unable', 'cannot', 'can\'t',
  'behind', 'below', 'weak', 'poor', 'lacking', 'lacks',
];

const REPORT_CATEGORY_COUNT = 10;
const JOURNEY_ENTRY_CAP = 12; // entries in 30 days = 100%

function computeParticipation(
  journeyCount: number,
  obsCategoryCount: number,
  totalObs: number,
  positiveObs: number,
  hwCompleted: number,
  hwTotal: number,
): number {
  // Component 1: journey engagement (40%)
  const journeyScore = Math.min(journeyCount / JOURNEY_ENTRY_CAP, 1) * 100;

  // Component 2: observation coverage (30%)
  const obsScore = (obsCategoryCount / REPORT_CATEGORY_COUNT) * 100;

  // Component 3: positive sentiment (20%)
  const sentimentScore = totalObs === 0 ? 60 : (positiveObs / totalObs) * 100;

  // Component 4: homework engagement (10%)
  const hwScore = hwTotal === 0 ? 60 : (hwCompleted / hwTotal) * 100;

  const raw = journeyScore * 0.40 + obsScore * 0.30 + sentimentScore * 0.20 + hwScore * 0.10;
  return Math.round(Math.min(Math.max(raw, 0), 100));
}

// GET /api/v1/parent/class-comparison/:studentId
router.get('/:studentId', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { studentId } = req.params;

    // Verify parent owns this student and get section
    const link = await pool.query(
      `SELECT s.section_id, s.class_id FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`,
      [user_id, studentId, school_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });
    const { section_id } = link.rows[0];

    const today = await getToday(school_id);
    const thirtyDaysAgo = (() => {
      const d = new Date(today + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 30);
      return d.toISOString().split('T')[0];
    })();

    // ── 1. Attendance for this student ──────────────────────────────────────
    const attRow = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'present')::int AS present,
         COUNT(*) FILTER (WHERE status = 'absent')::int  AS absent,
         COUNT(*)::int AS total
       FROM attendance_records
       WHERE student_id = $1 AND attend_date >= $2 AND attend_date <= $3`,
      [studentId, thirtyDaysAgo, today]
    );
    const att = attRow.rows[0];
    const myAttPct = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;

    // ── 2. Curriculum progress for this student ──────────────────────────────
    const progRow = await pool.query(
      `SELECT coverage_pct FROM student_progress_view WHERE student_id = $1 LIMIT 1`,
      [studentId]
    ).catch(() => ({ rows: [] }));

    // Fallback: compute from daily_completions vs total chunks
    let myProgressPct = 0;
    if (progRow.rows.length > 0) {
      myProgressPct = Math.round(progRow.rows[0].coverage_pct ?? 0);
    } else {
      const compRow = await pool.query(
        `SELECT
           COUNT(DISTINCT unnested)::int AS covered,
           (SELECT COUNT(*)::int FROM curriculum_chunks cc
            JOIN curriculum_documents cd ON cd.id = cc.document_id
            JOIN sections sec ON sec.class_id = cd.class_id
            WHERE sec.id = $1 AND cd.school_id = $2) AS total
         FROM daily_completions dc,
              LATERAL UNNEST(dc.covered_chunk_ids) AS unnested
         WHERE dc.section_id = $1`,
        [section_id, school_id]
      );
      const c = compRow.rows[0];
      myProgressPct = c.total > 0 ? Math.round((c.covered / c.total) * 100) : 0;
    }

    // ── 3. Participation for this student ────────────────────────────────────
    // 3a. Journey entries in last 30 days
    const journeyRow = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM child_journey_entries
       WHERE student_id = $1 AND entry_date >= $2 AND entry_date <= $3`,
      [studentId, thirtyDaysAgo, today]
    );
    const journeyCount = journeyRow.rows[0]?.cnt ?? 0;

    // 3b. Observation category coverage
    const obsRow = await pool.query(
      `SELECT obs_text, categories FROM student_observations
       WHERE student_id = $1 AND school_id = $2`,
      [studentId, school_id]
    );
    const allCategories = new Set<string>();
    let positiveObs = 0;
    for (const obs of obsRow.rows) {
      for (const cat of (obs.categories ?? [])) allCategories.add(cat.toLowerCase());
      const text = (obs.obs_text ?? '').toLowerCase();
      const isNegative = NEGATIVE_KEYWORDS.some(kw => text.includes(kw));
      if (!isNegative) positiveObs++;
    }
    const obsCategoryCount = allCategories.size;
    const totalObs = obsRow.rows.length;

    // 3c. Homework engagement
    const hwRow = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('completed','submitted','done'))::int AS completed,
         COUNT(*)::int AS total
       FROM student_homework_records
       WHERE student_id = $1 AND homework_date >= $2 AND homework_date <= $3`,
      [studentId, thirtyDaysAgo, today]
    ).catch(() => ({ rows: [{ completed: 0, total: 0 }] }));
    const hw = hwRow.rows[0] ?? { completed: 0, total: 0 };

    const myParticipation = computeParticipation(
      journeyCount, obsCategoryCount, totalObs, positiveObs,
      hw.completed, hw.total
    );

    // ── 4. Class averages (all students in same section) ─────────────────────
    // Attendance average
    const classAttRow = await pool.query(
      `SELECT
         s.id,
         COUNT(ar.id) FILTER (WHERE ar.status = 'present')::float AS present,
         COUNT(ar.id)::float AS total
       FROM students s
       LEFT JOIN attendance_records ar
         ON ar.student_id = s.id AND ar.attend_date >= $2 AND ar.attend_date <= $3
       WHERE s.section_id = $1 AND s.is_active = true
       GROUP BY s.id`,
      [section_id, thirtyDaysAgo, today]
    );
    const classAttPcts = classAttRow.rows.map((r: any) =>
      r.total > 0 ? Math.round((r.present / r.total) * 100) : 0
    );
    const classAvgAtt = classAttPcts.length > 0
      ? Math.round(classAttPcts.reduce((a: number, b: number) => a + b, 0) / classAttPcts.length)
      : 0;

    // Progress average — use same fallback approach
    const classProgRow = await pool.query(
      `SELECT
         s.id,
         COUNT(DISTINCT unnested)::float AS covered,
         (SELECT COUNT(*)::float FROM curriculum_chunks cc
          JOIN curriculum_documents cd ON cd.id = cc.document_id
          JOIN sections sec ON sec.class_id = cd.class_id
          WHERE sec.id = $1 AND cd.school_id = $2) AS total
       FROM students s
       LEFT JOIN daily_completions dc ON dc.section_id = $1
       LEFT JOIN LATERAL UNNEST(dc.covered_chunk_ids) AS unnested ON true
       WHERE s.section_id = $1 AND s.is_active = true
       GROUP BY s.id`,
      [section_id, school_id]
    ).catch(() => ({ rows: [] }));

    // Since curriculum progress is per-section (not per-student), all students share the same value
    const classAvgProgress = myProgressPct; // same curriculum for all in section

    // Participation average for section
    const classJourneyRow = await pool.query(
      `SELECT student_id, COUNT(*)::int AS cnt
       FROM child_journey_entries
       WHERE section_id = $1 AND entry_date >= $2 AND entry_date <= $3
       GROUP BY student_id`,
      [section_id, thirtyDaysAgo, today]
    );
    const classObsRow = await pool.query(
      `SELECT student_id, obs_text, categories
       FROM student_observations
       WHERE school_id = $1 AND student_id IN (
         SELECT id FROM students WHERE section_id = $2 AND is_active = true
       )`,
      [school_id, section_id]
    );

    // Get all students in section
    const sectionStudentsRow = await pool.query(
      `SELECT id FROM students WHERE section_id = $1 AND is_active = true`,
      [section_id]
    );
    const sectionStudentIds: string[] = sectionStudentsRow.rows.map((r: any) => r.id);

    const journeyMap: Record<string, number> = {};
    for (const r of classJourneyRow.rows) journeyMap[r.student_id] = r.cnt;

    const obsMap: Record<string, { cats: Set<string>; total: number; positive: number }> = {};
    for (const r of classObsRow.rows) {
      if (!obsMap[r.student_id]) obsMap[r.student_id] = { cats: new Set(), total: 0, positive: 0 };
      for (const cat of (r.categories ?? [])) obsMap[r.student_id].cats.add(cat.toLowerCase());
      obsMap[r.student_id].total++;
      const text = (r.obs_text ?? '').toLowerCase();
      if (!NEGATIVE_KEYWORDS.some(kw => text.includes(kw))) obsMap[r.student_id].positive++;
    }

    const classParticipations = sectionStudentIds.map(sid => {
      const jc = journeyMap[sid] ?? 0;
      const o = obsMap[sid] ?? { cats: new Set(), total: 0, positive: 0 };
      return computeParticipation(jc, o.cats.size, o.total, o.positive, 0, 0);
    });
    const classAvgParticipation = classParticipations.length > 0
      ? Math.round(classParticipations.reduce((a, b) => a + b, 0) / classParticipations.length)
      : 0;

    // Top performer: student with highest participation in section
    let topParticipation = myParticipation;
    let topAttendance = myAttPct;
    let topProgress = myProgressPct;
    for (let i = 0; i < sectionStudentIds.length; i++) {
      const p = classParticipations[i];
      if (p > topParticipation) {
        topParticipation = p;
        // Top performer attendance
        const ta = classAttRow.rows.find((r: any) => r.id === sectionStudentIds[i]);
        topAttendance = ta && ta.total > 0 ? Math.round((ta.present / ta.total) * 100) : topAttendance;
        topProgress = classAvgProgress; // same curriculum
      }
    }

    // Trend: compare this student's participation to class average
    const myTrend: 'up' | 'down' | 'stable' =
      myParticipation > classAvgParticipation + 5 ? 'up' :
      myParticipation < classAvgParticipation - 5 ? 'down' : 'stable';

    return res.json([
      {
        label: 'Your Child',
        isChild: true,
        attendance: myAttPct,
        progress: myProgressPct,
        participation: myParticipation,
        trend: myTrend,
      },
      {
        label: 'Class Average',
        isChild: false,
        attendance: classAvgAtt,
        progress: classAvgProgress,
        participation: classAvgParticipation,
        trend: 'stable' as const,
      },
      {
        label: 'Top in Class',
        isChild: false,
        attendance: topAttendance,
        progress: topProgress,
        participation: topParticipation,
        trend: 'up' as const,
      },
    ]);
  } catch (err) {
    console.error('[class-comparison]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

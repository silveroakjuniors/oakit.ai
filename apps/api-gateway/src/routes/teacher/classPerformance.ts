import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher'));

// Safe query helper — returns empty rows on failure
async function safeQuery(text: string, params: any[]): Promise<any[]> {
  try {
    const r = await pool.query(text, params);
    return r.rows;
  } catch (err) {
    console.error('[classPerformance] query failed:', (err as Error).message);
    return [];
  }
}

// GET /api/v1/teacher/class-performance?section_id=
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const thirtyDaysAgo = new Date(new Date(today).getTime() - 30 * 86400000).toISOString().split('T')[0];

    // Resolve section
    const sections = await getTeacherSections(user_id, school_id);
    const requestedSectionId = req.query.section_id as string | undefined;
    let section_id: string | null = null;
    if (requestedSectionId && sections.some(s => s.section_id === requestedSectionId)) {
      section_id = requestedSectionId;
    } else {
      section_id = sections[0]?.section_id || null;
    }
    if (!section_id) return res.status(404).json({ error: 'No section assigned' });

    // Get class info
    const classRows = await safeQuery(
      `SELECT s.label AS section_label, c.id AS class_id, c.name AS class_name, c.day_start_time
       FROM sections s JOIN classes c ON c.id = s.class_id WHERE s.id = $1`,
      [section_id]
    );
    if (classRows.length === 0) return res.status(404).json({ error: 'Section not found' });
    const { section_label, class_id, class_name, day_start_time } = classRows[0];

    // ── 1. Student count ──
    const studentRows = await safeQuery(
      `SELECT COUNT(*)::int AS total FROM students WHERE section_id = $1 AND is_active = true`,
      [section_id]
    );
    const total_students = studentRows[0]?.total || 0;

    // ── 2. Attendance stats (last 30 days) ──
    const attRows = await safeQuery(
      `SELECT
         COUNT(DISTINCT ar.attend_date)::int AS days_marked,
         COUNT(*) FILTER (WHERE ar.status = 'present')::int AS total_present,
         COUNT(*) FILTER (WHERE ar.status = 'absent')::int AS total_absent,
         ROUND(AVG(CASE WHEN ar.status = 'present' THEN 1.0 ELSE 0.0 END) * 100)::int AS avg_attendance_pct
       FROM attendance_records ar
       WHERE ar.section_id = $1 AND ar.school_id = $2 AND ar.attend_date >= $3`,
      [section_id, school_id, thirtyDaysAgo]
    );
    const att = attRows[0] || {};

    // Average attendance time
    const attTimeRows = await safeQuery(
      `SELECT
         AVG(EXTRACT(HOUR FROM submitted_at AT TIME ZONE 'Asia/Kolkata') * 60 + EXTRACT(MINUTE FROM submitted_at AT TIME ZONE 'Asia/Kolkata'))::int AS avg_minutes
       FROM attendance_records ar
       WHERE ar.section_id = $1 AND ar.school_id = $2 AND ar.attend_date >= $3
         AND ar.submitted_at IS NOT NULL`,
      [section_id, school_id, thirtyDaysAgo]
    );
    const avgAttMinutes = attTimeRows[0]?.avg_minutes || null;
    const avg_attendance_time = avgAttMinutes
      ? `${String(Math.floor(avgAttMinutes / 60)).padStart(2, '0')}:${String(avgAttMinutes % 60).padStart(2, '0')}`
      : null;

    // ── 3. Curriculum coverage ──
    const covRows = await safeQuery(
      `SELECT
         COUNT(*)::int AS total_chunks,
         COUNT(*) FILTER (WHERE cs.status = 'covered')::int AS covered_chunks
       FROM curriculum_chunks cc
       LEFT JOIN coverage_statuses cs ON cs.chunk_id = cc.id
       WHERE cc.section_id = $1 AND cc.school_id = $2`,
      [section_id, school_id]
    );
    const cov = covRows[0] || { total_chunks: 0, covered_chunks: 0 };
    const coverage_pct = cov.total_chunks > 0 ? Math.round((cov.covered_chunks / cov.total_chunks) * 100) : 0;

    // ── 4. Daily completion stats (last 30 days) ──
    const compRows = await safeQuery(
      `SELECT COUNT(*)::int AS days_completed
       FROM daily_completions
       WHERE section_id = $1 AND school_id = $2 AND completion_date >= $3`,
      [section_id, school_id, thirtyDaysAgo]
    );
    const days_completed = compRows[0]?.days_completed || 0;

    // Average completion time
    const compTimeRows = await safeQuery(
      `SELECT
         AVG(EXTRACT(HOUR FROM submitted_at AT TIME ZONE 'Asia/Kolkata') * 60 + EXTRACT(MINUTE FROM submitted_at AT TIME ZONE 'Asia/Kolkata'))::int AS avg_minutes
       FROM daily_completions
       WHERE section_id = $1 AND school_id = $2 AND completion_date >= $3 AND submitted_at IS NOT NULL`,
      [section_id, school_id, thirtyDaysAgo]
    );
    const avgCompMinutes = compTimeRows[0]?.avg_minutes || null;
    const avg_completion_time = avgCompMinutes
      ? `${String(Math.floor(avgCompMinutes / 60)).padStart(2, '0')}:${String(avgCompMinutes % 60).padStart(2, '0')}`
      : null;

    // ── 5. Child journey / comments sent ──
    const journalRows = await safeQuery(
      `SELECT
         COUNT(*)::int AS total_entries,
         COUNT(*) FILTER (WHERE is_sent_to_parent = true)::int AS sent_to_parents
       FROM child_journey_entries
       WHERE section_id = $1 AND school_id = $2 AND entry_date >= $3`,
      [section_id, school_id, thirtyDaysAgo]
    );
    const journal = journalRows[0] || { total_entries: 0, sent_to_parents: 0 };

    // ── 6. Parent engagement ──
    const parentRows = await safeQuery(
      `SELECT
         COUNT(DISTINCT pu.id)::int AS total_parents,
         COUNT(DISTINCT pu.id) FILTER (WHERE pu.force_password_reset = false AND EXISTS (
           SELECT 1 FROM messages m WHERE m.parent_id = pu.id AND m.school_id = $2 AND m.sent_at >= $3
         ))::int AS active_parents,
         COUNT(DISTINCT pu.id) FILTER (WHERE pu.force_password_reset = true)::int AS never_logged_in
       FROM parent_users pu
       JOIN parent_student_links psl ON psl.parent_id = pu.id
       JOIN students st ON st.id = psl.student_id AND st.section_id = $1
       WHERE pu.school_id = $2 AND pu.is_active = true`,
      [section_id, school_id, thirtyDaysAgo]
    );
    const parents = parentRows[0] || { total_parents: 0, active_parents: 0, never_logged_in: 0 };
    const inactive_parents = Math.max(0, (parents.total_parents || 0) - (parents.active_parents || 0) - (parents.never_logged_in || 0));

    // ── 6b. Parent detail list (for drill-down) ──
    const parentDetailRows = await safeQuery(
      `SELECT
         pu.id, pu.name AS parent_name, pu.mobile,
         st.name AS student_name,
         pu.force_password_reset,
         MAX(m.sent_at) AS last_message_at,
         COUNT(m.id)::int AS messages_30d,
         CASE
           WHEN pu.force_password_reset = true THEN 'never_logged_in'
           WHEN COUNT(m.id) > 0 THEN 'active'
           ELSE 'inactive'
         END AS status
       FROM parent_users pu
       JOIN parent_student_links psl ON psl.parent_id = pu.id
       JOIN students st ON st.id = psl.student_id AND st.section_id = $1
       LEFT JOIN messages m ON m.parent_id = pu.id AND m.school_id = $2 AND m.sent_at >= $3
       WHERE pu.school_id = $2 AND pu.is_active = true
       GROUP BY pu.id, pu.name, pu.mobile, st.name, pu.force_password_reset
       ORDER BY pu.name`,
      [section_id, school_id, thirtyDaysAgo]
    );

    // ── 7. School-wide comparison (all sections) — comprehensive teacher performance ──
    const schoolComparison = await safeQuery(
      `SELECT
         s.id AS section_id, s.label AS section_label, c.name AS class_name,
         COUNT(DISTINCT dc.completion_date)::int AS completions_30d,
         COALESCE(
           ROUND(
             (COUNT(*) FILTER (WHERE ar.status = 'present')::float /
              NULLIF(COUNT(ar.id), 0)) * 100
           )::int, 0
         ) AS att_pct,
         COUNT(DISTINCT cje.id) FILTER (WHERE cje.is_sent_to_parent = true)::int AS comments_sent
       FROM sections s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN daily_completions dc ON dc.section_id = s.id AND dc.completion_date >= $2
       LEFT JOIN attendance_records ar ON ar.section_id = s.id AND ar.attend_date >= $2
       LEFT JOIN child_journey_entries cje ON cje.section_id = s.id AND cje.entry_date >= $2
       WHERE s.school_id = $1
       GROUP BY s.id, s.label, c.name
       ORDER BY c.name, s.label`,
      [school_id, thirtyDaysAgo]
    );

    // ── 7b. Teacher performance score per section (for ranking) ──
    const perfScores = await safeQuery(
      `WITH section_students AS (
         SELECT section_id, COUNT(*)::int AS student_count
         FROM students WHERE school_id = $1 AND is_active = true
         GROUP BY section_id
       ),
       completion_stats AS (
         SELECT section_id,
           COUNT(DISTINCT completion_date)::int AS days_completed,
           AVG(EXTRACT(HOUR FROM submitted_at AT TIME ZONE 'Asia/Kolkata') * 60
             + EXTRACT(MINUTE FROM submitted_at AT TIME ZONE 'Asia/Kolkata'))::int AS avg_comp_minutes
         FROM daily_completions
         WHERE school_id = $1 AND completion_date >= $2 AND submitted_at IS NOT NULL
         GROUP BY section_id
       ),
       att_timing AS (
         SELECT section_id,
           AVG(EXTRACT(HOUR FROM submitted_at AT TIME ZONE 'Asia/Kolkata') * 60
             + EXTRACT(MINUTE FROM submitted_at AT TIME ZONE 'Asia/Kolkata'))::int AS avg_att_minutes
         FROM attendance_records
         WHERE school_id = $1 AND attend_date >= $2 AND submitted_at IS NOT NULL
         GROUP BY section_id
       ),
       journal_stats AS (
         SELECT section_id,
           COUNT(*)::int AS total_entries,
           COUNT(*) FILTER (WHERE is_sent_to_parent = true)::int AS sent_entries
         FROM child_journey_entries
         WHERE school_id = $1 AND entry_date >= $2
         GROUP BY section_id
       ),
       feed_stats AS (
         SELECT section_id, COUNT(*)::int AS post_count
         FROM feed_posts
         WHERE school_id = $1 AND created_at >= ($2::date)::timestamptz AND section_id IS NOT NULL
         GROUP BY section_id
       ),
       milestone_stats AS (
         SELECT s.section_id, COUNT(DISTINCT sm.id)::int AS milestones_marked
         FROM student_milestones sm
         JOIN students s ON s.id = sm.student_id
         WHERE s.school_id = $1 AND sm.achieved_at >= $2
         GROUP BY s.section_id
       ),
       homework_stats AS (
         SELECT section_id, COUNT(DISTINCT homework_date)::int AS hw_days
         FROM teacher_homework
         WHERE school_id = $1 AND homework_date >= $2
         GROUP BY section_id
       ),
       observation_stats AS (
         SELECT s.section_id, COUNT(*)::int AS obs_count
         FROM student_observations so
         JOIN students s ON s.id = so.student_id
         WHERE so.school_id = $1 AND so.obs_date >= $2
         GROUP BY s.section_id
       )
       SELECT
         sec.id AS section_id,
         COALESCE(ss.student_count, 0) AS student_count,
         COALESCE(cs.days_completed, 0) AS days_completed,
         cs.avg_comp_minutes,
         at2.avg_att_minutes,
         COALESCE(js.total_entries, 0) AS journal_entries,
         COALESCE(js.sent_entries, 0) AS journal_sent,
         COALESCE(fs.post_count, 0) AS feed_posts,
         COALESCE(ms.milestones_marked, 0) AS milestones_marked,
         COALESCE(hs.hw_days, 0) AS hw_days,
         COALESCE(os.obs_count, 0) AS obs_count
       FROM sections sec
       LEFT JOIN section_students ss ON ss.section_id = sec.id
       LEFT JOIN completion_stats cs ON cs.section_id = sec.id
       LEFT JOIN att_timing at2 ON at2.section_id = sec.id
       LEFT JOIN journal_stats js ON js.section_id = sec.id
       LEFT JOIN feed_stats fs ON fs.section_id = sec.id
       LEFT JOIN milestone_stats ms ON ms.section_id = sec.id
       LEFT JOIN homework_stats hs ON hs.section_id = sec.id
       LEFT JOIN observation_stats os ON os.section_id = sec.id
       WHERE sec.school_id = $1`,
      [school_id, thirtyDaysAgo]
    );

    // Calculate composite performance score for each section
    const SCHOOL_DAYS_30 = 22;
    const TARGET_ATT_TIME = 570; // 09:30 in minutes
    const TARGET_COMP_TIME = 780; // 13:00 in minutes

    const sectionScores = perfScores.map((s: any) => {
      const studentCount = Math.max(s.student_count || 1, 1);

      const completionScore = Math.min(100, ((s.days_completed || 0) / SCHOOL_DAYS_30) * 100);

      let compTimeScore = 0;
      if (s.avg_comp_minutes != null) {
        const diff = Math.max(0, s.avg_comp_minutes - TARGET_COMP_TIME);
        compTimeScore = Math.max(0, 100 - (diff / 3));
      }

      let attTimeScore = 0;
      if (s.avg_att_minutes != null) {
        const diff = Math.max(0, s.avg_att_minutes - TARGET_ATT_TIME);
        attTimeScore = Math.max(0, 100 - (diff / 3));
      }

      const journalTarget = studentCount * 2;
      const journalScore = Math.min(100, ((s.journal_sent || 0) / journalTarget) * 100);

      const feedScore = Math.min(100, ((s.feed_posts || 0) / SCHOOL_DAYS_30) * 100);

      const milestoneScore = Math.min(100, ((s.milestones_marked || 0) / studentCount) * 100);

      const hwScore = Math.min(100, ((s.hw_days || 0) / SCHOOL_DAYS_30) * 100);

      const obsTarget = Math.max(1, Math.round(studentCount * 0.5));
      const obsScore = Math.min(100, ((s.obs_count || 0) / obsTarget) * 100);

      const totalScore = Math.round(
        completionScore * 0.20 +
        compTimeScore * 0.15 +
        attTimeScore * 0.15 +
        journalScore * 0.15 +
        feedScore * 0.10 +
        milestoneScore * 0.10 +
        hwScore * 0.10 +
        obsScore * 0.05
      );

      return {
        section_id: s.section_id,
        score: totalScore,
        breakdown: {
          completion: Math.round(completionScore),
          comp_timeliness: Math.round(compTimeScore),
          att_timeliness: Math.round(attTimeScore),
          journal: Math.round(journalScore),
          feed: Math.round(feedScore),
          milestones: Math.round(milestoneScore),
          homework: Math.round(hwScore),
          observations: Math.round(obsScore),
        },
      };
    });

    sectionScores.sort((a: any, b: any) => b.score - a.score);
    const rankedSections = sectionScores.map((s: any, i: number) => ({ ...s, rank: i + 1 }));
    const myRankEntry = rankedSections.find((s: any) => s.section_id === section_id);
    const myRank = myRankEntry?.rank || 1;

    // ── 8. Weekly attendance trend (last 4 weeks) ──
    const weeklyTrend = await safeQuery(
      `SELECT
         DATE_TRUNC('week', ar.attend_date::timestamp)::date AS week_start,
         ROUND(AVG(CASE WHEN ar.status = 'present' THEN 1.0 ELSE 0.0 END) * 100)::int AS att_pct,
         COUNT(DISTINCT ar.attend_date)::int AS days
       FROM attendance_records ar
       WHERE ar.section_id = $1 AND ar.school_id = $2 AND ar.attend_date >= $3
       GROUP BY week_start
       ORDER BY week_start`,
      [section_id, school_id, thirtyDaysAgo]
    );

    // ── 9. Daily timing data (attendance time + completion time per day) ──
    const dailyAttTime = await safeQuery(
      `SELECT
         ar.attend_date AS date,
         MIN(EXTRACT(HOUR FROM ar.submitted_at AT TIME ZONE 'Asia/Kolkata') * 60 + EXTRACT(MINUTE FROM ar.submitted_at AT TIME ZONE 'Asia/Kolkata'))::int AS time_minutes
       FROM attendance_records ar
       WHERE ar.section_id = $1 AND ar.school_id = $2 AND ar.attend_date >= $3
         AND ar.submitted_at IS NOT NULL
         AND EXTRACT(DOW FROM ar.attend_date) NOT IN (0, 6)
       GROUP BY ar.attend_date
       ORDER BY ar.attend_date`,
      [section_id, school_id, thirtyDaysAgo]
    );

    const dailyCompTime = await safeQuery(
      `SELECT
         dc.completion_date AS date,
         (EXTRACT(HOUR FROM dc.submitted_at AT TIME ZONE 'Asia/Kolkata') * 60 + EXTRACT(MINUTE FROM dc.submitted_at AT TIME ZONE 'Asia/Kolkata'))::int AS time_minutes
       FROM daily_completions dc
       WHERE dc.section_id = $1 AND dc.school_id = $2 AND dc.completion_date >= $3
         AND dc.submitted_at IS NOT NULL
         AND EXTRACT(DOW FROM dc.completion_date) NOT IN (0, 6)
       ORDER BY dc.completion_date`,
      [section_id, school_id, thirtyDaysAgo]
    );

    // ── 10. Attendance outliers — students below 70% ──
    const attOutliers = await safeQuery(
      `SELECT s.id, s.name,
         COUNT(*) FILTER (WHERE ar.status = 'present')::int AS present_days,
         COUNT(*) FILTER (WHERE ar.status = 'absent')::int AS absent_days,
         COUNT(DISTINCT ar.attend_date)::int AS total_days,
         CASE WHEN COUNT(DISTINCT ar.attend_date) > 0
           THEN ROUND((COUNT(*) FILTER (WHERE ar.status = 'present')::float / COUNT(DISTINCT ar.attend_date)) * 100)::int
           ELSE 0 END AS att_pct
       FROM students s
       LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.attend_date >= $3 AND ar.school_id = $2
       WHERE s.section_id = $1 AND s.is_active = true
       GROUP BY s.id, s.name
       HAVING COUNT(DISTINCT ar.attend_date) > 0
         AND ROUND((COUNT(*) FILTER (WHERE ar.status = 'present')::float / COUNT(DISTINCT ar.attend_date)) * 100) < 70
       ORDER BY att_pct ASC`,
      [section_id, school_id, thirtyDaysAgo]
    );

    // ── 11. Students without journal entry in last 14 days ──
    const twoWeeksAgo = new Date(new Date(today).getTime() - 14 * 86400000).toISOString().split('T')[0];
    const noJournalStudents = await safeQuery(
      `SELECT s.id, s.name
       FROM students s
       WHERE s.section_id = $1 AND s.is_active = true
         AND NOT EXISTS (
           SELECT 1 FROM child_journey_entries cje
           WHERE cje.student_id = s.id AND cje.entry_date >= $2
         )
       ORDER BY s.name`,
      [section_id, twoWeeksAgo]
    );

    // ── 12. Upcoming birthdays (next 7 days) ──
    const birthdays = await safeQuery(
      `SELECT s.id, s.name, s.date_of_birth
       FROM students s
       WHERE s.section_id = $1 AND s.is_active = true AND s.date_of_birth IS NOT NULL
         AND (
           (EXTRACT(MONTH FROM s.date_of_birth) = EXTRACT(MONTH FROM $2::date)
            AND EXTRACT(DAY FROM s.date_of_birth) >= EXTRACT(DAY FROM $2::date)
            AND EXTRACT(DAY FROM s.date_of_birth) <= EXTRACT(DAY FROM ($2::date + INTERVAL '7 days')))
           OR
           (EXTRACT(MONTH FROM s.date_of_birth) = EXTRACT(MONTH FROM ($2::date + INTERVAL '7 days'))
            AND EXTRACT(DAY FROM s.date_of_birth) <= EXTRACT(DAY FROM ($2::date + INTERVAL '7 days'))
            AND EXTRACT(MONTH FROM ($2::date + INTERVAL '7 days')) != EXTRACT(MONTH FROM $2::date))
         )
       ORDER BY EXTRACT(MONTH FROM s.date_of_birth), EXTRACT(DAY FROM s.date_of_birth)`,
      [section_id, today]
    );

    // ── 13. Homework sent stats (last 30 days) ──
    const homeworkStats = await safeQuery(
      `SELECT
         COUNT(*)::int AS total_sent,
         COUNT(DISTINCT homework_date)::int AS days_with_homework
       FROM teacher_homework
       WHERE section_id = $1 AND school_id = $2 AND homework_date >= $3`,
      [section_id, school_id, thirtyDaysAgo]
    );
    const hw = homeworkStats[0] || { total_sent: 0, days_with_homework: 0 };

    // ── 14. Unread parent messages ──
    const unreadMessages = await safeQuery(
      `SELECT COUNT(*)::int AS unread
       FROM messages m
       JOIN students st ON st.id = m.student_id AND st.section_id = $1
       WHERE m.school_id = $2 AND m.sender_type = 'parent' AND m.read_at IS NULL`,
      [section_id, school_id]
    );
    const unread_messages = unreadMessages[0]?.unread || 0;

    // ── 15. Pending/carry-forward topics ──
    const pendingTopics = await safeQuery(
      `SELECT COUNT(*)::int AS pending
       FROM day_plans dp
       WHERE dp.section_id = $1 AND dp.school_id = $2
         AND dp.plan_date < $3 AND dp.status = 'pending'`,
      [section_id, school_id, today]
    );
    const pending_topics = pendingTopics[0]?.pending || 0;

    // ── 16. Teacher streak ──
    const streakRows = await safeQuery(
      `SELECT current_streak, best_streak FROM teacher_streaks
       WHERE teacher_id = $1 AND school_id = $2`,
      [user_id, school_id]
    );
    const streak = streakRows[0] || { current_streak: 0, best_streak: 0 };

    // ── 17. School rank (performance score) ──
    const totalSections = schoolComparison.length;

    return res.json({
      section_id,
      section_label,
      class_name,
      total_students,
      today,
      day_start_time: day_start_time || '09:30',
      attendance: {
        days_marked: att.days_marked || 0,
        avg_pct: att.avg_attendance_pct || 0,
        total_present: att.total_present || 0,
        total_absent: att.total_absent || 0,
        avg_time: avg_attendance_time,
      },
      curriculum: {
        total_chunks: cov.total_chunks || 0,
        covered_chunks: cov.covered_chunks || 0,
        coverage_pct,
      },
      completion: {
        days_completed,
        avg_time: avg_completion_time,
      },
      journal: {
        total_entries: journal.total_entries || 0,
        sent_to_parents: journal.sent_to_parents || 0,
      },
      parents: {
        total: parents.total_parents || 0,
        active: parents.active_parents || 0,
        inactive: inactive_parents,
        never_logged_in: parents.never_logged_in || 0,
        details: parentDetailRows,
      },
      school_comparison: schoolComparison,
      weekly_trend: weeklyTrend,
      daily_att_time: dailyAttTime,
      daily_comp_time: dailyCompTime,
      attendance_outliers: attOutliers,
      no_journal_students: noJournalStudents,
      birthdays,
      homework: { total_sent: hw.total_sent || 0, days_with_homework: hw.days_with_homework || 0 },
      unread_messages,
      pending_topics,
      streak: { current: streak.current_streak || 0, best: streak.best_streak || 0 },
      school_rank: { rank: myRank, total: totalSections, score: myRankEntry?.score || 0, breakdown: myRankEntry?.breakdown || {} },
      section_scores: rankedSections.map((s: any) => {
        const comp = schoolComparison.find((c: any) => c.section_id === s.section_id);
        return {
          section_id: s.section_id,
          section_label: comp?.section_label || '',
          class_name: comp?.class_name || '',
          rank: s.rank,
          score: s.score,
          breakdown: s.breakdown,
        };
      }),
    });
  } catch (err) {
    console.error('[classPerformance] GET', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/class-performance/journal-entries?section_id=&filter=all|sent|unsent
router.get('/journal-entries', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const thirtyDaysAgo = new Date(new Date(today).getTime() - 30 * 86400000).toISOString().split('T')[0];

    // Resolve section
    const sections = await getTeacherSections(user_id, school_id);
    const requestedSectionId = req.query.section_id as string | undefined;
    let section_id: string | null = null;
    if (requestedSectionId && sections.some(s => s.section_id === requestedSectionId)) {
      section_id = requestedSectionId;
    } else {
      section_id = sections[0]?.section_id || null;
    }
    if (!section_id) return res.status(404).json({ error: 'No section assigned' });

    const filter = (req.query.filter as string) || 'all';
    let filterClause = '';
    if (filter === 'sent') filterClause = 'AND cje.is_sent_to_parent = true';
    else if (filter === 'unsent') filterClause = 'AND cje.is_sent_to_parent = false';

    const rows = await safeQuery(
      `SELECT cje.id, cje.entry_date, cje.entry_type, cje.beautified_text, cje.raw_text,
              cje.is_sent_to_parent, cje.sent_at, cje.read_at, s.name AS student_name
       FROM child_journey_entries cje
       JOIN students s ON s.id = cje.student_id
       WHERE cje.section_id = $1 AND cje.school_id = $2 AND cje.entry_date >= $3
         ${filterClause}
       ORDER BY cje.entry_date DESC, cje.sent_at DESC NULLS LAST`,
      [section_id, school_id, thirtyDaysAgo]
    );

    return res.json({ entries: rows });
  } catch (err) {
    console.error('[classPerformance] GET /journal-entries', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

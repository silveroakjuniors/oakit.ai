import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher'));

// GET /api/v1/teacher/insights/class-summary
// Returns class-level stats: total students, attendance trends, milestone progress, observation coverage
router.get('/class-summary', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const sections = await getTeacherSections(user_id, school_id);
    if (sections.length === 0) return res.json({ total_students: 0 });

    const sectionIds = sections.map(s => s.section_id);
    const today = await getToday(school_id);

    // Total students
    const studentsResult = await pool.query(
      `SELECT COUNT(*)::int as total FROM students WHERE section_id = ANY($1::uuid[]) AND school_id = $2`,
      [sectionIds, school_id]
    );
    const totalStudents = studentsResult.rows[0]?.total || 0;

    // Attendance this month
    const attendanceResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE ar.status = 'present')::int as present_count,
         COUNT(*) FILTER (WHERE ar.status = 'absent')::int as absent_count,
         COUNT(*) FILTER (WHERE ar.status = 'late')::int as late_count,
         COUNT(DISTINCT ar.attend_date)::int as school_days
       FROM attendance_records ar
       JOIN students s ON s.id = ar.student_id
       WHERE s.section_id = ANY($1::uuid[]) AND s.school_id = $2
         AND ar.attend_date >= date_trunc('month', $3::date)
         AND ar.attend_date <= $3::date`,
      [sectionIds, school_id, today]
    );
    const att = attendanceResult.rows[0] || {};

    // Attendance last 7 days (for line chart)
    const weeklyAttResult = await pool.query(
      `SELECT ar.attend_date::text as date,
         COUNT(*) FILTER (WHERE ar.status = 'present')::int as present,
         COUNT(*) FILTER (WHERE ar.status = 'absent')::int as absent
       FROM attendance_records ar
       JOIN students s ON s.id = ar.student_id
       WHERE s.section_id = ANY($1::uuid[]) AND s.school_id = $2
         AND ar.attend_date > ($3::date - 7)
         AND ar.attend_date <= $3::date
       GROUP BY ar.attend_date
       ORDER BY ar.attend_date`,
      [sectionIds, school_id, today]
    );

    // Milestone progress per domain (for bar chart)
    // Get class level first
    const classRow = await pool.query(
      `SELECT c.name FROM classes c JOIN sections sec ON sec.class_id = c.id WHERE sec.id = ANY($1::uuid[]) LIMIT 1`,
      [sectionIds]
    );
    const classLevel = classRow.rows[0]?.name;

    let milestoneRows: any[] = [];
    if (classLevel) {
      const milestoneResult = await pool.query(
        `SELECT m.domain,
           COUNT(DISTINCT m.id)::int as total,
           COUNT(DISTINCT sm.milestone_id)::int as achieved
         FROM milestones m
         LEFT JOIN student_milestones sm ON sm.milestone_id = m.id
           AND sm.student_id IN (SELECT id FROM students WHERE section_id = ANY($1::uuid[]) AND school_id = $2)
         WHERE (m.school_id IS NULL OR m.school_id = $2)
           AND m.class_level = $3
         GROUP BY m.domain
         ORDER BY m.domain`,
        [sectionIds, school_id, classLevel]
      );
      milestoneRows = milestoneResult.rows;
    }

    // Observation coverage per category (for donut chart)
    const obsResult = await pool.query(
      `SELECT unnest(so.categories) as category, COUNT(*)::int as count
       FROM student_observations so
       JOIN students s ON s.id = so.student_id
       WHERE s.section_id = ANY($1::uuid[]) AND s.school_id = $2
       GROUP BY category
       ORDER BY count DESC`,
      [sectionIds, school_id]
    );

    // Students with most/least milestones achieved
    const studentMilestoneRank = await pool.query(
      `SELECT s.id, s.name,
         COUNT(sm.milestone_id)::int as achieved_count
       FROM students s
       LEFT JOIN student_milestones sm ON sm.student_id = s.id
       WHERE s.section_id = ANY($1::uuid[]) AND s.school_id = $2
       GROUP BY s.id, s.name
       ORDER BY achieved_count DESC`,
      [sectionIds, school_id]
    );

    // Journal entries this month
    const journalResult = await pool.query(
      `SELECT COUNT(*)::int as total_entries,
         COUNT(DISTINCT student_id)::int as students_with_entries
       FROM child_journey_entries
       WHERE section_id = ANY($1::uuid[]) AND school_id = $2
         AND entry_date >= date_trunc('month', $3::date)`,
      [sectionIds, school_id, today]
    );

    return res.json({
      total_students: totalStudents,
      section_info: sections[0],
      attendance: {
        present_count: att.present_count || 0,
        absent_count: att.absent_count || 0,
        late_count: att.late_count || 0,
        school_days: att.school_days || 0,
        avg_attendance_pct: totalStudents > 0 && att.school_days > 0
          ? Math.round(((att.present_count || 0) / (totalStudents * att.school_days)) * 100)
          : 0,
      },
      attendance_trend: weeklyAttResult.rows,
      milestones_by_domain: milestoneRows,
      observations_by_category: obsResult.rows,
      student_milestone_ranking: studentMilestoneRank.rows,
      journal: {
        total_entries: journalResult.rows[0]?.total_entries || 0,
        students_with_entries: journalResult.rows[0]?.students_with_entries || 0,
      },
    });
  } catch (err) {
    console.error('[insights] class-summary', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/insights/student/:studentId
// Returns individual student insights
router.get('/student/:studentId', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { studentId } = req.params;
    const today = await getToday(school_id);

    // Student info
    const studentRow = await pool.query(
      `SELECT s.id, s.name, s.date_of_birth, s.photo_url, c.name as class_name, sec.label as section_label
       FROM students s
       JOIN sections sec ON sec.id = s.section_id
       JOIN classes c ON c.id = sec.class_id
       WHERE s.id = $1 AND s.school_id = $2`,
      [studentId, school_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const student = studentRow.rows[0];

    // Attendance this month
    const attResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'present')::int as present,
         COUNT(*) FILTER (WHERE status = 'absent')::int as absent,
         COUNT(*) FILTER (WHERE status = 'late')::int as late,
         COUNT(*)::int as total_days
       FROM attendance_records
       WHERE student_id = $1 AND attend_date >= date_trunc('month', $2::date) AND attend_date <= $2::date`,
      [studentId, today]
    );

    // Attendance last 30 days (for sparkline)
    const attTrend = await pool.query(
      `SELECT attend_date::text as date, status
       FROM attendance_records
       WHERE student_id = $1 AND attend_date > ($2::date - 30) AND attend_date <= $2::date
       ORDER BY attend_date`,
      [studentId, today]
    );

    // Milestone progress
    const milestoneResult = await pool.query(
      `SELECT m.domain,
         COUNT(*)::int as total,
         COUNT(sm.milestone_id)::int as achieved
       FROM milestones m
       LEFT JOIN student_milestones sm ON sm.milestone_id = m.id AND sm.student_id = $1
       WHERE (m.school_id IS NULL OR m.school_id = $2)
         AND m.class_level = $3
       GROUP BY m.domain
       ORDER BY m.domain`,
      [studentId, school_id, student.class_name]
    );

    // Observation count by category
    const obsResult = await pool.query(
      `SELECT unnest(categories) as category, COUNT(*)::int as count
       FROM student_observations
       WHERE student_id = $1 AND school_id = $2
       GROUP BY category ORDER BY count DESC`,
      [studentId, school_id]
    );

    // Recent journal entries count
    const journalCount = await pool.query(
      `SELECT COUNT(*)::int as total FROM child_journey_entries
       WHERE student_id = $1 AND school_id = $2`,
      [studentId, school_id]
    );

    // Total milestones
    const totalMilestones = milestoneResult.rows.reduce((sum: number, r: any) => sum + r.total, 0);
    const achievedMilestones = milestoneResult.rows.reduce((sum: number, r: any) => sum + r.achieved, 0);

    return res.json({
      student,
      attendance: {
        ...(attResult.rows[0] || {}),
        pct: attResult.rows[0]?.total_days > 0
          ? Math.round((attResult.rows[0].present / attResult.rows[0].total_days) * 100)
          : 0,
      },
      attendance_trend: attTrend.rows,
      milestones_by_domain: milestoneResult.rows,
      milestone_summary: { total: totalMilestones, achieved: achievedMilestones, pct: totalMilestones > 0 ? Math.round((achievedMilestones / totalMilestones) * 100) : 0 },
      observations_by_category: obsResult.rows,
      journal_entries_count: journalCount.rows[0]?.total || 0,
    });
  } catch (err) {
    console.error('[insights] student', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

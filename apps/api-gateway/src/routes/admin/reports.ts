import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'));

// Helper: generate student report as plain JSON (PDF generation via reportlab in AI service)
async function getStudentReportData(studentId: string, schoolId: string) {
  const studentRow = await pool.query(
    `SELECT s.name, s.father_name, s.mother_name, c.name as class_name, sec.label as section_label, sec.id as section_id
     FROM students s JOIN classes c ON c.id = s.class_id JOIN sections sec ON sec.id = s.section_id
     WHERE s.id = $1 AND s.school_id = $2`,
    [studentId, schoolId]
  );
  if (studentRow.rows.length === 0) return null;
  const student = studentRow.rows[0];

  // Attendance
  const attRow = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE status='present') as present,
            COUNT(*) FILTER (WHERE status='absent') as absent,
            COUNT(*) as total
     FROM attendance_records WHERE student_id = $1`,
    [studentId]
  );
  const att = attRow.rows[0];
  const att_pct = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;

  // Curriculum coverage
  const covRow = await pool.query(
    `SELECT COUNT(DISTINCT cc.id)::int as total,
            COUNT(DISTINCT dc_chunks.chunk_id)::int as covered
     FROM curriculum_documents cd
     JOIN curriculum_chunks cc ON cc.document_id = cd.id
     LEFT JOIN (
       SELECT unnest(covered_chunk_ids) as chunk_id FROM daily_completions WHERE section_id = $1
     ) dc_chunks ON dc_chunks.chunk_id = cc.id
     WHERE cd.class_id = (SELECT class_id FROM students WHERE id = $2) AND cd.school_id = $3`,
    [student.section_id, studentId, schoolId]
  );
  const cov = covRow.rows[0];
  const cov_pct = cov.total > 0 ? Math.round((cov.covered / cov.total) * 100) : 0;

  // Milestones
  const milRow = await pool.query(
    `SELECT COUNT(m.id)::int as total,
            COUNT(sm.id)::int as achieved
     FROM milestones m
     LEFT JOIN student_milestones sm ON sm.milestone_id = m.id AND sm.student_id = $1
     WHERE (m.school_id IS NULL OR m.school_id = $2)
       AND m.class_level = (SELECT c.name FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = $1)`,
    [studentId, schoolId]
  );
  const mil = milRow.rows[0];
  const mil_pct = mil.total > 0 ? Math.round((mil.achieved / mil.total) * 100) : 0;

  // Shared observations
  const obsRow = await pool.query(
    `SELECT obs_text, categories, obs_date FROM student_observations
     WHERE student_id = $1 AND share_with_parent = true ORDER BY obs_date DESC`,
    [studentId]
  );

  // School name
  const schoolRow = await pool.query('SELECT name FROM schools WHERE id = $1', [schoolId]);

  return {
    school_name: schoolRow.rows[0]?.name ?? 'School',
    student_name: student.name,
    class_name: student.class_name,
    section_label: student.section_label,
    father_name: student.father_name,
    mother_name: student.mother_name,
    attendance: { present: Number(att.present), absent: Number(att.absent), total: Number(att.total), pct: att_pct },
    curriculum: { covered: Number(cov.covered), total: Number(cov.total), pct: cov_pct },
    milestones: { achieved: Number(mil.achieved), total: Number(mil.total), pct: mil_pct },
    observations: obsRow.rows,
  };
}

// GET /api/v1/admin/reports/student/:studentId — JSON report data
router.get('/student/:studentId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const data = await getStudentReportData(req.params.studentId, school_id);
    if (!data) return res.status(404).json({ error: 'Student not found' });
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/reports/section/:sectionId — all students in section
router.get('/section/:sectionId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const students = await pool.query(
      'SELECT id, name FROM students WHERE section_id = $1 AND school_id = $2 AND is_active = true ORDER BY name',
      [req.params.sectionId, school_id]
    );
    const reports = await Promise.all(
      students.rows.map(s => getStudentReportData(s.id, school_id))
    );
    return res.json(reports.filter(Boolean));
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/reports/school — school summary
router.get('/school', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;

    const [schoolRow, statsRow, coverageRows] = await Promise.all([
      pool.query('SELECT name FROM schools WHERE id = $1', [school_id]),
      pool.query(
        `SELECT
           COUNT(DISTINCT s.id)::int as total_students,
           COUNT(DISTINCT ar.student_id) FILTER (WHERE ar.status = 'present')::int as present_total,
           COUNT(DISTINCT ar.id)::int as att_records
         FROM students s
         LEFT JOIN attendance_records ar ON ar.student_id = s.id
         WHERE s.school_id = $1`,
        [school_id]
      ),
      pool.query(
        `SELECT sec.id, sec.label, c.name as class_name,
                COUNT(DISTINCT cc.id)::int as total_chunks,
                COUNT(DISTINCT dc_chunks.chunk_id)::int as covered_chunks
         FROM sections sec
         JOIN classes c ON c.id = sec.class_id
         LEFT JOIN curriculum_documents cd ON cd.class_id = sec.class_id AND cd.school_id = $1
         LEFT JOIN curriculum_chunks cc ON cc.document_id = cd.id
         LEFT JOIN (SELECT unnest(covered_chunk_ids) as chunk_id, section_id FROM daily_completions WHERE school_id = $1) dc_chunks
           ON dc_chunks.chunk_id = cc.id AND dc_chunks.section_id = sec.id
         WHERE sec.school_id = $1
         GROUP BY sec.id, sec.label, c.name, c.id ORDER BY c.name, sec.label`,
        [school_id]
      ),
    ]);

    const stats = statsRow.rows[0];
    const overall_att = stats.att_records > 0 ? Math.round((stats.present_total / stats.att_records) * 100) : 0;

    const sections = coverageRows.rows.map((r: any) => ({
      class_name: r.class_name,
      section_label: r.label,
      coverage_pct: r.total_chunks > 0 ? Math.round((r.covered_chunks / r.total_chunks) * 100) : 0,
      total_chunks: r.total_chunks,
      covered_chunks: r.covered_chunks,
    }));

    const overall_cov = sections.length > 0
      ? Math.round(sections.reduce((s: number, r: any) => s + r.coverage_pct, 0) / sections.length)
      : 0;

    return res.json({
      school_name: schoolRow.rows[0]?.name ?? 'School',
      total_students: stats.total_students,
      overall_attendance_pct: overall_att,
      overall_coverage_pct: overall_cov,
      sections,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/reports/class-coverage?section_id=&from=&to=
// Returns a detailed coverage report for a section between two dates — for PDF download
router.get('/class-coverage', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { section_id, from, to } = req.query as Record<string, string>;
    if (!section_id) return res.status(400).json({ error: 'section_id required' });

    const fromDate = from || '2020-01-01';
    const toDate   = to   || new Date().toISOString().split('T')[0];

    // Section + class + teacher info
    const secRow = await pool.query(
      `SELECT sec.label, c.name as class_name, c.id as class_id,
              ct.name as class_teacher,
              STRING_AGG(DISTINCT ts_u.name, ', ') as supporting_teachers
       FROM sections sec
       JOIN classes c ON c.id = sec.class_id
       LEFT JOIN users ct ON ct.id = sec.class_teacher_id
       LEFT JOIN teacher_sections ts ON ts.section_id = sec.id AND ts.teacher_id != sec.class_teacher_id
       LEFT JOIN users ts_u ON ts_u.id = ts.teacher_id
       WHERE sec.id = $1 AND sec.school_id = $2
       GROUP BY sec.label, c.name, c.id, ct.name`,
      [section_id, school_id]
    );
    if (secRow.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
    const sec = secRow.rows[0];

    // Daily completions in range
    const completions = await pool.query(
      `SELECT dc.completion_date::text, dc.covered_chunk_ids,
              u.name as teacher_name
       FROM daily_completions dc
       JOIN users u ON u.id = dc.teacher_id
       WHERE dc.section_id = $1 AND dc.school_id = $2
         AND dc.completion_date BETWEEN $3 AND $4
       ORDER BY dc.completion_date`,
      [section_id, school_id, fromDate, toDate]
    );

    // All chunks covered in range
    const allCoveredIds = [...new Set(
      completions.rows.flatMap((r: any) => r.covered_chunk_ids || [])
    )];

    let coveredChunks: any[] = [];
    if (allCoveredIds.length > 0) {
      const chunksRow = await pool.query(
        `SELECT cc.id, cc.topic_label, cc.chunk_index, cd.filename as doc_name
         FROM curriculum_chunks cc
         JOIN curriculum_documents cd ON cd.id = cc.document_id
         WHERE cc.id = ANY($1::uuid[])
         ORDER BY cc.chunk_index`,
        [allCoveredIds]
      );
      coveredChunks = chunksRow.rows;
    }

    // Special days in range
    const specialDays = await pool.query(
      `SELECT day_date::text, label, day_type, activity_note
       FROM special_days
       WHERE school_id = $1 AND day_date BETWEEN $2 AND $3
       ORDER BY day_date`,
      [school_id, fromDate, toDate]
    );

    // Holidays in range
    const holidays = await pool.query(
      `SELECT holiday_date::text, event_name
       FROM holidays
       WHERE school_id = $1 AND holiday_date BETWEEN $2 AND $3
       ORDER BY holiday_date`,
      [school_id, fromDate, toDate]
    );

    // Attendance summary in range
    const attRow = await pool.query(
      `SELECT
         COUNT(DISTINCT attend_date)::int as days_marked,
         COUNT(*) FILTER (WHERE status='present')::int as total_present,
         COUNT(*) FILTER (WHERE status='absent')::int as total_absent
       FROM attendance_records
       WHERE section_id = $1 AND school_id = $2
         AND attend_date BETWEEN $3 AND $4`,
      [section_id, school_id, fromDate, toDate]
    );

    // School name
    const schoolRow = await pool.query('SELECT name FROM schools WHERE id = $1', [school_id]);

    return res.json({
      school_name: schoolRow.rows[0]?.name ?? 'School',
      class_name: sec.class_name,
      section_label: sec.label,
      class_teacher: sec.class_teacher,
      supporting_teachers: sec.supporting_teachers,
      from_date: fromDate,
      to_date: toDate,
      completions: completions.rows.map((r: any) => ({
        date: r.completion_date,
        teacher: r.teacher_name,
        topics_covered: r.covered_chunk_ids?.length ?? 0,
      })),
      covered_topics: coveredChunks.map((c: any) => ({
        label: c.topic_label || `Topic ${c.chunk_index + 1}`,
        document: c.doc_name,
      })),
      special_days: specialDays.rows,
      holidays: holidays.rows,
      attendance: attRow.rows[0],
      total_days_completed: completions.rows.length,
      total_topics_covered: allCoveredIds.length,
    });
  } catch (err) {
    console.error('[class-coverage report]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/reports/school-overview — charts data
router.get('/school-overview', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;

    const [schoolRow, classStats, upcomingSpecial, upcomingHolidays, teacherStats] = await Promise.all([
      pool.query('SELECT name FROM schools WHERE id = $1', [school_id]),

      // Per-class: students, coverage, teachers
      pool.query(`
        SELECT
          c.id as class_id, c.name as class_name,
          COUNT(DISTINCT s.id)::int as total_students,
          COUNT(DISTINCT sec.id)::int as total_sections,
          COUNT(DISTINCT sec.class_teacher_id)::int as class_teachers,
          COUNT(DISTINCT ts.teacher_id)::int as supporting_teachers,
          COALESCE(AVG(
            CASE WHEN cc_total.total > 0
              THEN ROUND((cc_covered.covered::numeric / cc_total.total) * 100)
              ELSE NULL END
          )::int, 0) as avg_coverage_pct
        FROM classes c
        LEFT JOIN sections sec ON sec.class_id = c.id AND sec.school_id = $1
        LEFT JOIN students s ON s.section_id = sec.id AND s.is_active = true
        LEFT JOIN teacher_sections ts ON ts.section_id = sec.id
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT cc.id) as total
          FROM curriculum_documents cd
          JOIN curriculum_chunks cc ON cc.document_id = cd.id
          WHERE cd.class_id = c.id AND cd.school_id = $1
        ) cc_total ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT dc_u.chunk_id) as covered
          FROM daily_completions dc
          JOIN LATERAL unnest(dc.covered_chunk_ids) AS dc_u(chunk_id) ON true
          WHERE dc.section_id = sec.id AND dc.school_id = $1
        ) cc_covered ON true
        WHERE c.school_id = $1
        GROUP BY c.id, c.name
        ORDER BY c.name`,
        [school_id]
      ),

      // Upcoming special days (next 30 days)
      pool.query(`
        SELECT day_date::text, label, day_type, activity_note
        FROM special_days
        WHERE school_id = $1 AND day_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
        ORDER BY day_date LIMIT 10`,
        [school_id]
      ),

      // Upcoming holidays (next 60 days)
      pool.query(`
        SELECT holiday_date::text, event_name
        FROM holidays
        WHERE school_id = $1 AND holiday_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60
        ORDER BY holiday_date LIMIT 10`,
        [school_id]
      ),

      // Teacher count + active
      pool.query(`
        SELECT
          COUNT(DISTINCT u.id)::int as total_teachers,
          COUNT(DISTINCT ts.teacher_id)::int as assigned_teachers
        FROM users u
        JOIN roles r ON r.id = u.role_id AND r.name = 'teacher'
        LEFT JOIN teacher_sections ts ON ts.teacher_id = u.id
        WHERE u.school_id = $1 AND u.is_active = true`,
        [school_id]
      ),
    ]);

    const classes = classStats.rows;
    const totalStudents = classes.reduce((s: number, c: any) => s + c.total_students, 0);
    const totalSections = classes.reduce((s: number, c: any) => s + c.total_sections, 0);
    const avgCoverage = classes.length > 0
      ? Math.round(classes.reduce((s: number, c: any) => s + c.avg_coverage_pct, 0) / classes.length)
      : 0;

    return res.json({
      school_name: schoolRow.rows[0]?.name ?? 'School',
      summary: {
        total_students: totalStudents,
        total_sections: totalSections,
        total_teachers: teacherStats.rows[0]?.total_teachers ?? 0,
        assigned_teachers: teacherStats.rows[0]?.assigned_teachers ?? 0,
        avg_coverage_pct: avgCoverage,
        total_classes: classes.length,
      },
      classes,
      upcoming_special_days: upcomingSpecial.rows,
      upcoming_holidays: upcomingHolidays.rows,
    });
  } catch (err) {
    console.error('[school-overview]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

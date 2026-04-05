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

export default router;

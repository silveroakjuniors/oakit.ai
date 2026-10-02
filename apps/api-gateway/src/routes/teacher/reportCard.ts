import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import { generateProgressReport } from '../admin/reportHelper';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher', 'class teacher', 'supporting teacher'));

// GET /api/v1/teacher/report-card/students — list students in teacher's section(s)
router.get('/students', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const sections = await getTeacherSections(user_id, school_id);
    if (!sections.length) return res.json([]);
    const sectionIds = sections.map((s: any) => s.section_id);
    const result = await pool.query(
      `SELECT s.id, s.name, c.name as class_name, sec.label as section_label
       FROM students s
       JOIN classes c ON c.id = s.class_id
       JOIN sections sec ON sec.id = s.section_id
       WHERE s.section_id = ANY($1::uuid[]) AND s.school_id = $2 AND s.is_active = true
       ORDER BY c.name, sec.label, s.name`,
      [sectionIds, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[teacher report-card students]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/report-card/generate?student_id=&from=&to=
router.get('/generate', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id, from, to } = req.query as Record<string, string>;
    if (!student_id) return res.status(400).json({ error: 'student_id required' });

    // Verify student is in teacher's section
    const sections = await getTeacherSections(user_id, school_id);
    const sectionIds = sections.map((s: any) => s.section_id);
    const check = await pool.query(
      `SELECT 1 FROM students WHERE id=$1 AND section_id=ANY($2::uuid[]) AND school_id=$3`,
      [student_id, sectionIds, school_id]
    );
    if (!check.rows.length) return res.status(403).json({ error: 'Student not in your class' });

    const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];
    const result = await generateProgressReport(student_id, school_id, fromDate, toDate, 'progress', user_id);
    return res.json(result);
  } catch (err: any) {
    console.error('[teacher report-card generate]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/v1/teacher/report-card/generate-remark
// Teacher provides raw notes → Oakie generates a polished 2-3 sentence remark
router.post('/generate-remark', async (req: Request, res: Response) => {
  try {
    const { student_name, teacher_notes, class_name, attendance_pct, subjects_covered } = req.body;
    if (!teacher_notes?.trim()) return res.status(400).json({ error: 'teacher_notes required' });

    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const axios = (await import('axios')).default;

    const prompt = `A teacher wants to write a personalised remark for a student's report card.

STUDENT: ${student_name || 'the student'}
CLASS: ${class_name || ''}
ATTENDANCE: ${attendance_pct !== undefined ? `${attendance_pct}%` : 'not provided'}
SUBJECTS COVERED: ${subjects_covered || 'various subjects'}

TEACHER'S RAW NOTES:
"${teacher_notes.trim()}"

Write a warm, professional teacher's remark of exactly 2-3 sentences.
- Use the student's first name naturally (once or twice)
- Reference specific things from the teacher's notes
- End with an encouraging, forward-looking sentence
- Plain text only — no markdown, no asterisks, no bullet points
- Maximum 50 words total`;

    const aiResp = await axios.post(`${AI_URL}/internal/generate-report`, {
      prompt,
      student_name: student_name || 'the student',
      structured: false,
    }, { timeout: 30000 });

    let remark = (aiResp.data?.response || '').trim();
    // Clean up any markdown
    remark = remark.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').trim();

    if (!remark) return res.status(500).json({ error: 'Could not generate remark' });
    return res.json({ remark });
  } catch (err: any) {
    console.error('[generate-remark]', err);
    return res.status(500).json({ error: 'Failed to generate remark' });
  }
});

// GET /api/v1/teacher/report-card/saved — list reports saved by this teacher
router.get('/saved', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const rows = await pool.query(
      `SELECT id, student_id, report_type, from_date::text, to_date::text, title, created_at::text,
              report_data->>'student_name' as student_name,
              report_data->>'class_name' as class_name
       FROM saved_reports
       WHERE school_id=$1 AND generated_by=$2
       ORDER BY created_at DESC LIMIT 50`,
      [school_id, user_id]
    );
    return res.json(rows.rows);
  } catch (err) {
    console.error('[teacher saved list]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/report-card/saved/:id — get full saved report
router.get('/saved/:id', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const row = await pool.query(
      `SELECT *, from_date::text, to_date::text FROM saved_reports
       WHERE id=$1 AND school_id=$2 AND generated_by=$3`,
      [req.params.id, school_id, user_id]
    );
    if (!row.rows.length) return res.status(404).json({ error: 'Not found' });
    const r = row.rows[0];
    return res.json({ ...r.report_data, ai_report: r.ai_report, report_id: r.id, report_type: r.report_type });
  } catch (err) {
    console.error('[teacher saved get]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/teacher/report-card/save — save a generated report
router.post('/save', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id, from_date, to_date, report_type = 'progress', report_data, ai_report } = req.body;
    if (!student_id || !from_date || !to_date || !report_data) {
      return res.status(400).json({ error: 'student_id, from_date, to_date, report_data required' });
    }
    // Verify student is in teacher's section
    const sections = await getTeacherSections(user_id, school_id);
    const sectionIds = sections.map((s: any) => s.section_id);
    const check = await pool.query(
      `SELECT section_id FROM students WHERE id=$1 AND section_id=ANY($2::uuid[]) AND school_id=$3`,
      [student_id, sectionIds, school_id]
    );
    if (!check.rows.length) return res.status(403).json({ error: 'Student not in your class' });

    const studentName = report_data.student_name || 'Student';
    const title = `Progress Report — ${studentName} (${from_date} to ${to_date})`;
    const savedRow = await pool.query(
      `INSERT INTO saved_reports
         (school_id, student_id, section_id, generated_by, report_type, from_date, to_date, title, ai_report, report_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (student_id, from_date, to_date, report_type)
       DO UPDATE SET ai_report=EXCLUDED.ai_report, report_data=EXCLUDED.report_data,
                     generated_by=EXCLUDED.generated_by, title=EXCLUDED.title
       RETURNING id`,
      [school_id, student_id, check.rows[0].section_id, user_id, report_type,
       from_date, to_date, title, ai_report || '', JSON.stringify(report_data)]
    );
    return res.json({ id: savedRow.rows[0].id, message: 'Saved' });
  } catch (err) {
    console.error('[teacher save]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/teacher/report-card/saved/:id/remark — update teacher remark
router.patch('/saved/:id/remark', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { teacher_remark } = req.body;
    if (!teacher_remark?.trim()) return res.status(400).json({ error: 'teacher_remark required' });

    const existing = await pool.query(
      'SELECT report_data FROM saved_reports WHERE id=$1 AND school_id=$2 AND generated_by=$3',
      [req.params.id, school_id, user_id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });

    // Update teacher_remark inside report_data.structured
    const rd = existing.rows[0].report_data as any;
    const updated = {
      ...rd,
      structured: { ...(rd.structured || {}), teacher_remark: teacher_remark.trim() },
    };
    await pool.query(
      'UPDATE saved_reports SET report_data=$1 WHERE id=$2 AND school_id=$3 AND generated_by=$4',
      [JSON.stringify(updated), req.params.id, school_id, user_id]
    );
    return res.json({ message: 'Remark updated' });
  } catch (err) {
    console.error('[teacher remark update]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/teacher/report-card/saved/:id — delete a saved report
router.delete('/saved/:id', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const r = await pool.query(
      'DELETE FROM saved_reports WHERE id=$1 AND school_id=$2 AND generated_by=$3 RETURNING id',
      [req.params.id, school_id, user_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found or not yours' });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[teacher delete]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/teacher/report-card/generate-all — generate reports for all students in section
router.post('/generate-all', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { from, to, section_id } = req.body as Record<string, string>;

    const sections = await getTeacherSections(user_id, school_id);
    const sectionIds = sections.map((s: any) => s.section_id);
    if (section_id && !sectionIds.includes(section_id)) {
      return res.status(403).json({ error: 'Section not yours' });
    }
    const targetSections = section_id ? [section_id] : sectionIds;
    if (!targetSections.length) return res.status(400).json({ error: 'No sections' });

    const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const toDate   = to   || new Date().toISOString().split('T')[0];

    const students = await pool.query(
      `SELECT id, name FROM students
       WHERE section_id=ANY($1::uuid[]) AND school_id=$2 AND is_active=true ORDER BY name`,
      [targetSections, school_id]
    );

    const results: { student_id: string; student_name: string; report_id: string | null; error?: string }[] = [];
    for (const s of students.rows) {
      try {
        const result = await generateProgressReport(s.id, school_id, fromDate, toDate, 'progress', user_id);
        results.push({ student_id: s.id, student_name: s.name, report_id: result.report_id || null });
      } catch (e: any) {
        results.push({ student_id: s.id, student_name: s.name, report_id: null, error: e.message });
      }
    }
    return res.json({ generated: results.length, results });
  } catch (err: any) {
    console.error('[generate-all]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

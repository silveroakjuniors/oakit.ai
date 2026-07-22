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

export default router;

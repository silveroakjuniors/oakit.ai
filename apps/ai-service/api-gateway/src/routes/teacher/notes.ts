import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import axios from 'axios';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import { getToday } from '../../lib/today';
import { uploadFile, deleteFile } from '../../lib/storage';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher'));

const upload = multer({
  dest: '/tmp/oakit-uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, Word, and text files are allowed'));
  },
});

async function resolveSection(user_id: string, school_id: string, sectionId?: string): Promise<string | null> {
  const sections = await getTeacherSections(user_id, school_id);
  if (sections.length === 0) return null;
  if (sectionId) {
    const found = sections.find(s => s.section_id === sectionId);
    return found ? found.section_id : null;
  }
  return sections[0].section_id;
}

// ── HOMEWORK ──────────────────────────────────────────────────────────────────

// POST /api/v1/teacher/notes/homework — save homework for today
router.post('/homework', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const { raw_text, section_id: reqSectionId, homework_date } = req.body;
    const date = homework_date || today;

    if (!raw_text?.trim()) return res.status(400).json({ error: 'Homework text is required' });

    const section_id = await resolveSection(user_id, school_id, reqSectionId);
    if (!section_id) return res.status(404).json({ error: 'No section assigned' });

    // AI-format the homework text
    let formatted_text = raw_text.trim();
    try {
      const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const aiResp = await axios.post(`${AI_URL}/internal/format-homework`, {
        raw_text, school_id, section_id,
      }, { timeout: 15000 });
      if (aiResp.data?.formatted_text) formatted_text = aiResp.data.formatted_text;
    } catch { /* use raw text if AI fails */ }

    const result = await pool.query(
      `INSERT INTO teacher_homework (school_id, section_id, teacher_id, homework_date, raw_text, formatted_text)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (section_id, homework_date) DO UPDATE
       SET raw_text = EXCLUDED.raw_text, formatted_text = EXCLUDED.formatted_text, updated_at = now()
       RETURNING *`,
      [school_id, section_id, user_id, date, raw_text.trim(), formatted_text]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/notes/homework?date=YYYY-MM-DD — get homework for a date
router.get('/homework', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const date = (req.query.date as string) || today;
    const section_id = await resolveSection(user_id, school_id, req.query.section_id as string);
    if (!section_id) return res.json(null);

    const result = await pool.query(
      'SELECT * FROM teacher_homework WHERE section_id = $1 AND homework_date = $2',
      [section_id, date]
    );
    return res.json(result.rows[0] || null);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── NOTES ─────────────────────────────────────────────────────────────────────

// POST /api/v1/teacher/notes — save a text note
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const { note_text, section_id: reqSectionId, note_date } = req.body;
    const date = note_date || today;

    if (!note_text?.trim()) return res.status(400).json({ error: 'Note text is required' });

    const section_id = await resolveSection(user_id, school_id, reqSectionId);
    if (!section_id) return res.status(404).json({ error: 'No section assigned' });

    // Get configurable expiry
    const settingsRow = await pool.query(
      `SELECT notes_expiry_days FROM school_settings WHERE school_id = $1`,
      [school_id]
    ).catch(() => ({ rows: [] }));
    const expiryDays = settingsRow.rows[0]?.notes_expiry_days ?? 14;

    const result = await pool.query(
      `INSERT INTO teacher_notes (school_id, section_id, teacher_id, note_date, note_text, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' days')::interval)
       RETURNING id, note_date, note_text, file_name, expires_at, created_at`,
      [school_id, section_id, user_id, date, note_text.trim(), expiryDays]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/teacher/notes/upload — upload a file note
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const date = req.body.note_date || today;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const section_id = await resolveSection(user_id, school_id, req.body.section_id);
    if (!section_id) { await deleteFile(file.path); return res.status(404).json({ error: 'No section assigned' }); }

    const settingsRow = await pool.query(
      `SELECT notes_expiry_days FROM school_settings WHERE school_id = $1`,
      [school_id]
    ).catch(() => ({ rows: [] }));
    const expiryDays = settingsRow.rows[0]?.notes_expiry_days ?? 14;

    // Upload to Supabase
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const { storagePath } = await uploadFile({
      schoolId: school_id,
      folder: 'notes',
      localPath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      actorId: user_id,
      actorRole: 'teacher',
      entityType: 'note',
      expiresAt,
      auditMeta: { file_name: file.originalname, section_id, note_date: date },
    });

    const result = await pool.query(
      `INSERT INTO teacher_notes (school_id, section_id, teacher_id, note_date, file_name, file_path, file_size, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now() + ($8 || ' days')::interval)
       RETURNING id, note_date, file_name, file_size, expires_at, created_at`,
      [school_id, section_id, user_id, date, file.originalname, storagePath, file.size, expiryDays]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/notes?date=YYYY-MM-DD — list notes for a date
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const date = (req.query.date as string) || today;
    const section_id = await resolveSection(user_id, school_id, req.query.section_id as string);
    if (!section_id) return res.json([]);

    const result = await pool.query(
      `SELECT id, note_date, note_text, file_name, file_size, expires_at, created_at
       FROM teacher_notes WHERE section_id = $1 AND note_date = $2 AND expires_at > now()
       ORDER BY created_at DESC`,
      [section_id, date]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/notes/:id/download — download a note file
router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      'SELECT file_path, file_name, expires_at FROM teacher_notes WHERE id = $1 AND school_id = $2',
      [req.params.id, school_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    const { file_path, file_name, expires_at } = result.rows[0];
    if (!file_path) return res.status(404).json({ error: 'File not found' });
    if (new Date(expires_at) < new Date()) return res.status(410).json({ error: 'This note has expired' });

    // New Supabase path — redirect to public URL
    const { getPublicUrl } = await import('../../lib/storage');
    const url = getPublicUrl(file_path);
    if (!url) return res.status(404).json({ error: 'File not found' });
    return res.redirect(url);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/teacher/notes/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const result = await pool.query(
      'DELETE FROM teacher_notes WHERE id = $1 AND school_id = $2 AND teacher_id = $3 RETURNING file_path',
      [req.params.id, school_id, user_id]
    );
    await deleteFile(result.rows[0]?.file_path);
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── HOMEWORK SUBMISSIONS (per-student tracking) ───────────────────────────────

// POST /api/v1/teacher/notes/homework/submissions — record per-student homework status
router.post('/homework/submissions', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const { submissions, homework_date, section_id: reqSectionId } = req.body;
    // submissions: [{ student_id, status: 'completed'|'partial'|'not_submitted', teacher_note? }]
    if (!Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({ error: 'submissions array is required' });
    }
    const date = homework_date || today;
    const section_id = await resolveSection(user_id, school_id, reqSectionId);
    if (!section_id) return res.status(404).json({ error: 'No section assigned' });

    const VALID_STATUSES = ['completed', 'partial', 'not_submitted'];
    for (const sub of submissions) {
      if (!sub.student_id || !VALID_STATUSES.includes(sub.status)) continue;
      await pool.query(
        `INSERT INTO homework_submissions (school_id, section_id, student_id, homework_date, status, teacher_note, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (student_id, homework_date) DO UPDATE
         SET status = EXCLUDED.status, teacher_note = EXCLUDED.teacher_note, recorded_by = EXCLUDED.recorded_by, recorded_at = now()`,
        [school_id, section_id, sub.student_id, date, sub.status, sub.teacher_note || null, user_id]
      );
    }
    return res.status(201).json({ message: 'Submissions recorded', date });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/notes/homework/submissions?date=YYYY-MM-DD — get submissions for a date
router.get('/homework/submissions', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const date = (req.query.date as string) || today;
    const section_id = await resolveSection(user_id, school_id, req.query.section_id as string);
    if (!section_id) return res.json([]);

    const result = await pool.query(
      `SELECT hs.student_id, s.name as student_name, hs.status, hs.teacher_note, hs.recorded_at
       FROM homework_submissions hs
       JOIN students s ON s.id = hs.student_id
       WHERE hs.section_id = $1 AND hs.homework_date = $2
       ORDER BY s.name`,
      [section_id, date]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/teacher/notes/format-session
// Takes a raw speech transcript and formats it into clean class notes using Gemini
router.post('/format-session', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { raw_transcript, section_id, is_refinement } = req.body;

    if (!raw_transcript?.trim()) {
      return res.status(400).json({ error: 'raw_transcript is required' });
    }
    if (raw_transcript.length > 20000) {
      return res.status(400).json({ error: 'Transcript too long (max 20,000 characters)' });
    }

    // Get class context for better formatting
    let classContext = '';
    try {
      const sections = await getTeacherSections(user_id, school_id);
      const sec: any = section_id ? sections.find(s => s.section_id === section_id) : sections[0];
      if (sec) classContext = `Class: ${sec.class_name} Section ${sec.section_label}`;
    } catch { /* non-critical */ }

    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    const aiResp = await axios.post(`${AI_URL}/internal/format-session`, {
      raw_transcript: raw_transcript.trim(),
      class_context: classContext,
      topics_covered: req.body.topics_covered || [],
      session_date: req.body.session_date || '',
      is_refinement: Boolean(is_refinement),
    }, { timeout: 30000 });

    return res.json({ formatted: aiResp.data.formatted });
  } catch (err: any) {
    console.error('[notes/format-session]', err?.message);
    // If AI service fails, return a basic formatted version
    const raw = req.body.raw_transcript || '';
    const basic = `📚 Class Session Notes\n${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}\n\n${raw}`;
    return res.json({ formatted: basic });
  }
});

export default router;

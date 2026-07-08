import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const FormData = require('form-data');

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('admin'));

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const pdfStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const pdfUpload = multer({
  storage: pdfStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') return cb(new Error('Only PDF files are allowed'));
    cb(null, true);
  },
});

const AI_SERVICE_URL = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

// â”€â”€â”€ Helper: verify session belongs to school â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getSession(sessionId: string, schoolId: string) {
  const r = await pool.query(
    `SELECT s.*, c.id as class_id_check FROM textbook_planner_sessions s
     JOIN classes c ON s.class_id = c.id
     WHERE s.id = $1 AND s.school_id = $2`,
    [sessionId, schoolId]
  );
  return r.rows[0] || null;
}

// â”€â”€â”€ POST /sessions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ─── GET /academic-year ───────────────────────────────────────────────────────
// Returns the current academic year from school_calendar (most recent)
router.get('/academic-year', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const r = await pool.query(
      `SELECT academic_year, start_date, end_date FROM school_calendar WHERE school_id = $1 ORDER BY start_date DESC LIMIT 1`,
      [school_id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'No academic year configured' });
    return res.json(r.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /sessions ───────────────────────────────────────────────────────────
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const { class_id } = req.body;
    let { academic_year } = req.body;

    if (!class_id) {
      return res.status(400).json({ error: 'class_id is required' });
    }

    // Auto-detect academic year from school_calendar if not provided
    if (!academic_year) {
      const calRow = await pool.query(
        `SELECT academic_year FROM school_calendar WHERE school_id = $1 ORDER BY start_date DESC LIMIT 1`,
        [school_id]
      );
      if (calRow.rows.length === 0) {
        return res.status(400).json({ error: 'No academic year configured. Please set up the school calendar first.' });
      }
      academic_year = calRow.rows[0].academic_year;
    }

    const r = await pool.query(
      `INSERT INTO textbook_planner_sessions (school_id, class_id, academic_year, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (school_id, class_id, academic_year) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [school_id, class_id, academic_year, user_id]
    );
    return res.status(200).json(r.rows[0]);
  } catch (err) {
    console.error('[textbookPlanner] POST /sessions', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€ GET /sessions/:sessionId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const session = await getSession(req.params.sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const subjects = await pool.query(
      `SELECT * FROM textbook_planner_subjects WHERE session_id = $1 ORDER BY created_at`,
      [req.params.sessionId]
    );
    const chapters = await pool.query(
      `SELECT * FROM textbook_planner_chapters WHERE session_id = $1 ORDER BY subject_id, chapter_index`,
      [req.params.sessionId]
    );

    return res.json({
      ...session,
      subjects: subjects.rows.map(s => ({
        ...s,
        chapters: chapters.rows.filter(c => c.subject_id === s.id),
      })),
    });
  } catch (err) {
    console.error('[textbookPlanner] GET /sessions/:id', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€ POST /sessions/:sessionId/subjects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/sessions/:sessionId/subjects', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const session = await getSession(req.params.sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const r = await pool.query(
      `INSERT INTO textbook_planner_subjects (session_id, school_id, name)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.sessionId, school_id, name]
    );
    return res.status(201).json(r.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'A subject with this name already exists in the session' });
    console.error('[textbookPlanner] POST subjects', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€ DELETE /sessions/:sessionId/subjects/:subjectId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.delete('/sessions/:sessionId/subjects/:subjectId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const session = await getSession(req.params.sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    await pool.query(
      `DELETE FROM textbook_planner_subjects WHERE id = $1 AND session_id = $2 AND school_id = $3`,
      [req.params.subjectId, req.params.sessionId, school_id]
    );
    return res.status(204).send();
  } catch (err) {
    console.error('[textbookPlanner] DELETE subject', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€ POST /sessions/:sessionId/subjects/:subjectId/upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post(
  '/sessions/:sessionId/subjects/:subjectId/upload',
  (req, res, next) => {
    pdfUpload.single('file')(req, res, (err) => {
      if (err) {
        if (err.message === 'Only PDF files are allowed') return res.status(422).json({ error: err.message });
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File exceeds 50 MB limit' });
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const { school_id } = req.user!;
      const { sessionId, subjectId } = req.params;

      const session = await getSession(sessionId, school_id);
      if (!session) { fs.unlink(file.path, () => {}); return res.status(404).json({ error: 'Session not found' }); }

      const subjectRow = await pool.query(
        `SELECT * FROM textbook_planner_subjects WHERE id = $1 AND session_id = $2`,
        [subjectId, sessionId]
      );
      if (subjectRow.rows.length === 0) { fs.unlink(file.path, () => {}); return res.status(404).json({ error: 'Subject not found' }); }

      const toc_page = parseInt(req.body.toc_page) || 1;
      const toc_end_page = parseInt(req.body.toc_end_page) || toc_page;
      const tocPages = Array.from(
        { length: Math.min(toc_end_page - toc_page + 1, 5) }, // cap at 5 pages
        (_, i) => toc_page + i
      );

      // Call AI service for each TOC page and merge results
      const allChapters: any[] = [];
      let lastPageCount: number | null = null;

      for (const pageNum of tocPages) {
        const form = new FormData();
        form.append('file', fs.createReadStream(file.path), { filename: file.originalname });
        form.append('toc_page', String(pageNum));
        let tocResult: { chapters: any[]; failed: boolean; page_count?: number; reason?: string };
        try {
          const aiResp = await axios.post(`${AI_SERVICE_URL()}/internal/extract-toc`, form, {
            headers: form.getHeaders(), timeout: 60000,
          });
          tocResult = aiResp.data;
        } catch (aiErr: any) {
          const msg = aiErr.response?.data?.detail || aiErr.response?.data?.error || aiErr.message;
          if (pageNum === toc_page) {
            fs.unlink(file.path, () => {});
            return res.status(502).json({ error: `TOC extraction failed: ${msg}` });
          }
          break;
        }
        if (tocResult.page_count) lastPageCount = tocResult.page_count;
        if (!tocResult.failed && tocResult.chapters.length > 0) {
          allChapters.push(...tocResult.chapters);
        } else if (pageNum === toc_page) {
          fs.unlink(file.path, () => {});
          const reason = tocResult.reason || 'TOC extraction returned no chapters. Try a different page.';
          return res.status(422).json({ error: reason, failed: true, reason });
        }
      }

      fs.unlink(file.path, () => {});

      if (allChapters.length === 0) {
        return res.status(422).json({ error: 'No chapters found across the specified TOC pages.', failed: true });
      }

      const pdf_page_count = lastPageCount || null;

      // Validate toc_page against page count
      if (pdf_page_count && (toc_page < 1 || toc_page > pdf_page_count)) {
        return res.status(422).json({ error: `toc_page must be between 1 and ${pdf_page_count}` });
      }

      // Update subject with pdf info
      await pool.query(
        `UPDATE textbook_planner_subjects SET pdf_path = $1, pdf_page_count = $2, toc_page = $3 WHERE id = $4`,
        [file.originalname, pdf_page_count, toc_page, subjectId]
      );

      // Delete existing chapters for this subject
      await pool.query(`DELETE FROM textbook_planner_chapters WHERE subject_id = $1`, [subjectId]);

      // Infer missing page_end values:
      // If a chapter only has page_start (no page_end), set page_end = next chapter's page_start - 1.
      // Last chapter's page_end = total pages of the PDF (if known).
      const chapters = allChapters;
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];

        // Normalise topics: accept both string[] and {name, page_start}[]
        if (Array.isArray(ch.topics)) {
          ch.topics = ch.topics.map((t: any) =>
            typeof t === 'string' ? { name: t, page_start: null } : t
          );
        } else {
          ch.topics = [];
        }

        // If chapter has no page_start but first topic does, inherit it
        if (!ch.page_start && ch.topics.length > 0 && ch.topics[0].page_start) {
          ch.page_start = ch.topics[0].page_start;
        }

        // Infer page_end from next chapter
        if (ch.page_start && !ch.page_end) {
          if (i + 1 < chapters.length && chapters[i + 1].page_start) {
            ch.page_end = chapters[i + 1].page_start - 1;
          } else if (pdf_page_count) {
            ch.page_end = pdf_page_count;
          } else {
            ch.page_end = ch.page_start;
          }
        }
      }

      // Compute total pages for weight calculation
      const totalPages = chapters.reduce((sum: number, ch: any) => {
        const span = (ch.page_end || 0) - (ch.page_start || 0) + 1;
        return sum + Math.max(span, 1);
      }, 0);

      // Insert chapters
      const insertedChapters = [];
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        const span = Math.max((ch.page_end || 0) - (ch.page_start || 0) + 1, 1);
        const weight = totalPages > 0 ? span / totalPages : 1 / chapters.length;
        const r = await pool.query(
          `INSERT INTO textbook_planner_chapters
             (subject_id, session_id, chapter_index, title, topics, page_start, page_end, chapter_weight)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [subjectId, sessionId, i + 1, ch.title, JSON.stringify(ch.topics || []), ch.page_start || null, ch.page_end || null, weight]
        );
        insertedChapters.push(r.rows[0]);
      }

      return res.json({ chapters: insertedChapters, page_count: pdf_page_count });
    } catch (err) {
      console.error('[textbookPlanner] upload', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// â”€â”€â”€ PATCH /sessions/:sessionId/subjects/:subjectId/toc-page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.patch('/sessions/:sessionId/subjects/:subjectId/toc-page', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { sessionId, subjectId } = req.params;
    const session = await getSession(sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const subjectRow = await pool.query(
      `SELECT * FROM textbook_planner_subjects WHERE id = $1 AND session_id = $2`,
      [subjectId, sessionId]
    );
    if (subjectRow.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
    const subject = subjectRow.rows[0];

    const toc_page = parseInt(req.body.toc_page);
    if (!toc_page || toc_page < 1) return res.status(422).json({ error: 'toc_page must be >= 1' });
    if (subject.pdf_page_count && toc_page > subject.pdf_page_count) {
      return res.status(422).json({ error: `toc_page must be between 1 and ${subject.pdf_page_count}` });
    }
    if (!subject.pdf_path) return res.status(422).json({ error: 'No PDF uploaded for this subject' });

    // Re-run extraction â€” we need the original file. Since we store only the name, we can't re-extract without the file.
    // Update toc_page and return a message asking user to re-upload if needed.
    await pool.query(`UPDATE textbook_planner_subjects SET toc_page = $1 WHERE id = $2`, [toc_page, subjectId]);
    return res.json({ message: 'TOC page updated. Re-upload the PDF to extract chapters from the new page.', toc_page });
  } catch (err) {
    console.error('[textbookPlanner] PATCH toc-page', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€ GET /sessions/:sessionId/subjects/:subjectId/chapters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/sessions/:sessionId/subjects/:subjectId/chapters', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const session = await getSession(req.params.sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const r = await pool.query(
      `SELECT * FROM textbook_planner_chapters WHERE subject_id = $1 AND session_id = $2 ORDER BY chapter_index`,
      [req.params.subjectId, req.params.sessionId]
    );
    return res.json(r.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€ POST /sessions/:sessionId/subjects/:subjectId/chapters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/sessions/:sessionId/subjects/:subjectId/chapters', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { sessionId, subjectId } = req.params;
    const session = await getSession(sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { title, topics, page_start, page_end } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    // Get next chapter_index
    const maxIdx = await pool.query(
      `SELECT COALESCE(MAX(chapter_index), 0) as max_idx FROM textbook_planner_chapters WHERE subject_id = $1`,
      [subjectId]
    );
    const chapter_index = maxIdx.rows[0].max_idx + 1;

    const r = await pool.query(
      `INSERT INTO textbook_planner_chapters (subject_id, session_id, chapter_index, title, topics, page_start, page_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [subjectId, sessionId, chapter_index, title, JSON.stringify(topics || []), page_start || null, page_end || null]
    );
    return res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('[textbookPlanner] POST chapter', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€ PATCH /sessions/:sessionId/subjects/:subjectId/chapters/:chapterId â”€â”€â”€â”€â”€
router.patch('/sessions/:sessionId/subjects/:subjectId/chapters/:chapterId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const session = await getSession(req.params.sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { title, topics, page_start, page_end, chapter_index } = req.body;
    const r = await pool.query(
      `UPDATE textbook_planner_chapters
       SET title = COALESCE($1, title),
           topics = COALESCE($2, topics),
           page_start = COALESCE($3, page_start),
           page_end = COALESCE($4, page_end),
           chapter_index = COALESCE($5, chapter_index)
       WHERE id = $6 AND subject_id = $7 AND session_id = $8
       RETURNING *`,
      [title || null, topics ? JSON.stringify(topics) : null, page_start || null, page_end || null, chapter_index || null,
       req.params.chapterId, req.params.subjectId, req.params.sessionId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Chapter not found' });
    return res.json(r.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€ DELETE /sessions/:sessionId/subjects/:subjectId/chapters/:chapterId â”€â”€â”€â”€
router.delete('/sessions/:sessionId/subjects/:subjectId/chapters/:chapterId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const session = await getSession(req.params.sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    await pool.query(
      `DELETE FROM textbook_planner_chapters WHERE id = $1 AND subject_id = $2 AND session_id = $3`,
      [req.params.chapterId, req.params.subjectId, req.params.sessionId]
    );
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€ PATCH /sessions/:sessionId/parameters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// --- POST /sessions/:sessionId/subjects/:subjectId/import-excel ---
// Accept an Excel file with columns: Chapter Title, Topics, Page Start, Page End
const xlsxUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post(
  '/sessions/:sessionId/subjects/:subjectId/import-excel',
  xlsxUpload.single('file'),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return res.status(422).json({ error: 'Only .xlsx or .xls files are accepted' });
    }
    try {
      const { school_id } = req.user!;
      const { sessionId, subjectId } = req.params;
      const session = await getSession(sessionId, school_id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      const subjectRow = await pool.query(
        `SELECT * FROM textbook_planner_subjects WHERE id = $1 AND session_id = $2`,
        [subjectId, sessionId]
      );
      if (subjectRow.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });

      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) return res.status(422).json({ error: 'Excel file is empty' });

      // Build rows as objects using first row as headers
      const headerRow = worksheet.getRow(1).values as any[];
      const headers = headerRow.slice(1).map((h: any) => String(h || '').trim());
      const rows: any[] = [];
      worksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return;
        const obj: any = {};
        (row.values as any[]).slice(1).forEach((val: any, i: number) => {
          if (headers[i]) obj[headers[i]] = val ?? '';
        });
        rows.push(obj);
      });
      if (rows.length === 0) return res.status(422).json({ error: 'Excel file is empty' });

      function findKey(obj: any, candidates: string[]): string | null {
        const keys = Object.keys(obj).map(k => k.toLowerCase().replace(/[\s_]/g, ''));
        for (const c of candidates) {
          const idx = keys.indexOf(c.toLowerCase().replace(/[\s_]/g, ''));
          if (idx >= 0) return Object.keys(obj)[idx];
        }
        return null;
      }

      const sample = rows[0];
      const titleKey = findKey(sample, ['chaptertitle', 'title', 'chapter', 'name']);
      const topicsKey = findKey(sample, ['topics', 'topic', 'subtopics', 'sections']);
      const pageStartKey = findKey(sample, ['pagestart', 'startpage', 'from', 'start']);
      const pageEndKey = findKey(sample, ['pageend', 'endpage', 'to', 'end']);

      if (!titleKey) {
        return res.status(422).json({ error: 'Could not find a "Chapter Title" column. Expected: Chapter Title, Topics, Page Start, Page End' });
      }

      await pool.query(`DELETE FROM textbook_planner_chapters WHERE subject_id = $1`, [subjectId]);

      const inserted = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const title = String(row[titleKey] || '').trim();
        if (!title) continue;
        const topicsRaw = topicsKey ? String(row[topicsKey] || '') : '';
        const topics = topicsRaw ? topicsRaw.split(/[,;|\n]/).map((t: string) => t.trim()).filter(Boolean) : [];
        const page_start = pageStartKey ? (parseInt(row[pageStartKey]) || null) : null;
        const page_end = pageEndKey ? (parseInt(row[pageEndKey]) || null) : null;
        const r = await pool.query(
          `INSERT INTO textbook_planner_chapters (subject_id, session_id, chapter_index, title, topics, page_start, page_end)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [subjectId, sessionId, i + 1, title, JSON.stringify(topics), page_start, page_end]
        );
        inserted.push(r.rows[0]);
      }

      if (inserted.length === 0) return res.status(422).json({ error: 'No valid chapters found. Make sure Chapter Title column has data.' });
      return res.json({ chapters: inserted, count: inserted.length });
    } catch (err) {
      console.error('[textbookPlanner] import-excel', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── POST /sessions/:sessionId/subjects/:subjectId/append-toc ────────────────
// Extract an additional TOC page and APPEND chapters to existing ones.
// Used when the table of contents spans multiple pages.
router.post(
  '/sessions/:sessionId/subjects/:subjectId/append-toc',
  (req, res, next) => {
    pdfUpload.single('file')(req, res, (err) => {
      if (err) {
        if (err.message === 'Only PDF files are allowed') return res.status(422).json({ error: err.message });
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File exceeds 50 MB limit' });
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const { school_id } = req.user!;
      const { sessionId, subjectId } = req.params;

      const session = await getSession(sessionId, school_id);
      if (!session) { fs.unlink(file.path, () => {}); return res.status(404).json({ error: 'Session not found' }); }

      const subjectRow = await pool.query(
        `SELECT * FROM textbook_planner_subjects WHERE id = $1 AND session_id = $2`,
        [subjectId, sessionId]
      );
      if (subjectRow.rows.length === 0) { fs.unlink(file.path, () => {}); return res.status(404).json({ error: 'Subject not found' }); }

      const toc_page = parseInt(req.body.toc_page) || 1;

      // Call AI service — same extract-toc endpoint
      const form = new FormData();
      form.append('file', fs.createReadStream(file.path), { filename: file.originalname });
      form.append('toc_page', String(toc_page));

      let tocResult: { chapters: any[]; failed: boolean; page_count?: number; reason?: string };
      try {
        const aiResp = await axios.post(`${AI_SERVICE_URL()}/internal/extract-toc`, form, {
          headers: form.getHeaders(),
          timeout: 60000,
        });
        tocResult = aiResp.data;
      } catch (aiErr: any) {
        fs.unlink(file.path, () => {});
        const msg = aiErr.response?.data?.detail || aiErr.response?.data?.error || aiErr.message;
        return res.status(502).json({ error: `TOC extraction failed: ${msg}` });
      } finally {
        fs.unlink(file.path, () => {});
      }

      if (tocResult.failed || tocResult.chapters.length === 0) {
        const reason = tocResult.reason || 'No chapters found on this page.';
        return res.status(422).json({ error: reason, failed: true });
      }

      // Get current max chapter_index so we append after existing chapters
      const maxIdx = await pool.query(
        `SELECT COALESCE(MAX(chapter_index), 0) as max_idx FROM textbook_planner_chapters WHERE subject_id = $1`,
        [subjectId]
      );
      let nextIndex = (maxIdx.rows[0].max_idx as number) + 1;

      const totalPages = tocResult.page_count || null;
      const totalExisting = await pool.query(
        `SELECT COUNT(*) FROM textbook_planner_chapters WHERE subject_id = $1`, [subjectId]
      );
      const existingTotal = parseInt(totalExisting.rows[0].count);

      // Compute weights across all chapters (existing + new)
      const allChapters = tocResult.chapters;
      const totalPageSpan = allChapters.reduce((sum: number, ch: any) => {
        return sum + Math.max((ch.page_end || 0) - (ch.page_start || 0) + 1, 1);
      }, 0);

      const inserted = [];
      for (const ch of tocResult.chapters) {
        const span = Math.max((ch.page_end || 0) - (ch.page_start || 0) + 1, 1);
        const weight = totalPageSpan > 0 ? span / totalPageSpan : 1 / tocResult.chapters.length;
        const r = await pool.query(
          `INSERT INTO textbook_planner_chapters
             (subject_id, session_id, chapter_index, title, topics, page_start, page_end, chapter_weight)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [subjectId, sessionId, nextIndex++, ch.title, JSON.stringify(ch.topics || []),
           ch.page_start || null, ch.page_end || null, weight]
        );
        inserted.push(r.rows[0]);
      }

      return res.json({
        chapters: inserted,
        appended: inserted.length,
        total_chapters: existingTotal + inserted.length,
      });
    } catch (err) {
      console.error('[textbookPlanner] append-toc', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);


// ─── PATCH /sessions/:sessionId/parameters ────────────────────────────────────
router.patch('/sessions/:sessionId/parameters', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const session = await getSession(req.params.sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const params = req.body;
    // Validate and compute available_teaching_minutes
    const schoolStart = params.school_start || '08:00';
    const schoolEnd = params.school_end || '14:00';
    const [sh, sm] = schoolStart.split(':').map(Number);
    const [eh, em] = schoolEnd.split(':').map(Number);
    const totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
    if (totalMinutes <= 0) return res.status(422).json({ error: 'school_end must be after school_start' });

    let nonTeachingMinutes = 0;
    if (params.lunch_start && params.lunch_end) {
      const [lsh, lsm] = params.lunch_start.split(':').map(Number);
      const [leh, lem] = params.lunch_end.split(':').map(Number);
      nonTeachingMinutes += (leh * 60 + lem) - (lsh * 60 + lsm);
    }
    if (params.snack_start && params.snack_end) {
      const [ssh, ssm] = params.snack_start.split(':').map(Number);
      const [seh, sem] = params.snack_end.split(':').map(Number);
      nonTeachingMinutes += (seh * 60 + sem) - (ssh * 60 + ssm);
    }
    nonTeachingMinutes += params.sports_minutes_per_week ? Math.round(params.sports_minutes_per_week / 5) : 0;
    if (Array.isArray(params.activities)) {
      for (const act of params.activities) {
        nonTeachingMinutes += act.daily_minutes || 0;
      }
    }

    if (nonTeachingMinutes >= totalMinutes) {
      return res.status(422).json({ error: 'Non-teaching time equals or exceeds total school day duration' });
    }

    const available_teaching_minutes = totalMinutes - nonTeachingMinutes;

    await pool.query(
      `UPDATE textbook_planner_sessions SET parameters = $1, updated_at = now() WHERE id = $2`,
      [JSON.stringify(params), req.params.sessionId]
    );

    return res.json({ available_teaching_minutes, parameters: params });
  } catch (err) {
    console.error('[textbookPlanner] PATCH parameters', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€ PATCH /sessions/:sessionId/allocations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.patch('/sessions/:sessionId/allocations', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const session = await getSession(req.params.sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { allocations } = req.body; // [{ subject_id, weekly_hours }]
    if (!Array.isArray(allocations)) return res.status(400).json({ error: 'allocations must be an array' });

    for (const alloc of allocations) {
      await pool.query(
        `UPDATE textbook_planner_subjects SET weekly_hours = $1 WHERE id = $2 AND session_id = $3`,
        [alloc.weekly_hours, alloc.subject_id, req.params.sessionId]
      );
    }

    const total_weekly_hours = allocations.reduce((sum: number, a: any) => sum + (parseFloat(a.weekly_hours) || 0), 0);
    const utilisation_pct = total_weekly_hours > 0 ? Math.round((total_weekly_hours / total_weekly_hours) * 100) : 0;

    return res.json({ total_weekly_hours, utilisation_pct, allocations });
  } catch (err) {
    console.error('[textbookPlanner] PATCH allocations', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€ PATCH /sessions/:sessionId/test-config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.patch('/sessions/:sessionId/test-config', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const session = await getSession(req.params.sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const config = req.body;
    const validModes = ['end-of-chapter', 'every-N-weeks', 'specific-dates', 'manual'];
    if (config.mode && !validModes.includes(config.mode)) {
      return res.status(422).json({ error: `mode must be one of: ${validModes.join(', ')}` });
    }
    if (config.every_n_weeks !== undefined && config.every_n_weeks !== null) {
      const n = parseInt(config.every_n_weeks);
      if (n < 1 || n > 52) return res.status(422).json({ error: 'every_n_weeks must be between 1 and 52' });
    }
    if (config.duration_periods !== undefined && config.duration_periods !== null) {
      const dp = parseInt(config.duration_periods);
      if (dp < 1 || dp > 5) return res.status(422).json({ error: 'duration_periods must be between 1 and 5' });
    }

    await pool.query(
      `UPDATE textbook_planner_sessions SET test_config = $1, updated_at = now() WHERE id = $2`,
      [JSON.stringify(config), req.params.sessionId]
    );

    return res.json({ test_config: config });
  } catch (err) {
    console.error('[textbookPlanner] PATCH test-config', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// --- POST /sessions/:sessionId/generate ---
// Generates a 2-WEEK PREVIEW starting from the academic year start date.
// The admin reviews this before confirming the full-year generation.
// Full-year generation happens at /confirm time.
router.post('/sessions/:sessionId/generate', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { sessionId } = req.params;
    const session = await getSession(sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const subjects = await pool.query(
      `SELECT s.*, json_agg(c ORDER BY c.chapter_index) as chapters
       FROM textbook_planner_subjects s
       LEFT JOIN textbook_planner_chapters c ON c.subject_id = s.id
       WHERE s.session_id = $1
       GROUP BY s.id`,
      [sessionId]
    );

    const calRow = await pool.query(
      `SELECT * FROM school_calendar WHERE school_id = $1 AND academic_year = $2 LIMIT 1`,
      [school_id, session.academic_year]
    );
    const holidays = await pool.query(`SELECT holiday_date FROM holidays WHERE school_id = $1`, [school_id]);
    const specialDays = await pool.query(`SELECT day_date, day_type FROM special_days WHERE school_id = $1`, [school_id]);

    if (!calRow.rows[0]?.start_date || !calRow.rows[0]?.end_date) {
      return res.status(422).json({ error: 'Academic year start and end dates are not configured. Please set up the school calendar first.' });
    }

    const yearStart = new Date(calRow.rows[0].start_date);
    const yearEnd = new Date(calRow.rows[0].end_date);

    // Preview: limit to first 2 weeks (14 days) from year start
    const previewEnd = new Date(yearStart);
    previewEnd.setDate(previewEnd.getDate() + 13); // 2 weeks
    const previewEndDate = previewEnd < yearEnd ? previewEnd : yearEnd;

    const payload = {
      session_id: sessionId,
      school_id,
      class_id: session.class_id,
      academic_year: session.academic_year,
      parameters: session.parameters || {},
      test_config: session.test_config || {},
      subjects: subjects.rows,
      // Pass full year dates so the LLM understands the full context
      // but preview_end_date limits what gets stored
      start_date: yearStart.toISOString().split('T')[0],
      end_date: yearEnd.toISOString().split('T')[0],
      preview_end_date: previewEndDate.toISOString().split('T')[0],
      working_days: calRow.rows[0]?.working_days || [1, 2, 3, 4, 5],
      holidays: holidays.rows.map((h: any) => new Date(h.holiday_date).toISOString().split('T')[0]),
      special_days: specialDays.rows,
      preview_only: true,
    };

    await pool.query(
      `UPDATE textbook_planner_sessions SET status = 'draft', updated_at = now() WHERE id = $1`,
      [sessionId]
    );

    let aiResult: { entries: any[]; summary: any };
    try {
      const aiResp = await axios.post(`${AI_SERVICE_URL()}/internal/generate-textbook-planner`, payload, { timeout: 120000 });
      aiResult = aiResp.data;
    } catch (aiErr: any) {
      const msg = aiErr.response?.data?.detail || aiErr.response?.data?.error || aiErr.message;
      return res.status(502).json({ error: 'Generation failed: ' + msg });
    }

    // Delete existing draft entries
    await pool.query(`DELETE FROM textbook_planner_drafts WHERE session_id = $1`, [sessionId]);

    // Insert preview entries (only first 2 weeks)
    for (const entry of aiResult.entries) {
      await pool.query(
        `INSERT INTO textbook_planner_drafts
           (session_id, school_id, entry_date, subject_id, subject_name, chapter_name, topic_name, duration_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [sessionId, school_id, entry.date, entry.subject_id || null, entry.subject_name, entry.chapter_name, entry.topic_name, entry.duration_minutes]
      );
    }

    await pool.query(
      `UPDATE textbook_planner_sessions SET status = 'generated', generation_summary = $1, updated_at = now() WHERE id = $2`,
      [JSON.stringify({ ...aiResult.summary, preview_only: true, preview_weeks: 2 }), sessionId]
    );

    return res.json({
      message: '2-week preview generated. Review the plan and click Confirm & Push to generate the full year.',
      summary: aiResult.summary,
      preview_only: true,
      preview_end_date: previewEndDate.toISOString().split('T')[0],
    });
  } catch (err) {
    console.error('[textbookPlanner] POST generate', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€ GET /sessions/:sessionId/draft â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/sessions/:sessionId/draft', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const session = await getSession(req.params.sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const weekParam = req.query.week;
    let whereClause = `WHERE d.session_id = $1`;
    const queryParams: any[] = [req.params.sessionId];

    if (weekParam) {
      const weeks = String(weekParam).split(',').map(Number).filter(n => !isNaN(n));
      if (weeks.length > 0) {
        // Week 1 = first 7 days from session start, etc.
        // Use ISO week number relative to academic year start
        whereClause += ` AND EXTRACT(WEEK FROM d.entry_date) = ANY($2::int[])`;
        queryParams.push(weeks);
      }
    }

    const r = await pool.query(
      `SELECT d.* FROM textbook_planner_drafts d ${whereClause} ORDER BY d.entry_date, d.subject_name`,
      queryParams
    );

    // Group by week
    const byWeek: Record<number, any[]> = {};
    for (const row of r.rows) {
      const week = new Date(row.entry_date).getDay(); // simplified
      const isoWeek = getISOWeek(new Date(row.entry_date));
      if (!byWeek[isoWeek]) byWeek[isoWeek] = [];
      byWeek[isoWeek].push(row);
    }

    return res.json({ entries: r.rows, by_week: byWeek, total: r.rows.length });
  } catch (err) {
    console.error('[textbookPlanner] GET draft', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// â”€â”€â”€ PATCH /sessions/:sessionId/draft/:entryId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.patch('/sessions/:sessionId/draft/:entryId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const session = await getSession(req.params.sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { subject_name, chapter_name, topic_name, duration_minutes, entry_date } = req.body;
    const r = await pool.query(
      `UPDATE textbook_planner_drafts
       SET subject_name = COALESCE($1, subject_name),
           chapter_name = COALESCE($2, chapter_name),
           topic_name = COALESCE($3, topic_name),
           duration_minutes = COALESCE($4, duration_minutes),
           entry_date = COALESCE($5, entry_date),
           is_manual_edit = true,
           updated_at = now()
       WHERE id = $6 AND session_id = $7
       RETURNING *`,
      [subject_name || null, chapter_name || null, topic_name || null, duration_minutes || null,
       entry_date || null, req.params.entryId, req.params.sessionId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    return res.json(r.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- POST /sessions/:sessionId/draft/revert ---
// Deletes ALL draft entries (generated + manual), resets session to 'draft'.
// Pure DB operation — no AI call.
router.post('/sessions/:sessionId/draft/revert', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { sessionId } = req.params;
    const session = await getSession(sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Delete ALL draft entries — both generated and manual
    const deleted = await pool.query(
      `DELETE FROM textbook_planner_drafts WHERE session_id = $1 RETURNING id`,
      [sessionId]
    );

    // Reset session status to draft
    await pool.query(
      `UPDATE textbook_planner_sessions SET status = 'draft', generation_summary = NULL, updated_at = now() WHERE id = $1`,
      [sessionId]
    );

    return res.json({
      message: 'Reverted. Deleted ' + deleted.rowCount + ' draft entries. Click Generate to create a new preview.',
    });
  } catch (err) {
    console.error('[textbookPlanner] POST revert', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/sessions/:sessionId/confirm', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { sessionId } = req.params;
    const session = await getSession(sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Guard against re-push (Task 6.2)
    if (session.status === 'confirmed') {
      return res.status(409).json({ error: 'This session has already been confirmed and pushed to the curriculum pipeline.' });
    }

    // ── Full-year generation ──────────────────────────────────────────────
    // At confirm time, generate the complete academic year planner.
    // This replaces the 2-week preview with the full schedule.
    const subjects = await pool.query(
      `SELECT s.*, json_agg(c ORDER BY c.chapter_index) as chapters
       FROM textbook_planner_subjects s
       LEFT JOIN textbook_planner_chapters c ON c.subject_id = s.id
       WHERE s.session_id = $1
       GROUP BY s.id`,
      [sessionId]
    );
    const calRow = await pool.query(
      `SELECT * FROM school_calendar WHERE school_id = $1 AND academic_year = $2 LIMIT 1`,
      [school_id, session.academic_year]
    );
    const holidays = await pool.query(`SELECT holiday_date FROM holidays WHERE school_id = $1`, [school_id]);
    const specialDays = await pool.query(`SELECT day_date, day_type FROM special_days WHERE school_id = $1`, [school_id]);

    if (!calRow.rows[0]?.start_date || !calRow.rows[0]?.end_date) {
      return res.status(422).json({ error: 'Academic year dates not configured.' });
    }

    const fullPayload = {
      session_id: sessionId, school_id, class_id: session.class_id,
      academic_year: session.academic_year,
      parameters: session.parameters || {}, test_config: session.test_config || {},
      subjects: subjects.rows,
      start_date: new Date(calRow.rows[0].start_date).toISOString().split('T')[0],
      end_date: new Date(calRow.rows[0].end_date).toISOString().split('T')[0],
      working_days: calRow.rows[0]?.working_days || [1, 2, 3, 4, 5],
      holidays: holidays.rows.map((h: any) => new Date(h.holiday_date).toISOString().split('T')[0]),
      special_days: specialDays.rows,
      preview_only: false,
    };

    let fullAiResult: { entries: any[]; summary: any };
    try {
      const aiResp = await axios.post(`${AI_SERVICE_URL()}/internal/generate-textbook-planner`, fullPayload, { timeout: 300000 });
      fullAiResult = aiResp.data;
    } catch (aiErr: any) {
      const msg = aiErr.response?.data?.detail || aiErr.response?.data?.error || aiErr.message;
      return res.status(502).json({ error: 'Full-year generation failed: ' + msg });
    }

    // Replace preview draft with full-year entries
    await pool.query(`DELETE FROM textbook_planner_drafts WHERE session_id = $1`, [sessionId]);
    for (const entry of fullAiResult.entries) {
      await pool.query(
        `INSERT INTO textbook_planner_drafts
           (session_id, school_id, entry_date, subject_id, subject_name, chapter_name, topic_name, duration_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [sessionId, school_id, entry.date, entry.subject_id || null, entry.subject_name, entry.chapter_name, entry.topic_name, entry.duration_minutes]
      );
    }

    const draftEntries = await pool.query(
      `SELECT * FROM textbook_planner_drafts WHERE session_id = $1 ORDER BY entry_date, subject_name`,
      [sessionId]
    );
    if (draftEntries.rows.length === 0) {
      return res.status(422).json({ error: 'No draft entries to confirm. Generate the planner first.' });
    }

    // Get sections for this class
    const sections = await pool.query(
      `SELECT id FROM sections WHERE class_id = $1 AND school_id = $2`,
      [session.class_id, school_id]
    );

    const results: { section_id: string; status: string; error?: string; chunks_created?: number }[] = [];

    for (const section of sections.rows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Create curriculum_documents row — reuse if already exists for this session
        const docResult = await client.query(
          `INSERT INTO curriculum_documents
             (school_id, class_id, filename, file_path, checksum, status, ingestion_stage, source, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, 'ready', 'done', 'textbook_planner', $6)
           ON CONFLICT (class_id, checksum) DO UPDATE SET status = 'ready', ingestion_stage = 'done'
           RETURNING id`,
          [
            school_id,
            session.class_id,
            'Textbook Planner - ' + session.academic_year,
            '',
            'textbook_planner_' + sessionId,
            req.user!.user_id,
          ]
        );
        const document_id = docResult.rows[0].id;

        // Create curriculum_chunks rows
        let chunkIndex = 0;
        for (const entry of draftEntries.rows) {
          const topicLabel = entry.subject_name + ' - ' + entry.chapter_name + ': ' + entry.topic_name;
          const entryContent = entry.subject_name + ': ' + entry.chapter_name + ' - ' + entry.topic_name + '. Duration: ' + entry.duration_minutes + ' minutes. Date: ' + entry.entry_date + '.';
          await client.query(
            `INSERT INTO curriculum_chunks
               (school_id, class_id, document_id, chunk_index, topic_label, content)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [school_id, session.class_id, document_id, chunkIndex++, topicLabel, entryContent]
          );
        }

        await client.query('COMMIT');

        // Call AI service generate-plans for this section (outside transaction)
        try {
          await axios.post(`${AI_SERVICE_URL()}/internal/generate-plans`, {
            section_id: section.id,
            class_id: session.class_id,
            school_id,
            academic_year: session.academic_year,
            document_id,
          }, { timeout: 60000 });
        } catch (planErr: any) {
          console.warn(`[textbookPlanner] generate-plans failed for section ${section.id}:`, planErr.message);
          // Non-fatal â€” chunks are already created
        }

        results.push({ section_id: section.id, status: 'success', chunks_created: chunkIndex });
      } catch (txErr: any) {
        await client.query('ROLLBACK');
        console.error(`[textbookPlanner] confirm tx failed for section ${section.id}:`, txErr);
        results.push({ section_id: section.id, status: 'failed', error: txErr.message });
      } finally {
        client.release();
      }
    }

    // Update session status to confirmed
    await pool.query(
      `UPDATE textbook_planner_sessions SET status = 'confirmed', updated_at = now() WHERE id = $1`,
      [sessionId]
    );

    return res.json({
      message: 'Session confirmed and pushed to curriculum pipeline',
      results,
      total_entries: draftEntries.rows.length,
    });
  } catch (err) {
    console.error('[textbookPlanner] POST confirm', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€ GET /sessions/:sessionId/coverage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/sessions/:sessionId/coverage', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const session = await getSession(req.params.sessionId, school_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const subjects = await pool.query(
      `SELECT s.id, s.name,
         COUNT(DISTINCT c.id) as total_chapters,
         COUNT(DISTINCT CASE WHEN d.chapter_name = c.title THEN c.id END) as covered_chapters
       FROM textbook_planner_subjects s
       LEFT JOIN textbook_planner_chapters c ON c.subject_id = s.id
       LEFT JOIN textbook_planner_drafts d ON d.subject_id = s.id AND d.session_id = s.session_id
       WHERE s.session_id = $1
       GROUP BY s.id, s.name`,
      [req.params.sessionId]
    );

    // Compute elapsed_pct based on today vs academic year
    const calRow = await pool.query(
      `SELECT start_date, end_date FROM school_calendar WHERE school_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [school_id]
    );
    let elapsed_pct = 0;
    if (calRow.rows.length > 0) {
      const start = new Date(calRow.rows[0].start_date).getTime();
      const end = new Date(calRow.rows[0].end_date).getTime();
      const now = Date.now();
      elapsed_pct = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
    }

    const coverageData = subjects.rows.map((s: any) => {
      const total = parseInt(s.total_chapters) || 0;
      const covered = parseInt(s.covered_chapters) || 0;
      const coverage_pct = total > 0 ? Math.round((covered / total) * 100) : 0;
      const pacing_alert = elapsed_pct - coverage_pct > 15;
      return {
        subject_id: s.id,
        subject_name: s.name,
        total_chapters: total,
        covered_chapters: covered,
        coverage_pct,
        elapsed_pct,
        pacing_alert,
      };
    });

    return res.json({ coverage: coverageData, elapsed_pct });
  } catch (err) {
    console.error('[textbookPlanner] GET coverage', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

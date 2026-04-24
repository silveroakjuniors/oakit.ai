import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { pool } from '../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../middleware/auth';
import { getToday } from '../lib/today';
import { uploadFile, deleteFile, getPublicUrl } from '../lib/storage';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

const photoUpload = multer({
  dest: '/tmp/oakit-uploads/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Photo must be JPEG or PNG'));
  },
});

// GET /api/v1/parent/teachers — list teachers for parent's children (to start new conversations)
router.get('/teachers', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const result = await pool.query(
      `SELECT DISTINCT
         u.id as teacher_id, u.name as teacher_name,
         s.id as student_id, s.name as student_name,
         c.name as class_name, sec.label as section_label
       FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       JOIN sections sec ON sec.id = s.section_id
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN users u ON u.id = sec.class_teacher_id
       WHERE psl.parent_id = $1 AND s.school_id = $2 AND u.id IS NOT NULL
       ORDER BY s.name, u.name`,
      [user_id, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/children — list all linked children with basic info
router.get('/children', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const result = await pool.query(
      `SELECT s.id, s.name, s.father_name, s.mother_name,
              s.photo_path,
              c.name as class_name, sec.label as section_label,
              sec.id as section_id, s.class_id
       FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       JOIN classes c ON c.id = s.class_id
       JOIN sections sec ON sec.id = s.section_id
       WHERE psl.parent_id = $1 AND s.school_id = $2 AND s.is_active = true
       ORDER BY c.name, s.name`,
      [user_id, school_id]
    );
    return res.json(result.rows.map((r: any) => ({ ...r, photo_url: getPublicUrl(r.photo_path) })));
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/parent/child/:student_id/photo — parent uploads child photo
router.post('/child/:student_id/photo', (req: Request, res: Response, next: any) => {
  photoUpload.single('photo')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Photo must be under 5 MB' });
      return res.status(400).json({ error: err.message || 'Photo must be JPEG or PNG' });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No photo uploaded' });

    // Verify parent is linked to this student
    const link = await pool.query(
      `SELECT psl.student_id FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`,
      [user_id, student_id, school_id]
    );
    if (link.rows.length === 0) {
      fs.unlink(file.path, () => {});
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete old photo from Supabase
    const oldRow = await pool.query('SELECT photo_path FROM students WHERE id = $1', [student_id]);
    await deleteFile(oldRow.rows[0]?.photo_path);

    // Upload to Supabase
    const { storagePath, publicUrl } = await uploadFile({
      schoolId: school_id,
      folder: 'students',
      localPath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      actorId: user_id,
      actorRole: 'parent',
      entityType: 'student_photo',
      entityId: student_id,
      auditMeta: { student_id, uploaded_by: 'parent' },
    });

    await pool.query('UPDATE students SET photo_path = $1 WHERE id = $2', [storagePath, student_id]);
    return res.json({ photo_url: publicUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/child/:student_id/feed — today's update for a specific child
router.get('/child/:student_id/feed', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.params;

    // Verify parent is linked to this student
    const link = await pool.query(
      `SELECT psl.student_id FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`,
      [user_id, student_id, school_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    // Get student's section
    const studentRow = await pool.query(
      `SELECT s.section_id, s.name, c.name as class_name, sec.label as section_label
       FROM students s JOIN classes c ON c.id = s.class_id JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = $1`, [student_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const { section_id, name, class_name, section_label } = studentRow.rows[0];

    const today = await getToday(school_id);

    // Today's attendance
    const attRow = await pool.query(
      `SELECT status, is_late, arrived_at FROM attendance_records
       WHERE student_id = $1 AND attend_date = $2 LIMIT 1`,
      [student_id, today]
    );

    // Today's completion
    const compRow = await pool.query(
      `SELECT dc.covered_chunk_ids, dc.submitted_at,
              u.name as teacher_name
       FROM daily_completions dc
       JOIN users u ON u.id = dc.teacher_id
       WHERE dc.section_id = $1 AND dc.completion_date = $2 LIMIT 1`,
      [section_id, today]
    );

    // Today's plan topics
    const planRow = await pool.query(
      `SELECT dp.chunk_ids, dp.status, sd.label as special_label, sd.day_type
       FROM day_plans dp
       LEFT JOIN special_days sd ON sd.school_id = dp.school_id AND sd.day_date = dp.plan_date
       WHERE dp.section_id = $1 AND dp.plan_date = $2 LIMIT 1`,
      [section_id, today]
    );

    let topics: string[] = [];
    if (planRow.rows.length > 0 && planRow.rows[0].chunk_ids?.length > 0) {
      const chunks = await pool.query(
        'SELECT topic_label FROM curriculum_chunks WHERE id = ANY($1::uuid[]) ORDER BY chunk_index',
        [planRow.rows[0].chunk_ids]
      );
      topics = chunks.rows.map((r: any) => r.topic_label);
    }

    // Today's homework
    const hwRow = await pool.query(
      `SELECT formatted_text, raw_text FROM teacher_homework
       WHERE section_id = $1 AND homework_date = $2 LIMIT 1`,
      [section_id, today]
    ).catch(() => ({ rows: [] }));

    // Today's notes (non-expired, deduplicated by content)
    const notesRow = await pool.query(
      `SELECT DISTINCT ON (COALESCE(note_text, ''), COALESCE(file_name, ''))
              id, note_text, file_name, file_size, expires_at, created_at
       FROM teacher_notes
       WHERE section_id = $1 AND note_date = $2 AND expires_at > now()
       ORDER BY COALESCE(note_text, ''), COALESCE(file_name, ''), created_at DESC`,
      [section_id, today]
    ).catch(() => ({ rows: [] }));

    return res.json({
      student_id, name, class_name, section_label,
      feed_date: today,
      attendance: attRow.rows[0] || null,
      completion: compRow.rows[0] || null,
      topics,
      plan_status: planRow.rows[0]?.status || null,
      special_label: planRow.rows[0]?.special_label || null,
      homework: hwRow.rows[0] || null,
      notes: notesRow.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/child/:student_id/day-highlights?date=YYYY-MM-DD
// Returns AI-generated highlights summary + topic list for a specific day
router.get('/child/:student_id/day-highlights', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.params;
    const date = (req.query.date as string || '').trim();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
    }

    // Verify parent-child link
    const link = await pool.query(
      `SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2`,
      [user_id, student_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    // Get student info + section
    const studentRow = await pool.query(
      `SELECT s.section_id, s.name, c.name as class_name, sec.label as section_label
       FROM students s
       JOIN classes c ON c.id = s.class_id
       JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = $1 AND s.school_id = $2`,
      [student_id, school_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const { section_id, name: child_name, class_name, section_label } = studentRow.rows[0];

    // Get day plan for this date
    const planRow = await pool.query(
      `SELECT dp.chunk_ids, dp.status, sd.label as special_label
       FROM day_plans dp
       LEFT JOIN special_days sd ON sd.school_id = dp.school_id AND sd.day_date = dp.plan_date
       WHERE dp.section_id = $1 AND dp.plan_date = $2 LIMIT 1`,
      [section_id, date]
    );

    // Special day (holiday etc.)
    if (planRow.rows.length > 0 && planRow.rows[0].special_label) {
      return res.json({
        date, child_name, class_name, section_label,
        topics: [planRow.rows[0].special_label],
        chunks: [],
        summary: planRow.rows[0].special_label,
        is_special_day: true,
      });
    }

    // No plan for this day
    if (planRow.rows.length === 0 || !planRow.rows[0].chunk_ids?.length) {
      return res.json({
        date, child_name, class_name, section_label,
        topics: [], chunks: [], summary: '', is_special_day: false,
      });
    }

    // Fetch chunk details (topic_label + content snippet)
    const chunksRow = await pool.query(
      `SELECT topic_label, LEFT(content, 300) as content_snippet
       FROM curriculum_chunks WHERE id = ANY($1::uuid[]) ORDER BY chunk_index`,
      [planRow.rows[0].chunk_ids]
    );
    const topics: string[] = chunksRow.rows.map((c: any) => c.topic_label).filter(Boolean);
    const chunks: { topic: string; snippet: string }[] = chunksRow.rows.map((c: any) => ({
      topic: c.topic_label || '',
      snippet: c.content_snippet || '',
    }));

    // Call AI topic-summary via the ai-service
    let summary = '';
    try {
      const axios = (await import('axios')).default;
      const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';
      const aiResp = await axios.post(`${AI_URL}/internal/topic-summary`, {
        topics,
        class_name,
        child_name,
      }, { timeout: 15000 });
      summary = aiResp.data?.summary || '';
    } catch {
      // Fallback: clean up "Week X Day Y" labels and join
      summary = topics
        .map(t => t.replace(/week\s*\d+\s*day\s*\d+/gi, '').trim())
        .filter(Boolean)
        .join(', ');
    }

    return res.json({
      date, child_name, class_name, section_label,
      topics, chunks, summary, is_special_day: false,
    });
  } catch (err) {
    console.error('[parent] day-highlights', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/child/:student_id/week-schedule — this week's day plans
router.get('/child/:student_id/week-schedule', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.params;

    // Verify parent-child link
    const link = await pool.query(
      `SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2`,
      [user_id, student_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    // Get student's section
    const studentRow = await pool.query(
      `SELECT s.section_id FROM students s WHERE s.id = $1 AND s.school_id = $2`,
      [student_id, school_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const { section_id } = studentRow.rows[0];

    // Use school's "today" (respects time machine) to anchor the week
    const todayStr = await getToday(school_id); // YYYY-MM-DD
    const todayDate = new Date(todayStr + 'T12:00:00Z'); // noon UTC avoids DST edge cases
    const dow = todayDate.getUTCDay(); // 0=Sun
    const mondayOffset = dow === 0 ? -6 : 1 - dow;

    // Build Mon–Sun as YYYY-MM-DD strings directly (no timezone conversion)
    function addDays(base: string, n: number): string {
      const d = new Date(base + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().split('T')[0];
    }
    const monday = addDays(todayStr, mondayOffset);
    const sunday = addDays(todayStr, mondayOffset + 6);

    // Fetch day plans for the week
    const plansRow = await pool.query(
      `SELECT dp.plan_date::text, dp.chunk_ids, dp.status,
              sd.label as special_label
       FROM day_plans dp
       LEFT JOIN special_days sd ON sd.school_id = dp.school_id AND sd.day_date = dp.plan_date
       WHERE dp.section_id = $1 AND dp.plan_date BETWEEN $2 AND $3
       ORDER BY dp.plan_date`,
      [section_id, monday, sunday]
    );

    // Resolve topic labels — plan_date is already a string due to ::text cast
    const days: Record<string, string[]> = {};
    for (const row of plansRow.rows) {
      const dateKey: string = typeof row.plan_date === 'string'
        ? row.plan_date.split('T')[0]
        : (row.plan_date as Date).toISOString().split('T')[0];

      if (row.special_label) {
        days[dateKey] = [row.special_label];
        continue;
      }
      if (row.chunk_ids?.length > 0) {
        const chunks = await pool.query(
          `SELECT topic_label FROM curriculum_chunks WHERE id = ANY($1::uuid[]) ORDER BY chunk_index`,
          [row.chunk_ids]
        );
        days[dateKey] = chunks.rows.map((c: any) => c.topic_label);
      } else {
        days[dateKey] = [];
      }
    }

    return res.json({ week_start: monday, days });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/child/:student_id/attendance — attendance history for a child
router.get('/child/:student_id/attendance', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.params;

    const link = await pool.query(
      `SELECT 1 FROM parent_student_links psl JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`,
      [user_id, student_id, school_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    const result = await pool.query(
      `SELECT attend_date::text, status, is_late, arrived_at
       FROM attendance_records WHERE student_id = $1
       ORDER BY attend_date DESC LIMIT 60`,
      [student_id]
    );

    const present = result.rows.filter((r: any) => r.status === 'present').length;
    const absent = result.rows.filter((r: any) => r.status === 'absent').length;
    const late = result.rows.filter((r: any) => r.is_late).length;
    const total = result.rows.length;

    return res.json({
      records: result.rows,
      stats: { present, absent, late, on_time: present - late, total },
      attendance_pct: total > 0 ? Math.round((present / total) * 100) : 0,
      punctuality_pct: present > 0 ? Math.round(((present - late) / present) * 100) : 0,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/absences
router.get('/absences', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    // Get linked students
    const links = await pool.query(
      `SELECT psl.student_id, s.name as student_name
       FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1`,
      [user_id]
    );

    const absences = [];
    for (const link of links.rows) {
      const absenceRows = await pool.query(
        `SELECT ar.attend_date, ar.status
         FROM attendance_records ar
         WHERE ar.student_id = $1 AND ar.status = 'absent'
         ORDER BY ar.attend_date DESC`,
        [link.student_id]
      );

      for (const absence of absenceRows.rows) {
        // Get covered chunks for that date in the student's section
        const sectionRow = await pool.query(
          'SELECT section_id FROM students WHERE id = $1',
          [link.student_id]
        );
        const section_id = sectionRow.rows[0]?.section_id;

        let covered_chunks: any[] = [];
        if (section_id) {
          const completion = await pool.query(
            'SELECT covered_chunk_ids FROM daily_completions WHERE section_id = $1 AND completion_date = $2',
            [section_id, absence.attend_date]
          );
          if (completion.rows.length > 0 && completion.rows[0].covered_chunk_ids?.length > 0) {
            const chunks = await pool.query(
              'SELECT id, topic_label FROM curriculum_chunks WHERE id = ANY($1::uuid[])',
              [completion.rows[0].covered_chunk_ids]
            );
            covered_chunks = chunks.rows;
          }
        }

        absences.push({
          student_id: link.student_id,
          student_name: link.student_name,
          date: absence.attend_date,
          covered_chunks,
        });
      }
    }

    return res.json(absences);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/notes/:id/download — parent downloads a note attachment
router.get('/notes/:id/download', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    // Verify parent has a child in this section
    const noteRow = await pool.query(
      `SELECT tn.file_path, tn.file_name, tn.expires_at, tn.section_id
       FROM teacher_notes tn
       WHERE tn.id = $1 AND tn.school_id = $2`,
      [req.params.id, school_id]
    );
    if (noteRow.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    const note = noteRow.rows[0];

    // Check parent has a child in this section
    const authRow = await pool.query(
      `SELECT 1 FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND s.section_id = $2 LIMIT 1`,
      [user_id, note.section_id]
    );
    if (authRow.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    if (!note.file_path) return res.status(404).json({ error: 'No file attached' });
    if (new Date(note.expires_at) < new Date()) return res.status(410).json({ error: 'This note has expired' });

    // New Supabase path — redirect to public URL
    const publicUrl = getPublicUrl(note.file_path);
    if (!publicUrl) return res.status(404).json({ error: 'File not found' });

    // For old local paths, serve directly; for Supabase paths, redirect
    if (note.file_path.startsWith('/') || note.file_path.includes('\\') || note.file_path.startsWith('./')) {
      const fs = require('fs');
      const path = require('path');
      if (!fs.existsSync(note.file_path)) return res.status(404).json({ error: 'File not found' });
      res.setHeader('Content-Disposition', `attachment; filename="${note.file_name}"`);
      return res.sendFile(path.resolve(note.file_path));
    }
    return res.redirect(publicUrl);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Reports ───────────────────────────────────────────────────────────────────

// GET /api/v1/parent/reports — list saved reports shared with this parent
router.get('/reports', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.query as Record<string, string>;

    // Get all student IDs linked to this parent
    const linksRow = await pool.query(
      `SELECT psl.student_id FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND s.school_id = $2 AND s.is_active = true`,
      [user_id, school_id]
    );
    const linkedIds: string[] = linksRow.rows.map((r: any) => r.student_id);
    if (linkedIds.length === 0) return res.json([]);

    // Filter to specific student if requested (and verify link)
    const targetIds = student_id && linkedIds.includes(student_id) ? [student_id] : linkedIds;

    const result = await pool.query(
      `SELECT id, student_id, report_type, from_date::text, to_date::text,
              title, created_at::text,
              report_data->>'student_name' as student_name,
              report_data->>'class_name' as class_name
       FROM saved_reports
       WHERE school_id = $1
         AND student_id = ANY($2::uuid[])
         AND shared_with_parent = true
       ORDER BY created_at DESC
       LIMIT 20`,
      [school_id, targetIds]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[parent reports list]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/reports/:id — get full report content
router.get('/reports/:id', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    // Verify parent has access to this report's student
    const row = await pool.query(
      `SELECT sr.id, sr.ai_report, sr.report_data, sr.report_type,
              sr.from_date::text, sr.to_date::text, sr.student_id
       FROM saved_reports sr
       JOIN parent_student_links psl ON psl.student_id = sr.student_id
       WHERE sr.id = $1 AND sr.school_id = $2
         AND psl.parent_id = $3 AND sr.shared_with_parent = true`,
      [req.params.id, school_id, user_id]
    );
    if (row.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    const r = row.rows[0];
    return res.json({
      ...r.report_data,
      ai_report: r.ai_report,
      report_id: r.id,
      report_type: r.report_type,
      from_date: r.from_date,
      to_date: r.to_date,
    });
  } catch (err) {
    console.error('[parent report detail]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/reports/:id/pdf — download report as PDF
router.get('/reports/:id/pdf', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const axios = (await import('axios')).default;

    const row = await pool.query(
      `SELECT sr.*, sr.from_date::text, sr.to_date::text
       FROM saved_reports sr
       JOIN parent_student_links psl ON psl.student_id = sr.student_id
       WHERE sr.id = $1 AND sr.school_id = $2
         AND psl.parent_id = $3 AND sr.shared_with_parent = true`,
      [req.params.id, school_id, user_id]
    );
    if (row.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    const r = row.rows[0];
    const d = r.report_data as any;

    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const aiResp = await axios.post(`${AI_URL}/internal/export-progress-report-pdf`, {
      student_name: d.student_name || '',
      age: d.age || '',
      class_name: d.class_name || '',
      section_label: d.section_label || '',
      teacher_name: d.teacher_name || '',
      father_name: d.father_name || '',
      mother_name: d.mother_name || '',
      school_name: d.school_name || '',
      from_date: r.from_date || '',
      to_date: r.to_date || '',
      attendance_pct: d.attendance?.pct || 0,
      attendance_present: d.attendance?.present || 0,
      attendance_total: d.attendance?.total || 0,
      curriculum_covered: d.curriculum?.covered || 0,
      milestones_achieved: d.milestones?.achieved || 0,
      milestones_total: d.milestones?.total || 0,
      homework_completed: d.homework?.completed || 0,
      homework_total: d.homework?.total || 0,
      ai_report: r.ai_report || '',
    }, { responseType: 'arraybuffer', timeout: 30000 });

    const fname = `Report_${(d.student_name || 'report').replace(/\s+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(Buffer.from(aiResp.data));
  } catch (err) {
    console.error('[parent report pdf]', err);
    return res.status(500).json({ error: 'PDF generation failed' });
  }
});

// ── Fees ──────────────────────────────────────────────────────────────────────

// GET /api/v1/parent/fees?student_id= — fee summary for a child
router.get('/fees', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.query as Record<string, string>;
    if (!student_id) return res.status(400).json({ error: 'student_id required' });

    // Verify parent-child link
    const link = await pool.query(
      `SELECT 1 FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`,
      [user_id, student_id, school_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    // Get student info
    const studentRow = await pool.query(
      `SELECT s.name, c.name as class_name FROM students s
       JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1 AND s.school_id = $2`,
      [student_id, school_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const student = studentRow.rows[0];

    // Get fee accounts
    const accountsRow = await pool.query(
      `SELECT sfa.id, fh.name as fee_head_name, fh.type as fee_type,
              sfa.assigned_amount, sfa.outstanding_balance, sfa.status,
              fi.due_date::text
       FROM student_fee_accounts sfa
       JOIN fee_heads fh ON fh.id = sfa.fee_head_id
       LEFT JOIN fee_instalments fi ON fi.fee_head_id = fh.id
         AND fi.instalment_number = 1
       WHERE sfa.student_id = $1 AND sfa.school_id = $2 AND sfa.deleted_at IS NULL
       ORDER BY sfa.status, fh.name`,
      [student_id, school_id]
    );

    const accounts = accountsRow.rows;
    const total_assigned = accounts.reduce((s: number, a: any) => s + Number(a.assigned_amount || 0), 0);
    const total_outstanding = accounts.reduce((s: number, a: any) => s + Number(a.outstanding_balance || 0), 0);
    const total_paid = total_assigned - total_outstanding;

    return res.json({
      student_name: student.name,
      class_name: student.class_name,
      total_assigned,
      total_outstanding,
      total_paid: Math.max(0, total_paid),
      accounts,
    });
  } catch (err) {
    console.error('[parent fees]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/parent/missed-topics/:id/done
router.post('/missed-topics/:id/done', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;
    const result = await pool.query(
      `UPDATE missed_topic_tasks SET is_done = true, done_at = now()
       WHERE id = $1 AND parent_id = $2
       RETURNING *`,
      [req.params.id, user_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/missed-topics/completed
router.get('/missed-topics/completed', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;
    const result = await pool.query(
      `SELECT mtt.*, cc.topic_label, s.name as student_name
       FROM missed_topic_tasks mtt
       JOIN curriculum_chunks cc ON cc.id = mtt.chunk_id
       JOIN students s ON s.id = mtt.student_id
       WHERE mtt.parent_id = $1 AND mtt.is_done = true
       ORDER BY mtt.done_at DESC`,
      [user_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

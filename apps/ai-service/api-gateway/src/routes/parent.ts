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

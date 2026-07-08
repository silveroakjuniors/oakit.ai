import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { uploadFile, deleteFile } from '../../lib/storage';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher', 'admin', 'principal'));

const upload = multer({
  dest: '/tmp/oakit-uploads/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only PDF and image files are allowed'));
  },
});

// GET /api/v1/teacher/resources
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { subject, class_level } = req.query;
    let query = `SELECT r.*, u.name as uploader_name,
      EXISTS(SELECT 1 FROM teacher_saved_resources tsr WHERE tsr.teacher_id = $1 AND tsr.resource_id = r.id) as is_saved
      FROM resources r JOIN users u ON u.id = r.uploader_id
      WHERE r.school_id = $2`;
    const params: any[] = [user_id, school_id];
    if (subject) { params.push(subject); query += ` AND r.subject_tag = ${params.length}`; }
    if (class_level) { params.push(class_level); query += ` AND (r.class_level = ${params.length} OR r.class_level = 'All')`; }
    query += ' ORDER BY r.created_at DESC';
    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/teacher/resources
router.post('/', (req: Request, res: Response, next: any) => {
  upload.single('file')(req, res, (err: any) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Maximum size is 5 MB.' });
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { title, description, subject_tag, class_level } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    if (title.length > 100) return res.status(400).json({ error: 'Title must be 100 characters or less' });

    const file = req.file;
    let storagePath: string | null = null;

    if (file) {
      const uploaded = await uploadFile({
        schoolId: school_id,
        folder: 'resources',
        localPath: file.path,
        originalName: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        actorId: user_id,
        actorRole: 'teacher',
        entityType: 'resource',
        auditMeta: { title: title.trim(), subject_tag: subject_tag || null },
      });
      storagePath = uploaded.storagePath;
    }

    const result = await pool.query(
      `INSERT INTO resources (school_id, uploader_id, title, description, subject_tag, class_level, file_path, file_name, file_size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [school_id, user_id, title.trim(), description?.trim() || null, subject_tag || null, class_level || 'All',
       storagePath, file?.originalname || null, file?.size || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/teacher/resources/:id/save
router.post('/:id/save', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;
    await pool.query(
      `INSERT INTO teacher_saved_resources (teacher_id, resource_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [user_id, req.params.id]
    );
    return res.json({ message: 'Saved' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/teacher/resources/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const row = await pool.query(
      'SELECT file_path, uploader_id FROM resources WHERE id = $1 AND school_id = $2',
      [req.params.id, school_id]
    );
    if (row.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });
    if (row.rows[0].uploader_id !== user_id) return res.status(403).json({ error: 'Not your resource' });
    await deleteFile(row.rows[0].file_path);
    await pool.query('DELETE FROM resources WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

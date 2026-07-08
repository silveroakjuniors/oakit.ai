import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'));

const ACTIVE_FILTER = `deleted_at IS NULL AND (expires_at IS NULL OR expires_at > now()) AND created_at > now() - INTERVAL '30 days'`;

// POST /api/v1/admin/announcements
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { title, body, target_audience = 'all', target_class_id, expires_at } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!body?.trim()) return res.status(400).json({ error: 'Body is required' });
    if (title.length > 100) return res.status(400).json({ error: 'Title must be 100 characters or less' });
    if (body.length > 1000) return res.status(400).json({ error: 'Body must be 1000 characters or less' });

    const result = await pool.query(
      `INSERT INTO announcements (school_id, author_id, title, body, target_audience, target_class_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [school_id, user_id, title.trim(), body.trim(), target_audience, target_class_id || null, expires_at || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/announcements — all including expired (for management)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT a.*, u.name as author_name FROM announcements a JOIN users u ON u.id = a.author_id
       WHERE a.school_id = $1 AND a.deleted_at IS NULL ORDER BY a.created_at DESC`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/admin/announcements/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { title, body, expires_at, target_audience, target_class_id } = req.body;
    const result = await pool.query(
      `UPDATE announcements SET
         title = COALESCE($1, title),
         body = COALESCE($2, body),
         expires_at = COALESCE($3, expires_at),
         target_audience = COALESCE($4, target_audience),
         target_class_id = COALESCE($5, target_class_id)
       WHERE id = $6 AND school_id = $7 AND deleted_at IS NULL RETURNING *`,
      [title, body, expires_at, target_audience, target_class_id, req.params.id, school_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Announcement not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/admin/announcements/:id — soft delete
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    await pool.query(
      `UPDATE announcements SET deleted_at = now() WHERE id = $1 AND school_id = $2`,
      [req.params.id, school_id]
    );
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/announcements — active announcements for teachers
export const teacherAnnouncementsRouter = Router();
teacherAnnouncementsRouter.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher', 'principal', 'admin'));
teacherAnnouncementsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT a.*, u.name as author_name FROM announcements a JOIN users u ON u.id = a.author_id
       WHERE a.school_id = $1 AND ${ACTIVE_FILTER} AND a.target_audience IN ('all','teachers')
       ORDER BY a.created_at DESC LIMIT 20`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/announcements — active announcements for parents
export const parentAnnouncementsRouter = Router();
parentAnnouncementsRouter.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));
parentAnnouncementsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    // Get parent's children class IDs
    const classIds = await pool.query(
      `SELECT DISTINCT s.class_id FROM parent_student_links psl JOIN students s ON s.id = psl.student_id WHERE psl.parent_id = $1`,
      [user_id]
    );
    const ids = classIds.rows.map((r: any) => r.class_id);
    const result = await pool.query(
      `SELECT a.*, u.name as author_name FROM announcements a JOIN users u ON u.id = a.author_id
       WHERE a.school_id = $1 AND ${ACTIVE_FILTER}
         AND (a.target_audience IN ('all','parents') OR (a.target_audience = 'class' AND a.target_class_id = ANY($2::uuid[])))
       ORDER BY a.created_at DESC LIMIT 20`,
      [school_id, ids]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { auditMessage } from '../../lib/storage';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher'));

// GET /api/v1/teacher/messages — list all threads
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const result = await pool.query(
      `SELECT DISTINCT ON (m.parent_id, m.student_id)
         m.parent_id, m.student_id,
         pu.name as parent_name, pu.mobile as parent_mobile,
         st.name as student_name,
         m.body as last_message, m.sent_at as last_sent_at, m.sender_role as last_sender,
         (SELECT COUNT(*) FROM messages m2 WHERE m2.teacher_id = $1 AND m2.parent_id = m.parent_id AND m2.student_id = m.student_id AND m2.read_at IS NULL AND m2.sender_role = 'parent') as unread_count
       FROM messages m
       JOIN parent_users pu ON pu.id = m.parent_id
       JOIN students st ON st.id = m.student_id
       WHERE m.teacher_id = $1 AND m.school_id = $2
       ORDER BY m.parent_id, m.student_id, m.sent_at DESC`,
      [user_id, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/messages/:parentId/:studentId — full thread
router.get('/:parentId/:studentId', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const result = await pool.query(
      `SELECT m.*, pu.name as parent_name, u.name as teacher_name
       FROM messages m
       LEFT JOIN parent_users pu ON pu.id = m.parent_id
       LEFT JOIN users u ON u.id = m.teacher_id
       WHERE m.teacher_id = $1 AND m.parent_id = $2 AND m.student_id = $3 AND m.school_id = $4
       ORDER BY m.sent_at ASC`,
      [user_id, req.params.parentId, req.params.studentId, school_id]
    );
    // Mark parent messages as read
    await pool.query(
      `UPDATE messages SET read_at = now()
       WHERE teacher_id = $1 AND parent_id = $2 AND student_id = $3 AND sender_role = 'parent' AND read_at IS NULL`,
      [user_id, req.params.parentId, req.params.studentId]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/teacher/messages/:parentId/:studentId — send message
router.post('/:parentId/:studentId', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Message body is required' });
    if (body.length > 1000) return res.status(400).json({ error: 'Message must be 1000 characters or less' });

    const result = await pool.query(
      `INSERT INTO messages (school_id, teacher_id, parent_id, student_id, sender_role, body)
       VALUES ($1, $2, $3, $4, 'teacher', $5) RETURNING *`,
      [school_id, user_id, req.params.parentId, req.params.studentId, body.trim()]
    );
    // Audit log
    const teacherRow = await pool.query('SELECT name FROM users WHERE id = $1', [user_id]).catch(() => ({ rows: [] }));
    await auditMessage({
      schoolId: school_id, actorId: user_id,
      actorName: teacherRow.rows[0]?.name || 'Teacher', actorRole: 'teacher',
      entityId: result.rows[0].id,
      meta: { parent_id: req.params.parentId, student_id: req.params.studentId, preview: body.trim().slice(0, 80) },
    });
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

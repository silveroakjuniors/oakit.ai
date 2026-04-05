import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { auditMessage } from '../../lib/storage';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

// GET /api/v1/parent/messages — list threads
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const result = await pool.query(
      `SELECT DISTINCT ON (m.teacher_id, m.student_id)
         m.teacher_id, m.student_id,
         u.name as teacher_name,
         st.name as student_name,
         m.body as last_message, m.sent_at as last_sent_at, m.sender_role as last_sender,
         (SELECT COUNT(*) FROM messages m2 WHERE m2.parent_id = $1 AND m2.teacher_id = m.teacher_id AND m2.student_id = m.student_id AND m2.read_at IS NULL AND m2.sender_role = 'teacher') as unread_count
       FROM messages m
       JOIN users u ON u.id = m.teacher_id
       JOIN students st ON st.id = m.student_id
       WHERE m.parent_id = $1 AND m.school_id = $2
       ORDER BY m.teacher_id, m.student_id, m.sent_at DESC`,
      [user_id, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/messages/:teacherId/:studentId — full thread
router.get('/:teacherId/:studentId', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const result = await pool.query(
      `SELECT m.*, u.name as teacher_name FROM messages m
       LEFT JOIN users u ON u.id = m.teacher_id
       WHERE m.parent_id = $1 AND m.teacher_id = $2 AND m.student_id = $3 AND m.school_id = $4
       ORDER BY m.sent_at ASC`,
      [user_id, req.params.teacherId, req.params.studentId, school_id]
    );
    await pool.query(
      `UPDATE messages SET read_at = now()
       WHERE parent_id = $1 AND teacher_id = $2 AND student_id = $3 AND sender_role = 'teacher' AND read_at IS NULL`,
      [user_id, req.params.teacherId, req.params.studentId]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/parent/messages/:teacherId/:studentId/reply — parent sends message (can initiate)
router.post('/:teacherId/:studentId/reply', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Message body is required' });
    if (body.length > 1000) return res.status(400).json({ error: 'Message must be 1000 characters or less' });

    // Verify parent has a child linked to this student
    const authRow = await pool.query(
      `SELECT 1 FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3 LIMIT 1`,
      [user_id, req.params.studentId, school_id]
    );
    if (authRow.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized for this student' });
    }

    const result = await pool.query(
      `INSERT INTO messages (school_id, teacher_id, parent_id, student_id, sender_role, body)
       VALUES ($1, $2, $3, $4, 'parent', $5) RETURNING *`,
      [school_id, req.params.teacherId, user_id, req.params.studentId, body.trim()]
    );
    // Audit log
    const parentRow = await pool.query('SELECT name FROM parent_users WHERE id = $1', [user_id]).catch(() => ({ rows: [] }));
    await auditMessage({
      schoolId: school_id, actorId: user_id,
      actorName: parentRow.rows[0]?.name || 'Parent', actorRole: 'parent',
      entityId: result.rows[0].id,
      meta: { teacher_id: req.params.teacherId, student_id: req.params.studentId, preview: body.trim().slice(0, 80) },
    });
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

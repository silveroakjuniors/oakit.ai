import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

// GET / — unread notifications for the authenticated parent
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;

    const result = await pool.query(
      `SELECT
         pn.id,
         pn.completion_date,
         pn.chunks_covered,
         pn.is_read,
         pn.created_at,
         s.label AS section_name
       FROM parent_notifications pn
       JOIN sections s ON s.id = pn.section_id
       WHERE pn.parent_id = $1 AND pn.is_read = false
       ORDER BY pn.created_at DESC`,
      [user_id]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/read — mark notification as read
router.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;

    const result = await pool.query(
      `UPDATE parent_notifications SET is_read = true
       WHERE id = $1 AND parent_id = $2
       RETURNING id`,
      [req.params.id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    return res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('principal', 'admin'));

// POST /:section_id — flag a section
router.post('/:section_id', async (req: Request, res: Response) => {
  try {
    const school_id = req.user!.school_id;
    const user_id = req.user!.user_id;
    const { section_id } = req.params;
    const { flag_note } = req.body;

    const sectionRow = await pool.query(
      'SELECT id, school_id FROM sections WHERE id = $1',
      [section_id]
    );
    if (sectionRow.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
    if (sectionRow.rows[0].school_id !== school_id) {
      return res.status(403).json({ error: 'Access denied: cross-school request' });
    }

    await pool.query(
      `UPDATE sections
       SET flagged = true, flagged_at = now(), flagged_by = $1, flag_note = $2
       WHERE id = $3`,
      [user_id, flag_note ?? null, section_id]
    );
    return res.json({ message: 'Section flagged' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:section_id — unflag a section
router.delete('/:section_id', async (req: Request, res: Response) => {
  try {
    const school_id = req.user!.school_id;
    const { section_id } = req.params;

    const sectionRow = await pool.query(
      'SELECT id, school_id FROM sections WHERE id = $1',
      [section_id]
    );
    if (sectionRow.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
    if (sectionRow.rows[0].school_id !== school_id) {
      return res.status(403).json({ error: 'Access denied: cross-school request' });
    }

    await pool.query(
      `UPDATE sections
       SET flagged = false, flagged_at = NULL, flagged_by = NULL, flag_note = NULL
       WHERE id = $1`,
      [section_id]
    );
    return res.json({ message: 'Section unflagged' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'));

// GET /api/v1/admin/uniform — list all uniform sizing requests for this school
router.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { status } = req.query as Record<string, string>;
    const params: any[] = [school_id];
    let statusClause = '';
    if (status) { params.push(status); statusClause = `AND status = $${params.length}`; }
    const result = await pool.query(
      `SELECT id, child_name, class_name, parent_name, contact_number,
              height_cm, weight_kg, chest_cm, shirt_length_cm, pant_length_cm,
              status, created_at
       FROM uniform_sizing_requests
       WHERE school_id = $1 ${statusClause}
       ORDER BY created_at DESC`,
      params
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[admin/uniform]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/admin/uniform/:id — update status
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { status, admin_notes } = req.body;
    const valid = ['pending', 'confirmed', 'dispatched', 'delivered'];
    if (status && !valid.includes(status))
      return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
    const result = await pool.query(
      `UPDATE uniform_sizing_requests
       SET status = COALESCE($1, status),
           admin_notes = COALESCE($2, admin_notes),
           updated_at = now()
       WHERE id = $3 AND school_id = $4
       RETURNING *`,
      [status || null, admin_notes || null, req.params.id, school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Request not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[admin/uniform PATCH]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

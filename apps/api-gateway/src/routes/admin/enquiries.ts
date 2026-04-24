import { Router } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, roleGuard('admin', 'super_admin'));

// ── GET /api/v1/admin/enquiries ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { status } = req.query as { status?: string };

    let query = `SELECT * FROM enquiries WHERE school_id = $1`;
    const params: any[] = [schoolId];

    if (status && ['open', 'converted', 'closed'].includes(status)) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[admin enquiries GET /]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/v1/admin/enquiries/:id ──────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { id } = req.params;
    const { status, notes } = req.body as { status?: string; notes?: string };

    const existing = await pool.query(
      `SELECT id FROM enquiries WHERE id = $1 AND school_id = $2`,
      [id, schoolId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status && ['open', 'converted', 'closed'].includes(status)) {
      updates.push(`status = $${idx++}`);
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${idx++}`);
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    values.push(id, schoolId);
    const result = await pool.query(
      `UPDATE enquiries SET ${updates.join(', ')} WHERE id = $${idx++} AND school_id = $${idx} RETURNING *`,
      values
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[admin enquiries PUT /:id]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

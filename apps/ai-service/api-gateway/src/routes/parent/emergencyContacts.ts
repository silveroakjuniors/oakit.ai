import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

// GET / — list emergency contacts for authenticated parent
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;
    const result = await pool.query(
      `SELECT id, name, relationship, phone, phone_type, is_primary, created_at, updated_at
       FROM parent_emergency_contacts
       WHERE parent_id = $1
       ORDER BY is_primary DESC, created_at DESC`,
      [user_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / — create a new emergency contact
router.post('/', async (req: Request, res: Response) => {
  const { user_id } = req.user!;
  const { name, relationship, phone, phone_type, is_primary } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (is_primary) {
      await client.query('UPDATE parent_emergency_contacts SET is_primary = false WHERE parent_id = $1 AND is_primary = true', [user_id]);
    }
    const result = await client.query(
      `INSERT INTO parent_emergency_contacts (parent_id, name, relationship, phone, phone_type, is_primary)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [user_id, name, relationship || null, phone, phone_type || null, !!is_primary]
    );
    await client.query('COMMIT');
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /:id — update an existing contact
router.put('/:id', async (req: Request, res: Response) => {
  const { user_id } = req.user!;
  const { name, relationship, phone, phone_type, is_primary } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (is_primary) {
      await client.query('UPDATE parent_emergency_contacts SET is_primary = false WHERE parent_id = $1 AND is_primary = true', [user_id]);
    }
    const result = await client.query(
      `UPDATE parent_emergency_contacts
       SET name=$1, relationship=$2, phone=$3, phone_type=$4, is_primary=$5, updated_at=now()
       WHERE id=$6 AND parent_id=$7
       RETURNING *`,
      [name, relationship || null, phone, phone_type || null, !!is_primary, req.params.id, user_id]
    );
    await client.query('COMMIT');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// DELETE /:id — delete a contact
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;
    const result = await pool.query(
      'DELETE FROM parent_emergency_contacts WHERE id = $1 AND parent_id = $2 RETURNING id',
      [req.params.id, user_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    return res.json({ message: 'Contact deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

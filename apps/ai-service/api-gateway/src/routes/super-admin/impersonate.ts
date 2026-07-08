import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../lib/db';
import { signToken, verifyToken } from '../../lib/jwt';
import { redis } from '../../lib/redis';
import { jwtVerify, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, roleGuard('super_admin'));

// POST /:school_id — start impersonation session
router.post('/:school_id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.params;
    const super_admin_id = req.user!.user_id;

    const school = await pool.query(
      'SELECT id, status FROM schools WHERE id = $1',
      [school_id]
    );
    if (school.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    if (school.rows[0].status !== 'active') {
      return res.status(403).json({ error: 'Cannot impersonate inactive school' });
    }

    const jti = uuidv4();
    const TTL = '2h';
    const token = signToken(
      { user_id: super_admin_id, school_id, role: 'admin', permissions: [], jti },
      TTL
    );

    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO impersonation_logs (super_admin_id, school_id, jti)
       VALUES ($1, $2, $3)`,
      [super_admin_id, school_id, jti]
    );

    return res.json({ token, expires_at: expiresAt.toISOString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /exit — revoke current impersonation token
router.post('/exit', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(400).json({ error: 'No token provided' });
    }
    const token = authHeader.slice(7);
    let payload: any;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!payload.jti) return res.status(400).json({ error: 'Not an impersonation token' });

    // Calculate remaining TTL for Redis expiry
    const exp = payload.exp as number;
    const ttlSeconds = Math.max(exp - Math.floor(Date.now() / 1000), 1);

    await redis.sAdd('impersonation:revoked', payload.jti);
    await redis.expire('impersonation:revoked', ttlSeconds);

    await pool.query(
      `UPDATE impersonation_logs SET exited_at = now() WHERE jti = $1`,
      [payload.jti]
    );

    return res.json({ message: 'Impersonation session ended' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

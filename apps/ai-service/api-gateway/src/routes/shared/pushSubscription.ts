import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope } from '../../middleware/auth';
import { getVapidPublicKey } from '../../lib/pushNotification';

const router = Router();
router.use(jwtVerify, schoolScope);

// GET /api/v1/push/vapid-public-key — returns the VAPID public key for subscription
router.get('/vapid-public-key', (req: Request, res: Response) => {
  const key = getVapidPublicKey();
  if (!key) return res.status(501).json({ error: 'Push notifications not configured' });
  return res.json({ publicKey: key });
});

// POST /api/v1/push/subscribe — register a push subscription
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id, role } = req.user!;
    const { subscription, device_info } = req.body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    const isParent = role === 'parent';
    const userId = isParent ? null : user_id;
    const parentId = isParent ? user_id : null;
    const userRole = role || 'unknown';

    await pool.query(
      `INSERT INTO push_subscriptions (school_id, user_id, parent_id, user_role, endpoint, p256dh, auth, device_info)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (endpoint) DO UPDATE SET
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         device_info = EXCLUDED.device_info,
         last_used_at = now()`,
      [school_id, userId, parentId, userRole, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, device_info || null]
    );

    return res.json({ message: 'Subscription registered' });
  } catch (err) {
    console.error('[push/subscribe]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/push/unsubscribe — remove a push subscription
router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });

    await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
    return res.json({ message: 'Subscription removed' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

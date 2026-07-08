import { Router, Request, Response } from 'express';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';
import { setTimeMachine, clearTimeMachine, getTimeMachineStatus } from '../../lib/today';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('admin', 'teacher', 'principal'));

// GET — all roles can read (teachers need this to know effective date)
router.get('/', async (req: Request, res: Response) => {
  const { school_id } = req.user!;
  res.json(await getTimeMachineStatus(school_id));
});

// POST — admin only
router.post('/', roleGuard('admin'), async (req: Request, res: Response) => {
  const { school_id } = req.user!;
  const { date, ttl_hours = 24 } = req.body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
  }
  const ttlSeconds = Math.min(Math.max(Number(ttl_hours) || 24, 1), 72) * 3600;
  await setTimeMachine(school_id, date, ttlSeconds);
  const status = await getTimeMachineStatus(school_id);
  return res.json(status);
});

// DELETE — admin only
router.delete('/', roleGuard('admin'), async (req: Request, res: Response) => {
  const { school_id } = req.user!;
  await clearTimeMachine(school_id);
  res.json({ active: false, mock_date: null, expires_at: null, ttl_seconds: 0 });
});

export default router;

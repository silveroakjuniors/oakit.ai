import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { redis } from '../../lib/redis';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher', 'principal', 'admin'));

const MILESTONE_THRESHOLDS = [5, 10, 20, 30];

function getMilestoneBadge(streak: number): string | null {
  const earned = MILESTONE_THRESHOLDS.filter(t => streak >= t);
  if (earned.length === 0) return null;
  const top = earned[earned.length - 1];
  return `${top}-Day Consistency 🏆`;
}

// GET /api/v1/teacher/streaks/me
router.get('/me', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const cacheKey = `streak:${user_id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const row = await pool.query(
      `SELECT current_streak, best_streak, last_completed_date
       FROM teacher_streaks WHERE teacher_id = $1 AND school_id = $2`,
      [user_id, school_id]
    );
    const data = row.rows[0] ?? { current_streak: 0, best_streak: 0, last_completed_date: null };
    const result = {
      current_streak: data.current_streak,
      best_streak: data.best_streak,
      last_completed_date: data.last_completed_date,
      badge: getMilestoneBadge(data.current_streak),
      next_milestone: MILESTONE_THRESHOLDS.find(t => t > data.current_streak) ?? null,
    };
    await redis.setEx(cacheKey, 60, JSON.stringify(result));
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/teacher/streaks/complete — called when plan is marked done
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);

    const existing = await pool.query(
      `SELECT current_streak, best_streak, last_completed_date
       FROM teacher_streaks WHERE teacher_id = $1 AND school_id = $2`,
      [user_id, school_id]
    );

    let current = 0;
    let best = 0;
    const prev = existing.rows[0];

    if (prev) {
      // Already completed today — no change
      if (prev.last_completed_date === today) {
        return res.json({ current_streak: prev.current_streak, best_streak: prev.best_streak, already_done: true });
      }

      // Check if last completion was the previous school day
      // Simple check: if last_completed_date is within 3 calendar days (covers weekends)
      const lastDate = prev.last_completed_date ? new Date(prev.last_completed_date) : null;
      const todayDate = new Date(today);
      const diffDays = lastDate ? Math.floor((todayDate.getTime() - lastDate.getTime()) / 86400000) : 999;

      if (diffDays <= 3) {
        current = prev.current_streak + 1;
      } else {
        current = 1; // reset
      }
      best = Math.max(prev.best_streak, current);
    } else {
      current = 1;
      best = 1;
    }

    await pool.query(
      `INSERT INTO teacher_streaks (teacher_id, school_id, current_streak, best_streak, last_completed_date, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (teacher_id, school_id) DO UPDATE
       SET current_streak = $3, best_streak = $4, last_completed_date = $5, updated_at = now()`,
      [user_id, school_id, current, best, today]
    );

    await redis.del(`streak:${user_id}`);

    const prevBadge = prev ? getMilestoneBadge(prev.current_streak) : null;
    const newBadge = getMilestoneBadge(current);
    const newMilestone = newBadge !== prevBadge && newBadge !== null;

    return res.json({
      current_streak: current,
      best_streak: best,
      badge: newBadge,
      new_milestone: newMilestone,
      next_milestone: MILESTONE_THRESHOLDS.find(t => t > current) ?? null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

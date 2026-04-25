/**
 * GET /api/v1/shared/today-context
 * Returns time-machine-aware today + current academic year bounds.
 * Accessible by any authenticated role.
 */
import { Router, Request, Response } from 'express';
import { jwtVerify, schoolScope } from '../../middleware/auth';
import { getToday } from '../../lib/today';
import { pool } from '../../lib/db';

const router = Router();

router.get('/', jwtVerify, schoolScope, async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const today = await getToday(school_id);

    const calRow = await pool.query(
      `SELECT start_date::text AS start_date, end_date::text AS end_date
       FROM school_calendar
       WHERE school_id = $1
       ORDER BY start_date DESC LIMIT 1`,
      [school_id]
    );

    const cal = calRow.rows[0] ?? null;
    return res.json({
      today,
      academic_start: cal?.start_date ?? null,
      academic_end: cal?.end_date ?? null,
    });
  } catch (err) {
    console.error('[today-context]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

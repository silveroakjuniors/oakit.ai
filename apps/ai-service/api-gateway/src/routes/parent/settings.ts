import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;
    const result = await pool.query('SELECT notification_prefs, calendar_sync, assistant_reminders, translation_settings FROM parent_settings WHERE parent_id = $1', [user_id]);
    if (result.rows.length === 0) {
      return res.json({ notification_prefs: {}, calendar_sync: false, assistant_reminders: false, translation_settings: {} });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;
    const { notification_prefs, calendar_sync, assistant_reminders, translation_settings } = req.body;
    const result = await pool.query(
      `INSERT INTO parent_settings (parent_id, notification_prefs, calendar_sync, assistant_reminders, translation_settings)
       VALUES ($1, $2::jsonb, $3, $4, $5::jsonb)
       ON CONFLICT (parent_id) DO UPDATE SET
         notification_prefs = COALESCE($2::jsonb, parent_settings.notification_prefs),
         calendar_sync = COALESCE($3, parent_settings.calendar_sync),
         assistant_reminders = COALESCE($4, parent_settings.assistant_reminders),
         translation_settings = COALESCE($5::jsonb, parent_settings.translation_settings),
         updated_at = now()
       RETURNING notification_prefs, calendar_sync, assistant_reminders, translation_settings`,
      [user_id, notification_prefs || null, calendar_sync ?? null, assistant_reminders ?? null, translation_settings || null]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

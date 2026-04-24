import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../../../lib/db';
import { redis } from '../../../lib/redis';
import { jwtVerify, roleGuard } from '../../../middleware/auth';

const router = Router();
router.use(jwtVerify);

const PIN_SESSION_TTL = 60 * 60 * 8; // 8 hours
const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes

// ── GET /status — Is PIN set? ─────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const result = await pool.query(
      `SELECT pin_hash IS NOT NULL AS is_set FROM principal_pin WHERE school_id = $1`,
      [schoolId]
    );
    return res.json({ is_set: result.rows[0]?.is_set ?? false });
  } catch (err) {
    console.error('[salary/pin GET /status]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /set — Set PIN (principal only) ─────────────────────────────────────
router.post('/set', roleGuard('principal'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { pin } = req.body as { pin: string };

    if (!pin || pin.length < 4 || !/^\d+$/.test(pin))
      return res.status(400).json({ error: 'PIN must be at least 4 digits' });

    const pinHash = await bcrypt.hash(pin, 10);
    await pool.query(
      `INSERT INTO principal_pin (school_id, pin_hash, failed_attempts)
       VALUES ($1, $2, 0)
       ON CONFLICT (school_id) DO UPDATE SET pin_hash = $2, failed_attempts = 0, locked_until = NULL, updated_at = now()`,
      [schoolId, pinHash]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('[salary/pin POST /set]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /verify — Verify PIN and create session ──────────────────────────────
router.post('/verify', async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const userId = req.user!.id;
    const { pin } = req.body as { pin: string };

    if (!pin) return res.status(400).json({ error: 'pin is required' });

    const result = await pool.query(
      `SELECT * FROM principal_pin WHERE school_id = $1`, [schoolId]
    );
    if (result.rows.length === 0)
      return res.status(400).json({ error: 'PIN not set. Please set a PIN first.', code: 'PIN_NOT_SET' });

    const row = result.rows[0];

    // Check lockout
    if (row.locked_until && new Date(row.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 1000);
      return res.status(403).json({
        error: `Salary module locked. Try again in ${Math.ceil(remaining / 60)} minutes.`,
        code: 'SALARY_LOCKED',
        locked_until: row.locked_until,
      });
    }

    const valid = await bcrypt.compare(pin, row.pin_hash);

    if (!valid) {
      const newAttempts = (row.failed_attempts || 0) + 1;
      if (newAttempts >= MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_SECONDS * 1000);
        await pool.query(
          `UPDATE principal_pin SET failed_attempts = $1, locked_until = $2 WHERE school_id = $3`,
          [newAttempts, lockedUntil, schoolId]
        );
        return res.status(403).json({
          error: 'Too many incorrect attempts. Salary module locked for 15 minutes.',
          code: 'SALARY_LOCKED',
          locked_until: lockedUntil,
        });
      }
      await pool.query(
        `UPDATE principal_pin SET failed_attempts = $1 WHERE school_id = $2`,
        [newAttempts, schoolId]
      );
      return res.status(401).json({
        error: 'Incorrect PIN',
        attempts_remaining: MAX_ATTEMPTS - newAttempts,
      });
    }

    // Reset failed attempts and create session
    await pool.query(
      `UPDATE principal_pin SET failed_attempts = 0, locked_until = NULL WHERE school_id = $1`,
      [schoolId]
    );
    await redis.setEx(`salary_pin_session:${userId}`, PIN_SESSION_TTL, '1');

    return res.json({ success: true });
  } catch (err) {
    console.error('[salary/pin POST /verify]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /change — Change PIN (requires current PIN) ─────────────────────────
router.post('/change', roleGuard('principal'), async (req, res) => {
  try {
    const schoolId = req.user!.school_id;
    const { current_pin, new_pin } = req.body as { current_pin: string; new_pin: string };

    if (!current_pin || !new_pin)
      return res.status(400).json({ error: 'current_pin and new_pin are required' });
    if (new_pin.length < 4 || !/^\d+$/.test(new_pin))
      return res.status(400).json({ error: 'new_pin must be at least 4 digits' });

    const result = await pool.query(
      `SELECT pin_hash FROM principal_pin WHERE school_id = $1`, [schoolId]
    );
    if (result.rows.length === 0)
      return res.status(400).json({ error: 'PIN not set' });

    const valid = await bcrypt.compare(current_pin, result.rows[0].pin_hash);
    if (!valid) return res.status(401).json({ error: 'Current PIN is incorrect' });

    const newHash = await bcrypt.hash(new_pin, 10);
    await pool.query(
      `UPDATE principal_pin SET pin_hash = $1, failed_attempts = 0, locked_until = NULL, updated_at = now()
       WHERE school_id = $2`,
      [newHash, schoolId]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('[salary/pin POST /change]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

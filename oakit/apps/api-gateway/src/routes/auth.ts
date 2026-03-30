import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../lib/db';
import { signToken, verifyToken } from '../lib/jwt';
import { jwtVerify } from '../middleware/auth';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
const RESET_TOKEN_EXPIRES = 15 * 60; // 15 minutes in seconds

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { school_code, mobile, email, password, role: roleHint } = req.body;
    const identifier = mobile || email;
    if (!school_code || !identifier || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find school
    const schoolResult = await pool.query(
      'SELECT id FROM schools WHERE subdomain = $1',
      [school_code.toLowerCase()]
    );
    if (schoolResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const school_id = schoolResult.rows[0].id;

    // Parent login path
    if (roleHint === 'parent') {
      const parentResult = await pool.query(
        `SELECT id, password_hash, is_active, force_password_reset FROM parent_users
         WHERE mobile = $1 AND school_id = $2`,
        [identifier, school_id]
      );
      if (parentResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const parent = parentResult.rows[0];
      if (!parent.is_active) return res.status(401).json({ error: 'Invalid credentials' });
      if (!parent.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
      const valid = await bcrypt.compare(password, parent.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = signToken({
        user_id: parent.id,
        school_id,
        role: 'parent',
        permissions: [],
        force_password_reset: parent.force_password_reset,
      } as any);
      return res.json({ token, role: 'parent', force_password_reset: parent.force_password_reset });
    }

    // Regular user: check mobile first, fall back to email
    const userResult = await pool.query(
      `SELECT u.id, u.password_hash, u.is_active, u.force_password_reset, u.mobile,
              r.name as role, r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE (u.mobile = $1 OR u.email = $1) AND u.school_id = $2`,
      [identifier, school_id]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    if (!user.is_active) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({
      user_id: user.id,
      school_id,
      role: user.role,
      permissions: user.permissions,
      force_password_reset: user.force_password_reset,
    } as any);

    // Attendance prompt for teachers
    let attendance_prompt = false;
    if (user.role === 'teacher') {
      try {
        const today = new Date().toISOString().split('T')[0];
        const sectionRow = await pool.query(
          'SELECT section_id FROM teacher_sections WHERE teacher_id = $1 LIMIT 1',
          [user.id]
        );
        if (sectionRow.rows.length > 0) {
          const section_id = sectionRow.rows[0].section_id;
          const attRow = await pool.query(
            'SELECT id FROM attendance_records WHERE section_id = $1 AND attend_date = $2 LIMIT 1',
            [section_id, today]
          );
          const hour = new Date().getHours();
          attendance_prompt = attRow.rows.length === 0 && hour >= 7 && hour < 17;
        }
      } catch { /* ignore */ }
    }

    return res.json({
      token,
      role: user.role,
      force_password_reset: user.force_password_reset,
      attendance_prompt,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', async (_req: Request, res: Response) => {
  return res.json({ message: 'Logged out' });
});

// POST /api/v1/auth/change-password
router.post('/change-password', jwtVerify, async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: 'new_password is required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Password too short' });

    // Get user's mobile to validate new password ≠ mobile
    const userRow = await pool.query(
      'SELECT mobile FROM users WHERE id = $1 AND school_id = $2',
      [user_id, school_id]
    );
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const mobile = userRow.rows[0].mobile;
    if (new_password === mobile) {
      return res.status(400).json({ error: 'New password must differ from your mobile number' });
    }

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, force_password_reset = false WHERE id = $2',
      [hash, user_id]
    );

    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/auth/security-questions
router.get('/security-questions', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT id, text FROM security_questions ORDER BY text');
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/setup-security-question
router.post('/setup-security-question', jwtVerify, async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;
    const { security_question_id, answer } = req.body;
    if (!security_question_id || !answer) {
      return res.status(400).json({ error: 'security_question_id and answer are required' });
    }

    const hash = await bcrypt.hash(answer.trim().toLowerCase(), 12);
    await pool.query(
      'UPDATE users SET security_question_id = $1, security_answer_hash = $2 WHERE id = $3',
      [security_question_id, hash, user_id]
    );

    return res.json({ message: 'Security question set' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/forgot-password/init
router.post('/forgot-password/init', async (req: Request, res: Response) => {
  try {
    const { school_code, mobile } = req.body;
    if (!school_code || !mobile) {
      return res.status(400).json({ error: 'school_code and mobile are required' });
    }

    const schoolResult = await pool.query(
      'SELECT id FROM schools WHERE subdomain = $1',
      [school_code.toLowerCase()]
    );
    if (schoolResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const school_id = schoolResult.rows[0].id;

    const userResult = await pool.query(
      `SELECT u.id, sq.text as question_text
       FROM users u
       LEFT JOIN security_questions sq ON u.security_question_id = sq.id
       WHERE u.mobile = $1 AND u.school_id = $2`,
      [mobile, school_id]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    if (!user.question_text) {
      return res.status(400).json({ error: 'No security question set for this account' });
    }

    return res.json({ user_id: user.id, question: user.question_text });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/forgot-password/verify
router.post('/forgot-password/verify', async (req: Request, res: Response) => {
  try {
    const { user_id, answer } = req.body;
    if (!user_id || !answer) {
      return res.status(400).json({ error: 'user_id and answer are required' });
    }

    const userResult = await pool.query(
      'SELECT security_answer_hash FROM users WHERE id = $1',
      [user_id]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Incorrect answer' });
    }

    const { security_answer_hash } = userResult.rows[0];
    if (!security_answer_hash) return res.status(401).json({ error: 'Incorrect answer' });

    const valid = await bcrypt.compare(answer.trim().toLowerCase(), security_answer_hash);
    if (!valid) return res.status(401).json({ error: 'Incorrect answer' });

    // Issue short-lived reset token
    const import_jwt = require('jsonwebtoken');
    const resetToken = import_jwt.sign(
      { user_id, purpose: 'password_reset' },
      process.env.JWT_SECRET || 'change_me',
      { expiresIn: '15m' }
    );

    return res.json({ reset_token: resetToken });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/forgot-password/reset
router.post('/forgot-password/reset', async (req: Request, res: Response) => {
  try {
    const { reset_token, new_password } = req.body;
    if (!reset_token || !new_password) {
      return res.status(400).json({ error: 'reset_token and new_password are required' });
    }

    let payload: any;
    try {
      const import_jwt = require('jsonwebtoken');
      payload = import_jwt.verify(reset_token, process.env.JWT_SECRET || 'change_me');
    } catch {
      return res.status(401).json({ error: 'Invalid or expired reset token' });
    }

    if (payload.purpose !== 'password_reset') {
      return res.status(401).json({ error: 'Invalid reset token' });
    }

    // Validate new password ≠ mobile
    const userRow = await pool.query('SELECT mobile FROM users WHERE id = $1', [payload.user_id]);
    if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (new_password === userRow.rows[0].mobile) {
      return res.status(400).json({ error: 'New password must differ from your mobile number' });
    }

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, force_password_reset = false WHERE id = $2',
      [hash, payload.user_id]
    );

    return res.json({ message: 'Password reset successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/auth/setup (legacy — keep for backward compat)
router.post('/setup', async (req: Request, res: Response) => {
  try {
    const { setup_token, password } = req.body;
    if (!setup_token || !password) return res.status(400).json({ error: 'Missing fields' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const userResult = await pool.query(
      'SELECT id FROM users WHERE setup_token = $1 AND setup_expires > now()',
      [setup_token]
    );
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired setup token' });
    }

    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, setup_token = NULL, setup_expires = NULL WHERE id = $2',
      [hash, userResult.rows[0].id]
    );

    return res.json({ message: 'Password set successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

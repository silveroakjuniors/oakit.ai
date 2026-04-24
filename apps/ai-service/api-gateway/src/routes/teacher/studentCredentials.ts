import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher', 'admin'));

// Generate a random 8-char alphanumeric password for new/reset accounts
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

async function generateUsername(schoolId: string, firstName: string, className: string, sectionLabel: string): Promise<string> {
  const base = `${firstName}-${className}-${sectionLabel}`
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9\-]/g, '');

  // Check for collision
  const existing = await pool.query(
    'SELECT username FROM student_accounts WHERE school_id = $1 AND username LIKE $2',
    [schoolId, `${base}%`]
  );
  const taken = new Set(existing.rows.map((r: any) => r.username));
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

async function createOrResetAccount(schoolId: string, studentId: string, userId: string): Promise<{ username: string; password: string; is_new: boolean }> {
  // Get student info
  const studentRow = await pool.query(
    `SELECT s.name, c.name as class_name, sec.label as section_label, s.class_id
     FROM students s
     JOIN classes c ON c.id = s.class_id
     JOIN sections sec ON sec.id = s.section_id
     WHERE s.id = $1 AND s.school_id = $2`,
    [studentId, schoolId]
  );
  if (studentRow.rows.length === 0) throw new Error('Student not found');
  const st = studentRow.rows[0];

  // Check portal enabled
  const configRow = await pool.query(
    'SELECT enabled FROM student_portal_config WHERE school_id = $1 AND class_id = $2',
    [schoolId, st.class_id]
  );
  if (!configRow.rows[0]?.enabled) throw new Error('Student portal is not enabled for this class');

  const firstName = st.name.split(' ')[0];

  // Check if account exists
  const existing = await pool.query(
    'SELECT id, username FROM student_accounts WHERE student_id = $1',
    [studentId]
  );

  if (existing.rows.length > 0) {
    // Reset password — generate new random temp password
    const tempPwd = generateTempPassword();
    const hash = await bcrypt.hash(tempPwd, 12);
    await pool.query(
      'UPDATE student_accounts SET password_hash = $1, force_password_reset = true, updated_at = now() WHERE student_id = $2',
      [hash, studentId]
    );
    return { username: existing.rows[0].username, password: tempPwd, is_new: false };
  }

  // Create new account — generate random temp password
  const tempPwd = generateTempPassword();
  const hash = await bcrypt.hash(tempPwd, 12);
  const username = await generateUsername(schoolId, firstName, st.class_name, st.section_label);
  await pool.query(
    `INSERT INTO student_accounts (school_id, student_id, username, password_hash, force_password_reset, created_by)
     VALUES ($1, $2, $3, $4, true, $5)`,
    [schoolId, studentId, username, hash, userId]
  );
  return { username, password: tempPwd, is_new: true };
}

// POST /generate — single or bulk (section_id)
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id, role } = req.user!;
    const { student_id, section_id } = req.body;

    // Teachers can only manage their own sections
    if (role === 'teacher') {
      const sections = await getTeacherSections(user_id, school_id);
      const allowed = sections.map(s => s.section_id);
      if (section_id && !allowed.includes(section_id)) {
        return res.status(403).json({ error: 'Not authorized for this section' });
      }
    }

    if (student_id) {
      // Single student
      const result = await createOrResetAccount(school_id, student_id, user_id);
      return res.status(201).json(result);
    }

    if (section_id) {
      // Bulk — all students in section
      const students = await pool.query(
        'SELECT id FROM students WHERE section_id = $1 AND school_id = $2 AND is_active = true',
        [section_id, school_id]
      );
      const results = [];
      for (const s of students.rows) {
        try {
          const r = await createOrResetAccount(school_id, s.id, user_id);
          results.push({ student_id: s.id, ...r });
        } catch (e: any) {
          results.push({ student_id: s.id, error: e.message });
        }
      }
      return res.status(201).json(results);
    }

    return res.status(400).json({ error: 'student_id or section_id is required' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /reset/:studentId — reset to default password
router.post('/reset/:studentId', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id, role } = req.user!;

    if (role === 'teacher') {
      const sections = await getTeacherSections(user_id, school_id);
      const allowed = sections.map(s => s.section_id);
      const studentSection = await pool.query(
        'SELECT section_id FROM students WHERE id = $1 AND school_id = $2',
        [req.params.studentId, school_id]
      );
      if (!studentSection.rows[0] || !allowed.includes(studentSection.rows[0].section_id)) {
        return res.status(403).json({ error: 'Not authorized for this student' });
      }
    }

    const tempPwd = generateTempPassword();
    const hash = await bcrypt.hash(tempPwd, 12);
    const result = await pool.query(
      `UPDATE student_accounts SET password_hash = $1, force_password_reset = true, updated_at = now()
       WHERE student_id = $2 AND school_id = $3 RETURNING username`,
      [hash, req.params.studentId, school_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No account found for this student' });
    return res.json({ username: result.rows[0].username, password: tempPwd, message: 'Password reset successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:sectionId — list students with account status
router.get('/:sectionId', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id, role } = req.user!;

    if (role === 'teacher') {
      const sections = await getTeacherSections(user_id, school_id);
      if (!sections.some(s => s.section_id === req.params.sectionId)) {
        return res.status(403).json({ error: 'Not authorized for this section' });
      }
    }

    const result = await pool.query(
      `SELECT s.id as student_id, s.name as student_name,
              sa.username, sa.is_active, sa.force_password_reset, sa.created_at,
              CASE WHEN sa.id IS NOT NULL THEN true ELSE false END as has_account
       FROM students s
       LEFT JOIN student_accounts sa ON sa.student_id = s.id
       WHERE s.section_id = $1 AND s.school_id = $2 AND s.is_active = true
       ORDER BY s.name`,
      [req.params.sectionId, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

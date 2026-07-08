import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin'));

// GET /api/v1/admin/student-portal/config — list all classes with portal status
router.get('/config', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT c.id as class_id, c.name as class_name,
              COALESCE(spc.enabled, false) as enabled,
              spc.enabled_at, spc.updated_at
       FROM classes c
       LEFT JOIN student_portal_config spc ON spc.class_id = c.id AND spc.school_id = $1
       WHERE c.school_id = $1
       ORDER BY c.name`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/admin/student-portal/config/:classId — enable or disable portal for a class
router.put('/config/:classId', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled (boolean) is required' });

    // Verify class belongs to school
    const classCheck = await pool.query(
      'SELECT id FROM classes WHERE id = $1 AND school_id = $2',
      [req.params.classId, school_id]
    );
    if (classCheck.rows.length === 0) return res.status(404).json({ error: 'Class not found' });

    const result = await pool.query(
      `INSERT INTO student_portal_config (school_id, class_id, enabled, enabled_at, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (school_id, class_id) DO UPDATE
       SET enabled = EXCLUDED.enabled,
           enabled_at = CASE WHEN EXCLUDED.enabled = true THEN now() ELSE student_portal_config.enabled_at END,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()
       RETURNING *`,
      [school_id, req.params.classId, enabled, enabled ? new Date() : null, user_id]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

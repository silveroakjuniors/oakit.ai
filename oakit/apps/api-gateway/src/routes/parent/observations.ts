import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { verifyParentOwnsStudent } from '../../lib/parentAuth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

// GET /api/v1/parent/observations/:studentId — shared observations only
router.get('/:studentId', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    if (!(await verifyParentOwnsStudent(user_id, req.params.studentId, school_id)))
      return res.status(403).json({ error: 'Not authorized' });

    const result = await pool.query(
      `SELECT so.id, so.obs_text, so.categories, so.obs_date, so.created_at, u.name as teacher_name
       FROM student_observations so JOIN users u ON u.id = so.teacher_id
       WHERE so.student_id = $1 AND so.share_with_parent = true
       ORDER BY so.created_at DESC`,
      [req.params.studentId]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

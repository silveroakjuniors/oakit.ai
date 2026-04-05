import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('principal', 'admin'));

// GET /api/v1/principal/observations/:studentId — full history
router.get('/:studentId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT so.*, u.name as teacher_name FROM student_observations so
       JOIN users u ON u.id = so.teacher_id
       WHERE so.student_id = $1 AND so.school_id = $2
       ORDER BY so.created_at DESC`,
      [req.params.studentId, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

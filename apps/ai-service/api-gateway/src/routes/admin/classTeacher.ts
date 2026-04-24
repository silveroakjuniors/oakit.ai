import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin'));

// POST /api/v1/admin/classes/sections/:id/class-teacher
router.post('/sections/:id/class-teacher', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const section_id = req.params.id;
    const { teacher_id } = req.body;
    if (!teacher_id) return res.status(400).json({ error: 'teacher_id is required' });

    // Check teacher belongs to this school
    const teacherRow = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND school_id = $2',
      [teacher_id, school_id]
    );
    if (teacherRow.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    // Check section belongs to this school
    const sectionRow = await pool.query(
      'SELECT id, label FROM sections WHERE id = $1 AND school_id = $2',
      [section_id, school_id]
    );
    if (sectionRow.rows.length === 0) {
      return res.status(404).json({ error: 'Section not found' });
    }

    // Try to assign — unique index will catch conflicts
    try {
      await pool.query(
        'UPDATE sections SET class_teacher_id = $1 WHERE id = $2 AND school_id = $3',
        [teacher_id, section_id, school_id]
      );
    } catch (err: any) {
      if (err.code === '23505') {
        // Find conflicting section
        const conflict = await pool.query(
          `SELECT s.id, s.label FROM sections s
           WHERE s.class_teacher_id = $1 AND s.school_id = $2 AND s.id != $3`,
          [teacher_id, school_id, section_id]
        );
        const conflicting = conflict.rows[0];
        return res.status(409).json({
          error: `Teacher is already class teacher for section ${conflicting?.label || 'another section'}`,
          conflicting_section: conflicting || null,
        });
      }
      throw err;
    }

    // Auto-copy plans from sibling sections if this section has none
    const existingPlans = await pool.query(
      'SELECT COUNT(*) as cnt FROM day_plans WHERE section_id = $1',
      [section_id]
    );
    if (parseInt(existingPlans.rows[0].cnt) === 0) {
      // Get class_id for this section
      const secInfo = await pool.query(
        'SELECT class_id FROM sections WHERE id = $1',
        [section_id]
      );
      if (secInfo.rows.length > 0) {
        const { class_id } = secInfo.rows[0];
        // Copy plans from sibling section
        const sibling = await pool.query(
          `SELECT dp.plan_date, dp.chunk_ids, dp.status
           FROM day_plans dp
           JOIN sections s ON s.id = dp.section_id
           WHERE s.class_id = $1 AND s.school_id = $2 AND dp.section_id != $3
           ORDER BY dp.plan_date`,
          [class_id, school_id, section_id]
        );
        for (const plan of sibling.rows) {
          await pool.query(
            `INSERT INTO day_plans (school_id, section_id, teacher_id, plan_date, chunk_ids, status)
             VALUES ($1, $2, $3, $4, $5::uuid[], $6)
             ON CONFLICT (section_id, plan_date) DO NOTHING`,
            [school_id, section_id, teacher_id, plan.plan_date, plan.chunk_ids, plan.status]
          );
        }
      }
    } else {
      // Update teacher_id on existing plans for this section
      await pool.query(
        'UPDATE day_plans SET teacher_id = $1 WHERE section_id = $2',
        [teacher_id, section_id]
      );
    }

    return res.json({ message: 'Class teacher assigned' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/admin/classes/sections/:id/class-teacher
router.delete('/sections/:id/class-teacher', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const section_id = req.params.id;

    await pool.query(
      'UPDATE sections SET class_teacher_id = NULL WHERE id = $1 AND school_id = $2',
      [section_id, school_id]
    );

    return res.json({ message: 'Class teacher removed' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

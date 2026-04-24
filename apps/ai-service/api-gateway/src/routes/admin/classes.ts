import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('admin'));

/**
 * Copy all existing day_plans from any sibling section of the same class
 * into the new section. Used when a new section is added or a teacher is assigned
 * to a section that has no plans yet.
 */
async function _copyPlansToSection(school_id: string, class_id: string, new_section_id: string, teacher_id: string): Promise<number> {
  // Find a sibling section that already has plans
  const sibling = await pool.query(
    `SELECT dp.plan_date, dp.chunk_ids, dp.status
     FROM day_plans dp
     JOIN sections s ON s.id = dp.section_id
     WHERE s.class_id = $1 AND s.school_id = $2 AND dp.section_id != $3
     ORDER BY dp.plan_date`,
    [class_id, school_id, new_section_id]
  );
  if (sibling.rows.length === 0) return 0;

  let copied = 0;
  for (const plan of sibling.rows) {
    await pool.query(
      `INSERT INTO day_plans (school_id, section_id, teacher_id, plan_date, chunk_ids, status)
       VALUES ($1, $2, $3, $4, $5::uuid[], $6)
       ON CONFLICT (section_id, plan_date) DO NOTHING`,
      [school_id, new_section_id, teacher_id, plan.plan_date, plan.chunk_ids, plan.status]
    );
    copied++;
  }
  return copied;
}
router.use(jwtVerify, schoolScope, roleGuard('admin'));

// GET /api/v1/admin/classes
router.get('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT c.id, c.name,
              to_char(c.day_start_time, 'HH24:MI') as day_start_time,
              to_char(c.day_end_time, 'HH24:MI') as day_end_time,
        COALESCE(json_agg(
          json_build_object(
            'id', s.id,
            'label', s.label,
            'class_teacher_id', s.class_teacher_id,
            'class_teacher_name', ct.name,
            'teachers', (
              SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.name)), '[]')
              FROM teacher_sections ts2
              JOIN users u ON ts2.teacher_id = u.id
              WHERE ts2.section_id = s.id
            )
          )
        ) FILTER (WHERE s.id IS NOT NULL), '[]') as sections
       FROM classes c
       LEFT JOIN sections s ON s.class_id = c.id
       LEFT JOIN users ct ON ct.id = s.class_teacher_id
       WHERE c.school_id = $1
       GROUP BY c.id
       ORDER BY c.name`,
      [school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/classes
router.post('/', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await pool.query(
      'INSERT INTO classes (school_id, name) VALUES ($1, $2) RETURNING id, name',
      [school_id, name]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'Class name already exists' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/classes/:id/sections
router.get('/:id/sections', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT s.id, s.label,
        COALESCE(json_agg(
          json_build_object('id', u.id, 'name', u.name)
        ) FILTER (WHERE u.id IS NOT NULL), '[]') as teachers
       FROM sections s
       LEFT JOIN teacher_sections ts ON ts.section_id = s.id
       LEFT JOIN users u ON ts.teacher_id = u.id
       WHERE s.class_id = $1 AND s.school_id = $2
       GROUP BY s.id
       ORDER BY s.label`,
      [req.params.id, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/classes/:id/sections
router.post('/:id/sections', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { label } = req.body;
    if (!label) return res.status(400).json({ error: 'label is required' });

    const result = await pool.query(
      'INSERT INTO sections (school_id, class_id, label) VALUES ($1, $2, $3) RETURNING id, label',
      [school_id, req.params.id, label]
    );
    const newSection = result.rows[0];

    // Auto-copy plans from sibling sections if they exist
    // Use a placeholder teacher_id — will be updated when teacher is assigned
    // For now, find any teacher in the class to use as placeholder
    const anyTeacher = await pool.query(
      `SELECT COALESCE(s.class_teacher_id, ts.teacher_id) as teacher_id
       FROM sections s
       LEFT JOIN teacher_sections ts ON ts.section_id = s.id
       WHERE s.class_id = $1 AND s.school_id = $2 AND s.id != $3
         AND COALESCE(s.class_teacher_id, ts.teacher_id) IS NOT NULL
       LIMIT 1`,
      [req.params.id, school_id, newSection.id]
    );
    let plansCopied = 0;
    if (anyTeacher.rows.length > 0) {
      plansCopied = await _copyPlansToSection(school_id, req.params.id, newSection.id, anyTeacher.rows[0].teacher_id);
    }

    return res.status(201).json({ ...newSection, plans_copied: plansCopied });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'Section label already exists in this class' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/admin/sections/:id/teachers
router.post('/sections/:id/teachers', async (req: Request, res: Response) => {
  try {
    const { teacher_id } = req.body;
    if (!teacher_id) return res.status(400).json({ error: 'teacher_id is required' });

    await pool.query(
      'INSERT INTO teacher_sections (teacher_id, section_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [teacher_id, req.params.id]
    );
    return res.json({ message: 'Teacher assigned' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/admin/sections/:id/teachers/:tid
router.delete('/sections/:id/teachers/:tid', async (req: Request, res: Response) => {
  try {
    await pool.query(
      'DELETE FROM teacher_sections WHERE section_id = $1 AND teacher_id = $2',
      [req.params.id, req.params.tid]
    );
    return res.json({ message: 'Teacher removed' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/admin/classes/:id/timings
router.patch('/:id/timings', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { day_start_time, day_end_time } = req.body;
    if (!day_start_time || !day_end_time) return res.status(400).json({ error: 'day_start_time and day_end_time are required' });
    await pool.query(
      'UPDATE classes SET day_start_time = $1, day_end_time = $2 WHERE id = $3 AND school_id = $4',
      [day_start_time, day_end_time, req.params.id, school_id]
    );
    return res.json({ message: 'Timings updated' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher'));

const VALID_CATEGORIES = ['Behavior','Social Skills','Academic Progress','Motor Skills','Language','Other'];

// POST /api/v1/teacher/observations
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id, obs_text, categories = [], share_with_parent = false } = req.body;

    if (!student_id) return res.status(400).json({ error: 'student_id is required' });
    if (!obs_text?.trim() && (!categories || categories.length === 0)) {
      return res.status(400).json({ error: 'Please add a note or select a category before saving.' });
    }
    if (obs_text && obs_text.length > 500) {
      return res.status(400).json({ error: 'Note must be 500 characters or less.' });
    }
    const invalidCats = categories.filter((c: string) => !VALID_CATEGORIES.includes(c));
    if (invalidCats.length > 0) {
      return res.status(400).json({ error: `Invalid categories: ${invalidCats.join(', ')}` });
    }

    // Verify teacher has access to this student's section
    const sections = await getTeacherSections(user_id, school_id);
    const sectionIds = sections.map(s => s.section_id);
    const studentRow = await pool.query(
      'SELECT section_id FROM students WHERE id = $1 AND school_id = $2',
      [student_id, school_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    if (!sectionIds.includes(studentRow.rows[0].section_id)) {
      return res.status(403).json({ error: 'Not authorized for this student' });
    }

    const result = await pool.query(
      `INSERT INTO student_observations (student_id, teacher_id, school_id, obs_text, categories, share_with_parent)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [student_id, user_id, school_id, obs_text?.trim() || null, categories, share_with_parent]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/observations?section_id= — list all obs for a section (for report readiness map)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { section_id } = req.query as Record<string, string>;

    const sections = await getTeacherSections(user_id, school_id);
    const sectionIds = sections.map(s => s.section_id);

    // If section_id provided, verify access; otherwise use all teacher sections
    const targetSections = section_id
      ? (sectionIds.includes(section_id) ? [section_id] : [])
      : sectionIds;

    if (targetSections.length === 0) return res.json([]);

    const result = await pool.query(
      `SELECT so.student_id, so.categories
       FROM student_observations so
       JOIN students st ON st.id = so.student_id
       WHERE st.section_id = ANY($1::uuid[]) AND so.school_id = $2`,
      [targetSections, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/observations/:studentId
router.get('/:studentId', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const sections = await getTeacherSections(user_id, school_id);
    const sectionIds = sections.map(s => s.section_id);
    const studentRow = await pool.query(
      'SELECT section_id FROM students WHERE id = $1 AND school_id = $2',
      [req.params.studentId, school_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    if (!sectionIds.includes(studentRow.rows[0].section_id)) {
      return res.status(403).json({ error: 'Not authorized for this student' });
    }
    const result = await pool.query(
      `SELECT so.*, u.name as teacher_name FROM student_observations so
       JOIN users u ON u.id = so.teacher_id
       WHERE so.student_id = $1 ORDER BY so.created_at DESC`,
      [req.params.studentId]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/teacher/observations/:id — toggle share_with_parent
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { share_with_parent } = req.body;
    const result = await pool.query(
      `UPDATE student_observations SET share_with_parent = $1
       WHERE id = $2 AND teacher_id = $3 AND school_id = $4 RETURNING *`,
      [share_with_parent, req.params.id, user_id, school_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Observation not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

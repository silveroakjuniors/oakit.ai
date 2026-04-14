import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import { getPublicUrl } from '../../lib/storage';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher'));

// GET /api/v1/teacher/sections
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    const sections = await getTeacherSections(user_id, school_id);
    if (sections.length === 0) return res.json([]);

    const sectionIds = sections.map((s) => s.section_id);

    const { rows } = await pool.query<{ id: string; label: string; class_name: string }>(
      `SELECT s.id, s.label, c.name AS class_name
       FROM sections s
       JOIN classes c ON c.id = s.class_id
       WHERE s.id = ANY($1::uuid[])`,
      [sectionIds]
    );

    const labelMap = new Map(rows.map((r) => [r.id, { label: r.label, class_name: r.class_name }]));

    const result = sections.map((s) => ({
      section_id: s.section_id,
      section_label: labelMap.get(s.section_id)?.label ?? '',
      class_name: labelMap.get(s.section_id)?.class_name ?? '',
      role: s.role,
    }));

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/sections/:sectionId/students
router.get('/:sectionId/students', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const sections = await getTeacherSections(user_id, school_id);
    const allowed = sections.some(s => s.section_id === req.params.sectionId);
    if (!allowed) return res.status(403).json({ error: 'Not authorized for this section' });

    const result = await pool.query(
      `SELECT s.id, s.name, s.photo_path,
              c.name as class_name, sec.label as section_label
       FROM students s
       JOIN classes c ON c.id = s.class_id
       JOIN sections sec ON sec.id = s.section_id
       WHERE s.section_id = $1 AND s.school_id = $2 AND s.is_active = true
       ORDER BY s.name`,
      [req.params.sectionId, school_id]
    );
    return res.json(result.rows.map((r: any) => ({ ...r, photo_url: getPublicUrl(r.photo_path) })));
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

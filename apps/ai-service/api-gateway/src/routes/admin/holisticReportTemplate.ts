/**
 * routes/admin/holisticReportTemplate.ts
 * Admin manages the developmental assessment domain templates per class.
 * Sub-items can differ between Nursery, Jr. KG, Sr. KG.
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'));

const DEFAULT_DOMAINS = [
  {
    id: 'social_emotional', label: 'Social / Emotional Development', sort_order: 1,
    sub_items: [
      { id: 'se_01', label: 'Adjusts well to school environment',          sort_order: 1 },
      { id: 'se_02', label: 'Shares and takes turns with peers',            sort_order: 2 },
      { id: 'se_03', label: 'Shows confidence and self-expression',         sort_order: 3 },
      { id: 'se_04', label: 'Follows classroom rules and routines',         sort_order: 4 },
      { id: 'se_05', label: 'Interacts positively with teachers and peers', sort_order: 5 },
    ],
  },
  {
    id: 'physical', label: 'Physical Development', sort_order: 2,
    sub_items: [
      { id: 'ph_01', label: 'Fine motor skills (holding pencil, cutting)',  sort_order: 1 },
      { id: 'ph_02', label: 'Gross motor skills (running, jumping)',        sort_order: 2 },
      { id: 'ph_03', label: 'Hand-eye coordination',                        sort_order: 3 },
      { id: 'ph_04', label: 'Personal hygiene and self-care habits',        sort_order: 4 },
    ],
  },
  {
    id: 'speaking_listening', label: 'Speaking / Listening Skills', sort_order: 3,
    sub_items: [
      { id: 'sl_01', label: 'Listens attentively and follows instructions', sort_order: 1 },
      { id: 'sl_02', label: 'Speaks clearly and expresses ideas',           sort_order: 2 },
      { id: 'sl_03', label: 'Participates in class discussions and rhymes', sort_order: 3 },
      { id: 'sl_04', label: 'Responds appropriately to questions',          sort_order: 4 },
    ],
  },
  {
    id: 'reading_writing', label: 'Reading / Writing Skills', sort_order: 4,
    sub_items: [
      { id: 'rw_01', label: 'Recognises letters and their sounds',          sort_order: 1 },
      { id: 'rw_02', label: 'Attempts to read simple words/sentences',      sort_order: 2 },
      { id: 'rw_03', label: 'Writes letters and words with correct form',   sort_order: 3 },
      { id: 'rw_04', label: 'Shows interest in books and stories',          sort_order: 4 },
    ],
  },
  {
    id: 'numeracy', label: 'Numeracy Skills', sort_order: 5,
    sub_items: [
      { id: 'nu_01', label: 'Number recognition and counting',              sort_order: 1 },
      { id: 'nu_02', label: 'Understands basic concepts (more/less, big/small)', sort_order: 2 },
      { id: 'nu_03', label: 'Pattern recognition and sorting',              sort_order: 3 },
      { id: 'nu_04', label: 'Simple addition and subtraction (age-appropriate)', sort_order: 4 },
    ],
  },
  {
    id: 'character_values', label: 'Character & Values', sort_order: 6,
    sub_items: [
      { id: 'cv_01', label: 'Shows honesty and truthfulness',               sort_order: 1 },
      { id: 'cv_02', label: 'Demonstrates kindness and empathy',            sort_order: 2 },
      { id: 'cv_03', label: 'Respects elders, teachers and classmates',     sort_order: 3 },
      { id: 'cv_04', label: 'Takes responsibility for belongings and tasks', sort_order: 4 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/admin/holistic-template/:class_id?year=2026-27
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:class_id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const year = req.query.year as string;
    if (!year) return res.status(400).json({ error: 'year is required' });

    const row = await pool.query(
      `SELECT id, domains FROM holistic_report_templates
       WHERE school_id=$1 AND class_id=$2 AND academic_year=$3`,
      [school_id, req.params.class_id, year],
    );

    if (row.rows.length > 0) {
      return res.json({ id: row.rows[0].id, domains: row.rows[0].domains });
    }
    return res.json({ id: null, domains: DEFAULT_DOMAINS });
  } catch (err) {
    console.error('[holistic-template get]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/admin/holistic-template/:class_id
// Save/update the domain+sub-item structure for this class
// Body: { year: '2026-27', domains: [...] }
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:class_id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { year, domains } = req.body;
    if (!year) return res.status(400).json({ error: 'year is required' });
    if (!Array.isArray(domains)) return res.status(400).json({ error: 'domains must be an array' });

    // Validate domain structure
    for (const d of domains) {
      if (!d.id || !d.label) return res.status(400).json({ error: 'Each domain needs id and label' });
      if (!Array.isArray(d.sub_items)) return res.status(400).json({ error: 'Each domain needs sub_items array' });
      for (const item of d.sub_items) {
        if (!item.id || !item.label) return res.status(400).json({ error: 'Each sub_item needs id and label' });
        if (item.label.length > 200) return res.status(400).json({ error: 'Sub-item label too long (max 200)' });
      }
    }

    const result = await pool.query(
      `INSERT INTO holistic_report_templates (school_id, class_id, academic_year, domains, updated_at)
       VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (school_id, class_id, academic_year) DO UPDATE
         SET domains=EXCLUDED.domains, updated_at=now()
       RETURNING id`,
      [school_id, req.params.class_id, year, JSON.stringify(domains)],
    );

    return res.json({ id: result.rows[0].id, message: 'Template saved' });
  } catch (err) {
    console.error('[holistic-template put]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/admin/holistic-template/reports?year=&term=&class_id=
// Admin/principal view of all holistic reports for the school
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reports/list', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { year, term, class_id } = req.query as Record<string, string>;
    if (!year) return res.status(400).json({ error: 'year is required' });

    const conditions = ['hr.school_id=$1', 'hr.academic_year=$2'];
    const params: any[] = [school_id, year];

    if (term)     { conditions.push(`hr.term=$${params.length + 1}`);     params.push(term); }
    if (class_id) { conditions.push(`hr.class_id=$${params.length + 1}`); params.push(class_id); }

    const result = await pool.query(
      `SELECT hr.id, hr.student_id, hr.term, hr.status,
              hr.shared_at, hr.updated_at,
              s.name AS student_name,
              c.name AS class_name, sec.label AS section_label
       FROM holistic_reports hr
       JOIN students  s   ON s.id   = hr.student_id
       JOIN classes   c   ON c.id   = hr.class_id
       JOIN sections  sec ON sec.id = hr.section_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.name, sec.label, s.name, hr.term`,
      params,
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[holistic-template reports list]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

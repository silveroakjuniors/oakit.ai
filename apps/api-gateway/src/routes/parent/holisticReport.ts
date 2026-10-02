/**
 * routes/parent/holisticReport.ts
 * Parent read-only access to shared holistic reports for their child.
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

// ── Domain defaults (duplicated from teacher route for parent view) ────────────
const PG_NURSERY_CLASS_NAMES = new Set(['playgroup', 'play group', 'nursery', 'pg']);
function isPgNurseryClass(cn: string): boolean {
  return PG_NURSERY_CLASS_NAMES.has((cn || '').toLowerCase().trim());
}
const PG_NURSERY_DOMAINS_PARENT = [
  { id: 'social_emotional', label: '1. Social & Emotional Development', sort_order: 1, sub_items: [
    { id: 'se_01', label: 'Separates from parent comfortably', sort_order: 1 },
    { id: 'se_02', label: 'Feels comfortable in the classroom', sort_order: 2 },
    { id: 'se_03', label: 'Expresses basic emotions', sort_order: 3 },
    { id: 'se_04', label: 'Responds appropriately to emotions', sort_order: 4 },
    { id: 'se_05', label: 'Shares and takes turns', sort_order: 5 },
    { id: 'se_06', label: 'Interacts positively with peers', sort_order: 6 },
    { id: 'se_07', label: 'Shows empathy and care towards others', sort_order: 7 },
    { id: 'se_08', label: 'Seeks help appropriately', sort_order: 8 },
  ]},
  { id: 'communication_language', label: '2. Communication & Language', sort_order: 2, sub_items: [
    { id: 'cl_01', label: 'Listens and responds to simple instructions', sort_order: 1 },
    { id: 'cl_02', label: 'Expresses needs and ideas', sort_order: 2 },
    { id: 'cl_03', label: 'Uses age-appropriate vocabulary', sort_order: 3 },
    { id: 'cl_04', label: 'Participates in conversations', sort_order: 4 },
    { id: 'cl_05', label: 'Enjoys stories and storytelling', sort_order: 5 },
    { id: 'cl_06', label: 'Recites rhymes and songs', sort_order: 6 },
    { id: 'cl_07', label: 'Communicates confidently with adults and peers', sort_order: 7 },
  ]},
  { id: 'cognitive_learning', label: '3. Cognitive & Early Learning', sort_order: 3, sub_items: [
    { id: 'cg_01', label: 'Recognises colours', sort_order: 1 },
    { id: 'cg_02', label: 'Recognises basic shapes', sort_order: 2 },
    { id: 'cg_03', label: 'Demonstrates early counting skills', sort_order: 3 },
    { id: 'cg_04', label: 'Sorts and matches objects', sort_order: 4 },
    { id: 'cg_05', label: 'Identifies familiar objects', sort_order: 5 },
    { id: 'cg_06', label: 'Shows curiosity and asks questions', sort_order: 6 },
    { id: 'cg_07', label: 'Completes simple age-appropriate tasks', sort_order: 7 },
    { id: 'cg_08', label: 'Demonstrates problem-solving through play', sort_order: 8 },
  ]},
  { id: 'physical_motor', label: '4. Physical & Motor Development', sort_order: 4, sub_items: [
    { id: 'pm_g1', label: '[Gross Motor] Walks and runs with coordination', sort_order: 1 },
    { id: 'pm_g2', label: '[Gross Motor] Jumps and balances', sort_order: 2 },
    { id: 'pm_g3', label: '[Gross Motor] Participates in movement activities', sort_order: 3 },
    { id: 'pm_g4', label: '[Gross Motor] Demonstrates body awareness', sort_order: 4 },
    { id: 'pm_f1', label: '[Fine Motor] Holds and uses crayons appropriately', sort_order: 5 },
    { id: 'pm_f2', label: '[Fine Motor] Demonstrates pencil/hand control', sort_order: 6 },
    { id: 'pm_f3', label: '[Fine Motor] Uses scissors/materials with support', sort_order: 7 },
    { id: 'pm_f4', label: '[Fine Motor] Participates in threading, tearing, pasting or manipulative activities', sort_order: 8 },
  ]},
  { id: 'creativity_expression', label: '5. Creativity & Expression', sort_order: 5, sub_items: [
    { id: 'cr_01', label: 'Participates in art activities', sort_order: 1 },
    { id: 'cr_02', label: 'Explores colours and materials', sort_order: 2 },
    { id: 'cr_03', label: 'Participates in music and movement', sort_order: 3 },
    { id: 'cr_04', label: 'Uses imagination during play', sort_order: 4 },
    { id: 'cr_05', label: 'Expresses ideas creatively', sort_order: 5 },
  ]},
  { id: 'independence_life', label: '6. Independence & Life Skills', sort_order: 6, sub_items: [
    { id: 'il_01', label: 'Manages personal belongings', sort_order: 1 },
    { id: 'il_02', label: 'Follows basic hygiene routines', sort_order: 2 },
    { id: 'il_03', label: 'Eats/drinks with increasing independence', sort_order: 3 },
    { id: 'il_04', label: 'Attempts tasks independently', sort_order: 4 },
    { id: 'il_05', label: 'Follows classroom routines', sort_order: 5 },
    { id: 'il_06', label: 'Keeps belongings/materials in place', sort_order: 6 },
    { id: 'il_07', label: 'Demonstrates awareness of basic safety', sort_order: 7 },
  ]},
  { id: 'classroom_participation', label: '7. Classroom Participation & Learning Habits', sort_order: 7, sub_items: [
    { id: 'cp_01', label: 'Participates in classroom activities', sort_order: 1 },
    { id: 'cp_02', label: 'Follows simple instructions', sort_order: 2 },
    { id: 'cp_03', label: 'Maintains attention during activities', sort_order: 3 },
    { id: 'cp_04', label: 'Shows willingness to try new activities', sort_order: 4 },
    { id: 'cp_05', label: 'Participates in group activities', sort_order: 5 },
    { id: 'cp_06', label: 'Transitions between activities with support', sort_order: 6 },
  ]},
];
const STANDARD_DOMAINS_PARENT = [
  { id: 'social_emotional', label: 'Social / Emotional Development', sort_order: 1, sub_items: [
    { id: 'se_01', label: 'Adjusts well to school environment', sort_order: 1 },
    { id: 'se_02', label: 'Shares and takes turns with peers', sort_order: 2 },
    { id: 'se_03', label: 'Shows confidence and self-expression', sort_order: 3 },
    { id: 'se_04', label: 'Follows classroom rules and routines', sort_order: 4 },
    { id: 'se_05', label: 'Interacts positively with teachers and peers', sort_order: 5 },
  ]},
  { id: 'physical', label: 'Physical Development', sort_order: 2, sub_items: [
    { id: 'ph_01', label: 'Fine motor skills (holding pencil, cutting)', sort_order: 1 },
    { id: 'ph_02', label: 'Gross motor skills (running, jumping)', sort_order: 2 },
    { id: 'ph_03', label: 'Hand-eye coordination', sort_order: 3 },
    { id: 'ph_04', label: 'Personal hygiene and self-care habits', sort_order: 4 },
  ]},
  { id: 'speaking_listening', label: 'Speaking / Listening Skills', sort_order: 3, sub_items: [
    { id: 'sl_01', label: 'Listens attentively and follows instructions', sort_order: 1 },
    { id: 'sl_02', label: 'Speaks clearly and expresses ideas', sort_order: 2 },
    { id: 'sl_03', label: 'Participates in class discussions and rhymes', sort_order: 3 },
    { id: 'sl_04', label: 'Responds appropriately to questions', sort_order: 4 },
  ]},
  { id: 'reading_writing', label: 'Reading / Writing Skills', sort_order: 4, sub_items: [
    { id: 'rw_01', label: 'Recognises letters and their sounds', sort_order: 1 },
    { id: 'rw_02', label: 'Attempts to read simple words/sentences', sort_order: 2 },
    { id: 'rw_03', label: 'Writes letters and words with correct form', sort_order: 3 },
    { id: 'rw_04', label: 'Shows interest in books and stories', sort_order: 4 },
  ]},
  { id: 'numeracy', label: 'Numeracy Skills', sort_order: 5, sub_items: [
    { id: 'nu_01', label: 'Number recognition and counting', sort_order: 1 },
    { id: 'nu_02', label: 'Understands basic concepts (more/less, big/small)', sort_order: 2 },
    { id: 'nu_03', label: 'Pattern recognition and sorting', sort_order: 3 },
    { id: 'nu_04', label: 'Simple addition and subtraction (age-appropriate)', sort_order: 4 },
  ]},
  { id: 'character_values', label: 'Character & Values', sort_order: 6, sub_items: [
    { id: 'cv_01', label: 'Shows honesty and truthfulness', sort_order: 1 },
    { id: 'cv_02', label: 'Demonstrates kindness and empathy', sort_order: 2 },
    { id: 'cv_03', label: 'Respects elders, teachers and classmates', sort_order: 3 },
    { id: 'cv_04', label: 'Takes responsibility for belongings and tasks', sort_order: 4 },
  ]},
];

// ── Helper: resolve student IDs this parent can access ───────────────────────
// Primary: parent_student_links. Fallback: match parent_users.mobile against
// students.parent_contact / mother_contact (handles unlinked parents).
async function resolveParentStudentIds(parentId: string, schoolId: string): Promise<string[]> {
  const links = await pool.query(
    `SELECT student_id FROM parent_student_links WHERE parent_id=$1`,
    [parentId],
  );
  if (links.rows.length > 0) {
    return links.rows.map((r: any) => r.student_id);
  }

  // Fallback: look up by mobile number
  const puRow = await pool.query(
    `SELECT mobile FROM parent_users WHERE id=$1 AND school_id=$2`,
    [parentId, schoolId],
  );
  if (!puRow.rows.length) return [];
  const mobile = puRow.rows[0].mobile;

  const students = await pool.query(
    `SELECT id FROM students
     WHERE school_id=$1 AND is_active=true
       AND (parent_contact=$2 OR mother_contact=$2)`,
    [schoolId, mobile],
  );
  const studentIds = students.rows.map((r: any) => r.id);

  // Auto-create missing links
  for (const sid of studentIds) {
    await pool.query(
      `INSERT INTO parent_student_links (parent_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [parentId, sid],
    ).catch(() => {});
  }

  return studentIds;
}
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    // Get all children linked to this parent — with contact-number fallback
    const studentIds = await resolveParentStudentIds(user_id, school_id);
    if (!studentIds.length) return res.json([]);

    const result = await pool.query(
      `SELECT hr.id, hr.student_id, hr.term, hr.academic_year,
              hr.shared_at, hr.updated_at,
              s.name AS student_name,
              c.name AS class_name, sec.label AS section_label
       FROM holistic_reports hr
       JOIN students  s   ON s.id   = hr.student_id
       JOIN classes   c   ON c.id   = hr.class_id
       JOIN sections  sec ON sec.id = hr.section_id
       WHERE hr.student_id = ANY($1::uuid[])
         AND hr.school_id = $2
         AND hr.status = 'shared'
       ORDER BY hr.academic_year DESC, hr.shared_at DESC`,
      [studentIds, school_id],
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[parent holistic-report list]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/parent/holistic-report/:id
// View a specific shared report (full details)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    // Resolve student IDs this parent can access — with contact fallback
    const studentIds = await resolveParentStudentIds(user_id, school_id);

    const report = await pool.query(
      `SELECT hr.*,
              s.name AS student_name,
              c.name AS class_name, c.id AS class_id,
              sec.label AS section_label,
              sch.name AS school_name
       FROM holistic_reports hr
       JOIN students  s   ON s.id   = hr.student_id
       JOIN classes   c   ON c.id   = hr.class_id
       JOIN sections  sec ON sec.id = hr.section_id
       JOIN schools   sch ON sch.id = hr.school_id
       WHERE hr.id=$1
         AND hr.school_id=$2
         AND hr.status='shared'
         ${studentIds.length > 0 ? 'AND hr.student_id=ANY($3::uuid[])' : ''}`,
      studentIds.length > 0
        ? [req.params.id, school_id, studentIds]
        : [req.params.id, school_id],
    );

    if (!report.rows.length) return res.status(404).json({ error: 'Report not found' });
    const r = report.rows[0];

    // Load domains from template — fall back to built-in defaults if no template
    const templateRow = await pool.query(
      `SELECT domains FROM holistic_report_templates
       WHERE school_id=$1 AND class_id=$2 AND academic_year=$3`,
      [school_id, r.class_id, r.academic_year],
    );
    const domains = templateRow.rows[0]?.domains
      ?? (isPgNurseryClass(r.class_name) ? PG_NURSERY_DOMAINS_PARENT : STANDARD_DOMAINS_PARENT);

    // Compute attendance + homework stats using calendar working days as denominator
    // Include special days (settling period, events, etc.) — exclude only Sat/Sun + holidays
    let attendanceStats = null;
    let homeworkStats = null;
    try {
      const calRow = await pool.query(
        `SELECT start_date, working_days FROM school_calendar WHERE school_id=$1 ORDER BY start_date DESC LIMIT 1`,
        [school_id],
      );
      const today = new Date().toISOString().split('T')[0];
      const startDate = calRow.rows[0]?.start_date
        ? new Date(calRow.rows[0].start_date).toISOString().split('T')[0]
        : '2026-06-01';
      const workingDayNums: number[] = calRow.rows[0]?.working_days || [1, 2, 3, 4, 5];

      // Fetch only declared school holidays (NOT special days — special days are school events)
      const holidayRows = await pool.query(
        `SELECT holiday_date FROM holidays
         WHERE school_id=$1 AND holiday_date BETWEEN $2::date AND $3::date`,
        [school_id, startDate, today],
      );
      const holidaySet = new Set(
        holidayRows.rows.map((h: any) => new Date(h.holiday_date).toISOString().split('T')[0]),
      );

      // Count calendar working days (includes special days like settling period, sports day, events)
      // Only exclude Sat/Sun + declared school holidays
      let calWorkingDays = 0;
      const s = new Date(startDate + 'T12:00:00');
      const e = new Date(today + 'T12:00:00');
      for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay() === 0 ? 7 : d.getDay(); // 1=Mon ... 7=Sun
        const ds  = d.toISOString().split('T')[0];
        if (workingDayNums.includes(dow) && !holidaySet.has(ds)) calWorkingDays++;
      }
      calWorkingDays = Math.max(calWorkingDays, 1);

      const attRow = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status='present')::int AS present,
           COUNT(*) FILTER (WHERE status='absent')::int  AS absent
         FROM attendance_records
         WHERE student_id=$1 AND attend_date BETWEEN $2::date AND $3::date`,
        [r.student_id, startDate, today],
      );
      const att = attRow.rows[0] || { present: 0, absent: 0 };
      attendanceStats = {
        present: att.present,
        total: calWorkingDays,
        pct: Math.round((att.present / calWorkingDays) * 100),
      };

      const hwRow = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status='completed')::int     AS completed,
           COUNT(*) FILTER (WHERE status='not_submitted')::int AS not_submitted,
           COUNT(*)::int                                        AS total_recorded
         FROM homework_submissions
         WHERE student_id=$1 AND homework_date BETWEEN $2::date AND $3::date`,
        [r.student_id, startDate, today],
      );
      const hw = hwRow.rows[0] || { completed: 0, not_submitted: 0, total_recorded: 0 };
      homeworkStats = {
        completed: hw.completed,
        total: hw.total_recorded,
        pct: hw.total_recorded > 0 ? Math.round((hw.completed / hw.total_recorded) * 100) : null,
      };
    } catch { /* stats are optional — don't fail the whole request */ }

    return res.json({ ...r, domains, attendanceStats, homeworkStats });
  } catch (err) {
    console.error('[parent holistic-report get]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

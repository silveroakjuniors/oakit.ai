/**
 * routes/teacher/holisticReport.ts
 * Holistic Progress Report â€” two formats:
 *   - 'pg_nursery' : Playgroup & Nursery â€” Silver Oak Juniors format with Growth Statements
 *   - 'standard'   : Jr. KG / Sr. KG â€” NCFES format with E/V/G/S/P ratings
 *
 * DB rating codes (Option B â€” same codes, different display per format):
 *   E = Exploring     (pg_nursery) / Excellent   (standard)
 *   V = Growing       (pg_nursery) / Very Good    (standard)
 *   G = Becoming      (pg_nursery) / Good         (standard)
 *   S = Independent   (pg_nursery) / Satisfactory (standard)
 *   P = Progressive   (standard only)
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import PDFDocument from 'pdfkit';
import {
  MARGIN, CONTENT_WIDTH, PAGE_WIDTH,
  collectBuffer,
} from '../../lib/pdf/base';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher', 'principal', 'admin'));

const VALID_RATINGS = new Set(['E', 'V', 'G', 'S', 'P', 'B', 'I', '']);

// â”€â”€ Which class names use the PG/Nursery format â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PG_NURSERY_CLASS_NAMES = new Set(['playgroup', 'play group', 'nursery', 'pg']);
function isPgNurseryClass(className: string): boolean {
  return PG_NURSERY_CLASS_NAMES.has((className || '').toLowerCase().trim());
}

// â”€â”€ Growth Statement scale (pg_nursery format) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const GROWTH_STATEMENTS = [
  { code: 'E', icon: 'Exploring',        statement: 'I am beginning to discover this.' },
  { code: 'V', icon: 'Growing',          statement: 'I am developing this with encouragement.' },
  { code: 'G', icon: 'Becoming Confident', statement: 'I am using this skill more consistently.' },
  { code: 'S', icon: 'Independent',      statement: 'I can use this skill confidently on my own.' },
] as const;

// â”€â”€ Domain defaults: Playgroup / Nursery (7 domains per spec) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PG_NURSERY_DOMAINS = [
  {
    id: 'social_emotional', label: '1. Social & Emotional Development', sort_order: 1,
    sub_items: [
      { id: 'se_01', label: 'Separates from parent comfortably',         sort_order: 1 },
      { id: 'se_02', label: 'Feels comfortable in the classroom',        sort_order: 2 },
      { id: 'se_03', label: 'Expresses basic emotions',                  sort_order: 3 },
      { id: 'se_04', label: 'Responds appropriately to emotions',        sort_order: 4 },
      { id: 'se_05', label: 'Shares and takes turns',                    sort_order: 5 },
      { id: 'se_06', label: 'Interacts positively with peers',           sort_order: 6 },
      { id: 'se_07', label: 'Shows empathy and care towards others',     sort_order: 7 },
      { id: 'se_08', label: 'Seeks help appropriately',                  sort_order: 8 },
    ],
  },
  {
    id: 'communication_language', label: '2. Communication & Language', sort_order: 2,
    sub_items: [
      { id: 'cl_01', label: 'Listens and responds to simple instructions',           sort_order: 1 },
      { id: 'cl_02', label: 'Expresses needs and ideas',                             sort_order: 2 },
      { id: 'cl_03', label: 'Uses age-appropriate vocabulary',                       sort_order: 3 },
      { id: 'cl_04', label: 'Participates in conversations',                         sort_order: 4 },
      { id: 'cl_05', label: 'Enjoys stories and storytelling',                       sort_order: 5 },
      { id: 'cl_06', label: 'Recites rhymes and songs',                              sort_order: 6 },
      { id: 'cl_07', label: 'Communicates confidently with adults and peers',        sort_order: 7 },
    ],
  },
  {
    id: 'cognitive_learning', label: '3. Cognitive & Early Learning', sort_order: 3,
    sub_items: [
      { id: 'cg_01', label: 'Recognises colours',                          sort_order: 1 },
      { id: 'cg_02', label: 'Recognises basic shapes',                     sort_order: 2 },
      { id: 'cg_03', label: 'Demonstrates early counting skills',          sort_order: 3 },
      { id: 'cg_04', label: 'Sorts and matches objects',                   sort_order: 4 },
      { id: 'cg_05', label: 'Identifies familiar objects',                 sort_order: 5 },
      { id: 'cg_06', label: 'Shows curiosity and asks questions',          sort_order: 6 },
      { id: 'cg_07', label: 'Completes simple age-appropriate tasks',      sort_order: 7 },
      { id: 'cg_08', label: 'Demonstrates problem-solving through play',   sort_order: 8 },
    ],
  },
  {
    id: 'physical_motor', label: '4. Physical & Motor Development', sort_order: 4,
    sub_items: [
      // Gross Motor
      { id: 'pm_g1', label: '[Gross Motor] Walks and runs with coordination',                            sort_order: 1 },
      { id: 'pm_g2', label: '[Gross Motor] Jumps and balances',                                          sort_order: 2 },
      { id: 'pm_g3', label: '[Gross Motor] Participates in movement activities',                         sort_order: 3 },
      { id: 'pm_g4', label: '[Gross Motor] Demonstrates body awareness',                                 sort_order: 4 },
      // Fine Motor
      { id: 'pm_f1', label: '[Fine Motor] Holds and uses crayons appropriately',                         sort_order: 5 },
      { id: 'pm_f2', label: '[Fine Motor] Demonstrates pencil/hand control',                             sort_order: 6 },
      { id: 'pm_f3', label: '[Fine Motor] Uses scissors/materials with support',                         sort_order: 7 },
      { id: 'pm_f4', label: '[Fine Motor] Participates in threading, tearing, pasting or manipulative activities', sort_order: 8 },
    ],
  },
  {
    id: 'creativity_expression', label: '5. Creativity & Expression', sort_order: 5,
    sub_items: [
      { id: 'cr_01', label: 'Participates in art activities',      sort_order: 1 },
      { id: 'cr_02', label: 'Explores colours and materials',      sort_order: 2 },
      { id: 'cr_03', label: 'Participates in music and movement',  sort_order: 3 },
      { id: 'cr_04', label: 'Uses imagination during play',        sort_order: 4 },
      { id: 'cr_05', label: 'Expresses ideas creatively',          sort_order: 5 },
    ],
  },
  {
    id: 'independence_life', label: '6. Independence & Life Skills', sort_order: 6,
    sub_items: [
      { id: 'il_01', label: 'Manages personal belongings',                   sort_order: 1 },
      { id: 'il_02', label: 'Follows basic hygiene routines',                sort_order: 2 },
      { id: 'il_03', label: 'Eats/drinks with increasing independence',      sort_order: 3 },
      { id: 'il_04', label: 'Attempts tasks independently',                  sort_order: 4 },
      { id: 'il_05', label: 'Follows classroom routines',                    sort_order: 5 },
      { id: 'il_06', label: 'Keeps belongings/materials in place',           sort_order: 6 },
      { id: 'il_07', label: 'Demonstrates awareness of basic safety',        sort_order: 7 },
    ],
  },
  {
    id: 'classroom_participation', label: '7. Classroom Participation & Learning Habits', sort_order: 7,
    sub_items: [
      { id: 'cp_01', label: 'Participates in classroom activities',           sort_order: 1 },
      { id: 'cp_02', label: 'Follows simple instructions',                    sort_order: 2 },
      { id: 'cp_03', label: 'Maintains attention during activities',          sort_order: 3 },
      { id: 'cp_04', label: 'Shows willingness to try new activities',        sort_order: 4 },
      { id: 'cp_05', label: 'Participates in group activities',               sort_order: 5 },
      { id: 'cp_06', label: 'Transitions between activities with support',    sort_order: 6 },
    ],
  },
];

// â”€â”€ Standard domain defaults (Jr.KG / Sr.KG â€” 6 domains) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STANDARD_DOMAINS = [
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
      { id: 'nu_01', label: 'Number recognition and counting',                    sort_order: 1 },
      { id: 'nu_02', label: 'Understands basic concepts (more/less, big/small)',  sort_order: 2 },
      { id: 'nu_03', label: 'Pattern recognition and sorting',                    sort_order: 3 },
      { id: 'nu_04', label: 'Simple addition and subtraction (age-appropriate)',  sort_order: 4 },
    ],
  },
  {
    id: 'character_values', label: 'Character & Values', sort_order: 6,
    sub_items: [
      { id: 'cv_01', label: 'Shows honesty and truthfulness',                sort_order: 1 },
      { id: 'cv_02', label: 'Demonstrates kindness and empathy',             sort_order: 2 },
      { id: 'cv_03', label: 'Respects elders, teachers and classmates',      sort_order: 3 },
      { id: 'cv_04', label: 'Takes responsibility for belongings and tasks', sort_order: 4 },
    ],
  },
];

function getDefaultDomains(className: string) {
  return isPgNurseryClass(className) ? PG_NURSERY_DOMAINS : STANDARD_DOMAINS;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/v1/teacher/holistic-report/students
// List students in teacher's assigned sections with class info
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/students', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const sections = await getTeacherSections(user_id, school_id);
    if (!sections.length) return res.json([]);
    const sectionIds = sections.map((s: any) => s.section_id);

    const result = await pool.query(
      `SELECT s.id, s.name,
              c.id AS class_id, c.name AS class_name,
              sec.id AS section_id, sec.label AS section_label
       FROM students s
       JOIN classes  c   ON c.id  = s.class_id
       JOIN sections sec ON sec.id = s.section_id
       WHERE s.section_id = ANY($1::uuid[])
         AND s.school_id = $2
         AND s.is_active = true
       ORDER BY c.name, sec.label, s.name`,
      [sectionIds, school_id],
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[holistic-report students]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/v1/teacher/holistic-report/template/:class_id?year=2026-27
// Fetch the domain template for this class (creates default scaffold if absent)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/template/:class_id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { class_id } = req.params;
    const year = (req.query.year as string) || '';
    const classRowEarly = await pool.query('SELECT name FROM classes WHERE id=$1', [class_id]);
    const classNameEarly = classRowEarly.rows[0]?.name || '';
    if (!year) return res.json({ domains: getDefaultDomains(classNameEarly) });

    const row = await pool.query(
      `SELECT domains FROM holistic_report_templates
       WHERE school_id=$1 AND class_id=$2 AND academic_year=$3`,
      [school_id, class_id, year],
    );

    if (row.rows.length > 0) {
      return res.json({ domains: row.rows[0].domains });
    }

    // Determine which default to return based on class name
    const classRow = await pool.query('SELECT name FROM classes WHERE id=$1', [class_id]);
    const className = classRow.rows[0]?.name || '';
    return res.json({ domains: getDefaultDomains(className) });
  } catch (err) {
    console.error('[holistic-report template get]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/v1/teacher/holistic-report/subjects/:class_id
// Returns distinct subjects for this class from curriculum_resources
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/subjects/:class_id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT DISTINCT subject
       FROM curriculum_resources
       WHERE school_id=$1 AND class_id=$2 AND subject IS NOT NULL
       ORDER BY subject`,
      [school_id, req.params.class_id],
    );
    const subjects = result.rows.map((r: any) => r.subject as string);

    // For Jr.KG / Sr.KG: rename Regional Language → Kannada
    const classRow = await pool.query('SELECT name FROM classes WHERE id=$1', [req.params.class_id]);
    const className = (classRow.rows[0]?.name || '').toLowerCase();
    const isKgClass = ['jr. kg','jr.kg','jrkg','junior kg','lkg','sr. kg','sr.kg','srkg','senior kg','ukg'].includes(className);

    const finalSubjects = isKgClass
      ? subjects.map(s => s.toLowerCase().includes('regional') ? 'Kannada' : s)
          .filter((s, i, arr) => arr.indexOf(s) === i) // dedupe
      : subjects;

    // Add Kannada if not present for KG classes
    if (isKgClass && !finalSubjects.includes('Kannada')) finalSubjects.push('Kannada');

    // Fallback: if KG class has no curriculum resources, use standard subject list
    const KG_DEFAULT_SUBJECTS = ['English Speaking', 'English', 'Math', 'GK', 'Writing', 'Kannada'];
    const resultSubjects = isKgClass && finalSubjects.length <= 1
      ? KG_DEFAULT_SUBJECTS
      : (isKgClass ? finalSubjects : subjects);

    return res.json({ subjects: resultSubjects });
  } catch (err) {
    console.error('[holistic-report subjects]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/v1/teacher/holistic-report/:student_id/:term?year=2026-27
// Load existing report or return blank scaffold
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/stats/:student_id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { student_id } = req.params;
    const to = (req.query.to as string) || new Date().toISOString().split('T')[0];

    const studentRow = await pool.query(
      'SELECT section_id FROM students WHERE id=$1 AND school_id=$2',
      [student_id, school_id],
    );
    if (!studentRow.rows.length) return res.status(404).json({ error: 'Student not found' });

    const calRow = await pool.query(
      `SELECT start_date, working_days FROM school_calendar WHERE school_id=$1 ORDER BY start_date DESC LIMIT 1`,
      [school_id],
    );
    const effectiveFrom = (req.query.from as string) ||
      (calRow.rows[0]?.start_date ? new Date(calRow.rows[0].start_date).toISOString().split('T')[0] : '2026-06-01');

    // Count actual working days in the range — exclude ONLY Sat/Sun and declared holidays
    // Special days (settling period, sports day, events etc.) ARE working days for attendance purposes
    const workingDayNums: number[] = calRow.rows[0]?.working_days || [1,2,3,4,5];
    const holidayRows = await pool.query(
      `SELECT holiday_date FROM holidays WHERE school_id=$1 AND holiday_date BETWEEN $2::date AND $3::date`,
      [school_id, effectiveFrom, to],
    );
    const holidaySet = new Set(holidayRows.rows.map((r: any) => new Date(r.holiday_date).toISOString().split('T')[0]));
    let calWorkingDays = 0;
    const startD = new Date(effectiveFrom + 'T12:00:00');
    const endD   = new Date(to + 'T12:00:00');
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      const ds  = d.toISOString().split('T')[0];
      if (workingDayNums.includes(dow) && !holidaySet.has(ds)) calWorkingDays++;
    }
    calWorkingDays = Math.max(calWorkingDays, 1);

    const attRow = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'present')::int AS present_days,
         COUNT(*) FILTER (WHERE status = 'absent')::int  AS absent_days,
         COUNT(*)::int                                    AS total_days
       FROM attendance_records
       WHERE student_id=$1 AND attend_date BETWEEN $2::date AND $3::date`,
      [student_id, effectiveFrom, to],
    );
    const att = attRow.rows[0] || { present_days: 0, absent_days: 0, total_days: 0 };

    const hwRow = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'completed')::int     AS completed,
         COUNT(*) FILTER (WHERE status = 'partial')::int       AS partial,
         COUNT(*) FILTER (WHERE status = 'not_submitted')::int AS not_submitted,
         COUNT(*)::int                                          AS total_recorded
       FROM homework_submissions
       WHERE student_id=$1 AND homework_date BETWEEN $2::date AND $3::date`,
      [student_id, effectiveFrom, to],
    );
    const hw = hwRow.rows[0] || { completed: 0, partial: 0, not_submitted: 0, total_recorded: 0 };

    // Homework: use only recorded homework days as denominator.
    // "Missed" = explicitly marked not_submitted, not days without any record.
    // This gives "homework given vs completion" not "working days vs completion".
    const hwDenominator = Math.max(hw.total_recorded, 1);
    const hwPct = hw.total_recorded > 0
      ? Math.round((hw.completed / hwDenominator) * 100)
      : null;
    const hwNotSubmitted = hw.not_submitted;

    return res.json({
      from: effectiveFrom, to,
      attendance: {
        present: att.present_days, absent: att.absent_days,
        // Use calendar working days as total — consistent with attendance tracker
        total: calWorkingDays,
        pct: calWorkingDays > 0 ? Math.round((att.present_days / calWorkingDays) * 100) : null,
        label: `${att.present_days}/${calWorkingDays} days`,
      },
      homework: {
        completed: hw.completed, partial: hw.partial,
        not_submitted: hwNotSubmitted,
        total: hwDenominator,
        pct: hwPct,
      },
    });
  } catch (err) {
    console.error('[holistic-report stats]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:student_id/:term', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id, term } = req.params;

    // Guard: skip reserved path segments that belong to other routes
    const RESERVED = new Set(['list', 'save', 'reformat-comment', 'students', 'template', 'subjects', 'stats']);
    if (RESERVED.has(student_id) || term === 'pdf') {
      return res.status(404).json({ error: 'Not found' });
    }

    let year = (req.query.year as string) || '';

    // Auto-detect year if not provided — use the report's own year or calendar
    if (!year) {
      // First try to find an existing report for this student+term
      const existingReport = await pool.query(
        `SELECT academic_year FROM holistic_reports WHERE student_id=$1 AND term=$2 AND school_id=$3 ORDER BY updated_at DESC LIMIT 1`,
        [student_id, term, school_id],
      );
      if (existingReport.rows.length > 0) {
        year = existingReport.rows[0].academic_year;
      } else {
        // Fall back to calendar
        const calRow = await pool.query(
          `SELECT academic_year FROM school_calendar WHERE school_id=$1 ORDER BY start_date DESC LIMIT 1`,
          [school_id],
        );
        year = calRow.rows[0]?.academic_year || '';
      }
      if (!year) return res.status(400).json({ error: 'year is required' });
    }

    if (!['mid_term', 'final_term'].includes(term)) {
      return res.status(400).json({ error: 'term must be mid_term or final_term' });
    }

    // Verify teacher has access to this student (unless principal/admin)
    const role = (req.user as any).role;
    if (!['principal', 'admin'].includes(role)) {
      const sections = await getTeacherSections(user_id, school_id);
      const sectionIds = sections.map((s: any) => s.section_id);
      const check = await pool.query(
        `SELECT 1 FROM students WHERE id=$1 AND section_id=ANY($2::uuid[]) AND school_id=$3`,
        [student_id, sectionIds, school_id],
      );
      if (!check.rows.length) return res.status(403).json({ error: 'Student not in your class' });
    }

    const report = await pool.query(
      `SELECT hr.*,
              s.name AS student_name,
              c.name AS class_name, c.id AS class_id,
              sec.label AS section_label
       FROM holistic_reports hr
       JOIN students  s   ON s.id   = hr.student_id
       JOIN classes   c   ON c.id   = hr.class_id
       JOIN sections  sec ON sec.id = hr.section_id
       WHERE hr.student_id=$1 AND (hr.academic_year=$2 OR hr.academic_year=$3) AND hr.term=$4 AND hr.school_id=$5`,
      [
        student_id,
        year,
        /^\d{4}-\d{2}$/.test(year) ? year.replace(/^(\d{4})-(\d{2})$/, '$1-20$2') : year.replace(/^(\d{4})-20(\d{2})$/, '$1-$2'),
        term,
        school_id,
      ],
    );

    if (report.rows.length > 0) {
      return res.json(report.rows[0]);
    }

    // Return blank scaffold for a new report
    const student = await pool.query(
      `SELECT s.id, s.name,
              c.id AS class_id, c.name AS class_name,
              sec.id AS section_id, sec.label AS section_label
       FROM students s
       JOIN classes  c   ON c.id  = s.class_id
       JOIN sections sec ON sec.id = s.section_id
       WHERE s.id=$1 AND s.school_id=$2`,
      [student_id, school_id],
    );
    if (!student.rows.length) return res.status(404).json({ error: 'Student not found' });

    const st = student.rows[0];
    return res.json({
      id: null,
      student_id,
      student_name: st.name,
      class_id: st.class_id,
      class_name: st.class_name,
      section_id: st.section_id,
      section_label: st.section_label,
      academic_year: year,
      term,
      status: 'draft',
      developmental_ratings: {},
      subject_grades: {},
      teacher_comment_raw: '',
      teacher_comment: '',
    });
  } catch (err) {
    console.error('[holistic-report get]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/v1/teacher/holistic-report/save
// Create or update a draft report
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/save', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const {
      student_id, academic_year, term,
      developmental_ratings = {}, subject_grades = {},
      teacher_comment_raw = '', teacher_comment = '',
      // Playgroup/Nursery extra fields
      strengths = null, developing_skills = null,
      at_school_support = null, at_home_support = null,
      silver_oak_moment = null, attendance = null,
    } = req.body;

    if (!student_id || !term) {
      return res.status(400).json({ error: 'student_id and term required' });
    }
    if (!['mid_term', 'final_term'].includes(term)) {
      return res.status(400).json({ error: 'term must be mid_term or final_term' });
    }

    // Auto-detect academic year from school calendar if not provided
    let resolvedYear = academic_year;
    if (!resolvedYear) {
      const calRow = await pool.query(
        `SELECT academic_year FROM school_calendar
         WHERE school_id=$1 AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
         ORDER BY start_date DESC LIMIT 1`,
        [school_id],
      );
      resolvedYear = calRow.rows[0]?.academic_year || '';
      if (!resolvedYear) {
        // Fallback: most recent calendar year
        const latestCal = await pool.query(
          'SELECT academic_year FROM school_calendar WHERE school_id=$1 ORDER BY start_date DESC LIMIT 1',
          [school_id],
        );
        resolvedYear = latestCal.rows[0]?.academic_year || '';
      }
      if (!resolvedYear) return res.status(400).json({ error: 'Could not determine academic year — please contact admin to set up the school calendar' });
    }

    // Validate ratings
    for (const domainRatings of Object.values(developmental_ratings as Record<string, any>)) {
      for (const val of Object.values(domainRatings as Record<string, string>)) {
        if (!VALID_RATINGS.has(val)) return res.status(400).json({ error: `Invalid rating: ${val}` });
      }
    }
    for (const val of Object.values(subject_grades as Record<string, string>)) {
      if (!VALID_RATINGS.has(val)) return res.status(400).json({ error: `Invalid grade: ${val}` });
    }

    // Verify teacher access
    const sections = await getTeacherSections(user_id, school_id);
    const sectionIds = sections.map((s: any) => s.section_id);
    const student = await pool.query(
      `SELECT s.id, s.section_id, s.class_id, c.name AS class_name
       FROM students s
       JOIN classes c ON c.id = s.class_id
       WHERE s.id=$1 AND s.section_id=ANY($2::uuid[]) AND s.school_id=$3`,
      [student_id, sectionIds, school_id],
    );
    if (!student.rows.length) return res.status(403).json({ error: 'Student not in your class' });
    const { section_id, class_id, class_name } = student.rows[0];

    // Determine report format
    const report_format = isPgNurseryClass(class_name) ? 'pg_nursery' : 'standard';

    const result = await pool.query(
      `INSERT INTO holistic_reports
         (school_id, student_id, section_id, class_id, academic_year, term, teacher_id,
          developmental_ratings, subject_grades,
          teacher_comment_raw, teacher_comment,
          strengths, developing_skills, at_school_support, at_home_support,
          silver_oak_moment, attendance, report_format,
          status, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'draft',now())
       ON CONFLICT (student_id, academic_year, term) DO UPDATE
         SET developmental_ratings  = EXCLUDED.developmental_ratings,
             subject_grades         = EXCLUDED.subject_grades,
             teacher_comment_raw    = EXCLUDED.teacher_comment_raw,
             teacher_comment        = EXCLUDED.teacher_comment,
             strengths              = EXCLUDED.strengths,
             developing_skills      = EXCLUDED.developing_skills,
             at_school_support      = EXCLUDED.at_school_support,
             at_home_support        = EXCLUDED.at_home_support,
             silver_oak_moment      = EXCLUDED.silver_oak_moment,
             attendance             = EXCLUDED.attendance,
             report_format          = EXCLUDED.report_format,
             teacher_id             = EXCLUDED.teacher_id,
             updated_at             = now()
       RETURNING id`,
      [
        school_id, student_id, section_id, class_id, resolvedYear, term, user_id,
        JSON.stringify(developmental_ratings), JSON.stringify(subject_grades),
        teacher_comment_raw, teacher_comment,
        strengths, developing_skills, at_school_support, at_home_support,
        silver_oak_moment, attendance, report_format,
      ],
    );

    return res.json({ id: result.rows[0].id, academic_year: resolvedYear, message: 'Draft saved' });
  } catch (err) {
    console.error('[holistic-report save]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /api/v1/teacher/holistic-report/reformat-comment
// Oakie reformats teacher's raw comment into polished 3-4 sentences
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/reformat-comment', async (req: Request, res: Response) => {
  try {
    const { student_name, raw_comment, field_type } = req.body;
    if (!raw_comment?.trim()) return res.status(400).json({ error: 'raw_comment required' });
    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const axios = (await import('axios')).default;
    const n = (student_name || 'the child').split(' ')[0];
    const pfx: Record<string, string> = {
      strengths:        `Write 1-2 short warm sentences (max 30 words) about what ${n} does well at school. Plain text only. No feedback tone.`,
      developing_skills:`Write 1-2 short sentences (max 30 words) about a skill ${n} is currently working on. Encouraging, forward-looking. Plain text only.`,
      at_school:        `Write 1-2 short practical sentences (max 30 words) on what teachers will do at school to support ${n}. Action-oriented. Plain text only.`,
      atschool:         `Write 1-2 short practical sentences (max 30 words) on what teachers will do at school to support ${n}. Action-oriented. Plain text only.`,
      at_home:          `Write 1-2 short friendly sentences (max 30 words) on simple things parents can do at home to support ${n}. Practical. Plain text only.`,
      athome:           `Write 1-2 short friendly sentences (max 30 words) on simple things parents can do at home to support ${n}. Practical. Plain text only.`,
      silver_moment:    `Write 1 warm sentence (max 25 words) about a special moment or achievement for ${n} this term. Celebratory, not feedback. Plain text only.`,
      silvermoment:     `Write 1 warm sentence (max 25 words) about a special moment or achievement for ${n} this term. Celebratory, not feedback. Plain text only.`,
    };
    const base = pfx[field_type] || `Rewrite as 2-3 warm professional sentences (max 60 words) for ${n}'s progress report. Plain text only.`;
    const prompt = base + ' Notes to use: ' + raw_comment.trim();
    const r = await axios.post(AI_URL + '/internal/generate-report', { prompt, student_name: n, structured: false }, { timeout: 30000 });
    const comment = ((r.data?.response || '').trim().replace(/[*]+/g, '')).trim();
    if (!comment) return res.status(500).json({ error: 'Could not generate text' });
    return res.json({ comment });
  } catch (err: any) {
    console.error('[holistic-report reformat]', err);
    return res.status(500).json({ error: 'Failed to reformat' });
  }
});

router.post('/:id/share', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { id } = req.params;
    const reportRow = await pool.query(
      `SELECT hr.*, s.name AS student_name, c.name AS class_name
       FROM holistic_reports hr
       JOIN students s ON s.id = hr.student_id
       JOIN classes  c ON c.id = hr.class_id
       WHERE hr.id=$1 AND hr.school_id=$2`,
      [id, school_id],
    );
    if (!reportRow.rows.length) return res.status(404).json({ error: 'Report not found' });
    const report = reportRow.rows[0];
    if (report.teacher_id !== user_id && !['principal', 'admin'].includes((req.user as any).role)) {
      return res.status(403).json({ error: 'Not authorised to share this report' });
    }
    await pool.query(
      `UPDATE holistic_reports
       SET status='shared', shared_at=now(), shared_by=$1, updated_at=now()
       WHERE id=$2`,
      [user_id, id],
    );
    const parents = await pool.query(
      `SELECT DISTINCT psl.parent_id
       FROM parent_student_links psl
       WHERE psl.student_id=$1`,
      [report.student_id],
    );

    // Fallback: if no links found, try looking up parents by student's contact number
    // (handles case where bulk-activate was not yet run but parent_users exists)
    let parentIds: string[] = parents.rows.map((p: any) => p.parent_id);
    if (parentIds.length === 0) {
      const studentContacts = await pool.query(
        `SELECT parent_contact, mother_contact FROM students WHERE id=$1`,
        [report.student_id],
      );
      const contacts: string[] = [];
      if (studentContacts.rows[0]?.parent_contact) contacts.push(studentContacts.rows[0].parent_contact);
      if (studentContacts.rows[0]?.mother_contact) contacts.push(studentContacts.rows[0].mother_contact);

      if (contacts.length > 0) {
        const puRows = await pool.query(
          `SELECT id FROM parent_users WHERE mobile = ANY($1::text[]) AND school_id=$2 AND is_active=true`,
          [contacts, school_id],
        );
        parentIds = puRows.rows.map((p: any) => p.id);

        // Auto-create the missing links so future sends work correctly
        for (const pid of parentIds) {
          await pool.query(
            `INSERT INTO parent_student_links (parent_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [pid, report.student_id],
          );
        }
      }
    }

    console.log(`[holistic-report share] student=${report.student_id} found ${parentIds.length} parent(s) (${parents.rows.length} via links, ${parentIds.length - parents.rows.length} via contact fallback)`);
    const tl = report.term === 'mid_term' ? 'Mid-Term' : 'Final Term';
    const body = `${tl} Holistic Progress Report for ${report.student_name} (${report.class_name}) is now available.`;
    let notified = 0;
    for (const pid of parentIds) {
      try {
        await pool.query(
          `INSERT INTO messages (school_id, teacher_id, parent_id, student_id, sender_role, body, topic, extension)
           VALUES ($1,$2,$3,$4,'teacher',$5,'holistic_report','')
           ON CONFLICT DO NOTHING`,
          [school_id, user_id, pid, report.student_id, body],
        );
        notified++;
      } catch (msgErr: any) {
        // Fallback without topic/extension for older schema versions
        try {
          await pool.query(
            `INSERT INTO messages (school_id, teacher_id, parent_id, student_id, sender_role, body)
             VALUES ($1,$2,$3,$4,'teacher',$5)`,
            [school_id, user_id, pid, report.student_id, body],
          );
          notified++;
        } catch (msgErr2) {
          console.error('[holistic-report share] message insert failed for parent', pid, msgErr2);
        }
      }
    }
    return res.json({ message: 'Report shared with parent', parents_notified: notified });
  } catch (err) {
    console.error('[holistic-report share]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/teacher/holistic-report/:id/recall
router.post('/:id/recall', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const role = (req.user as any).role;
    const existing = await pool.query(
      `SELECT id, teacher_id, status FROM holistic_reports WHERE id=$1 AND school_id=$2`,
      [req.params.id, school_id],
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Report not found' });
    const r = existing.rows[0];
    if (!['principal', 'admin'].includes(role) && r.teacher_id !== user_id) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    await pool.query(
      `UPDATE holistic_reports SET status='draft', shared_at=NULL, shared_by=NULL, updated_at=now() WHERE id=$1`,
      [req.params.id],
    );
    return res.json({ message: 'Report recalled - parent can no longer see it' });
  } catch (err) {
    console.error('[holistic-report recall]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/:id/pdf', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { id } = req.params;

    const reportRow = await pool.query(
      `SELECT hr.*,
              s.name AS student_name,
              c.name AS class_name,
              sec.label AS section_label,
              sch.name AS school_name,
              sch.address AS school_address,
              u.name AS teacher_name
       FROM holistic_reports hr
       JOIN students  s   ON s.id   = hr.student_id
       JOIN classes   c   ON c.id   = hr.class_id
       JOIN sections  sec ON sec.id = hr.section_id
       JOIN schools   sch ON sch.id = hr.school_id
       LEFT JOIN users u  ON u.id   = hr.teacher_id
       WHERE hr.id=$1 AND hr.school_id=$2`,
      [id, school_id],
    );
    if (!reportRow.rows.length) return res.status(404).json({ error: 'Report not found' });
    const r = reportRow.rows[0];

    // Load template for domains â€” use class-appropriate defaults if no custom template
    const templateRow = await pool.query(
      `SELECT domains FROM holistic_report_templates
       WHERE school_id=$1 AND class_id=$2 AND academic_year=$3`,
      [school_id, r.class_id, r.academic_year],
    );
    const domains: any[] = templateRow.rows[0]?.domains ?? getDefaultDomains(r.class_name);
    const format: string = r.report_format || (isPgNurseryClass(r.class_name) ? 'pg_nursery' : 'standard');

    // Fetch live attendance + homework stats to embed in PDF
    let pdfStats: any = null;
    try {
      const calRow2 = await pool.query(
        'SELECT start_date FROM school_calendar WHERE school_id=$1 ORDER BY start_date DESC LIMIT 1',
        [school_id],
      );
      const statsFrom = calRow2.rows[0]?.start_date
        ? new Date(calRow2.rows[0].start_date).toISOString().split('T')[0]
        : '2026-06-01';
      const statsTo = new Date().toISOString().split('T')[0];
      const [attR, hwR] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) FILTER (WHERE status='present')::int AS present_days,
                  COUNT(*) FILTER (WHERE status='absent')::int  AS absent_days,
                  COUNT(*)::int                                  AS total_days
           FROM attendance_records WHERE student_id=$1 AND attend_date BETWEEN $2::date AND $3::date`,
          [r.student_id, statsFrom, statsTo],
        ),
        pool.query(
          `SELECT COUNT(*) FILTER (WHERE status='completed')::int     AS completed,
                  COUNT(*) FILTER (WHERE status='not_submitted')::int AS not_submitted,
                  COUNT(*)::int                                        AS total_recorded
           FROM homework_submissions WHERE student_id=$1 AND homework_date BETWEEN $2::date AND $3::date`,
          [r.student_id, statsFrom, statsTo],
        ),
      ]);
      const att = attR.rows[0]; const hw = hwR.rows[0];
      pdfStats = {
        attPresent: att.present_days, attTotal: att.total_days,
        attPct: att.total_days > 0 ? Math.round(att.present_days / att.total_days * 100) : null,
        hwCompleted: hw.completed, hwTotal: hw.total_recorded,
        hwPct: hw.total_recorded > 0 ? Math.round(hw.completed / hw.total_recorded * 100) : null,
      };
    } catch { /* stats optional — proceed without them */ }

    const pdfBuffer = format === 'pg_nursery'
      ? await generatePgNurseryPDF(r, domains, pdfStats)
      : await generateStandardPDF(r, domains, pdfStats);

    const safeStudentName = (r.student_name as string).replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/ /g, '_');
    const termLabel = r.term === 'mid_term' ? 'MidTerm' : 'FinalTerm';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="HolisticReport_${safeStudentName}_${termLabel}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[holistic-report pdf]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DELETE /api/v1/teacher/holistic-report/:id
// Delete a draft report (shared reports cannot be deleted by teacher)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const role = (req.user as any).role;

    const existing = await pool.query(
      `SELECT id, teacher_id, status FROM holistic_reports WHERE id=$1 AND school_id=$2`,
      [req.params.id, school_id],
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Report not found' });

    const r = existing.rows[0];
    // Only the teacher who created it (or admin/principal) can delete
    if (!['principal', 'admin'].includes(role) && r.teacher_id !== user_id) {
      return res.status(403).json({ error: 'Not authorised to delete this report' });
    }
    if (r.status === 'shared' && !['principal', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Cannot delete a shared report. Contact admin.' });
    }

    await pool.query('DELETE FROM holistic_reports WHERE id=$1 AND school_id=$2', [req.params.id, school_id]);
    return res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[holistic-report delete]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/v1/teacher/holistic-report/list?year=&term=&section_id=
// List all reports for a section (for teacher overview / batch management)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/list', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { term, section_id } = req.query as Record<string, string>;
    let year = (req.query.year as string) || '';

    // Auto-detect academic year if not provided
    if (!year) {
      const calRow = await pool.query(
        `SELECT academic_year FROM school_calendar
         WHERE school_id=$1 AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
         ORDER BY start_date DESC LIMIT 1`,
        [school_id],
      );
      year = calRow.rows[0]?.academic_year || '';
      if (!year) {
        const latestCal = await pool.query(
          'SELECT academic_year FROM school_calendar WHERE school_id=$1 ORDER BY start_date DESC LIMIT 1',
          [school_id],
        );
        year = latestCal.rows[0]?.academic_year || '';
      }
      if (!year) return res.status(400).json({ error: 'year is required and no active school calendar found' });
    }

    const role = (req.user as any).role;
    let sectionIds: string[];

    if (['principal', 'admin'].includes(role)) {
      // Principal/admin: can see all sections, optionally filtered
      if (section_id) {
        sectionIds = [section_id];
      } else {
        const secs = await pool.query(
          `SELECT id FROM sections WHERE school_id=$1`, [school_id],
        );
        sectionIds = secs.rows.map((s: any) => s.id);
      }
    } else {
      const sections = await getTeacherSections(user_id, school_id);
      sectionIds = sections.map((s: any) => s.section_id);
      if (section_id && !sectionIds.includes(section_id)) {
        return res.status(403).json({ error: 'Section not yours' });
      }
      if (section_id) sectionIds = [section_id];
    }

    if (!sectionIds.length) return res.json([]);

    // Build year alternatives to handle both 2026-27 and 2026-2027 formats
    function yearAlt(y: string): string {
      if (/^\d{4}-\d{2}$/.test(y)) return y.replace(/^(\d{4})-(\d{2})$/, '$1-20$2'); // 2026-27 → 2026-2027
      if (/^\d{4}-\d{4}$/.test(y)) return y.replace(/^(\d{4})-20(\d{2})$/, '$1-$2'); // 2026-2027 → 2026-27
      return y;
    }
    const yearAltVal = yearAlt(year);

    const conditions: string[] = [
      'hr.school_id=$1',
      'hr.section_id=ANY($2::uuid[])',
      `(hr.academic_year=$3 OR hr.academic_year=$4)`,
    ];
    const params: any[] = [school_id, sectionIds, year, yearAltVal];
    if (term) { conditions.push(`hr.term=$${params.length + 1}`); params.push(term); }

    const result = await pool.query(
      `SELECT hr.id, hr.student_id, hr.term, hr.status, hr.updated_at, hr.academic_year,
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
    console.error('[holistic-report list]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PDF helpers shared by both generators
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BRAND_GREEN = '#1B4332';
const BRAND_AMBER = '#E8960C';

// Growth Statements scale mapping (pg_nursery) — current codes: E, G, B, I
// Legacy codes V (Growing) and S (Independent) kept for reports saved before rename
const GROWTH_MAP: Record<string, { label: string; statement: string; color: string }> = {
  E: { label: 'Exploring',          statement: 'I am beginning to discover this.',               color: '#6B9E7A' },
  G: { label: 'Growing',            statement: 'I am developing this with encouragement.',       color: '#4A8C6A' },
  B: { label: 'Becoming Confident', statement: 'I am using this skill more consistently.',       color: '#2D7A5A' },
  I: { label: 'Independent',        statement: 'I can use this skill confidently on my own.',    color: '#1B4332' },
  // Legacy — reports saved before the code rename
  V: { label: 'Growing',            statement: 'I am developing this with encouragement.',       color: '#4A8C6A' },
  S: { label: 'Independent',        statement: 'I can use this skill confidently on my own.',    color: '#1B4332' },
};

// Standard ratings (standard)
const STANDARD_RATING_FULL: Record<string, string> = {
  E: 'Excellent', V: 'Very Good', G: 'Good', S: 'Satisfactory', P: 'Progressive',
};

function addPageHeader(doc: PDFKit.PDFDocument, schoolName: string, subtitle: string) {
  doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND_GREEN)
    .text(schoolName, MARGIN, doc.y, { align: 'center', width: CONTENT_WIDTH });
  doc.font('Helvetica-Oblique').fontSize(8).fillColor('#888888')
    .text('Rooted Fearlessly', MARGIN, doc.y + 1, { align: 'center', width: CONTENT_WIDTH });
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND_GREEN)
    .text(subtitle, MARGIN, doc.y, { align: 'center', width: CONTENT_WIDTH });
  doc.moveDown(0.3);
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y)
    .strokeColor(BRAND_GREEN).lineWidth(1.5).stroke();
  doc.strokeColor('#000000').lineWidth(1);
  doc.moveDown(0.5);
}

function addSectionBanner(doc: PDFKit.PDFDocument, title: string) {
  const y = doc.y;
  doc.rect(MARGIN, y, CONTENT_WIDTH, 15).fill(BRAND_GREEN);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
    .text(title, MARGIN + 6, y + 3, { width: CONTENT_WIDTH - 12 });
  doc.fillColor('#000000');
  doc.moveDown(0.3);
}

function addNarrativeField(doc: PDFKit.PDFDocument, label: string, value: string | null) {
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND_GREEN).text(label, MARGIN, doc.y);
  doc.moveDown(0.2);
  const text = (value || '').trim() || 'â€”';
  doc.font('Helvetica').fontSize(9).fillColor('#333333').text(text, MARGIN + 4, doc.y, { width: CONTENT_WIDTH - 8 });
}

function checkPage(doc: PDFKit.PDFDocument, needed = 60) {
  if (doc.y + needed > doc.page.height - 60) doc.addPage();
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PDF A â€” Playgroup / Nursery (Silver Oak Juniors Growth Statement format)

// ─────────────────────────────────────────────────────────────────────────────
// PDF Generator — Holistic Progress Report (both pg_nursery and standard)
// Matches the ReportCardV2 visual style:
//   - Green gradient header (no Overall badge)
//   - Stat cards: Attendance%, Days Present, Homework%
//   - Developmental domains with rating circles
//   - Narrative fields (PG/Nursery)
//   - Green footer bar: Class Teacher | School+Date | Principal
// ─────────────────────────────────────────────────────────────────────────────
async function generatePgNurseryPDF(report: any, domains: any[], stats?: any): Promise<Buffer> {
  return generateHolisticReportPDF(report, domains, stats, true);
}

async function generateStandardPDF(report: any, domains: any[], stats?: any): Promise<Buffer> {
  return generateHolisticReportPDF(report, domains, stats, false);
}

async function generateHolisticReportPDF(report: any, domains: any[], stats: any, isPgMode: boolean): Promise<Buffer> {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true, autoFirstPage: true });
  const bufferPromise = collectBuffer(doc);

  const termLabel   = report.term === 'mid_term' ? 'Mid-Term' : 'Final Term';
  const BG          = '#1B4332';   // brand green
  const BG_LIGHT    = '#2D6A4F';
  const AMBER       = '#E8960C';
  const W           = PAGE_WIDTH - MARGIN * 2; // content width

  // ── Header ──────────────────────────────────────────────────────────────────
  const hdrH = 80;
  const hdrY = doc.y;
  doc.roundedRect(MARGIN, hdrY, W, hdrH, 12).fill(BG);

  // Avatar circle
  doc.circle(MARGIN + 36, hdrY + 40, 24).fill('rgba(255,255,255,0.2)');
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff')
    .text((report.student_name || '?').charAt(0).toUpperCase(), MARGIN + 26, hdrY + 28, { width: 20, align: 'center' });

  // Text block
  const txtX = MARGIN + 72;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('rgba(255,255,255,0.65)')
    .text('HOLISTIC PROGRESS REPORT', txtX, hdrY + 10);
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#ffffff')
    .text(report.student_name || '', txtX, hdrY + 20);
  doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.85)')
    .text(`${report.class_name} — Sec ${report.section_label}  |  Teacher: ${report.teacher_name || '—'}`, txtX, hdrY + 38);
  doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.65)')
    .text(`${termLabel}  |  ${report.academic_year}  |  ${report.school_name || ''}`, txtX, hdrY + 52);

  doc.y = hdrY + hdrH + 14;
  doc.fillColor('#000000');

  // ── Stat cards ───────────────────────────────────────────────────────────────
  // 3 cards: Attendance% | Days Present | Homework%
  if (stats) {
    const cardW = (W - 16) / 3;
    const cardH = 52;
    const cardY = doc.y;

    const cards = [
      { label: 'Attendance', value: stats.attPct !== null ? `${stats.attPct}%` : '-', color: '#16a34a', sub: `${stats.attPresent}/${stats.attTotal} days` },
      { label: 'Days Present', value: `${stats.attPresent}/${stats.attTotal}`, color: BG, sub: `${stats.attTotal - stats.attPresent} absent` },
      { label: 'Homework', value: stats.hwPct !== null ? `${stats.hwPct}%` : '-', color: '#7c3aed', sub: `${stats.hwCompleted}/${stats.hwTotal} submitted` },
    ];

    cards.forEach((c, i) => {
      const x = MARGIN + i * (cardW + 8);
      doc.roundedRect(x, cardY, cardW, cardH, 10).stroke('#e5e7eb');
      doc.font('Helvetica-Bold').fontSize(20).fillColor(c.color)
        .text(c.value, x + 8, cardY + 8, { width: cardW - 16 });
      doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
        .text(c.label, x + 8, cardY + 32, { width: cardW - 16 });
      doc.font('Helvetica').fontSize(7.5).fillColor('#9ca3af')
        .text(c.sub, x + 8, cardY + 41, { width: cardW - 16 });
    });

    doc.fillColor('#000000');
    doc.y = cardY + cardH + 14;
  }

  // ── Attendance string override (if teacher set it manually) ─────────────────
  if (report.attendance && isPgMode) {
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
      .text(`Attendance: ${report.attendance}`, MARGIN, doc.y);
    doc.moveDown(0.4);
  }

  // ── Growth Statement / Rating scale key ────────────────────────────────────
  const scaleItems = isPgMode
    ? [
        { code: 'E', label: 'Exploring',          color: '#6B9E7A', stmt: 'I am beginning to discover this.' },
        { code: 'G', label: 'Growing',            color: '#4A8C6A', stmt: 'I am developing this with encouragement.' },
        { code: 'B', label: 'Becoming Confident', color: '#2D7A5A', stmt: 'I am using this skill more consistently.' },
        { code: 'I', label: 'Independent',        color: '#1B4332', stmt: 'I can use this skill confidently on my own.' },
      ]
    : [
        { code: 'E', label: 'Excellent',    color: '#1B4332', stmt: '' },
        { code: 'V', label: 'Very Good',    color: '#2D6A4F', stmt: '' },
        { code: 'G', label: 'Good',         color: '#40916C', stmt: '' },
        { code: 'S', label: 'Satisfactory', color: '#E8960C', stmt: '' },
        { code: 'P', label: 'Progressive',  color: '#888888', stmt: '' },
      ];

  // Scale key row
  const keyY = doc.y;
  doc.roundedRect(MARGIN, keyY, W, 14).fill('#f0fdf4');
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#166534').text('Scale: ', MARGIN + 4, keyY + 3, { continued: true });
  scaleItems.forEach((s, i) => {
    doc.font('Helvetica-Bold').fillColor(s.color).text(`${s.code}`, { continued: true });
    doc.font('Helvetica').fillColor('#374151').text(` = ${s.label}${i < scaleItems.length - 1 ? '   ' : ''}`, { continued: i < scaleItems.length - 1 });
  });
  doc.fillColor('#000000');
  doc.y = keyY + 18;
  doc.moveDown(0.3);

  // ── Developmental domains ───────────────────────────────────────────────────
  const devRatings: Record<string, Record<string, string>> = report.developmental_ratings || {};

  for (const domain of domains) {
    const subItems: any[] = domain.sub_items || [];
    if (!subItems.length) continue;

    if (doc.y + 30 + subItems.length * 13 > doc.page.height - 80) doc.addPage();

    // Domain heading
    const dY = doc.y;
    doc.roundedRect(MARGIN, dY, W, 16).fill('#EBF5EE');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BG)
      .text(domain.label, MARGIN + 6, dY + 4, { width: W - 80 });

    // Rating column headers
    const rCols = scaleItems.map(s => s.code);
    const rW    = 18;
    const rStartX = MARGIN + W - rCols.length * rW - 6;
    rCols.forEach((code, i) => {
      const sc = scaleItems.find(s => s.code === code);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(sc?.color || '#444')
        .text(code, rStartX + i * rW, dY + 5, { width: rW, align: 'center' });
    });
    doc.fillColor('#000000');
    doc.y = dY + 16;

    // Separate gross/fine motor for physical domain
    const isPhysical = domain.id === 'physical_motor';
    const grossItems = isPhysical ? subItems.filter((i: any) => i.label.startsWith('[Gross Motor]')) : [];
    const fineItems  = isPhysical ? subItems.filter((i: any) => i.label.startsWith('[Fine Motor]'))  : [];
    const regItems   = isPhysical ? [] : subItems;

    const renderSubItems = (items: any[], subtitle?: string) => {
      if (!items.length) return;
      if (subtitle) {
        const sY = doc.y;
        doc.rect(MARGIN, sY, W, 12).fill('#f3f4f6');
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#555555').text(subtitle, MARGIN + 6, sY + 2.5);
        doc.y = sY + 12;
      }
      const domainRatings = devRatings[domain.id] || {};
      items.forEach((item: any, idx: number) => {
        const itemY = doc.y;
        const sel   = (domainRatings[item.id] || '').toUpperCase();
        const cleanLabel = item.label.replace(/^\[(Gross|Fine) Motor\] /, '');
        if (idx % 2 === 1) { doc.rect(MARGIN, itemY, W, 13).fill('#FAFAFA'); doc.fillColor('#000000'); }
        doc.font('Helvetica').fontSize(7.5).fillColor('#333333')
          .text(cleanLabel, MARGIN + 6, itemY + 2.5, { width: W - 90 });
        rCols.forEach((code, i) => {
          const cx = rStartX + i * rW + rW / 2;
          const cy = itemY + 6.5;
          const sc = scaleItems.find(s => s.code === code);
          if (sel === code) {
            doc.circle(cx, cy, 5.5).fill(sc?.color || AMBER);
            doc.font('Helvetica-Bold').fontSize(6).fillColor('#ffffff').text(code, cx - 3.5, cy - 3.5, { width: 7, align: 'center' });
          } else {
            doc.circle(cx, cy, 4.5).stroke('#dddddd');
          }
        });
        doc.fillColor('#000000');
        doc.y = itemY + 13;
      });
    };

    if (isPhysical) {
      renderSubItems(grossItems, 'Gross Motor');
      renderSubItems(fineItems, 'Fine Motor');
    } else {
      renderSubItems(regItems);
    }
    doc.moveDown(0.3);
  }

  // ── Subject grades (standard only) ──────────────────────────────────────────
  if (!isPgMode) {
    const subjectGrades: Record<string, string> = report.subject_grades || {};
    const subjectEntries = Object.entries(subjectGrades).filter(([, v]) => v);
    if (subjectEntries.length > 0) {
      if (doc.y + 60 > doc.page.height - 80) doc.addPage();
      const secY = doc.y;
      doc.roundedRect(MARGIN, secY, W, 16).fill(BG);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
        .text('RESULT OF ASSESSMENT ACTIVITIES', MARGIN + 6, secY + 4, { width: W - 12 });
      doc.y = secY + 20;

      const colW = (W - 8) / 3;
      let colIdx = 0; let rowY = doc.y;
      for (const [subject, grade] of subjectEntries) {
        const x = MARGIN + colIdx * (colW + 4);
        const sc = scaleItems.find(s => s.code === grade);
        doc.roundedRect(x, rowY, colW, 22).fill('#F8FBF9').stroke('#E2E8E5');
        doc.font('Helvetica').fontSize(8).fillColor('#333333').text(subject, x + 6, rowY + 3, { width: colW - 28 });
        doc.font('Helvetica-Bold').fontSize(11).fillColor(sc?.color || '#888')
          .text(grade, x + colW - 22, rowY + 5, { width: 18, align: 'center' });
        doc.fillColor('#000000');
        colIdx++;
        if (colIdx >= 3) { colIdx = 0; rowY += 26; doc.y = rowY; }
      }
      if (colIdx > 0) doc.y = rowY + 26;
    }
  }

  // ── Teacher Observation ─────────────────────────────────────────────────────
  const comment = (report.teacher_comment || report.teacher_comment_raw || '').trim();
  if (comment) {
    if (doc.y + 60 > doc.page.height - 80) doc.addPage();
    doc.moveDown(0.4);
    const cSecY = doc.y;
    doc.roundedRect(MARGIN, cSecY, W, 16).fill(BG);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
      .text(isPgMode ? "TEACHER'S OBSERVATION" : "TEACHER'S COMMENT", MARGIN + 6, cSecY + 4);
    doc.y = cSecY + 20;
    doc.font('Helvetica').fontSize(9).fillColor('#333333')
      .text(comment, MARGIN + 4, doc.y, { width: W - 8 });
  }

  // ── PG/Nursery narrative sections ───────────────────────────────────────────
  if (isPgMode) {
    const narrativeFields = [
      { label: 'MY STRENGTHS',             value: report.strengths },
      { label: 'DEVELOPING SKILLS',        value: report.developing_skills },
      { label: 'AT SCHOOL',                value: report.at_school_support },
      { label: 'AT HOME',                  value: report.at_home_support },
      { label: 'MY SILVER OAK MOMENT',     value: report.silver_oak_moment },
    ].filter(f => f.value?.trim());

    for (const field of narrativeFields) {
      if (doc.y + 50 > doc.page.height - 80) doc.addPage();
      doc.moveDown(0.4);
      const fY = doc.y;
      doc.roundedRect(MARGIN, fY, W, 16).fill(BG);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff').text(field.label, MARGIN + 6, fY + 4);
      doc.y = fY + 20;
      doc.font('Helvetica').fontSize(9).fillColor('#333333')
        .text(field.value!.trim(), MARGIN + 4, doc.y, { width: W - 8 });
    }

    // Teacher's Note box
    if (doc.y + 60 > doc.page.height - 80) doc.addPage();
    doc.moveDown(0.6);
    const noteY = doc.y;
    doc.roundedRect(MARGIN, noteY, W, 50).fill('#F0F7F4');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BG).text("TEACHER'S NOTE", MARGIN + 8, noteY + 6);
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#555555')
      .text("Every child develops at their own pace. This report reflects the child's development, participation, strengths and emerging skills observed during the term.", MARGIN + 8, noteY + 18, { width: W - 16 });
    doc.y = noteY + 56;
  }

  // ── Footer — matches ReportCardV2 footer exactly ────────────────────────────
  if (doc.y + 50 > doc.page.height - 40) doc.addPage();
  doc.moveDown(0.8);
  const ftY = doc.y;
  doc.roundedRect(MARGIN, ftY, W, 44).fill(BG);

  // Left: Class Teacher
  doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.6)').text('Class Teacher', MARGIN + 12, ftY + 8);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text(report.teacher_name || '—', MARGIN + 12, ftY + 20);

  // Center: School + date
  doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.6)')
    .text(report.school_name || '', MARGIN + W / 2 - 60, ftY + 8, { width: 120, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.5)')
    .text(`Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, MARGIN + W / 2 - 60, ftY + 20, { width: 120, align: 'center' });

  // Right: Principal
  doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.6)')
    .text('Principal', MARGIN + W - 100, ftY + 8, { width: 90, align: 'right' });
  doc.moveTo(MARGIN + W - 100, ftY + 34).lineTo(MARGIN + W - 12, ftY + 34)
    .strokeColor('rgba(255,255,255,0.4)').lineWidth(1).stroke();
  doc.strokeColor('#000000').lineWidth(1);

  doc.fillColor('#000000');
  doc.end();
  return bufferPromise;
}

export default router;

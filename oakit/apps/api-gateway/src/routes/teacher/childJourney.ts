import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, schoolScope);

const AI_SERVICE_URL = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ─── POST /teacher/child-journey — create/update entry ───────────────────────
router.post('/', roleGuard('teacher'), async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const { student_id, entry_date, entry_type = 'daily', raw_text, send_to_parent = false } = req.body;

    if (!student_id || !raw_text?.trim()) {
      return res.status(400).json({ error: 'student_id and raw_text are required' });
    }

    // Get student name and section for AI context
    const studentRow = await pool.query(
      `SELECT s.name, s.section_id, sec.label as section_label, c.name as class_name
       FROM students s
       JOIN sections sec ON sec.id = s.section_id
       JOIN classes c ON c.id = sec.class_id
       WHERE s.id = $1 AND s.school_id = $2`,
      [student_id, school_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const student = studentRow.rows[0];

    // Beautify with AI
    let beautified_text = raw_text;
    try {
      const aiResp = await axios.post(`${AI_SERVICE_URL()}/internal/beautify-child-journey`, {
        raw_text,
        student_name: student.name,
        class_level: student.class_name,
        entry_type,
        entry_date: entry_date || new Date().toISOString().split('T')[0],
      }, { timeout: 15000 });
      beautified_text = aiResp.data.beautified_text || raw_text;
    } catch { /* fallback to raw */ }

    const date = entry_date || new Date().toISOString().split('T')[0];

    // Upsert — one entry per student per date per type
    const r = await pool.query(
      `INSERT INTO child_journey_entries
         (school_id, student_id, section_id, teacher_id, entry_date, entry_type, raw_text, beautified_text, is_sent_to_parent, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (student_id, entry_date, entry_type)
       DO UPDATE SET raw_text = EXCLUDED.raw_text, beautified_text = EXCLUDED.beautified_text,
                     is_sent_to_parent = EXCLUDED.is_sent_to_parent, sent_at = EXCLUDED.sent_at,
                     updated_at = now()
       RETURNING *`,
      [school_id, student_id, student.section_id, user_id, date, entry_type, raw_text, beautified_text,
       send_to_parent, send_to_parent ? new Date() : null]
    );

    return res.status(201).json({ ...r.rows[0], student_name: student.name });
  } catch (err: any) {
    if (err.code === '23505') {
      // Unique constraint — update instead
      return res.status(409).json({ error: 'Entry already exists for this date. Use PUT to update.' });
    }
    console.error('[childJourney] POST', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /teacher/child-journey?section_id=&date= — list entries for section ─
router.get('/', roleGuard('teacher'), async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { section_id, date, student_id } = req.query as Record<string, string>;

    let query = `
      SELECT cj.*, s.name as student_name
      FROM child_journey_entries cj
      JOIN students s ON s.id = cj.student_id
      WHERE cj.school_id = $1
    `;
    const params: any[] = [school_id];

    if (section_id) { params.push(section_id); query += ` AND cj.section_id = $${params.length}`; }
    if (student_id) { params.push(student_id); query += ` AND cj.student_id = $${params.length}`; }
    if (date) { params.push(date); query += ` AND cj.entry_date = $${params.length}`; }

    query += ' ORDER BY cj.entry_date DESC, s.name';

    const r = await pool.query(query, params);
    return res.json(r.rows);
  } catch (err) {
    console.error('[childJourney] GET', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /parent/child-journey/:studentId/snapshot — daily AI snapshot ───────
// Generates a warm 3-sentence child snapshot based on age + recent journey entries.
// Cached per student per day — regenerates next day automatically.
router.get('/parent/:studentId/snapshot', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const { studentId } = req.params;

    // Verify parent access via parent_student_links
    const accessCheck = await pool.query(
      `SELECT s.id, s.name, s.date_of_birth
       FROM students s
       JOIN parent_student_links psl ON psl.student_id = s.id
       WHERE s.id = $1 AND s.school_id = $2 AND psl.parent_id = $3`,
      [studentId, school_id, user_id]
    );
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const student = accessCheck.rows[0];

    // Cache key: per student per calendar date
    const { redis } = await import('../../lib/redis');
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `snapshot:${studentId}:${today}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    // Calculate age
    let ageText = '';
    if (student.date_of_birth) {
      const dob = new Date(student.date_of_birth);
      const now = new Date();
      const years = now.getFullYear() - dob.getFullYear();
      const months = now.getMonth() - dob.getMonth() + (now.getDate() < dob.getDate() ? -1 : 0);
      const totalMonths = years * 12 + months;
      const y = Math.floor(totalMonths / 12);
      const m = totalMonths % 12;
      ageText = y > 0 ? `${y} year${y > 1 ? 's' : ''}${m > 0 ? ` and ${m} month${m > 1 ? 's' : ''}` : ''}` : `${m} month${m > 1 ? 's' : ''}`;
    }

    // Get recent journey entries (last 14 days)
    const entriesRow = await pool.query(
      `SELECT entry_type, beautified_text, entry_date
       FROM child_journey_entries
       WHERE student_id = $1 AND school_id = $2
         AND entry_date >= CURRENT_DATE - 14
       ORDER BY entry_date DESC LIMIT 5`,
      [studentId, school_id]
    );

    // Get class info
    const classRow = await pool.query(
      `SELECT c.name as class_name FROM students s
       JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1`,
      [studentId]
    );
    const className = classRow.rows[0]?.class_name || 'preschool';

    // Get attendance this month
    const attRow = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE status='present')::int as present,
              COUNT(*) FILTER (WHERE status='absent')::int as absent
       FROM attendance_records
       WHERE student_id = $1 AND attend_date >= date_trunc('month', CURRENT_DATE)`,
      [studentId]
    );
    const att = attRow.rows[0];

    // Build context for AI
    const recentHighlights = entriesRow.rows
      .map(e => e.beautified_text?.slice(0, 120))
      .filter(Boolean)
      .join(' | ');

    const attContext = att.present > 0
      ? `Attendance this month: ${att.present} days present${att.absent > 0 ? `, ${att.absent} absent` : ', perfect attendance'}.`
      : '';

    const prompt = `Write a warm, positive daily snapshot for parents about their child.

Child: ${student.name}
Age: ${ageText || 'preschool age'}
Class: ${className}
${attContext}
${recentHighlights ? `Recent classroom highlights: ${recentHighlights}` : ''}

Write exactly 3 sentences:
1. A warm observation about the child's age/developmental stage and what to expect
2. How the child is doing based on recent highlights (positive, specific)
3. One encouraging note for parents

Rules:
- Warm, personal, parent-friendly tone
- No bullet points, no headings — flowing sentences only
- Do NOT mention "Oakie" or "AI" — write as if from the school
- Keep it under 80 words total
- Always positive and encouraging`;

    let snapshot = '';
    try {
      const aiResp = await axios.post(`${AI_SERVICE_URL()}/internal/query`, {
        teacher_id: user_id,
        school_id,
        text: prompt,
        query_date: today,
        role: 'parent',
        context: `Generate a child snapshot. ${attContext} ${recentHighlights}`,
      }, { timeout: 20000 });
      snapshot = aiResp.data?.response || '';
    } catch { /* fallback below */ }

    // Fallback if AI unavailable
    if (!snapshot) {
      const firstName = student.name.split(' ')[0];
      snapshot = `At ${ageText || 'this age'}, children like ${firstName} are developing curiosity, language, and social skills rapidly — every day brings new discoveries. ${recentHighlights ? `${firstName} has been showing wonderful engagement in the classroom recently.` : `${firstName} is settling in beautifully and growing every day.`} Keep encouraging conversations about school — your involvement makes all the difference!`;
    }

    const result = { snapshot, student_name: student.name, age: ageText, generated_at: today };
    // Cache until midnight (TTL = seconds until end of day)
    const now = new Date();
    const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
    const ttl = Math.floor((midnight.getTime() - now.getTime()) / 1000);
    await redis.setEx(cacheKey, ttl, JSON.stringify(result));

    return res.json(result);
  } catch (err) {
    console.error('[childJourney] snapshot', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /parent/child-journey/:studentId — parent views child's journey ─────
router.get('/parent/:studentId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { studentId } = req.params;
    const { from, to } = req.query as Record<string, string>;

    // Verify parent has access to this student
    const accessCheck = await pool.query(
      `SELECT s.id, s.name FROM students s
       JOIN parent_student_links psl ON psl.student_id = s.id
       WHERE s.id = $1 AND s.school_id = $2 AND psl.parent_id = $3`,
      [studentId, school_id, req.user!.user_id]
    );
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query = `
      SELECT cj.id, cj.entry_date, cj.entry_type, cj.beautified_text, cj.created_at
      FROM child_journey_entries cj
      WHERE cj.student_id = $1 AND cj.school_id = $2
    `;
    const params: any[] = [studentId, school_id];

    if (from) { params.push(from); query += ` AND cj.entry_date >= $${params.length}`; }
    if (to) { params.push(to); query += ` AND cj.entry_date <= $${params.length}`; }

    query += ' ORDER BY cj.entry_date DESC LIMIT 90';

    const r = await pool.query(query, params);

    return res.json({
      student: accessCheck.rows[0],
      entries: r.rows,
      total: r.rows.length,
    });
  } catch (err) {
    console.error('[childJourney] GET parent', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { pool } from '../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../middleware/auth';
import { getToday } from '../lib/today';
import { uploadFile, deleteFile, getPublicUrl } from '../lib/storage';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

const photoUpload = multer({
  dest: '/tmp/oakit-uploads/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Photo must be JPEG or PNG'));
  },
});

// GET /api/v1/parent/teachers — list teachers for parent's children (to start new conversations)
router.get('/teachers', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const result = await pool.query(
      `SELECT DISTINCT
         u.id as teacher_id, u.name as teacher_name,
         s.id as student_id, s.name as student_name,
         c.name as class_name, sec.label as section_label
       FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       JOIN sections sec ON sec.id = s.section_id
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN users u ON u.id = sec.class_teacher_id
       WHERE psl.parent_id = $1 AND s.school_id = $2 AND u.id IS NOT NULL
       ORDER BY s.name, u.name`,
      [user_id, school_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/children — list all linked children with basic info
router.get('/children', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const result = await pool.query(
      `SELECT s.id, s.name, s.father_name, s.mother_name,
              s.parent_contact, s.mother_contact, s.date_of_birth::text,
              s.photo_path,
              c.name as class_name, sec.label as section_label,
              sec.id as section_id, s.class_id
       FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE psl.parent_id = $1 AND s.school_id = $2 AND s.is_active = true
       ORDER BY c.name, s.name`,
      [user_id, school_id]
    );
    return res.json(result.rows.map((r: any) => ({ ...r, photo_url: getPublicUrl(r.photo_path) })));
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/parent/child/:student_id/photo — parent uploads child photo
router.post('/child/:student_id/photo', (req: Request, res: Response, next: any) => {
  photoUpload.single('photo')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Photo must be under 5 MB' });
      return res.status(400).json({ error: err.message || 'Photo must be JPEG or PNG' });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No photo uploaded' });

    // Verify parent is linked to this student
    const link = await pool.query(
      `SELECT psl.student_id FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`,
      [user_id, student_id, school_id]
    );
    if (link.rows.length === 0) {
      fs.unlink(file.path, () => {});
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete old photo from Supabase
    const oldRow = await pool.query('SELECT photo_path FROM students WHERE id = $1', [student_id]);
    await deleteFile(oldRow.rows[0]?.photo_path);

    // Upload to Supabase
    const { storagePath, publicUrl } = await uploadFile({
      schoolId: school_id,
      folder: 'students',
      localPath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      actorId: user_id,
      actorRole: 'parent',
      entityType: 'student_photo',
      entityId: student_id,
      auditMeta: { student_id, uploaded_by: 'parent' },
    });

    await pool.query('UPDATE students SET photo_path = $1 WHERE id = $2', [storagePath, student_id]);
    return res.json({ photo_url: publicUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/child/:student_id/feed — today's update for a specific child
router.get('/child/:student_id/feed', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.params;

    // Verify parent is linked to this student
    const link = await pool.query(
      `SELECT psl.student_id FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`,
      [user_id, student_id, school_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    // Get student's section
    const studentRow = await pool.query(
      `SELECT s.section_id, s.name, c.name as class_name, sec.label as section_label
       FROM students s JOIN classes c ON c.id = s.class_id JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = $1`, [student_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const { section_id, name, class_name, section_label } = studentRow.rows[0];

    const today = await getToday(school_id);

    // Today's attendance
    const attRow = await pool.query(
      `SELECT status, is_late, arrived_at FROM attendance_records
       WHERE student_id = $1 AND attend_date = $2 LIMIT 1`,
      [student_id, today]
    );

    // Today's completion
    const compRow = await pool.query(
      `SELECT dc.covered_chunk_ids, dc.submitted_at,
              u.name as teacher_name
       FROM daily_completions dc
       JOIN users u ON u.id = dc.teacher_id
       WHERE dc.section_id = $1 AND dc.completion_date = $2 LIMIT 1`,
      [section_id, today]
    );

    // Today's plan topics
    const planRow = await pool.query(
      `SELECT dp.chunk_ids, dp.status, sd.label as special_label, sd.day_type
       FROM day_plans dp
       LEFT JOIN special_days sd ON sd.school_id = dp.school_id AND sd.day_date = dp.plan_date
       WHERE dp.section_id = $1 AND dp.plan_date = $2 LIMIT 1`,
      [section_id, today]
    );

    let topics: string[] = [];
    let topicChunks: { topic: string; snippet: string }[] = [];
    if (planRow.rows.length > 0 && planRow.rows[0].chunk_ids?.length > 0) {
      const chunks = await pool.query(
        'SELECT topic_label, LEFT(content, 300) as snippet FROM curriculum_chunks WHERE id = ANY($1::uuid[]) ORDER BY chunk_index',
        [planRow.rows[0].chunk_ids]
      );
      topics = chunks.rows.map((r: any) => r.topic_label);
      topicChunks = chunks.rows.map((r: any) => ({ topic: r.topic_label || '', snippet: r.snippet || '' }));
    }

    // Today's homework
    const hwRow = await pool.query(
      `SELECT formatted_text, raw_text FROM teacher_homework
       WHERE section_id = $1 AND homework_date = $2 LIMIT 1`,
      [section_id, today]
    ).catch(() => ({ rows: [] }));

    // Today's notes (non-expired, deduplicated by content)
    const notesRow = await pool.query(
      `SELECT DISTINCT ON (COALESCE(note_text, ''), COALESCE(file_name, ''))
              id, note_text, file_name, file_size, expires_at, created_at
       FROM teacher_notes
       WHERE section_id = $1 AND note_date = $2 AND expires_at > now()
       ORDER BY COALESCE(note_text, ''), COALESCE(file_name, ''), created_at DESC`,
      [section_id, today]
    ).catch(() => ({ rows: [] }));

    // School instagram handle for social sharing
    const igRow = await pool.query(
      `SELECT instagram_handle, COALESCE(translation_enabled, true) as translation_enabled FROM school_settings WHERE school_id = $1`,
      [school_id]
    ).catch(() => ({ rows: [] }));

    return res.json({
      student_id, name, class_name, section_label,
      feed_date: today,
      attendance: attRow.rows[0] || null,
      completion: compRow.rows[0] || null,
      topics,
      topic_chunks: topicChunks,
      plan_status: planRow.rows[0]?.status || null,
      special_label: planRow.rows[0]?.special_label || null,
      homework: hwRow.rows[0] || null,
      notes: notesRow.rows,
      instagram_handle: igRow.rows[0]?.instagram_handle ?? '',
      translation_enabled: igRow.rows[0]?.translation_enabled ?? true,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/child/:student_id/day-highlights?date=YYYY-MM-DD
// Returns AI-generated highlights summary + topic list for a specific day
router.get('/child/:student_id/day-highlights', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.params;
    const date = (req.query.date as string || '').trim();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
    }

    // Verify parent-child link
    const link = await pool.query(
      `SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2`,
      [user_id, student_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    // Get student info + section
    const studentRow = await pool.query(
      `SELECT s.section_id, s.name, c.name as class_name, sec.label as section_label
       FROM students s
       JOIN classes c ON c.id = s.class_id
       JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = $1 AND s.school_id = $2`,
      [student_id, school_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const { section_id, name: child_name, class_name, section_label } = studentRow.rows[0];

    // Get day plan for this date
    const planRow = await pool.query(
      `SELECT dp.chunk_ids, dp.status, sd.label as special_label
       FROM day_plans dp
       LEFT JOIN special_days sd ON sd.school_id = dp.school_id AND sd.day_date = dp.plan_date
       WHERE dp.section_id = $1 AND dp.plan_date = $2 LIMIT 1`,
      [section_id, date]
    );

    // Special day (holiday etc.)
    if (planRow.rows.length > 0 && planRow.rows[0].special_label) {
      return res.json({
        date, child_name, class_name, section_label,
        topics: [planRow.rows[0].special_label],
        chunks: [],
        summary: planRow.rows[0].special_label,
        is_special_day: true,
      });
    }

    // No plan for this day
    if (planRow.rows.length === 0 || !planRow.rows[0].chunk_ids?.length) {
      return res.json({
        date, child_name, class_name, section_label,
        topics: [], chunks: [], summary: '', is_special_day: false,
      });
    }

    // Fetch chunk details (topic_label + content snippet)
    const chunksRow = await pool.query(
      `SELECT topic_label, LEFT(content, 300) as content_snippet
       FROM curriculum_chunks WHERE id = ANY($1::uuid[]) ORDER BY chunk_index`,
      [planRow.rows[0].chunk_ids]
    );
    const topics: string[] = chunksRow.rows.map((c: any) => c.topic_label).filter(Boolean);
    const chunks: { topic: string; snippet: string }[] = chunksRow.rows.map((c: any) => ({
      topic: c.topic_label || '',
      snippet: c.content_snippet || '',
    }));

    // Call AI topic-summary via the ai-service
    let summary = '';
    try {
      const axios = (await import('axios')).default;
      const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';
      const aiResp = await axios.post(`${AI_URL}/internal/topic-summary`, {
        topics,
        class_name,
        child_name,
      }, { timeout: 15000 });
      summary = aiResp.data?.summary || '';
    } catch {
      // Fallback: clean up "Week X Day Y" labels and join
      summary = topics
        .map(t => t.replace(/week\s*\d+\s*day\s*\d+/gi, '').trim())
        .filter(Boolean)
        .join(', ');
    }

    return res.json({
      date, child_name, class_name, section_label,
      topics, chunks, summary, is_special_day: false,
    });
  } catch (err) {
    console.error('[parent] day-highlights', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/child/:student_id/week-schedule — this week's day plans
router.get('/child/:student_id/week-schedule', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.params;

    // Verify parent-child link
    const link = await pool.query(
      `SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2`,
      [user_id, student_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    // Get student's section
    const studentRow = await pool.query(
      `SELECT s.section_id FROM students s WHERE s.id = $1 AND s.school_id = $2`,
      [student_id, school_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const { section_id } = studentRow.rows[0];

    // Use school's "today" (respects time machine) to anchor the week
    const todayStr = await getToday(school_id); // YYYY-MM-DD
    const todayDate = new Date(todayStr + 'T12:00:00Z'); // noon UTC avoids DST edge cases
    const dow = todayDate.getUTCDay(); // 0=Sun
    const mondayOffset = dow === 0 ? -6 : 1 - dow;

    // Build Mon–Sun as YYYY-MM-DD strings directly (no timezone conversion)
    function addDays(base: string, n: number): string {
      const d = new Date(base + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().split('T')[0];
    }
    const monday = addDays(todayStr, mondayOffset);
    const sunday = addDays(todayStr, mondayOffset + 6);

    // Fetch day plans for the week
    const plansRow = await pool.query(
      `SELECT dp.plan_date::text, dp.chunk_ids, dp.status,
              sd.label as special_label
       FROM day_plans dp
       LEFT JOIN special_days sd ON sd.school_id = dp.school_id AND sd.day_date = dp.plan_date
       WHERE dp.section_id = $1 AND dp.plan_date BETWEEN $2 AND $3
       ORDER BY dp.plan_date`,
      [section_id, monday, sunday]
    );

    // Resolve topic labels — plan_date is already a string due to ::text cast
    const days: Record<string, { topics: string[]; chunks: { topic: string; snippet: string }[]; completed: boolean }> = {};
    for (const row of plansRow.rows) {
      const dateKey: string = typeof row.plan_date === 'string'
        ? row.plan_date.split('T')[0]
        : (row.plan_date as Date).toISOString().split('T')[0];

      if (row.special_label) {
        days[dateKey] = { topics: [row.special_label], chunks: [], completed: false };
        continue;
      }
      if (row.chunk_ids?.length > 0) {
        const chunkRows = await pool.query(
          `SELECT topic_label, content, LEFT(content, 1200) as snippet FROM curriculum_chunks WHERE id = ANY($1::uuid[]) ORDER BY chunk_index`,
          [row.chunk_ids]
        );
        // Check if this day has a completion record
        const compRow = await pool.query(
          `SELECT id FROM daily_completions WHERE section_id = $1 AND completion_date = $2 LIMIT 1`,
          [section_id, dateKey]
        );

        // Extract subject headings from content when topic_label is "Week X Day Y"
        function extractSubjects(content: string): string[] {
          const lines = content.split('\n').map((l: string) => l.trim()).filter(Boolean);
          const subjects: string[] = [];
          for (const line of lines) {
            if (/^week\s*\d+\s*day\s*\d+/i.test(line)) continue;
            if (/^\d+$/.test(line)) continue;
            // Subject heading: short line ending with colon, or ALL CAPS word, or "Subject:" pattern
            if (
              /^[A-Z][a-zA-Z\s&\/\-]{1,50}:\s*$/.test(line) ||
              /^[A-Z][A-Z\s]{2,30}$/.test(line) ||
              /^(English|Math|Maths|GK|General Knowledge|Circle Time|Fine Motor|Art|Craft|Music|PE|Science|Hindi|Telugu|Tamil|Kannada|Story|Rhymes?|Writing|Reading|Numbers?|Shapes?|Colours?|Colors?|Drawing|Phonics|EVS|Computer|Dance|Yoga|Library|Activity|Outdoor|Indoor|Language|Numeracy|Literacy|Motor Skills?|Sensory|Play|Exploration|Discovery|Social|Emotional|Cognitive|Creative|Physical)[:\s]/i.test(line)
            ) {
              subjects.push(line.replace(/:$/, '').trim());
            }
          }
          return subjects;
        }

        days[dateKey] = {
          topics: chunkRows.rows.map((c: any) => c.topic_label),
          chunks: chunkRows.rows.map((c: any) => {
            const isWeekDayLabel = /^week\s*\d+\s*day\s*\d+\s*$/i.test((c.topic_label || '').trim());
            const subjects = isWeekDayLabel ? extractSubjects(c.content || '') : [];
            return {
              topic: c.topic_label || '',
              snippet: c.snippet || '',
              subjects: subjects.length > 0 ? subjects : undefined,
            };
          }),
          completed: compRow.rows.length > 0,
        };
      } else {
        days[dateKey] = { topics: [], chunks: [], completed: false };
      }
    }

    return res.json({ week_start: monday, today: todayStr, days });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/child/:student_id/term-summary — all topics covered this term
router.get('/child/:student_id/term-summary', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.params;

    const link = await pool.query(
      `SELECT 1 FROM parent_student_links WHERE parent_id = $1 AND student_id = $2`,
      [user_id, student_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    const studentRow = await pool.query(
      `SELECT s.section_id, s.name, c.name as class_name
       FROM students s JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1 AND s.school_id = $2`,
      [student_id, school_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const { section_id, name: student_name, class_name } = studentRow.rows[0];

    // Get current academic year — fallback to most recent if time machine is active
    let calRow = await pool.query(
      `SELECT start_date, end_date FROM school_calendar
       WHERE school_id = $1 AND now()::date BETWEEN start_date AND end_date LIMIT 1`,
      [school_id]
    );
    if (calRow.rows.length === 0) {
      calRow = await pool.query(
        `SELECT start_date, end_date FROM school_calendar
         WHERE school_id = $1 ORDER BY start_date DESC LIMIT 1`,
        [school_id]
      );
    }
    const yearStart = calRow.rows[0]?.start_date ?? null;
    const yearEnd = calRow.rows[0]?.end_date ?? null;

    // All completed days this term with their chunk IDs
    const completionsRow = await pool.query(
      `SELECT completion_date::text, covered_chunk_ids, settling_day_note
       FROM daily_completions
       WHERE section_id = $1
         AND ($2::date IS NULL OR completion_date >= $2::date)
         AND ($3::date IS NULL OR completion_date <= $3::date)
       ORDER BY completion_date ASC`,
      [section_id, yearStart, yearEnd]
    );

    // Also count all school days that have passed (from day_plans) — includes settling days
    // even if teacher hasn't submitted a completion record
    const schoolDaysRow = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE dp.status = 'settling' OR sd.day_type ILIKE '%settl%') AS settling_count,
         COUNT(*) FILTER (WHERE dp.status NOT IN ('holiday','weekend') AND (dp.chunk_ids IS NULL OR dp.chunk_ids = '{}') AND (sd.day_type IS NULL OR sd.day_type NOT ILIKE '%settl%')) AS empty_days,
         COUNT(*) AS total_past_days
       FROM day_plans dp
       LEFT JOIN special_days sd ON sd.school_id = dp.school_id AND sd.day_date = dp.plan_date
       WHERE dp.section_id = $1
         AND dp.plan_date < $2::date
         AND dp.status NOT IN ('holiday','weekend')
         AND ($3::date IS NULL OR dp.plan_date >= $3::date)`,
      [section_id, yearStart ? yearStart : new Date().toISOString().split('T')[0], yearStart]
    );

    // Get school's today for accurate past-day counting
    const schoolToday = await getToday(school_id);

    // Count past day_plans up to school's today
    const pastDaysRow = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE dp.status = 'settling' OR sd.day_type ILIKE '%settl%') AS settling_days,
         COUNT(*) FILTER (WHERE (dp.chunk_ids IS NOT NULL AND dp.chunk_ids != '{}') AND dp.status NOT IN ('holiday','weekend','settling')) AS curriculum_days,
         COUNT(*) AS total_school_days
       FROM day_plans dp
       LEFT JOIN special_days sd ON sd.school_id = dp.school_id AND sd.day_date = dp.plan_date
       WHERE dp.section_id = $1
         AND dp.plan_date <= $2::date
         AND dp.status NOT IN ('holiday','weekend')
         AND ($3::date IS NULL OR dp.plan_date >= $3::date)`,
      [section_id, schoolToday, yearStart]
    );

    const settlingDaysCount = parseInt(pastDaysRow.rows[0]?.settling_days ?? '0');
    const curriculumDaysCount = parseInt(pastDaysRow.rows[0]?.curriculum_days ?? '0');
    const totalSchoolDays = parseInt(pastDaysRow.rows[0]?.total_school_days ?? '0');

    // Collect all unique chunk IDs from curriculum days (from daily_completions)
    const allChunkIds: string[] = [];
    const seenIds = new Set<string>();
    for (const row of completionsRow.rows) {
      for (const id of (row.covered_chunk_ids ?? [])) {
        if (!seenIds.has(id)) { seenIds.add(id); allChunkIds.push(id); }
      }
    }

    // Fetch chunk details — get full content to extract subjects
    let chunks: { id: string; topic_label: string; snippet: string; subjects?: string[] }[] = [];
    if (allChunkIds.length > 0) {
      const chunksRow = await pool.query(
        `SELECT id::text, topic_label, content, LEFT(content, 400) as snippet
         FROM curriculum_chunks WHERE id = ANY($1::uuid[]) ORDER BY chunk_index`,
        [allChunkIds]
      );

      function extractSubjects(content: string): string[] {
        const lines = content.split('\n').map((l: string) => l.trim()).filter(Boolean);
        const subjects: string[] = [];
        const subjectRe = /^(English|Math|Maths|GK|General Knowledge|Circle Time|Fine Motor|Art|Craft|Music|PE|Science|Hindi|Telugu|Tamil|Kannada|Story|Rhymes?|Writing|Reading|Numbers?|Shapes?|Colours?|Colors?|Drawing|Phonics|EVS|Computer|Dance|Yoga|Library|Activity|Outdoor|Indoor|Language|Numeracy|Literacy|Motor Skills?|Sensory|Play|Exploration|Discovery|Social|Emotional|Cognitive|Creative|Physical)/i;
        for (const line of lines) {
          if (/^week\s*\d+\s*day\s*\d+/i.test(line)) continue;
          if (/^\d+$/.test(line)) continue;
          if (subjectRe.test(line) || /^[A-Z][a-zA-Z\s&\/\-]{1,50}:\s*$/.test(line)) {
            const clean = line.replace(/:$/, '').trim();
            if (clean && !subjects.includes(clean)) subjects.push(clean);
          }
        }
        return subjects;
      }

      chunks = chunksRow.rows.map((c: any) => {
        const isWeekDayLabel = /^week\s*\d+\s*day\s*\d+\s*$/i.test((c.topic_label || '').trim());
        const subjects = isWeekDayLabel ? extractSubjects(c.content || '') : [];
        return {
          id: c.id,
          topic_label: c.topic_label,
          snippet: c.snippet || '',
          subjects: subjects.length > 0 ? subjects : undefined,
        };
      });
    }

    // Settling day notes
    const settlingNotes = completionsRow.rows
      .filter((r: any) => r.settling_day_note)
      .map((r: any) => ({ date: r.completion_date, note: r.settling_day_note }));

    // Total curriculum chunks for this section
    const totalRow = await pool.query(
      `SELECT COUNT(*)::int AS total FROM curriculum_chunks cc
       JOIN curriculum_documents cd ON cd.id = cc.document_id
       JOIN sections sec ON sec.class_id = cd.class_id
       WHERE sec.id = $1 AND cd.school_id = $2`,
      [section_id, school_id]
    );

    return res.json({
      student_name,
      class_name,
      total_curriculum_chunks: totalRow.rows[0]?.total ?? 0,
      covered_chunks: allChunkIds.length,
      chunks,
      settling_notes: settlingNotes,
      settling_days: settlingDaysCount,
      curriculum_days: curriculumDaysCount,
      completion_days: totalSchoolDays,
    });
  } catch (err) {
    console.error('[term-summary]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/child/:student_id/attendance — attendance history for a child
router.get('/child/:student_id/attendance', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.params;

    const link = await pool.query(
      `SELECT 1 FROM parent_student_links psl JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`,
      [user_id, student_id, school_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    const result = await pool.query(
      `SELECT attend_date::text, status, is_late, arrived_at
       FROM attendance_records WHERE student_id = $1
       ORDER BY attend_date DESC LIMIT 60`,
      [student_id]
    );

    const present = result.rows.filter((r: any) => r.status === 'present').length;
    const absent = result.rows.filter((r: any) => r.status === 'absent').length;
    const late = result.rows.filter((r: any) => r.is_late).length;
    const total = result.rows.length;

    return res.json({
      records: result.rows,
      stats: { present, absent, late, on_time: present - late, total },
      attendance_pct: total > 0 ? Math.round((present / total) * 100) : 0,
      punctuality_pct: present > 0 ? Math.round(((present - late) / present) * 100) : 0,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/absences
router.get('/absences', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    // Get linked students
    const links = await pool.query(
      `SELECT psl.student_id, s.name as student_name
       FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1`,
      [user_id]
    );

    const absences = [];
    for (const link of links.rows) {
      const absenceRows = await pool.query(
        `SELECT ar.attend_date, ar.status
         FROM attendance_records ar
         WHERE ar.student_id = $1 AND ar.status = 'absent'
         ORDER BY ar.attend_date DESC`,
        [link.student_id]
      );

      for (const absence of absenceRows.rows) {
        // Get covered chunks for that date in the student's section
        const sectionRow = await pool.query(
          'SELECT section_id FROM students WHERE id = $1',
          [link.student_id]
        );
        const section_id = sectionRow.rows[0]?.section_id;

        let covered_chunks: any[] = [];
        if (section_id) {
          const completion = await pool.query(
            'SELECT covered_chunk_ids FROM daily_completions WHERE section_id = $1 AND completion_date = $2',
            [section_id, absence.attend_date]
          );
          if (completion.rows.length > 0 && completion.rows[0].covered_chunk_ids?.length > 0) {
            const chunks = await pool.query(
              'SELECT id, topic_label FROM curriculum_chunks WHERE id = ANY($1::uuid[])',
              [completion.rows[0].covered_chunk_ids]
            );
            covered_chunks = chunks.rows;
          }
        }

        absences.push({
          student_id: link.student_id,
          student_name: link.student_name,
          date: absence.attend_date,
          covered_chunks,
        });
      }
    }

    return res.json(absences);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/notes/:id/download — parent downloads a note attachment
router.get('/notes/:id/download', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    // Verify parent has a child in this section
    const noteRow = await pool.query(
      `SELECT tn.file_path, tn.file_name, tn.expires_at, tn.section_id
       FROM teacher_notes tn
       WHERE tn.id = $1 AND tn.school_id = $2`,
      [req.params.id, school_id]
    );
    if (noteRow.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    const note = noteRow.rows[0];

    // Check parent has a child in this section
    const authRow = await pool.query(
      `SELECT 1 FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND s.section_id = $2 LIMIT 1`,
      [user_id, note.section_id]
    );
    if (authRow.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    if (!note.file_path) return res.status(404).json({ error: 'No file attached' });
    if (new Date(note.expires_at) < new Date()) return res.status(410).json({ error: 'This note has expired' });

    // New Supabase path — redirect to public URL
    const publicUrl = getPublicUrl(note.file_path);
    if (!publicUrl) return res.status(404).json({ error: 'File not found' });

    // For old local paths, serve directly; for Supabase paths, redirect
    if (note.file_path.startsWith('/') || note.file_path.includes('\\') || note.file_path.startsWith('./')) {
      const fs = require('fs');
      const path = require('path');
      if (!fs.existsSync(note.file_path)) return res.status(404).json({ error: 'File not found' });
      res.setHeader('Content-Disposition', `attachment; filename="${note.file_name}"`);
      return res.sendFile(path.resolve(note.file_path));
    }
    return res.redirect(publicUrl);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Reports ───────────────────────────────────────────────────────────────────

// GET /api/v1/parent/reports — list saved reports shared with this parent
router.get('/reports', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.query as Record<string, string>;

    // Get all student IDs linked to this parent
    const linksRow = await pool.query(
      `SELECT psl.student_id FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND s.school_id = $2 AND s.is_active = true`,
      [user_id, school_id]
    );
    const linkedIds: string[] = linksRow.rows.map((r: any) => r.student_id);
    if (linkedIds.length === 0) return res.json([]);

    // Filter to specific student if requested (and verify link)
    const targetIds = student_id && linkedIds.includes(student_id) ? [student_id] : linkedIds;

    const result = await pool.query(
      `SELECT id, student_id, report_type, from_date::text, to_date::text,
              title, created_at::text,
              report_data->>'student_name' as student_name,
              report_data->>'class_name' as class_name
       FROM saved_reports
       WHERE school_id = $1
         AND student_id = ANY($2::uuid[])
         AND shared_with_parent = true
       ORDER BY created_at DESC
       LIMIT 20`,
      [school_id, targetIds]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[parent reports list]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/reports/:id — get full report content
router.get('/reports/:id', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    // Verify parent has access to this report's student
    const row = await pool.query(
      `SELECT sr.id, sr.ai_report, sr.report_data, sr.report_type,
              sr.from_date::text, sr.to_date::text, sr.student_id
       FROM saved_reports sr
       JOIN parent_student_links psl ON psl.student_id = sr.student_id
       WHERE sr.id = $1 AND sr.school_id = $2
         AND psl.parent_id = $3 AND sr.shared_with_parent = true`,
      [req.params.id, school_id, user_id]
    );
    if (row.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    const r = row.rows[0];
    return res.json({
      ...r.report_data,
      ai_report: r.ai_report,
      report_id: r.id,
      report_type: r.report_type,
      from_date: r.from_date,
      to_date: r.to_date,
    });
  } catch (err) {
    console.error('[parent report detail]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/reports/:id/pdf — download report as PDF
router.get('/reports/:id/pdf', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const axios = (await import('axios')).default;

    const row = await pool.query(
      `SELECT sr.*, sr.from_date::text, sr.to_date::text
       FROM saved_reports sr
       JOIN parent_student_links psl ON psl.student_id = sr.student_id
       WHERE sr.id = $1 AND sr.school_id = $2
         AND psl.parent_id = $3 AND sr.shared_with_parent = true`,
      [req.params.id, school_id, user_id]
    );
    if (row.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    const r = row.rows[0];
    const d = r.report_data as any;

    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const aiResp = await axios.post(`${AI_URL}/internal/export-progress-report-pdf`, {
      student_name: d.student_name || '',
      age: d.age || '',
      class_name: d.class_name || '',
      section_label: d.section_label || '',
      teacher_name: d.teacher_name || '',
      father_name: d.father_name || '',
      mother_name: d.mother_name || '',
      school_name: d.school_name || '',
      from_date: r.from_date || '',
      to_date: r.to_date || '',
      attendance_pct: d.attendance?.pct || 0,
      attendance_present: d.attendance?.present || 0,
      attendance_total: d.attendance?.total || 0,
      curriculum_covered: d.curriculum?.covered || 0,
      milestones_achieved: d.milestones?.achieved || 0,
      milestones_total: d.milestones?.total || 0,
      homework_completed: d.homework?.completed || 0,
      homework_total: d.homework?.total || 0,
      ai_report: r.ai_report || '',
    }, { responseType: 'arraybuffer', timeout: 30000 });

    const fname = `Report_${(d.student_name || 'report').replace(/\s+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(Buffer.from(aiResp.data));
  } catch (err) {
    console.error('[parent report pdf]', err);
    return res.status(500).json({ error: 'PDF generation failed' });
  }
});

// ── Fees ──────────────────────────────────────────────────────────────────────

// GET /api/v1/parent/fees?student_id= — fee summary for a child
router.get('/fees', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { student_id } = req.query as Record<string, string>;
    if (!student_id) return res.status(400).json({ error: 'student_id required' });

    // Verify parent-child link
    const link = await pool.query(
      `SELECT 1 FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`,
      [user_id, student_id, school_id]
    );
    if (link.rows.length === 0) return res.status(403).json({ error: 'Not authorized' });

    // Get student info
    const studentRow = await pool.query(
      `SELECT s.name, c.name as class_name FROM students s
       JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1 AND s.school_id = $2`,
      [student_id, school_id]
    );
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const student = studentRow.rows[0];

    // Get fee accounts
    const accountsRow = await pool.query(
      `SELECT sfa.id, fh.name as fee_head_name, fh.type as fee_type,
              sfa.assigned_amount, sfa.outstanding_balance, sfa.status,
              fi.due_date::text
       FROM student_fee_accounts sfa
       JOIN fee_heads fh ON fh.id = sfa.fee_head_id
       LEFT JOIN fee_instalments fi ON fi.fee_head_id = fh.id
         AND fi.instalment_number = 1
       WHERE sfa.student_id = $1 AND sfa.school_id = $2 AND sfa.deleted_at IS NULL
       ORDER BY sfa.status, fh.name`,
      [student_id, school_id]
    );

    const accounts = accountsRow.rows;
    const total_assigned = accounts.reduce((s: number, a: any) => s + Number(a.assigned_amount || 0), 0);
    const total_outstanding = accounts.reduce((s: number, a: any) => s + Number(a.outstanding_balance || 0), 0);
    const total_paid = total_assigned - total_outstanding;

    return res.json({
      student_name: student.name,
      class_name: student.class_name,
      total_assigned,
      total_outstanding,
      total_paid: Math.max(0, total_paid),
      accounts,
    });
  } catch (err) {
    console.error('[parent fees]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/profile — get own profile info
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;
    const result = await pool.query(
      `SELECT id, name, mobile, mobile_updated_at
       FROM parent_users WHERE id = $1`,
      [user_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    const p = result.rows[0];
    return res.json({
      id: p.id,
      name: p.name,
      mobile: p.mobile,
      mobile_can_update: !p.mobile_updated_at, // once-only: can only update if never updated before
    });
  } catch (err) {
    console.error('[parent profile GET]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/parent/profile — update own name and/or mobile
// Mobile update is allowed only once (mobile is the login credential).
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;
    const { name, mobile } = req.body as { name?: string; mobile?: string };

    if (!name && !mobile) {
      return res.status(400).json({ error: 'Provide name or mobile to update' });
    }

    // Fetch current profile
    const current = await pool.query(
      `SELECT id, name, mobile, mobile_updated_at FROM parent_users WHERE id = $1`,
      [user_id]
    );
    if (current.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    const profile = current.rows[0];

    // Mobile update: once-only policy
    if (mobile !== undefined) {
      const cleaned = String(mobile).replace(/\D/g, '');
      if (!/^\d{10}$/.test(cleaned)) {
        return res.status(400).json({ error: 'Mobile must be a valid 10-digit number' });
      }
      if (profile.mobile_updated_at) {
        return res.status(403).json({
          error: 'Mobile number has already been updated once and cannot be changed again. Contact the school admin if you need help.',
          mobile_locked: true,
        });
      }
      if (cleaned === profile.mobile) {
        return res.status(400).json({ error: 'New mobile number is the same as the current one' });
      }

      // Check no other parent in this school has this mobile
      const conflict = await pool.query(
        `SELECT id FROM parent_users WHERE mobile = $1 AND id != $2 LIMIT 1`,
        [cleaned, user_id]
      );
      if (conflict.rows.length > 0) {
        return res.status(409).json({ error: 'This mobile number is already registered with another account' });
      }

      // Update mobile + name (if provided)
      const bcrypt = require('bcryptjs');
      const newHash = await bcrypt.hash(cleaned, 12);
      await pool.query(
        `UPDATE parent_users
         SET mobile = $1,
             password_hash = $2,
             mobile_updated_at = now(),
             mobile_updated_by = 'parent',
             ${name ? "name = $4," : ''}
             force_password_reset = false
         WHERE id = ${name ? '$5' : '$3'}`,
        name
          ? [cleaned, newHash, name.trim(), user_id]
          : [cleaned, newHash, user_id]
      );

      return res.json({
        success: true,
        message: 'Mobile number updated. Please log in again with your new number.',
        mobile_updated: true,
      });
    }

    // Name-only update
    if (name) {
      await pool.query(
        `UPDATE parent_users SET name = $1 WHERE id = $2`,
        [name.trim(), user_id]
      );
      return res.json({ success: true, message: 'Name updated successfully.' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[parent profile PUT]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/parent/missed-topics/:id/done
router.post('/missed-topics/:id/done', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;
    const result = await pool.query(
      `UPDATE missed_topic_tasks SET is_done = true, done_at = now()
       WHERE id = $1 AND parent_id = $2
       RETURNING *`,
      [req.params.id, user_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/missed-topics/completed
router.get('/missed-topics/completed', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.user!;
    const result = await pool.query(
      `SELECT mtt.*, cc.topic_label, s.name as student_name
       FROM missed_topic_tasks mtt
       JOIN curriculum_chunks cc ON cc.id = mtt.chunk_id
       JOIN students s ON s.id = mtt.student_id
       WHERE mtt.parent_id = $1 AND mtt.is_done = true
       ORDER BY mtt.done_at DESC`,
      [user_id]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/parent/calendar — holidays, special days, and announcements for the school
router.get('/calendar', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;

    // Get school's "today" — respects time machine
    const todayStr = await getToday(school_id);

    // Get academic year — try current date first, then fall back to most recent calendar
    let calRow = await pool.query(
      `SELECT academic_year, start_date::text, end_date::text
       FROM school_calendar
       WHERE school_id = $1 AND now()::date BETWEEN start_date AND end_date
       LIMIT 1`,
      [school_id]
    );
    // Fallback: use the most recently started calendar year (handles time machine)
    if (calRow.rows.length === 0) {
      calRow = await pool.query(
        `SELECT academic_year, start_date::text, end_date::text
         FROM school_calendar
         WHERE school_id = $1
         ORDER BY start_date DESC
         LIMIT 1`,
        [school_id]
      );
    }
    const academicYear = calRow.rows[0]?.academic_year || '';
    const calStart = calRow.rows[0]?.start_date || new Date().toISOString().split('T')[0];
    const calEnd   = calRow.rows[0]?.end_date   || new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0];

    // Holidays — all for this academic year
    const holidayRows = await pool.query(
      `SELECT id::text, holiday_date::text as date, event_name as title
       FROM holidays
       WHERE school_id = $1 AND academic_year = $2
       ORDER BY holiday_date`,
      [school_id, academicYear]
    );

    // Special days — settling, events, half-days, etc.
    const specialRows = await pool.query(
      `SELECT id::text, day_date::text as date, label as title, day_type
       FROM special_days
       WHERE school_id = $1 AND academic_year = $2
       ORDER BY day_date`,
      [school_id, academicYear]
    );

    // Announcements — active ones for parents (JOIN users for author name, filter by audience)
    const classIds = await pool.query(
      `SELECT DISTINCT s.class_id FROM parent_student_links psl
       JOIN students s ON s.id = psl.student_id
       WHERE psl.parent_id = $1`,
      [user_id]
    );
    const ids = classIds.rows.map((r: any) => r.class_id);
    const announcementRows = await pool.query(
      `SELECT a.id::text, a.title, a.body, a.created_at::text, u.name as author_name
       FROM announcements a
       JOIN users u ON u.id = a.author_id
       WHERE a.school_id = $1
         AND a.deleted_at IS NULL
         AND (a.expires_at IS NULL OR a.expires_at > now())
         AND (a.target_audience IN ('all','parents')
              OR (a.target_audience = 'class' AND a.target_class_id = ANY($2::uuid[])))
       ORDER BY a.created_at DESC
       LIMIT 30`,
      [school_id, ids]
    );

    function mapDayType(dayType: string): string {
      if (!dayType) return 'event';
      const t = dayType.toLowerCase();
      if (t.includes('settl')) return 'settling';
      if (t.includes('half')) return 'half_day';
      if (t.includes('exam') || t.includes('test')) return 'exam';
      if (t.includes('sport') || t.includes('activity')) return 'activity';
      if (t.includes('holiday') || t.includes('vacation')) return 'holiday';
      return 'event';
    }

    return res.json({
      today: todayStr,           // school's "today" — respects time machine
      academic_year: academicYear,
      calendar_start: calStart,
      calendar_end: calEnd,
      holidays: holidayRows.rows.map((r: any) => ({
        id: r.id, date: r.date, title: r.title, type: 'holiday',
      })),
      special_days: specialRows.rows.map((r: any) => ({
        id: r.id, date: r.date, title: r.title,
        type: mapDayType(r.day_type), day_type: r.day_type,
      })),
      announcements: announcementRows.rows.map((r: any) => ({
        id: r.id, title: r.title, body: r.body,
        date: r.created_at?.split('T')[0] || '',
        author: r.author_name, type: 'announcement',
      })),
    });
  } catch (err) {
    console.error('[parent/calendar]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

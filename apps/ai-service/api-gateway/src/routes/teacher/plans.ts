import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import { getToday } from '../../lib/today';
import PDFDocument from 'pdfkit';

const router = Router();
router.use(jwtVerify, schoolScope, roleGuard('teacher', 'principal'));

const PLAN_QUERY = `
  SELECT dp.id, dp.plan_date::text AS plan_date, dp.status, dp.chunk_ids, dp.section_id,
         dp.admin_note, dp.chunk_label_overrides,
         COALESCE(json_agg(json_build_object(
           'id', cc.id,
           'chunk_index', cc.chunk_index,
           'topic_label', COALESCE((dp.chunk_label_overrides->>(cc.id::text)), cc.topic_label),
           'content', cc.content,
           'page_start', cc.page_start,
           'page_end', cc.page_end,
           'activity_ids', cc.activity_ids
         ) ORDER BY cc.chunk_index) FILTER (WHERE cc.id IS NOT NULL), '[]') as chunks
  FROM day_plans dp
  LEFT JOIN curriculum_chunks cc ON cc.id = ANY(dp.chunk_ids)
  WHERE dp.section_id = $1 AND dp.plan_date = $2 AND dp.school_id = $3
  GROUP BY dp.id
`;

async function resolveSection(user_id: string, school_id: string, requested?: string) {
  const sections = await getTeacherSections(user_id, school_id);
  if (sections.length === 0) return null;
  if (sections.length === 1) return sections[0].section_id;
  return (requested && sections.find(s => s.section_id === requested))
    ? requested
    : sections[0].section_id;
}

// GET /api/v1/teacher/plan/today
router.get('/today', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    console.log(`[Plans] effective today=${today} school=${school_id}`);

    const section_id = await resolveSection(user_id, school_id, req.query.section_id as string);
    if (!section_id) {
      return res.json({ plan_date: today, status: 'no_plan', chunks: [], section_id: null });
    }

    console.log(`[Plans] querying section=${section_id} date=${today}`);
    const result = await pool.query(PLAN_QUERY, [section_id, today, school_id]);

    if (result.rows.length === 0) {
      console.log(`[Plans] no row found`);
      // Still check for supplementary activities
      const suppResult = await pool.query(
        `SELECT sp.id AS plan_id, sp.status, sp.override_note,
                a.title AS activity_title, a.description AS activity_description,
                ap.name AS pool_name
         FROM supplementary_plans sp
         JOIN activities a ON a.id = sp.activity_id
         JOIN pool_assignments pa ON pa.id = sp.pool_assignment_id
         JOIN activity_pools ap ON ap.id = pa.activity_pool_id
         WHERE sp.section_id = $1 AND sp.plan_date = $2
         ORDER BY ap.name, a.position`,
        [section_id, today]
      );
      return res.json({ plan_date: today, status: 'no_plan', chunks: [], section_id, supplementary_activities: suppResult.rows });
    }

    const row = result.rows[0];
    console.log(`[Plans] found status=${row.status} chunk_ids=${JSON.stringify(row.chunk_ids)} chunks_joined=${row.chunks?.length}`);

    // If no chunks, enrich with special_days label
    if (!row.chunk_ids?.length) {
      const special = await pool.query(
        `SELECT label, day_type FROM special_days WHERE school_id=$1 AND day_date=$2 LIMIT 1`,
        [school_id, today]
      );
      if (special.rows.length > 0) {
        row.status = special.rows[0].day_type;
        row.special_label = special.rows[0].label;
      }
    }

    // Attach supplementary activities for this section + date
    const suppResult = await pool.query(
      `SELECT sp.id AS plan_id, sp.status, sp.override_note,
              a.title AS activity_title, a.description AS activity_description,
              ap.name AS pool_name
       FROM supplementary_plans sp
       JOIN activities a ON a.id = sp.activity_id
       JOIN pool_assignments pa ON pa.id = sp.pool_assignment_id
       JOIN activity_pools ap ON ap.id = pa.activity_pool_id
       WHERE sp.section_id = $1 AND sp.plan_date = $2
       ORDER BY ap.name, a.position`,
      [section_id, today]
    );
    row.supplementary_activities = suppResult.rows;

    return res.json(row);
  } catch (err) {
    console.error('[Plans] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/plan/week?from=YYYY-MM-DD&to=YYYY-MM-DD&section_id=...
// Returns plans for a date range. If `to` is omitted, returns the 5-day working week from `from`.
router.get('/week', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);

    const section_id = await resolveSection(user_id, school_id, req.query.section_id as string);
    if (!section_id) return res.json({ days: [], week_label: '' });

    // Determine date range
    let rangeStart: Date;
    let rangeEnd: Date;

    if (req.query.from) {
      rangeStart = new Date((req.query.from as string) + 'T12:00:00');
    } else {
      // Default: Monday of current week
      rangeStart = new Date(today + 'T12:00:00');
      const dow = rangeStart.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      rangeStart.setDate(rangeStart.getDate() + diff);
    }

    if (req.query.to) {
      rangeEnd = new Date((req.query.to as string) + 'T12:00:00');
    } else {
      // Default: Friday of the same week (5 working days)
      rangeEnd = new Date(rangeStart);
      rangeEnd.setDate(rangeEnd.getDate() + 6); // Mon+6 = Sun, then filter weekends below
    }

    // Build all dates in range, filter weekends
    const days: string[] = [];
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) days.push(d.toISOString().split('T')[0]);
    }

    if (days.length === 0) return res.json({ days: [], week_label: '' });

    // Fetch plans for all days in one query
    const result = await pool.query(
      `SELECT dp.plan_date::text AS plan_date, dp.status, dp.chunk_ids,
              dp.admin_note, dp.chunk_label_overrides,
              COALESCE(json_agg(json_build_object(
                'id', cc.id,
                'chunk_index', cc.chunk_index,
                'topic_label', COALESCE((dp.chunk_label_overrides->>(cc.id::text)), cc.topic_label),
                'content', cc.content,
                'activity_ids', cc.activity_ids
              ) ORDER BY cc.chunk_index) FILTER (WHERE cc.id IS NOT NULL), '[]') AS chunks
       FROM day_plans dp
       LEFT JOIN curriculum_chunks cc ON cc.id = ANY(dp.chunk_ids)
       WHERE dp.section_id = $1 AND dp.plan_date = ANY($2::date[]) AND dp.school_id = $3
       GROUP BY dp.plan_date, dp.status, dp.chunk_ids, dp.admin_note, dp.chunk_label_overrides
       ORDER BY dp.plan_date`,
      [section_id, days, school_id]
    );

    // Fetch special days for the range
    const specialResult = await pool.query(
      `SELECT day_date::text AS date, label, day_type, activity_note
       FROM special_days
       WHERE school_id = $1 AND day_date = ANY($2::date[])`,
      [school_id, days]
    );
    const specialMap = new Map(specialResult.rows.map((r: any) => [r.date, r]));

    // Fetch holidays for the range
    const holidayResult = await pool.query(
      `SELECT h.holiday_date::text AS date, h.event_name AS label
       FROM holidays h
       JOIN school_calendar sc ON sc.school_id = h.school_id AND sc.academic_year = h.academic_year
       WHERE h.school_id = $1 AND h.holiday_date = ANY($2::date[])`,
      [school_id, days]
    );
    const holidayMap = new Map(holidayResult.rows.map((r: any) => [r.date, r.label]));

    const planMap = new Map(result.rows.map((r: any) => [r.plan_date, r]));

    const weekDays = days.map(date => {
      const plan = planMap.get(date);
      const special = specialMap.get(date);
      const holiday = holidayMap.get(date);
      const d = new Date(date + 'T12:00:00');
      return {
        date,
        day_name: d.toLocaleDateString('en-IN', { weekday: 'long' }),
        day_short: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
        is_today: date === today,
        is_past: date < today,
        holiday_label: holiday || null,
        special_label: special?.label || null,
        special_type: special?.day_type || null,
        activity_note: special?.activity_note || null,
        status: plan?.status || (holiday ? 'holiday' : special ? special.day_type : 'no_plan'),
        chunks: plan?.chunks || [],
        admin_note: plan?.admin_note || null,
      };
    });

    const first = new Date(days[0] + 'T12:00:00');
    const last  = new Date(days[days.length - 1] + 'T12:00:00');
    const fmt = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const week_label = `${fmt(first)} – ${fmt(last)}`;

    return res.json({ days: weekDays, week_label, section_id });
  } catch (err) {
    console.error('[Plans/week]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/plan/week/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD&section_id=...
// Generates and downloads a PDF of the weekly/range plan
router.get('/week/pdf', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);

    const section_id = await resolveSection(user_id, school_id, req.query.section_id as string);
    if (!section_id) return res.status(404).json({ error: 'No section assigned' });

    // Determine date range (same logic as /week GET)
    let rangeStart: Date;
    let rangeEnd: Date;
    if (req.query.from) {
      rangeStart = new Date((req.query.from as string) + 'T12:00:00');
    } else {
      rangeStart = new Date(today + 'T12:00:00');
      const dow = rangeStart.getDay();
      rangeStart.setDate(rangeStart.getDate() + (dow === 0 ? -6 : 1 - dow));
    }
    if (req.query.to) {
      rangeEnd = new Date((req.query.to as string) + 'T12:00:00');
    } else {
      rangeEnd = new Date(rangeStart);
      rangeEnd.setDate(rangeEnd.getDate() + 6);
    }

    const days: string[] = [];
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) days.push(d.toISOString().split('T')[0]);
    }
    if (days.length === 0) return res.status(400).json({ error: 'No working days in range' });

    // Fetch section + teacher info
    const secRow = await pool.query(
      `SELECT s.label, c.name AS class_name, u.name AS teacher_name
       FROM sections s JOIN classes c ON c.id = s.class_id
       LEFT JOIN users u ON u.id = $2
       WHERE s.id = $1`,
      [section_id, user_id]
    );
    const sec = secRow.rows[0] || { label: '', class_name: '', teacher_name: '' };

    // Fetch plans
    const planResult = await pool.query(
      `SELECT dp.plan_date::text AS plan_date, dp.status, dp.admin_note,
              COALESCE(json_agg(json_build_object(
                'topic_label', COALESCE((dp.chunk_label_overrides->>(cc.id::text)), cc.topic_label),
                'content', cc.content,
                'activity_ids', cc.activity_ids
              ) ORDER BY cc.chunk_index) FILTER (WHERE cc.id IS NOT NULL), '[]') AS chunks
       FROM day_plans dp
       LEFT JOIN curriculum_chunks cc ON cc.id = ANY(dp.chunk_ids)
       WHERE dp.section_id = $1 AND dp.plan_date = ANY($2::date[]) AND dp.school_id = $3
       GROUP BY dp.plan_date, dp.status, dp.admin_note, dp.chunk_label_overrides
       ORDER BY dp.plan_date`,
      [section_id, days, school_id]
    );
    const planMap = new Map(planResult.rows.map((r: any) => [r.plan_date, r]));

    // Fetch holidays + special days
    const holidayResult = await pool.query(
      `SELECT h.holiday_date::text AS date, h.event_name AS label
       FROM holidays h JOIN school_calendar sc ON sc.school_id = h.school_id AND sc.academic_year = h.academic_year
       WHERE h.school_id = $1 AND h.holiday_date = ANY($2::date[])`,
      [school_id, days]
    );
    const holidayMap = new Map(holidayResult.rows.map((r: any) => [r.date, r.label]));

    const specialResult = await pool.query(
      `SELECT day_date::text AS date, label, day_type, activity_note
       FROM special_days WHERE school_id = $1 AND day_date = ANY($2::date[])`,
      [school_id, days]
    );
    const specialMap = new Map(specialResult.rows.map((r: any) => [r.date, r]));

    // Build PDF using pdfkit
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const GREEN = '#1B4332';
    const LIGHT_GREEN = '#D1FAE5';
    const GRAY = '#6B7280';
    const LIGHT_GRAY = '#F9FAFB';

    const leftM = 40;
    const rightM = doc.page.width - 40;
    const colW = rightM - leftM;
    const pageH = doc.page.height - 60;

    // Footer helper — adds "oakit.ai" watermark to every page
    function addFooter() {
      doc.fillColor('#D1D5DB').fontSize(8).font('Helvetica')
        .text('oakit.ai', leftM, doc.page.height - 30, { width: colW, align: 'center' });
    }

    function checkPage(needed: number) {
      if (y + needed > pageH) {
        addFooter();
        doc.addPage();
        y = 40;
      }
    }

    // Helper to render text and advance y by actual height
    function renderText(text: string, x: number, opts: { width: number; fontSize: number; font: string; color: string; indent?: number }) {
      const w = opts.width;
      doc.fillColor(opts.color).fontSize(opts.fontSize).font(opts.font);
      const h = doc.heightOfString(text, { width: w }) + 2;
      checkPage(h + 4);
      doc.text(text, x, y, { width: w });
      y += h;
    }

    // Header
    doc.rect(0, 0, doc.page.width, 70).fill(GREEN);
    doc.fillColor('white').fontSize(16).font('Helvetica-Bold')
      .text('Weekly Plan', 40, 20);
    doc.fontSize(10).font('Helvetica')
      .text(`${sec.class_name} · Section ${sec.label} · ${sec.teacher_name || ''}`, 40, 42);
    const first = new Date(days[0] + 'T12:00:00');
    const last  = new Date(days[days.length - 1] + 'T12:00:00');
    const fmtD = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    doc.text(`${fmtD(first)} – ${fmtD(last)}`, 40, 56);
    doc.fillColor('#D1FAE5').fontSize(8).font('Helvetica')
      .text('oakit.ai', doc.page.width - 100, 28);

    let y = 90;

    for (const date of days) {
      const plan = planMap.get(date);
      const holiday = holidayMap.get(date);
      const special = specialMap.get(date);
      const d = new Date(date + 'T12:00:00');
      const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
      const isToday = date === today;

      checkPage(40);

      // Day header bar
      const headerBg = holiday ? '#FEE2E2' : special ? '#DBEAFE' : isToday ? LIGHT_GREEN : LIGHT_GRAY;
      const headerText = holiday ? '#991B1B' : special ? '#1E40AF' : isToday ? GREEN : '#111827';
      doc.rect(leftM, y, colW, 24).fill(headerBg);
      doc.fillColor(headerText).fontSize(11).font('Helvetica-Bold')
        .text(dayLabel, leftM + 8, y + 6, { width: colW - 16 });
      y += 28;

      if (holiday) {
        renderText(`Holiday: ${holiday}`, leftM + 8, { width: colW - 16, fontSize: 9, font: 'Helvetica-Oblique', color: '#DC2626' });
        y += 6;
        continue;
      }

      if (special) {
        renderText(`${special.day_type?.replace(/_/g, ' ')}: ${special.label}${special.activity_note ? ' — ' + special.activity_note : ''}`, leftM + 8, { width: colW - 16, fontSize: 9, font: 'Helvetica-Oblique', color: '#1D4ED8' });
        y += 4;
      }

      if (plan?.admin_note) {
        renderText(`Note: ${plan.admin_note}`, leftM + 8, { width: colW - 16, fontSize: 9, font: 'Helvetica-Oblique', color: '#92400E' });
        y += 4;
      }

      const planChunks: any[] = plan?.chunks || [];
      if (planChunks.length === 0) {
        renderText('No curriculum plan for this day', leftM + 8, { width: colW - 16, fontSize: 9, font: 'Helvetica-Oblique', color: GRAY });
        y += 4;
      } else {
        for (const chunk of planChunks) {
          // Topic label
          renderText(`• ${chunk.topic_label || 'Topic'}`, leftM + 8, { width: colW - 16, fontSize: 10, font: 'Helvetica-Bold', color: '#111827' });
          y += 2;
          if (chunk.content) {
            const lines = chunk.content.split('\n').filter((l: string) => l.trim());
            for (const line of lines) {
              renderText(line.trim(), leftM + 18, { width: colW - 36, fontSize: 8.5, font: 'Helvetica', color: GRAY });
            }
          }
          y += 6;
        }
      }
      y += 10; // gap between days
    }

    // Add footer to last page
    addFooter();
    doc.end();

    await new Promise<void>(resolve => doc.on('end', resolve));
    const pdfBuffer = Buffer.concat(chunks);

    const fromStr = days[0];
    const toStr = days[days.length - 1];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="weekly-plan-${fromStr}-to-${toStr}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err: any) {
    console.error('[Plans/week/pdf]', err);
    return res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
});

// GET /api/v1/teacher/plan/photo-suggestions
// Must be before /:date to avoid being caught as a date param
router.get('/photo-suggestions', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const section_id = await resolveSection(user_id, school_id, req.query.section_id as string);
    if (!section_id) return res.json({ suggestions: [], plan_date: today });

    const result = await pool.query(PLAN_QUERY, [section_id, today, school_id]);
    if (result.rows.length === 0) return res.json({ suggestions: [], plan_date: today });

    const chunks: { topic_label: string; content: string }[] = result.rows[0].chunks || [];
    if (chunks.length === 0) return res.json({ suggestions: [], plan_date: today });

    const suppResult = await pool.query(
      `SELECT a.title AS activity_title, a.description AS activity_description, ap.name AS pool_name
       FROM supplementary_plans sp
       JOIN activities a ON a.id = sp.activity_id
       JOIN pool_assignments pa ON pa.id = sp.pool_assignment_id
       JOIN activity_pools ap ON ap.id = pa.activity_pool_id
       WHERE sp.section_id = $1 AND sp.plan_date = $2`,
      [section_id, today]
    );

    const suggestions = buildPhotoSuggestions(chunks, suppResult.rows, section_id);
    return res.json({ suggestions, plan_date: today });
  } catch (err) {
    console.error('[PhotoSuggestions]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

function buildPhotoSuggestions(
  chunks: { topic_label: string; content: string }[],
  suppActivities: { activity_title: string; activity_description: string; pool_name: string }[],
  sectionId: string
): { emoji: string; title: string; description: string; subject: string }[] {
  const templates: Record<string, { emoji: string; ideas: string[] }> = {
    math:    { emoji: '🔢', ideas: ['Children counting {topic} with manipulatives on their desks', 'Students showing {topic} work on mini whiteboards', 'Group solving {topic} problems together'] },
    english: { emoji: '📖', ideas: ['Students reading aloud during {topic}', 'Children writing {topic} in their notebooks — close-up', 'Class doing phonics activity for {topic} with letter cards'] },
    art:     { emoji: '🎨', ideas: ['Students creating {topic} artwork — hands and brushes in action', 'Finished {topic} pieces displayed on desks', 'Children mixing colours for {topic}'] },
    science: { emoji: '🔬', ideas: ['Students observing {topic} experiment up close', 'Children recording {topic} in their journals', 'Group discussion around {topic} materials'] },
    evs:     { emoji: '🌿', ideas: ['Students exploring {topic} with nature materials', 'Children drawing {topic} observations', 'Class discussion about {topic} with visual aids'] },
    music:   { emoji: '🎵', ideas: ['Students clapping rhythms during {topic}', 'Children singing together for {topic}', 'Group playing instruments for {topic}'] },
    pe:      { emoji: '⚽', ideas: ['Students doing {topic} warm-up exercises', 'Children playing {topic} game in the yard', 'Class stretching after {topic}'] },
    hindi:   { emoji: '🔤', ideas: ['Students writing {topic} in Hindi notebooks', 'Children reading {topic} aloud from the board', 'Group practising {topic} vocabulary'] },
    gk:      { emoji: '🌍', ideas: ['Students discussing {topic} with a chart', 'Children answering {topic} quiz questions', 'Class exploring {topic} with flashcards'] },
    circle:  { emoji: '🪑', ideas: ['Morning circle — children sharing about {topic}', 'Students sitting in a circle discussing {topic}', 'Group show-and-tell related to {topic}'] },
    story:   { emoji: '📚', ideas: ['Teacher reading {topic} story to attentive students', 'Children acting out scenes from {topic}', 'Students drawing their favourite part of {topic}'] },
    default: { emoji: '📸', ideas: ['Students engaged in {topic} at their desks', 'Children collaborating on {topic}', 'Class working on {topic} — candid learning moment'] },
  };

  const hash = sectionId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  const subjectTopics: { subject: string; topic: string }[] = [];
  for (const chunk of chunks) {
    const label = chunk.topic_label || '';
    const subjectMatch = label.match(/^([A-Za-z\s]+?)(?:\s*[-–:]\s*|\s+\d)/);
    const subject = subjectMatch ? subjectMatch[1].trim() : label.split(' ').slice(0, 2).join(' ');
    subjectTopics.push({ subject, topic: label });
  }
  for (const act of suppActivities) {
    subjectTopics.push({ subject: act.pool_name || 'Activity', topic: act.activity_title });
  }

  const seen = new Set<string>();
  const result: { emoji: string; title: string; description: string; subject: string }[] = [];

  for (const st of subjectTopics) {
    if (result.length >= 5) break;
    const key = st.subject.toLowerCase().split(' ')[0];
    if (seen.has(key)) continue;
    seen.add(key);

    const tmplKey = Object.keys(templates).find(k =>
      st.subject.toLowerCase().includes(k) || st.topic.toLowerCase().includes(k)
    ) || 'default';
    const tmpl = templates[tmplKey];
    const idea = tmpl.ideas[hash % tmpl.ideas.length];
    const shortTopic = st.topic.replace(/^[A-Za-z\s]+[-–:]\s*/, '').trim() || st.topic;

    result.push({
      emoji: tmpl.emoji,
      title: `${st.subject}${shortTopic && shortTopic !== st.subject ? ` — ${shortTopic}` : ''}`,
      description: idea.replace('{topic}', shortTopic || st.subject),
      subject: st.subject,
    });
  }

  const generic = [
    { emoji: '😊', title: 'Happy learners', description: 'Candid shot of students smiling and engaged during class', subject: 'General' },
    { emoji: '🤝', title: 'Teamwork moment', description: "Children helping each other with today's activity", subject: 'General' },
    { emoji: '✋', title: 'Hands up!', description: 'Students raising hands to answer — energy in the classroom', subject: 'General' },
    { emoji: '📝', title: 'Deep focus', description: "Close-up of a student's notebook showing today's work", subject: 'General' },
    { emoji: '🌟', title: 'Star of the moment', description: 'A student proudly showing their completed work', subject: 'General' },
  ];
  let gi = 0;
  while (result.length < 5 && gi < generic.length) result.push(generic[gi++]);

  return result;
}

// GET /api/v1/teacher/plan/:date
router.get('/:date', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const section_id = await resolveSection(user_id, school_id, req.query.section_id as string);
    if (!section_id) {
      return res.json({ plan_date: req.params.date, status: 'no_plan', chunks: [] });
    }
    const result = await pool.query(PLAN_QUERY, [section_id, req.params.date, school_id]);
    if (result.rows.length === 0) {
      return res.json({ plan_date: req.params.date, status: 'no_plan', chunks: [] });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import { getToday } from '../../lib/today';

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

// GET /api/v1/teacher/plan/photo-suggestions
// Returns 5 photo ideas based on today's lesson topics — unique per section
router.get('/photo-suggestions', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const section_id = await resolveSection(user_id, school_id, req.query.section_id as string);

    if (!section_id) {
      return res.json({ suggestions: [], plan_date: today });
    }

    // Fetch today's plan chunks
    const result = await pool.query(PLAN_QUERY, [section_id, today, school_id]);
    if (result.rows.length === 0) {
      return res.json({ suggestions: [], plan_date: today });
    }

    const row = result.rows[0];
    const chunks: { topic_label: string; content: string }[] = row.chunks || [];

    if (chunks.length === 0) {
      return res.json({ suggestions: [], plan_date: today });
    }

    // Also fetch supplementary activities for richer context
    const suppResult = await pool.query(
      `SELECT a.title AS activity_title, a.description AS activity_description, ap.name AS pool_name
       FROM supplementary_plans sp
       JOIN activities a ON a.id = sp.activity_id
       JOIN pool_assignments pa ON pa.id = sp.pool_assignment_id
       JOIN activity_pools ap ON ap.id = pa.activity_pool_id
       WHERE sp.section_id = $1 AND sp.plan_date = $2`,
      [section_id, today]
    );
    const suppActivities: { activity_title: string; activity_description: string; pool_name: string }[] = suppResult.rows;

    // Build photo suggestions from topics + activities
    const suggestions = generatePhotoSuggestions(chunks, suppActivities, section_id);

    return res.json({ suggestions, plan_date: today });
  } catch (err) {
    console.error('[PhotoSuggestions] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Photo suggestion generator ────────────────────────────────────────────────
// Generates 5 unique, activity-specific photo ideas from today's chunks.
// Uses section_id as a seed so different sections get different suggestions.
function generatePhotoSuggestions(
  chunks: { topic_label: string; content: string }[],
  suppActivities: { activity_title: string; activity_description: string; pool_name: string }[],
  sectionId: string
): { emoji: string; title: string; description: string; subject: string }[] {

  // Extract subject → topic pairs from chunks
  const subjectTopics: { subject: string; topic: string; content: string }[] = [];

  for (const chunk of chunks) {
    const label = chunk.topic_label || '';
    const content = chunk.content || '';

    // Try to extract subject from topic label (e.g. "English - Letter B" → "English")
    const subjectMatch = label.match(/^([A-Za-z\s]+?)(?:\s*[-–:]\s*|\s+\d)/);
    const subject = subjectMatch ? subjectMatch[1].trim() : label.split(' ').slice(0, 2).join(' ');

    // Extract first meaningful activity line from content
    const activityLine = content.split('\n')
      .map(l => l.replace(/^[-•*]\s*/, '').trim())
      .find(l => l.length > 10 && !/^(topic|subject|page|chapter|unit|section):/i.test(l)) || label;

    subjectTopics.push({ subject, topic: label, content: activityLine });
  }

  // Add supplementary activities as additional context
  for (const act of suppActivities) {
    subjectTopics.push({
      subject: act.pool_name || 'Activity',
      topic: act.activity_title,
      content: act.activity_description || act.activity_title,
    });
  }

  // Photo idea templates keyed by subject keywords
  const photoTemplates: Record<string, { emoji: string; templates: string[] }> = {
    math:       { emoji: '🔢', templates: ['Children counting {topic} with manipulatives on their desks', 'Students showing their {topic} work on mini whiteboards', 'Group solving {topic} problems together on the floor'] },
    english:    { emoji: '📖', templates: ['Students reading aloud during {topic} session', 'Children writing {topic} on their notebooks — close-up of their work', 'Class doing a phonics activity for {topic} with letter cards'] },
    art:        { emoji: '🎨', templates: ['Students creating their {topic} artwork — hands and brushes in action', 'Finished {topic} art pieces displayed on desks', 'Children mixing colours for {topic} project'] },
    science:    { emoji: '🔬', templates: ['Students observing {topic} experiment up close', 'Children recording {topic} observations in their journals', 'Group discussion around {topic} materials on the table'] },
    evs:        { emoji: '🌿', templates: ['Students exploring {topic} outdoors or with nature materials', 'Children drawing {topic} observations in their books', 'Class discussion about {topic} with visual aids'] },
    music:      { emoji: '🎵', templates: ['Students clapping rhythms during {topic} activity', 'Children singing together for {topic} session', 'Group playing instruments for {topic}'] },
    pe:         { emoji: '⚽', templates: ['Students doing {topic} warm-up exercises', 'Children playing {topic} game in the yard', 'Class stretching after {topic} activity'] },
    hindi:      { emoji: '🔤', templates: ['Students writing {topic} in their Hindi notebooks', 'Children reading {topic} aloud from the board', 'Group activity practising {topic} vocabulary'] },
    gk:         { emoji: '🌍', templates: ['Students discussing {topic} with a map or chart', 'Children answering {topic} quiz questions', 'Class exploring {topic} with visual flashcards'] },
    circle:     { emoji: '🪑', templates: ['Morning circle time — children sharing about {topic}', 'Students sitting in a circle discussing {topic}', 'Group show-and-tell related to {topic}'] },
    story:      { emoji: '📚', templates: ['Teacher reading {topic} story to attentive students', 'Children acting out scenes from {topic}', 'Students drawing their favourite part of {topic}'] },
    default:    { emoji: '📸', templates: ['Students engaged in {topic} activity at their desks', 'Children collaborating on {topic} task', 'Class working on {topic} — candid learning moment'] },
  };

  function getTemplate(subject: string, topic: string): { emoji: string; title: string; description: string } {
    const key = Object.keys(photoTemplates).find(k =>
      subject.toLowerCase().includes(k) || topic.toLowerCase().includes(k)
    ) || 'default';
    const tmpl = photoTemplates[key];

    // Use section_id hash to pick a different template per section
    const hash = sectionId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const idx = hash % tmpl.templates.length;
    const templateStr = tmpl.templates[idx];

    const shortTopic = topic.replace(/^[A-Za-z\s]+[-–:]\s*/, '').trim() || topic;
    const description = templateStr.replace('{topic}', shortTopic);

    return {
      emoji: tmpl.emoji,
      title: `${subject} — ${shortTopic}`,
      description,
    };
  }

  // Pick up to 5 unique subjects
  const seen = new Set<string>();
  const result: { emoji: string; title: string; description: string; subject: string }[] = [];

  for (const st of subjectTopics) {
    if (result.length >= 5) break;
    const subjectKey = st.subject.toLowerCase().split(' ')[0];
    if (seen.has(subjectKey)) continue;
    seen.add(subjectKey);
    const tmpl = getTemplate(st.subject, st.topic);
    result.push({ ...tmpl, subject: st.subject });
  }

  // If fewer than 5, pad with generic class moment suggestions
  const genericSuggestions = [
    { emoji: '😊', title: 'Happy learners', description: 'Candid shot of students smiling and engaged during class', subject: 'General' },
    { emoji: '🤝', title: 'Teamwork moment', description: 'Children helping each other with today\'s activity', subject: 'General' },
    { emoji: '✋', title: 'Hands up!', description: 'Students raising hands to answer a question — energy in the classroom', subject: 'General' },
    { emoji: '📝', title: 'Deep focus', description: 'Close-up of a student\'s notebook showing today\'s work', subject: 'General' },
    { emoji: '🌟', title: 'Star of the moment', description: 'A student proudly showing their completed work to the camera', subject: 'General' },
  ];

  let gi = 0;
  while (result.length < 5 && gi < genericSuggestions.length) {
    result.push(genericSuggestions[gi++]);
  }

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

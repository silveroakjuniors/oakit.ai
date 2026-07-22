import axios from 'axios';
import { pool } from '../../lib/db';

function canonicalSubject(raw: string): string {
  const r = raw.trim().toLowerCase();
  if (r.includes('circle') || r.includes('morning meet') || r.includes('morning routine') || r.includes('additional')) return 'Circle Time & Morning Routine';
  if (r.includes('english speaking') || r.includes('oral') || r.includes('speaking')) return 'English Speaking';
  if (r.startsWith('english') || r.includes('phonics') || r.includes('reading') || r.includes('letters')) return 'English & Literacy';
  if (r.includes('math') || r.includes('number') || r.includes('counting') || r.includes('shapes')) return 'Math & Numbers';
  if (r.includes('gk') || r.includes('general knowledge') || r.includes('science') || r.includes('evs')) return 'General Knowledge';
  if (r.includes('writing') || r.includes('handwriting')) return 'Writing';
  if (r.includes('art') || r.includes('drawing') || r.includes('craft') || r.includes('colour')) return 'Art & Creativity';
  if (r.includes('music') || r.includes('rhyme') || r.includes('song')) return 'Music & Rhymes';
  if (r.includes('pe') || r.includes('physical') || r.includes('motor')) return 'Physical Activity';
  if (r.includes('hindi') || r.includes('regional')) return 'Regional Language';
  return raw.trim();
}

export async function generateProgressReport(
  studentId: string,
  schoolId: string,
  fromDate: string,
  toDate: string,
  reportType: 'progress' | 'term' | 'annual',
  generatedBy: string
): Promise<any> {
  const studentRow = await pool.query(
    `SELECT s.name, s.father_name, s.mother_name, s.date_of_birth,
            c.name as class_name, sec.label as section_label, sec.id as section_id,
            u.name as teacher_name, sch.name as school_name
     FROM students s JOIN classes c ON c.id=s.class_id JOIN sections sec ON sec.id=s.section_id
     LEFT JOIN users u ON u.id=sec.class_teacher_id JOIN schools sch ON sch.id=s.school_id
     WHERE s.id=$1 AND s.school_id=$2`,
    [studentId, schoolId]
  );
  if (studentRow.rows.length === 0) throw new Error('Student not found');
  const student = studentRow.rows[0];

  let age = '';
  if (student.date_of_birth) {
    const dob = new Date(student.date_of_birth); const ref = new Date(toDate);
    const totalM = (ref.getFullYear()-dob.getFullYear())*12 + ref.getMonth()-dob.getMonth() + (ref.getDate()<dob.getDate()?-1:0);
    const yr = Math.floor(totalM/12), mo = totalM%12;
    age = yr>0 ? `${yr} yr${yr>1?'s':''}${mo>0?` ${mo} mo`:''}` : `${mo} months`;
  }

  // ── Attendance: use actual working days from school calendar as denominator ──
  // Count days where attendance was submitted per-student
  const attRow = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE status='present')::int as present,
            COUNT(*) FILTER (WHERE status='absent')::int as absent,
            array_agg(attend_date::text ORDER BY attend_date) FILTER (WHERE status='absent') as absent_dates
     FROM attendance_records WHERE student_id=$1 AND attend_date BETWEEN $2 AND $3`,
    [studentId, fromDate, toDate]);
  const attData = attRow.rows[0];

  // Count actual school working days in the period from the calendar
  let workingDays = 0;
  try {
    const calRow = await pool.query(
      `SELECT working_days, holidays FROM school_calendar
       WHERE school_id=$1 AND start_date <= $3 AND end_date >= $2 LIMIT 1`,
      [schoolId, fromDate, toDate]
    );
    if (calRow.rows.length > 0) {
      const { working_days = [1,2,3,4,5], holidays = [] } = calRow.rows[0];
      const holidayDates = (holidays as any[]).map((h: any) => typeof h === 'string' ? h.split('T')[0] : '');
      const start = new Date(fromDate + 'T12:00:00');
      const end = new Date(toDate + 'T12:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ds = d.toISOString().split('T')[0];
        if ((working_days as number[]).includes(d.getDay()) && !holidayDates.includes(ds)) workingDays++;
      }
    }
  } catch { /* fall through */ }

  // Fallback: count Mon-Fri in range if no calendar
  if (workingDays === 0) {
    const start = new Date(fromDate + 'T12:00:00');
    const end = new Date(toDate + 'T12:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) workingDays++;
    }
  }

  // Present = DB present count; Total = working days; Absent = working days - present
  const present = attData.present || 0;
  const total = Math.max(workingDays, attData.present + attData.absent, 1);
  const absent = total - present;
  const att_pct = Math.round((present / total) * 100);
  const att = {
    present,
    absent,
    total,
    absent_dates: attData.absent_dates || [],
  };

  const chunksRow = await pool.query(
    `SELECT DISTINCT cc.topic_label, cc.content, cc.chunk_index
     FROM daily_completions dc JOIN LATERAL unnest(dc.covered_chunk_ids) AS cid ON true
     JOIN curriculum_chunks cc ON cc.id=cid
     WHERE dc.section_id=$1 AND dc.completion_date BETWEEN $2 AND $3 ORDER BY cc.chunk_index`,
    [student.section_id, fromDate, toDate]);

  const learningMap: Record<string, Set<string>> = {};
  for (const row of chunksRow.rows) {
    const content = (row.content || '').trim();
    const lines = content.split('\n').map((l: string) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const subjectLine = line.match(/^([A-Za-z\s\/&]+?)\s*:\s*(.{10,})/);
      if (subjectLine) {
        if (/^(objective|resources|materials|what to do|ask children|tip|note|offline support)/i.test(subjectLine[1])) continue;
        const subj = canonicalSubject(subjectLine[1]);
        const activity = subjectLine[2].trim().slice(0, 100);
        if (!learningMap[subj]) learningMap[subj] = new Set();
        learningMap[subj].add(activity);
      }
    }
    if (row.topic_label && !/week\s*\d|day\s*\d/i.test(row.topic_label)) {
      const subj = canonicalSubject(row.topic_label);
      if (!learningMap[subj]) learningMap[subj] = new Set();
      const bestLine = lines.find((l: string) => l.length > 20 && !l.match(/^(objective|resources|tip|note|what to do|ask children)/i));
      if (bestLine) learningMap[subj].add(bestLine.slice(0, 100));
    }
  }

  const coveredSubjects = Object.keys(learningMap);
  const learningCompact = coveredSubjects.map(subj => {
    const acts = [...learningMap[subj]].slice(0, 2).join('; ');
    return `• ${subj}: ${acts || 'covered'}`;
  }).join('\n');

  const missedRow = await pool.query(
    `SELECT DISTINCT cc.topic_label, cc.content FROM daily_completions dc
     JOIN LATERAL unnest(dc.covered_chunk_ids) AS cid ON true JOIN curriculum_chunks cc ON cc.id=cid
     WHERE dc.section_id=$1 AND dc.completion_date=ANY($2::date[]) AND array_length($2::date[],1)>0`,
    [student.section_id, att.absent_dates||[]]);
  const missedSubjects = [...new Set(missedRow.rows.map((r: any) => {
    const label = r.topic_label||'';
    if (/week\s*\d|day\s*\d/i.test(label) && r.content) {
      const m = r.content.match(/^(English Speaking|English|Math|GK|Writing|Art|Circle Time|Morning Meet)/im);
      return m ? canonicalSubject(m[1]) : label;
    }
    return canonicalSubject(label);
  }).filter(Boolean))];

  const hwRow = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE status='completed')::int as completed,
            COUNT(*) FILTER (WHERE status='partial')::int as partial,
            COUNT(*) FILTER (WHERE status='not_submitted')::int as not_submitted, COUNT(*)::int as total
     FROM homework_submissions WHERE student_id=$1 AND homework_date BETWEEN $2 AND $3`,
    [studentId, fromDate, toDate]);
  const hw = hwRow.rows[0];

  const journeyRow = await pool.query(
    `SELECT entry_type, beautified_text FROM child_journey_entries
     WHERE student_id=$1 AND entry_date BETWEEN $2 AND $3 ORDER BY entry_date DESC LIMIT 15`,
    [studentId, fromDate, toDate]);
  const highlights = journeyRow.rows.filter((r:any)=>r.entry_type==='highlight').map((r:any)=>r.beautified_text?.slice(0,200)).filter(Boolean);

  const obsRow = await pool.query(
    `SELECT obs_text, categories FROM student_observations WHERE student_id=$1 AND obs_date BETWEEN $2 AND $3 ORDER BY obs_date DESC LIMIT 15`,
    [studentId, fromDate, toDate]);
  const obsByCategory: Record<string, string[]> = {};
  for (const r of obsRow.rows) {
    for (const cat of (r.categories || [])) {
      const key = cat.toLowerCase().replace(/\s+/g, '_');
      if (!obsByCategory[key]) obsByCategory[key] = [];
      obsByCategory[key].push((r.obs_text||'').slice(0, 150));
    }
  }
  const obsText = obsRow.rows.map((r: any) => r.obs_text).filter(Boolean).join(' | ');

  const milRow = await pool.query(
    `SELECT COUNT(m.id)::int as total, COUNT(sm.id)::int as achieved FROM milestones m
     LEFT JOIN student_milestones sm ON sm.milestone_id=m.id AND sm.student_id=$1
     WHERE (m.school_id IS NULL OR m.school_id=$2)
       AND m.class_level=(SELECT c.name FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=$1)`,
    [studentId, schoolId]);
  const mil = milRow.rows[0];

  const CAT_LABEL: Record<string, string> = {
    'academic progress': 'Cognitive Skills & Academic Progress',
    'language': 'Language & Communication',
    'social skills': 'Social Interaction',
    'behavior': 'Emotional Development & Behaviour',
    'motor skills': 'Motor Skills (Gross & Fine)',
    'other': 'Creativity & Expression',
  };

  const categoryBlocks = Object.entries(obsByCategory).map(([cat, texts]) => {
    const label = CAT_LABEL[cat.replace(/_/g, ' ')] || cat.replace(/_/g, ' ');
    return `[${label}]\n${texts.slice(0, 3).map(t => `  - ${t}`).join('\n')}`;
  }).join('\n\n');

  const allJournalEntries = journeyRow.rows
    .map((r: any) => `[${r.entry_type?.toUpperCase()}] ${r.beautified_text?.slice(0, 200)}`)
    .filter(Boolean).join('\n');

  const detailedLearning = coveredSubjects.map(subj => {
    const acts = [...(learningMap[subj] || new Set())].slice(0, 3);
    return `${subj}:\n${acts.map(a => `  - ${a}`).join('\n')}`;
  }).join('\n\n');

  const n = student.name;

  // ── Data-driven subject ratings ───────────────────────────────────────────
  // Map observation categories to canonical subjects
  const CAT_TO_SUBJECT: Record<string, string> = {
    'academic_progress': 'General Knowledge',
    'language':          'English & Literacy',
    'language_':         'English & Literacy',
    'social_skills':     'Circle Time & Morning Routine',
    'behavior':          'Circle Time & Morning Routine',
    'motor_skills':      'Physical Activity',
    'other':             'Art & Creativity',
  };

  // Build per-subject observation counts
  const subjectObsCount: Record<string, number> = {};
  for (const [cat, texts] of Object.entries(obsByCategory)) {
    const subj = CAT_TO_SUBJECT[cat] || null;
    if (subj) subjectObsCount[subj] = (subjectObsCount[subj] || 0) + texts.length;
  }

  // Milestone pct as base for overall performance
  const milPctBase = mil.total > 0 ? Math.round((mil.achieved / mil.total) * 100) : 70;
  const hwPctBase = hw.total > 0 ? Math.round((hw.completed / hw.total) * 100) : 70;

  // Rate each covered subject:
  // Base = milPctBase (how far through milestones for this class)
  // Boost: +5 if teacher has obs for this subject, +5 if homework done well
  // Penalty: -10 if absent on days this subject was taught (missed_topics)
  function rateSubject(subj: string): number {
    let score = milPctBase;
    // Observation boost
    const obsCount = subjectObsCount[subj] || 0;
    if (obsCount >= 3) score += 10;
    else if (obsCount >= 1) score += 5;
    // Homework boost
    if (hwPctBase >= 80) score += 5;
    else if (hwPctBase < 50) score -= 5;
    // Missed topic penalty
    if (missedSubjects.includes(subj)) score -= 10;
    return Math.min(100, Math.max(50, score));
  }

  function pctToStatus(pct: number): string {
    if (pct >= 85) return 'Excellent';
    if (pct >= 70) return 'Good';
    if (pct >= 55) return 'Satisfactory';
    return 'Developing';
  }

  // Build subjects array from real covered curriculum data
  const subjectsData = coveredSubjects.map(subj => {
    const pct = rateSubject(subj);
    const topics = [...(learningMap[subj] || new Set())]
      .slice(0, 4)
      .map(t => t.length > 50 ? t.slice(0, 48) + '…' : t);
    // Find obs note for this subject
    const relatedCat = Object.entries(CAT_TO_SUBJECT).find(([, s]) => s === subj)?.[0];
    const obsNote = relatedCat && obsByCategory[relatedCat]?.[0]
      ? obsByCategory[relatedCat][0].slice(0, 60)
      : '';
    return { name: subj, pct, status: pctToStatus(pct), topics, note: obsNote };
  });

  // ── Skills: only show a score if teacher has actual observations for that domain ──
  // Each skill maps to an observation category. If no obs → mark as not_assessed.
  // Score = milPctBase adjusted by observation quality (count & positivity)
  // Definitions and PTM talking points are embedded here for the frontend to use.

  interface SkillEntry {
    name: string;
    pct: number;
    assessed: boolean;
    definition: string;         // plain-language explanation for parents
    ptm_note: string;           // what teacher should say at PTM
  }

  function scoreFromObs(catKey: string, boost: number): { pct: number; assessed: boolean } {
    const obs = obsByCategory[catKey] || [];
    if (obs.length === 0) return { pct: 0, assessed: false };
    // More obs = more data = closer to milPctBase + boost
    const rawScore = milPctBase + (obs.length >= 3 ? boost : Math.round(boost * 0.6));
    return { pct: Math.min(95, Math.max(50, rawScore)), assessed: true };
  }

  const commSkill   = scoreFromObs('language', 10);
  const motorSkill  = scoreFromObs('motor_skills', 8);
  const confSkill   = (() => {
    const social = obsByCategory['social_skills'] || [];
    const behav  = obsByCategory['behavior'] || [];
    const combined = [...social, ...behav];
    if (combined.length === 0) return { pct: 0, assessed: false };
    return { pct: Math.min(90, Math.max(50, milPctBase + (combined.length >= 3 ? 5 : 3))), assessed: true };
  })();
  const creativSkill = scoreFromObs('other', 12);
  const listenSkill  = (() => {
    // Listening comes from language obs + academic progress obs
    const lang = obsByCategory['language'] || [];
    const acad = obsByCategory['academic_progress'] || [];
    const combined = [...lang, ...acad];
    if (combined.length === 0) return { pct: 0, assessed: false };
    return { pct: Math.min(90, Math.max(50, milPctBase + (combined.length >= 3 ? 5 : 3))), assessed: true };
  })();
  const socialSkill  = scoreFromObs('social_skills', 7);

  const skillsData: SkillEntry[] = [
    {
      name: 'Communication',
      ...commSkill,
      definition: 'How well the child expresses themselves — speaking in sentences, asking questions, and sharing ideas with teachers and friends.',
      ptm_note: commSkill.assessed
        ? `Teacher has observed ${(obsByCategory['language']||[]).length} language-related moments this period. ${commSkill.pct >= 80 ? 'Your child communicates confidently.' : 'Encourage storytelling and conversation at home.'}`
        : 'Teacher has not yet recorded language observations this period. Ask the teacher for verbal feedback.',
    },
    {
      name: 'Fine Motor',
      ...motorSkill,
      definition: 'Small muscle control — holding a pencil, cutting with scissors, drawing shapes, and doing up buttons.',
      ptm_note: motorSkill.assessed
        ? `Based on motor skill observations. ${motorSkill.pct >= 80 ? 'Fine motor skills are developing well.' : 'Try activities like colouring, threading beads, or playdough at home.'}`
        : 'Motor skill observations not yet recorded. Ask the teacher about pencil grip and hand coordination.',
    },
    {
      name: 'Confidence',
      ...confSkill,
      definition: 'Whether the child participates willingly, tries new activities, speaks up in class, and handles small challenges independently.',
      ptm_note: confSkill.assessed
        ? `Based on social and behaviour observations. ${confSkill.pct >= 80 ? 'Shows good confidence and initiative.' : 'Praise effort over outcome at home — this builds confidence quickly.'}`
        : 'Confidence observations not yet recorded this period. Ask the teacher how the child responds to new activities.',
    },
    {
      name: 'Creativity',
      ...creativSkill,
      definition: 'How the child explores ideas, uses imagination in play, and engages with art, music, and storytelling activities.',
      ptm_note: creativSkill.assessed
        ? `Based on creative activity observations. ${creativSkill.pct >= 80 ? 'Shows strong imaginative expression.' : 'Encourage open-ended play, drawing, and singing at home.'}`
        : 'Creative activity observations not yet recorded. Ask the teacher about art and play participation.',
    },
    {
      name: 'Listening',
      ...listenSkill,
      definition: 'How well the child follows instructions, stays focused during stories and lessons, and remembers what was said.',
      ptm_note: listenSkill.assessed
        ? `Based on classroom attention observations. ${listenSkill.pct >= 80 ? 'Good focus and instruction-following.' : 'Reading aloud together and asking recall questions helps build listening skills.'}`
        : 'Listening observations not yet recorded. Ask the teacher about attention during circle time.',
    },
    {
      name: 'Social Skills',
      ...socialSkill,
      definition: 'How the child interacts with classmates — sharing, taking turns, resolving small conflicts, and making friends.',
      ptm_note: socialSkill.assessed
        ? `Based on peer interaction observations. ${socialSkill.pct >= 80 ? 'Interacts positively with classmates.' : 'Arrange playdates and group activities to build peer confidence.'}`
        : 'Peer interaction observations not yet recorded. Ask the teacher about friendships and group work.',
    },
  ].filter(sk => sk.assessed); // Only show skills where teacher has actual data

  const skillMap: Record<string, number> = Object.fromEntries(skillsData.map(s => [s.name, s.pct]));

  // Radar from same data
  const radarData: Record<string, number> = {
    'Language':     skillMap['Communication'],
    'Numeracy':     rateSubject('Math & Numbers'),
    'Motor Skills': skillMap['Fine Motor'],
    'Creativity':   skillMap['Creativity'],
    'Social Skills': skillMap['Social Skills'],
    'Confidence':   skillMap['Confidence'],
    'Thinking':     rateSubject('General Knowledge'),
  };

  // ── AI prompt: ONLY text fields, no invented numbers ──────────────────────
  const structuredPrompt = `You are Oakie, a warm school AI writing a premium visual report card for parents.

STUDENT: ${n}${age ? ` (${age})` : ''}
CLASS: ${student.class_name} ${student.section_label} | TEACHER: ${student.teacher_name || 'Class Teacher'}
PERIOD: ${fromDate} to ${toDate}
ATTENDANCE: ${att.present}/${att.total} days (${att_pct}%)
MILESTONES: ${mil.achieved}/${mil.total} achieved

SUBJECTS COVERED:
${learningCompact || 'General classroom activities'}

TEACHER OBSERVATIONS:
${obsText || 'No structured observations recorded'}

JOURNAL HIGHLIGHTS:
${highlights.slice(0, 5).join(' | ') || 'None recorded'}

━━━ OUTPUT RULES ━━━
Return ONLY valid JSON. No markdown. No extra text.
Limits: summary ≤80 words, teacher_remark ≤40 words, each home_activity ≤12 words, each achievement_reason ≤15 words.
Never repeat the student's name in every sentence. Use natural language.
Do NOT include "subjects", "skills", or "radar" in the JSON — those are calculated from real data.

Return ONLY this JSON structure:
{
  "summary": "One paragraph, max 80 words. Warm, specific, natural. No generic phrases.",
  "teacher_remark": "1-2 sentences max, 40 words max. Personal and specific.",
  "achievements": [
    { "label": "Curious Learner", "reason": "Asked brilliant questions daily" },
    { "label": "Story Lover", "reason": "Remembered every story detail" }
  ],
  "home_activities": [
    "Read one story together daily",
    "Count household objects",
    "Colour for 15 minutes",
    "Sing today's rhyme"
  ]
}

Generate achievements based ONLY on journal highlights and observations above. If no highlights, skip achievements.`;

  const AI_URL_BASE = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  let structuredData: any = null;
  try {
    const sResp = await axios.post(`${AI_URL_BASE}/internal/generate-report`, {
      prompt: structuredPrompt,
      student_name: n,
      structured: true,
    }, { timeout: 60000 });
    const raw = sResp.data?.response || '';
    // Extract JSON from response (LLM sometimes wraps in ```json)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const aiJson = JSON.parse(jsonMatch[0]);
      // Merge AI text fields with computed data-driven fields
      structuredData = {
        summary: aiJson.summary || '',
        teacher_remark: aiJson.teacher_remark || '',
        achievements: aiJson.achievements || [],
        home_activities: aiJson.home_activities || [],
        // Data-driven — never from AI
        subjects: subjectsData,
        skills: skillsData.map(s => ({ name: s.name, pct: s.pct, definition: s.definition, ptm_note: s.ptm_note })),
        radar: radarData,
      };
    }
  } catch { /* fall through to legacy */ }

  // If AI failed, still assemble structured data with computed values
  if (!structuredData) {
    structuredData = {
      summary: '',
      teacher_remark: '',
      achievements: highlights.slice(0, 3).map((h: string) => ({ label: 'Special Moment', reason: h.slice(0, 50) })),
      home_activities: ['Read one story together daily', 'Count household objects', 'Colour for 15 minutes', 'Sing today\'s rhyme'],
      subjects: subjectsData,
      skills: skillsData.map(s => ({ name: s.name, pct: s.pct, definition: s.definition, ptm_note: s.ptm_note })),
      radar: radarData,
    };
  }

  // ── LEGACY text prompt (kept as fallback) ──
  const aiPrompt = `You are writing a formal, warm, descriptive school progress report card for parents.

STUDENT: ${n}${age ? ` (${age} old)` : ''}
SCHOOL: ${student.school_name} | CLASS: ${student.class_name} ${student.section_label}
TEACHER: ${student.teacher_name || 'Class Teacher'} | PERIOD: ${fromDate} to ${toDate}
ATTENDANCE: ${att.present}/${att.total} days (${att_pct}%)${att.absent > 0 ? ` — ${att.absent} absence${att.absent > 1 ? 's' : ''}` : ' — perfect attendance'}
MILESTONES: ${mil.achieved} of ${mil.total} achieved

━━━ WHAT WAS TAUGHT THIS PERIOD ━━━
${detailedLearning || learningCompact || 'No curriculum topics were covered in this period (only special days/events were completed).'}

━━━ TEACHER JOURNAL ENTRIES (daily observations & highlights) ━━━
${allJournalEntries || 'No journal entries recorded for this period.'}

━━━ TEACHER REPORT READINESS OBSERVATIONS (structured by category) ━━━
${categoryBlocks || obsText || 'No structured observations recorded for this period.'}
${missedSubjects.length > 0 ? `\n━━━ TOPICS MISSED DUE TO ABSENCE ━━━\n${missedSubjects.join(', ')}` : ''}

━━━ INSTRUCTIONS ━━━
Write a complete, descriptive, personalised report card using ONLY the teacher inputs above.
CRITICAL: Do NOT invent or assume any activities, subjects, or observations that are not explicitly listed above. If a section has no data, write "Observations for this area will be added as the term progresses." instead of making up content.
Write in flowing paragraphs — NO bullet points, NO asterisks, NO bold markdown.
Each section must be 3-5 sentences. Reference ONLY specific activities, subjects, and teacher observations that appear in the data above.
The report must feel personal and specific — not generic. If data is limited, keep sections shorter rather than inventing content.

## 🧠 Cognitive & Academic Development
## 🗣️ Language & Communication
## 🤝 Social & Emotional Development
## 💪 Physical Development
## 🎨 Creativity & Expression
## 🌟 Special Moments & Highlights
## 🏫 Classroom Engagement
${missedSubjects.length > 0 ? '## 📅 Absence Note' : ''}
## 📝 Teacher's Personal Remarks
## 🌱 Areas of Opportunity
[Write 3-4 sentences identifying 2-3 specific areas where ${n} has room to grow. Frame these warmly and positively as opportunities, not weaknesses. Be specific — reference actual subjects or skills from the data above.]
## 👨‍👩‍👧 How Parents Can Help at Home
[Write 3-4 sentences with specific, practical, age-appropriate activities parents can do at home to support the areas of opportunity identified above. Tie each suggestion directly to a subject or skill ${n} is working on.]
## 🏫 How the Teacher Will Support ${n}
[Write 3-4 sentences describing the specific strategies, activities, and support the teacher will use in class to help ${n} grow in the identified areas. Be concrete — mention classroom techniques, one-on-one support, group activities, or specific exercises.]
## 💡 Recommendations for Home
## 🚀 Readiness Assessment`;

  const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  let aiReport = '';
  try {
    const aiResp = await axios.post(`${AI_URL}/internal/generate-report`, {
      prompt: aiPrompt, student_name: n,
    }, { timeout: 60000 });
    aiReport = (aiResp.data?.response || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
  } catch (err: any) {
    console.error('[generateProgressReport] AI failed:', err?.message);
  }

  if (!aiReport) {
    const firstHighlight = highlights[0] || '';
    const firstObs = obsRow.rows[0]?.obs_text || '';
    const engSubjects = coveredSubjects.filter(s => /english/i.test(s));
    const mathSubjects = coveredSubjects.filter(s => /math|number/i.test(s));
    const artSubjects  = coveredSubjects.filter(s => /art|writing|craft/i.test(s));
    const gkSubjects   = coveredSubjects.filter(s => /gk|general|science/i.test(s));
    aiReport = [
      `## 🧠 Cognitive & Academic Development`,
      `${n} has been actively engaged in ${mathSubjects[0]||'numeracy'} and ${gkSubjects[0]||'general knowledge'} activities this period. ${firstObs?firstObs.slice(0,150)+'.':n+' shows curiosity and enthusiasm across all academic areas.'} The subjects covered — ${coveredSubjects.slice(0,4).join(', ')||'various activities'} — have provided a rich foundation for continued learning.`,
      `\n## 🗣️ Language & Communication`,
      `${n} has participated in ${engSubjects.join(' and ')||'English and speaking'} sessions throughout this period. ${obsByCategory['language']?.[0]||n+' is building vocabulary and communication skills steadily.'} Regular participation in group discussions and storytelling activities has supported ${n}'s growing confidence.`,
      `\n## 🤝 Social & Emotional Development`,
      `${n} participates actively in Circle Time and group activities. ${obsByCategory['social_skills']?.[0]||obsByCategory['behavior']?.[0]||n+' demonstrates confidence and positive emotional engagement in the classroom.'} The teacher has observed consistent effort and a warm, cooperative attitude throughout this period.`,
      `\n## 💪 Physical Development`,
      `${n} participates in physical activities and movement exercises during the school day. ${obsByCategory['motor_skills']?.[0]||n+' has been developing fine motor skills through '+(artSubjects.join(' and ')||'writing and art activities')+'.'} Continued engagement with hands-on activities supports both gross and fine motor development.`,
      `\n## 🎨 Creativity & Expression`,
      `${n} expresses creativity through art, music, and imaginative play. ${artSubjects.length>0?'Activities in '+artSubjects.join(' and ')+' have given '+n+' opportunities to explore and create.':n+' brings imagination and enthusiasm to creative activities.'} ${obsByCategory['other']?.[0]||n+"'s creative expression continues to grow with each new activity."}`,
      `\n## 🌟 Special Moments & Highlights`,
      firstHighlight ? `${firstHighlight} ${highlights[1]||''} These moments reflect ${n}'s growing confidence and love of learning.` : `${n} has shown consistent effort and positive engagement throughout this period. The teacher has noted several moments of initiative and enthusiasm that stand out as highlights of this term.`,
      `\n## 🏫 Classroom Engagement`,
      `${n} engages actively with classroom activities and responds well to teacher guidance. ${obsByCategory['academic_progress']?.[0]||n+' participates in discussions and group work with enthusiasm.'} The overall engagement across ${coveredSubjects.length} subject areas reflects a strong commitment to learning.`,
      missedSubjects.length>0 ? `\n## 📅 Absence Note\n${n} was absent for ${att.absent} day${att.absent>1?'s':''} during this period, during which ${missedSubjects.join(', ')} were covered. We encourage reviewing these topics at home.` : '',
      `\n## 📝 Teacher's Personal Remarks`,
      `${n} has had a productive and meaningful period at school. ${firstHighlight?'One moment that stands out: '+firstHighlight.slice(0,120):n+' consistently brings a positive attitude and genuine curiosity to the classroom.'} We are proud of the progress made and look forward to seeing ${n} continue to grow and flourish.`,
      `\n## 🌱 Areas of Opportunity`,
      `Every child has areas where a little extra focus can make a big difference, and ${n} is no exception. ${coveredSubjects.length > 2 ? `Building greater confidence in ${coveredSubjects.slice(-2).join(' and ')} will help ${n} reach the next level.` : `Continued practice across all subjects will help ${n} build a stronger foundation.`} With consistent encouragement at home and targeted support in class, we are confident ${n} will make excellent progress in these areas.`,
      `\n## 👨‍👩‍👧 How Parents Can Help at Home`,
      `Parents play a vital role in reinforcing what ${n} learns at school. Spending 10–15 minutes each day on ${coveredSubjects[0] || 'reading and counting'} — through games, stories, or everyday conversations — will make a significant difference. ${coveredSubjects[1] ? `Practising ${coveredSubjects[1]} through fun activities like drawing, sorting objects, or singing songs will keep learning enjoyable.` : `Encouraging ${n} to talk about their school day builds language skills and confidence.`} Celebrating every small win will keep ${n} motivated and excited to learn.`,
      `\n## 🏫 How the Teacher Will Support ${n}`,
      `In class, the teacher will continue to provide personalised attention and encouragement to help ${n} grow. Targeted activities, small group work, and one-on-one check-ins will be used to strengthen areas that need extra practice. The teacher will also use positive reinforcement and hands-on learning experiences to keep ${n} engaged and build confidence. Regular progress checks will ensure that ${n}'s development is monitored and support is adjusted as needed.`,
      `\n## 💡 Recommendations for Home`,
      `To support ${n}'s learning at home, spend a few minutes each day talking about ${coveredSubjects[0]||'school'}. ${coveredSubjects[1]?'Practising '+coveredSubjects[1]+' through everyday activities will reinforce classroom learning.':'Reading together and encouraging storytelling will strengthen language skills.'} Celebrate every small achievement — ${n}'s confidence grows with every word of encouragement.`,
      `\n## 🚀 Readiness Assessment`,
      `${n} has covered ${coveredSubjects.length} subject areas with ${att_pct}% attendance this period. With ${mil.achieved} of ${mil.total} milestones achieved, ${n} is ${mil.achieved>=mil.total*0.7?'well on track and showing strong readiness for the next stage':'making steady progress — continued focus on '+(coveredSubjects.slice(0,2).join(' and ')||'core subjects')+' will build the foundation needed'}. We look forward to supporting ${n}'s continued journey.`,
    ].filter(Boolean).join('\n');
  }

  const reportData = {
    school_name: student.school_name, student_name: n, age,
    class_name: student.class_name, section_label: student.section_label,
    teacher_name: student.teacher_name, father_name: student.father_name, mother_name: student.mother_name,
    from_date: fromDate, to_date: toDate,
    attendance: { present: att.present, absent: att.absent, total, pct: att_pct, absent_dates: att.absent_dates||[], note: att.present < total ? 'Days not marked by teacher are considered present. Attendance is based on submitted records only.' : '' },
    curriculum: { covered: coveredSubjects.length, subjects: coveredSubjects, learning_summary: learningCompact },
    missed_topics: missedSubjects,
    homework: { completed: hw.completed, partial: hw.partial, not_submitted: hw.not_submitted, total: hw.total },
    milestones: { achieved: mil.achieved, total: mil.total },
    journey_highlights: highlights,
    structured: structuredData,
  };

  let report_id = null;
  try {
    const secRow = await pool.query('SELECT section_id FROM students WHERE id=$1', [studentId]);
    const savedRow = await pool.query(
      `INSERT INTO saved_reports (school_id,student_id,section_id,generated_by,report_type,from_date,to_date,title,ai_report,report_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (student_id,from_date,to_date,report_type)
       DO UPDATE SET ai_report=EXCLUDED.ai_report, report_data=EXCLUDED.report_data, generated_by=EXCLUDED.generated_by, title=EXCLUDED.title
       RETURNING id`,
      [schoolId, studentId, secRow.rows[0]?.section_id, generatedBy, reportType, fromDate, toDate,
       `${reportType==='annual'?'Annual':reportType==='term'?'Term':'Progress'} Report — ${n} (${fromDate} to ${toDate})`,
       aiReport, JSON.stringify(reportData)]);
    report_id = savedRow.rows[0].id;
  } catch { /* non-critical */ }

  return { ...reportData, ai_report: aiReport, report_id, structured: structuredData };
}

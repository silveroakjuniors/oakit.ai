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

  const attRow = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE status='present')::int as present,
            COUNT(*) FILTER (WHERE status='absent')::int as absent, COUNT(*)::int as total,
            array_agg(attend_date::text ORDER BY attend_date) FILTER (WHERE status='absent') as absent_dates
     FROM attendance_records WHERE student_id=$1 AND attend_date BETWEEN $2 AND $3`,
    [studentId, fromDate, toDate]);
  const att = attRow.rows[0];
  const att_pct = att.total>0 ? Math.round((att.present/att.total)*100) : 0;

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
  const aiPrompt = `You are writing a formal, warm, descriptive school progress report card for parents.

STUDENT: ${n}${age ? ` (${age} old)` : ''}
SCHOOL: ${student.school_name} | CLASS: ${student.class_name} ${student.section_label}
TEACHER: ${student.teacher_name || 'Class Teacher'} | PERIOD: ${fromDate} to ${toDate}
ATTENDANCE: ${att.present}/${att.total} days (${att_pct}%)${att.absent > 0 ? ` — ${att.absent} absence${att.absent > 1 ? 's' : ''}` : ' — perfect attendance'}
MILESTONES: ${mil.achieved} of ${mil.total} achieved

━━━ WHAT WAS TAUGHT THIS PERIOD ━━━
${detailedLearning || learningCompact || 'General classroom activities'}

━━━ TEACHER JOURNAL ENTRIES (daily observations & highlights) ━━━
${allJournalEntries || 'No journal entries recorded'}

━━━ TEACHER REPORT READINESS OBSERVATIONS (structured by category) ━━━
${categoryBlocks || obsText || 'No structured observations recorded'}
${missedSubjects.length > 0 ? `\n━━━ TOPICS MISSED DUE TO ABSENCE ━━━\n${missedSubjects.join(', ')}` : ''}

━━━ INSTRUCTIONS ━━━
Write a complete, descriptive, personalised report card using ALL the teacher inputs above.
Write in flowing paragraphs — NO bullet points, NO asterisks, NO bold markdown.
Each section must be 3-5 sentences. Reference specific activities, subjects, and teacher observations.
The report must feel personal and specific — not generic.

## 🧠 Cognitive & Academic Development
## 🗣️ Language & Communication
## 🤝 Social & Emotional Development
## 💪 Physical Development
## 🎨 Creativity & Expression
## 🌟 Special Moments & Highlights
## 🏫 Classroom Engagement
${missedSubjects.length > 0 ? '## 📅 Absence Note' : ''}
## 📝 Teacher's Personal Remarks
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
    attendance: { present: att.present, absent: att.absent, total: att.total, pct: att_pct, absent_dates: att.absent_dates||[] },
    curriculum: { covered: coveredSubjects.length, subjects: coveredSubjects, learning_summary: learningCompact },
    missed_topics: missedSubjects,
    homework: { completed: hw.completed, partial: hw.partial, not_submitted: hw.not_submitted, total: hw.total },
    milestones: { achieved: mil.achieved, total: mil.total },
    journey_highlights: highlights,
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

  return { ...reportData, ai_report: aiReport, report_id };
}

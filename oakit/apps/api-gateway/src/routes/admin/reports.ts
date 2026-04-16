import { Router, Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'));

// Helper: generate student report as plain JSON (PDF generation via reportlab in AI service)
async function getStudentReportData(studentId: string, schoolId: string) {
  const studentRow = await pool.query(
    `SELECT s.name, s.father_name, s.mother_name, c.name as class_name, sec.label as section_label, sec.id as section_id
     FROM students s JOIN classes c ON c.id = s.class_id JOIN sections sec ON sec.id = s.section_id
     WHERE s.id = $1 AND s.school_id = $2`,
    [studentId, schoolId]
  );
  if (studentRow.rows.length === 0) return null;
  const student = studentRow.rows[0];

  // Attendance
  const attRow = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE status='present') as present,
            COUNT(*) FILTER (WHERE status='absent') as absent,
            COUNT(*) as total
     FROM attendance_records WHERE student_id = $1`,
    [studentId]
  );
  const att = attRow.rows[0];
  const att_pct = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;

  // Curriculum coverage
  const covRow = await pool.query(
    `SELECT COUNT(DISTINCT cc.id)::int as total,
            COUNT(DISTINCT dc_chunks.chunk_id)::int as covered
     FROM curriculum_documents cd
     JOIN curriculum_chunks cc ON cc.document_id = cd.id
     LEFT JOIN (
       SELECT unnest(covered_chunk_ids) as chunk_id FROM daily_completions WHERE section_id = $1
     ) dc_chunks ON dc_chunks.chunk_id = cc.id
     WHERE cd.class_id = (SELECT class_id FROM students WHERE id = $2) AND cd.school_id = $3`,
    [student.section_id, studentId, schoolId]
  );
  const cov = covRow.rows[0];
  const cov_pct = cov.total > 0 ? Math.round((cov.covered / cov.total) * 100) : 0;

  // Milestones
  const milRow = await pool.query(
    `SELECT COUNT(m.id)::int as total,
            COUNT(sm.id)::int as achieved
     FROM milestones m
     LEFT JOIN student_milestones sm ON sm.milestone_id = m.id AND sm.student_id = $1
     WHERE (m.school_id IS NULL OR m.school_id = $2)
       AND m.class_level = (SELECT c.name FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = $1)`,
    [studentId, schoolId]
  );
  const mil = milRow.rows[0];
  const mil_pct = mil.total > 0 ? Math.round((mil.achieved / mil.total) * 100) : 0;

  // Shared observations
  const obsRow = await pool.query(
    `SELECT obs_text, categories, obs_date FROM student_observations
     WHERE student_id = $1 AND share_with_parent = true ORDER BY obs_date DESC`,
    [studentId]
  );

  // School name
  const schoolRow = await pool.query('SELECT name FROM schools WHERE id = $1', [schoolId]);

  return {
    school_name: schoolRow.rows[0]?.name ?? 'School',
    student_name: student.name,
    class_name: student.class_name,
    section_label: student.section_label,
    father_name: student.father_name,
    mother_name: student.mother_name,
    attendance: { present: Number(att.present), absent: Number(att.absent), total: Number(att.total), pct: att_pct },
    curriculum: { covered: Number(cov.covered), total: Number(cov.total), pct: cov_pct },
    milestones: { achieved: Number(mil.achieved), total: Number(mil.total), pct: mil_pct },
    observations: obsRow.rows,
  };
}

// GET /api/v1/admin/reports/student/:studentId — JSON report data
router.get('/student/:studentId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const data = await getStudentReportData(req.params.studentId, school_id);
    if (!data) return res.status(404).json({ error: 'Student not found' });
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/reports/section/:sectionId — all students in section
router.get('/section/:sectionId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const students = await pool.query(
      'SELECT id, name FROM students WHERE section_id = $1 AND school_id = $2 AND is_active = true ORDER BY name',
      [req.params.sectionId, school_id]
    );
    const reports = await Promise.all(
      students.rows.map(s => getStudentReportData(s.id, school_id))
    );
    return res.json(reports.filter(Boolean));
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/reports/school — school summary
router.get('/school', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;

    const [schoolRow, statsRow, coverageRows] = await Promise.all([
      pool.query('SELECT name FROM schools WHERE id = $1', [school_id]),
      pool.query(
        `SELECT
           COUNT(DISTINCT s.id)::int as total_students,
           COUNT(DISTINCT ar.student_id) FILTER (WHERE ar.status = 'present')::int as present_total,
           COUNT(DISTINCT ar.id)::int as att_records
         FROM students s
         LEFT JOIN attendance_records ar ON ar.student_id = s.id
         WHERE s.school_id = $1`,
        [school_id]
      ),
      pool.query(
        `SELECT sec.id, sec.label, c.name as class_name,
                COUNT(DISTINCT cc.id)::int as total_chunks,
                COUNT(DISTINCT dc_chunks.chunk_id)::int as covered_chunks
         FROM sections sec
         JOIN classes c ON c.id = sec.class_id
         LEFT JOIN curriculum_documents cd ON cd.class_id = sec.class_id AND cd.school_id = $1
         LEFT JOIN curriculum_chunks cc ON cc.document_id = cd.id
         LEFT JOIN (SELECT unnest(covered_chunk_ids) as chunk_id, section_id FROM daily_completions WHERE school_id = $1) dc_chunks
           ON dc_chunks.chunk_id = cc.id AND dc_chunks.section_id = sec.id
         WHERE sec.school_id = $1
         GROUP BY sec.id, sec.label, c.name, c.id ORDER BY c.name, sec.label`,
        [school_id]
      ),
    ]);

    const stats = statsRow.rows[0];
    const overall_att = stats.att_records > 0 ? Math.round((stats.present_total / stats.att_records) * 100) : 0;

    const sections = coverageRows.rows.map((r: any) => ({
      class_name: r.class_name,
      section_label: r.label,
      coverage_pct: r.total_chunks > 0 ? Math.round((r.covered_chunks / r.total_chunks) * 100) : 0,
      total_chunks: r.total_chunks,
      covered_chunks: r.covered_chunks,
    }));

    const overall_cov = sections.length > 0
      ? Math.round(sections.reduce((s: number, r: any) => s + r.coverage_pct, 0) / sections.length)
      : 0;

    return res.json({
      school_name: schoolRow.rows[0]?.name ?? 'School',
      total_students: stats.total_students,
      overall_attendance_pct: overall_att,
      overall_coverage_pct: overall_cov,
      sections,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/reports/progress-report?student_id=&from=&to=
router.get('/progress-report', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const { student_id, from, to, report_type: reqReportType } = req.query as Record<string, string>;
    if (!student_id) return res.status(400).json({ error: 'student_id required' });
    const fromDate = from || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
    const toDate   = to   || new Date().toISOString().split('T')[0];
    const reportType = reqReportType === 'annual' ? 'annual' : reqReportType === 'term' ? 'term' : 'progress';

    const studentRow = await pool.query(
      `SELECT s.name, s.father_name, s.mother_name, s.date_of_birth,
              c.name as class_name, sec.label as section_label, sec.id as section_id,
              u.name as teacher_name, sch.name as school_name
       FROM students s JOIN classes c ON c.id=s.class_id JOIN sections sec ON sec.id=s.section_id
       LEFT JOIN users u ON u.id=sec.class_teacher_id JOIN schools sch ON sch.id=s.school_id
       WHERE s.id=$1 AND s.school_id=$2`, [student_id, school_id]);
    if (studentRow.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
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
      [student_id, fromDate, toDate]);
    const att = attRow.rows[0];
    const att_pct = att.total>0 ? Math.round((att.present/att.total)*100) : 0;

    // Get actual chunk content for rich report — extract real learning activities
    const chunksRow = await pool.query(
      `SELECT DISTINCT cc.topic_label, cc.content, cc.chunk_index
       FROM daily_completions dc JOIN LATERAL unnest(dc.covered_chunk_ids) AS cid ON true
       JOIN curriculum_chunks cc ON cc.id=cid
       WHERE dc.section_id=$1 AND dc.completion_date BETWEEN $2 AND $3 ORDER BY cc.chunk_index`,
      [student.section_id, fromDate, toDate]);

    // Build a rich learning summary from chunk content
    // Key: canonical subject name → array of specific activities/topics learned
    const learningMap: Record<string, Set<string>> = {};

    // Canonical subject normaliser — prevents duplicates like "Circle Time" + "Circle Time / Morning Meet"
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

    // Extract specific learning content from each chunk
    for (const row of chunksRow.rows) {
      const content = (row.content || '').trim();
      const lines = content.split('\n').map((l: string) => l.trim()).filter(Boolean);

      for (const line of lines) {
        // Pattern: "Subject: activity description"
        const subjectLine = line.match(/^([A-Za-z\s\/&]+?)\s*:\s*(.{10,})/);
        if (subjectLine) {
          const subj = canonicalSubject(subjectLine[1]);
          const activity = subjectLine[2].trim().slice(0, 100);
          // Skip meta-lines like "Objective:", "Resources:", "What to do:", "Ask children:"
          if (/^(objective|resources|materials|what to do|ask children|tip|note|offline support)/i.test(subjectLine[1])) continue;
          if (!learningMap[subj]) learningMap[subj] = new Set();
          learningMap[subj].add(activity);
        }
      }

      // Also use topic_label if it's meaningful (not "Week X Day Y")
      if (row.topic_label && !/week\s*\d|day\s*\d/i.test(row.topic_label)) {
        const subj = canonicalSubject(row.topic_label);
        if (!learningMap[subj]) learningMap[subj] = new Set();
        // Extract the most meaningful line from content as the activity
        const bestLine = lines.find((l: string) => l.length > 20 && !l.match(/^(objective|resources|tip|note|what to do|ask children)/i));
        if (bestLine) learningMap[subj].add(bestLine.slice(0, 100));
      }
    }

    // Build human-readable learning summary
    const coveredSubjects = Object.keys(learningMap);
    const learningSummary = coveredSubjects.map(subj => {
      const activities = [...learningMap[subj]].slice(0, 3);
      return `${subj}:\n  - ${activities.join('\n  - ')}`;
    }).join('\n\n');

    // Compact version for prompt (avoid token overflow)
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
      [student_id, fromDate, toDate]);
    const hw = hwRow.rows[0];

    const journeyRow = await pool.query(
      `SELECT entry_type, beautified_text FROM child_journey_entries
       WHERE student_id=$1 AND entry_date BETWEEN $2 AND $3 ORDER BY entry_date DESC LIMIT 10`,
      [student_id, fromDate, toDate]);
    const highlights = journeyRow.rows.filter((r:any)=>r.entry_type==='highlight').map((r:any)=>r.beautified_text?.slice(0,150)).filter(Boolean);
    const dailyObs = journeyRow.rows.filter((r:any)=>r.entry_type!=='highlight').map((r:any)=>r.beautified_text?.slice(0,100)).filter(Boolean);

    const obsRow = await pool.query(
      `SELECT obs_text, categories FROM student_observations WHERE student_id=$1 AND obs_date BETWEEN $2 AND $3 ORDER BY obs_date DESC LIMIT 10`,
      [student_id, fromDate, toDate]);

    // Build structured observations by category for report sections
    const obsByCategory: Record<string, string[]> = {};
    for (const r of obsRow.rows) {
      const text = r.obs_text || '';
      for (const cat of (r.categories || [])) {
        const key = cat.toLowerCase().replace(/\s+/g, '_');
        if (!obsByCategory[key]) obsByCategory[key] = [];
        obsByCategory[key].push(text.slice(0, 120));
      }
    }
    const obsText = obsRow.rows.map((r: any) => r.obs_text).filter(Boolean).join(' | ');

    const milRow = await pool.query(
      `SELECT COUNT(m.id)::int as total, COUNT(sm.id)::int as achieved FROM milestones m
       LEFT JOIN student_milestones sm ON sm.milestone_id=m.id AND sm.student_id=$1
       WHERE (m.school_id IS NULL OR m.school_id=$2)
         AND m.class_level=(SELECT c.name FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=$1)`,
      [student_id, school_id]);
    const mil = milRow.rows[0];

    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    // Build structured obs context for AI
    const structuredObs = Object.entries(obsByCategory).map(([cat, texts]) =>
      `${cat.replace(/_/g, ' ')}: ${texts.slice(0, 2).join('; ')}`
    ).join('\n');

    const aiPrompt = `Generate a warm, meaningful school progress report for ${student.name}.

SCHOOL: ${student.school_name}
STUDENT: ${student.name}${age ? ` (${age} old)` : ''} | CLASS: ${student.class_name} ${student.section_label}
TEACHER: ${student.teacher_name || 'Class Teacher'} | PERIOD: ${fromDate} to ${toDate}
ATTENDANCE: ${att.present}/${att.total} days (${att_pct}%)${att.absent > 0 ? ` — ${att.absent} day${att.absent > 1 ? 's' : ''} absent` : ' — perfect!'}
SUBJECTS COVERED: ${coveredSubjects.join(', ') || 'General activities'}
${missedSubjects.length > 0 ? `MISSED WHEN ABSENT: ${missedSubjects.join(', ')}` : ''}
HIGHLIGHTS: ${highlights.slice(0, 2).join(' | ') || 'Regular participation'}
${structuredObs ? `TEACHER OBSERVATIONS:\n${structuredObs}` : `TEACHER NOTES: ${obsText || 'Positive progress'}`}

Write a warm school progress report. Flowing sentences only — NO bullet points, NO bold, NO asterisks. 2-3 sentences per section. Use ${student.name}'s name throughout.

## 🧠 Learning & Development
Cognitive Skills: [Math, GK — what ${student.name} explored]
Language & Communication: [English Speaking, English — specific activities]
Social Interaction: [Circle Time, group work]
Emotional Development: [Confidence, empathy, growth]

## 💪 Physical Development
Gross Motor Skills: [Movement, coordination]
Fine Motor Skills: [Writing, art, pencil grip]

## 📊 Observations & Insights
Key Strengths: [3 specific strengths from highlights and observations]
Growth Areas: [2 areas framed positively]
Behavioral Observations: [From teacher notes]

## 🏫 Engagement & Experience
Classroom Participation: [How actively ${student.name} engages]
Peer Interaction: [Social behaviour]
Creativity & Expression: [Art, stories, imagination]

${missedSubjects.length > 0 ? `## 📅 Absence Impact\n[Warm note: ${att.absent} day${att.absent > 1 ? 's' : ''} absent, missed ${missedSubjects.join(', ')}, reassurance + one home suggestion]` : ''}

## 📝 Teacher Remarks
[Personal 2-3 sentence note, reference a specific moment, warm sign-off]

## 💡 Parent Support Recommendations
[3 practical home suggestions tied to subjects covered]

## 🚀 Readiness for Next Level
[2-3 sentences: honest, encouraging assessment of ${student.name}'s readiness based on milestones, subjects covered, and overall engagement. What is ${student.name} ready for? What should be focused on before moving up?]`;

    let aiReport = '';
    let aiError = '';
    try {
      const aiResp = await axios.post(`${AI_URL}/internal/generate-report`, {
        prompt: aiPrompt,
        student_name: student.name,
      }, { timeout: 60000 });
      aiReport = (aiResp.data?.response || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
    } catch (err: any) {
      aiError = err?.message || 'AI unavailable';
      console.error('[progress-report] AI call failed:', aiError);
    }

    if (!aiReport) {
      const engSubjects = coveredSubjects.filter(s => /english/i.test(s));
      const mathSubjects = coveredSubjects.filter(s => /math|number/i.test(s));
      const artSubjects  = coveredSubjects.filter(s => /art|writing|craft/i.test(s));
      const gkSubjects   = coveredSubjects.filter(s => /gk|general|science/i.test(s));

      aiReport = [
        `## 🧠 Learning & Development`,
        `Cognitive Skills: ${student.name} engaged with ${mathSubjects[0] || 'numeracy'} and ${gkSubjects[0] || 'general knowledge'} activities, showing curiosity and enthusiasm.`,
        `Language & Communication: ${student.name} participated in ${engSubjects.join(' and ') || 'English and speaking'} sessions, building vocabulary and confidence.`,
        `Social Interaction: ${student.name} participates actively in Circle Time and group activities, showing positive engagement with peers.`,
        `Emotional Development: ${student.name} demonstrates confidence and positive emotional engagement in the classroom.`,
        ``,
        `## 💪 Physical Development`,
        `Gross Motor Skills: ${student.name} participates in physical activities and movement exercises during the school day.`,
        `Fine Motor Skills: ${artSubjects.length > 0 ? `${student.name} has been developing fine motor skills through ${artSubjects.join(' and ')}.` : `${student.name} has been developing fine motor skills through writing and art activities.`}`,
        ``,
        `## 📊 Observations & Insights`,
        `Key Strengths: ${student.name} shows enthusiasm for learning and participates actively. ${highlights.length > 0 ? highlights[0].slice(0, 100) : `${student.name} brings positive energy to the classroom.`}`,
        `Growth Areas: Continued practice with ${coveredSubjects.slice(-2).join(' and ') || 'all subjects'} will help ${student.name} build further confidence.`,
        `Behavioral Observations: ${student.name} demonstrates positive behaviour and a willingness to learn.`,
        ``,
        `## 🏫 Engagement & Experience`,
        `Classroom Participation: ${student.name} engages actively with classroom activities and responds well to teacher guidance.`,
        `Peer Interaction: ${student.name} interacts positively with classmates during group activities and Circle Time.`,
        `Creativity & Expression: ${student.name} expresses creativity through art and storytelling activities.`,
        ``,
        missedSubjects.length > 0 ? `## 📅 Absence Impact\n${student.name} was absent for ${att.absent} day${att.absent > 1 ? 's' : ''} and missed ${missedSubjects.join(', ')}. The school has worked to help ${student.name} catch up. We recommend reviewing these topics at home.\n` : '',
        `## 📝 Teacher Remarks`,
        `${student.name} has had a productive and positive period. We are proud of the progress made across ${coveredSubjects.length} areas of learning. We look forward to continued growth and achievement.`,
        ``,
        `## 💡 Parent Support Recommendations`,
        `1. ${coveredSubjects[0] ? `Talk with ${student.name} about ${coveredSubjects[0]} — ask what was learned in class.` : `Talk with ${student.name} about school each day.`}`,
        `2. ${coveredSubjects[1] ? `Practise ${coveredSubjects[1]} through everyday activities and play.` : `Encourage reading and storytelling together.`}`,
        `3. Celebrate every small achievement to build ${student.name}'s confidence.`,
        ``,
        `## 🚀 Readiness for Next Level`,
        `${student.name} has covered ${coveredSubjects.length} subject areas with ${att_pct}% attendance. With ${mil.achieved} of ${mil.total} milestones achieved, ${student.name} is ${mil.achieved >= mil.total * 0.7 ? 'well on track and showing strong readiness for the next level' : 'making steady progress — continued focus on ' + (coveredSubjects.slice(0, 2).join(' and ') || 'core subjects') + ' will build the foundation needed for the next stage'}.`,
      ].filter(Boolean).join('\n');
    }

    const reportData = {
      school_name: student.school_name, student_name: student.name, age,
      class_name: student.class_name, section_label: student.section_label,
      teacher_name: student.teacher_name, father_name: student.father_name, mother_name: student.mother_name,
      from_date: fromDate, to_date: toDate,
      attendance: { present: att.present, absent: att.absent, total: att.total, pct: att_pct, absent_dates: att.absent_dates || [] },
      curriculum: { covered: coveredSubjects.length, subjects: coveredSubjects, learning_summary: learningCompact },
      missed_topics: missedSubjects,
      homework: { completed: hw.completed, partial: hw.partial, not_submitted: hw.not_submitted, total: hw.total },
      milestones: { achieved: mil.achieved, total: mil.total },
      journey_highlights: highlights,
    };

    // Save to DB — upsert to prevent duplicates for same period
    let report_id = null;
    try {
      const secRow = await pool.query('SELECT section_id FROM students WHERE id=$1', [student_id]);
      const savedRow = await pool.query(
        `INSERT INTO saved_reports (school_id,student_id,section_id,generated_by,report_type,from_date,to_date,title,ai_report,report_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (student_id,from_date,to_date,report_type)
         DO UPDATE SET ai_report=EXCLUDED.ai_report, report_data=EXCLUDED.report_data,
                       generated_by=EXCLUDED.generated_by, title=EXCLUDED.title
         RETURNING id`,
        [school_id, student_id, secRow.rows[0]?.section_id, user_id, reportType, fromDate, toDate,
         `${reportType === 'annual' ? 'Annual' : reportType === 'term' ? 'Term' : 'Progress'} Report — ${student.name} (${fromDate} to ${toDate})`, aiReport, JSON.stringify(reportData)]);
      report_id = savedRow.rows[0].id;
    } catch { /* non-critical */ }

    return res.json({ ...reportData, ai_report: aiReport, report_id });
  } catch (err) {
    console.error('[progress-report]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/reports/saved — list saved reports
router.get('/saved', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { student_id, section_id } = req.query as Record<string,string>;
    let q = `SELECT id, student_id, report_type, from_date::text, to_date::text, title, shared_with_parent, created_at::text,
                    report_data->>'student_name' as student_name, report_data->>'class_name' as class_name
             FROM saved_reports WHERE school_id=$1`;
    const params: any[] = [school_id];
    if (student_id) { params.push(student_id); q += ` AND student_id=$${params.length}`; }
    if (section_id) { params.push(section_id); q += ` AND section_id=$${params.length}`; }
    q += ' ORDER BY created_at DESC LIMIT 50';
    return res.json((await pool.query(q, params)).rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/v1/admin/reports/saved/:id
router.get('/saved/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const r = await pool.query(
      `SELECT *, from_date::text, to_date::text, created_at::text FROM saved_reports WHERE id=$1 AND school_id=$2`,
      [req.params.id, school_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    const row = r.rows[0];
    return res.json({ ...row.report_data, ai_report: row.ai_report, report_id: row.id, report_type: row.report_type, shared_with_parent: row.shared_with_parent });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/v1/admin/reports/saved/:id/pdf — download as PDF
router.get('/saved/:id/pdf', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const r = await pool.query(
      `SELECT *, from_date::text, to_date::text FROM saved_reports WHERE id=$1 AND school_id=$2`,
      [req.params.id, school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    const row = r.rows[0];
    const d = row.report_data as any;

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
      from_date: row.from_date || '',
      to_date: row.to_date || '',
      attendance_pct: d.attendance?.pct || 0,
      attendance_present: d.attendance?.present || 0,
      attendance_total: d.attendance?.total || 0,
      curriculum_covered: d.curriculum?.covered || 0,
      milestones_achieved: d.milestones?.achieved || 0,
      milestones_total: d.milestones?.total || 0,
      homework_completed: d.homework?.completed || 0,
      homework_total: d.homework?.total || 0,
      ai_report: row.ai_report || '',
    }, { responseType: 'arraybuffer', timeout: 30000 });

    const fname = `Progress_Report_${(d.student_name || 'report').replace(/\s+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(Buffer.from(aiResp.data));
  } catch (err) {
    console.error('[report pdf]', err);
    return res.status(500).json({ error: 'PDF generation failed' });
  }
});

// PATCH /api/v1/admin/reports/saved/:id — update report content
router.patch('/saved/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { ai_report } = req.body;
    if (!ai_report?.trim()) return res.status(400).json({ error: 'ai_report required' });
    const r = await pool.query(
      'UPDATE saved_reports SET ai_report=$1 WHERE id=$2 AND school_id=$3 RETURNING id',
      [ai_report.trim(), req.params.id, school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    return res.json({ message: 'Updated' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/v1/admin/reports/saved/:id
router.delete('/saved/:id', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const r = await pool.query(
      'DELETE FROM saved_reports WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    return res.json({ message: 'Deleted' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/v1/admin/reports/saved/:id/share
router.post('/saved/:id/share', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const r = await pool.query(
      `UPDATE saved_reports SET shared_with_parent=true, shared_at=now() WHERE id=$1 AND school_id=$2 RETURNING id`,
      [req.params.id, school_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    return res.json({ message: 'Shared with parent' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/v1/admin/reports/term-report — combine saved reports into term/annual
router.post('/term-report', async (req: Request, res: Response) => {
  try {
    const { school_id, user_id } = req.user!;
    const { student_id, report_ids, report_type = 'term', title } = req.body;
    if (!student_id || !Array.isArray(report_ids) || !report_ids.length)
      return res.status(400).json({ error: 'student_id and report_ids required' });

    const reportsRow = await pool.query(
      `SELECT ai_report, report_data, from_date::text, to_date::text FROM saved_reports
       WHERE id=ANY($1::uuid[]) AND school_id=$2 AND student_id=$3 ORDER BY from_date`,
      [report_ids, school_id, student_id]);
    if (!reportsRow.rows.length) return res.status(404).json({ error: 'No reports found' });

    const reports = reportsRow.rows;
    const firstData = reports[0].report_data as any;
    const fromDate = reports[0].from_date, toDate = reports[reports.length-1].to_date;

    let totalPresent=0, totalAbsent=0, totalDays=0, totalHwDone=0, totalHwAll=0;
    const allSubjects = new Set<string>();
    const allHighlights: string[] = [];
    for (const r of reports) {
      const d = r.report_data as any;
      totalPresent += d.attendance?.present||0; totalAbsent += d.attendance?.absent||0; totalDays += d.attendance?.total||0;
      totalHwDone += d.homework?.completed||0; totalHwAll += d.homework?.total||0;
      (d.curriculum?.subjects||[]).forEach((s:string)=>allSubjects.add(s));
      (d.journey_highlights||[]).forEach((h:string)=>allHighlights.push(h.slice(0,100)));
    }
    const att_pct = totalDays>0 ? Math.round((totalPresent/totalDays)*100) : 0;

    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const termPrompt = `Generate a ${report_type==='annual'?'Annual':'Term'} Progress Report for ${firstData.student_name}.
SCHOOL: ${firstData.school_name} | CLASS: ${firstData.class_name} ${firstData.section_label}
PERIOD: ${fromDate} to ${toDate} (${reports.length} periods combined)
ATTENDANCE: ${totalPresent}/${totalDays} (${att_pct}%) | SUBJECTS: ${[...allSubjects].join(', ')}
HOMEWORK: ${totalHwDone}/${totalHwAll} | HIGHLIGHTS: ${allHighlights.slice(0,5).join(' | ')}

INDIVIDUAL PERIOD SUMMARIES:
${reports.map((r,i)=>`Period ${i+1} (${r.from_date} to ${r.to_date}):\n${r.ai_report.slice(0,800)}`).join('\n\n---\n\n').slice(0,4000)}

Generate a comprehensive ${report_type==='annual'?'Annual':'Term'} report synthesising all periods. Use same ## section structure. Add:
## 📈 Growth Journey
[How ${firstData.student_name} progressed from start to end — specific improvements]
## 🏆 ${report_type==='annual'?'Year':'Term'} Highlights
[Top 3 memorable achievements across all periods]`;

    let termReport = '';
    try {
      const aiResp = await axios.post(`${AI_URL}/internal/generate-report`,
        { prompt: termPrompt, student_name: firstData.student_name }, { timeout: 90000 });
      termReport = aiResp.data?.response || '';
    } catch { termReport = reports.map((r: any, i: number) => `=== Period ${i+1} ===\n${r.ai_report}`).join('\n\n'); }

    const termData = { ...firstData, from_date: fromDate, to_date: toDate,
      attendance: { present: totalPresent, absent: totalAbsent, total: totalDays, pct: att_pct },
      curriculum: { covered: allSubjects.size, subjects: [...allSubjects] },
      homework: { completed: totalHwDone, total: totalHwAll }, periods_combined: reports.length };

    const secRow = await pool.query('SELECT section_id FROM students WHERE id=$1', [student_id]);
    const savedRow = await pool.query(
      `INSERT INTO saved_reports (school_id,student_id,section_id,generated_by,report_type,from_date,to_date,title,ai_report,report_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (student_id,from_date,to_date,report_type)
       DO UPDATE SET ai_report=EXCLUDED.ai_report, report_data=EXCLUDED.report_data,
                     generated_by=EXCLUDED.generated_by, title=EXCLUDED.title
       RETURNING id`,
      [school_id, student_id, secRow.rows[0]?.section_id, user_id, report_type, fromDate, toDate,
       title||`${report_type==='annual'?'Annual':'Term'} Report — ${firstData.student_name} (${fromDate} to ${toDate})`,
       termReport, JSON.stringify(termData)]);

    return res.json({ ...termData, ai_report: termReport, report_id: savedRow.rows[0].id, report_type });
  } catch (err) {
    console.error('[term-report]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/reports/class-coverage?section_id=&from=&to=
// Returns a detailed coverage report for a section between two dates — for PDF download
router.get('/class-coverage', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { section_id, from, to } = req.query as Record<string, string>;
    if (!section_id) return res.status(400).json({ error: 'section_id required' });

    const fromDate = from || '2020-01-01';
    const toDate   = to   || new Date().toISOString().split('T')[0];

    // Section + class + teacher info
    const secRow = await pool.query(
      `SELECT sec.label, c.name as class_name, c.id as class_id,
              ct.name as class_teacher,
              STRING_AGG(DISTINCT ts_u.name, ', ') as supporting_teachers
       FROM sections sec
       JOIN classes c ON c.id = sec.class_id
       LEFT JOIN users ct ON ct.id = sec.class_teacher_id
       LEFT JOIN teacher_sections ts ON ts.section_id = sec.id AND ts.teacher_id != sec.class_teacher_id
       LEFT JOIN users ts_u ON ts_u.id = ts.teacher_id
       WHERE sec.id = $1 AND sec.school_id = $2
       GROUP BY sec.label, c.name, c.id, ct.name`,
      [section_id, school_id]
    );
    if (secRow.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
    const sec = secRow.rows[0];

    // Daily completions in range
    const completions = await pool.query(
      `SELECT dc.completion_date::text, dc.covered_chunk_ids,
              u.name as teacher_name
       FROM daily_completions dc
       JOIN users u ON u.id = dc.teacher_id
       WHERE dc.section_id = $1 AND dc.school_id = $2
         AND dc.completion_date BETWEEN $3 AND $4
       ORDER BY dc.completion_date`,
      [section_id, school_id, fromDate, toDate]
    );

    // All chunks covered in range
    const allCoveredIds = [...new Set(
      completions.rows.flatMap((r: any) => r.covered_chunk_ids || [])
    )];

    let coveredChunks: any[] = [];
    if (allCoveredIds.length > 0) {
      const chunksRow = await pool.query(
        `SELECT cc.id, cc.topic_label, cc.chunk_index, cc.content, cd.filename as doc_name
         FROM curriculum_chunks cc
         JOIN curriculum_documents cd ON cd.id = cc.document_id
         WHERE cc.id = ANY($1::uuid[])
         ORDER BY cc.chunk_index`,
        [allCoveredIds]
      );
      coveredChunks = chunksRow.rows;
    }

    // Build grouped subject summary — skip raw "Week X Day Y" labels
    function extractSubjectActivity(topicLabel: string, content: string): { subject: string; activity: string } | null {
      // If topic_label is meaningful (not "Week X Day Y"), use it
      if (topicLabel && !/^week\s*\d|^day\s*\d/i.test(topicLabel.trim())) {
        const parts = topicLabel.split(/[—\-–:]/);
        const subject = parts[0].trim();
        const activity = parts.slice(1).join(' ').trim() || '';
        return { subject, activity };
      }
      // Otherwise extract from content: look for "Subject: activity" lines
      const lines = (content || '').split('\n').map((l: string) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const m = line.match(/^(English Speaking|English|Math(?:ematics)?|GK|General Knowledge|Writing|Handwriting|Art|Drawing|Music|PE|Science|EVS|Hindi|Regional Language|Additional [Aa]ctivities[^:\n]*|Circle [Tt]ime[^:\n]*|Morning [Mm]eet[^:\n]*|Story [Tt]ime[^:\n]*|Public [Ss]peaking[^:\n]*)\s*[:\-–]\s*(.{5,})/i);
        if (m) return { subject: m[1].trim(), activity: m[2].trim().slice(0, 120) };
      }
      // Fallback: first meaningful line
      const first = lines.find((l: string) => l.length > 10 && !/^(objective|resources|tip|note|what to do|ask children|materials)/i.test(l));
      return first ? { subject: 'Activity', activity: first.slice(0, 100) } : null;
    }

    // Group by canonical subject
    const subjectMap: Record<string, Set<string>> = {};
    const SPECIAL_SUBJECTS = ['story time', 'public speaking', 'show and tell', 'drama', 'debate', 'presentation'];

    for (const chunk of coveredChunks) {
      const parsed = extractSubjectActivity(chunk.topic_label || '', chunk.content || '');
      if (!parsed) continue;
      const subj = parsed.subject;
      if (!subjectMap[subj]) subjectMap[subj] = new Set();
      if (parsed.activity) subjectMap[subj].add(parsed.activity);
    }

    // Build the grouped topics list
    const groupedTopics = Object.entries(subjectMap).map(([subject, activities]) => ({
      subject,
      activities: [...activities].slice(0, 4),
      is_special: SPECIAL_SUBJECTS.some(s => subject.toLowerCase().includes(s)),
    }));

    // Special days in range
    const specialDays = await pool.query(
      `SELECT day_date::text, label, day_type, activity_note
       FROM special_days
       WHERE school_id = $1 AND day_date BETWEEN $2 AND $3
       ORDER BY day_date`,
      [school_id, fromDate, toDate]
    );

    // Holidays in range
    const holidays = await pool.query(
      `SELECT holiday_date::text, event_name
       FROM holidays
       WHERE school_id = $1 AND holiday_date BETWEEN $2 AND $3
       ORDER BY holiday_date`,
      [school_id, fromDate, toDate]
    );

    // Attendance summary in range
    const attRow = await pool.query(
      `SELECT
         COUNT(DISTINCT attend_date)::int as days_marked,
         COUNT(*) FILTER (WHERE status='present')::int as total_present,
         COUNT(*) FILTER (WHERE status='absent')::int as total_absent
       FROM attendance_records
       WHERE section_id = $1 AND school_id = $2
         AND attend_date BETWEEN $3 AND $4`,
      [section_id, school_id, fromDate, toDate]
    );

    // School name
    const schoolRow = await pool.query('SELECT name FROM schools WHERE id = $1', [school_id]);

    return res.json({
      school_name: schoolRow.rows[0]?.name ?? 'School',
      class_name: sec.class_name,
      section_label: sec.label,
      class_teacher: sec.class_teacher,
      supporting_teachers: sec.supporting_teachers,
      from_date: fromDate,
      to_date: toDate,
      completions: completions.rows.map((r: any) => ({
        date: r.completion_date,
        teacher: r.teacher_name,
        topics_covered: r.covered_chunk_ids?.length ?? 0,
      })),
      covered_topics: groupedTopics,
      covered_topics_raw: coveredChunks.map((c: any) => ({
        label: c.topic_label || `Topic ${c.chunk_index + 1}`,
        document: c.doc_name,
      })),
      special_days: specialDays.rows,
      holidays: holidays.rows,
      attendance: attRow.rows[0],
      total_days_completed: completions.rows.length,
      total_topics_covered: allCoveredIds.length,
    });
  } catch (err) {
    console.error('[class-coverage report]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/reports/school-overview — charts data
router.get('/school-overview', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;

    const [schoolRow, classStats, upcomingSpecial, upcomingHolidays, teacherStats] = await Promise.all([
      pool.query('SELECT name FROM schools WHERE id = $1', [school_id]),

      // Per-class: students, coverage, teachers
      pool.query(`
        SELECT
          c.id as class_id, c.name as class_name,
          COUNT(DISTINCT s.id)::int as total_students,
          COUNT(DISTINCT sec.id)::int as total_sections,
          COUNT(DISTINCT sec.class_teacher_id)::int as class_teachers,
          COUNT(DISTINCT ts.teacher_id)::int as supporting_teachers,
          COALESCE(AVG(
            CASE WHEN cc_total.total > 0
              THEN ROUND((cc_covered.covered::numeric / cc_total.total) * 100)
              ELSE NULL END
          )::int, 0) as avg_coverage_pct
        FROM classes c
        LEFT JOIN sections sec ON sec.class_id = c.id AND sec.school_id = $1
        LEFT JOIN students s ON s.section_id = sec.id AND s.is_active = true
        LEFT JOIN teacher_sections ts ON ts.section_id = sec.id
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT cc.id) as total
          FROM curriculum_documents cd
          JOIN curriculum_chunks cc ON cc.document_id = cd.id
          WHERE cd.class_id = c.id AND cd.school_id = $1
        ) cc_total ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT dc_u.chunk_id) as covered
          FROM daily_completions dc
          JOIN LATERAL unnest(dc.covered_chunk_ids) AS dc_u(chunk_id) ON true
          WHERE dc.section_id = sec.id AND dc.school_id = $1
        ) cc_covered ON true
        WHERE c.school_id = $1
        GROUP BY c.id, c.name
        ORDER BY c.name`,
        [school_id]
      ),

      // Upcoming special days (next 30 days)
      pool.query(`
        SELECT day_date::text, label, day_type, activity_note
        FROM special_days
        WHERE school_id = $1 AND day_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
        ORDER BY day_date LIMIT 10`,
        [school_id]
      ),

      // Upcoming holidays (next 60 days)
      pool.query(`
        SELECT holiday_date::text, event_name
        FROM holidays
        WHERE school_id = $1 AND holiday_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60
        ORDER BY holiday_date LIMIT 10`,
        [school_id]
      ),

      // Teacher count + active
      pool.query(`
        SELECT
          COUNT(DISTINCT u.id)::int as total_teachers,
          COUNT(DISTINCT ts.teacher_id)::int as assigned_teachers
        FROM users u
        JOIN roles r ON r.id = u.role_id AND r.name = 'teacher'
        LEFT JOIN teacher_sections ts ON ts.teacher_id = u.id
        WHERE u.school_id = $1 AND u.is_active = true`,
        [school_id]
      ),
    ]);

    const classes = classStats.rows;
    const totalStudents = classes.reduce((s: number, c: any) => s + c.total_students, 0);
    const totalSections = classes.reduce((s: number, c: any) => s + c.total_sections, 0);
    const avgCoverage = classes.length > 0
      ? Math.round(classes.reduce((s: number, c: any) => s + c.avg_coverage_pct, 0) / classes.length)
      : 0;

    return res.json({
      school_name: schoolRow.rows[0]?.name ?? 'School',
      summary: {
        total_students: totalStudents,
        total_sections: totalSections,
        total_teachers: teacherStats.rows[0]?.total_teachers ?? 0,
        assigned_teachers: teacherStats.rows[0]?.assigned_teachers ?? 0,
        avg_coverage_pct: avgCoverage,
        total_classes: classes.length,
      },
      classes,
      upcoming_special_days: upcomingSpecial.rows,
      upcoming_holidays: upcomingHolidays.rows,
    });
  } catch (err) {
    console.error('[school-overview]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

/**
 * Oakie Structured Data Queries
 *
 * Handles principal/admin questions that need real database answers
 * (fees, students, attendance, teachers, curriculum coverage, etc.)
 * without calling the AI service.
 *
 * Returns null if the question doesn't match any known data pattern,
 * allowing the normal AI pipeline to handle it.
 */

import { pool } from './db';
import { getToday } from './today';

interface DataQueryResult {
  response: string;
  chunk_ids: string[];
  covered_chunk_ids: string[];
  activity_ids: string[];
  source: 'data_query';
}

// ── Intent patterns ─────────────────────────────────────────────────────────

const FEE_PATTERNS = [
  /fee\s*pending|pending\s*fee|outstanding\s*fee|unpaid\s*fee/i,
  /fee\s*collection|collected\s*fee|fee\s*status/i,
  /total\s*fee|fee\s*summary|fee\s*overview|fee\s*details/i,
  /who\s*(has|have)n'?t\s*paid|not\s*paid|defaulter/i,
  /fee\s*due|overdue|due\s*amount/i,
  /how\s*much.*collected|collection\s*status/i,
  /revenue|income.*fee|fee.*income/i,
];

const STUDENT_PATTERNS = [
  /how\s*many\s*students|total\s*students|student\s*count|student\s*strength/i,
  /students?\s*(in|per)\s*(each\s*)?class/i,
  /class\s*wise\s*student|class\s*strength/i,
  /new\s*admissions?|admitted\s*this/i,
];

const ATTENDANCE_PATTERNS = [
  /today'?s?\s*attendance|attendance\s*today/i,
  /attendance\s*(summary|report|status|overview)/i,
  /who\s*(is|are)\s*absent|absent\s*today|absent\s*students/i,
  /present\s*today|how\s*many\s*present/i,
  /attendance\s*percentage|attendance\s*rate/i,
  /low\s*attendance|poor\s*attendance/i,
];

const TEACHER_PATTERNS = [
  /how\s*many\s*teachers|total\s*teachers|teacher\s*count/i,
  /teacher\s*(status|activity|performance)/i,
  /which\s*teacher.*not\s*(submitted|completed|done)/i,
  /teacher.*plan|plan.*submitted/i,
  /teacher\s*streak/i,
];

const PARENT_PATTERNS = [
  /how\s*many\s*parents|parent\s*count|parent\s*login/i,
  /parent\s*(activity|engagement|status)/i,
  /parents?\s*(not|never)\s*logged\s*in/i,
  /active\s*parents?/i,
];

const CURRICULUM_PATTERNS = [
  /curriculum\s*(coverage|progress|status)/i,
  /how\s*much.*covered|coverage\s*percentage/i,
  /syllabus\s*(progress|status|completion)/i,
  /which\s*(class|section).*behind|lagging/i,
];

const EXPENSE_PATTERNS = [
  /expense|expenditure|spending/i,
  /how\s*much\s*spent|total\s*expense/i,
];

// ── Main handler ────────────────────────────────────────────────────────────

export async function handleDataQuery(
  text: string,
  schoolId: string,
  role: string,
): Promise<DataQueryResult | null> {
  const t = text.toLowerCase().trim();

  // Only principals and admins get data queries
  if (!['principal', 'admin', 'finance_manager'].includes(role)) return null;

  if (FEE_PATTERNS.some(p => p.test(t)))        return await handleFeeQuery(t, schoolId);
  if (STUDENT_PATTERNS.some(p => p.test(t)))     return await handleStudentQuery(t, schoolId);
  if (ATTENDANCE_PATTERNS.some(p => p.test(t)))  return await handleAttendanceQuery(t, schoolId);
  if (TEACHER_PATTERNS.some(p => p.test(t)))     return await handleTeacherQuery(t, schoolId);
  if (PARENT_PATTERNS.some(p => p.test(t)))      return await handleParentQuery(t, schoolId);
  if (CURRICULUM_PATTERNS.some(p => p.test(t)))  return await handleCurriculumQuery(t, schoolId);
  if (EXPENSE_PATTERNS.some(p => p.test(t)))     return await handleExpenseQuery(t, schoolId);

  return null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function wrap(response: string): DataQueryResult {
  return { response, chunk_ids: [], covered_chunk_ids: [], activity_ids: [], source: 'data_query' };
}

// ── Fee queries ─────────────────────────────────────────────────────────────

async function handleFeeQuery(text: string, schoolId: string): Promise<DataQueryResult> {
  try {
    // Overall fee summary
    const summary = await pool.query(
      `SELECT
         COUNT(DISTINCT sfa.student_id)::int AS students_with_fee,
         COALESCE(SUM(sfa.assigned_amount), 0)::numeric AS total_assigned,
         COALESCE(SUM(sfa.outstanding_balance), 0)::numeric AS total_pending,
         COALESCE(SUM(sfa.assigned_amount - sfa.outstanding_balance), 0)::numeric AS total_collected
       FROM student_fee_accounts sfa
       WHERE sfa.school_id = $1 AND sfa.deleted_at IS NULL`,
      [schoolId]
    );
    const s = summary.rows[0];
    const totalAssigned = parseFloat(s.total_assigned) || 0;
    const totalPending = parseFloat(s.total_pending) || 0;
    const totalCollected = parseFloat(s.total_collected) || 0;
    const collectionPct = totalAssigned > 0 ? Math.round((totalCollected / totalAssigned) * 100) : 0;

    // Class-wise pending breakdown
    const classWise = await pool.query(
      `SELECT
         c.name AS class_name,
         COUNT(DISTINCT sfa.student_id)::int AS students,
         COALESCE(SUM(sfa.outstanding_balance), 0)::numeric AS pending
       FROM student_fee_accounts sfa
       JOIN students st ON st.id = sfa.student_id
       JOIN classes c ON c.id = st.class_id
       WHERE sfa.school_id = $1 AND sfa.deleted_at IS NULL
         AND sfa.outstanding_balance > 0 AND st.is_active = true
       GROUP BY c.name
       ORDER BY pending DESC`,
      [schoolId]
    );

    // Top defaulters (students with highest pending)
    const defaulters = await pool.query(
      `SELECT
         st.name AS student_name,
         c.name AS class_name,
         sec.label AS section_label,
         SUM(sfa.outstanding_balance)::numeric AS pending
       FROM student_fee_accounts sfa
       JOIN students st ON st.id = sfa.student_id
       JOIN classes c ON c.id = st.class_id
       JOIN sections sec ON sec.id = st.section_id
       WHERE sfa.school_id = $1 AND sfa.deleted_at IS NULL
         AND sfa.outstanding_balance > 0 AND st.is_active = true
       GROUP BY st.name, c.name, sec.label
       ORDER BY pending DESC
       LIMIT 10`,
      [schoolId]
    );

    let response = `📊 **Fee Summary**\n\n`;
    response += `• Total Assigned: ${fmt(totalAssigned)}\n`;
    response += `• Collected: ${fmt(totalCollected)} (${collectionPct}%)\n`;
    response += `• Pending: ${fmt(totalPending)}\n`;
    response += `• Students with fees: ${s.students_with_fee}\n\n`;

    if (classWise.rows.length > 0) {
      response += `📋 **Class-wise Pending:**\n`;
      for (const row of classWise.rows) {
        response += `  • ${row.class_name}: ${fmt(parseFloat(row.pending))} (${row.students} students)\n`;
      }
      response += '\n';
    }

    if (defaulters.rows.length > 0 && (text.includes('who') || text.includes('defaulter') || text.includes('not paid') || text.includes('pending'))) {
      response += `⚠️ **Top Pending (highest first):**\n`;
      for (const row of defaulters.rows) {
        response += `  • ${row.student_name} (${row.class_name} ${row.section_label}): ${fmt(parseFloat(row.pending))}\n`;
      }
    }

    return wrap(response.trim());
  } catch (err) {
    console.error('[oakieDataQueries/fee]', err);
    return wrap('I couldn\'t fetch fee details right now. Please check the Finance section for the latest data.');
  }
}

// ── Student queries ─────────────────────────────────────────────────────────

async function handleStudentQuery(text: string, schoolId: string): Promise<DataQueryResult> {
  try {
    const result = await pool.query(
      `SELECT
         c.name AS class_name,
         COUNT(s.id)::int AS total,
         COUNT(s.id) FILTER (WHERE s.is_active = true)::int AS active,
         COUNT(s.id) FILTER (WHERE s.is_active = false)::int AS inactive
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.id AND s.school_id = c.school_id
       WHERE c.school_id = $1
       GROUP BY c.name
       ORDER BY c.name`,
      [schoolId]
    );

    const totalActive = result.rows.reduce((sum: number, r: any) => sum + r.active, 0);
    const totalInactive = result.rows.reduce((sum: number, r: any) => sum + r.inactive, 0);

    let response = `👨‍🎓 **Student Strength**\n\n`;
    response += `• Total Active Students: **${totalActive}**\n`;
    if (totalInactive > 0) response += `• Terminated: ${totalInactive}\n`;
    response += `\n📋 **Class-wise:**\n`;
    for (const row of result.rows) {
      if (row.active > 0) {
        response += `  • ${row.class_name}: ${row.active} students\n`;
      }
    }

    return wrap(response.trim());
  } catch (err) {
    console.error('[oakieDataQueries/student]', err);
    return wrap('I couldn\'t fetch student details right now. Please check the Students section.');
  }
}

// ── Attendance queries ──────────────────────────────────────────────────────

async function handleAttendanceQuery(text: string, schoolId: string): Promise<DataQueryResult> {
  try {
    const today = await getToday(schoolId);

    const result = await pool.query(
      `SELECT
         c.name AS class_name,
         sec.label AS section_label,
         COUNT(DISTINCT st.id)::int AS total_students,
         COUNT(DISTINCT ar.student_id) FILTER (WHERE ar.status = 'present')::int AS present,
         COUNT(DISTINCT ar.student_id) FILTER (WHERE ar.status = 'absent')::int AS absent
       FROM sections sec
       JOIN classes c ON c.id = sec.class_id
       LEFT JOIN students st ON st.section_id = sec.id AND st.is_active = true
       LEFT JOIN attendance_records ar ON ar.section_id = sec.id AND ar.attend_date = $2
       WHERE sec.school_id = $1
       GROUP BY c.name, sec.label
       ORDER BY c.name, sec.label`,
      [schoolId, today]
    );

    const totalStudents = result.rows.reduce((s: number, r: any) => s + r.total_students, 0);
    const totalPresent = result.rows.reduce((s: number, r: any) => s + r.present, 0);
    const totalAbsent = result.rows.reduce((s: number, r: any) => s + r.absent, 0);
    const submitted = result.rows.filter((r: any) => r.present + r.absent > 0).length;
    const totalSections = result.rows.length;
    const pct = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

    let response = `📋 **Today's Attendance** (${today})\n\n`;
    response += `• Total Students: ${totalStudents}\n`;
    response += `• Present: ${totalPresent} (${pct}%)\n`;
    response += `• Absent: ${totalAbsent}\n`;
    response += `• Sections submitted: ${submitted}/${totalSections}\n\n`;

    // Show absent students if asked
    if (text.includes('absent') || text.includes('who')) {
      const absentStudents = await pool.query(
        `SELECT s.name, c.name AS class_name, sec.label AS section_label
         FROM attendance_records ar
         JOIN students s ON s.id = ar.student_id
         JOIN classes c ON c.id = s.class_id
         JOIN sections sec ON sec.id = s.section_id
         WHERE ar.school_id = $1 AND ar.attend_date = $2 AND ar.status = 'absent'
         ORDER BY c.name, sec.label, s.name
         LIMIT 30`,
        [schoolId, today]
      );
      if (absentStudents.rows.length > 0) {
        response += `⚠️ **Absent Students:**\n`;
        for (const row of absentStudents.rows) {
          response += `  • ${row.name} (${row.class_name} ${row.section_label})\n`;
        }
        if (absentStudents.rows.length === 30) response += `  ... and more\n`;
      }
    } else {
      // Show section-wise summary
      response += `📊 **Section-wise:**\n`;
      for (const row of result.rows) {
        const secPct = row.total_students > 0 ? Math.round((row.present / row.total_students) * 100) : 0;
        const status = row.present + row.absent > 0 ? `${row.present}/${row.total_students} (${secPct}%)` : '⏳ Not submitted';
        response += `  • ${row.class_name} ${row.section_label}: ${status}\n`;
      }
    }

    return wrap(response.trim());
  } catch (err) {
    console.error('[oakieDataQueries/attendance]', err);
    return wrap('I couldn\'t fetch attendance details right now. Please check the Attendance section.');
  }
}

// ── Teacher queries ─────────────────────────────────────────────────────────

async function handleTeacherQuery(text: string, schoolId: string): Promise<DataQueryResult> {
  try {
    const today = await getToday(schoolId);

    const result = await pool.query(
      `SELECT
         u.name,
         COALESCE(ts.current_streak, 0) AS streak,
         (SELECT MAX(dc.completion_date)::text FROM daily_completions dc WHERE dc.teacher_id = u.id AND dc.school_id = $1) AS last_plan,
         EXISTS(SELECT 1 FROM daily_completions dc WHERE dc.teacher_id = u.id AND dc.school_id = $1 AND dc.completion_date = $2) AS plan_today,
         EXISTS(SELECT 1 FROM attendance_records ar WHERE ar.teacher_id = u.id AND ar.school_id = $1 AND ar.attend_date = $2) AS attendance_today
       FROM users u
       JOIN roles r ON r.id = u.role_id AND r.name = 'teacher'
       WHERE u.school_id = $1 AND u.is_active = true
       ORDER BY u.name`,
      [schoolId, today]
    );

    const total = result.rows.length;
    const planDone = result.rows.filter((r: any) => r.plan_today).length;
    const attDone = result.rows.filter((r: any) => r.attendance_today).length;

    let response = `👩‍🏫 **Teacher Status** (${today})\n\n`;
    response += `• Total Teachers: ${total}\n`;
    response += `• Plan submitted today: ${planDone}/${total}\n`;
    response += `• Attendance submitted today: ${attDone}/${total}\n\n`;

    // Show who hasn't submitted
    if (text.includes('not') || text.includes('pending') || text.includes('which')) {
      const notDone = result.rows.filter((r: any) => !r.plan_today);
      if (notDone.length > 0) {
        response += `⏳ **Plan not submitted:**\n`;
        for (const row of notDone) {
          response += `  • ${row.name}${row.last_plan ? ` (last: ${row.last_plan})` : ' (never submitted)'}\n`;
        }
      } else {
        response += `✅ All teachers have submitted their plan today!\n`;
      }
    } else {
      // Show streaks
      const topStreaks = result.rows.filter((r: any) => r.streak > 0).sort((a: any, b: any) => b.streak - a.streak).slice(0, 5);
      if (topStreaks.length > 0) {
        response += `🔥 **Top Streaks:**\n`;
        for (const row of topStreaks) {
          response += `  • ${row.name}: ${row.streak} days\n`;
        }
      }
    }

    return wrap(response.trim());
  } catch (err) {
    console.error('[oakieDataQueries/teacher]', err);
    return wrap('I couldn\'t fetch teacher details right now. Please check the Teachers section.');
  }
}

// ── Parent queries ──────────────────────────────────────────────────────────

async function handleParentQuery(text: string, schoolId: string): Promise<DataQueryResult> {
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE is_active = true)::int AS active,
         COUNT(*) FILTER (WHERE force_password_reset = true AND is_active = true)::int AS never_logged_in,
         COUNT(*) FILTER (WHERE force_password_reset = false AND is_active = true)::int AS logged_in_at_least_once
       FROM parent_users
       WHERE school_id = $1`,
      [schoolId]
    );

    const r = result.rows[0];
    let response = `👨‍👩‍👧 **Parent Accounts**\n\n`;
    response += `• Total Accounts: ${r.total}\n`;
    response += `• Active: ${r.active}\n`;
    response += `• Logged in at least once: ${r.logged_in_at_least_once}\n`;
    response += `• Never logged in: ${r.never_logged_in}\n\n`;

    if (r.never_logged_in > 0) {
      response += `💡 ${r.never_logged_in} parents have accounts but haven't logged in yet. Their password is still set to their mobile number.`;
    }

    return wrap(response.trim());
  } catch (err) {
    console.error('[oakieDataQueries/parent]', err);
    return wrap('I couldn\'t fetch parent details right now.');
  }
}

// ── Curriculum coverage queries ─────────────────────────────────────────────

async function handleCurriculumQuery(text: string, schoolId: string): Promise<DataQueryResult> {
  try {
    const result = await pool.query(
      `SELECT
         c.name AS class_name,
         sec.label AS section_label,
         COUNT(DISTINCT cc.id)::int AS total_chunks,
         COUNT(DISTINCT dc_chunks.chunk_id)::int AS covered_chunks
       FROM sections sec
       JOIN classes c ON c.id = sec.class_id
       LEFT JOIN curriculum_documents cd ON cd.class_id = sec.class_id AND cd.school_id = $1
       LEFT JOIN curriculum_chunks cc ON cc.document_id = cd.id
       LEFT JOIN (
         SELECT unnest(covered_chunk_ids) AS chunk_id, section_id
         FROM daily_completions WHERE school_id = $1
       ) dc_chunks ON dc_chunks.chunk_id = cc.id AND dc_chunks.section_id = sec.id
       WHERE sec.school_id = $1
       GROUP BY c.name, sec.label
       ORDER BY c.name, sec.label`,
      [schoolId]
    );

    let response = `📚 **Curriculum Coverage**\n\n`;
    let totalChunks = 0, totalCovered = 0;

    for (const row of result.rows) {
      const pct = row.total_chunks > 0 ? Math.round((row.covered_chunks / row.total_chunks) * 100) : 0;
      totalChunks += row.total_chunks;
      totalCovered += row.covered_chunks;
      const bar = pct >= 70 ? '🟢' : pct >= 40 ? '🟡' : '🔴';
      response += `  ${bar} ${row.class_name} ${row.section_label}: ${pct}% (${row.covered_chunks}/${row.total_chunks} topics)\n`;
    }

    const overallPct = totalChunks > 0 ? Math.round((totalCovered / totalChunks) * 100) : 0;
    response = `📚 **Curriculum Coverage** — Overall: ${overallPct}%\n\n` + response.split('\n\n')[1];

    // Highlight sections behind
    const behind = result.rows.filter((r: any) => {
      const pct = r.total_chunks > 0 ? Math.round((r.covered_chunks / r.total_chunks) * 100) : 0;
      return pct < 40 && r.total_chunks > 0;
    });
    if (behind.length > 0) {
      response += `\n\n⚠️ **Sections needing attention** (below 40%):\n`;
      for (const row of behind) {
        const pct = Math.round((row.covered_chunks / row.total_chunks) * 100);
        response += `  • ${row.class_name} ${row.section_label}: only ${pct}%\n`;
      }
    }

    return wrap(response.trim());
  } catch (err) {
    console.error('[oakieDataQueries/curriculum]', err);
    return wrap('I couldn\'t fetch curriculum coverage right now. Please check the Coverage section.');
  }
}

// ── Expense queries ─────────────────────────────────────────────────────────

async function handleExpenseQuery(text: string, schoolId: string): Promise<DataQueryResult> {
  try {
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(amount), 0)::numeric AS total_this_month,
         COUNT(*)::int AS count_this_month
       FROM expenses
       WHERE school_id = $1 AND deleted_at IS NULL
         AND date >= DATE_TRUNC('month', CURRENT_DATE)`,
      [schoolId]
    );

    const categoryResult = await pool.query(
      `SELECT
         COALESCE(category, 'Uncategorized') AS category,
         SUM(amount)::numeric AS total,
         COUNT(*)::int AS count
       FROM expenses
       WHERE school_id = $1 AND deleted_at IS NULL
         AND date >= DATE_TRUNC('month', CURRENT_DATE)
       GROUP BY category
       ORDER BY total DESC
       LIMIT 10`,
      [schoolId]
    );

    const r = result.rows[0];
    const totalExpense = parseFloat(r.total_this_month) || 0;

    let response = `💰 **Expenses This Month**\n\n`;
    response += `• Total: ${fmt(totalExpense)} (${r.count_this_month} entries)\n\n`;

    if (categoryResult.rows.length > 0) {
      response += `📋 **By Category:**\n`;
      for (const row of categoryResult.rows) {
        response += `  • ${row.category}: ${fmt(parseFloat(row.total))} (${row.count} entries)\n`;
      }
    }

    return wrap(response.trim());
  } catch (err) {
    console.error('[oakieDataQueries/expense]', err);
    return wrap('I couldn\'t fetch expense details right now. Please check the Expenses section.');
  }
}

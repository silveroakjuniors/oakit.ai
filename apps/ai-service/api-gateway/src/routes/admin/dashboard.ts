import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { redis } from '../../lib/redis';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin', 'principal'));

function coverageBand(pct: number): 'green' | 'amber' | 'red' {
  if (pct >= 75) return 'green';
  if (pct >= 40) return 'amber';
  return 'red';
}

// GET /api/v1/admin/dashboard/coverage
router.get('/coverage', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const result = await pool.query(
      `SELECT
         sec.id as section_id, sec.label as section_label,
         c.name as class_name,
         COUNT(DISTINCT cc.id)::int as total_chunks,
         COUNT(DISTINCT dc_chunks.chunk_id)::int as covered_chunks
       FROM sections sec
       JOIN classes c ON c.id = sec.class_id
       LEFT JOIN curriculum_documents cd ON cd.class_id = sec.class_id AND cd.school_id = $1
       LEFT JOIN curriculum_chunks cc ON cc.document_id = cd.id
       LEFT JOIN (
         SELECT unnest(covered_chunk_ids) as chunk_id, section_id
         FROM daily_completions WHERE school_id = $1
       ) dc_chunks ON dc_chunks.chunk_id = cc.id AND dc_chunks.section_id = sec.id
       WHERE sec.school_id = $1
       GROUP BY sec.id, sec.label, c.name, c.id
       ORDER BY c.name, sec.label`,
      [school_id]
    );
    const rows = result.rows.map((r: any) => {
      const pct = r.total_chunks > 0 ? Math.round((r.covered_chunks / r.total_chunks) * 100) : 0;
      return { ...r, coverage_pct: pct, band: coverageBand(pct), alert: pct < 40 && r.total_chunks > 0 };
    });
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/dashboard/coverage/:sectionId — drill-down: covered topics
router.get('/coverage/:sectionId', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { sectionId } = req.params;

    // Section info
    const secRow = await pool.query(
      `SELECT sec.label, c.name as class_name, u.name as teacher_name
       FROM sections sec
       JOIN classes c ON c.id = sec.class_id
       LEFT JOIN users u ON u.id = sec.class_teacher_id
       WHERE sec.id = $1 AND sec.school_id = $2`,
      [sectionId, school_id]
    );
    if (secRow.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
    const sec = secRow.rows[0];

    // All chunks for this section's class, with covered status
    const chunksRow = await pool.query(
      `SELECT
         cc.id, cc.topic_label, cc.page_start,
         cd.filename as doc_title,
         CASE WHEN dc.chunk_id IS NOT NULL THEN true ELSE false END as covered,
         dc.completion_date
       FROM curriculum_documents cd
       JOIN curriculum_chunks cc ON cc.document_id = cd.id
       LEFT JOIN (
         SELECT u.chunk_id, MAX(dc2.completion_date)::text as completion_date
         FROM daily_completions dc2,
              unnest(dc2.covered_chunk_ids) AS u(chunk_id)
         WHERE dc2.section_id = $1 AND dc2.school_id = $2
         GROUP BY u.chunk_id
       ) dc ON dc.chunk_id = cc.id
       WHERE cd.class_id = (SELECT class_id FROM sections WHERE id = $1)
         AND cd.school_id = $2
         AND cd.status = 'ready'
       ORDER BY cd.filename, cc.page_start`,
      [sectionId, school_id]
    );

    const chunks = chunksRow.rows;
    const total = chunks.length;
    const covered = chunks.filter((c: any) => c.covered).length;

    // Group by document
    const byDoc: Record<string, any[]> = {};
    for (const c of chunks) {
      if (!byDoc[c.doc_title]) byDoc[c.doc_title] = [];
      byDoc[c.doc_title].push(c);
    }

    return res.json({
      section_label: sec.label,
      class_name: sec.class_name,
      teacher_name: sec.teacher_name,
      total_chunks: total,
      covered_chunks: covered,
      coverage_pct: total > 0 ? Math.round((covered / total) * 100) : 0,
      documents: Object.entries(byDoc).map(([title, topics]) => ({
        title,
        total: topics.length,
        covered: topics.filter((t: any) => t.covered).length,
        topics: topics.map((t: any) => ({
          id: t.id,
          label: t.topic_label || `Page ${t.page_start}`,
          covered: t.covered,
          completion_date: t.completion_date,
        })),
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/attendance-trend', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const today = await getToday(school_id);
    const result = await pool.query(
      `SELECT
         attend_date::text as date,
         COUNT(*) FILTER (WHERE status = 'present') as present,
         COUNT(*) FILTER (WHERE status = 'absent') as absent,
         COUNT(*) FILTER (WHERE is_late = true) as late
       FROM attendance_records
       WHERE school_id = $1 AND attend_date BETWEEN ($2::date - INTERVAL '29 days') AND $2::date
       GROUP BY attend_date ORDER BY attend_date ASC`,
      [school_id, today]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/dashboard/today
router.get('/today', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const cacheKey = `dashboard:today:${school_id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const today = await getToday(school_id);
    const [studentsPresent, attSections, planSections, totalSections] = await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT student_id)::int as count FROM attendance_records WHERE school_id = $1 AND attend_date = $2 AND status = 'present'`, [school_id, today]),
      pool.query(`SELECT COUNT(DISTINCT section_id)::int as count FROM attendance_records WHERE school_id = $1 AND attend_date = $2`, [school_id, today]),
      pool.query(`SELECT COUNT(DISTINCT section_id)::int as count FROM daily_completions WHERE school_id = $1 AND completion_date = $2`, [school_id, today]),
      pool.query(`SELECT COUNT(*)::int as count FROM sections WHERE school_id = $1`, [school_id]),
    ]);

    const data = {
      students_present: studentsPresent.rows[0].count,
      sections_attendance_submitted: attSections.rows[0].count,
      sections_plans_completed: planSections.rows[0].count,
      total_sections: totalSections.rows[0].count,
      date: today,
    };
    await redis.setEx(cacheKey, 60, JSON.stringify(data));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/admin/dashboard/engagement
// Returns teacher usage, parent usage, homework stats, messages — all drillable
router.get('/engagement', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const cacheKey = `dashboard:engagement:${school_id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const today = await getToday(school_id);
    const thirtyDaysAgo = `(DATE '${today}' - INTERVAL '30 days')::date`;

    const [
      teacherUsage,
      parentUsage,
      homeworkStats,
      messageStats,
      hwSubmissions,
    ] = await Promise.all([

      // Teacher usage: last_login proxy = last completion or attendance submission
      pool.query(`
        SELECT
          u.id, u.name, u.mobile,
          sec.label as section_label, c.name as class_name,
          COUNT(DISTINCT dc.completion_date)::int as days_completed_30d,
          MAX(dc.completion_date)::text as last_completion,
          COUNT(DISTINCT ar.attend_date)::int as days_attendance_30d,
          MAX(ar.attend_date)::text as last_attendance,
          COUNT(DISTINCT th.homework_date)::int as homework_sent_30d,
          COUNT(DISTINCT tn.id)::int as notes_sent_30d,
          COUNT(DISTINCT m.id)::int as messages_sent_30d,
          COALESCE(ts.current_streak, 0) as streak,
          CASE
            WHEN MAX(dc.completion_date) >= (DATE '${today}' - INTERVAL '3 days') THEN 'active'
            WHEN MAX(dc.completion_date) >= (DATE '${today}' - INTERVAL '7 days') THEN 'low'
            ELSE 'inactive'
          END as activity_status
        FROM users u
        JOIN roles r ON r.id = u.role_id AND r.name = 'teacher'
        LEFT JOIN teacher_sections tsec ON tsec.teacher_id = u.id
        LEFT JOIN sections sec ON sec.id = tsec.section_id
        LEFT JOIN classes c ON c.id = sec.class_id
        LEFT JOIN daily_completions dc ON dc.teacher_id = u.id
          AND dc.school_id = u.school_id
          AND dc.completion_date >= ${thirtyDaysAgo}
        LEFT JOIN attendance_records ar ON ar.teacher_id = u.id
          AND ar.school_id = u.school_id
          AND ar.attend_date >= ${thirtyDaysAgo}
        LEFT JOIN teacher_homework th ON th.teacher_id = u.id
          AND th.school_id = u.school_id
          AND th.homework_date >= ${thirtyDaysAgo}
        LEFT JOIN teacher_notes tn ON tn.teacher_id = u.id
          AND tn.school_id = u.school_id
          AND tn.note_date >= ${thirtyDaysAgo}
        LEFT JOIN messages m ON m.teacher_id = u.id
          AND m.school_id = u.school_id
          AND m.sent_at >= ${thirtyDaysAgo}
        LEFT JOIN teacher_streaks ts ON ts.teacher_id = u.id AND ts.school_id = u.school_id
        WHERE u.school_id = $1 AND u.is_active = true
        GROUP BY u.id, u.name, u.mobile, sec.label, c.name, ts.current_streak
        ORDER BY days_completed_30d DESC, u.name`,
        [school_id]
      ),

      // Parent usage: last login proxy = last message sent or notification read
      pool.query(`
        SELECT
          pu.id, pu.name, pu.mobile,
          COUNT(DISTINCT psl.student_id)::int as children_count,
          STRING_AGG(DISTINCT s.name, ', ') as children_names,
          COUNT(DISTINCT m.id)::int as messages_sent_30d,
          COUNT(DISTINCT pn.id) FILTER (WHERE pn.is_read = true)::int as notifications_read_30d,
          COUNT(DISTINCT pn.id) FILTER (WHERE pn.is_read = false)::int as unread_notifications,
          MAX(m.sent_at)::text as last_message_at,
          CASE
            WHEN COUNT(DISTINCT m.id) > 0 OR COUNT(DISTINCT pn.id) FILTER (WHERE pn.is_read = true) > 0
              THEN 'active'
            WHEN pu.force_password_reset = true THEN 'never_logged_in'
            ELSE 'inactive'
          END as activity_status
        FROM parent_users pu
        LEFT JOIN parent_student_links psl ON psl.parent_id = pu.id
        LEFT JOIN students s ON s.id = psl.student_id
        LEFT JOIN messages m ON m.parent_id = pu.id
          AND m.school_id = pu.school_id
          AND m.sent_at >= ${thirtyDaysAgo}
        LEFT JOIN parent_notifications pn ON pn.parent_id = pu.id
          AND pn.completion_date >= ${thirtyDaysAgo}
        WHERE pu.school_id = $1 AND pu.is_active = true
        GROUP BY pu.id, pu.name, pu.mobile, pu.force_password_reset
        ORDER BY messages_sent_30d DESC, pu.name`,
        [school_id]
      ),

      // Homework stats: sent vs completion rates
      pool.query(`
        SELECT
          th.homework_date::text as date,
          sec.label as section_label, c.name as class_name,
          u.name as teacher_name,
          COUNT(DISTINCT hs.student_id) FILTER (WHERE hs.status = 'completed')::int as completed,
          COUNT(DISTINCT hs.student_id) FILTER (WHERE hs.status = 'partial')::int as partial,
          COUNT(DISTINCT hs.student_id) FILTER (WHERE hs.status = 'not_submitted')::int as not_submitted,
          COUNT(DISTINCT st.id)::int as total_students
        FROM teacher_homework th
        JOIN sections sec ON sec.id = th.section_id
        JOIN classes c ON c.id = sec.class_id
        JOIN users u ON u.id = th.teacher_id
        LEFT JOIN homework_submissions hs ON hs.section_id = th.section_id
          AND hs.homework_date = th.homework_date
        LEFT JOIN students st ON st.section_id = th.section_id AND st.is_active = true
        WHERE th.school_id = $1
          AND th.homework_date >= ${thirtyDaysAgo}
        GROUP BY th.homework_date, sec.label, c.name, u.name
        ORDER BY th.homework_date DESC
        LIMIT 30`,
        [school_id]
      ),

      // Message stats
      pool.query(`
        SELECT
          COUNT(DISTINCT id)::int as total_messages_30d,
          COUNT(DISTINCT id) FILTER (WHERE sender_role = 'teacher')::int as teacher_messages,
          COUNT(DISTINCT id) FILTER (WHERE sender_role = 'parent')::int as parent_messages,
          COUNT(DISTINCT CONCAT(teacher_id::text, parent_id::text))::int as active_threads
        FROM messages
        WHERE school_id = $1 AND sent_at >= ${thirtyDaysAgo}`,
        [school_id]
      ),

      // Homework submission summary
      pool.query(`
        SELECT
          COUNT(DISTINCT hs.student_id) FILTER (WHERE hs.status = 'completed')::int as completed,
          COUNT(DISTINCT hs.student_id) FILTER (WHERE hs.status = 'partial')::int as partial,
          COUNT(DISTINCT hs.student_id) FILTER (WHERE hs.status = 'not_submitted')::int as not_submitted,
          COUNT(DISTINCT th.id)::int as homework_days
        FROM teacher_homework th
        LEFT JOIN homework_submissions hs ON hs.section_id = th.section_id
          AND hs.homework_date = th.homework_date
        WHERE th.school_id = $1 AND th.homework_date >= ${thirtyDaysAgo}`,
        [school_id]
      ),
    ]);

    const teachers = teacherUsage.rows;
    const parents = parentUsage.rows;
    const msgStats = messageStats.rows[0] || {};
    const hwSummary = hwSubmissions.rows[0] || {};

    const data = {
      teachers: {
        total: teachers.length,
        active: teachers.filter((t: any) => t.activity_status === 'active').length,
        low: teachers.filter((t: any) => t.activity_status === 'low').length,
        inactive: teachers.filter((t: any) => t.activity_status === 'inactive').length,
        list: teachers,
      },
      parents: {
        total: parents.length,
        active: parents.filter((p: any) => p.activity_status === 'active').length,
        inactive: parents.filter((p: any) => p.activity_status === 'inactive').length,
        never_logged_in: parents.filter((p: any) => p.activity_status === 'never_logged_in').length,
        list: parents,
      },
      homework: {
        days_sent: Number(hwSummary.homework_days) || 0,
        completed: Number(hwSummary.completed) || 0,
        partial: Number(hwSummary.partial) || 0,
        not_submitted: Number(hwSummary.not_submitted) || 0,
        history: homeworkStats.rows,
      },
      messages: {
        total: Number(msgStats.total_messages_30d) || 0,
        teacher_sent: Number(msgStats.teacher_messages) || 0,
        parent_sent: Number(msgStats.parent_messages) || 0,
        active_threads: Number(msgStats.active_threads) || 0,
      },
    };

    await redis.setEx(cacheKey, 300, JSON.stringify(data)); // 5-min cache
    return res.json(data);
  } catch (err) {
    console.error('[engagement]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

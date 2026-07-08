import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import { getToday, getNowIST } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher'));

async function resolveSection(
  sections: { section_id: string }[],
  querySectionId?: string
): Promise<{ section_id: string } | { error: string; status: number }> {
  if (sections.length === 0) return { error: 'No section assigned', status: 404 };
  if (sections.length === 1) return { section_id: sections[0].section_id };
  if (!querySectionId) return { error: 'section_id required — you are assigned to multiple sections', status: 400 };
  const found = sections.find(s => s.section_id === querySectionId);
  if (!found) return { error: 'Not authorized for this section', status: 403 };
  return { section_id: found.section_id };
}

// GET /api/v1/teacher/attendance/today
router.get('/today', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);

    const sections = await getTeacherSections(user_id, school_id);
    const resolved = await resolveSection(sections, req.query.section_id as string | undefined);
    if ('error' in resolved) return res.status(resolved.status).json({ error: resolved.error });
    const { section_id } = resolved;

    const students = await pool.query(
      `SELECT s.id, s.name, s.father_name,
              ar.status        AS attendance_status,
              ar.submitted_at,
              ar.first_submitted_at,
              ar.is_late,
              ar.arrived_at,
              ar.edited_at,
              editor.name      AS edited_by_name
       FROM students s
       LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.attend_date = $1
       LEFT JOIN users editor ON editor.id = ar.edited_by
       WHERE s.section_id = $2 AND s.is_active = true
       ORDER BY s.name`,
      [today, section_id]
    );

    // Check if marking is late (>90 mins after school start)
    const classRow = await pool.query(
      'SELECT day_start_time FROM classes WHERE id = (SELECT class_id FROM sections WHERE id = $1) LIMIT 1',
      [section_id]
    );
    const startTime = classRow.rows[0]?.day_start_time || '09:30:00';
    const [sh, sm] = startTime.split(':').map(Number);
    const now = getNowIST();
    const schoolStartMinutes = sh * 60 + sm;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const minutesLate = nowMinutes - schoolStartMinutes;
    const late_marking_warning = minutesLate > 90
      ? `You are marking attendance ${minutesLate - 90} minutes after the recommended time. Please mark attendance at the start of class.`
      : null;

    return res.json({ date: today, section_id, students: students.rows, late_marking_warning });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/teacher/attendance/today — initial submission
router.post('/today', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const now = getNowIST();

    const sections = await getTeacherSections(user_id, school_id);
    const resolved = await resolveSection(sections, req.query.section_id as string | undefined);
    if ('error' in resolved) return res.status(resolved.status).json({ error: resolved.error });
    const { section_id } = resolved;

    const { records, confirm_holiday } = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'records array is required' });

    // ── Validate against school calendar ──
    const calRow = await pool.query(
      `SELECT sc.working_days, sc.start_date, sc.end_date, sc.holidays, sc.academic_year
       FROM school_calendar sc
       WHERE sc.school_id = $1 AND sc.start_date <= $2 AND sc.end_date >= $2 LIMIT 1`,
      [school_id, today]
    );

    if (calRow.rows.length > 0) {
      const cal = calRow.rows[0];
      const todayDate = new Date(today + 'T12:00:00');
      const dayOfWeek = todayDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

      // Check if today is a working day (working_days is an array like [1,2,3,4,5])
      const workingDays: number[] = cal.working_days || [1, 2, 3, 4, 5];
      if (!workingDays.includes(dayOfWeek)) {
        return res.status(400).json({
          error: 'Today is not a working day. Attendance cannot be marked on weekends/off days.',
          reason: 'non_working_day',
          day: dayOfWeek,
        });
      }

      // Check if today is a holiday
      const holidays: string[] = (cal.holidays || []).map((h: any) => typeof h === 'string' ? h.split('T')[0] : '');
      if (holidays.includes(today)) {
        // Allow if teacher explicitly confirms (confirm_holiday flag)
        if (!confirm_holiday) {
          // Check holidays table for the name
          const holidayRow = await pool.query(
            'SELECT event_name FROM holidays WHERE school_id = $1 AND academic_year = $2 AND holiday_date = $3',
            [school_id, cal.academic_year, today]
          );
          const holidayName = holidayRow.rows[0]?.event_name || 'a scheduled holiday';
          return res.status(400).json({
            error: `Today is ${holidayName}. Are you sure you want to mark attendance?`,
            reason: 'holiday',
            holiday_name: holidayName,
            confirm_required: true,
          });
        }
      }
    } else {
      // No calendar found — check if today is before any academic year starts
      const anyCalRow = await pool.query(
        `SELECT start_date, end_date FROM school_calendar WHERE school_id = $1 ORDER BY start_date DESC LIMIT 1`,
        [school_id]
      );
      if (anyCalRow.rows.length > 0) {
        const { start_date, end_date } = anyCalRow.rows[0];
        if (today < start_date) {
          return res.status(400).json({
            error: `Academic year hasn't started yet. It begins on ${start_date}.`,
            reason: 'before_academic_year',
          });
        }
        if (today > end_date) {
          return res.status(400).json({
            error: `Academic year has ended (${end_date}). Please contact admin to update the calendar.`,
            reason: 'after_academic_year',
          });
        }
      }
    }

    // Check if today is a holiday (informational note for confirmed submissions)
    let holiday_note: string | null = null;
    if (calRow.rows.length > 0 && confirm_holiday) {
      const holidayRow = await pool.query(
        'SELECT event_name FROM holidays WHERE school_id = $1 AND academic_year = $2 AND holiday_date = $3',
        [school_id, calRow.rows[0].academic_year, today]
      );
      if (holidayRow.rows.length > 0) {
        holiday_note = `Today is ${holidayRow.rows[0].event_name}. Attendance recorded as requested.`;
      }
    }

    // Check late marking warning
    const classRow = await pool.query(
      'SELECT day_start_time FROM classes WHERE id = (SELECT class_id FROM sections WHERE id = $1) LIMIT 1',
      [section_id]
    );
    const startTime = classRow.rows[0]?.day_start_time || '09:30:00';
    const [sh, sm] = startTime.split(':').map(Number);
    const schoolStartMinutes = sh * 60 + sm;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const minutesLate = nowMinutes - schoolStartMinutes;
    const late_marking_warning = minutesLate > 90
      ? `Attendance marked ${minutesLate} minutes after school start. Please mark attendance at the beginning of class.`
      : null;

    // Upsert attendance records
    // Rule: once a student is marked present, they cannot be moved back to absent.
    // Only absent → present transitions are allowed after initial submission.
    for (const rec of records) {
      const { student_id, status } = rec;
      if (!student_id || !['present', 'absent'].includes(status)) continue;
      await pool.query(
        `INSERT INTO attendance_records
           (school_id, section_id, student_id, teacher_id, attend_date, status, submitted_at, first_submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now())
         ON CONFLICT (section_id, student_id, attend_date) DO UPDATE
           SET status = CASE
                 -- Never move present → absent once submitted
                 WHEN attendance_records.status = 'present' THEN 'present'
                 ELSE EXCLUDED.status
               END,
               submitted_at = now()`,
        [school_id, section_id, student_id, user_id, today, status]
      );
    }

    return res.json({ message: 'Attendance submitted', date: today, late_marking_warning, holiday_note });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/teacher/attendance/today/:student_id — mark late arrival
// Used when a student arrives late and teacher updates from absent → present
router.patch('/today/:student_id', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const today = await getToday(school_id);
    const { student_id } = req.params;
    const { status } = req.body; // 'present' (late arrival) or 'absent'

    if (!['present', 'absent'].includes(status)) {
      return res.status(400).json({ error: 'status must be present or absent' });
    }

    const sections = await getTeacherSections(user_id, school_id);
    const resolved = await resolveSection(sections, req.query.section_id as string | undefined);
    if ('error' in resolved) return res.status(resolved.status).json({ error: resolved.error });
    const { section_id } = resolved;

    // Rule: once a student is marked present, they cannot be moved back to absent
    if (status === 'absent') {
      const currentRow = await pool.query(
        'SELECT status FROM attendance_records WHERE student_id = $1 AND attend_date = $2 AND section_id = $3',
        [student_id, today, section_id]
      );
      if (currentRow.rows[0]?.status === 'present') {
        return res.status(400).json({
          error: 'Cannot mark a present student as absent. Attendance can only be updated from absent to present (late arrival).',
        });
      }
    }

    // Verify student belongs to this section
    const studentRow = await pool.query(
      'SELECT id FROM students WHERE id = $1 AND section_id = $2 AND school_id = $3',
      [student_id, section_id, school_id]
    );
    if (studentRow.rows.length === 0) return res.status(403).json({ error: 'Student not in your section' });

    // Check if original record exists
    const existing = await pool.query(
      'SELECT id, status, first_submitted_at FROM attendance_records WHERE student_id = $1 AND attend_date = $2 AND section_id = $3',
      [student_id, today, section_id]
    );

    const isLateArrival = status === 'present' && existing.rows[0]?.status === 'absent';
    const arrivedAt = isLateArrival ? new Date() : null;

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE attendance_records
         SET status = $1,
             submitted_at = now(),
             edited_by = $2,
             edited_at = now(),
             is_late = $3,
             arrived_at = COALESCE($4, arrived_at)
         WHERE student_id = $5 AND attend_date = $6 AND section_id = $7`,
        [status, user_id, isLateArrival, arrivedAt, student_id, today, section_id]
      );
    } else {
      await pool.query(
        `INSERT INTO attendance_records
           (school_id, section_id, student_id, teacher_id, attend_date, status,
            submitted_at, first_submitted_at, is_late, arrived_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now(), $7, $8)`,
        [school_id, section_id, student_id, user_id, today, status, isLateArrival, arrivedAt]
      );
    }

    return res.json({
      message: isLateArrival ? 'Student marked as late arrival' : 'Attendance updated',
      is_late: isLateArrival,
      arrived_at: arrivedAt,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/teacher/attendance/:date
router.get('/:date', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const { date } = req.params;

    const sections = await getTeacherSections(user_id, school_id);
    const resolved = await resolveSection(sections, req.query.section_id as string | undefined);
    if ('error' in resolved) return res.status(resolved.status).json({ error: resolved.error });
    const { section_id } = resolved;

    const students = await pool.query(
      `SELECT s.id, s.name,
              ar.status AS attendance_status,
              ar.is_late,
              ar.arrived_at,
              ar.submitted_at
       FROM students s
       LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.attend_date = $1
       WHERE s.section_id = $2 AND s.is_active = true
       ORDER BY s.name`,
      [date, section_id]
    );

    const today = await getToday(school_id);
    const editable = date === today;

    return res.json({ date, section_id, students: students.rows, editable });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

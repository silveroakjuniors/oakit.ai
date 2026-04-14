import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getTeacherSections } from '../../lib/teacherSection';
import { getToday } from '../../lib/today';

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
    const now = new Date();
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
    const now = new Date();

    const sections = await getTeacherSections(user_id, school_id);
    const resolved = await resolveSection(sections, req.query.section_id as string | undefined);
    if ('error' in resolved) return res.status(resolved.status).json({ error: resolved.error });
    const { section_id } = resolved;

    const { records, confirm_holiday } = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'records array is required' });

    // Check if today is a holiday
    const calRow = await pool.query(
      `SELECT sc.academic_year FROM school_calendar sc
       WHERE sc.school_id = $1 AND sc.start_date <= $2 AND sc.end_date >= $2 LIMIT 1`,
      [school_id, today]
    );
    if (calRow.rows.length > 0) {
      const holidayRow = await pool.query(
        'SELECT event_name FROM holidays WHERE school_id = $1 AND academic_year = $2 AND holiday_date = $3',
        [school_id, calRow.rows[0].academic_year, today]
      );
      if (holidayRow.rows.length > 0 && !confirm_holiday) {
        return res.status(409).json({
          warning: 'Date is a holiday',
          holiday_name: holidayRow.rows[0].event_name,
        });
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
    for (const rec of records) {
      const { student_id, status } = rec;
      if (!student_id || !['present', 'absent'].includes(status)) continue;
      await pool.query(
        `INSERT INTO attendance_records
           (school_id, section_id, student_id, teacher_id, attend_date, status, submitted_at, first_submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now())
         ON CONFLICT (section_id, student_id, attend_date) DO UPDATE
           SET status = EXCLUDED.status, submitted_at = now()`,
        [school_id, section_id, student_id, user_id, today, status]
      );
    }

    return res.json({ message: 'Attendance submitted', date: today, late_marking_warning });
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

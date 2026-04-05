"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const teacherSection_1 = require("../../lib/teacherSection");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.forceResetGuard, auth_1.schoolScope, (0, auth_1.roleGuard)('teacher'));
async function resolveSection(sections, querySectionId) {
    if (sections.length === 0)
        return { error: 'No section assigned', status: 404 };
    if (sections.length === 1)
        return { section_id: sections[0].section_id };
    if (!querySectionId)
        return { error: 'section_id required — you are assigned to multiple sections', status: 400 };
    const found = sections.find(s => s.section_id === querySectionId);
    if (!found)
        return { error: 'Not authorized for this section', status: 403 };
    return { section_id: found.section_id };
}
// GET /api/v1/teacher/attendance/today
router.get('/today', async (req, res) => {
    try {
        const { user_id, school_id } = req.user;
        const today = new Date().toISOString().split('T')[0];
        const sections = await (0, teacherSection_1.getTeacherSections)(user_id, school_id);
        const resolved = await resolveSection(sections, req.query.section_id);
        if ('error' in resolved)
            return res.status(resolved.status).json({ error: resolved.error });
        const { section_id } = resolved;
        const students = await db_1.pool.query(`SELECT s.id, s.name, s.father_name,
              ar.status as attendance_status
       FROM students s
       LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.attend_date = $1
       WHERE s.section_id = $2 AND s.is_active = true
       ORDER BY s.name`, [today, section_id]);
        return res.json({ date: today, section_id, students: students.rows });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/teacher/attendance/today
router.post('/today', async (req, res) => {
    try {
        const { user_id, school_id } = req.user;
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        // Midnight cutoff: reject if past midnight (next day)
        if (now.getHours() === 0 && now.getMinutes() > 0) {
            // Allow up to midnight of today
        }
        // Simple check: date must be today
        const todayDate = now.toISOString().split('T')[0];
        if (todayDate !== today) {
            return res.status(400).json({ error: 'Attendance can only be submitted for today' });
        }
        const sections = await (0, teacherSection_1.getTeacherSections)(user_id, school_id);
        const resolved = await resolveSection(sections, req.query.section_id);
        if ('error' in resolved)
            return res.status(resolved.status).json({ error: resolved.error });
        const { section_id } = resolved;
        const { records, confirm_holiday } = req.body;
        if (!Array.isArray(records))
            return res.status(400).json({ error: 'records array is required' });
        // Check if today is a holiday
        const calRow = await db_1.pool.query(`SELECT sc.academic_year FROM school_calendar sc
       WHERE sc.school_id = $1 AND sc.start_date <= $2 AND sc.end_date >= $2 LIMIT 1`, [school_id, today]);
        if (calRow.rows.length > 0) {
            const holidayRow = await db_1.pool.query('SELECT event_name FROM holidays WHERE school_id = $1 AND academic_year = $2 AND holiday_date = $3', [school_id, calRow.rows[0].academic_year, today]);
            if (holidayRow.rows.length > 0 && !confirm_holiday) {
                return res.status(409).json({
                    warning: 'Date is a holiday',
                    holiday_name: holidayRow.rows[0].event_name,
                });
            }
        }
        // Upsert attendance records
        for (const rec of records) {
            const { student_id, status } = rec;
            if (!student_id || !['present', 'absent'].includes(status))
                continue;
            await db_1.pool.query(`INSERT INTO attendance_records (school_id, section_id, student_id, teacher_id, attend_date, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (section_id, student_id, attend_date) DO UPDATE SET status = EXCLUDED.status, submitted_at = now()`, [school_id, section_id, student_id, user_id, today, status]);
        }
        return res.json({ message: 'Attendance submitted', date: today });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/teacher/attendance/:date
router.get('/:date', async (req, res) => {
    try {
        const { user_id, school_id } = req.user;
        const { date } = req.params;
        const sections = await (0, teacherSection_1.getTeacherSections)(user_id, school_id);
        const resolved = await resolveSection(sections, req.query.section_id);
        if ('error' in resolved)
            return res.status(resolved.status).json({ error: resolved.error });
        const { section_id } = resolved;
        const students = await db_1.pool.query(`SELECT s.id, s.name, ar.status as attendance_status
       FROM students s
       LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.attend_date = $1
       WHERE s.section_id = $2 AND s.is_active = true
       ORDER BY s.name`, [date, section_id]);
        const today = new Date().toISOString().split('T')[0];
        const editable = date === today;
        return res.json({ date, section_id, students: students.rows, editable });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;

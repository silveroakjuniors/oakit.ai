"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const today_1 = require("../../lib/today");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.schoolScope, (0, auth_1.roleGuard)('principal', 'admin'));
const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';
const THOUGHTS = [
    'A great school is built one teacher at a time.',
    'Leadership is not about being in charge. It is about taking care of those in your charge.',
    'The best teachers teach from the heart, not from the book.',
    'Education is the most powerful weapon which you can use to change the world.',
    'Children are not things to be molded, but people to be unfolded.',
    'The art of teaching is the art of assisting discovery.',
    'Every child deserves a champion — an adult who will never give up on them.',
];
// GET /api/v1/principal/context
router.get('/', async (req, res) => {
    try {
        const { user_id, school_id } = req.user;
        const today = await (0, today_1.getToday)(school_id);
        // Principal's name
        const userRow = await db_1.pool.query('SELECT name FROM users WHERE id = $1', [user_id]);
        const principal_name = userRow.rows[0]?.name || 'Principal';
        // Thought of the day (rotate by day of year)
        const doy = Math.floor((new Date(today).getTime() - new Date(new Date(today).getFullYear(), 0, 0).getTime()) / 86400000);
        const thought_for_day = THOUGHTS[doy % THOUGHTS.length];
        // Today's attendance summary per section with student counts
        const attendanceResult = await db_1.pool.query(`SELECT
         s.id          AS section_id,
         s.label       AS section_label,
         c.name        AS class_name,
         ct.name       AS class_teacher_name,
         -- total students
         COUNT(DISTINCT st.id)::int                                          AS total_students,
         -- present today
         COUNT(DISTINCT ar.student_id) FILTER (WHERE ar.status = 'present')::int AS present_today,
         -- absent today
         COUNT(DISTINCT ar.student_id) FILTER (WHERE ar.status = 'absent')::int  AS absent_today,
         -- attendance submitted?
         CASE WHEN COUNT(ar.id) > 0 THEN true ELSE false END                AS attendance_submitted
       FROM sections s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN users ct ON ct.id = s.class_teacher_id
       LEFT JOIN students st ON st.section_id = s.id
       LEFT JOIN attendance_records ar ON ar.section_id = s.id AND ar.attend_date = $2
       WHERE s.school_id = $1
       GROUP BY s.id, s.label, c.name, ct.name
       ORDER BY c.name, s.label`, [school_id, today]);
        // School-level totals
        const totalStudents = attendanceResult.rows.reduce((s, r) => s + r.total_students, 0);
        const totalPresent = attendanceResult.rows.reduce((s, r) => s + r.present_today, 0);
        const totalAbsent = attendanceResult.rows.reduce((s, r) => s + r.absent_today, 0);
        const submittedCount = attendanceResult.rows.filter((r) => r.attendance_submitted).length;
        // Try AI greeting
        let greeting = `Good morning, ${principal_name}!`;
        try {
            const aiResp = await axios_1.default.get(`${AI()}/internal/greeting`, {
                params: { teacher_name: principal_name, teacher_id: user_id },
                timeout: 3000,
            });
            greeting = aiResp.data.greeting || greeting;
        }
        catch { /* use default */ }
        return res.json({
            principal_name,
            greeting,
            thought_for_day,
            today,
            sections: attendanceResult.rows,
            summary: {
                total_students: totalStudents,
                total_present: totalPresent,
                total_absent: totalAbsent,
                attendance_submitted: submittedCount,
                total_sections: attendanceResult.rows.length,
            },
        });
    }
    catch (err) {
        console.error('Principal context error:', err.message);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
exports.default = router;

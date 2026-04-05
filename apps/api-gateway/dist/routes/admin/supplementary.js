"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.schoolScope, (0, auth_1.roleGuard)('admin'));
// ─── Activity Pools ──────────────────────────────────────────────────────────
// GET /pools — list all pools for school
router.get('/pools', async (req, res) => {
    try {
        const { school_id } = req.user;
        const result = await db_1.pool.query(`SELECT ap.id, ap.name, ap.description, ap.language, ap.created_at,
              COUNT(a.id)::int AS activity_count
       FROM activity_pools ap
       LEFT JOIN activities a ON a.activity_pool_id = ap.id
       WHERE ap.school_id = $1
       GROUP BY ap.id ORDER BY ap.name`, [school_id]);
        return res.json(result.rows);
    }
    catch (err) {
        console.error('GET /pools error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// POST /pools — create pool
router.post('/pools', async (req, res) => {
    try {
        const { school_id } = req.user;
        const { name, description, language = 'English' } = req.body;
        if (!name)
            return res.status(400).json({ error: 'name is required' });
        const result = await db_1.pool.query(`INSERT INTO activity_pools (school_id, name, description, language)
       VALUES ($1, $2, $3, $4) RETURNING *`, [school_id, name, description ?? null, language]);
        return res.status(201).json(result.rows[0]);
    }
    catch (err) {
        if (err.code === '23505')
            return res.status(400).json({ error: 'A pool with this name already exists' });
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// DELETE /pools/:id — delete pool (cascades activities + assignments)
router.delete('/pools/:id', async (req, res) => {
    try {
        const { school_id } = req.user;
        await db_1.pool.query('DELETE FROM activity_pools WHERE id = $1 AND school_id = $2', [req.params.id, school_id]);
        return res.json({ message: 'Pool deleted' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// ─── Activities ──────────────────────────────────────────────────────────────
// GET /pools/:pool_id/activities
router.get('/pools/:pool_id/activities', async (req, res) => {
    try {
        const { school_id } = req.user;
        const result = await db_1.pool.query(`SELECT a.id, a.title, a.description, a.position
       FROM activities a
       JOIN activity_pools ap ON ap.id = a.activity_pool_id
       WHERE a.activity_pool_id = $1 AND ap.school_id = $2
       ORDER BY a.position, a.created_at`, [req.params.pool_id, school_id]);
        return res.json(result.rows);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /pools/:pool_id/activities — add activity
router.post('/pools/:pool_id/activities', async (req, res) => {
    try {
        const { school_id } = req.user;
        const { title, description } = req.body;
        if (!title)
            return res.status(400).json({ error: 'title is required' });
        if (title.length > 200)
            return res.status(400).json({ error: 'title must be 200 characters or less' });
        // Verify pool belongs to school
        const poolRow = await db_1.pool.query('SELECT id FROM activity_pools WHERE id = $1 AND school_id = $2', [req.params.pool_id, school_id]);
        if (poolRow.rows.length === 0)
            return res.status(404).json({ error: 'Pool not found' });
        // Get next position
        const posRow = await db_1.pool.query('SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM activities WHERE activity_pool_id = $1', [req.params.pool_id]);
        const position = posRow.rows[0].next_pos;
        const result = await db_1.pool.query(`INSERT INTO activities (activity_pool_id, school_id, title, description, position)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [req.params.pool_id, school_id, title, description ?? null, position]);
        return res.status(201).json(result.rows[0]);
    }
    catch (err) {
        if (err.code === '23505')
            return res.status(400).json({ error: 'An activity with this title already exists in this pool' });
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// DELETE /pools/:pool_id/activities/:id
router.delete('/pools/:pool_id/activities/:id', async (req, res) => {
    try {
        const { school_id } = req.user;
        // Check if activity has plans
        const inUse = await db_1.pool.query('SELECT id FROM supplementary_plans WHERE activity_id = $1 LIMIT 1', [req.params.id]);
        if (inUse.rows.length > 0) {
            return res.status(409).json({ error: 'This activity is already scheduled and cannot be deleted' });
        }
        await db_1.pool.query(`DELETE FROM activities WHERE id = $1 AND school_id = $2`, [req.params.id, school_id]);
        return res.json({ message: 'Activity deleted' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// PUT /pools/:pool_id/activities/reorder — update positions
router.put('/pools/:pool_id/activities/reorder', async (req, res) => {
    try {
        const { school_id } = req.user;
        const { order } = req.body; // array of { id, position }
        if (!Array.isArray(order))
            return res.status(400).json({ error: 'order array required' });
        const client = await db_1.pool.connect();
        try {
            await client.query('BEGIN');
            for (const item of order) {
                await client.query('UPDATE activities SET position = $1 WHERE id = $2 AND school_id = $3', [item.position, item.id, school_id]);
            }
            await client.query('COMMIT');
        }
        catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
        finally {
            client.release();
        }
        return res.json({ message: 'Order updated' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// ─── Pool Assignments ────────────────────────────────────────────────────────
// GET /assignments — list all assignments for school
router.get('/assignments', async (req, res) => {
    try {
        const { school_id } = req.user;
        const result = await db_1.pool.query(`SELECT pa.id, pa.activity_pool_id, pa.class_id, pa.frequency_mode,
              pa.interval_days, pa.start_date, pa.end_date, pa.carry_forward_on_miss,
              ap.name AS pool_name, c.name AS class_name
       FROM pool_assignments pa
       JOIN activity_pools ap ON ap.id = pa.activity_pool_id
       JOIN classes c ON c.id = pa.class_id
       WHERE pa.school_id = $1 AND pa.is_deleted = false
       ORDER BY c.name, ap.name`, [school_id]);
        return res.json(result.rows);
    }
    catch (err) {
        console.error('GET /assignments error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// POST /assignments — create assignment + auto-schedule
router.post('/assignments', async (req, res) => {
    try {
        const { school_id } = req.user;
        const { activity_pool_id, class_id, frequency_mode, interval_days, start_date, end_date, carry_forward_on_miss } = req.body;
        if (!activity_pool_id || !class_id || !frequency_mode || !start_date || !end_date) {
            return res.status(400).json({ error: 'activity_pool_id, class_id, frequency_mode, start_date, end_date are required' });
        }
        if (end_date <= start_date) {
            return res.status(400).json({ error: 'end_date must be after start_date' });
        }
        if (frequency_mode === 'interval' && !interval_days) {
            return res.status(400).json({ error: 'interval_days is required for interval frequency mode' });
        }
        const result = await db_1.pool.query(`INSERT INTO pool_assignments
         (school_id, activity_pool_id, class_id, frequency_mode, interval_days, start_date, end_date, carry_forward_on_miss)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`, [school_id, activity_pool_id, class_id, frequency_mode, interval_days ?? null, start_date, end_date, carry_forward_on_miss ?? false]);
        const assignment = result.rows[0];
        // Auto-schedule
        await scheduleAssignment(assignment, school_id);
        return res.status(201).json(assignment);
    }
    catch (err) {
        if (err.code === '23505')
            return res.status(409).json({ error: 'This pool is already assigned to this class' });
        console.error('Assignment error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// DELETE /assignments/:id — soft delete
router.delete('/assignments/:id', async (req, res) => {
    try {
        const { school_id } = req.user;
        await db_1.pool.query('UPDATE pool_assignments SET is_deleted = true WHERE id = $1 AND school_id = $2', [req.params.id, school_id]);
        return res.json({ message: 'Assignment removed' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /assignments/:id/reschedule — re-run scheduler for an assignment
router.post('/assignments/:id/reschedule', async (req, res) => {
    try {
        const { school_id } = req.user;
        const assignmentRow = await db_1.pool.query('SELECT * FROM pool_assignments WHERE id = $1 AND school_id = $2 AND is_deleted = false', [req.params.id, school_id]);
        if (assignmentRow.rows.length === 0)
            return res.status(404).json({ error: 'Assignment not found' });
        await scheduleAssignment(assignmentRow.rows[0], school_id);
        return res.json({ message: 'Rescheduled' });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /schedule — monthly schedule view
router.get('/schedule', async (req, res) => {
    try {
        const { school_id } = req.user;
        const { class_id, month, year } = req.query;
        if (!class_id || !month || !year) {
            return res.status(400).json({ error: 'class_id, month, year are required' });
        }
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
        const result = await db_1.pool.query(`SELECT sp.id, sp.section_id, sp.plan_date, sp.status, sp.override_note,
              a.title AS activity_title, a.description AS activity_description,
              ap.name AS pool_name, s.label AS section_name
       FROM supplementary_plans sp
       JOIN activities a ON a.id = sp.activity_id
       JOIN pool_assignments pa ON pa.id = sp.pool_assignment_id
       JOIN activity_pools ap ON ap.id = pa.activity_pool_id
       JOIN sections s ON s.id = sp.section_id
       WHERE sp.school_id = $1
         AND pa.class_id = $2
         AND sp.plan_date BETWEEN $3 AND $4
       ORDER BY sp.plan_date, s.name, ap.name`, [school_id, class_id, startDate, endDate]);
        return res.json(result.rows);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// ─── Scheduler ───────────────────────────────────────────────────────────────
async function scheduleAssignment(assignment, school_id) {
    const { id: assignment_id, activity_pool_id, class_id, frequency_mode, interval_days, start_date, end_date } = assignment;
    // Get all sections for this class (sections table uses 'label', no is_active column)
    const sectionsResult = await db_1.pool.query('SELECT id FROM sections WHERE class_id = $1 AND school_id = $2', [class_id, school_id]);
    const sections = sectionsResult.rows.map((r) => r.id);
    if (sections.length === 0)
        return;
    // Get all activities in order
    const activitiesResult = await db_1.pool.query('SELECT id FROM activities WHERE activity_pool_id = $1 ORDER BY position, created_at', [activity_pool_id]);
    const activityIds = activitiesResult.rows.map((r) => r.id);
    if (activityIds.length === 0)
        return;
    // Get school calendar (working days + holidays)
    const calendarResult = await db_1.pool.query(`SELECT working_days, holidays, start_date AS cal_start, end_date AS cal_end
     FROM school_calendar
     WHERE school_id = $1
       AND $2::date BETWEEN start_date AND end_date
     LIMIT 1`, [school_id, start_date]);
    const calendar = calendarResult.rows[0];
    const workingDays = calendar?.working_days || [1, 2, 3, 4, 5];
    const holidays = (calendar?.holidays || []).map((d) => String(d).split('T')[0]);
    // Get special days (blocked)
    const specialResult = await db_1.pool.query(`SELECT day_date FROM special_days
     WHERE school_id = $1 AND day_date BETWEEN $2 AND $3`, [school_id, start_date, end_date]);
    const specialDays = new Set(specialResult.rows.map((r) => String(r.day_date).split('T')[0]));
    const holidaySet = new Set(holidays);
    function isWorkingDay(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const dow = d.getDay(); // 0=Sun
        return workingDays.includes(dow) && !holidaySet.has(dateStr) && !specialDays.has(dateStr);
    }
    // Build list of all working days in range
    function getWorkingDaysInRange(from, to) {
        const days = [];
        const cur = new Date(from + 'T12:00:00');
        const end = new Date(to + 'T12:00:00');
        while (cur <= end) {
            const ds = cur.toISOString().split('T')[0];
            if (isWorkingDay(ds))
                days.push(ds);
            cur.setDate(cur.getDate() + 1);
        }
        return days;
    }
    const allWorkingDays = getWorkingDaysInRange(start_date, end_date);
    for (const section_id of sections) {
        // Get or init rotation cursor
        const cursorResult = await db_1.pool.query(`INSERT INTO supplementary_rotation_cursors (section_id, pool_assignment_id, next_position)
       VALUES ($1, $2, 0)
       ON CONFLICT (section_id, pool_assignment_id) DO UPDATE SET next_position = supplementary_rotation_cursors.next_position
       RETURNING next_position`, [section_id, assignment_id]);
        let cursor = cursorResult.rows[0].next_position;
        // Determine scheduled dates based on frequency
        let scheduledDates = [];
        if (frequency_mode === 'weekly') {
            // One per calendar week — pick lowest day-load working day
            const weekMap = new Map();
            for (const d of allWorkingDays) {
                const date = new Date(d + 'T12:00:00');
                const weekKey = getISOWeek(date);
                if (!weekMap.has(weekKey))
                    weekMap.set(weekKey, []);
                weekMap.get(weekKey).push(d);
            }
            for (const [, days] of weekMap) {
                // Pick first day of week (lowest day-load approximation)
                scheduledDates.push(days[0]);
            }
        }
        else {
            // interval mode: every N working days
            const n = interval_days || 7;
            for (let i = 0; i < allWorkingDays.length; i += n) {
                scheduledDates.push(allWorkingDays[i]);
            }
        }
        // Insert plans (skip if override exists)
        for (const planDate of scheduledDates) {
            const activityId = activityIds[cursor % activityIds.length];
            cursor = (cursor + 1) % activityIds.length;
            await db_1.pool.query(`INSERT INTO supplementary_plans
           (school_id, section_id, pool_assignment_id, activity_id, plan_date)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (section_id, pool_assignment_id, plan_date) DO NOTHING`, [school_id, section_id, assignment_id, activityId, planDate]);
        }
        // Update cursor
        await db_1.pool.query(`UPDATE supplementary_rotation_cursors SET next_position = $1
       WHERE section_id = $2 AND pool_assignment_id = $3`, [cursor, section_id, assignment_id]);
    }
}
function getISOWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
exports.default = router;

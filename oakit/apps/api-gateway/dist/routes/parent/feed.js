"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const today_1 = require("../../lib/today");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.forceResetGuard, auth_1.schoolScope, (0, auth_1.roleGuard)('parent'));
// GET / — daily feed for linked children
router.get('/', async (req, res) => {
    try {
        const { user_id, school_id } = req.user;
        const date = req.query.date;
        // Determine date
        let feedDate;
        if (date) {
            feedDate = date;
        }
        else {
            feedDate = await (0, today_1.getToday)(school_id);
        }
        // Get linked children with their sections
        const links = await db_1.pool.query(`SELECT psl.student_id, st.name AS student_name, st.section_id
       FROM parent_student_links psl
       JOIN students st ON st.id = psl.student_id
       WHERE psl.parent_id = $1`, [user_id]);
        const feed = [];
        for (const link of links.rows) {
            const { student_id, student_name, section_id } = link;
            // Check for completion
            const completionRow = await db_1.pool.query(`SELECT id, covered_chunk_ids, settling_day_note FROM daily_completions
         WHERE section_id = $1 AND completion_date = $2`, [section_id, feedDate]);
            if (completionRow.rows.length > 0) {
                const comp = completionRow.rows[0];
                // Get topic labels for covered chunks
                let topic_labels = [];
                if (comp.covered_chunk_ids?.length > 0) {
                    const chunksRow = await db_1.pool.query(`SELECT topic_label FROM curriculum_chunks WHERE id = ANY($1::uuid[])`, [comp.covered_chunk_ids]);
                    topic_labels = chunksRow.rows.map((r) => r.topic_label);
                }
                feed.push({
                    student_id,
                    student_name,
                    type: 'curriculum',
                    topic_labels,
                    settling_day_note: comp.settling_day_note ?? null,
                });
                continue;
            }
            // Check for special day
            const specialRow = await db_1.pool.query(`SELECT label, day_type FROM special_days
         WHERE school_id = $1 AND day_date = $2 LIMIT 1`, [school_id, feedDate]);
            if (specialRow.rows.length > 0) {
                feed.push({
                    student_id,
                    student_name,
                    type: 'special_day',
                    label: specialRow.rows[0].label,
                    day_type: specialRow.rows[0].day_type,
                });
                continue;
            }
            feed.push({ student_id, student_name, type: 'empty' });
        }
        return res.json(feed);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;

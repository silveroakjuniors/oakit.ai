"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.schoolScope, (0, auth_1.roleGuard)('teacher'));
const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';
// POST /api/v1/teacher/coverage
router.post('/', async (req, res) => {
    try {
        const { user_id, school_id } = req.user;
        const { log_text, section_id } = req.body;
        if (!log_text || !section_id) {
            return res.status(400).json({ error: 'log_text and section_id are required' });
        }
        const today = new Date().toISOString().split('T')[0];
        const logResult = await db_1.pool.query(`INSERT INTO coverage_logs (school_id, section_id, teacher_id, log_date, log_text)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`, [school_id, section_id, user_id, today, log_text]);
        const coverage_log_id = logResult.rows[0].id;
        // Trigger coverage analysis
        let analysisResults = [];
        try {
            const aiResp = await axios_1.default.post(`${AI()}/internal/analyze-coverage`, {
                coverage_log_id, log_text, section_id, log_date: today,
            }, { timeout: 30000 });
            analysisResults = aiResp.data.results || [];
        }
        catch (aiErr) {
            console.error('Coverage analysis failed:', aiErr);
        }
        return res.status(201).json({ coverage_log_id, results: analysisResults });
    }
    catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Coverage log already submitted for today' });
        }
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// PUT /api/v1/teacher/coverage/:id
router.put('/:id', async (req, res) => {
    try {
        const { user_id, school_id } = req.user;
        const { log_text } = req.body;
        if (!log_text)
            return res.status(400).json({ error: 'log_text is required' });
        // Check 24h edit window
        const existing = await db_1.pool.query('SELECT id, submitted_at, section_id, log_date FROM coverage_logs WHERE id = $1 AND teacher_id = $2 AND school_id = $3', [req.params.id, user_id, school_id]);
        if (existing.rows.length === 0)
            return res.status(404).json({ error: 'Log not found' });
        const submitted = new Date(existing.rows[0].submitted_at);
        const hoursSince = (Date.now() - submitted.getTime()) / 3600000;
        if (hoursSince > 24)
            return res.status(403).json({ error: 'Edit window has expired (24 hours)' });
        await db_1.pool.query('UPDATE coverage_logs SET log_text = $1, edited_at = now() WHERE id = $2', [log_text, req.params.id]);
        // Re-run analysis
        try {
            await axios_1.default.post(`${AI()}/internal/analyze-coverage`, {
                coverage_log_id: req.params.id,
                log_text,
                section_id: existing.rows[0].section_id,
                log_date: existing.rows[0].log_date,
            }, { timeout: 30000 });
        }
        catch (aiErr) {
            console.error('Re-analysis failed:', aiErr);
        }
        return res.json({ message: 'Coverage log updated' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/teacher/coverage/history
router.get('/history', async (req, res) => {
    try {
        const { user_id, school_id } = req.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const result = await db_1.pool.query(`SELECT cl.id, cl.log_date, cl.log_text, cl.flagged, cl.submitted_at, cl.edited_at,
              s.label as section_label, c.name as class_name,
              json_agg(json_build_object('chunk_id', cs.chunk_id, 'status', cs.status, 'score', cs.similarity_score)) as coverage
       FROM coverage_logs cl
       JOIN sections s ON cl.section_id = s.id
       JOIN classes c ON s.class_id = c.id
       LEFT JOIN coverage_statuses cs ON cs.coverage_log_id = cl.id
       WHERE cl.teacher_id = $1 AND cl.school_id = $2
       GROUP BY cl.id, s.label, c.name
       ORDER BY cl.log_date DESC LIMIT $3 OFFSET $4`, [user_id, school_id, limit, offset]);
        return res.json(result.rows);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;

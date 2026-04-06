"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const redis_1 = require("../lib/redis");
const db_1 = require("../lib/db");
const today_1 = require("../lib/today");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
router.use(auth_1.jwtVerify, auth_1.schoolScope, (0, auth_1.roleGuard)('teacher', 'principal', 'admin', 'parent'));
router.use(rateLimit_1.aiRateLimit);
const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';
const MAX_ACTIVITY_QUESTIONS = 5;
const NUDGE_AT = 3;
const AI_TIMEOUT_MS = 60000;
// Inappropriate content patterns — logged as 'blocked_inappropriate'
const INAPPROPRIATE_PATTERNS = [
    // Sexual content — direct and euphemistic
    /\bsex\b/i, /\bporn\b/i, /\bnude\b/i, /\bnaked\b/i, /\bsexual\b/i,
    /\berotic\b/i, /\berotica\b/i, /\badult\s+content\b/i, /\b18\+\b/i,
    /\bintercourse\b/i, /\bgenitals?\b/i, /\bpenis\b/i, /\bvagina\b/i,
    /\bnipple\b/i, /\bbreasts?\b/i, /\bboobs?\b/i, /\bbutt\s+naked\b/i,
    /\bsexually\b/i, /\bsex\s+story\b/i, /\bsex\s+stories\b/i,
    /\bxxx\b/i, /\bnsfw\b/i, /\bonly\s*fans\b/i,
    // Obfuscated spellings — s3x, s3e, s*x, s.e.x
    /\bs[3e][x*]\b/i, /\bp[o0]rn\b/i,
    // s3e = sex (3 replacing 'ex'), s3x = sex
    /\bs3[ex]\b/i, /\bs[e3]x\b/i,
    // Violence / harm
    /\bkill\b/i, /\bmurder\b/i, /\bsuicide\b/i, /\bself.harm\b/i,
    /\babuse\b/i, /\brape\b/i, /\bweapon\b/i, /\bbomb\b/i,
    /\bterror\b/i, /\bterrorist\b/i, /\bexplosive\b/i,
    // Drugs
    /\bdrug\b/i, /\bnarcotic\b/i, /\bcocaine\b/i, /\bheroin\b/i, /\bweed\b/i,
    /\bmarijuana\b/i, /\bcannabis\b/i, /\bmeth\b/i,
    // Hacking
    /\bhack\b/i, /\bmalware\b/i, /\bvirus\b/i, /\bransomware\b/i,
    // Hindi/Gujarati inappropriate (common terms)
    /\bchut\b/i, /\blauda\b/i, /\bbhosdi\b/i, /\bmadarchod\b/i,
    /\bbenchod\b/i, /\bsaala\b/i, /\bgandu\b/i, /\brandi\b/i,
    /\bchudai\b/i, /\bsex\s+karo\b/i,
];
// Off-topic keywords — logged as 'blocked_offtopic'
const OFF_TOPIC_PATTERNS = [
    /\bweather\b/i, /\btemperature\b/i, /\bforecast\b/i, /\brain\b/i, /\bsunny\b/i,
    /\bnews\b/i, /\bpolitics\b/i, /\bsports\b/i, /\bcricket\b/i, /\bfootball\b/i,
    /\bstock\b/i, /\bshare price\b/i, /\bcrypto\b/i, /\bbitcoin\b/i,
    /\brecipe\b/i, /\bcook\b/i, /\bfilm\b/i, /\bmovie\b/i, /\bsong\b/i,
    /\bjoke\b/i, /\bfunny\b/i, /\blaugh\b/i,
    /\bwho is\b/i, /\bwhat is the capital\b/i, /\bhistory of\b/i,
];
function isInappropriate(text) {
    // Check raw text
    if (INAPPROPRIATE_PATTERNS.some(p => p.test(text)))
        return true;
    // Check with spaces/dots/dashes removed (catches "s.e.x", "s-e-x", "s e x")
    const stripped = text.replace(/[\s.\-_*]+/g, '');
    if (INAPPROPRIATE_PATTERNS.some(p => p.test(stripped)))
        return true;
    // Leet-speak normalization: 3→e, 0→o, 1→i, @→a, $→s, 4→a, 5→s
    const leet = text
        .toLowerCase()
        .replace(/3/g, 'e')
        .replace(/0/g, 'o')
        .replace(/1/g, 'i')
        .replace(/@/g, 'a')
        .replace(/\$/g, 's')
        .replace(/4/g, 'a')
        .replace(/5/g, 's')
        .replace(/7/g, 't')
        .replace(/\|/g, 'i')
        .replace(/[\s.\-_*]+/g, '');
    if (INAPPROPRIATE_PATTERNS.some(p => p.test(leet)))
        return true;
    return false;
}
function isOffTopic(text) {
    return OFF_TOPIC_PATTERNS.some(p => p.test(text));
}
const INAPPROPRIATE_RESPONSE = `⚠️ This type of content is not supported on Oakit.

Oakit is a school platform for teachers, parents, and students. Requests for inappropriate content are not allowed.

🚨 This request has been flagged and your school's Principal and Admin have been notified immediately.

Please only ask questions related to:
• Classroom teaching and activities
• Curriculum and lesson plans
• Student attendance and progress
• School-related topics`;
const OFF_TOPIC_RESPONSE = `I can only help with school-related questions 🌳

I'm here to assist with:
• Today's lesson plan and activities
• Curriculum progress and coverage
• Student attendance and behaviour
• Teaching tips for specific topics
• Homework and class notes

For anything outside school topics, please use a general search engine. 🔒`;
const PARENT_OFF_TOPIC_RESPONSE = `I can only answer questions about your child's school activities 🌳

I can help with:
• What your child studied today
• Attendance and punctuality
• Homework and teacher notes
• Curriculum progress
• Topics covered this term

For other questions, please use a general search engine. 🔒`;
function fallbackTeacherResponse() {
    return {
        response: `Oakie is temporarily busy right now. Please try again in 1-2 minutes.\n\n` +
            `In the meantime, you can still use your plan and mark activities as completed.`,
        chunk_ids: [],
        covered_chunk_ids: [],
        activity_ids: [],
    };
}
function fallbackParentResponse() {
    return {
        response: `Oakie is temporarily busy right now. Please try again in 1-2 minutes.\n\n` +
            `You can still check attendance, homework, and notes on this page.`,
    };
}
function getAiErrorMessage(err) {
    if (!axios_1.default.isAxiosError(err))
        return 'AI service unavailable';
    const detail = err.response?.data?.detail;
    return detail || err.message || 'AI service unavailable';
}
/** Detect and neutralize prompt injection attempts */
function detectPromptInjection(text) {
    const t = text.toLowerCase().trim();
    // Direct instruction override patterns
    const injectionPatterns = [
        { pattern: /ignore\s+(previous|above|all|prior|earlier|my|the)\s+(instructions?|rules?|context|prompt|system|constraints?)/i, reason: 'instruction override' },
        { pattern: /forget\s+(everything|all|previous|above|prior|earlier|instructions?|rules?|context)/i, reason: 'context reset' },
        { pattern: /disregard\s+(previous|above|all|prior|earlier|instructions?|rules?|context)/i, reason: 'instruction override' },
        { pattern: /you\s+are\s+now\s+(a\s+)?(different|new|another|unrestricted|free|jailbroken)/i, reason: 'role override' },
        { pattern: /act\s+as\s+(if\s+you\s+are\s+)?(a\s+)?(different|new|another|unrestricted|free|evil|dan|jailbroken)/i, reason: 'role override' },
        { pattern: /pretend\s+(you\s+are|to\s+be)\s+(a\s+)?(different|new|another|unrestricted|free|evil)/i, reason: 'role override' },
        { pattern: /\[system\]\s*:/i, reason: 'system prompt injection' },
        { pattern: /\[inst\]\s*:/i, reason: 'instruction injection' },
        { pattern: /<\s*system\s*>/i, reason: 'system tag injection' },
        { pattern: /new\s+instructions?\s*:/i, reason: 'instruction injection' },
        { pattern: /override\s+(previous|all|prior|earlier|the)\s+(instructions?|rules?|context|prompt)/i, reason: 'instruction override' },
        { pattern: /jailbreak/i, reason: 'jailbreak attempt' },
        { pattern: /dan\s+mode/i, reason: 'DAN jailbreak' },
        { pattern: /developer\s+mode/i, reason: 'developer mode jailbreak' },
        { pattern: /do\s+anything\s+now/i, reason: 'DAN jailbreak' },
        { pattern: /bypass\s+(your\s+)?(safety|filter|restriction|rule|guideline)/i, reason: 'filter bypass' },
        { pattern: /without\s+(any\s+)?(restriction|filter|safety|rule|guideline)/i, reason: 'filter bypass' },
        // Encoding tricks
        { pattern: /base64|rot13|hex\s+decode|unicode\s+escape/i, reason: 'encoding obfuscation' },
        // Indirect injection via "my homework/note says"
        { pattern: /(homework|note|message|text)\s+(says?|is|reads?)\s*[:\-]?\s*['""]?\s*(ignore|forget|you are|act as|pretend)/i, reason: 'indirect injection' },
    ];
    for (const { pattern, reason } of injectionPatterns) {
        if (pattern.test(text)) {
            return { isInjection: true, reason };
        }
    }
    // Check for suspiciously long inputs that might be trying to overwhelm the context
    if (text.length > 500) {
        // Check if the last 200 chars contain injection patterns
        const tail = text.slice(-200).toLowerCase();
        if (/ignore|forget|you are now|act as|jailbreak|bypass/.test(tail)) {
            return { isInjection: true, reason: 'tail injection' };
        }
    }
    // Check with whitespace collapsed (catches "i g n o r e  p r e v i o u s")
    const collapsed = text.replace(/\s+/g, ' ').toLowerCase();
    if (/ignore previous|forget instructions|you are now|act as a|jailbreak/.test(collapsed)) {
        return { isInjection: true, reason: 'spaced injection' };
    }
    return { isInjection: false, reason: '' };
}
const INJECTION_RESPONSE = `⚠️ This type of request is not supported on Oakit.

Oakit is a school platform and cannot be redirected or reprogrammed through chat messages. Attempts to override system instructions are not allowed.

🚨 This request has been flagged and your school's Principal and Admin have been notified immediately.

Please ask a genuine school-related question — about lessons, attendance, homework, or curriculum. 🔒`;
async function logAiQuery(opts) {
    try {
        const result = await db_1.pool.query(`INSERT INTO audit_logs (school_id, actor_id, actor_role, action, entity_type, metadata)
       VALUES ($1, $2, $3, 'ai_query', 'ai_query', $4) RETURNING id`, [opts.schoolId, opts.actorId, opts.actorRole,
            JSON.stringify({ query: opts.query.slice(0, 500), outcome: opts.outcome })]);
        return result.rows[0]?.id ?? null;
    }
    catch {
        return null;
    }
}
/** Create a safety alert and notify admins/principals via in-app alert */
async function createSafetyAlert(opts) {
    try {
        // Resolve actor name
        let actorName = 'Unknown';
        if (opts.actorRole === 'parent') {
            const r = await db_1.pool.query('SELECT name, mobile FROM parent_users WHERE id = $1', [opts.actorId]);
            actorName = r.rows[0]?.name || r.rows[0]?.mobile || 'Parent';
        }
        else {
            const r = await db_1.pool.query('SELECT name, mobile FROM users WHERE id = $1', [opts.actorId]);
            actorName = r.rows[0]?.name || r.rows[0]?.mobile || 'Staff';
        }
        await db_1.pool.query(`INSERT INTO safety_alerts (school_id, actor_id, actor_name, actor_role, query_text, audit_log_id)
       VALUES ($1, $2, $3, $4, $5, $6)`, [opts.schoolId, opts.actorId, actorName, opts.actorRole, opts.query.slice(0, 500), opts.auditLogId]);
    }
    catch (e) {
        console.error('[safety alert]', e);
    }
}
// Questions that are always allowed for teachers — no limit applied
const ALWAYS_ALLOWED = [
    'completed', 'finished', 'done', 'covered', 'taught', 'did all', 'except',
    "couldn't do", "could not", "didn't do", "skipped", "not done", "i did", "we did", "i covered",
    'yesterday', 'what did i', 'what did we', 'what was covered',
    'progress', 'on track', 'lagging', 'behind', 'pending topics', 'am i on track',
    'what is my plan', 'what\'s my plan', 'plan for today', 'plan for tomorrow', 'my plan',
    'crying', 'upset', 'misbehav', 'not listening', 'disruptive', 'shy', 'quiet',
    'finish early', 'fast finisher', 'reward', 'sticker', 'parent', 'discipline',
    'scold', 'shout', 'tired', 'energy', 'transition', 'bathroom', 'toilet',
];
function isAlwaysAllowed(text) {
    const t = text.toLowerCase();
    return ALWAYS_ALLOWED.some(w => t.includes(w));
}
// POST /api/v1/ai/query
router.post('/query', async (req, res) => {
    try {
        const { user_id, school_id, role } = req.user;
        const { text, history } = req.body;
        if (!text)
            return res.status(400).json({ error: 'text is required' });
        const today = await (0, today_1.getToday)(school_id);
        // Strip "Ask Oakie:" / "Hey Oakie" prefix before sending to AI
        const cleanText = text.replace(/^(ask\s+oakie[:\s]+|hey\s+o[ak]aie[,:\s]+|o[ak]aie[,:\s]+)/i, '').trim() || text;
        // 1. Detect prompt injection — highest priority check
        const injection = detectPromptInjection(cleanText);
        if (injection.isInjection) {
            const auditId = await logAiQuery({ schoolId: school_id, actorId: user_id, actorRole: role, query: cleanText, outcome: 'blocked_inappropriate' });
            await createSafetyAlert({ schoolId: school_id, actorId: user_id, actorRole: role, query: cleanText, auditLogId: auditId });
            return res.json({ response: INJECTION_RESPONSE, chunk_ids: [], covered_chunk_ids: [], activity_ids: [] });
        }
        // 2. Block inappropriate content
        if (isInappropriate(cleanText)) {
            const auditId = await logAiQuery({ schoolId: school_id, actorId: user_id, actorRole: role, query: cleanText, outcome: 'blocked_inappropriate' });
            await createSafetyAlert({ schoolId: school_id, actorId: user_id, actorRole: role, query: cleanText, auditLogId: auditId });
            return res.json({ response: INAPPROPRIATE_RESPONSE, chunk_ids: [], covered_chunk_ids: [], activity_ids: [] });
        }
        // 3. Block off-topic queries
        if (isOffTopic(cleanText)) {
            await logAiQuery({ schoolId: school_id, actorId: user_id, actorRole: role, query: cleanText, outcome: 'blocked_offtopic' });
            return res.json({ response: OFF_TOPIC_RESPONSE, chunk_ids: [], covered_chunk_ids: [], activity_ids: [] });
        }
        // ── Question limit (teachers only, activity questions only) ──────────
        if (role === 'teacher' && !isAlwaysAllowed(cleanText)) {
            const countKey = `ai:qlimit:${user_id}:${today}`;
            const current = parseInt(await redis_1.redis.get(countKey) || '0');
            if (current >= MAX_ACTIVITY_QUESTIONS) {
                await logAiQuery({ schoolId: school_id, actorId: user_id, actorRole: role, query: cleanText, outcome: 'blocked_limit' });
                return res.json({
                    response: (`You've asked ${MAX_ACTIVITY_QUESTIONS} questions today — great engagement! 🎯\n\n` +
                        `Before asking more, please mark your activities as completed using the checkboxes below your plan.\n\n` +
                        `Once you've logged today's completion, your question limit resets. 💚`),
                    question_limit_reached: true,
                    chunk_ids: [],
                    covered_chunk_ids: [],
                    activity_ids: [],
                });
            }
            // Increment counter (expires at midnight — 24h TTL is fine)
            await redis_1.redis.setEx(countKey, 86400, String(current + 1));
            // Nudge after NUDGE_AT questions
            if (current + 1 === NUDGE_AT) {
                // Let the question through but we'll append a nudge in the response
                const cacheKey = `ai:${user_id}:${crypto_1.default.createHash('md5').update(cleanText + today).digest('hex')}`;
                const cached = await redis_1.redis.get(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    parsed.response += `\n\n---\n💬 You've asked ${NUDGE_AT} questions today. When you're ready, mark your activities as completed using the checkboxes below.`;
                    return res.json(parsed);
                }
                try {
                    const aiResp = await axios_1.default.post(`${AI()}/internal/query`, {
                        teacher_id: user_id, school_id, text: cleanText, query_date: today, role,
                    }, { timeout: AI_TIMEOUT_MS });
                    const data = aiResp.data;
                    data.response += `\n\n---\n💬 You've asked ${NUDGE_AT} questions today. When you're ready, mark your activities as completed using the checkboxes below.`;
                    await redis_1.redis.setEx(cacheKey, 10, JSON.stringify(data));
                    return res.json(data);
                }
                catch (err) {
                    const requestId = crypto_1.default.randomBytes(6).toString('hex');
                    console.error(`[ai.query][${requestId}] upstream error`, {
                        user_id,
                        school_id,
                        role,
                        endpoint: `${AI()}/internal/query`,
                        message: getAiErrorMessage(err),
                    });
                    return res.json(fallbackTeacherResponse());
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────────
        // Log allowed query
        await logAiQuery({ schoolId: school_id, actorId: user_id, actorRole: role, query: cleanText, outcome: 'allowed' });
        const cacheKey = `ai:${user_id}:${crypto_1.default.createHash('md5').update(cleanText + today).digest('hex')}`;
        const cached = await redis_1.redis.get(cacheKey);
        if (cached)
            return res.json(JSON.parse(cached));
        try {
            const aiResp = await axios_1.default.post(`${AI()}/internal/query`, {
                teacher_id: user_id,
                school_id,
                text: cleanText,
                query_date: today,
                role,
                history: Array.isArray(history) ? history.slice(-3) : [],
                ...(role === 'principal' && req.body.context ? { context: req.body.context } : {}),
            }, { timeout: AI_TIMEOUT_MS });
            await redis_1.redis.setEx(cacheKey, 10, JSON.stringify(aiResp.data));
            return res.json(aiResp.data);
        }
        catch (err) {
            const requestId = crypto_1.default.randomBytes(6).toString('hex');
            console.error(`[ai.query][${requestId}] upstream error`, {
                user_id,
                school_id,
                role,
                endpoint: `${AI()}/internal/query`,
                message: getAiErrorMessage(err),
            });
            return res.json(fallbackTeacherResponse());
        }
    }
    catch (err) {
        const requestId = crypto_1.default.randomBytes(6).toString('hex');
        console.error(`[ai.query][${requestId}] route error`, {
            message: getAiErrorMessage(err),
        });
        return res.json(fallbackTeacherResponse());
    }
});
// POST /api/v1/ai/reset-limit — called when teacher marks completion
router.post('/reset-limit', async (req, res) => {
    try {
        const { user_id, school_id } = req.user;
        const today = await (0, today_1.getToday)(school_id);
        await redis_1.redis.del(`ai:qlimit:${user_id}:${today}`);
        return res.json({ message: 'Question limit reset' });
    }
    catch {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/ai/parent-query — Oakie for parents, scoped to their child's data
router.post('/parent-query', async (req, res) => {
    try {
        const { user_id, school_id, role } = req.user;
        if (role !== 'parent')
            return res.status(403).json({ error: 'Forbidden' });
        const { text, student_id } = req.body;
        if (!text)
            return res.status(400).json({ error: 'text is required' });
        if (text.length > 300)
            return res.status(400).json({ error: 'Question too long (max 300 characters)' });
        const { pool } = await Promise.resolve().then(() => __importStar(require('../lib/db')));
        // Verify parent owns this student
        if (student_id) {
            const link = await pool.query(`SELECT 1 FROM parent_student_links psl JOIN students s ON s.id = psl.student_id
         WHERE psl.parent_id = $1 AND psl.student_id = $2 AND s.school_id = $3`, [user_id, student_id, school_id]);
            if (link.rows.length === 0)
                return res.status(403).json({ error: 'Not authorized for this student' });
        }
        const today = await (0, today_1.getToday)(school_id);
        // Build context about the child for the AI
        let context = '';
        if (student_id) {
            // Student info
            const studentRow = await pool.query(`SELECT s.name, c.name as class_name, sec.label as section_label, sec.id as section_id
         FROM students s JOIN classes c ON c.id = s.class_id JOIN sections sec ON sec.id = s.section_id
         WHERE s.id = $1`, [student_id]);
            if (studentRow.rows.length > 0) {
                const st = studentRow.rows[0];
                context += `Child: ${st.name}, Class: ${st.class_name} ${st.section_label}\n`;
                // Today's topics
                const compRow = await pool.query(`SELECT covered_chunk_ids FROM daily_completions WHERE section_id = $1 AND completion_date = $2 LIMIT 1`, [st.section_id, today]);
                if (compRow.rows.length > 0 && compRow.rows[0].covered_chunk_ids?.length > 0) {
                    const chunks = await pool.query('SELECT topic_label FROM curriculum_chunks WHERE id = ANY($1::uuid[]) ORDER BY chunk_index', [compRow.rows[0].covered_chunk_ids]);
                    context += `Topics covered today: ${chunks.rows.map((r) => r.topic_label).join(', ')}\n`;
                }
                // Attendance this month
                const attRow = await pool.query(`SELECT COUNT(*) FILTER (WHERE status='present') as present,
                  COUNT(*) FILTER (WHERE status='absent') as absent
           FROM attendance_records WHERE student_id = $1 AND attend_date >= date_trunc('month', $2::date)`, [student_id, today]);
                if (attRow.rows.length > 0) {
                    context += `Attendance this month: ${attRow.rows[0].present} present, ${attRow.rows[0].absent} absent\n`;
                }
                // Recent homework
                const hwRow = await pool.query(`SELECT formatted_text FROM teacher_homework WHERE section_id = $1 ORDER BY homework_date DESC LIMIT 1`, [st.section_id]).catch(() => ({ rows: [] }));
                if (hwRow.rows.length > 0) {
                    context += `Latest homework: ${hwRow.rows[0].formatted_text?.slice(0, 200)}\n`;
                }
            }
        }
        const cleanText = text.trim();
        // Block off-topic queries for parents too
        if (isOffTopic(cleanText)) {
            return res.json({ response: PARENT_OFF_TOPIC_RESPONSE });
        }
        const cacheKey = `ai:parent:${user_id}:${student_id || 'all'}:${crypto_1.default.createHash('md5').update(cleanText + today).digest('hex')}`;
        const cached = await redis_1.redis.get(cacheKey);
        if (cached)
            return res.json(JSON.parse(cached));
        // Get the student's section_id to pass as teacher context
        // The AI service uses teacher_id to find section — for parents we pass the section's class teacher instead
        let section_teacher_id = user_id; // fallback
        if (student_id) {
            const teacherRow = await pool.query(`SELECT COALESCE(sec.class_teacher_id, ts.teacher_id) as teacher_id
         FROM students s
         JOIN sections sec ON sec.id = s.section_id
         LEFT JOIN teacher_sections ts ON ts.section_id = s.section_id
         WHERE s.id = $1
         LIMIT 1`, [student_id]);
            if (teacherRow.rows.length > 0 && teacherRow.rows[0].teacher_id) {
                section_teacher_id = teacherRow.rows[0].teacher_id;
            }
        }
        try {
            const aiResp = await axios_1.default.post(`${AI()}/internal/query`, {
                teacher_id: section_teacher_id,
                school_id,
                text: cleanText,
                query_date: today,
                role: 'parent',
                context,
            }, { timeout: AI_TIMEOUT_MS });
            await redis_1.redis.setEx(cacheKey, 30, JSON.stringify(aiResp.data));
            return res.json(aiResp.data);
        }
        catch (err) {
            const requestId = crypto_1.default.randomBytes(6).toString('hex');
            console.error(`[ai.parent-query][${requestId}] upstream error`, {
                user_id,
                school_id,
                endpoint: `${AI()}/internal/query`,
                message: getAiErrorMessage(err),
            });
            return res.json(fallbackParentResponse());
        }
    }
    catch (err) {
        const requestId = crypto_1.default.randomBytes(6).toString('hex');
        console.error(`[ai.parent-query][${requestId}] route error`, {
            message: getAiErrorMessage(err),
        });
        return res.json(fallbackParentResponse());
    }
});
exports.default = router;

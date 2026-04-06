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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/admin/users"));
const classes_1 = __importDefault(require("./routes/admin/classes"));
const classTeacher_1 = __importDefault(require("./routes/admin/classTeacher"));
const curriculum_1 = __importDefault(require("./routes/admin/curriculum"));
const calendar_1 = __importDefault(require("./routes/admin/calendar"));
const students_1 = __importDefault(require("./routes/admin/students"));
const supplementary_1 = __importDefault(require("./routes/admin/supplementary"));
const settings_1 = __importDefault(require("./routes/admin/settings"));
const setup_1 = __importDefault(require("./routes/admin/setup"));
const reports_1 = __importDefault(require("./routes/admin/reports"));
const announcements_1 = __importStar(require("./routes/admin/announcements"));
const dashboard_1 = __importDefault(require("./routes/admin/dashboard"));
const audit_1 = __importDefault(require("./routes/admin/audit"));
const timeMachine_1 = __importDefault(require("./routes/admin/timeMachine"));
const plans_1 = __importDefault(require("./routes/teacher/plans"));
const coverage_1 = __importDefault(require("./routes/teacher/coverage"));
const attendance_1 = __importDefault(require("./routes/teacher/attendance"));
const completion_1 = __importDefault(require("./routes/teacher/completion"));
const export_1 = __importDefault(require("./routes/teacher/export"));
const context_1 = __importDefault(require("./routes/teacher/context"));
const sections_1 = __importDefault(require("./routes/teacher/sections"));
const notes_1 = __importDefault(require("./routes/teacher/notes"));
const streaks_1 = __importDefault(require("./routes/teacher/streaks"));
const observations_1 = __importDefault(require("./routes/teacher/observations"));
const milestones_1 = __importDefault(require("./routes/teacher/milestones"));
const messages_1 = __importDefault(require("./routes/teacher/messages"));
const resources_1 = __importDefault(require("./routes/teacher/resources"));
const suggestions_1 = __importDefault(require("./routes/teacher/suggestions"));
const dashboard_2 = __importDefault(require("./routes/principal/dashboard"));
const attendance_2 = __importDefault(require("./routes/principal/attendance"));
const teachers_1 = __importDefault(require("./routes/principal/teachers"));
const coverage_2 = __importDefault(require("./routes/principal/coverage"));
const plans_2 = __importDefault(require("./routes/principal/plans"));
const flags_1 = __importDefault(require("./routes/principal/flags"));
const context_2 = __importDefault(require("./routes/principal/context"));
const observations_2 = __importDefault(require("./routes/principal/observations"));
const engagement_1 = __importDefault(require("./routes/principal/engagement"));
const schools_1 = __importDefault(require("./routes/super-admin/schools"));
const stats_1 = __importDefault(require("./routes/super-admin/stats"));
const impersonate_1 = __importDefault(require("./routes/super-admin/impersonate"));
const ai_1 = __importDefault(require("./routes/ai"));
const parent_1 = __importDefault(require("./routes/parent"));
const feed_1 = __importDefault(require("./routes/parent/feed"));
const attendance_3 = __importDefault(require("./routes/parent/attendance"));
const notifications_1 = __importDefault(require("./routes/parent/notifications"));
const progress_1 = __importDefault(require("./routes/parent/progress"));
const messages_2 = __importDefault(require("./routes/parent/messages"));
const observations_3 = __importDefault(require("./routes/parent/observations"));
const rateLimit_1 = require("./middleware/rateLimit");
const storage_1 = require("./lib/storage");
const db_1 = require("./lib/db");
const redis_1 = require("./lib/redis");
dotenv_1.default.config();
(0, redis_1.connectRedis)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
// Respect client IP when running behind reverse proxies (Railway/Nginx/etc).
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // Next.js needs inline scripts
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000'],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
        },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
const defaultAllowedOrigins = [
    'http://localhost:3000',
    'https://oakit.silveroakjuniors.in',
];
const envOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]));
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow non-browser clients and same-origin requests without Origin header.
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin))
            return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '1mb' })); // OWASP: limit request body size
app.use(express_1.default.urlencoded({ extended: false, limit: '1mb' }));
app.use(rateLimit_1.apiRateLimit);
// OWASP: Remove server fingerprinting
app.disable('x-powered-by');
// OWASP: Security headers not covered by helmet
app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});
// Serve uploaded student photos
const UPLOAD_DIR = path_1.default.resolve(process.env.UPLOAD_DIR || './uploads');
app.use('/uploads', express_1.default.static(UPLOAD_DIR));
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'oakit-api-gateway' });
});
app.get('/health/ai', async (_req, res) => {
    const startedAt = Date.now();
    const candidates = [`${AI_SERVICE_URL}/health`, `${AI_SERVICE_URL}/internal/health`];
    for (const url of candidates) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            const probe = await fetch(url, { method: 'GET', signal: controller.signal });
            clearTimeout(timeout);
            if (probe.ok) {
                return res.json({
                    status: 'ok',
                    ai: 'up',
                    endpoint: url,
                    response_ms: Date.now() - startedAt,
                });
            }
        }
        catch {
            // Try next health path candidate.
        }
    }
    return res.status(503).json({
        status: 'degraded',
        ai: 'down',
        endpoint: AI_SERVICE_URL,
        response_ms: Date.now() - startedAt,
    });
});
// Auth
app.use('/api/v1/auth', rateLimit_1.authRateLimit, auth_1.default);
// Admin (each router applies jwtVerify + forceResetGuard internally)
app.use('/api/v1/admin/users', users_1.default);
app.use('/api/v1/admin/classes', classes_1.default);
app.use('/api/v1/admin/classes', classTeacher_1.default);
app.use('/api/v1/admin/curriculum', curriculum_1.default);
app.use('/api/v1/admin/calendar', calendar_1.default);
app.use('/api/v1/admin/students', students_1.default);
app.use('/api/v1/admin/supplementary', supplementary_1.default);
app.use('/api/v1/admin/settings', settings_1.default);
app.use('/api/v1/admin/setup', setup_1.default);
app.use('/api/v1/admin/reports', reports_1.default);
app.use('/api/v1/admin/announcements', announcements_1.default);
app.use('/api/v1/admin/dashboard', dashboard_1.default);
app.use('/api/v1/admin/audit', audit_1.default);
app.use('/api/v1/admin/time-machine', timeMachine_1.default);
// Teacher
app.use('/api/v1/teacher/plan', plans_1.default);
app.use('/api/v1/teacher/coverage', coverage_1.default);
app.use('/api/v1/teacher/attendance', attendance_1.default);
app.use('/api/v1/teacher/completion', completion_1.default);
app.use('/api/v1/teacher/export', export_1.default);
app.use('/api/v1/teacher/context', context_1.default);
app.use('/api/v1/teacher/sections', sections_1.default);
app.use('/api/v1/teacher/notes', notes_1.default);
app.use('/api/v1/teacher/streaks', streaks_1.default);
app.use('/api/v1/teacher/observations', observations_1.default);
app.use('/api/v1/teacher/milestones', milestones_1.default);
app.use('/api/v1/teacher/messages', messages_1.default);
app.use('/api/v1/teacher/resources', resources_1.default);
app.use('/api/v1/teacher/suggestions', suggestions_1.default);
app.use('/api/v1/teacher/announcements', announcements_1.teacherAnnouncementsRouter);
// Principal
app.use('/api/v1/principal', dashboard_2.default);
app.use('/api/v1/principal/attendance', attendance_2.default);
app.use('/api/v1/principal/teachers', teachers_1.default);
app.use('/api/v1/principal/coverage', coverage_2.default);
app.use('/api/v1/principal/plans', plans_2.default);
app.use('/api/v1/principal/flags', flags_1.default);
app.use('/api/v1/principal/context', context_2.default);
app.use('/api/v1/principal/observations', observations_2.default);
app.use('/api/v1/principal/teachers/engagement', engagement_1.default);
// Super Admin
app.use('/api/v1/super-admin/schools', schools_1.default);
app.use('/api/v1/super-admin/stats', stats_1.default);
app.use('/api/v1/super-admin/impersonate', impersonate_1.default);
// AI
app.use('/api/v1/ai', ai_1.default);
// Parent
app.use('/api/v1/parent/feed', feed_1.default);
app.use('/api/v1/parent/attendance', attendance_3.default);
app.use('/api/v1/parent/notifications', notifications_1.default);
app.use('/api/v1/parent/progress', progress_1.default);
app.use('/api/v1/parent/messages', messages_2.default);
app.use('/api/v1/parent/announcements', announcements_1.parentAnnouncementsRouter);
app.use('/api/v1/parent/observations', observations_3.default);
app.use('/api/v1/parent', parent_1.default);
app.listen(PORT, () => {
    console.log(`Oakit API Gateway running on port ${PORT}`);
    // Scheduled cleanup: run every hour, clean expired files for all schools
    setInterval(async () => {
        try {
            const schools = await db_1.pool.query('SELECT id FROM schools WHERE status != $1', ['inactive']);
            for (const school of schools.rows) {
                await (0, storage_1.cleanupExpiredFiles)(school.id);
            }
        }
        catch (e) {
            console.error('[cleanup scheduler]', e);
        }
    }, 60 * 60 * 1000); // every hour
});
exports.default = app;

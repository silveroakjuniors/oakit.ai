"use strict";
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
const timeMachine_1 = __importDefault(require("./routes/admin/timeMachine"));
const plans_1 = __importDefault(require("./routes/teacher/plans"));
const coverage_1 = __importDefault(require("./routes/teacher/coverage"));
const attendance_1 = __importDefault(require("./routes/teacher/attendance"));
const completion_1 = __importDefault(require("./routes/teacher/completion"));
const export_1 = __importDefault(require("./routes/teacher/export"));
const context_1 = __importDefault(require("./routes/teacher/context"));
const sections_1 = __importDefault(require("./routes/teacher/sections"));
const dashboard_1 = __importDefault(require("./routes/principal/dashboard"));
const attendance_2 = __importDefault(require("./routes/principal/attendance"));
const teachers_1 = __importDefault(require("./routes/principal/teachers"));
const coverage_2 = __importDefault(require("./routes/principal/coverage"));
const plans_2 = __importDefault(require("./routes/principal/plans"));
const flags_1 = __importDefault(require("./routes/principal/flags"));
const schools_1 = __importDefault(require("./routes/super-admin/schools"));
const stats_1 = __importDefault(require("./routes/super-admin/stats"));
const impersonate_1 = __importDefault(require("./routes/super-admin/impersonate"));
const ai_1 = __importDefault(require("./routes/ai"));
const parent_1 = __importDefault(require("./routes/parent"));
const feed_1 = __importDefault(require("./routes/parent/feed"));
const attendance_3 = __importDefault(require("./routes/parent/attendance"));
const notifications_1 = __importDefault(require("./routes/parent/notifications"));
const progress_1 = __importDefault(require("./routes/parent/progress"));
const rateLimit_1 = require("./middleware/rateLimit");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express_1.default.json());
app.use(rateLimit_1.apiRateLimit);
// Serve uploaded student photos
const UPLOAD_DIR = path_1.default.resolve(process.env.UPLOAD_DIR || './uploads');
app.use('/uploads', express_1.default.static(UPLOAD_DIR));
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'oakit-api-gateway' });
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
app.use('/api/v1/admin/time-machine', timeMachine_1.default);
// Teacher
app.use('/api/v1/teacher/plan', plans_1.default);
app.use('/api/v1/teacher/coverage', coverage_1.default);
app.use('/api/v1/teacher/attendance', attendance_1.default);
app.use('/api/v1/teacher/completion', completion_1.default);
app.use('/api/v1/teacher/export', export_1.default);
app.use('/api/v1/teacher/context', context_1.default);
app.use('/api/v1/teacher/sections', sections_1.default);
// Principal
app.use('/api/v1/principal', dashboard_1.default);
app.use('/api/v1/principal/attendance', attendance_2.default);
app.use('/api/v1/principal/teachers', teachers_1.default);
app.use('/api/v1/principal/coverage', coverage_2.default);
app.use('/api/v1/principal/plans', plans_2.default);
app.use('/api/v1/principal/flags', flags_1.default);
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
app.use('/api/v1/parent', parent_1.default);
app.listen(PORT, () => {
    console.log(`Oakit API Gateway running on port ${PORT}`);
});
exports.default = app;

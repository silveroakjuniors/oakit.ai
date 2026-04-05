import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import authRouter from './routes/auth';
import adminUsersRouter from './routes/admin/users';
import adminClassesRouter from './routes/admin/classes';
import adminClassTeacherRouter from './routes/admin/classTeacher';
import adminCurriculumRouter from './routes/admin/curriculum';
import adminCalendarRouter from './routes/admin/calendar';
import adminStudentsRouter from './routes/admin/students';
import adminSupplementaryRouter from './routes/admin/supplementary';
import adminSettingsRouter from './routes/admin/settings';
import adminSetupRouter from './routes/admin/setup';
import adminReportsRouter from './routes/admin/reports';
import adminAnnouncementsRouter, { teacherAnnouncementsRouter, parentAnnouncementsRouter } from './routes/admin/announcements';
import adminDashboardRouter from './routes/admin/dashboard';
import adminAuditRouter from './routes/admin/audit';
import timeMachineRouter from './routes/admin/timeMachine';
import teacherPlansRouter from './routes/teacher/plans';
import teacherCoverageRouter from './routes/teacher/coverage';
import teacherAttendanceRouter from './routes/teacher/attendance';
import teacherCompletionRouter from './routes/teacher/completion';
import teacherExportRouter from './routes/teacher/export';
import teacherContextRouter from './routes/teacher/context';
import teacherSectionsRouter from './routes/teacher/sections';
import teacherNotesRouter from './routes/teacher/notes';
import teacherStreaksRouter from './routes/teacher/streaks';
import teacherObservationsRouter from './routes/teacher/observations';
import teacherMilestonesRouter from './routes/teacher/milestones';
import teacherMessagesRouter from './routes/teacher/messages';
import teacherResourcesRouter from './routes/teacher/resources';
import teacherSuggestionsRouter from './routes/teacher/suggestions';
import principalDashboardRouter from './routes/principal/dashboard';
import principalAttendanceRouter from './routes/principal/attendance';
import principalTeachersRouter from './routes/principal/teachers';
import principalCoverageRouter from './routes/principal/coverage';
import principalPlansRouter from './routes/principal/plans';
import principalFlagsRouter from './routes/principal/flags';
import principalContextRouter from './routes/principal/context';
import principalObservationsRouter from './routes/principal/observations';
import principalEngagementRouter from './routes/principal/engagement';
import superAdminSchoolsRouter from './routes/super-admin/schools';
import superAdminStatsRouter from './routes/super-admin/stats';
import superAdminImpersonateRouter from './routes/super-admin/impersonate';
import aiRouter from './routes/ai';
import parentRouter from './routes/parent';
import parentFeedRouter from './routes/parent/feed';
import parentAttendanceRouter from './routes/parent/attendance';
import parentNotificationsRouter from './routes/parent/notifications';
import parentProgressRouter from './routes/parent/progress';
import parentMessagesRouter from './routes/parent/messages';
import parentObservationsRouter from './routes/parent/observations';
import { apiRateLimit, authRateLimit } from './middleware/rateLimit';

import { cleanupExpiredFiles } from './lib/storage';
import { pool } from './lib/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Next.js needs inline scripts
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
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '1mb' })); // OWASP: limit request body size
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(apiRateLimit);

// OWASP: Remove server fingerprinting
app.disable('x-powered-by');

// OWASP: Security headers not covered by helmet
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Serve uploaded student photos
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'oakit-api-gateway' });
});

// Auth
app.use('/api/v1/auth', authRateLimit, authRouter);

// Admin (each router applies jwtVerify + forceResetGuard internally)
app.use('/api/v1/admin/users', adminUsersRouter);
app.use('/api/v1/admin/classes', adminClassesRouter);
app.use('/api/v1/admin/classes', adminClassTeacherRouter);
app.use('/api/v1/admin/curriculum', adminCurriculumRouter);
app.use('/api/v1/admin/calendar', adminCalendarRouter);
app.use('/api/v1/admin/students', adminStudentsRouter);
app.use('/api/v1/admin/supplementary', adminSupplementaryRouter);
app.use('/api/v1/admin/settings', adminSettingsRouter);
app.use('/api/v1/admin/setup', adminSetupRouter);
app.use('/api/v1/admin/reports', adminReportsRouter);
app.use('/api/v1/admin/announcements', adminAnnouncementsRouter);
app.use('/api/v1/admin/dashboard', adminDashboardRouter);
app.use('/api/v1/admin/audit', adminAuditRouter);
app.use('/api/v1/admin/time-machine', timeMachineRouter);

// Teacher
app.use('/api/v1/teacher/plan', teacherPlansRouter);
app.use('/api/v1/teacher/coverage', teacherCoverageRouter);
app.use('/api/v1/teacher/attendance', teacherAttendanceRouter);
app.use('/api/v1/teacher/completion', teacherCompletionRouter);
app.use('/api/v1/teacher/export', teacherExportRouter);
app.use('/api/v1/teacher/context', teacherContextRouter);
app.use('/api/v1/teacher/sections', teacherSectionsRouter);
app.use('/api/v1/teacher/notes', teacherNotesRouter);
app.use('/api/v1/teacher/streaks', teacherStreaksRouter);
app.use('/api/v1/teacher/observations', teacherObservationsRouter);
app.use('/api/v1/teacher/milestones', teacherMilestonesRouter);
app.use('/api/v1/teacher/messages', teacherMessagesRouter);
app.use('/api/v1/teacher/resources', teacherResourcesRouter);
app.use('/api/v1/teacher/suggestions', teacherSuggestionsRouter);
app.use('/api/v1/teacher/announcements', teacherAnnouncementsRouter);

// Principal
app.use('/api/v1/principal', principalDashboardRouter);
app.use('/api/v1/principal/attendance', principalAttendanceRouter);
app.use('/api/v1/principal/teachers', principalTeachersRouter);
app.use('/api/v1/principal/coverage', principalCoverageRouter);
app.use('/api/v1/principal/plans', principalPlansRouter);
app.use('/api/v1/principal/flags', principalFlagsRouter);
app.use('/api/v1/principal/context', principalContextRouter);
app.use('/api/v1/principal/observations', principalObservationsRouter);
app.use('/api/v1/principal/teachers/engagement', principalEngagementRouter);

// Super Admin
app.use('/api/v1/super-admin/schools', superAdminSchoolsRouter);
app.use('/api/v1/super-admin/stats', superAdminStatsRouter);
app.use('/api/v1/super-admin/impersonate', superAdminImpersonateRouter);

// AI
app.use('/api/v1/ai', aiRouter);

// Parent
app.use('/api/v1/parent/feed', parentFeedRouter);
app.use('/api/v1/parent/attendance', parentAttendanceRouter);
app.use('/api/v1/parent/notifications', parentNotificationsRouter);
app.use('/api/v1/parent/progress', parentProgressRouter);
app.use('/api/v1/parent/messages', parentMessagesRouter);
app.use('/api/v1/parent/announcements', parentAnnouncementsRouter);
app.use('/api/v1/parent/observations', parentObservationsRouter);
app.use('/api/v1/parent', parentRouter);

app.listen(PORT, () => {
  console.log(`Oakit API Gateway running on port ${PORT}`);

  // Scheduled cleanup: run every hour, clean expired files for all schools
  setInterval(async () => {
    try {
      const schools = await pool.query('SELECT id FROM schools WHERE status != $1', ['inactive']);
      for (const school of schools.rows) {
        await cleanupExpiredFiles(school.id);
      }
    } catch (e) {
      console.error('[cleanup scheduler]', e);
    }
  }, 60 * 60 * 1000); // every hour
});

export default app;

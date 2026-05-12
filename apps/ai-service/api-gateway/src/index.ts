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
import adminHomeworkRouter from './routes/admin/homework';
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
import teacherHomeworkRouter from './routes/teacher/homework';
import teacherSupplementaryRouter from './routes/teacher/supplementary';
import teacherObservationsRouter from './routes/teacher/observations';
import teacherMilestonesRouter from './routes/teacher/milestones';
import childJourneyRouter from './routes/teacher/childJourney';
import teacherMessagesRouter from './routes/teacher/messages';
import teacherResourcesRouter from './routes/teacher/resources';
import teacherSuggestionsRouter from './routes/teacher/suggestions';
import teacherVideosRouter from './routes/teacher/videos';
import teacherHrRouter from './routes/teacher/hr';
import principalDashboardRouter from './routes/principal/dashboard';
import principalAttendanceRouter from './routes/principal/attendance';
import principalTeachersRouter from './routes/principal/teachers';
import principalCoverageRouter from './routes/principal/coverage';
import principalPlansRouter from './routes/principal/plans';
import principalFlagsRouter from './routes/principal/flags';
import principalContextRouter from './routes/principal/context';
import principalObservationsRouter from './routes/principal/observations';
import principalEngagementRouter from './routes/principal/engagement';
import principalHrRouter from './routes/principal/hr';
import superAdminSchoolsRouter from './routes/super-admin/schools';
import superAdminStatsRouter from './routes/super-admin/stats';
import superAdminImpersonateRouter from './routes/super-admin/impersonate';
import superAdminBillingRouter from './routes/super-admin/billing';
import superAdminFranchisesRouter from './routes/super-admin/franchises';
import adminAiUsageRouter from './routes/admin/aiUsage';
import franchiseDashboardRouter from './routes/franchise/dashboard';
import franchiseCurriculumRouter from './routes/franchise/curriculum';
import franchiseSchoolsRouter from './routes/franchise/schools';
import aiRouter from './routes/ai';
import parentRouter from './routes/parent';
import parentFeedRouter from './routes/parent/feed';
import parentAttendanceRouter from './routes/parent/attendance';
import parentNotificationsRouter from './routes/parent/notifications';
import parentProgressRouter from './routes/parent/progress';
import parentMessagesRouter from './routes/parent/messages';
import parentObservationsRouter from './routes/parent/observations';
import parentHomeworkRouter from './routes/parent/homework';
import parentMilestonesRouter from './routes/parent/milestones';
import parentEmergencyContactsRouter from './routes/parent/emergencyContacts';
import parentSettingsRouter from './routes/parent/settings';
import parentCalendarRouter from './routes/parent/calendar';
import parentStudentAnalyticsRouter from './routes/parent/studentAnalytics';
import parentClassComparisonRouter from './routes/parent/classComparison';
import adminStudentPortalRouter from './routes/admin/studentPortal';
import adminQuizzesRouter from './routes/admin/quizzes';
import adminSmartAlertsRouter from './routes/admin/smartAlerts';
import textbookPlannerRouter from './routes/admin/textbookPlanner';
import adminEnquiriesRouter from './routes/admin/enquiries';
import teacherStudentCredentialsRouter from './routes/teacher/studentCredentials';
import teacherQuizRouter from './routes/teacher/quiz';
import teacherReportCardRouter from './routes/teacher/reportCard';
import studentFeedRouter from './routes/student/feed';
import studentQuizRouter from './routes/student/quiz';
import feedRouter from './routes/feed';
import publicEnquiriesRouter from './routes/public/enquiries';
import { apiRateLimit, authRateLimit } from './middleware/rateLimit';
import { piiGuard } from './middleware/piiGuard';
import { chunkGuard } from './middleware/chunkGuard';
import { financialModuleGuard } from './middleware/financialModuleGuard';

// Financial module routes
import financialSettingsRouter from './routes/financial/settings';
import financialFeeStructuresRouter from './routes/financial/feeStructures';
import financialEnquiriesRouter from './routes/financial/enquiries';
import financialPaymentsRouter from './routes/financial/payments';
import financialWebhooksRouter from './routes/financial/webhooks';
import financialConcessionsRouter from './routes/financial/concessions';
import financialReconciliationRouter from './routes/financial/reconciliation';
import financialExpensesRouter from './routes/financial/expenses';
import financialSalaryPinRouter from './routes/financial/salary/pin';
import financialSalaryConfigRouter from './routes/financial/salary/config';
import financialSalaryRecordsRouter from './routes/financial/salary/records';
import financialUsageRecordsRouter from './routes/financial/usageRecords';
import financialReportsRouter from './routes/financial/reports';
import financialInsightsRouter from './routes/financial/insights';
import parentFeesRouter from './routes/parent/fees';

import sharedTodayContextRouter from './routes/shared/todayContext';
import staffHrRouter from './routes/staff/hr';
import { cleanupExpiredFiles } from './lib/storage';
import { pool } from './lib/db';
import { connectRedis } from './lib/redis';

dotenv.config();
connectRedis();

// ── OWASP A02: Enforce strong JWT secret at startup ──────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
if (JWT_SECRET === 'change_me' || JWT_SECRET.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[SECURITY] FATAL: JWT_SECRET is weak or default. Set a strong secret (32+ chars) in production.');
    process.exit(1);
  } else {
    console.warn('[SECURITY] WARNING: JWT_SECRET is weak. Set a strong secret before deploying to production.');
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 3001;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Respect client IP when running behind reverse proxies (Railway/Nginx/etc).
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Next.js needs inline scripts
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000', 'https://*.supabase.co'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  frameguard: { action: 'deny' },
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

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients and same-origin requests without Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' })); // OWASP: limit request body size
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(apiRateLimit);

// PII guard — blocks franchise_admin from accessing individual PII endpoints
app.use(piiGuard);

// Chunk guard — blocks school users from modifying franchise-owned curriculum
app.use(chunkGuard);

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
    } catch {
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

// Public routes — no authentication required
app.use('/api/v1/public/enquiries', publicEnquiriesRouter);

// Shared (any authenticated role)
app.use('/api/v1/shared/today-context', sharedTodayContextRouter);

// Staff HR (leave, offer letters, payslips)
app.use('/api/v1/staff/hr', staffHrRouter);

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
app.use('/api/v1/admin/homework', adminHomeworkRouter);
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
app.use('/api/v1/teacher/homework', teacherHomeworkRouter);
app.use('/api/v1/teacher/supplementary', teacherSupplementaryRouter);
app.use('/api/v1/teacher/streaks', teacherStreaksRouter);
app.use('/api/v1/teacher/observations', teacherObservationsRouter);
app.use('/api/v1/teacher/milestones', teacherMilestonesRouter);
app.use('/api/v1/teacher/child-journey', childJourneyRouter);
app.use('/api/v1/parent/child-journey', childJourneyRouter);
app.use('/api/v1/teacher/messages', teacherMessagesRouter);
app.use('/api/v1/teacher/resources', teacherResourcesRouter);
app.use('/api/v1/teacher/suggestions', teacherSuggestionsRouter);
app.use('/api/v1/teacher/videos', teacherVideosRouter);
app.use('/api/v1/teacher/hr', teacherHrRouter);
app.use('/api/v1/teacher/announcements', teacherAnnouncementsRouter);

// Principal
app.use('/api/v1/principal', principalDashboardRouter);
app.use('/api/v1/principal/sections', principalDashboardRouter);
app.use('/api/v1/principal/birthdays', principalDashboardRouter);
app.use('/api/v1/principal/attendance', principalAttendanceRouter);
app.use('/api/v1/principal/teachers', principalTeachersRouter);
app.use('/api/v1/principal/coverage', principalCoverageRouter);
app.use('/api/v1/principal/plans', principalPlansRouter);
app.use('/api/v1/principal/flags', principalFlagsRouter);
app.use('/api/v1/principal/context', principalContextRouter);
app.use('/api/v1/principal/observations', principalObservationsRouter);
app.use('/api/v1/principal/teachers/engagement', principalEngagementRouter);
app.use('/api/v1/principal/hr', principalHrRouter);

// Super Admin
app.use('/api/v1/super-admin/schools', superAdminSchoolsRouter);
app.use('/api/v1/super-admin/stats', superAdminStatsRouter);
app.use('/api/v1/super-admin/impersonate', superAdminImpersonateRouter);
app.use('/api/v1/super-admin/billing', superAdminBillingRouter);
app.use('/api/v1/super-admin/franchises', superAdminFranchisesRouter);

// Admin AI usage (admin + principal)
app.use('/api/v1/admin/ai-usage', adminAiUsageRouter);

// Franchise admin dashboard
app.use('/api/v1/franchise', franchiseDashboardRouter);
app.use('/api/v1/franchise', franchiseCurriculumRouter);
app.use('/api/v1/franchise/schools', franchiseSchoolsRouter);

// School franchise privacy status (Req 7.3) — accessible to admin + principal
app.get('/api/v1/schools/:school_id/franchise-privacy-status', async (req, res) => {
  try {
    const { school_id } = req.params;
    const membership = await (await import('./lib/db')).pool.query(
      `SELECT fm.franchise_id, f.name AS franchise_name
       FROM franchise_memberships fm
       JOIN franchises f ON f.id = fm.franchise_id
       WHERE fm.school_id = $1`,
      [school_id]
    );
    const isMember = membership.rows.length > 0;
    return res.json({
      is_franchise_member: isMember,
      franchise_name: isMember ? membership.rows[0].franchise_name : null,
      privacy_notice_text: isMember
        ? 'No personal information (students, teachers, parents) is shared with your franchise owner. This data is proprietary to your school. If you need to enable data sharing, please contact the system admin. A consent agreement must be signed before any data is shared outside your school.'
        : null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

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
app.use('/api/v1/parent/homework', parentHomeworkRouter);
app.use('/api/v1/parent/milestones', parentMilestonesRouter);
app.use('/api/v1/parent/emergency-contacts', parentEmergencyContactsRouter);
app.use('/api/v1/parent/settings', parentSettingsRouter);
app.use('/api/v1/parent/student-analytics', parentStudentAnalyticsRouter);
app.use('/api/v1/parent/calendar', parentCalendarRouter);
app.use('/api/v1/parent/class-comparison', parentClassComparisonRouter);

// Admin — Student Portal
app.use('/api/v1/admin/student-portal', adminStudentPortalRouter);
app.use('/api/v1/admin/textbook-planner', textbookPlannerRouter);
app.use('/api/v1/admin/quizzes', adminQuizzesRouter);
app.use('/api/v1/admin/smart-alerts', adminSmartAlertsRouter);
app.use('/api/v1/admin/enquiries', adminEnquiriesRouter);

// Teacher — Student Credentials, Quiz & Report Card
app.use('/api/v1/teacher/students/credentials', teacherStudentCredentialsRouter);
app.use('/api/v1/teacher/quiz', teacherQuizRouter);
app.use('/api/v1/teacher/report-card', teacherReportCardRouter);

// Student Portal
app.use('/api/v1/student', studentFeedRouter);
app.use('/api/v1/student/quiz', studentQuizRouter);
app.use('/api/v1/parent', parentRouter);

// Class Memory Feed (teacher, parent, admin, principal)
app.use('/api/v1/feed', feedRouter);

// ── Financial Module ──────────────────────────────────────────────────────────
// Settings & permissions (no financialModuleGuard — needed to enable/disable the module)
app.use('/api/v1/financial', financialSettingsRouter);

// All other financial routes are guarded by financialModuleGuard
app.use('/api/v1/financial/fee-structures', financialModuleGuard, financialFeeStructuresRouter);
app.use('/api/v1/financial/enquiries',      financialModuleGuard, financialEnquiriesRouter);
app.use('/api/v1/financial/payments',       financialModuleGuard, financialPaymentsRouter);
app.use('/api/v1/financial/webhooks',       financialWebhooksRouter); // webhooks bypass guard (external callbacks)
app.use('/api/v1/financial/concessions',    financialModuleGuard, financialConcessionsRouter);
app.use('/api/v1/financial/reconciliation', financialModuleGuard, financialReconciliationRouter);
app.use('/api/v1/financial/expenses',       financialModuleGuard, financialExpensesRouter);
app.use('/api/v1/financial/salary/pin',     financialModuleGuard, financialSalaryPinRouter);
app.use('/api/v1/financial/salary',         financialModuleGuard, financialSalaryConfigRouter);
app.use('/api/v1/financial/salary',         financialModuleGuard, financialSalaryRecordsRouter);
app.use('/api/v1/financial/usage-records',  financialModuleGuard, financialUsageRecordsRouter);
app.use('/api/v1/financial/reports',        financialModuleGuard, financialReportsRouter);
app.use('/api/v1/financial',                financialModuleGuard, financialInsightsRouter);

// Parent fees (guarded by financialModuleGuard)
app.use('/api/v1/parent/fees', financialModuleGuard, parentFeesRouter);

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

  // Feed retention job: run daily, delete expired feed posts + storage
  setInterval(async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supaUrl = process.env.SUPABASE_URL;
      const supaKey = process.env.SUPABASE_SERVICE_KEY;
      const supabase = supaUrl && supaKey && supaKey !== 'your_service_role_key_here'
        ? createClient(supaUrl, supaKey) : null;
      const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'oakit-uploads';

      const expired = await pool.query(
        `SELECT fp.id, fpi.storage_path FROM feed_posts fp
         JOIN feed_post_images fpi ON fpi.post_id = fp.id
         WHERE fp.expires_at < now()`
      );
      if (expired.rows.length > 0) {
        const paths = expired.rows.map((r: any) => r.storage_path).filter((p: string) => p && !p.startsWith('/'));
        if (supabase && paths.length > 0) {
          await supabase.storage.from(BUCKET).remove(paths);
        }
        await pool.query(`DELETE FROM feed_posts WHERE expires_at < now()`);
        console.log(`[feed-retention] deleted ${expired.rows.length} expired post images`);
      }
    } catch (e) {
      console.error('[feed-retention scheduler]', e);
    }
  }, 24 * 60 * 60 * 1000); // every 24 hours

  // Scheduled token refresh: refresh calendar tokens that are expired or expiring soon
  setInterval(async () => {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) return; // not configured

      const rows = await pool.query(
        `SELECT parent_id, provider, refresh_token FROM parent_calendar_tokens
         WHERE refresh_token IS NOT NULL
         AND (expires_at IS NULL OR expires_at < now() + interval '10 minutes')`
      );

      for (const r of rows.rows) {
        try {
          const params = new URLSearchParams();
          params.append('client_id', clientId);
          params.append('client_secret', clientSecret);
          params.append('refresh_token', r.refresh_token);
          params.append('grant_type', 'refresh_token');

          const resp = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: params });
          if (!resp.ok) {
            console.error('[token-refresh] failed for', r.parent_id, await resp.text());
            continue;
          }
          const data: any = await resp.json();
          const expiresAt = data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000) : null;
          await pool.query(
            `UPDATE parent_calendar_tokens SET access_token = $1, expires_at = $2, status = 'authorized', updated_at = now() WHERE parent_id = $3 AND provider = $4`,
            [data.access_token || null, expiresAt, r.parent_id, r.provider]
          );
        } catch (e) {
          console.error('[token-refresh] error for', r.parent_id, e);
        }
      }
    } catch (e) {
      console.error('[token-refresh scheduler]', e);
    }
  }, 15 * 60 * 1000); // every 15 minutes
});

export default app;

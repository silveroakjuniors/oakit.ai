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
import timeMachineRouter from './routes/admin/timeMachine';
import teacherPlansRouter from './routes/teacher/plans';
import teacherCoverageRouter from './routes/teacher/coverage';
import teacherAttendanceRouter from './routes/teacher/attendance';
import teacherCompletionRouter from './routes/teacher/completion';
import teacherExportRouter from './routes/teacher/export';
import teacherContextRouter from './routes/teacher/context';
import teacherSectionsRouter from './routes/teacher/sections';
import principalDashboardRouter from './routes/principal/dashboard';
import aiRouter from './routes/ai';
import parentRouter from './routes/parent';
import { apiRateLimit, authRateLimit } from './middleware/rateLimit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(apiRateLimit);

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
app.use('/api/v1/admin/time-machine', timeMachineRouter);

// Teacher
app.use('/api/v1/teacher/plan', teacherPlansRouter);
app.use('/api/v1/teacher/coverage', teacherCoverageRouter);
app.use('/api/v1/teacher/attendance', teacherAttendanceRouter);
app.use('/api/v1/teacher/completion', teacherCompletionRouter);
app.use('/api/v1/teacher/export', teacherExportRouter);
app.use('/api/v1/teacher/context', teacherContextRouter);
app.use('/api/v1/teacher/sections', teacherSectionsRouter);

// Principal
app.use('/api/v1/principal', principalDashboardRouter);

// AI
app.use('/api/v1/ai', aiRouter);

// Parent
app.use('/api/v1/parent', parentRouter);

app.listen(PORT, () => {
  console.log(`Oakit API Gateway running on port ${PORT}`);
});

export default app;

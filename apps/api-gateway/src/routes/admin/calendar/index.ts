/**
 * calendar/index.ts — Assembles all calendar sub-routers
 *
 * Replaces the monolithic admin/calendar.ts (1,499 lines) with:
 *   setup.ts      — school calendar config (GET /, POST /, summary, academic-years)
 *   plans.ts      — day plan generation, viewing, editing, deletion
 *   holidays.ts   — holiday CRUD + spreadsheet import + PDF export
 *   specialDays.ts — special days CRUD
 *   helpers.ts    — shared carryForwardDate + computeMonthsInRange
 */

import { Router } from 'express';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../../middleware/auth';
import { setupRouter } from './setup';
import { plansRouter } from './plans';
import { holidaysRouter } from './holidays';
import { specialDaysRouter } from './specialDays';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('admin'));

// Mount sub-routers
router.use('/', setupRouter);
router.use('/', plansRouter);
router.use('/:year/holidays', holidaysRouter);
router.use('/:year/special-days', specialDaysRouter);

export default router;

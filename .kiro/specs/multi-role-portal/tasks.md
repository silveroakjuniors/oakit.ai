# Implementation Plan: Multi-Role Portal

## Overview

Implement three role improvements across DB migrations, API gateway routes, middleware changes, and frontend pages. Work proceeds in layers: DB first, then backend (middleware → super-admin → principal → parent), then frontend.

## Tasks

- [x] 1. Database migrations
  - [x] 1.1 Write migration 018 — schools table additions and impersonation_logs
    - Add `status`, `plan_type`, `billing_status`, `plan_updated_at` columns to `schools`
    - `ALTER TABLE users ALTER COLUMN school_id DROP NOT NULL`
    - Create `impersonation_logs` table with index on `super_admin_id`
    - File: `oakit/db/migrations/018_multi_role_portal_schools.sql`
    - _Requirements: 1.1, 2.4, 4.5, 6.1, 7.1, 8.3_

  - [x] 1.2 Write migration 019 — sections flagging columns
    - Add `flagged`, `flag_note`, `flagged_at`, `flagged_by` columns to `sections`
    - Create partial index `idx_sections_flagged` on `(school_id, flagged) WHERE flagged = true`
    - File: `oakit/db/migrations/019_sections_flagging.sql`
    - _Requirements: 13.1, 13.2_

  - [x] 1.3 Write migration 020 — parent_notifications table
    - Create `parent_notifications` table with unique index on `(parent_id, completion_id)`
    - Create partial index on `(parent_id, is_read) WHERE is_read = false`
    - File: `oakit/db/migrations/020_parent_notifications.sql`
    - _Requirements: 17.1, 17.2, 17.5_

- [x] 2. Middleware and JWT updates
  - [x] 2.1 Update `JwtPayload` in `src/lib/jwt.ts`
    - Change `school_id` to `string | null` to support super_admin (null school)
    - Add optional `jti?: string` field for impersonation token revocation
    - Update `signToken` to accept the updated payload type
    - _Requirements: 8.1, 4.1_

  - [x] 2.2 Update `schoolScope` in `src/middleware/auth.ts`
    - Add early return `if (req.user.role === 'super_admin') return next()` before school_id check
    - _Requirements: 8.4_

  - [x] 2.3 Update `jwtVerify` in `src/middleware/auth.ts` to check Redis impersonation denylist
    - After verifying token, if payload has `jti`, check `impersonation:revoked` Redis set
    - Return 401 if jti is in the denylist
    - _Requirements: 4.3_

  - [x] 2.4 Write unit tests for updated middleware
    - Test: super_admin token bypasses schoolScope school_id check
    - Test: revoked jti returns 401 from jwtVerify
    - Test: non-super_admin token still enforced by schoolScope
    - _Requirements: 8.2, 8.4, 4.3_

- [x] 3. Auth route updates
  - [x] 3.1 Update `POST /api/v1/auth/login` in `src/routes/auth.ts`
    - After finding school by subdomain, check `schools.status = 'active'`; return 401 if inactive
    - Add super_admin login path: when `school_code` is absent or a special platform code, look up user in `users` where `school_id IS NULL AND role = 'super_admin'`; issue token with `school_id: null`
    - _Requirements: 6.1, 8.1, 8.3_

  - [x] 3.2 Write unit tests for auth login changes
    - Test: login for user of inactive school returns 401
    - Test: super_admin login without school_code succeeds and token has school_id=null
    - _Requirements: 6.1, 8.1_

- [x] 4. Super Admin — schools route
  - [x] 4.1 Create `src/routes/super-admin/schools.ts`
    - `GET /` — list all schools; support `?status=` filter and `?search=` case-insensitive name match; sort by `created_at DESC`
    - `POST /` — create school: validate required fields (name, plan_type), check duplicate name (409), set status='active', generate subdomain from name; return created school
    - `GET /:id` — get school details including `plan_type` and `billing_status`; 404 if not found
    - `PATCH /:id` — update `status`, `plan_type`, `billing_status`; set `plan_updated_at` when plan_type changes
    - `POST /:id/activate` — set status='active'; 409 if already active
    - `POST /:id/deactivate` — set status='inactive'; 409 if already inactive
    - `GET /:id/users` — list users for a school
    - `POST /:id/users` — create user scoped to school_id
    - Guards: `jwtVerify, roleGuard('super_admin')`
    - _Requirements: 1.1–1.5, 2.1–2.5, 3.3–3.5, 6.1–6.5, 7.1–7.3, 8.2_

  - [x] 4.2 Write property test for school list filter and search (Property 2, Property 3)
    - **Property 2: School list filter correctness**
    - **Property 3: School name search is case-insensitive partial match**
    - **Validates: Requirements 1.4, 1.5**
    - Use fast-check; tag: `// Feature: multi-role-portal, Property 2` and `Property 3`

  - [x] 4.3 Write property test for school creation round-trip (Property 4, Property 5)
    - **Property 4: School creation round-trip with invariants**
    - **Property 5: School creation rejects invalid payloads**
    - **Validates: Requirements 2.1, 2.2, 2.4, 2.5**
    - Use fast-check; tag: `// Feature: multi-role-portal, Property 4` and `Property 5`

  - [x] 4.4 Write property test for platform stats invariant (Property 8)
    - **Property 8: Platform stats total/active school count invariant**
    - **Validates: Requirements 5.1, 5.3**
    - Use fast-check; tag: `// Feature: multi-role-portal, Property 8`

  - [x] 4.5 Write property test for super_admin access control (Property 11)
    - **Property 11: Super admin role access control**
    - **Validates: Requirements 8.2, 8.4**
    - Use fast-check; tag: `// Feature: multi-role-portal, Property 11`

- [x] 5. Super Admin — stats and impersonation routes
  - [x] 5.1 Create `src/routes/super-admin/stats.ts`
    - `GET /` — return `total_schools`, `active_schools`, `total_teachers`, `total_students`, `total_day_plans` computed in real time
    - Guards: `jwtVerify, roleGuard('super_admin')`
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.2 Create `src/routes/super-admin/impersonate.ts`
    - `POST /:school_id` — check school exists and is active (403 if inactive); issue scoped JWT with `role='admin'`, `school_id=target`, `jti=uuid`, 2h TTL; insert row into `impersonation_logs`; return token and expires_at
    - `POST /exit` — add token's `jti` to Redis set `impersonation:revoked` with TTL matching remaining token lifetime; update `impersonation_logs.exited_at`
    - Guards: `jwtVerify, roleGuard('super_admin')`
    - _Requirements: 4.1–4.5_

  - [x] 5.3 Write property test for impersonation token claims (Property 6, Property 7)
    - **Property 6: Impersonation token has correct claims and scope**
    - **Property 7: Impersonation events are logged**
    - **Validates: Requirements 4.1, 4.2, 4.5**
    - Use fast-check; tag: `// Feature: multi-role-portal, Property 6` and `Property 7`

- [x] 6. Register super-admin routes in `src/index.ts`
  - Import and mount `superAdminSchoolsRouter` at `/api/v1/super-admin/schools`
  - Import and mount `superAdminStatsRouter` at `/api/v1/super-admin/stats`
  - Import and mount `superAdminImpersonateRouter` at `/api/v1/super-admin/impersonate`
  - _Requirements: 8.2_

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Principal — attendance overview route
  - [x] 8.1 Create `src/routes/principal/attendance.ts`
    - `GET /overview` — for each section in the school, check if any `attendance_records` row exists for today; return `AttendanceOverviewItem[]` with `status`, `present_count`, `absent_count`, `flagged`, `flag_note`
    - Use school timezone from `school_calendar` or fall back to UTC for "today"
    - Guards: `jwtVerify, schoolScope, roleGuard('principal', 'admin')`
    - _Requirements: 9.1–9.5, 13.3_

  - [x] 8.2 Write property test for attendance overview completeness (Property 12)
    - **Property 12: Attendance overview completeness and accuracy**
    - **Validates: Requirements 9.1, 9.2, 9.3, 13.3**
    - Use fast-check; tag: `// Feature: multi-role-portal, Property 12`

- [x] 9. Principal — teacher activity and coverage routes
  - [x] 9.1 Create `src/routes/principal/teachers.ts`
    - `GET /activity` — for each teacher in the school, check `daily_completions` for today across their sections; return `TeacherActivityItem[]` with `status` ('submitted' | 'behind' | 'not_working_day'), `section_name`, `chunks_covered`
    - Exclude teachers whose only sections are inactive
    - Check school calendar to determine if today is a working day before marking 'behind'
    - Guards: `jwtVerify, schoolScope, roleGuard('principal', 'admin')`
    - _Requirements: 10.1–10.4_

  - [x] 9.2 Create `src/routes/principal/coverage.ts`
    - `GET /` — for each section, compute `coverage_pct = (distinct covered chunk_ids in daily_completions / total chunks in curriculum_chunks) × 100`; include `last_completion_date`, `has_curriculum`, `flagged`, `flag_note`
    - Return `CoverageReportItem[]`
    - Guards: `jwtVerify, schoolScope, roleGuard('principal', 'admin')`
    - _Requirements: 11.1–11.4, 13.3_

  - [x] 9.3 Write property test for teacher activity feed accuracy (Property 13)
    - **Property 13: Teacher activity feed completeness and accuracy**
    - **Validates: Requirements 10.1, 10.2, 10.3**
    - Use fast-check; tag: `// Feature: multi-role-portal, Property 13`

  - [x] 9.4 Write property test for coverage report formula (Property 14)
    - **Property 14: Coverage report completeness and formula correctness**
    - **Validates: Requirements 11.1, 11.2, 11.4**
    - Use fast-check; tag: `// Feature: multi-role-portal, Property 14`

- [x] 10. Principal — plans and flags routes
  - [x] 10.1 Create `src/routes/principal/plans.ts`
    - `GET /:section_id` — return `day_plans` record for the section on `?date=` (default today) with `topic_labels`; enforce same-school check (403 if cross-school); 404 if no plan
    - Guards: `jwtVerify, schoolScope, roleGuard('principal', 'admin')`
    - _Requirements: 12.1–12.4_

  - [x] 10.2 Create `src/routes/principal/flags.ts`
    - `POST /:section_id` — set `flagged=true`, `flagged_at=now()`, `flagged_by=user_id`, `flag_note` from body; 403 if section not in principal's school
    - `DELETE /:section_id` — clear `flagged=false`, null out `flagged_at`, `flagged_by`, `flag_note`
    - Guards: `jwtVerify, schoolScope, roleGuard('principal', 'admin')`
    - _Requirements: 13.1–13.5_

  - [x] 10.3 Write unit tests for principal plan view and flags
    - Test: cross-school plan view returns 403
    - Test: flagging section from another school returns 403
    - Test: flag/unflag round-trip sets and clears all fields
    - _Requirements: 12.4, 13.1, 13.2, 13.4_

  - [x] 10.4 Write property test for section flagging round-trip (Property 16)
    - **Property 16: Section flagging round-trip with note**
    - **Validates: Requirements 13.1, 13.2, 13.5**
    - Use fast-check; tag: `// Feature: multi-role-portal, Property 16`

- [x] 11. Principal — AI assistant context injection
  - [x] 11.1 Update `POST /api/v1/ai/query` in `src/routes/ai.ts`
    - Accept optional `context` field in request body
    - When `role === 'principal'` and `context` is provided, forward it to the AI service payload
    - Allow `principal` role through the existing `roleGuard` (already included)
    - _Requirements: 14.1–14.5_

  - [x] 11.2 Update principal frontend to assemble and send AI context
    - Before sending AI query, fetch: sections with `coverage_pct < 50%` (from coverage endpoint), sections with pending attendance (from attendance overview), flagged sections
    - Attach as `context` in the AI query body
    - Show 503 error message if AI service returns unavailable
    - _Requirements: 14.1–14.5_

- [x] 12. Register principal routes in `src/index.ts`
  - Import and mount `principalAttendanceRouter` at `/api/v1/principal/attendance`
  - Import and mount `principalTeachersRouter` at `/api/v1/principal/teachers`
  - Import and mount `principalCoverageRouter` at `/api/v1/principal/coverage`
  - Import and mount `principalPlansRouter` at `/api/v1/principal/plans`
  - Import and mount `principalFlagsRouter` at `/api/v1/principal/flags`
  - _Requirements: 9.1, 10.1, 11.1, 12.1, 13.1_

- [x] 13. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Parent — feed, attendance, and progress routes
  - [x] 14.1 Create `src/routes/parent/feed.ts`
    - `GET /` — for each linked child's section, check `daily_completions` for `?date=` (default today); if found, return type='curriculum' with `topic_labels` and `settling_day_note`; if special day exists but no completion, return type='special_day'; else return type='empty'
    - Scope to `parent_student_links` for the authenticated parent
    - Guards: `jwtVerify, forceResetGuard, schoolScope, roleGuard('parent')`
    - _Requirements: 15.1–15.4, 18.1–18.3_

  - [x] 14.2 Create `src/routes/parent/attendance.ts`
    - `GET /` — return `attendance_records` for each linked child for the 30 calendar days ending today; compute `attendance_pct = (present count / total records) × 100`; return `AttendanceHistoryResponse`
    - Guards: `jwtVerify, forceResetGuard, schoolScope, roleGuard('parent')`
    - _Requirements: 16.1–16.4_

  - [x] 14.3 Create `src/routes/parent/progress.ts`
    - `GET /` — for each linked child's section, compute `coverage_pct` using only `daily_completions` where `completion_date` falls within the current academic year from `school_calendar`; return `CurriculumProgressResponse[]`
    - When `total_chunks = 0`, return `coverage_pct=0` and `has_curriculum=false`
    - Guards: `jwtVerify, forceResetGuard, schoolScope, roleGuard('parent')`
    - _Requirements: 19.1–19.4_

  - [x] 14.4 Write property test for attendance history window and percentage (Property 19)
    - **Property 19: Attendance history window and percentage**
    - **Validates: Requirements 16.1, 16.2, 16.4**
    - Use fast-check; tag: `// Feature: multi-role-portal, Property 19`

  - [x] 14.5 Write property test for curriculum progress formula and academic year scoping (Property 22)
    - **Property 22: Curriculum progress formula and academic year scoping**
    - **Validates: Requirements 19.1, 19.3, 19.4**
    - Use fast-check; tag: `// Feature: multi-role-portal, Property 22`

  - [x] 14.6 Write property test for parent daily feed scoping (Property 18)
    - **Property 18: Parent daily feed is scoped to linked children**
    - **Validates: Requirements 15.1, 15.3, 15.4, 18.1, 18.3**
    - Use fast-check; tag: `// Feature: multi-role-portal, Property 18`

- [x] 15. Parent — notifications route
  - [x] 15.1 Create `src/routes/parent/notifications.ts`
    - `GET /` — return all unread `parent_notifications` for the authenticated parent with `section_name`, `completion_date`, `chunks_covered`
    - `POST /:id/read` — set `is_read=true` for the notification; 404 if not found or not owned by parent
    - Guards: `jwtVerify, forceResetGuard, schoolScope, roleGuard('parent')`
    - _Requirements: 17.3, 17.4_

  - [x] 15.2 Update teacher completion submission to create parent notifications
    - In the existing teacher completion route (`src/routes/teacher/completion.ts`), after inserting/updating `daily_completions`, run `INSERT INTO parent_notifications (...) SELECT ... FROM parent_student_links ... ON CONFLICT DO NOTHING`
    - This covers all parents linked to students in the section; idempotent on edit
    - _Requirements: 17.1, 17.2, 17.5_

  - [x] 15.3 Write property test for notification creation idempotency (Property 20)
    - **Property 20: Notification creation and idempotency**
    - **Validates: Requirements 17.1, 17.2, 17.5**
    - Use fast-check; tag: `// Feature: multi-role-portal, Property 20`

  - [x] 15.4 Write property test for notification read status update (Property 21)
    - **Property 21: Notification read status update**
    - **Validates: Requirements 17.3, 17.4**
    - Use fast-check; tag: `// Feature: multi-role-portal, Property 21`

- [x] 16. Register parent routes in `src/index.ts`
  - Replace the existing `app.use('/api/v1/parent', parentRouter)` with individual mounts:
    - `/api/v1/parent/feed` → `parentFeedRouter`
    - `/api/v1/parent/attendance` → `parentAttendanceRouter`
    - `/api/v1/parent/notifications` → `parentNotificationsRouter`
    - `/api/v1/parent/progress` → `parentProgressRouter`
  - Keep existing `parentRouter` mounted for `/api/v1/parent` (absences, missed-topics)
  - _Requirements: 15.1, 16.1, 17.3, 19.1_

- [x] 17. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Frontend — Super Admin pages
  - [x] 18.1 Create `/super-admin` layout and dashboard page
    - `oakit/apps/frontend/src/app/super-admin/layout.tsx` — sidebar with links to Schools, Stats
    - `oakit/apps/frontend/src/app/super-admin/page.tsx` — `SuperAdminDashboard`: show platform stats from `GET /api/v1/super-admin/stats`
    - _Requirements: 5.1_

  - [x] 18.2 Create `/super-admin/schools` school list page
    - `oakit/apps/frontend/src/app/super-admin/schools/page.tsx` — `SchoolListPage`
    - Fetch from `GET /api/v1/super-admin/schools`; support status filter and name search inputs
    - Show school name, status badge, plan_type, created_at; link to detail page
    - _Requirements: 1.1–1.5_

  - [x] 18.3 Create `/super-admin/schools/[id]` school detail page
    - `oakit/apps/frontend/src/app/super-admin/schools/[id]/page.tsx` — `SchoolDetailPage`
    - Show school details, billing_status, plan_type; buttons to activate/deactivate
    - Impersonate button: call `POST /api/v1/super-admin/impersonate/:id`, store scoped token, redirect to `/admin`; show Exit Impersonation button that calls `POST /api/v1/super-admin/impersonate/exit`
    - _Requirements: 2.1, 4.1–4.4, 6.1–6.4, 7.1–7.3_

- [x] 19. Frontend — Principal pages
  - [x] 19.1 Update `/principal` dashboard page
    - `oakit/apps/frontend/src/app/principal/page.tsx` — add navigation cards for Attendance Overview, Teacher Activity, Coverage Report, AI Assistant
    - _Requirements: 9.1, 10.1, 11.1, 14.1_

  - [x] 19.2 Create `/principal/attendance` attendance overview page
    - `oakit/apps/frontend/src/app/principal/attendance/page.tsx`
    - Fetch from `GET /api/v1/principal/attendance/overview`; show each section with submitted/pending badge, present/absent counts, flagged indicator
    - Flag/unflag button per section calling `POST/DELETE /api/v1/principal/flags/:section_id`
    - _Requirements: 9.1–9.4, 13.1–13.3_

  - [x] 19.3 Create `/principal/teachers` teacher activity page
    - `oakit/apps/frontend/src/app/principal/teachers/page.tsx`
    - Fetch from `GET /api/v1/principal/teachers/activity`; show each teacher with status badge and chunks covered
    - _Requirements: 10.1–10.3_

  - [x] 19.4 Create `/principal/coverage` coverage report page
    - `oakit/apps/frontend/src/app/principal/coverage/page.tsx`
    - Fetch from `GET /api/v1/principal/coverage`; show each section with coverage percentage bar, last completion date, flagged status
    - _Requirements: 11.1–11.4, 13.3_

- [x] 20. Frontend — Parent page updates
  - [x] 20.1 Update `/parent` page with daily feed, attendance history, notifications, and progress
    - `oakit/apps/frontend/src/app/parent/page.tsx` — replace existing stub with tabbed or sectioned layout
    - Daily feed section: fetch `GET /api/v1/parent/feed`; show topic labels or settling note or empty state
    - Attendance history section: fetch `GET /api/v1/parent/attendance`; show 30-day records and attendance percentage
    - Notifications section: fetch `GET /api/v1/parent/notifications`; show unread count badge; mark-as-read on click
    - Progress section: fetch `GET /api/v1/parent/progress`; show coverage percentage with `ProgressBar` component
    - _Requirements: 15.1–15.4, 16.1–16.4, 17.3–17.4, 18.1–18.3, 19.1–19.3_

- [x] 21. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use fast-check; each must include the tag comment referencing the design property number
- Migrations must be applied in order: 018 → 019 → 020
- The `schoolScope` bypass for super_admin is the only middleware change needed — all other guards remain unchanged
- Impersonation token revocation relies on the Redis instance already used for AI rate limiting (`src/lib/redis.ts`)
- Parent notification creation is done in the existing teacher completion route via `INSERT ... ON CONFLICT DO NOTHING` — no DB trigger needed

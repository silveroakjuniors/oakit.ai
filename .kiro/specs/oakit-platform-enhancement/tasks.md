# Implementation Plan: Oakit Platform Enhancement

## Overview

Incremental implementation across database, API gateway (TypeScript/Express), AI service (Python/FastAPI), and frontend (Next.js 14). Tasks are ordered so each phase builds on the previous: DB schema first, then API routes, then frontend, then AI service endpoints.

## Tasks

- [x] 1. Database migrations (029–035)
  - [x] 1.1 Create migration 029: teacher_streaks table
    - Columns: `id`, `teacher_id` (FK users), `school_id`, `current_streak`, `best_streak`, `last_completed_date`
    - Add unique constraint on `(teacher_id, school_id)`
    - _Requirements: 2.1, 2.5_

  - [x] 1.2 Create migration 030: observations table
    - Columns: `id`, `student_id` (FK), `teacher_id` (FK), `school_id`, `text` (varchar 500), `categories` (text[]), `share_with_parent` (bool), `created_at`
    - _Requirements: 5.1, 5.2, 5.3, 5.7_

  - [x] 1.3 Create migration 031: milestones and student_milestones tables
    - `milestones`: `id`, `school_id`, `class_level`, `domain`, `description`, `is_custom` (bool)
    - `student_milestones`: `id`, `student_id`, `milestone_id`, `achieved_at`, `teacher_id`
    - Seed predefined milestones (10+ per level: Play Group, Nursery, LKG, UKG) covering cognitive, social, motor, language domains
    - _Requirements: 6.1, 6.2, 6.6_

  - [x] 1.4 Create migration 032: messages table
    - Columns: `id`, `school_id`, `teacher_id` (FK), `parent_id` (FK), `student_id` (FK), `sender_role` (enum: teacher/parent), `body` (varchar 1000), `sent_at`, `read_at`
    - Add index on `(teacher_id, parent_id, student_id)`
    - _Requirements: 7.1, 7.3, 7.7_

  - [x] 1.5 Create migration 033: announcements table
    - Columns: `id`, `school_id`, `author_id` (FK), `title` (varchar 100), `body` (varchar 1000), `target_audience` (enum: all/teachers/parents/class), `target_class_id`, `expires_at`, `created_at`, `deleted_at`
    - _Requirements: 8.1, 8.3, 8.6, 8.7_

  - [x] 1.6 Create migration 034: resources table
    - Columns: `id`, `school_id`, `uploader_id` (FK), `title` (varchar 100), `description` (varchar 300), `subject_tag`, `class_level`, `file_path`, `file_size_bytes`, `created_at`
    - `teacher_saved_resources`: `teacher_id`, `resource_id`, `saved_at`
    - _Requirements: 10.1, 10.3_

  - [x] 1.7 Create migration 035: setup_wizard_progress table
    - Columns: `school_id` (PK), `completed_steps` (text[]), `last_step`, `completed_at`
    - _Requirements: 11.1, 11.6_

- [-] 2. Teacher streaks API and logic
  - [x] 2.1 Create `oakit/apps/api-gateway/src/routes/teacher/streaks.ts`
    - `GET /teacher/streaks/me` — return current streak, best streak, milestone badges earned
    - `POST /teacher/streaks/complete` — called when plan is marked done; upsert streak row, increment or reset based on last_completed_date vs previous school day (use existing `today.ts` helper)
    - Use Redis to cache streak value with 60s TTL
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ]* 2.2 Write unit tests for streak increment/reset logic
    - Test: completing plan on consecutive school days increments streak
    - Test: missing a school day resets streak to 0
    - Test: best_streak is never decremented
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 2.3 Wire streak completion call into existing plan completion route
    - In `oakit/apps/api-gateway/src/routes/teacher/completion.ts`, after marking plan done, call streak upsert logic
    - _Requirements: 2.2_

  - [x] 2.4 Update teacher portal home page to display streak and milestone badges
    - In `oakit/apps/frontend/src/app/teacher/page.tsx`, fetch `/teacher/streaks/me` and render current streak count, best streak, and badge label at milestones 5/10/20/30
    - Show celebration animation (CSS keyframe) when a new milestone threshold is first crossed
    - _Requirements: 2.2, 2.3, 2.6_

- [-] 3. Student observations
  - [x] 3.1 Create `oakit/apps/api-gateway/src/routes/teacher/observations.ts`
    - `POST /teacher/observations` — create observation (validate text ≤500 chars, at least text or category required)
    - `GET /teacher/observations/:studentId` — list observations for student, reverse chronological
    - `PATCH /teacher/observations/:id` — toggle share_with_parent
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7_

  - [x] 3.2 Expose observations to principal and parent
    - Add `GET /principal/observations/:studentId` in `oakit/apps/api-gateway/src/routes/principal/` — returns full observation history
    - Add `GET /parent/observations/:studentId` in `oakit/apps/api-gateway/src/routes/parent/` — returns only rows where `share_with_parent = true`
    - _Requirements: 5.5, 5.7_

  - [x] 3.3 Build observation UI in teacher portal
    - Add observation panel to student detail view (or create `oakit/apps/frontend/src/app/teacher/students/[id]/page.tsx`)
    - Form: textarea (500 char limit with counter), multi-select category chips, "Share with Parent" toggle, Save button
    - Display validation error if both text and category are empty
    - List existing observations below the form in reverse chronological order
    - _Requirements: 5.1, 5.2, 5.4, 5.6, 5.7_

  - [ ]* 3.4 Write unit tests for observation validation
    - Test: empty text + no category → validation error
    - Test: text ≤500 chars accepted, >500 rejected
    - _Requirements: 5.6_

- [-] 4. Student milestone tracking
  - [x] 4.1 Create `oakit/apps/api-gateway/src/routes/teacher/milestones.ts`
    - `GET /teacher/milestones/:studentId` — return predefined + custom milestones for student's class level with achieved status
    - `POST /teacher/milestones/:studentId/:milestoneId/achieve` — mark achieved, record date + teacher
    - `DELETE /teacher/milestones/:studentId/:milestoneId/achieve` — unmark, remove achievement record
    - Compute and return completion percentage in all responses
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [ ] 4.2 Add admin endpoint for custom milestones
    - `POST /admin/milestones` — create custom milestone for a class level (`is_custom = true`)
    - _Requirements: 6.6_

  - [x] 4.3 Build milestone checklist UI in teacher portal
    - Add milestones tab to student detail page
    - Render checklist grouped by domain; show completion percentage bar
    - Tap to toggle achieved/unachieved with optimistic UI update
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [x] 4.4 Display milestone data in parent portal
    - In `oakit/apps/frontend/src/app/parent/page.tsx` progress tab, fetch milestone completion % and list of achieved milestones
    - _Requirements: 6.4_

  - [ ]* 4.5 Write unit tests for milestone completion percentage calculation
    - Test: 0 achieved → 0%, all achieved → 100%, partial → correct rounded %
    - Test: unmark achievement recalculates correctly
    - _Requirements: 6.3, 6.5_

- [ ] 5. Checkpoint — DB and core data layer
  - Ensure all migrations 029–035 apply cleanly. Ensure all tests pass, ask the user if questions arise.

- [ ] 6. In-app teacher–parent messaging
  - [x] 6.1 Create `oakit/apps/api-gateway/src/routes/teacher/messages.ts`
    - `GET /teacher/messages` — list all threads (grouped by parent+student), sorted by most recent
    - `GET /teacher/messages/:parentId/:studentId` — full thread history
    - `POST /teacher/messages/:parentId/:studentId` — send message (validate ≤1000 chars)
    - Return error indicator payload on send failure
    - _Requirements: 7.1, 7.3, 7.5, 7.6_

  - [x] 6.2 Create `oakit/apps/api-gateway/src/routes/parent/messages.ts`
    - `GET /parent/messages` — list threads for this parent
    - `GET /parent/messages/:teacherId/:studentId` — full thread
    - `POST /parent/messages/:teacherId/:studentId/reply` — parent reply only (cannot initiate new thread — return 403 if no existing thread)
    - _Requirements: 7.2, 7.4, 7.8_

  - [x] 6.3 Build messaging UI in teacher portal
    - Create `oakit/apps/frontend/src/app/teacher/messages/page.tsx`
    - Thread list view + conversation view; show sender name, text, timestamp
    - Badge count on nav tab when unread messages exist
    - Retry button on failed sends
    - _Requirements: 7.3, 7.5, 7.6_

  - [x] 6.4 Build messaging UI in parent portal
    - Add messages tab to `oakit/apps/frontend/src/app/parent/page.tsx`
    - Show conversation thread; reply input; red badge on tab for unread
    - _Requirements: 7.2, 7.4, 7.5_

  - [ ]* 6.5 Write unit tests for messaging constraints
    - Test: parent cannot POST to initiate new thread (403)
    - Test: message body >1000 chars rejected
    - Test: thread history returned in chronological order
    - _Requirements: 7.1, 7.8_

- [ ] 7. School announcement board
  - [x] 7.1 Create `oakit/apps/api-gateway/src/routes/admin/announcements.ts`
    - `POST /admin/announcements` — create (validate title ≤100, body ≤1000, target_audience, optional expires_at)
    - `GET /admin/announcements` — list all (including expired, for admin management)
    - `PATCH /admin/announcements/:id` — edit
    - `DELETE /admin/announcements/:id` — soft delete (set deleted_at)
    - Auto-archive logic: cron or query filter — hide rows where `expires_at < now()` or `created_at < now() - 30 days` (when no expires_at)
    - _Requirements: 8.1, 8.5, 8.6, 8.7, 8.8_

  - [x] 7.2 Add announcement read endpoints for teacher and parent
    - `GET /teacher/announcements` — active announcements targeted to teachers or all or teacher's class
    - `GET /parent/announcements` — active announcements targeted to parents or all or parent's child's class
    - _Requirements: 8.2, 8.3_

  - [x] 7.3 Build announcement management UI in admin portal
    - Create `oakit/apps/frontend/src/app/admin/announcements/page.tsx`
    - Form: title, body, audience selector, optional expiry date picker
    - List of existing announcements with edit/delete actions
    - _Requirements: 8.1, 8.3, 8.8_

  - [x] 7.4 Display announcements in teacher and parent portals
    - Teacher portal home: render active announcements below today's snapshot
    - Parent portal home: render announcements below today's snapshot (req 12.6)
    - _Requirements: 8.2, 12.6_

  - [ ]* 7.5 Write unit tests for announcement targeting and expiry
    - Test: expired announcement not returned by read endpoints
    - Test: class-targeted announcement only returned for correct class
    - Test: no-expiry announcement auto-archived after 30 days
    - _Requirements: 8.3, 8.6, 8.7_

- [ ] 8. Dashboard data visualizations
  - [x] 8.1 Add coverage chart data endpoint
    - `GET /admin/dashboard/coverage` — return per-section curriculum coverage %, color band (green/amber/red), and alert flag for <40%
    - `GET /principal/dashboard/coverage` — same data, filterable by class
    - _Requirements: 1.1, 1.4, 13.3_

  - [x] 8.2 Add attendance trend endpoint
    - `GET /admin/dashboard/attendance-trend` — last 30 school days with present/absent/late counts per day
    - _Requirements: 1.2_

  - [x] 8.3 Add today's snapshot endpoint
    - `GET /admin/dashboard/today` — total students present, sections with attendance submitted, sections with plans completed; cache in Redis with 60s TTL
    - _Requirements: 1.3, 1.5_

  - [x] 8.4 Render coverage bar chart on admin and principal dashboards
    - In `oakit/apps/frontend/src/app/admin/page.tsx`, fetch coverage data and render horizontal bar chart using SVG (matching existing chart patterns)
    - Color bars green/amber/red per threshold; show red alert badge on section cards below 40%
    - In `oakit/apps/frontend/src/app/principal/page.tsx`, add class filter dropdown and same chart
    - _Requirements: 1.1, 1.4, 13.3, 13.5_

  - [x] 8.5 Render attendance trend line chart on admin dashboard
    - Fetch attendance trend data and render SVG line chart with three series (present/absent/late)
    - Show placeholder message when no data available
    - _Requirements: 1.2, 1.6_

  - [x] 8.6 Render today's snapshot and plans counter on admin dashboard
    - Display today's snapshot stats; "Plans Completed Today" counter auto-refreshes every 60s via polling
    - _Requirements: 1.3, 1.5_

  - [ ]* 8.7 Write unit tests for coverage color-band logic
    - Test: ≥75% → green, 40–74% → amber, <40% → red
    - Test: alert flag set only when coverage <40%
    - _Requirements: 1.1, 1.4_

- [ ] 9. Principal reporting and oversight enhancements
  - [x] 9.1 Add teacher engagement metrics endpoint
    - `GET /principal/teachers/engagement` — per teacher: current streak, last plan completion date, 30-day plan completion rate
    - Flag teachers with 3+ consecutive missed days (amber warning)
    - _Requirements: 13.1, 13.2_

  - [x] 9.2 Render teacher engagement table on principal dashboard
    - In `oakit/apps/frontend/src/app/principal/teachers/page.tsx`, display engagement table with streak, last completion, 30-day rate
    - Highlight amber for teachers with 3+ missed days
    - _Requirements: 13.1, 13.2_

  - [ ]* 9.3 Write unit tests for 30-day plan completion rate calculation
    - Test: rate = completed days / total school days in window × 100
    - Test: amber flag triggers at exactly 3 consecutive missed days
    - _Requirements: 13.1, 13.2_

- [ ] 10. Checkpoint — API routes and dashboards
  - Ensure all tests pass, ask the user if questions arise.

- [-] 11. AI service: activity suggestions and worksheet generator
  - [ ] 11.1 Add `/internal/suggest-activity` endpoint to AI service
    - In `oakit/apps/ai-service/`, create handler in `main.py` (or new `suggestions.py`)
    - Input: `subject`, `class_level`, `topic`, `school_id`
    - Return: array of ≥2 activity objects each with `title`, `description`, `difficulty` (Simple/Standard/Extended), `support_level` (standard/additional/advanced)
    - Query resource library for relevant saved resources and include in response
    - Respond within 5s; return fallback JSON `{"error": "unavailable"}` on LLM timeout
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 11.2 Add `/internal/generate-worksheet` endpoint to AI service
    - Input: `subject`, `topic`, `class_level`
    - Return: structured worksheet JSON with at least one of: fill-in-the-blank, matching, drawing prompt, tracing exercise
    - Include fallback message in response when no curriculum content found for topic
    - _Requirements: 4.1, 4.2, 4.6_

  - [x] 11.3 Create `oakit/apps/api-gateway/src/routes/teacher/suggestions.ts`
    - `POST /teacher/suggestions/activity` — proxy to AI service `/internal/suggest-activity`; return fallback message if AI service unavailable
    - `POST /teacher/suggestions/worksheet` — proxy to `/internal/generate-worksheet`; return structured worksheet data
    - _Requirements: 3.1, 3.6, 4.1_

  - [ ] 11.4 Build "Suggest Activity" UI in teacher daily plan
    - In the teacher daily plan page, add "Suggest Activity" button per subject row
    - On tap: call `/teacher/suggestions/activity`, display activity cards with difficulty badge
    - Show "Oakie is unavailable right now. Try again shortly." on error — no blank screen
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

  - [x] 11.5 Build worksheet generator UI
    - Create `oakit/apps/frontend/src/app/teacher/worksheet/page.tsx`
    - Subject/topic/class-level selectors → Generate button → preview panel → Download PDF button → Regenerate button
    - PDF filename format: `{class}-{subject}-{date}.pdf`
    - Show notification when topic has no curriculum content
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 11.6 Write unit tests for AI proxy fallback behavior
    - Test: AI service timeout → fallback message returned, not blank
    - Test: worksheet PDF filename matches `{class}-{subject}-{date}.pdf` pattern
    - _Requirements: 3.6, 4.5_

- [-] 12. Printable and exportable reports
  - [x] 12.1 Create `oakit/apps/api-gateway/src/routes/admin/reports.ts`
    - `GET /admin/reports/student/:studentId` — generate student term report PDF (student name, class, section, attendance %, coverage %, milestone %, shared observations); respond within 15s
    - `GET /admin/reports/section/:sectionId/batch` — generate ZIP of all student PDFs in section
    - `GET /admin/reports/school` — generate school summary PDF (total students, overall attendance %, coverage %, per-section breakdown)
    - Use school name and logo from `school_settings` table (migration 028)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.7_

  - [ ] 12.2 Add principal report endpoint
    - `GET /principal/reports/school` — same school summary PDF, scoped to principal's school
    - _Requirements: 13.4_

  - [ ] 12.3 Update existing teacher plan export to include header
    - In `oakit/apps/api-gateway/src/routes/teacher/export.ts`, add teacher name, section, and date to PDF header
    - _Requirements: 9.5_

  - [x] 12.4 Build report generation UI in admin portal
    - Add reports section to admin dashboard or create `oakit/apps/frontend/src/app/admin/reports/page.tsx`
    - Student report: select student → Generate PDF button
    - Batch report: select section → Generate ZIP button
    - School summary: single Generate button
    - _Requirements: 9.1, 9.3, 9.4_

  - [ ]* 12.5 Write unit tests for report content completeness
    - Test: student with no shared observations → placeholder line included
    - Test: PDF filename and header contain correct school name
    - _Requirements: 9.6, 9.7_

- [ ] 13. Shared teacher resource library
  - [x] 13.1 Create `oakit/apps/api-gateway/src/routes/teacher/resources.ts`
    - `GET /teacher/resources` — list all school resources, filterable by subject and class_level
    - `POST /teacher/resources` — upload resource (title, description, subject_tag, class_level, optional file); reject if file >5 MB
    - `POST /teacher/resources/:id/save` — save to personal collection
    - `DELETE /teacher/resources/:id` — delete own resource
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6, 10.8_

  - [ ] 13.2 Add admin resource delete endpoint
    - `DELETE /admin/resources/:id` — delete any resource
    - _Requirements: 10.7_

  - [x] 13.3 Build resource library UI in teacher portal
    - Create `oakit/apps/frontend/src/app/teacher/resources/page.tsx`
    - Browse/search by subject and class level; show uploader name and date
    - Upload form with file picker (PDF/image, 5 MB limit with client-side validation)
    - "Save to My Resources" button; "My Resources" tab
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6_

  - [ ]* 13.4 Write unit tests for resource upload validation
    - Test: file >5 MB → rejected with correct error message
    - Test: resource visible to other teachers in same school within query
    - _Requirements: 10.5, 10.6_

- [ ] 14. Guided school setup wizard
  - [x] 14.1 Create `oakit/apps/api-gateway/src/routes/admin/setup.ts`
    - `GET /admin/setup/progress` — return completed steps and last step
    - `POST /admin/setup/progress` — save completed step
    - `GET /admin/setup/status` — return whether setup is complete (all 5 steps done)
    - _Requirements: 11.1, 11.3, 11.6_

  - [x] 14.2 Build setup wizard frontend
    - Create `oakit/apps/frontend/src/app/admin/setup/page.tsx`
    - 5-step wizard: school profile → classes/sections → staff accounts → curriculum upload → calendar setup
    - Progress indicator showing "Step N of 5"
    - Each step saves on "Next" click before advancing
    - Skip button on each step; inline help text per field
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.7_

  - [x] 14.3 Auto-launch wizard and add setup checklist to admin dashboard
    - On admin login, check `/admin/setup/status`; if incomplete and no classes exist, redirect to `/admin/setup`
    - Add "Complete Setup" checklist widget to admin dashboard showing incomplete steps
    - Dismiss checklist when all steps complete
    - Add "Re-launch Setup" link in `oakit/apps/frontend/src/app/admin/settings/page.tsx`
    - _Requirements: 11.1, 11.4, 11.5, 11.8_

- [ ] 15. Parent portal engagement enhancements
  - [-] 15.1 Add parent dashboard data endpoints
    - `GET /parent/dashboard` — return: today's mood (shared observation for today if exists), weekly attendance strip (5 days Mon–Fri with present/late/absent/holiday status), curriculum coverage %, milestone %, recent announcements, "away summary" if parent hasn't opened app in 3+ school days
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 12.7_

  - [ ] 15.2 Enhance parent portal home page
    - In `oakit/apps/frontend/src/app/parent/page.tsx`:
      - Today's Mood indicator (from shared observation)
      - Weekly attendance strip: 5 colored dots (green/amber/red/grey)
      - Milestone celebration card at 25%/50%/75%/100% coverage thresholds
      - Milestone completion % on progress tab
      - Announcements section below snapshot
      - "You've been away" summary card when applicable
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 12.7_

  - [ ]* 15.3 Write unit tests for parent dashboard data assembly
    - Test: away summary only shown when last_seen ≥ 3 school days ago
    - Test: weekly strip correctly maps attendance records to Mon–Fri slots including holidays as grey
    - _Requirements: 12.2, 12.7_

- [x] 16. Register all new routes in API gateway index
  - In `oakit/apps/api-gateway/src/index.ts`, import and mount all new route files created in tasks 2–15
  - Verify middleware chain `jwtVerify → forceResetGuard → schoolScope → roleGuard` is applied to each new router
  - _Requirements: all_

- [ ] 17. Final checkpoint — full integration
  - Ensure all tests pass. Verify all new routes are mounted and respond correctly. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All API routes use the existing middleware chain: `jwtVerify → forceResetGuard → schoolScope → roleGuard(role)`
- Migrations are numbered 029–035 continuing from the existing 028_school_settings.sql
- Redis caching is used for streaks (task 2) and today's snapshot (task 8.3)
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases

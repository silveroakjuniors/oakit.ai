# Implementation Plan: Oakit Platform Phase 2

## Overview

Incremental implementation of Phase 2 features on top of the existing Oakit.ai monorepo. Each task builds on the previous, ending with all components wired together. Stack: Next.js 14 (frontend), Node.js + Express + TypeScript (API gateway), Python FastAPI (AI service), PostgreSQL (Supabase). No new infrastructure is introduced.

## Tasks

- [x] 1. Database migrations 007–012
  - [x] 1.1 Write migration 007 — auth changes
    - Drop `email` column; add `mobile`, `force_password_reset`, `security_question_id`, `security_answer_hash` to `users`
    - Add `UNIQUE (school_id, mobile)` constraint and index
    - Create `security_questions` table and seed ≥ 5 questions
    - Add FK from `users.security_question_id` to `security_questions.id`
    - _Requirements: 1.1, 1.6, 2.1, 2.3_

  - [x] 1.2 Write migration 008 — class teacher
    - Add `class_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL` to `sections`
    - Create partial unique index `sections_class_teacher_school_unique` on `(class_teacher_id, school_id) WHERE class_teacher_id IS NOT NULL`
    - _Requirements: 3.1, 3.2_

  - [x] 1.3 Write migration 009 — holidays table
    - Create `holidays` table with `(school_id, academic_year, holiday_date, event_name)` and unique constraint on `(school_id, academic_year, holiday_date)`
    - Add index on `(school_id, academic_year, holiday_date)`
    - Drop `holidays DATE[]` column from `school_calendar` (after data migration comment)
    - _Requirements: 6.1, 6.2, 6.9_

  - [x] 1.4 Write migration 010 — students and attendance
    - Create `students` table with `(school_id, class_id, section_id, name, father_name, parent_contact, photo_path, is_active)`
    - Create `attendance_records` table with `(school_id, section_id, student_id, teacher_id, attend_date, status)` and unique on `(section_id, student_id, attend_date)`
    - Add indexes on `(school_id, section_id)` and `(student_id, attend_date)`
    - _Requirements: 7.4, 10.1, 10.3, 10.6_

  - [x] 1.5 Write migration 011 — parent users and daily completion
    - Create `parent_users` table with mobile auth fields mirroring `users`
    - Create `parent_student_links` join table
    - Create `daily_completions` table with `(section_id, completion_date, covered_chunk_ids UUID[])` and unique on `(section_id, completion_date)`
    - Create `missed_topic_tasks` table with `(parent_id, student_id, chunk_id, absence_date, is_done)`
    - _Requirements: 11.1, 11.3, 16.1, 16.4_

  - [x] 1.6 Write migration 012 — ingestion stage tracking
    - Add `ingestion_stage TEXT DEFAULT NULL` column to `curriculum_documents`
    - _Requirements: 4.2, 4.3_

- [x] 2. Auth overhaul — API gateway
  - [x] 2.1 Rewrite `POST /api/v1/auth/login` to accept mobile number
    - Replace `email` lookup with `mobile` lookup scoped to `school_id`
    - Return `force_password_reset: true` in JWT payload and response when flag is set
    - Never reveal which field was incorrect (unified 401 message)
    - _Requirements: 1.1, 1.3, 1.7_

  - [ ]* 2.2 Write property test for mobile uniqueness per school (P1)
    - **Property 1: Mobile number is the unique login identifier per school**
    - **Validates: Requirements 1.1, 1.6**

  - [ ]* 2.3 Write property test for initial password round-trip (P2)
    - **Property 2: Initial password equals mobile number — login succeeds and returns force_password_reset: true**
    - **Validates: Requirements 1.2, 1.3**

  - [x] 2.4 Implement `POST /api/v1/auth/change-password` endpoint
    - Require authenticated JWT; validate new password ≠ mobile number; hash with bcrypt; clear `force_password_reset` flag
    - _Requirements: 1.4, 1.5, 2.8_

  - [x] 2.5 Add force-reset middleware guard
    - In `auth.ts` middleware: if JWT contains `force_password_reset: true`, reject all routes except `POST /auth/change-password` with HTTP 403 and `{ error: "Password change required", force_password_reset: true }`
    - _Requirements: 1.4_

  - [ ]* 2.6 Write property test for force-reset JWT blocking all endpoints (P3)
    - **Property 3: Force-reset JWT blocks all endpoints except change-password**
    - **Validates: Requirements 1.4**

  - [ ]* 2.7 Write property test for new password ≠ mobile (P4)
    - **Property 4: New password must differ from mobile number**
    - **Validates: Requirements 1.5**

  - [x] 2.8 Implement security question endpoints
    - `GET /api/v1/auth/security-questions` — return all rows from `security_questions`
    - `POST /api/v1/auth/setup-security-question` — store `security_question_id` and bcrypt hash of answer on authenticated user
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 2.9 Write property test for security answer one-way hash (P5)
    - **Property 5: Security question answer is stored as a one-way hash**
    - **Validates: Requirements 2.3, 2.6**

  - [x] 2.10 Implement forgot-password flow endpoints
    - `POST /api/v1/auth/forgot-password/init` — look up user by mobile + school; return their `security_question` text
    - `POST /api/v1/auth/forgot-password/verify` — compare answer hash; return short-lived reset token on match; return 401 on mismatch
    - `POST /api/v1/auth/forgot-password/reset` — validate reset token; set new password hash
    - _Requirements: 2.4, 2.5, 2.6, 2.7_

  - [ ]* 2.11 Write property test for forgot-password returning correct question (P6)
    - **Property 6: Forgot-password init returns the user's own security question**
    - **Validates: Requirements 2.5**

- [ ] 3. Checkpoint — Auth overhaul
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Login and auth UI
  - [x] 4.1 Update login page to use mobile number field
    - Replace `email` input with `mobile` (10-digit numeric) input
    - Add "Forgot Password?" link below the form
    - On login response with `force_password_reset: true`, redirect to `/auth/change-password`
    - _Requirements: 1.1, 1.3, 2.4_

  - [x] 4.2 Build `/auth/change-password` page
    - Form: new password + confirm; validate new ≠ mobile; call `POST /api/v1/auth/change-password`
    - On success, show security question setup step: dropdown of questions + answer field; call `POST /api/v1/auth/setup-security-question`
    - Block navigation away until both steps complete
    - _Requirements: 1.4, 1.5, 2.1, 2.2_

  - [x] 4.3 Build `/auth/forgot-password` page
    - Step 1: school code + mobile → call init → display security question
    - Step 2: answer field → call verify → on success show new password form
    - Step 3: call reset → redirect to login
    - _Requirements: 2.4, 2.5, 2.6, 2.7_

- [x] 5. Class teacher uniqueness — API gateway and UI
  - [x] 5.1 Implement class teacher assignment endpoints
    - `POST /api/v1/admin/classes/sections/:id/class-teacher` — check unique index; on conflict return 409 with `{ conflicting_section: { id, label } }`
    - `DELETE /api/v1/admin/classes/sections/:id/class-teacher` — set `class_teacher_id = NULL`; leave teacher account and `teacher_sections` intact
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 5.2 Write property test for class teacher uniqueness per school (P7)
    - **Property 7: A teacher already assigned as class teacher for section A cannot be assigned to any other section in the same school**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 5.3 Write property test for remove class teacher preserves account (P8)
    - **Property 8: Removing class teacher designation leaves teacher account and section assignments intact**
    - **Validates: Requirements 3.4**

  - [x] 5.4 Update Admin Classes UI to show class teacher assignment
    - Add "Assign Class Teacher" button per section in the existing classes accordion
    - Show current class teacher name with a "Remove" button
    - Display conflict error inline when assignment is rejected
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Curriculum upload progress bar
  - [x] 6.1 Update ingestion service to write `ingestion_stage` to DB
    - In `ingestion_service.py`: update `curriculum_documents.ingestion_stage` at each stage: `'extracting'` before extraction, `'chunking'` before chunking, `'embedding'` before embedding, `'done'` on success, `'failed'` on error
    - _Requirements: 4.2, 4.3_

  - [ ]* 6.2 Write property test for ingestion stage monotonic progression (P9)
    - **Property 9: ingestion_stage only transitions forward: extracting → chunking → embedding → done (or failed)**
    - **Validates: Requirements 4.2, 4.3**

  - [x] 6.3 Update `GET /api/v1/admin/curriculum/:id/status` to return `ingestion_stage`
    - Add `stage` field to response alongside existing `status` and `total_chunks`
    - _Requirements: 4.2, 4.3_

  - [x] 6.4 Build `ProgressBar` component and wire into curriculum upload UI
    - Create `src/components/ui/ProgressBar.tsx`: accepts `percent` (0–100) and `label` props; renders a styled progress bar with stage label
    - In curriculum upload page: map `ingestion_stage` → percent (`extracting`=25, `chunking`=60, `embedding`=85, `done`=100); replace plain text status with `ProgressBar`
    - On completion show chunk count; on failure show stage name and retry button
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7. Academic year dropdown
  - [x] 7.1 Implement `GET /api/v1/admin/calendar/academic-years` endpoint
    - Return exactly 10 entries starting from current calendar year, formatted as `YYYY-YY`
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 7.2 Write property test for academic year list (P10)
    - **Property 10: GET /academic-years always returns exactly 10 entries starting from the current year**
    - **Validates: Requirements 5.1, 5.3**

  - [x] 7.3 Build `AcademicYearSelect` component and replace free-text field
    - Create `src/components/ui/AcademicYearSelect.tsx`: fetches from `/api/v1/admin/calendar/academic-years` on mount; renders a `<select>` dropdown
    - Replace the free-text `academic_year` input in `admin/calendar/page.tsx` with `AcademicYearSelect`
    - _Requirements: 5.2, 5.4_

- [x] 8. Holiday management — API gateway and UI
  - [x] 8.1 Implement holiday CRUD endpoints
    - `GET /api/v1/admin/calendar/:year/holidays` — list holidays sorted by date
    - `POST /api/v1/admin/calendar/:year/holidays` — add single holiday `{ holiday_date, event_name }`
    - `DELETE /api/v1/admin/calendar/:year/holidays/:id` — delete holiday
    - _Requirements: 6.1, 6.2, 6.9_

  - [ ]* 8.2 Write property test for holiday add/delete round-trip (P11)
    - **Property 11: An added holiday appears in the list sorted by date; after deletion it no longer appears**
    - **Validates: Requirements 6.1, 6.2, 6.9**

  - [x] 8.3 Implement `POST /api/v1/admin/calendar/:year/holidays/import` endpoint
    - Accept multipart xlsx; forward to AI service `POST /internal/import-holidays`; bulk-insert valid rows; return `{ created, skipped: [{ row, reason }] }`
    - _Requirements: 6.3, 6.4, 6.5, 6.6_

  - [x] 8.4 Implement `POST /internal/import-holidays` in AI service
    - Use `openpyxl` to parse xlsx; validate `date` and `event_name` columns; parse dates; return `{ valid_rows, invalid_rows: [{ row, reason }] }`
    - _Requirements: 6.3, 6.4, 6.5_

  - [ ]* 8.5 Write property test for holiday import partial failure (P12)
    - **Property 12: Import creates holidays only for valid rows; skipped + created counts equal total non-header rows**
    - **Validates: Requirements 6.3, 6.4, 6.5, 6.6**

  - [x] 8.6 Update planner service to query `holidays` table instead of `school_calendar.holidays`
    - In `planner_service.py`: replace `holidays DATE[]` array lookup with `SELECT holiday_date FROM holidays WHERE school_id=$1 AND academic_year=$2`
    - When a new holiday is added for a date with an existing day plan, remove that plan and prepend its chunks to the next non-holiday working day
    - _Requirements: 6.7, 6.8_

  - [ ]* 8.7 Write property test for day plans never on holidays (P13)
    - **Property 13: No day_plan.plan_date is a member of the holidays set for that school**
    - **Validates: Requirements 6.7, 6.8**

  - [x] 8.8 Build holiday management UI in admin calendar page
    - Add holiday list table (date, event name, delete button) below the existing calendar form
    - Add "Add Holiday" inline form (date picker + event name input + save button)
    - Build `HolidayImportModal` component: xlsx file picker, upload button, import summary display
    - Wire `AcademicYearSelect` to filter the holiday list
    - _Requirements: 6.1, 6.2, 6.3, 6.6, 6.9_

- [ ] 9. Checkpoint — Calendar and holiday management
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Student management — import and photo upload
  - [x] 10.1 Implement `POST /internal/import-students` in AI service
    - Use `openpyxl` to parse xlsx; validate required columns (`student name`, `father name`, `section`, `class`, `parent contact number`); return `{ valid_rows, invalid_rows }` with reasons
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 10.2 Write property test for student import column validation (P14)
    - **Property 14: Any xlsx missing a required column returns an error listing missing columns without creating any records**
    - **Validates: Requirements 7.2, 7.3**

  - [x] 10.3 Implement student import API endpoints
    - `POST /api/v1/admin/students/import` — require `create_students` permission; forward xlsx to AI service; resolve class/section IDs; insert valid rows; return summary
    - `GET /api/v1/admin/students/import/template` — return a template xlsx with required column headers
    - `GET /api/v1/admin/students` — list students filterable by `class_id` / `section_id`
    - `GET /api/v1/admin/students/:id` — student detail with `photo_url`
    - _Requirements: 7.1, 7.4, 7.5, 7.6, 7.7, 9.1, 9.3_

  - [ ]* 10.4 Write property test for student import partial failure round-trip (P15)
    - **Property 15: Import creates records only for valid rows; querying a valid section returns exactly those students**
    - **Validates: Requirements 7.1, 7.4, 7.5, 7.6**

  - [x] 10.5 Implement student photo upload endpoint
    - `POST /api/v1/admin/students/:id/photo` — accept multipart JPEG/PNG ≤ 5 MB; store in `uploads/students/`; update `students.photo_path`; return `photo_url`
    - Reject files > 5 MB or non-JPEG/PNG with descriptive 400 error
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 10.6 Write property test for photo upload format/size enforcement (P16)
    - **Property 16: JPEG/PNG ≤ 5 MB succeeds and returns photo_url; files > 5 MB or wrong format are rejected**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

  - [x] 10.7 Implement `create_students` permission guard
    - Add `create_students` permission check in the import and student-creation route handlers (HTTP 403 if missing)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 10.8 Write property test for permission guard on student creation (P17)
    - **Property 17: Users without create_students permission receive HTTP 403; after granting the permission they succeed**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

  - [x] 10.9 Build `/admin/students` page
    - Student list table with class/section filter dropdowns
    - "Import Students" button opens `StudentImportModal`: xlsx upload, import summary, template download link
    - Per-student photo upload button (file picker → `POST /:id/photo`); show thumbnail when photo exists
    - _Requirements: 7.1, 7.6, 7.7, 8.1, 8.5_

- [x] 11. Attendance — API gateway and teacher UI
  - [x] 11.1 Implement attendance endpoints
    - `GET /api/v1/teacher/attendance/today` — list students in teacher's section with today's attendance status
    - `POST /api/v1/teacher/attendance/today` — upsert attendance records; check holiday warning; enforce midnight cutoff
    - `GET /api/v1/teacher/attendance/:date` — fetch attendance for a specific date
    - _Requirements: 10.1, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 11.2 Write property test for attendance uniqueness and edit window (P18)
    - **Property 18: At most one attendance record per student per date; re-submit updates existing record; post-midnight submit is rejected**
    - **Validates: Requirements 10.1, 10.3, 10.4, 10.6**

  - [ ]* 11.3 Write property test for holiday attendance confirmation (P19)
    - **Property 19: Submitting attendance on a holiday without confirm_holiday: true returns a warning, not a saved record**
    - **Validates: Requirements 10.5**

  - [x] 11.4 Build `AttendanceRow` component and `/teacher/attendance` page
    - Create `src/components/ui/AttendanceRow.tsx`: student name + present/absent toggle optimised for mobile tap targets
    - Build `/teacher/attendance/page.tsx`: list of `AttendanceRow` components; "Submit Attendance" button; holiday warning dialog; success confirmation
    - _Requirements: 10.1, 10.2, 10.3, 10.5_

- [x] 12. Daily completion submission — API gateway and teacher UI
  - [x] 12.1 Implement completion endpoints
    - `POST /api/v1/teacher/completion` — insert `daily_completions` row with `covered_chunk_ids`; update coverage status of chunks
    - `PUT /api/v1/teacher/completion/:id` — edit within 24 h of `submitted_at`; reject with 403 after window closes
    - `GET /api/v1/teacher/completion/pending` — list uncovered chunks from prior day plans sorted by `plan_date` ascending
    - _Requirements: 15.1, 15.2, 15.3, 16.1, 16.2, 16.4_

  - [ ]* 12.2 Write property test for completion uniqueness and edit window (P27)
    - **Property 27: At most one daily_completions record per section per day; second submit updates existing; edit after 24 h is rejected**
    - **Validates: Requirements 16.1, 16.2, 16.4**

  - [ ]* 12.3 Write property test for pending work sorted and clears (P26)
    - **Property 26: Pending list is sorted oldest-first; a day disappears from the list once all its chunks are covered**
    - **Validates: Requirements 15.1, 15.2, 15.3**

  - [x] 12.4 Build `PendingWorkList` component and wire into teacher page
    - Create `src/components/ui/PendingWorkList.tsx`: sorted list of prior-day chunk cards with date label and topic names
    - Add `PendingWorkList` to the left panel of `teacher/page.tsx` below today's plan
    - Replace the free-text coverage log textarea with a chunk-selection completion form that calls `POST /api/v1/teacher/completion`
    - _Requirements: 15.1, 15.2, 15.3, 16.1_

  - [ ]* 12.5 Write property test for completed topics visible to parents (P28)
    - **Property 28: Chunks in daily_completions.covered_chunk_ids appear in the parent absence view for that date**
    - **Validates: Requirements 16.3**

- [ ] 13. Checkpoint — Attendance and completion
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Teacher AI UX overhaul
  - [x] 14.1 Implement `GET /internal/greeting` in AI service
    - Return `{ greeting, thought_for_day, attendance_prompt }` based on current time bucket and teacher context
    - Time buckets: morning 05:00–11:59, afternoon 12:00–16:59, evening 17:00–04:59; early-arrival message if before school start time
    - Rotate `thought_for_day` so consecutive days differ (store last-shown index per teacher in DB or derive from date hash)
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 14.2 Write property test for greeting time bucket correctness (P22)
    - **Property 22: Greeting matches time bucket — morning/afternoon/evening boundaries are exact**
    - **Validates: Requirements 12.1, 12.4**

  - [ ]* 14.3 Write property test for thought-for-day non-repetition (P23)
    - **Property 23: Thought for the day differs on two consecutive calendar days for the same teacher**
    - **Validates: Requirements 12.3**

  - [x] 14.4 Implement attendance prompt logic in API gateway login response
    - After successful login for teacher role: check if attendance exists for today's section; set `attendance_prompt: true/false` in login response
    - _Requirements: 13.1, 13.3, 13.4_

  - [ ]* 14.5 Write property test for attendance prompt logic (P24)
    - **Property 24: attendance_prompt is true iff within school hours AND no attendance record exists for today**
    - **Validates: Requirements 13.1, 13.3, 13.4**

  - [x] 14.6 Update AI query pipeline to scope context to today's plan chunks
    - In `query_pipeline.py`: restrict chunk retrieval to `day_plans.chunk_ids` for today plus carried-forward chunks; reject out-of-scope queries with a date-hint message
    - _Requirements: 14.1, 14.2, 14.3_

  - [ ]* 14.7 Write property test for AI query scope restriction (P25)
    - **Property 25: Chunk IDs used as AI context are exactly the union of today's plan chunks and carried-forward chunks**
    - **Validates: Requirements 14.1, 14.3**

  - [x] 14.8 Update teacher page with greeting, thought for day, attendance prompt, and pending work
    - On page load call `GET /internal/greeting` (via API gateway proxy `GET /api/v1/teacher/context`); display greeting and thought for day at top of chat panel as the initial AI message
    - If `attendance_prompt: true`, show an inline prompt card with "Mark Attendance" button that navigates to `/teacher/attendance`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 13.1, 13.2, 13.3, 13.4_

- [ ] 15. PDF export — AI service and teacher UI
  - [x] 15.1 Implement `POST /internal/export-pdf` in AI service
    - Use `reportlab` to generate a PDF with teacher name, section, date/range, chunk topic labels and activity references, and a watermark on every page
    - Accept `{ teacher_id, section_id, date, days }` (days 1–7); return binary PDF
    - Return 404-equivalent error payload if no day plan exists for the range
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [ ]* 15.2 Write property test for PDF watermark and required fields (P29)
    - **Property 29: Parsing the generated PDF reveals teacher name, section, date range, all topic labels, and watermark on every page**
    - **Validates: Requirements 17.2, 17.3**

  - [x] 15.3 Implement `GET /api/v1/teacher/export/pdf` endpoint in API gateway
    - Accept `?date=YYYY-MM-DD&days=1` query params; call AI service; proxy binary response with `Content-Disposition: attachment`
    - Return 404 JSON if AI service reports no plan
    - _Requirements: 17.1, 17.4, 17.5_

  - [x] 15.4 Add PDF export button to teacher page
    - Add "Export PDF" button in the teacher page header area; clicking opens a small form (date picker + days 1–7 selector); calls `GET /api/v1/teacher/export/pdf` and triggers browser download
    - _Requirements: 17.1, 17.4, 17.5_

- [x] 16. Parent portal
  - [x] 16.1 Implement parent auth in API gateway
    - Extend `POST /api/v1/auth/login` to also look up `parent_users` table when role hint is `parent`
    - Issue JWT with `role: 'parent'` and `parent_id`
    - _Requirements: 1.1, 1.3_

  - [x] 16.2 Implement parent portal endpoints
    - `GET /api/v1/parent/absences` — for each absence record of the parent's linked students, return date, student name, and `curriculum_chunks` covered that day (from `daily_completions`)
    - `POST /api/v1/parent/missed-topics/:id/done` — mark `missed_topic_tasks.is_done = true`; remove from active list
    - `GET /api/v1/parent/missed-topics/completed` — list completed tasks
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 16.3 Write property test for parent absence view completeness (P20)
    - **Property 20: Every absence entry includes the student's name and the chunks covered on that date**
    - **Validates: Requirements 11.1, 11.5**

  - [ ]* 16.4 Write property test for missed topic task completion round-trip (P21)
    - **Property 21: Marking a task done removes it from active list and adds it to completed; active ∪ completed = full set**
    - **Validates: Requirements 11.3, 11.4**

  - [x] 16.5 Build `/parent` page
    - Absence list: per-absence card showing student name, date, covered topics list, and "Mark as done" button per topic
    - Completed tasks section: collapsed list of done tasks
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 17. Wire new routes into API gateway index and update auth middleware
  - Register all new routers in `src/index.ts`:
    - `app.use('/api/v1/teacher/attendance', teacherAttendanceRouter)`
    - `app.use('/api/v1/teacher/completion', teacherCompletionRouter)`
    - `app.use('/api/v1/teacher/export', teacherExportRouter)`
    - `app.use('/api/v1/teacher/context', teacherContextRouter)`
    - `app.use('/api/v1/admin/students', adminStudentsRouter)`
    - `app.use('/api/v1/parent', parentRouter)`
  - Register new AI service endpoints in `main.py` (`/internal/import-holidays`, `/internal/import-students`, `/internal/export-pdf`, `/internal/greeting`)
  - Apply `force_password_reset` middleware to all existing routes
  - _Requirements: 1.4, all route requirements_

- [x] 18. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints at tasks 3, 9, 13, and 18 ensure incremental validation
- Property tests use **fast-check** (TypeScript, API gateway) and **Hypothesis** (Python, AI service) with ≥ 100 iterations each
- Tag format: `// Feature: oakit-platform-phase2, Property N: <property_text>`
- `reportlab` must be added to `oakit/apps/ai-service/requirements.txt` for PDF generation
- `openpyxl` must be added to `oakit/apps/ai-service/requirements.txt` for Excel import

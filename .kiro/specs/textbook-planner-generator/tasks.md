# Implementation Plan: Textbook Planner Generator

## Overview

Implement the end-to-end Textbook-to-Planner Generator as a 5-step admin wizard. The work spans: database migrations, AI service endpoints (Python/FastAPI), API gateway routes (TypeScript/Express), and a Next.js frontend wizard. On confirmation, the system writes into the existing curriculum pipeline and calls `planner_service.generate_plans`.

## Tasks

- [x] 1. Database migrations — new planner tables
  - Create migration file with `textbook_planner_sessions`, `textbook_planner_subjects`, `textbook_planner_chapters`, and `textbook_planner_drafts` tables as specified in the design
  - Add `ALTER TABLE curriculum_documents ADD COLUMN IF NOT EXISTS ingestion_stage TEXT DEFAULT 'done'` and `source TEXT DEFAULT 'upload'`
  - Add indexes on `textbook_planner_chapters(subject_id, chapter_index)`, `textbook_planner_drafts(session_id, entry_date)`, and `textbook_planner_drafts(session_id, subject_id)`
  - _Requirements: 6.6, 9.1, 9.2_

- [-] 2. AI Service — TOC extraction endpoint
  - [x] 2.1 Implement `POST /internal/extract-toc` in `oakit/apps/ai-service/main.py`
    - Accept multipart form with `file` (PDF) and `toc_page` (int)
    - Use `pdfplumber` to read the specified page and pass text to the LLM client for chapter/topic extraction
    - Return `{ "chapters": [...], "failed": bool }` as specified in the design
    - Return `{ "chapters": [], "failed": true }` when no chapters are found
    - _Requirements: 1.5, 1.6_

  - [ ]* 2.2 Write property test for TOC page boundary validation (Property 3)
    - **Property 3: TOC page boundary validation**
    - **Validates: Requirements 1.4**
    - Use `hypothesis` to generate PDF page counts and TOC page numbers; assert acceptance iff 1 ≤ toc_page ≤ page_count

- [ ] 3. AI Service — Planner Engine core logic
  - [x] 3.1 Implement `calculate_chapter_weights(chapters)` in a new `oakit/apps/ai-service/planner_engine.py`
    - Each chapter weight = page_span / total_pages; weights must sum to 1.0
    - _Requirements: 3.5_

  - [ ]* 3.2 Write property test for chapter weight normalisation (Property 7)
    - **Property 7: Chapter weight normalisation**
    - **Validates: Requirements 3.5**
    - Use `hypothesis` to generate lists of chapters with positive page spans; assert sum of weights ≈ 1.0 and monotonicity

  - [ ]* 3.3 Write property test for chapter weight monotonicity in day allocation (Property 8)
    - **Property 8: Chapter weight monotonicity in day allocation**
    - **Validates: Requirements 3.6**

  - [x] 3.4 Implement `get_teaching_days(calendar, holidays, special_days, exam_days, revision_days)` in `planner_engine.py`
    - Returns list of Teaching_Days by subtracting all excluded day types from working days
    - _Requirements: 6.1_

  - [ ]* 3.5 Write property test for teaching day count correctness (Property 12)
    - **Property 12: Teaching day count correctness**
    - **Validates: Requirements 6.1**
    - Use `hypothesis` to generate calendar configs; assert count equals working_days − excluded_days

  - [x] 3.6 Implement `insert_test_days(mode, params, teaching_days, chapters)` in `planner_engine.py`
    - Support all four modes: `end-of-chapter`, `every-N-weeks`, `specific-dates`, `manual`
    - Insert exam rows into `special_days` with `day_type = 'exam'`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.8_

  - [ ]* 3.7 Write property test for periodic test day spacing (Property 9)
    - **Property 9: Periodic test day spacing**
    - **Validates: Requirements 4.3**
    - Use `hypothesis` to generate N in [1,52] and date ranges; assert all test days are N×7 days apart (adjusted to nearest working day)

  - [ ]* 3.8 Write property test for test date conflict detection (Property 10)
    - **Property 10: Test date conflict detection**
    - **Validates: Requirements 4.5**

  - [x] 3.9 Implement `insert_revision_buffers(exam_days, teaching_days, chapters_by_exam)` in `planner_engine.py`
    - For each exam day, find the nearest preceding Teaching_Day not already exam/revision/holiday
    - Insert into `special_days` with `day_type = 'revision'` and populate `revision_topics`
    - Log warning and skip if no preceding Teaching_Day is available
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 3.10 Write property test for revision buffer precedes exam day (Property 11)
    - **Property 11: Revision buffer precedes exam day**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 3.11 Implement `distribute_topics_across_days(subjects, teaching_days)` in `planner_engine.py`
    - Distribute each subject's topics in TOC order, proportional to `weekly_hours` and `chapter_weight`
    - When topics exceed available days, spread remaining topics across last available days (no drops)
    - _Requirements: 6.2, 6.3, 6.5_

  - [ ]* 3.12 Write property test for topic ordering preserved in draft (Property 13)
    - **Property 13: Topic ordering preserved in draft**
    - **Validates: Requirements 6.3**

  - [ ]* 3.13 Write property test for draft entry completeness (Property 14)
    - **Property 14: Draft entry completeness**
    - **Validates: Requirements 6.4**

  - [ ]* 3.14 Write property test for no topics dropped on overflow (Property 15)
    - **Property 15: No topics dropped on overflow**
    - **Validates: Requirements 6.5**

  - [x] 3.15 Implement `apply_carry_forward(entries, topic_index, subject_id)` in `planner_engine.py`
    - Shift all subsequent topics for the subject forward by one Teaching_Day
    - Flag subject as overrun if last topic exceeds last Teaching_Day of the year
    - _Requirements: 7.2, 7.3_

  - [ ]* 3.16 Write property test for carry-forward preserves topic order (Property 16)
    - **Property 16: Carry-forward preserves topic order**
    - **Validates: Requirements 7.2**

- [ ] 4. AI Service — Planner generation endpoint
  - [x] 4.1 Implement `POST /internal/generate-textbook-planner` in `main.py`
    - Accept session configuration JSON; call `planner_engine` functions in sequence
    - Return `{ "entries": [...], "summary": {...} }` as specified in the design
    - Run as a background task; update session status to `generated` on completion
    - _Requirements: 6.1–6.8_

  - [x] 4.2 Implement `calculate_available_minutes(parameters)` utility in `planner_engine.py`
    - Pure function: `(school_end - school_start) - sum(breaks + activities)`
    - Raise validation error if non-teaching time ≥ total school day duration
    - _Requirements: 2.14, 2.15_

  - [ ]* 4.3 Write property test for available teaching minutes calculation (Property 5) — Python side
    - **Property 5: Available teaching minutes calculation**
    - **Validates: Requirements 2.14, 2.15**
    - Use `hypothesis` to generate school time configs; assert formula correctness and rejection when non-teaching ≥ total

- [-] 5. API Gateway — Session and subject routes
  - [x] 5.1 Create `oakit/apps/api-gateway/src/routes/admin/textbookPlanner.ts` with session CRUD
    - `POST /sessions` — create or return existing session (upsert on `UNIQUE(school_id, class_id, academic_year)`)
    - `GET /sessions/:sessionId` — return session state
    - Apply `jwtVerify + schoolScope + roleGuard('admin')` middleware
    - _Requirements: 1.1, 2.1_

  - [ ] 5.2 Add subject management routes to `textbookPlanner.ts`
    - `POST /sessions/:sessionId/subjects` — add subject (enforce unique name within session)
    - `DELETE /sessions/:sessionId/subjects/:subjectId` — delete subject and associated data
    - _Requirements: 1.1, 1.9_

  - [ ] 5.3 Add PDF upload and TOC extraction routes
    - `POST /sessions/:sessionId/subjects/:subjectId/upload` — multer upload (PDF only, 50 MB limit), store `pdf_path` and `pdf_page_count`, call `/internal/extract-toc`, persist chapters
    - `PATCH /sessions/:sessionId/subjects/:subjectId/toc-page` — re-run extraction on a different page; validate page in [1, pdf_page_count]
    - Reject non-PDF files with descriptive error before calling AI service
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ] 5.4 Add chapter management routes
    - `GET /sessions/:sessionId/subjects/:subjectId/chapters`
    - `POST /sessions/:sessionId/subjects/:subjectId/chapters` — manual add
    - `PATCH /sessions/:sessionId/subjects/:subjectId/chapters/:chapterId`
    - `DELETE /sessions/:sessionId/subjects/:subjectId/chapters/:chapterId`
    - _Requirements: 1.8_

  - [ ] 5.5 Add parameters, allocations, and test-config PATCH routes
    - `PATCH /sessions/:sessionId/parameters` — validate and save school parameters; return `available_teaching_minutes`
    - `PATCH /sessions/:sessionId/allocations` — save weekly hours; return total vs available; warn if > 100% or < 80%
    - `PATCH /sessions/:sessionId/test-config` — save test schedule config; validate `every_n_weeks` in [1,52] and `duration_periods` in [1,5]; validate specific dates against holidays/special_days
    - _Requirements: 2.14, 2.15, 3.1–3.4, 4.1–4.8_

  - [ ] 5.6 Add generation, draft, and confirm routes
    - `POST /sessions/:sessionId/generate` — call AI service `/internal/generate-textbook-planner`; persist draft entries; update session status
    - `GET /sessions/:sessionId/draft` — paginated by week
    - `PATCH /sessions/:sessionId/draft/:entryId` — edit entry, set `is_manual_edit = true`
    - `POST /sessions/:sessionId/draft/revert` — delete non-manual-edit entries and re-insert last generated version
    - `POST /sessions/:sessionId/confirm` — push to curriculum pipeline (see task 6)
    - _Requirements: 6.6, 6.7, 8.1–8.9_

  - [ ] 5.7 Add coverage summary route
    - `GET /sessions/:sessionId/coverage` — return per-subject: total chapters, completed, in_progress, not_started; compute elapsed_pct vs coverage_pct; flag pacing alert if gap > 15%
    - _Requirements: 10.1–10.5_

  - [ ] 5.8 Register the new router in `oakit/apps/api-gateway/src/index.ts`
    - `import textbookPlannerRouter from './routes/admin/textbookPlanner'`
    - `app.use('/api/v1/admin/textbook-planner', textbookPlannerRouter)`
    - _Requirements: all API-facing requirements_

- [ ] 6. API Gateway — Curriculum push logic
  - [x] 6.1 Implement `pushToCurrenticulumPipeline(sessionId, schoolId)` helper in `textbookPlanner.ts`
    - Create one `curriculum_documents` row per session with `source = 'textbook_planner'`, `status = 'ready'`, `ingestion_stage = 'done'`
    - Create one `curriculum_chunks` row per draft entry with `topic_label`, `content`, `chunk_index`, `class_id`, `school_id`, `document_id`
    - For each section of the class, call AI service `POST /internal/generate-plans` (existing endpoint)
    - Wrap each section's inserts in a transaction; roll back on failure; continue other sections
    - Update session `status = 'confirmed'` after all sections succeed
    - _Requirements: 9.1–9.7_

  - [ ] 6.2 Guard against re-push of confirmed drafts
    - Before push, check `status = 'confirmed'`; return 409 with informational message if already confirmed
    - _Requirements: 9.6_

  - [ ]* 6.3 Write property test for chapter status forward-only transitions (Property 18)
    - **Property 18: Chapter status forward-only transitions**
    - **Validates: Requirements 10.1**
    - Use `fast-check` to generate sequences of completion events; assert status only moves planned → in_progress → completed

  - [ ]* 6.4 Write property test for pacing alert threshold (Property 19)
    - **Property 19: Pacing alert threshold**
    - **Validates: Requirements 10.5**
    - Use `fast-check` to generate (elapsed_pct, coverage_pct) pairs; assert alert iff elapsed_pct − coverage_pct > 15

  - [ ]* 6.5 Write property test for available teaching minutes (Property 5) — TypeScript side
    - **Property 5: Available teaching minutes calculation**
    - **Validates: Requirements 2.14, 2.15**
    - Use `fast-check` to generate school time configs; assert formula and rejection boundary

  - [ ]* 6.6 Write property test for subject allocation total (Property 6)
    - **Property 6: Subject allocation total**
    - **Validates: Requirements 3.2**
    - Use `fast-check` to generate allocation arrays; assert displayed total equals arithmetic sum

- [ ] 7. Checkpoint — backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Frontend — Wizard scaffold and Step 1 (Subject Setup)
  - [x] 8.1 Create `oakit/apps/frontend/src/app/admin/textbook-planner/page.tsx` with 5-step wizard shell
    - Manage step state in React context; render step components conditionally
    - _Requirements: all wizard-facing requirements_

  - [ ] 8.2 Implement Step 1 UI: subject list, add subject form, PDF upload with TOC page input
    - Call `POST /sessions`, `POST /sessions/:id/subjects`, `POST /sessions/:id/subjects/:id/upload`
    - Show extracted chapter/topic list for review after successful extraction
    - Display error and allow page retry if extraction returns `failed: true`
    - _Requirements: 1.1–1.9_

  - [ ] 8.3 Implement chapter/topic editor in Step 1
    - Inline add, edit, delete for chapters and topics
    - Call PATCH/DELETE chapter routes
    - _Requirements: 1.8, 1.9_

- [ ] 9. Frontend — Steps 2–4 (Parameters, Allocation, Test Config)
  - [ ] 9.1 Implement Step 2 UI: academic year check, working days, holidays count, special days count with inline add
    - Call `PATCH /sessions/:id/parameters`; display `available_teaching_minutes` returned by API
    - _Requirements: 2.1–2.15_

  - [ ] 9.2 Implement Step 3 UI: weekly hours per subject, utilisation bar
    - Call `PATCH /sessions/:id/allocations`; show warning banners for over/under allocation
    - _Requirements: 3.1–3.4_

  - [ ] 9.3 Implement Step 4 UI: test scheduling mode selector, N-weeks input, date picker for specific dates, duration periods
    - Call `PATCH /sessions/:id/test-config`; show conflict warnings for specific dates
    - _Requirements: 4.1–4.8_

- [ ] 10. Frontend — Step 5 (Preview, Edit, Confirm)
  - [ ] 10.1 Implement Step 5 planner preview: paginated weekly calendar view
    - Call `GET /sessions/:id/draft?week=N`; render each day's subject, chapter, topic, duration
    - _Requirements: 8.1_

  - [ ] 10.2 Implement drag-and-drop topic reordering between Teaching_Days
    - Call `PATCH /sessions/:id/draft/:entryId` on drop
    - _Requirements: 8.2_

  - [ ] 10.3 Implement manual add, remove, and day-type marking actions
    - Add topic to day, remove topic (moves to next day), mark day as exam/revision/event
    - Call appropriate PATCH routes; re-fetch draft after each change
    - _Requirements: 8.3, 8.4, 8.5, 8.6_

  - [ ] 10.4 Implement revert and re-generate buttons
    - Revert: call `POST /sessions/:id/draft/revert`; re-fetch draft
    - Re-generate: call `POST /sessions/:id/generate`; poll session status until `generated`; re-fetch draft
    - _Requirements: 8.8, 8.9_

  - [ ] 10.5 Implement Confirm button and success summary display
    - Call `POST /sessions/:id/confirm`; show summary: chunks created, day plans per section
    - Disable confirm button and show informational message if session is already `confirmed`
    - _Requirements: 9.4, 9.6, 9.7_

- [ ] 11. Frontend — Coverage dashboard widget
  - Implement coverage summary panel (can be embedded in the planner page or admin dashboard)
  - Call `GET /sessions/:id/coverage`; display per-subject progress bars, elapsed vs covered pct, pacing alert banner
  - _Requirements: 10.1–10.5_

- [ ] 12. Re-generation on calendar change
  - [ ] 12.1 Add a DB trigger or API hook that sets session `status = 'stale'` when a holiday or special day is inserted/deleted for the same school and academic year
    - _Requirements: 11.1_

  - [x] 12.2 Show stale-draft banner in the frontend wizard when session status is `stale`
    - Banner links to re-generate action; on confirmed drafts, show acknowledgement dialog warning that existing `day_plans` will be replaced
    - _Requirements: 11.1, 11.2, 11.4_

  - [ ] 12.3 Implement re-generation logic that preserves manual edits on surviving Teaching_Days
    - In `POST /sessions/:id/generate`, after generating new entries, re-apply `is_manual_edit = true` rows from the previous draft where `entry_date` still exists in the new schedule
    - Flag subjects where topics cannot be scheduled due to reduced Teaching_Days
    - _Requirements: 11.3, 11.5_

- [ ] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` (TypeScript) and `hypothesis` (Python) with minimum 100 iterations each
- Checkpoints ensure incremental validation before moving to the next layer

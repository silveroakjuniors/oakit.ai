# Implementation Plan: Topic-Level Homework Generation

## Overview

Implement the end-to-end Topic Homework Generation feature across four layers: DB migration, AI service (Python/FastAPI), API gateway (TypeScript/Express), and Next.js frontend. The work extends the existing `teacher_homework` table, adds a new AI draft-generation endpoint, wires up teacher and admin routes, and replaces the old per-topic checkboxes with a `HomeworkModal` flow.

## Tasks

- [ ] 1. Database migration — extend `teacher_homework` and add `homework_history`
  - Create `oakit/db/migrations/044_topic_homework.sql`
  - `ALTER TABLE teacher_homework ADD COLUMN IF NOT EXISTS chunk_id UUID REFERENCES curriculum_chunks(id)`
  - `ALTER TABLE teacher_homework ADD COLUMN IF NOT EXISTS topic_label TEXT`
  - `ALTER TABLE teacher_homework ADD COLUMN IF NOT EXISTS teacher_comments TEXT`
  - Drop old unique constraint `teacher_homework_section_id_homework_date_key` and add `UNIQUE (section_id, chunk_id, homework_date)`
  - Create `homework_history` table with columns: `id`, `homework_id`, `school_id`, `raw_text`, `formatted_text`, `teacher_comments`, `saved_at`, `saved_by`
  - Add index `ON homework_history(homework_id, saved_at DESC)`
  - _Requirements: 4.5, 7.4_

- [ ] 2. AI Service — `POST /internal/generate-topic-homework` endpoint
  - [ ] 2.1 Add `TopicHomeworkRequest` Pydantic model and route in `oakit/apps/ai-service/main.py`
    - Accept `topic_label: str`, `content: str`, `school_id: str = ""`, `section_id: str = ""`
    - Prompt the LLM to produce homework in the same language as `content`, structured as: what to do, materials needed (if any), estimated time
    - Return `{"draft_text": str}`
    - Apply 15-second timeout; return 504 on timeout
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 2.2 Write unit tests for the generate-topic-homework endpoint
    - Test that `draft_text` is returned for a valid request
    - Test that a 504 is returned when the LLM call exceeds 15 seconds (mock LLM)
    - _Requirements: 2.1, 2.4_

- [ ] 3. API Gateway — `routes/teacher/homework.ts`
  - [ ] 3.1 Create `oakit/apps/api-gateway/src/routes/teacher/homework.ts` with `POST /generate`
    - Apply `jwtVerify + schoolScope + roleGuard('teacher')` middleware
    - Forward `{ topic_label, content, school_id, section_id }` to AI service `/internal/generate-topic-homework`
    - Return `{ draft_text }` or 504 with retry hint on timeout
    - _Requirements: 2.1, 2.4_

  - [ ] 3.2 Add `GET /:chunkId` route — fetch existing homework record for today
    - Query `teacher_homework` by `(section_id, chunk_id, homework_date = today)`
    - Return the record if found, or 404 if not
    - _Requirements: 1.2, 6.5_

  - [ ] 3.3 Add `POST /submit` route — format, save, and deliver
    - Accept `{ chunk_id, topic_label, raw_text, teacher_comments }`
    - Reject with 400 if `raw_text` is empty or whitespace-only
    - Call AI service `/internal/format-homework`; on failure fall back to `raw_text` and set `formatting_skipped: true`
    - `INSERT INTO teacher_homework` (or `UPDATE` if record exists) and `INSERT INTO homework_history`
    - Query unique parent IDs for the section; `INSERT INTO messages` one row per parent with `sender_role = 'teacher'`
    - Return `{ homework_record, parents_notified, failed_parents[], formatting_skipped }`
    - _Requirements: 3.5, 4.1, 4.2, 4.3, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 3.4 Write property test for non-empty validation (Property 1)
    - **Property 1: Non-empty validation**
    - **Validates: Requirements 3.5**
    - Use `fast-check` to generate arbitrary whitespace-only strings; assert `POST /submit` returns 400 and no DB row is created

  - [ ]* 3.5 Write property test for homework record round-trip (Property 2)
    - **Property 2: Homework record round-trip**
    - **Validates: Requirements 4.5**
    - Use `fast-check` to generate valid homework payloads; assert `GET /:chunkId` returns `raw_text` and `formatted_text` equal to what was submitted

  - [ ]* 3.6 Write property test for one message per unique parent (Property 3)
    - **Property 3: One message per unique parent**
    - **Validates: Requirements 5.1, 5.3**
    - Use `fast-check` to generate sections with varying parent/student configurations (including parents with multiple children); assert exactly one message row per unique `parent_id`

  - [ ]* 3.7 Write property test for sender role invariant (Property 4)
    - **Property 4: All delivered messages have correct sender role**
    - **Validates: Requirements 5.2**
    - Use `fast-check` to generate arbitrary delivery scenarios; assert every inserted message has `sender_role = 'teacher'`

  - [ ] 3.8 Add `PUT /:id` route — edit existing record, re-format, re-deliver
    - Accept `{ raw_text, teacher_comments }`
    - Reject with 400 if `raw_text` is empty or whitespace-only
    - `INSERT INTO homework_history` (snapshot of current record before update)
    - Re-call AI format; prefix `formatted_text` body with `📝 Updated Homework:\n` in messages
    - Re-deliver to all parents in section; return same shape as `/submit`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 3.9 Write property test for update preserves history (Property 7)
    - **Property 7: Update preserves history**
    - **Validates: Requirements 7.4**
    - Use `fast-check` to generate sequences of updates; assert `homework_history` has ≥ 2 entries and earliest `raw_text` equals original submission

  - [ ]* 3.10 Write property test for updated messages carry update marker (Property 8)
    - **Property 8: Updated messages carry the update marker**
    - **Validates: Requirements 7.3**
    - Use `fast-check` to generate re-delivery scenarios; assert every re-delivered message body starts with `📝 Updated Homework`

- [ ] 4. API Gateway — `routes/admin/homework.ts`
  - [ ] 4.1 Create `oakit/apps/api-gateway/src/routes/admin/homework.ts` with `GET /`
    - Apply `jwtVerify + schoolScope + roleGuard('admin', 'principal')` middleware
    - Accept query params `?date=YYYY-MM-DD&class_id=&section_id=`
    - Return list of homework records with `topic_label`, `homework_date`, `teacher_name`, `class_name`, `section_label`, `formatted_text`
    - _Requirements: 6.1, 6.3, 6.4_

  - [ ]* 4.2 Write property test for admin filter correctness (Property 5)
    - **Property 5: Admin filter correctness**
    - **Validates: Requirements 6.3**
    - Use `fast-check` to generate filter combinations against seeded data; assert every returned record satisfies all applied filters

  - [ ]* 4.3 Write property test for admin list record completeness (Property 6)
    - **Property 6: Admin list record completeness**
    - **Validates: Requirements 6.4**
    - Use `fast-check` to generate arbitrary homework records; assert all required fields are non-null in every response object

- [ ] 5. API Gateway — Register new routes in `index.ts`
  - Import `teacherHomeworkRouter` from `./routes/teacher/homework` and mount at `/api/v1/teacher/homework`
  - Import `adminHomeworkRouter` from `./routes/admin/homework` and mount at `/api/v1/admin/homework`
  - _Requirements: all API-facing requirements_

- [ ] 6. Checkpoint — backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Frontend — Per-topic homework state and `HomeworkModal` component
  - [ ] 7.1 Replace old `homeworkText` / `savingHomework` / `existingHomework` state in `teacher/page.tsx` with a per-chunk map `homeworkByChunk: Record<chunkId, HomeworkState>`
    - `HomeworkState`: `{ status: 'none'|'generating'|'draft'|'saved', draftText, teacherComments, record }`
    - On page load, call `GET /teacher/homework/:chunkId` for each chunk in today's plan and populate the map
    - _Requirements: 1.1, 1.2, 1.3, 6.5_

  - [ ] 7.2 Replace per-topic checkboxes with "Generate Homework" / "View / Edit Homework" buttons
    - Show "Generate Homework" when `status === 'none'`; show "View / Edit Homework" when `status === 'saved'`; show loading spinner when `status === 'generating'`
    - Show "Homework sent ✓" badge on the topic row when `status === 'saved'`
    - _Requirements: 1.1, 1.2, 1.3, 6.5_

  - [ ] 7.3 Create `HomeworkModal` component (`src/components/HomeworkModal.tsx`)
    - Step 1 — Draft: display editable textarea pre-filled with `draftText`; separate "Teacher's Comments" textarea; "Submit" button (disabled when textarea is empty/whitespace)
    - Step 2 — Preview: display `formatted_text` returned by `/submit`; "Confirm & Send" and "Back" buttons
    - Step 3 — Confirmation: show "X parents notified"; list any `failed_parents` with retry option; show `formatting_skipped` notice if applicable
    - Preserve unsaved edits in component state while modal is open within the same session
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.6, 5.4, 5.5_

  - [ ] 7.4 Wire `HomeworkModal` to the edit flow for existing records
    - When "View / Edit Homework" is clicked, open modal pre-filled with existing `raw_text` and `teacher_comments`
    - On confirm, call `PUT /teacher/homework/:id` instead of `/submit`
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 7.5 Write unit tests for `HomeworkModal`
    - Test submit button is disabled when textarea is empty or whitespace-only
    - Test that unsaved edits are preserved when modal is closed and reopened within the same session
    - _Requirements: 3.4, 3.5_

- [ ] 8. Frontend — Admin homework list page
  - Create `oakit/apps/frontend/src/app/admin/homework/page.tsx`
  - Fetch from `GET /admin/homework` with optional `date`, `class_id`, `section_id` query params
  - Render a filterable table showing: topic name, date, teacher name, class/section, formatted message
  - Add filter controls: date picker, class dropdown, section dropdown
  - _Requirements: 6.1, 6.3, 6.4_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use `fast-check` (TypeScript) with a minimum of 100 iterations each
- The AI service already has `/internal/format-homework`; only `/internal/generate-topic-homework` is new
- Legacy `teacher_homework` rows with `chunk_id = NULL` are unaffected by the new unique constraint

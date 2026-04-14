# Implementation Tasks — Student Portal

## Task 1: Database Migrations

- [x] 1.1 Create migration `040_student_portal.sql` with tables: `student_portal_config`, `student_accounts`, `quizzes`, `quiz_questions`, `quiz_attempts`, `quiz_answers`
- [x] 1.2 Add indexes on `student_accounts(school_id, username)`, `quiz_attempts(quiz_id, student_id)`, `quiz_answers(attempt_id)`
- [ ] 1.3 Run migration in Supabase

## Task 2: Student Auth — Login & Password

- [x] 2.1 Add `POST /api/v1/auth/student-login` route in `auth.ts` — looks up `student_accounts`, checks `student_portal_config.enabled`, returns JWT with `role: "student"`
- [x] 2.2 Extend `POST /api/v1/auth/change-password` to handle `role: "student"` (updates `student_accounts` table)
- [ ] 2.3 Add `studentRoleGuard` middleware that accepts only `role: "student"` tokens
- [ ] 2.4 Add `forceResetGuard` check for student tokens (blocks all routes except change-password)

## Task 3: Admin — Portal Config Routes

- [x] 3.1 Create `oakit/apps/api-gateway/src/routes/admin/studentPortal.ts` with `GET /config` and `PUT /config/:classId`
- [x] 3.2 Register routes in `index.ts` at `/api/v1/admin/student-portal`

## Task 4: Credential Management Routes

- [x] 4.1 Create `oakit/apps/api-gateway/src/routes/teacher/studentCredentials.ts`
- [ ] 4.2 Implement `POST /generate` — username generation algorithm, bcrypt hash, upsert into `student_accounts`
- [ ] 4.3 Implement `POST /reset/:studentId` — reset to default password `123456`
- [ ] 4.4 Implement `GET /:sectionId` — list students with account status
- [ ] 4.5 Register routes in `index.ts` at `/api/v1/teacher/students/credentials`

## Task 5: Student Feed Routes

- [x] 5.1 Create `oakit/apps/api-gateway/src/routes/student/feed.ts`
- [ ] 5.2 Implement `GET /feed?date=` — returns covered topics, homework, notes for date (max 5 days ahead)
- [ ] 5.3 Implement `GET /feed/summary?from=&to=` — subject-grouped summary for date range
- [ ] 5.4 Implement `GET /homework/history` — last 30 days homework + submission status
- [ ] 5.5 Register routes in `index.ts` at `/api/v1/student`

## Task 6: AI Student Query Route

- [x] 6.1 Add `POST /api/v1/ai/student-query` in `ai.ts` — builds covered_chunk_ids context, forwards to AI service
- [ ] 6.2 Block student-query during active assigned test attempt (check `quiz_attempts` status)

## Task 7: Quiz Routes — Student

- [x] 7.1 Create `oakit/apps/api-gateway/src/routes/student/quiz.ts`
- [ ] 7.2 Implement `GET /topics?subject=&from=&to=` — covered topics for subject/date range
- [ ] 7.3 Implement `POST /generate` — create quiz, call AI generate-quiz, store questions
- [ ] 7.4 Implement `POST /:quizId/start` — create attempt record, return questions without answer keys
- [ ] 7.5 Implement `POST /:quizId/submit` — call AI evaluate-quiz, store answers + marks, return results
- [ ] 7.6 Implement `GET /results` — student's quiz history with stats
- [ ] 7.7 Register routes in `index.ts` at `/api/v1/student/quiz`

## Task 8: Quiz Routes — Teacher

- [x] 8.1 Create `oakit/apps/api-gateway/src/routes/teacher/quiz.ts`
- [ ] 8.2 Implement `POST /assign` — create assigned quiz, generate questions, return for review
- [ ] 8.3 Implement `POST /:quizId/activate` — set status active, notify students
- [ ] 8.4 Implement `GET /analytics/:sectionId` — per-student results, averages, weak areas
- [ ] 8.5 Register routes in `index.ts` at `/api/v1/teacher/quiz`

## Task 9: Parent Analytics Route

- [x] 9.1 Add `GET /api/v1/parent/student-analytics/:studentId` in a new `parent/studentAnalytics.ts`
- [ ] 9.2 Gate on `student_portal_config.enabled` for the student's class
- [ ] 9.3 Register route in `index.ts`

## Task 10: AI Service — Student Query Handler

- [x] 10.1 Add `POST /internal/student-query` endpoint in `main.py`
- [ ] 10.2 Implement relevance check: compare question against covered chunk topic labels using keyword/embedding match
- [ ] 10.3 If not relevant: return scoped refusal with up to 3 recent topic suggestions
- [ ] 10.4 If relevant: fetch chunk content, call LLM with age-appropriate explanation prompt, include topic name + date in response

## Task 11: AI Service — Quiz Generation

- [x] 11.1 Add `POST /internal/generate-quiz` endpoint in `main.py`
- [ ] 11.2 Fetch chunk content for all confirmed topic IDs
- [ ] 11.3 Generate questions per type (fill_blank, descriptive, 1_mark, 2_mark) with randomness
- [ ] 11.4 Return `[{ question, q_type, marks, answer_key, explanation }]`

## Task 12: AI Service — Quiz Evaluation

- [x] 12.1 Add `POST /internal/evaluate-quiz` endpoint in `main.py`
- [ ] 12.2 Exact/fuzzy match for fill_blank and 1_mark questions
- [ ] 12.3 LLM evaluation with rubric for descriptive and 2_mark questions
- [ ] 12.4 Return `[{ question_id, is_correct, marks_awarded, ai_feedback }]`

## Task 13: Frontend — Student Login & Password Change

- [x] 13.1 Create `oakit/apps/frontend/src/app/student/login/page.tsx` — school code + username + password form
- [x] 13.2 Create `oakit/apps/frontend/src/app/student/change-password/page.tsx` — enforced on first login
- [ ] 13.3 Add student token storage and `getStudentToken` / `clearStudentToken` helpers in `lib/auth.ts`

## Task 14: Frontend — Student Portal Dashboard

- [x] 14.1 Create `oakit/apps/frontend/src/app/student/page.tsx` with tabs: Today | Homework | Ask Oakie | Quiz | My Progress
- [ ] 14.2 Implement Today tab: date picker, subject-grouped topic cards, homework card, notes list
- [ ] 14.3 Implement Homework tab: 30-day history with status badges
- [ ] 14.4 Implement Ask Oakie tab: chat interface scoped to covered topics, topic suggestion chips
- [ ] 14.5 Implement Quiz tab: self-test flow (subject → date range → topic confirm → question types → quiz → results)
- [ ] 14.6 Implement Quiz tab: assigned tests section with timer countdown
- [ ] 14.7 Implement My Progress tab: total quizzes, average score, subject breakdown, weak area highlights, quiz history

## Task 15: Frontend — Admin Portal Config UI

- [ ] 15.1 Add "Student Portal" section to admin settings page (`/admin/settings` or `/admin/students`)
- [ ] 15.2 Show toggle per class with enabled/disabled state and last-enabled timestamp

## Task 16: Frontend — Teacher Credential Management UI

- [ ] 16.1 Add "Student Accounts" panel to teacher portal
- [ ] 16.2 Show student list with username, account status, generate/reset buttons
- [ ] 16.3 Bulk generate for entire section with one click
- [ ] 16.4 Show generated credentials (username + default password) in a copyable card

## Task 17: Frontend — Teacher Quiz Assignment UI

- [ ] 17.1 Add "Assign Test" flow to teacher portal
- [ ] 17.2 Step 1: subject + date range → show topic list for confirmation/editing
- [ ] 17.3 Step 2: question types + time limit + due date
- [ ] 17.4 Step 3: preview generated questions → activate

## Task 18: Frontend — Parent Analytics (if portal enabled)

- [ ] 18.1 Add quiz analytics section to parent portal Progress tab (only shown if student portal enabled for child's class)
- [ ] 18.2 Show quiz history, average score, weak subjects

## Task 19: Property-Based Tests

- [ ] 19.1 Write PBT for username uniqueness: generate accounts for N students, assert all usernames distinct
- [ ] 19.2 Write PBT for portal gate: student login with disabled class must always return 401
- [ ] 19.3 Write PBT for score integrity: `scored_marks` equals sum of `marks_awarded` across answers

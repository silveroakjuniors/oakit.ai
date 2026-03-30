# Implementation Plan: Oakit.ai Curriculum Management Platform

## Overview

Incremental implementation of the Oakit.ai platform in a monorepo structure. Each task builds on the previous, ending with all services wired together. The stack is: Next.js (frontend), Node.js + Express (API gateway), Python + FastAPI (AI service), PostgreSQL + pgvector (database), Redis (cache/sessions), Ollama + sentence-transformers (local AI).

## Tasks

- [x] 1. Monorepo scaffolding and project structure
  - Create root `package.json` with workspaces: `apps/frontend`, `apps/api-gateway`, `apps/ai-service`
  - Scaffold `apps/frontend` as a Next.js 14 app with Tailwind CSS and PWA support (`next-pwa`)
  - Scaffold `apps/api-gateway` as a Node.js + Express app with TypeScript
  - Scaffold `apps/ai-service` as a Python FastAPI app with `pyproject.toml` / `requirements.txt`
  - Add root `.env.example` with all required environment variables (DB URL, Redis URL, Ollama URL, JWT secret)
  - Add `docker-compose.yml` for local dev: PostgreSQL + pgvector, Redis, Ollama
  - _Requirements: 1.1, 2.1_

- [x] 2. Database schema and migrations
  - [x] 2.1 Create SQL migration files for all tables in the design schema
    - `001_extensions.sql` — enable `pgvector` extension
    - `002_schools_roles_users.sql` — `schools`, `roles`, `users` tables
    - `003_classes_sections.sql` — `classes`, `sections`, `teacher_sections` tables
    - `004_calendar.sql` — `school_calendar` table
    - `005_curriculum.sql` — `curriculum_documents`, `curriculum_chunks` tables with ivfflat index
    - `006_plans_logs.sql` — `day_plans`, `coverage_logs`, `coverage_statuses` tables
    - _Requirements: 1.1, 3.2, 3.3, 4.4, 5.1, 7.3_

  - [ ]* 2.2 Write property test for schema integrity
    - **Property 1: Every entity table has a non-null `school_id` foreign key**
    - **Validates: Requirements 1.1**

- [x] 3. Brand tokens and global UI setup
  - Add CSS custom properties (`--color-primary: #1B4332`, `--color-accent: #F5A623`, `--color-bg`, `--color-surface`) to `globals.css`
  - Configure Tailwind to extend theme with `primary` and `accent` color aliases
  - Add Inter font via `next/font`
  - Create `OakitLogo` component rendering `Oakit` in green and `.ai` in yellow
  - Create shared `Button`, `Card`, `Badge`, `Input` components using the brand tokens
  - _Requirements: (UI foundation for all screens)_

- [x] 4. Authentication — API gateway layer
  - [x] 4.1 Implement JWT issuance and validation middleware in Node.js API
    - `POST /api/v1/auth/login` — validate email + password against `users` table, issue signed JWT with `{ user_id, school_id, role, permissions }`
    - `POST /api/v1/auth/logout` — invalidate session in Redis
    - `POST /api/v1/auth/refresh` — reissue JWT from valid refresh token
    - `POST /api/v1/auth/setup` — accept `setup_token` + new password, hash with bcrypt, clear token
    - Store active sessions in Redis with TTL matching JWT expiry
    - _Requirements: 2.2, 2.3, 2.4, 3.6_

  - [x] 4.2 Implement RBAC and school-scope middleware
    - `jwtVerify` middleware — reject expired/invalid tokens (Req 2.4)
    - `schoolScope` middleware — inject `school_id` from JWT into `req.context`; reject cross-school access (Req 1.4)
    - `roleGuard(allowedRoles)` middleware factory — return 403 if role not in allowed list (Req 2.6)
    - Apply middleware chain: `cors → rateLimit → jwtVerify → schoolScope → roleGuard → handler`
    - _Requirements: 1.2, 1.4, 2.2, 2.6_

  - [ ]* 4.3 Write unit tests for auth middleware
    - Test expired token rejection, cross-school rejection, role guard enforcement
    - _Requirements: 1.4, 2.3, 2.4, 2.6_

- [x] 5. Authentication — Login UI
  - [x] 5.1 Build Login page with role selector and credential form
    - Three role cards (Admin / Principal / Teacher) with icons; selecting a card reveals the credential form
    - Form fields: email, password; submit calls `POST /api/v1/auth/login`
    - On success: store JWT in `httpOnly` cookie; redirect to role-appropriate dashboard
    - On failure: show generic "Invalid credentials" message (Req 2.3)
    - School code entry: persist selected school subdomain in a separate `httpOnly` cookie
    - _Requirements: 2.1, 2.3, 2.5_

  - [ ]* 5.2 Write unit tests for Login page
    - Test role card selection, form validation, error display, redirect on success
    - _Requirements: 2.3, 2.5_

- [x] 6. Admin module — User management
  - [x] 6.1 Implement user management API endpoints
    - `GET /api/v1/admin/users` — list users scoped to `school_id`
    - `POST /api/v1/admin/users` — create teacher/principal; hash password placeholder; generate `setup_token` + `setup_expires`; send credential setup email (stub: log to console in Phase 1)
    - `DELETE /api/v1/admin/users/:id` — soft-deactivate user
    - `GET /api/v1/admin/roles` — list roles for school
    - Enforce `roleGuard(['admin'])` on all endpoints
    - _Requirements: 3.1, 3.6, 12.2_

  - [x] 6.2 Build Admin User Management UI
    - Table of users with name, email, role, section assignments
    - "Add Teacher" modal: name, email, section multi-select
    - Deactivate button with confirmation dialog
    - _Requirements: 3.1, 3.4, 3.5_

  - [ ]* 6.3 Write unit tests for user management endpoints
    - Test duplicate email rejection, setup token generation, role guard
    - _Requirements: 3.1, 3.6_

- [x] 7. Admin module — Class and section management
  - [x] 7.1 Implement class and section API endpoints
    - `GET/POST /api/v1/admin/classes` — list and create classes (unique per school)
    - `GET/POST /api/v1/admin/classes/:id/sections` — list and create sections; return 409 on duplicate label within class (Req 3.7)
    - `POST /api/v1/admin/sections/:id/teachers` — assign teacher to section
    - `DELETE /api/v1/admin/sections/:id/teachers/:tid` — remove teacher assignment
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.7_

  - [x] 7.2 Build Admin Class & Section Setup UI
    - Accordion list of classes; each expands to show sections and assigned teachers
    - "Add Class" and "Add Section" inline forms
    - Teacher assignment: searchable dropdown of teachers; remove button per assignment
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [ ]* 7.3 Write unit tests for class/section endpoints
    - Test duplicate section label rejection, teacher assignment/removal
    - _Requirements: 3.3, 3.7_

- [x] 8. Checkpoint — Auth and admin foundation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. PDF ingestion pipeline — Python AI service
  - [x] 9.1 Implement embedding service module
    - `embeddings.py`: load `all-MiniLM-L6-v2` once at startup; expose `embed(text)` and `embed_batch(texts)` returning `list[float]`
    - _Requirements: 4.7_

  - [x] 9.2 Implement PDF text extraction
    - `extractor.py`: use `pdfplumber` to extract text per page; return `[{page_num, text}]`
    - On per-page failure: log `{page, reason}` and continue (Req 4.6)
    - _Requirements: 4.2, 4.6_

  - [x] 9.3 Implement semantic chunker
    - `chunker.py`: split pages on heading patterns (`HEADING_PATTERN`) and enforce `MAX_CHUNK_TOKENS=400` / `MIN_CHUNK_TOKENS=50`
    - Extract activity identifiers with regex (`WB p.12`, `SB Ex.3`, `Worksheet 4A`)
    - Return `list[Chunk]` with `content`, `topic_label`, `page_start`, `page_end`, `activity_ids`
    - Preserve original text without modification (Req 11.1)
    - _Requirements: 4.3, 4.4, 10.1, 11.1_

  - [ ]* 9.4 Write property test for chunker
    - **Property 2: All text from source pages appears in at least one chunk (round-trip completeness)**
    - **Validates: Requirements 11.2**

  - [ ]* 9.5 Write property test for chunker token bounds
    - **Property 3: No chunk exceeds MAX_CHUNK_TOKENS and no chunk is below MIN_CHUNK_TOKENS (except last)**
    - **Validates: Requirements 4.3**

  - [x] 9.6 Implement ingestion orchestrator and FastAPI endpoint
    - `ingestion_service.py`: orchestrate extract → chunk → embed_batch → insert into `curriculum_chunks`
    - Compute SHA-256 checksum on upload; check `curriculum_documents.checksum` for duplicates (Req 11.3)
    - Update `curriculum_documents.status` through `pending → processing → ready / failed`
    - `POST /internal/ingest` FastAPI endpoint accepting `{ document_id: UUID }`
    - Return `{ chunks_created: int, failed_pages: [{page, reason}] }`
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 11.3_

  - [ ]* 9.7 Write unit tests for ingestion orchestrator
    - Test duplicate checksum detection, status transitions, failed page logging
    - _Requirements: 4.5, 4.6, 11.3_

- [x] 10. Curriculum upload — API gateway and Admin UI
  - [x] 10.1 Implement curriculum upload API endpoints in Node.js
    - `POST /api/v1/admin/curriculum/upload` — accept multipart PDF; store file; insert `curriculum_documents` row; call `POST /internal/ingest` on Python service asynchronously
    - `GET /api/v1/admin/curriculum/:doc_id/status` — return ingestion status + chunk count + failed pages
    - `GET /api/v1/admin/curriculum/:doc_id/chunks` — paginated list of chunks for verification
    - Prompt Admin to confirm replacement when a document already exists for the class (Req 4.8)
    - _Requirements: 4.1, 4.5, 4.8_

  - [x] 10.2 Build Admin Curriculum Upload UI
    - Drag-and-drop PDF upload zone; shows file name and size before upload
    - Class selector dropdown
    - Replacement confirmation modal when existing document detected
    - Ingestion progress indicator (polling `status` endpoint every 3s)
    - On completion: show "X chunks created, Y pages failed" summary
    - _Requirements: 4.1, 4.5, 4.8_

- [x] 11. School calendar configuration and day plan generation
  - [x] 11.1 Implement calendar API endpoints
    - `POST /api/v1/admin/calendar` — create/update `school_calendar` row (working days, start/end date, holidays)
    - `POST /api/v1/admin/calendar/generate-plans` — call `POST /internal/generate-plans` on Python service
    - `POST /api/v1/admin/calendar/absence` — mark teacher absent; call `POST /internal/carry-forward`
    - _Requirements: 5.2, 5.3, 5.5_

  - [x] 11.2 Implement day plan generation in Python AI service
    - `planner_service.py`: fetch chunks ordered by `chunk_index`; fetch working days excluding holidays; compute `chunks_per_day = ceil(total / working_days)`; insert `day_plans` rows
    - `POST /internal/generate-plans` FastAPI endpoint
    - _Requirements: 5.1, 5.3, 5.4_

  - [ ]* 11.3 Write property test for day plan generation
    - **Property 4: Every curriculum chunk appears in exactly one day plan (no gaps, no duplicates)**
    - **Validates: Requirements 5.1**

  - [ ]* 11.4 Write property test for calendar boundary conditions
    - **Property 5: No day plan is generated for a holiday or non-working day**
    - **Validates: Requirements 5.2, 5.3**

  - [x] 11.5 Implement carry-forward logic
    - `carry_forward_pending(day_plan_chunk_ids, coverage_results)`: prepend `pending`/`partial` chunks to next working day's `chunk_ids`; set source plan `status = carried_forward`
    - `POST /internal/carry-forward` FastAPI endpoint
    - Absence handling: set `day_plan.status = carried_forward`; prepend all chunk_ids to next working day
    - _Requirements: 5.5, 5.6_

  - [x] 11.6 Build Admin Calendar Config UI
    - Working days checkboxes (Mon–Fri)
    - Academic year date range picker
    - Holiday date picker (multi-select)
    - "Generate Plans" button; shows confirmation with total working days and chunks/day estimate
    - _Requirements: 5.2, 5.3_

- [x] 12. Checkpoint — Ingestion and planning pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. AI query pipeline — Python AI service
  - [x] 13.1 Implement LLM client abstraction
    - `llm_client.py`: abstract `LLMClient` base class with `async generate(prompt) -> str`
    - `OllamaClient` implementation calling `http://localhost:11434/api/generate`
    - FastAPI dependency injection: `get_llm_client()` returns `OllamaClient` by default
    - _Requirements: 6.1, 6.5, 8.1, 8.2_

  - [x] 13.2 Implement prompt templates
    - `prompts.py`: define `DAILY_PLAN_PROMPT`, `COVERAGE_SUMMARY_PROMPT`, `ACTIVITY_HELP_PROMPT`, `PRINCIPAL_PROGRESS_PROMPT` as per design
    - _Requirements: 6.1, 6.2, 8.2, 10.1_

  - [x] 13.3 Implement RAG retrieval and query pipeline
    - `query_pipeline.py`: embed query text; run constrained pgvector similarity search (filtered to teacher's class + day plan chunk IDs); build prompt from top-k chunks; call LLM; return response
    - SQL: `SELECT ... FROM curriculum_chunks WHERE class_id = $2 AND id = ANY($3) ORDER BY embedding <=> $1 LIMIT 10`
    - `POST /internal/query` FastAPI endpoint accepting `{ teacher_id, text, date, role }`
    - Route to appropriate prompt template based on query intent and role
    - Handle "no plan today" case (Req 6.6)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 8.1, 8.2, 8.3, 8.4, 10.1, 10.2, 10.3_

  - [ ]* 13.4 Write property test for RAG retrieval
    - **Property 6: Retrieved chunks are always from the teacher's own class (no cross-class leakage)**
    - **Validates: Requirements 1.2, 1.4**

  - [ ]* 13.5 Write unit tests for query pipeline
    - Test daily plan query, coverage summary query, activity help query, no-plan-today response
    - _Requirements: 6.1, 6.4, 6.6, 10.1, 10.2_

- [x] 14. AI query — Node.js proxy endpoint
  - Implement `POST /api/v1/ai/query` in Node.js API gateway
  - Inject `teacher_id` / `school_id` / `role` from JWT; forward to `POST /internal/query` on Python service
  - Cache responses in Redis with a short TTL (30s) keyed on `(user_id, query_hash, date)`
  - Apply `roleGuard(['teacher', 'principal'])` 
  - _Requirements: 6.1, 6.5, 8.1, 8.2_

- [x] 15. Coverage analyzer — Python AI service
  - [x] 15.1 Implement coverage analysis logic
    - `coverage_analyzer.py`: embed log text; fetch chunk embeddings for day plan; compute cosine similarity per chunk; assign `covered` (≥0.75) / `partial` (0.45–0.74) / `pending` (<0.45); flag log if all pending; insert `coverage_statuses`; trigger carry-forward
    - `POST /internal/analyze-coverage` FastAPI endpoint
    - _Requirements: 7.2, 7.3, 7.4, 7.6_

  - [ ]* 15.2 Write property test for coverage analyzer thresholds
    - **Property 7: A log that exactly reproduces a chunk's content always yields `covered` status**
    - **Validates: Requirements 7.2, 7.3**

  - [ ]* 15.3 Write property test for coverage flag condition
    - **Property 8: If all chunks score below 0.45, the log is flagged and no chunk is marked covered**
    - **Validates: Requirements 7.6**

- [x] 16. Coverage logging — API gateway and Teacher UI
  - [x] 16.1 Implement coverage log API endpoints
    - `POST /api/v1/teacher/coverage` — insert `coverage_logs` row; call `POST /internal/analyze-coverage`; return coverage status summary to teacher
    - `PUT /api/v1/teacher/coverage/:id` — allow edit within 24h of `submitted_at`; re-run analysis
    - `GET /api/v1/teacher/coverage/history` — paginated past logs for teacher's sections
    - Enforce one log per section per day (unique constraint; return 409 on duplicate)
    - _Requirements: 7.1, 7.4, 7.5_

  - [x] 16.2 Build Teacher Coverage Log UI
    - Textarea for free-text log entry; submit button
    - After submission: show confirmation card listing covered topics (green), partial (yellow), pending (red)
    - Edit button visible within 24h of submission
    - _Requirements: 7.1, 7.4, 7.5_

  - [ ]* 16.3 Write unit tests for coverage log endpoints
    - Test 24h edit window enforcement, duplicate log rejection, flagged log response
    - _Requirements: 7.5, 7.6_

- [x] 17. Teacher Planner UI
  - [x] 17.1 Implement teacher plan API endpoints
    - `GET /api/v1/teacher/plan/today` — return today's `day_plan` with chunk details and carried-forward items
    - `GET /api/v1/teacher/plan/:date` — plan for a specific date
    - _Requirements: 6.1, 6.3_

  - [x] 17.2 Build Teacher Planner page
    - Left panel: today's Day_Plan — chunk cards showing `topic_label`, `activity_ids`, status badge (`scheduled` / `carried_forward` in yellow)
    - Right panel: AI chat interface — message thread, input box, send button; calls `POST /api/v1/ai/query`
    - Bottom: Coverage Log form (from task 16.2)
    - Pending/carried-forward chunks shown with amber "Carried Forward" badge
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1_

  - [ ]* 17.3 Write unit tests for teacher plan endpoints
    - Test today's plan retrieval, carried-forward chunk inclusion
    - _Requirements: 6.1, 6.3_

- [x] 18. Checkpoint — Teacher-facing features
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Principal dashboard
  - [x] 19.1 Implement principal dashboard API endpoints
    - `GET /api/v1/principal/dashboard` — all sections with `completion_pct` (covered chunks / total chunks), last coverage log date, behind-schedule flag (>5 working days behind)
    - `GET /api/v1/principal/sections/:id/timeline` — day plans + coverage logs + pending chunks for a section
    - `GET /api/v1/principal/inactive` — sections with no coverage logs for >3 consecutive working days
    - _Requirements: 8.2, 8.4, 8.5, 9.1, 9.2, 9.5_

  - [x] 19.2 Build Principal Dashboard page
    - Grid of Class → Section cards: completion % progress bar, last log date, behind-schedule amber/red highlight (Req 9.2)
    - Auto-refresh every 30 seconds using SWR polling (Req 9.4)
    - Click section → timeline view: calendar grid with day plan and coverage log per day
    - AI chat panel (same component as Teacher, principal context)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 19.3 Write unit tests for principal dashboard endpoints
    - Test completion percentage calculation, behind-schedule detection, inactive section flagging
    - _Requirements: 8.4, 8.5, 9.1, 9.2_

  - [ ]* 19.4 Write property test for completion percentage
    - **Property 9: Completion percentage is always in [0, 100] and equals covered_chunks / total_chunks × 100**
    - **Validates: Requirements 8.4**

- [x] 20. Extensible roles API
  - Implement `GET /api/v1/admin/roles` returning all roles for the school with their `permissions` JSONB
  - Seed default roles (`admin`, `principal`, `teacher`) with permission sets on school creation
  - Ensure `roleGuard` reads permissions from DB (via JWT claims) rather than hard-coded strings
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 21. PWA configuration
  - Add `manifest.json` with app name "Oakit.ai", `theme_color: #1B4332`, `background_color: #F9FAFB`, icons at 192×192 and 512×512
  - Configure `next-pwa` in `next.config.js` with a service worker for offline caching of static assets
  - Ensure all pages are responsive (mobile-first Tailwind breakpoints)
  - _Requirements: (Phase 1 PWA recommendation from Out of Scope section)_

- [x] 22. Integration wiring and end-to-end validation
  - [x] 22.1 Wire all Node.js routes to Python AI service with proper error handling
    - Ensure all `/internal/*` calls from Node.js include `school_id` in request body for AI service validation
    - Add circuit-breaker / timeout handling for Python service calls (30s timeout per design)
    - _Requirements: 1.2, 6.5_

  - [x] 22.2 Seed script for Silveroak Juniors initial data
    - Create seed SQL/script: school record, default roles with permissions, admin user, classes (LKG, UKG, Prep1, Prep2)
    - _Requirements: 1.3_

  - [ ]* 22.3 Write integration tests for critical flows
    - Test: upload PDF → ingest → generate plans → teacher views plan → submits coverage log → principal sees updated dashboard
    - _Requirements: 4.1–4.7, 5.1–5.4, 7.1–7.4, 9.1_

- [x] 23. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints at tasks 8, 12, 18, and 23 ensure incremental validation
- Property tests validate universal correctness properties (round-trip integrity, school isolation, threshold behavior)
- Unit tests validate specific examples and edge cases
- The LLM client abstraction (task 13.1) means switching from Ollama to OpenAI requires only one dependency override change

# Implementation Plan: Smart Curriculum Planning

## Overview

Implement the five smart curriculum planning capabilities across four layers: PostgreSQL migration, Python AI service, TypeScript API gateway, and Next.js admin UI. Tasks are ordered so each step builds on the previous, with integration wired at the end.

## Tasks

- [x] 1. Database migration
  - Create `oakit/db/migrations/017_smart_curriculum_planning.sql`
  - Drop the `special_days_day_type_check` CHECK constraint
  - Add `duration_type TEXT NOT NULL DEFAULT 'full_day' CHECK (duration_type IN ('full_day','half_day'))` to `special_days`
  - Add `revision_topics TEXT[] DEFAULT '{}'` to `special_days`
  - Add `carry_forward_fragment TEXT` to `day_plans`
  - _Requirements: 2.3, 2.6, 3.5, 4.1_

- [x] 2. API gateway — special-days endpoint updates
  - [x] 2.1 Add `duration_type` and `revision_topics` validation and persistence in the POST `/:year/special-days` handler in `oakit/apps/api-gateway/src/routes/calendar.ts`
    - Validate `day_type` against `/^[a-zA-Z0-9_-]{1,50}$/`; return HTTP 400 on failure
    - Validate each `revision_topics` entry is ≤ 200 chars; return HTTP 400 on failure
    - Persist `duration_type` (default `'full_day'`) and `revision_topics` to `special_days`
    - _Requirements: 2.7, 2.8, 4.1, 4.5_

  - [ ]* 2.2 Write property test for `day_type` validation (P3 & P4)
    - **Property 3: day_type validation round-trip** — generate valid strings matching `/^[a-zA-Z0-9_-]{1,50}$/`; POST then GET; assert round-trip equality
    - **Property 4: Invalid day_type rejection** — generate strings violating length or charset; assert HTTP 400
    - Use fast-check in `oakit/apps/api-gateway/src/routes/calendar.test.ts`
    - **Validates: Requirements 2.1, 2.2, 2.7, 2.8**

  - [ ]* 2.3 Write property test for `revision_topics` validation (P7 & P8)
    - **Property 7: Revision topics round-trip** — generate random topic lists (each ≤ 200 chars); POST then GET; assert ordered equality
    - **Property 8: Revision topic length rejection** — generate strings > 200 chars; assert HTTP 400
    - **Validates: Requirements 4.1, 4.5**

- [x] 3. API gateway — plan-summary endpoint
  - [x] 3.1 Implement `GET /api/v1/admin/calendar/plan-summary` in `calendar.ts`
    - Query `school_calendar`, `holidays`, `special_days`, and `curriculum_chunks` for the given `class_id`, `academic_year`, and optional `month`/`plan_year`
    - Compute `net_curriculum_days = working_days - full_day_count + 0.5 * half_day_count`
    - Compute `fit` as `'exact'` | `'under'` | `'over'` and a `recommendation` string
    - Return `special_day_breakdown` keyed by `day_type` with `full_day` and `half_day` sub-counts
    - Handle zero-chunks case: return `{ total_chunks: 0, fit: 'under', recommendation: "No curriculum uploaded for this class." }`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.8_

  - [ ]* 3.2 Write property tests for plan-summary (P1 & P2)
    - **Property 1: net_curriculum_days formula** — generate random calendar configs; assert `net_curriculum_days == working - full + 0.5 * half`
    - **Property 2: fit classification** — generate random `(chunks, net_days)` pairs; assert `fit` matches arithmetic comparison
    - Use fast-check in `calendar.test.ts`
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5**

- [x] 4. API gateway — coverage-report endpoint
  - [x] 4.1 Implement `GET /api/v1/admin/calendar/coverage-report` in `calendar.ts`
    - Query `day_plans` for the given `class_id`, `section_id`, `academic_year`
    - Detect cycled days: collect `chunk_ids` in chronological order; flag any date whose chunks all appeared on an earlier date
    - Compute per-month status: `has_curriculum`, `special_only`, or `no_working_days`
    - Return empty arrays when no plans exist
    - _Requirements: 5.2, 5.3, 5.6, 5.7_

  - [ ]* 4.2 Write property tests for coverage report (P9 & P10)
    - **Property 9: cycled-day detection** — generate day-plan sequences with repeated chunk UUIDs; assert all post-first occurrences appear in `cycled_days`
    - **Property 10: month status correctness** — generate random month ranges with mixed plan states; assert every month has the correct status
    - Use fast-check in `calendar.test.ts`
    - **Validates: Requirements 5.2, 5.3, 5.7**

- [ ] 5. Checkpoint — Ensure all API gateway tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. AI service — half-day logic in planner_service.py
  - [x] 6.1 Split `special_day_set` into `full_day_set` and `half_day_set` in `generate_plans`
    - Include half-day dates in `all_curriculum_days` (they receive content)
    - Advance chunk index by 0.5 for half-days, by 1 for full curriculum days
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 6.2 Implement `_split_chunk(content: str) -> tuple[str, str]` helper
    - Split at `len(content) // 2`
    - _Requirements: 3.1_

  - [x] 6.3 Implement half-day plan writing
    - On a half-day: write first half to current day's `chunk_ids`; write first-half text as `carry_forward_fragment` on current day; prepend second-half text as `carry_forward_fragment` on next working day
    - When no next working day exists: store fragment with `status = 'carried_forward'` and log a warning
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 6.4 Implement cross-month carry-forward
    - Before starting monthly generation, read `carry_forward_fragment` from the last `day_plan` of the preceding month
    - Prepend it to the first working day of the new month
    - _Requirements: 3.6_

  - [ ]* 6.5 Write property tests for half-day logic (P5 & P6)
    - **Property 5: Half-day chunk conservation** — generate random chunk lists with half-day positions; assert total character count of assigned content equals total character count of original chunks
    - **Property 6: Half-day carry-forward round-trip** — generate random plan inputs with half-days; run generation twice; assert idempotent `chunk_ids` and `carry_forward_fragment` values
    - Use Hypothesis in `oakit/apps/ai-service/test_planner_service.py` with an in-memory mock DB pool
    - **Validates: Requirements 3.1, 3.2, 3.7**

- [x] 7. AI service — revision topics in query_pipeline.py
  - Update `_build_day_context` to append `"Revision topics for today: {topics}"` when `day_type == 'revision'` and `revision_topics` is non-empty
  - Update `SELECT` queries in `generate_plans` and the `special_day` fetch to include `revision_topics`
  - _Requirements: 4.3, 4.4_

- [ ] 8. Checkpoint — Ensure all AI service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Admin UI — extended event type selector
  - [x] 9.1 Extend `DAY_TYPE_CONFIG` in the admin calendar page with all predefined types and their default labels
    - Add a "Custom" option that reveals a free-text input for `day_type`
    - Pre-populate the label field when a predefined type is selected
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 9.2 Add `duration_type` toggle (Full Day / Half Day) to the special-day form
    - Default to `full_day`
    - _Requirements: 2.3_

  - [x] 9.3 Add revision topics tag input
    - Show a multi-value tag input below the label field when `day_type === 'revision'`
    - Pressing Enter or comma adds a tag; tags are sent as `revision_topics: string[]`
    - _Requirements: 4.2_

- [x] 10. Admin UI — pre-generation summary modal
  - [x] 10.1 Create `PreGenerationModal` component
    - On "Generate Plans" click, call `GET /plan-summary` with current form values
    - Render total chunks, working days, special-day breakdown, net curriculum days, fit status, and recommendation
    - Provide "Proceed" and "Cancel" buttons
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 10.2 Wire `PreGenerationModal` into the admin calendar page
    - On "Proceed", fire the existing `POST /generate-plans` request
    - On "Cancel", close modal without submitting
    - _Requirements: 1.6, 1.7_

- [x] 11. Admin UI — post-generation coverage report
  - [x] 11.1 Create `CoverageReport` component
    - After `POST /generate-plans` returns success, call `GET /coverage-report`
    - Render month-by-month status table (green = `has_curriculum`, amber = `special_only`, grey = `no_working_days`)
    - List cycled dates with a ♻️ indicator
    - Show suggestions when cycling occurred or empty months exist
    - Provide a "Dismiss" button that returns to normal calendar state without losing form values
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.8_

  - [x] 11.2 Wire `CoverageReport` into the admin calendar page
    - Display after successful generation; dismiss returns to calendar state
    - _Requirements: 5.1, 5.8_

- [ ] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check (TypeScript) and Hypothesis (Python)
- The in-memory mock DB pool for P5/P6 avoids requiring a live database during CI

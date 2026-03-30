# Requirements Document

## Introduction

Smart Curriculum Planning enhances the Oakit school management system's existing plan generation workflow with five capabilities: a pre-generation summary modal that shows admins how curriculum chunks map to available days; an extended set of school event types (both predefined and custom) beyond the current four; half-day event handling that splits curriculum chunks and carries the remainder forward; smart revision day topic tagging for AI-assisted teacher guidance; and a post-generation coverage analysis report. These features build on the existing `planner_service.py`, `special_days` table, `day_plans` table, and the admin calendar page.

---

## Glossary

- **Planner_Service**: The Python FastAPI service (`planner_service.py`) responsible for distributing curriculum chunks across working days.
- **Admin**: A school administrator with access to the admin calendar page.
- **Special_Day**: A school working day stored in the `special_days` table where normal curriculum assignment is modified or skipped.
- **Curriculum_Chunk**: A single unit of curriculum content stored in the `curriculum_chunks` table, identified by a UUID.
- **Day_Plan**: A record in the `day_plans` table associating a section, date, and list of chunk UUIDs.
- **Working_Day**: A calendar date that falls on a configured school working day and is not a holiday.
- **Net_Curriculum_Day**: A working day that is not a full-day special day and therefore receives curriculum chunks.
- **Half_Day**: A special day marked with `duration_type = 'half_day'`, where the day receives half the normal curriculum chunk split at its midpoint.
- **Full_Day**: A special day marked with `duration_type = 'full_day'`, where no curriculum chunk is assigned.
- **Coverage_Report**: A post-generation summary showing which months have curriculum, which are empty, and which days have cycled (repeated) chunks.
- **Pre_Generation_Summary**: A modal displayed to the Admin before plan generation, summarising curriculum vs. available day counts.
- **Cycle**: The behaviour where the Planner_Service wraps back to the first chunk after exhausting all chunks, repeating content.
- **Revision_Topic**: An optional text tag on a revision special day indicating which subject areas to revisit.
- **AI_Assistant**: The Python FastAPI AI service that answers teacher queries using curriculum context.

---

## Requirements

### Requirement 1: Pre-Generation Summary Modal

**User Story:** As an Admin, I want to see a summary of curriculum chunks versus available days before generating plans, so that I can make an informed decision about whether to proceed.

#### Acceptance Criteria

1. WHEN the Admin selects a class and clicks "Generate Plans", THE Admin_UI SHALL display a Pre_Generation_Summary modal before submitting the generation request.
2. THE Pre_Generation_Summary SHALL include: total curriculum chunk count, total working days in the selected range, a breakdown of special days by type (settling, revision, exam, and each custom event type) with their counts, the net curriculum days available (working days minus full-day special days, plus 0.5 per half-day special day), and whether the curriculum is shorter than or longer than the net curriculum days.
3. WHEN the curriculum chunk count is less than the net curriculum days, THE Pre_Generation_Summary SHALL display a recommendation stating that chunks will cycle and suggesting the Admin add more curriculum content.
4. WHEN the curriculum chunk count is greater than the net curriculum days, THE Pre_Generation_Summary SHALL display a recommendation stating that not all curriculum will be covered and suggesting the Admin add more special days or extend the calendar.
5. WHEN the curriculum chunk count equals the net curriculum days, THE Pre_Generation_Summary SHALL display a confirmation that curriculum fits exactly.
6. WHEN the Admin clicks "Proceed" in the Pre_Generation_Summary modal, THE Admin_UI SHALL submit the plan generation request to the API.
7. WHEN the Admin clicks "Cancel" in the Pre_Generation_Summary modal, THE Admin_UI SHALL close the modal without submitting any request.
8. THE API SHALL expose a GET endpoint `/api/v1/admin/calendar/plan-summary` that accepts `class_id`, `academic_year`, and optional `month` and `plan_year` parameters and returns the data required to populate the Pre_Generation_Summary.

---

### Requirement 2: Extended School Event Types

**User Story:** As an Admin, I want to use a richer set of event types for special days, so that the school calendar accurately reflects the variety of school activities.

#### Acceptance Criteria

1. THE Special_Day record SHALL support a `day_type` value from the following predefined set: `settling`, `revision`, `exam`, `event`, `sports_day`, `annual_day`, `cultural_day`, `field_trip`, `culminating_day`, `parent_teacher_meeting`.
2. THE Special_Day record SHALL support a `day_type` value that is a custom string provided by the Admin, subject to a maximum length of 50 characters and containing only alphanumeric characters, underscores, and hyphens.
3. THE Special_Day record SHALL include a `duration_type` field with allowed values `full_day` and `half_day`, defaulting to `full_day`.
4. WHEN the Admin adds a special day via the Admin_UI, THE Admin_UI SHALL present the predefined event types as selectable options and provide a text input for a custom event type.
5. WHEN the Admin selects a predefined event type, THE Admin_UI SHALL pre-populate the label field with a human-readable default name for that type.
6. THE database `special_days` table SHALL be migrated to remove the existing CHECK constraint on `day_type` and add the `duration_type` column with a CHECK constraint allowing only `full_day` and `half_day`.
7. THE API SHALL accept and store any `day_type` value that satisfies the rules in criteria 1 and 2.
8. IF the Admin submits a `day_type` value that exceeds 50 characters or contains disallowed characters, THEN THE API SHALL return a 400 error with a descriptive message.

---

### Requirement 3: Half-Day Event Handling

**User Story:** As an Admin, I want half-day events to receive partial curriculum so that teaching time on those days is not wasted.

#### Acceptance Criteria

1. WHEN a Special_Day has `duration_type = 'half_day'`, THE Planner_Service SHALL assign the first half of the curriculum chunk scheduled for that day (split at the chunk's midpoint by character count) to that day's Day_Plan.
2. WHEN a Special_Day has `duration_type = 'half_day'`, THE Planner_Service SHALL prepend the second half of the split chunk to the next Working_Day's Day_Plan.
3. WHEN computing the net curriculum days for plan generation, THE Planner_Service SHALL count each half-day Special_Day as 0.5 curriculum days consumed.
4. WHEN a half-day split produces a second half that must carry forward but no subsequent Working_Day exists in the range, THE Planner_Service SHALL store the carry-forward chunk fragment in the Day_Plan record with status `carried_forward` and log a warning.
5. THE `day_plans` table SHALL be extended with a `carry_forward_fragment` TEXT column to store partial chunk content that overflows from a half-day.
6. WHEN the Planner_Service generates plans for a monthly range, THE Planner_Service SHALL correctly account for half-day carry-forwards that cross month boundaries by reading any existing carry-forward fragment from the last Day_Plan of the preceding month.
7. FOR ALL valid plan generation inputs containing half-day special days, parsing the resulting Day_Plans and re-running generation SHALL produce equivalent chunk assignments (round-trip property).

---

### Requirement 4: Smart Revision Day Topic Tagging

**User Story:** As an Admin, I want to tag revision days with specific topic areas, so that the AI assistant can give teachers relevant guidance on revision day activities.

#### Acceptance Criteria

1. THE Special_Day record SHALL support an optional `revision_topics` TEXT[] column storing an ordered list of topic area strings, each with a maximum length of 200 characters.
2. WHEN the Admin adds or edits a special day with `day_type = 'revision'`, THE Admin_UI SHALL display a multi-value text input for entering revision topics.
3. WHEN `revision_topics` is provided on a revision Special_Day, THE AI_Assistant SHALL include those topics in the context passed to the language model when a teacher asks about that day's activities.
4. WHEN `revision_topics` is empty or null on a revision Special_Day, THE AI_Assistant SHALL respond to teacher queries about that day using general revision guidance without referencing specific topics.
5. IF the Admin submits a revision topic string exceeding 200 characters, THEN THE API SHALL return a 400 error with a descriptive message.
6. WHILE a teacher is viewing a revision day in the teacher dashboard, THE Admin_UI SHALL display the revision topics (if any) as read-only tags.

---

### Requirement 5: Post-Generation Coverage Report

**User Story:** As an Admin, I want to see a coverage report after generating plans, so that I can identify gaps, repetitions, and imbalances in the curriculum distribution.

#### Acceptance Criteria

1. WHEN plan generation completes successfully, THE Admin_UI SHALL display a Coverage_Report summarising the generated plans.
2. THE Coverage_Report SHALL list each calendar month in the generation range and indicate whether that month has curriculum-bearing days, only special days, or no working days.
3. THE Coverage_Report SHALL identify all Day_Plans where the assigned chunk UUIDs are repeated from an earlier date (cycled content) and display those dates with a visual indicator.
4. WHEN the curriculum chunk count is less than the net curriculum days and cycling has occurred, THE Coverage_Report SHALL display a suggestion to add more curriculum content.
5. WHEN one or more months contain no curriculum-bearing days, THE Coverage_Report SHALL display a suggestion to review special day assignments for those months.
6. THE API SHALL expose a GET endpoint `/api/v1/admin/calendar/coverage-report` that accepts `class_id`, `section_id`, and `academic_year` parameters and returns the coverage data required to populate the Coverage_Report.
7. THE Coverage_Report data returned by the API SHALL include: per-month status (`has_curriculum`, `special_only`, `no_working_days`), a list of cycled day dates with their chunk UUIDs, and the total count of unique chunks covered versus total chunks.
8. WHEN the Admin dismisses the Coverage_Report, THE Admin_UI SHALL return to the normal calendar page state without losing any previously entered form values.

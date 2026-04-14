# Requirements Document

## Introduction

Supplementary Activity Pools extends the Oakit school management system to support structured, non-curriculum learning programs such as public speaking, rhymes, storytelling, and sports. Schools define pools of activities and assignment rules per class; the system automatically distributes activities across working days, respects holidays and special events, rotates through activities without unnecessary repetition, and surfaces them in the teacher's daily planner as a separate section alongside the core curriculum. Teachers retain full flexibility to skip, replace, or mark activities as completed, and the system honours those overrides without affecting core curriculum plans.

---

## Glossary

- **Activity_Pool**: A named group of related supplementary activities belonging to a school (e.g. "English Rhymes", "Public Speaking"). Stored in the `activity_pools` table.
- **Activity**: A single supplementary learning item within an Activity_Pool (e.g. "Twinkle Twinkle", "Introduce Yourself"). Stored in the `activities` table.
- **Pool_Assignment**: A rule that binds an Activity_Pool to a specific Class with a frequency and date range. Stored in the `pool_assignments` table.
- **Supplementary_Plan**: A record associating a section, a date, and an Activity for a given Pool_Assignment. Stored in the `supplementary_plans` table.
- **Frequency_Mode**: Either `weekly` (one activity per calendar week) or `interval` (one activity every N days).
- **Scheduler**: The component (Python FastAPI AI service) responsible for computing and persisting Supplementary_Plans from Pool_Assignments.
- **Teacher**: A school user with the `teacher` role who views and acts on daily plans.
- **Admin**: A school user with the `admin` role who manages pools, activities, and assignment rules.
- **Working_Day**: A calendar date that falls on a configured school working day and is not a holiday.
- **Blocked_Day**: A date that is a holiday (in the `holidays` table) or a special day (in the `special_days` table); the Scheduler must never assign a Supplementary_Plan to a Blocked_Day.
- **Day_Load**: The count of Supplementary_Plans already assigned to a given date across all Pool_Assignments for a section.
- **Activity_Rotation**: The ordered cycle through all Activities in a pool; the next activity is selected only after all others have been used; the cycle then restarts.
- **Override**: A teacher action (skip, replace, or complete) recorded against a Supplementary_Plan that the Scheduler must not overwrite.
- **Planner_Section**: The dedicated supplementary activities section rendered in the teacher's daily planner UI, separate from core curriculum chunks.

---

## Requirements

### Requirement 1: Activity Pool Management

**User Story:** As an Admin, I want to create and manage activity pools with named activities, so that I can organise supplementary learning content for my school.

#### Acceptance Criteria

1. THE Admin_UI SHALL provide a page for managing Activity_Pools scoped to the Admin's school.
2. WHEN the Admin creates an Activity_Pool, THE System SHALL persist a record with a unique name (per school), an optional description, and a language tag (e.g. "English", "Kannada", "Hindi", "None").
3. IF the Admin submits an Activity_Pool name that already exists for the same school, THEN THE API SHALL return a 400 error with a message indicating the name is already taken.
4. WHEN the Admin adds an Activity to an Activity_Pool, THE System SHALL persist the activity with a title (maximum 200 characters), an optional description, and an ordered position within the pool.
5. THE Admin_UI SHALL allow the Admin to reorder Activities within a pool by dragging or using up/down controls; THE System SHALL persist the updated order.
6. WHEN the Admin deletes an Activity that has no associated Supplementary_Plans, THE System SHALL permanently remove the Activity.
7. IF the Admin attempts to delete an Activity that has one or more associated Supplementary_Plans, THEN THE API SHALL return a 409 error and THE Admin_UI SHALL display a message explaining that the activity is in use.
8. WHEN the Admin deletes an Activity_Pool, THE System SHALL cascade-delete all Activities and Pool_Assignments belonging to that pool.
9. THE System SHALL support a minimum of 1 and a maximum of 200 Activities per Activity_Pool.
10. IF the Admin submits an Activity title exceeding 200 characters, THEN THE API SHALL return a 400 error with a descriptive message.

---

### Requirement 2: Pool Assignment Rules

**User Story:** As an Admin, I want to assign activity pools to specific classes with a frequency and date range, so that the system knows when and how often to schedule each pool's activities.

#### Acceptance Criteria

1. WHEN the Admin creates a Pool_Assignment, THE System SHALL persist: the Activity_Pool, the target Class, the Frequency_Mode (`weekly` or `interval`), the interval value N (required when Frequency_Mode is `interval`; minimum 1, maximum 30 days), the start date, and the end date.
2. IF the Admin submits a Pool_Assignment with an end date earlier than or equal to the start date, THEN THE API SHALL return a 400 error with a descriptive message.
3. IF the Admin submits a Pool_Assignment with Frequency_Mode `interval` and no interval value, THEN THE API SHALL return a 400 error with a descriptive message.
4. THE System SHALL allow multiple Pool_Assignments for the same Activity_Pool targeting different Classes.
5. THE System SHALL allow multiple Pool_Assignments for the same Class targeting different Activity_Pools.
6. WHEN the Admin updates a Pool_Assignment's frequency, start date, or end date, THE System SHALL mark all future (unoveridden) Supplementary_Plans for that assignment as stale and require re-scheduling.
7. WHEN the Admin deletes a Pool_Assignment, THE System SHALL soft-delete the assignment and retain historical Supplementary_Plans for audit purposes.
8. THE Admin_UI SHALL display all Pool_Assignments for a school grouped by Class, showing the pool name, frequency, and date range.

---

### Requirement 3: Automatic Activity Distribution (Scheduling)

**User Story:** As an Admin, I want the system to automatically distribute activities across working days based on assignment rules, so that teachers always have a prepared supplementary plan without manual effort.

#### Acceptance Criteria

1. WHEN the Admin triggers scheduling for a Pool_Assignment (or scheduling runs automatically after assignment creation), THE Scheduler SHALL generate Supplementary_Plans for all sections of the target Class within the assignment's date range.
2. THE Scheduler SHALL never assign a Supplementary_Plan to a Blocked_Day.
3. WHEN Frequency_Mode is `weekly`, THE Scheduler SHALL assign exactly one Activity per calendar week per section, selecting the Working_Day within that week that has the lowest Day_Load; ties SHALL be broken by preferring earlier days in the week.
4. WHEN Frequency_Mode is `interval`, THE Scheduler SHALL assign one Activity every N Working_Days per section, counting only Working_Days (not calendar days).
5. THE Scheduler SHALL select Activities using Activity_Rotation: activities are assigned in order; after the last activity is used, the rotation restarts from the first.
6. THE Scheduler SHALL maintain a per-section, per-pool rotation cursor so that each section's rotation is independent.
7. WHEN re-scheduling a Pool_Assignment after an update, THE Scheduler SHALL preserve all existing Supplementary_Plans that have an Override and only regenerate plans without an Override.
8. THE Scheduler SHALL distribute activities such that no single Working_Day receives more than 3 Supplementary_Plans across all Pool_Assignments for a section.
9. IF all Working_Days in a week (for weekly mode) or the target interval day (for interval mode) are Blocked_Days, THEN THE Scheduler SHALL skip that occurrence and log a warning; THE System SHALL NOT carry the missed activity forward automatically unless the Admin enables the carry-forward option on the Pool_Assignment.
10. FOR ALL valid Pool_Assignments, running the Scheduler twice on the same input SHALL produce identical Supplementary_Plans (idempotency property).

---

### Requirement 4: Activity Rotation and Continuity

**User Story:** As an Admin, I want activities to rotate evenly without unnecessary repetition, so that children experience variety and the schedule remains predictable.

#### Acceptance Criteria

1. THE Scheduler SHALL not assign the same Activity to the same section on consecutive scheduled dates for the same pool.
2. WHEN all Activities in a pool have been assigned at least once for a section, THE Scheduler SHALL restart the rotation from the first Activity in the pool's ordered list.
3. THE System SHALL persist the rotation cursor (index of the next Activity to assign) per section per Pool_Assignment so that continuity is maintained across re-scheduling runs and month boundaries.
4. WHEN an Admin adds a new Activity to a pool that already has active Supplementary_Plans, THE System SHALL insert the new Activity into the rotation at its configured position without disrupting already-scheduled plans.
5. WHEN an Admin reorders Activities in a pool, THE System SHALL apply the new order to future Supplementary_Plans only; already-scheduled plans SHALL retain their original Activity assignment.
6. FOR ALL sections with at least one complete rotation cycle, the count of Supplementary_Plans per Activity SHALL differ by at most 1 across all Activities in the pool (balanced distribution property).

---

### Requirement 5: Non-Interference with Core Curriculum

**User Story:** As an Admin, I want supplementary activities to be completely separate from core curriculum plans, so that the existing curriculum distribution is never disrupted.

#### Acceptance Criteria

1. THE Scheduler SHALL write Supplementary_Plans only to the `supplementary_plans` table and SHALL NOT modify the `day_plans` table or any `chunk_ids` values.
2. WHEN the Planner_Service generates or regenerates core curriculum Day_Plans, THE Planner_Service SHALL NOT read from or write to the `supplementary_plans` table.
3. THE API endpoint `/api/v1/teacher/plan/today` SHALL return core curriculum chunks and supplementary activities in separate, clearly labelled fields in the response payload.
4. WHEN a holiday or special day is added and the carry-forward logic runs for core curriculum, THE System SHALL NOT alter any Supplementary_Plans for that date; supplementary scheduling is handled independently.
5. THE database `supplementary_plans` table SHALL use a foreign key to `sections` and `activities` but SHALL have no foreign key dependency on `day_plans` or `curriculum_chunks`.

---

### Requirement 6: Teacher Planner Integration

**User Story:** As a Teacher, I want to see today's supplementary activities in my daily planner as a separate section, so that I know what to conduct alongside the core curriculum.

#### Acceptance Criteria

1. WHEN a Teacher opens the daily planner, THE Planner_Section SHALL display all Supplementary_Plans assigned to the Teacher's section for that date, grouped by Activity_Pool name.
2. THE Planner_Section SHALL show for each activity: the pool name, the activity title, and an optional description.
3. THE Planner_Section SHALL be visually distinct from the core curriculum section (different background colour or label).
4. WHEN there are no Supplementary_Plans for the current date, THE Planner_Section SHALL display a message indicating no supplementary activities are scheduled for today.
5. WHEN a Teacher marks a Supplementary_Plan as completed, THE System SHALL record the completion with a timestamp and the Teacher's user ID and SHALL NOT reschedule that activity for the same date.
6. WHEN a Teacher skips a Supplementary_Plan, THE System SHALL record the skip with a reason (optional free text, maximum 200 characters) and SHALL mark the plan status as `skipped`.
7. WHEN a Teacher replaces a Supplementary_Plan with a different Activity from the same pool, THE System SHALL record the replacement Override and persist the new Activity against that date.
8. WHILE a Supplementary_Plan has an Override (completed, skipped, or replaced), THE Scheduler SHALL NOT overwrite that plan during any re-scheduling run.
9. THE API SHALL expose a GET endpoint `/api/v1/teacher/plan/today` that includes a `supplementary_activities` array in its response, each item containing: `plan_id`, `pool_name`, `activity_title`, `activity_description`, `status`, and `override_note`.

---

### Requirement 7: Teacher Override Handling

**User Story:** As a Teacher, I want to skip, replace, or complete supplementary activities, so that I can adapt the plan to real classroom conditions without losing the structured schedule.

#### Acceptance Criteria

1. THE Teacher_UI SHALL provide controls on each Supplementary_Plan card to: mark as completed, skip with an optional note, or replace with another Activity from the same pool.
2. WHEN the Teacher selects "Replace", THE Teacher_UI SHALL display a list of other Activities in the same pool (excluding the currently assigned Activity) for the Teacher to choose from.
3. WHEN the Teacher submits a replacement, THE System SHALL update the Supplementary_Plan's activity reference and set the Override flag to `replaced`.
4. WHEN the Teacher submits a skip, THE System SHALL set the Supplementary_Plan status to `skipped` and store the optional note.
5. WHEN the Teacher marks a plan as completed, THE System SHALL set the status to `completed` and record the completion timestamp.
6. IF the Teacher submits a skip note exceeding 200 characters, THEN THE API SHALL return a 400 error with a descriptive message.
7. THE System SHALL allow a Teacher to undo a skip or completion Override on the same calendar day it was submitted, reverting the plan to `scheduled` status.
8. WHEN a Teacher undoes an Override, THE System SHALL clear the Override flag and restore the original Activity assignment.

---

### Requirement 8: Missed Activity Handling

**User Story:** As an Admin, I want to configure what happens when a scheduled supplementary activity is missed due to a blocked day, so that the schedule recovers gracefully.

#### Acceptance Criteria

1. THE Pool_Assignment record SHALL include a boolean `carry_forward_on_miss` field (default `false`).
2. WHEN `carry_forward_on_miss` is `true` and a scheduled occurrence falls on a Blocked_Day, THE Scheduler SHALL move the Supplementary_Plan to the next available Working_Day for that section.
3. WHEN `carry_forward_on_miss` is `false` and a scheduled occurrence falls on a Blocked_Day, THE Scheduler SHALL skip that occurrence and advance the rotation cursor as if the activity had been assigned.
4. WHEN a Supplementary_Plan is carried forward, THE System SHALL record the original intended date on the plan record for audit purposes.
5. WHEN carrying forward would place two Supplementary_Plans from the same pool on the same day for the same section, THE Scheduler SHALL instead place the carried-forward plan on the next Working_Day that does not already have a plan from that pool.
6. THE Admin_UI SHALL display the `carry_forward_on_miss` toggle on the Pool_Assignment form with a clear label.

---

### Requirement 9: Admin Visibility and Reporting

**User Story:** As an Admin, I want to view the supplementary activity schedule across classes and pools, so that I can verify coverage and identify gaps.

#### Acceptance Criteria

1. THE Admin_UI SHALL provide a supplementary schedule view showing a monthly calendar grid per class, with each day's assigned supplementary activities listed by pool.
2. THE Admin_UI SHALL visually distinguish days with no supplementary activities, days with activities scheduled, and days with all activities completed.
3. THE API SHALL expose a GET endpoint `/api/v1/admin/supplementary/schedule` that accepts `class_id`, `month`, and `year` parameters and returns all Supplementary_Plans for all sections of that class in the given month, including status and override information.
4. THE Admin_UI SHALL display a per-pool summary showing: total activities in the pool, number of times each activity has been assigned in the current academic year, and the current rotation position.
5. WHEN the Admin views the schedule, THE Admin_UI SHALL highlight any days where the Day_Load limit of 3 supplementary activities has been reached.
6. THE API SHALL expose a GET endpoint `/api/v1/admin/supplementary/pools/:pool_id/summary` returning the assignment count per activity and the current rotation cursor per section.

---

### Requirement 10: Data Integrity and Constraints

**User Story:** As a system operator, I want the supplementary activity data model to enforce consistency rules, so that the schedule remains coherent even under concurrent updates.

#### Acceptance Criteria

1. THE `supplementary_plans` table SHALL enforce a UNIQUE constraint on `(section_id, pool_assignment_id, plan_date)` to prevent duplicate plans for the same pool on the same day for the same section.
2. THE `pool_assignments` table SHALL enforce a UNIQUE constraint on `(activity_pool_id, class_id)` to prevent duplicate assignment rules for the same pool and class combination.
3. THE `activities` table SHALL enforce a UNIQUE constraint on `(activity_pool_id, title)` to prevent duplicate activity titles within the same pool.
4. WHEN the Scheduler runs concurrently for multiple sections of the same class, THE System SHALL use database-level locking or upsert semantics to prevent duplicate Supplementary_Plan records.
5. THE System SHALL cascade-delete all Supplementary_Plans when their parent Pool_Assignment is hard-deleted.
6. THE System SHALL cascade-delete all Supplementary_Plans when their parent Activity is deleted (only permitted when no plans exist, per Requirement 1 criterion 7).
7. FOR ALL Supplementary_Plans, the `plan_date` SHALL fall within the `start_date` and `end_date` of the parent Pool_Assignment (inclusive).

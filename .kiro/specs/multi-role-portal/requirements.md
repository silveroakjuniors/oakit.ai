# Requirements Document

## Introduction

The Multi-Role Portal feature extends the Oakit school management platform with three role improvements:

1. **Super Admin (new role)** — a platform-level administrator who manages multiple schools without being tied to any single school. Super admins can create, configure, activate/deactivate schools, impersonate school admin contexts, and view platform-wide statistics.

2. **Principal (improved)** — the existing principal role gains attendance oversight, teacher activity monitoring, class-wise curriculum coverage reporting, the ability to view any teacher's daily plan, section flagging, and a school-context-aware AI assistant.

3. **Parent (improved)** — the existing parent role gains a daily activity feed, 30-day attendance history, completion notifications, visibility into settling/special day activities, and a curriculum progress indicator.

---

## Glossary

- **Super_Admin**: A platform-level user not scoped to any single school, responsible for managing all schools on the Oakit platform.
- **Principal**: A school-scoped user who oversees all classes, teachers, and curriculum progress within their school.
- **Parent**: A school-scoped user linked to one or more students, who monitors their child's attendance, curriculum coverage, and daily activities.
- **School**: A tenant on the Oakit platform, represented by a row in the `schools` table with fields: id, name, subdomain, contact, created_at, status, plan_type.
- **Platform**: The Oakit multi-tenant SaaS system hosting all schools.
- **Impersonation**: The act of a Super_Admin entering a school's admin context to perform configuration on behalf of that school.
- **Section**: A class subdivision (e.g., Grade 5 — Section A) that has a class teacher and a curriculum plan.
- **Daily_Completion**: A record in `daily_completions` submitted by a teacher indicating which curriculum chunks were covered on a given date, optionally including a settling day note.
- **Attendance_Record**: A row in `attendance_records` indicating whether a student was present or absent on a given date.
- **Curriculum_Coverage**: The percentage of total curriculum chunks that have been marked as completed for a section.
- **Plan_Type**: A subscription tier assigned to a school (e.g., basic, standard, premium).
- **Settling_Day**: A non-curriculum school day (e.g., orientation, sports day) recorded as a special day with a teacher-submitted note.
- **Flag**: A marker placed by a Principal on a section indicating it requires attention.
- **Teacher_Activity**: Whether a teacher has submitted a Daily_Completion record for today.
- **AI_Assistant**: The AI chat interface powered by the query pipeline, which answers questions about school context.

---

## Requirements

### Requirement 1: Super Admin — School Listing

**User Story:** As a Super Admin, I want to view all schools on the platform, so that I can monitor the overall state of the platform.

#### Acceptance Criteria

1. THE Super_Admin SHALL be able to retrieve a list of all schools on the Platform, including each school's name, status (active/inactive), plan_type, and created_at date.
2. WHEN the Super_Admin requests the school list, THE Platform SHALL return the list sorted by created_at descending by default.
3. WHEN no schools exist on the Platform, THE Platform SHALL return an empty list.
4. THE Super_Admin SHALL be able to filter the school list by status (active or inactive).
5. THE Super_Admin SHALL be able to search the school list by school name using a case-insensitive partial match.

---

### Requirement 2: Super Admin — School Creation

**User Story:** As a Super Admin, I want to create a new school on the platform, so that I can onboard new customers.

#### Acceptance Criteria

1. WHEN the Super_Admin submits a school creation request with name, address, contact, and plan_type, THE Platform SHALL create a new School record and return the created school's id and details.
2. IF the Super_Admin submits a school creation request with a missing required field (name, plan_type), THEN THE Platform SHALL return a 400 error with a descriptive message identifying the missing field.
3. IF the Super_Admin submits a school creation request with a name that already exists on the Platform, THEN THE Platform SHALL return a 409 conflict error.
4. WHEN a new School is created, THE Platform SHALL set the school's status to active by default.
5. WHEN a new School is created, THE Platform SHALL generate a unique subdomain derived from the school name.

---

### Requirement 3: Super Admin — School Configuration

**User Story:** As a Super Admin, I want to configure a school's academic settings and users, so that the school is ready for use.

#### Acceptance Criteria

1. WHEN the Super_Admin sets the academic year for a School, THE Platform SHALL create or update the school_calendar record for that school with the provided start_date, end_date, and working_days.
2. WHEN the Super_Admin uploads a curriculum document for a class within a School, THE Platform SHALL store the document and trigger the curriculum ingestion pipeline for that class.
3. WHEN the Super_Admin creates a user within a School, THE Platform SHALL create the user record scoped to that school_id with the specified role and send a setup invitation.
4. WHEN the Super_Admin lists users for a School, THE Platform SHALL return all users belonging to that school including their name, email, role, and is_active status.
5. IF the Super_Admin attempts to configure a School that does not exist, THEN THE Platform SHALL return a 404 error.

---

### Requirement 4: Super Admin — School Impersonation

**User Story:** As a Super Admin, I want to switch into any school's admin context, so that I can perform administrative tasks on behalf of that school.

#### Acceptance Criteria

1. WHEN the Super_Admin requests impersonation of a School, THE Platform SHALL issue a scoped JWT token with role set to admin and school_id set to the target school's id.
2. WHEN the Super_Admin is operating in an impersonated school context, THE Platform SHALL restrict all API calls to the scope of the impersonated school_id.
3. WHEN the Super_Admin exits impersonation, THE Platform SHALL invalidate the scoped token and restore the Super_Admin's original session.
4. IF the Super_Admin attempts to impersonate a School that is inactive, THEN THE Platform SHALL return a 403 error with a message indicating the school is inactive.
5. THE Platform SHALL log each impersonation event with the super_admin user id, target school_id, and timestamp.

---

### Requirement 5: Super Admin — Platform-Wide Statistics

**User Story:** As a Super Admin, I want to view platform-wide statistics, so that I can understand the overall usage of the platform.

#### Acceptance Criteria

1. WHEN the Super_Admin requests platform statistics, THE Platform SHALL return the total number of schools, total number of teachers across all schools, total number of students across all schools, and total number of day_plans generated across all schools.
2. WHEN the Super_Admin requests platform statistics, THE Platform SHALL compute the counts in real time from the database.
3. THE Platform SHALL include both active and inactive schools in the total school count, and SHALL separately report the count of active schools.

---

### Requirement 6: Super Admin — School Activation and Deactivation

**User Story:** As a Super Admin, I want to deactivate or reactivate a school, so that I can manage platform access for schools.

#### Acceptance Criteria

1. WHEN the Super_Admin deactivates a School, THE Platform SHALL set the school's status to inactive and prevent users of that school from authenticating.
2. WHEN the Super_Admin reactivates a School, THE Platform SHALL set the school's status to active and restore the ability for users of that school to authenticate.
3. IF the Super_Admin attempts to deactivate a School that is already inactive, THEN THE Platform SHALL return a 409 conflict error.
4. IF the Super_Admin attempts to reactivate a School that is already active, THEN THE Platform SHALL return a 409 conflict error.
5. WHEN a School is deactivated, THE Platform SHALL not delete any school data.

---

### Requirement 7: Super Admin — Billing and Subscription Status

**User Story:** As a Super Admin, I want to view the billing and subscription status of each school, so that I can track plan usage across the platform.

#### Acceptance Criteria

1. WHEN the Super_Admin views a School's details, THE Platform SHALL include the school's plan_type and a billing_status field (e.g., active, past_due, cancelled).
2. THE Super_Admin SHALL be able to update the plan_type of a School.
3. WHEN the Super_Admin updates a School's plan_type, THE Platform SHALL record the change with a timestamp.

---

### Requirement 8: Super Admin — Access Control

**User Story:** As a Super Admin, I want my role to be enforced at the API level, so that only super admins can access platform-level operations.

#### Acceptance Criteria

1. THE Platform SHALL define a super_admin role that is not scoped to any school_id.
2. WHEN a request is made to a super_admin endpoint without a valid super_admin JWT, THE Platform SHALL return a 403 error.
3. THE Platform SHALL store super_admin users in the users table with school_id set to NULL and role set to super_admin.
4. WHEN the schoolScope middleware processes a super_admin request, THE Platform SHALL bypass the school_id scoping check for super_admin users.

---

### Requirement 9: Principal — Attendance Overview

**User Story:** As a Principal, I want to see which classes have marked attendance today and which haven't, so that I can follow up with teachers who haven't submitted.

#### Acceptance Criteria

1. WHEN the Principal requests the attendance overview for today, THE Platform SHALL return a list of all sections in the school, each indicating whether attendance has been submitted for today's date.
2. THE Platform SHALL determine attendance submission status by checking whether at least one Attendance_Record exists for the section on today's date.
3. WHEN a section has submitted attendance today, THE Platform SHALL include the count of present and absent students for that section.
4. WHEN a section has not submitted attendance today, THE Platform SHALL mark that section's attendance status as pending.
5. THE Platform SHALL use the school's configured time zone when determining "today".

---

### Requirement 10: Principal — Teacher Activity Feed

**User Story:** As a Principal, I want to see which teachers have logged curriculum completion today and which are behind, so that I can identify teachers who need support.

#### Acceptance Criteria

1. WHEN the Principal requests the teacher activity feed, THE Platform SHALL return a list of all teachers in the school, each indicating whether the teacher has submitted a Daily_Completion record for today.
2. THE Platform SHALL mark a teacher as behind if no Daily_Completion record exists for any of the teacher's sections on today's date and today is a working day in the school calendar.
3. WHEN a teacher has submitted a Daily_Completion today, THE Platform SHALL include the section name and the number of chunks covered.
4. THE Platform SHALL exclude teachers whose sections are marked as inactive from the behind count.

---

### Requirement 11: Principal — Class-Wise Curriculum Coverage Report

**User Story:** As a Principal, I want to see the curriculum coverage percentage per class and section, so that I can identify which sections are lagging.

#### Acceptance Criteria

1. WHEN the Principal requests the curriculum coverage report, THE Platform SHALL return a list of all sections in the school, each with the section's Curriculum_Coverage percentage computed as (unique chunks covered / total chunks) × 100.
2. THE Platform SHALL compute Curriculum_Coverage using the count of distinct chunk_ids present in Daily_Completion records for the section.
3. WHEN a section has no curriculum uploaded, THE Platform SHALL return a coverage percentage of 0 and indicate that no curriculum is available.
4. THE Platform SHALL include the last completion date for each section in the coverage report.

---

### Requirement 12: Principal — View Teacher's Daily Plan

**User Story:** As a Principal, I want to view any teacher's plan for today, so that I can understand what is being taught across the school.

#### Acceptance Criteria

1. WHEN the Principal requests a teacher's plan for a given date, THE Platform SHALL return the day_plan record for the specified section and date, including the list of curriculum chunk topic labels.
2. IF no day_plan exists for the specified section and date, THEN THE Platform SHALL return a 404 response.
3. THE Principal SHALL be able to request plans for any section within the same school.
4. THE Platform SHALL enforce that the Principal can only view plans for sections belonging to the Principal's school_id.

---

### Requirement 13: Principal — Section Flagging

**User Story:** As a Principal, I want to flag a section as needing attention, so that I can track which sections require follow-up.

#### Acceptance Criteria

1. WHEN the Principal flags a Section, THE Platform SHALL set a flagged status on that section with a timestamp and the principal's user_id.
2. WHEN the Principal removes a flag from a Section, THE Platform SHALL clear the flagged status.
3. WHEN the Principal requests the curriculum coverage report or attendance overview, THE Platform SHALL include the flagged status for each section.
4. IF the Principal attempts to flag a Section that does not belong to the Principal's school, THEN THE Platform SHALL return a 403 error.
5. THE Platform SHALL allow a Principal to add an optional text note when flagging a Section.

---

### Requirement 14: Principal — Context-Aware AI Assistant

**User Story:** As a Principal, I want the AI assistant to be aware of my school's context, so that I can ask meaningful questions about attendance gaps and lagging sections.

#### Acceptance Criteria

1. WHEN the Principal sends a message to the AI_Assistant, THE Platform SHALL include the school's current curriculum coverage summary (sections with coverage below 50%) in the AI context.
2. WHEN the Principal sends a message to the AI_Assistant, THE Platform SHALL include the list of sections that have not submitted attendance today in the AI context.
3. WHEN the Principal sends a message to the AI_Assistant, THE Platform SHALL include the list of flagged sections in the AI context.
4. THE AI_Assistant SHALL use the injected school context to answer questions about lagging sections, attendance gaps, and flagged sections without requiring the Principal to re-state the context.
5. IF the AI service is unavailable, THEN THE Platform SHALL return a user-facing error message indicating the assistant is temporarily unavailable.

---

### Requirement 15: Parent — Daily Activity Feed

**User Story:** As a Parent, I want to see what was taught in my child's class today, so that I can stay informed about their learning.

#### Acceptance Criteria

1. WHEN the Parent requests the daily activity feed, THE Platform SHALL return the Daily_Completion record for the child's section for today's date, including the topic labels of all covered chunks.
2. WHEN no Daily_Completion record exists for the child's section today, THE Platform SHALL return an empty feed with a message indicating no activities have been recorded yet.
3. WHEN the Daily_Completion record includes a settling_day_note, THE Platform SHALL include the note in the daily activity feed response.
4. THE Platform SHALL only return activity feed data for sections linked to the Parent's children via parent_student_links.

---

### Requirement 16: Parent — Child Attendance History

**User Story:** As a Parent, I want to see my child's attendance history for the last 30 days, so that I can monitor their attendance pattern.

#### Acceptance Criteria

1. WHEN the Parent requests attendance history, THE Platform SHALL return Attendance_Records for each linked child covering the 30 calendar days prior to and including today.
2. THE Platform SHALL return each record with the date, student name, and status (present or absent).
3. WHEN no Attendance_Records exist for a child in the requested period, THE Platform SHALL return an empty list for that child.
4. THE Platform SHALL compute the attendance percentage for the 30-day period as (days present / days with a record) × 100 and include it in the response.

---

### Requirement 17: Parent — Completion Notifications

**User Story:** As a Parent, I want to be notified when today's activities are marked as completed by the teacher, so that I know my child's learning has been recorded.

#### Acceptance Criteria

1. WHEN a teacher submits a Daily_Completion record for a section, THE Platform SHALL create an in-app notification for all Parents linked to students in that section.
2. THE Platform SHALL mark each notification as unread upon creation.
3. WHEN the Parent retrieves their notifications, THE Platform SHALL return all unread notifications with the section name, completion date, and number of chunks covered.
4. WHEN the Parent marks a notification as read, THE Platform SHALL update the notification's read status.
5. THE Platform SHALL not send duplicate notifications if the teacher edits an existing Daily_Completion record for the same section and date.

---

### Requirement 18: Parent — Settling and Special Day Activities

**User Story:** As a Parent, I want to see what happened on non-curriculum days in my child's class, so that I understand what activities took place.

#### Acceptance Criteria

1. WHEN the Parent requests the activity feed for a date that is a special day, THE Platform SHALL return the settling_day_note from the Daily_Completion record for that date if one exists.
2. WHEN the Parent requests the activity feed for a date that is a special day and no Daily_Completion record exists, THE Platform SHALL return the special day's day_type and any note stored in the special_days table.
3. THE Platform SHALL clearly distinguish between curriculum-day completions and settling/special-day completions in the response.

---

### Requirement 19: Parent — Curriculum Progress Indicator

**User Story:** As a Parent, I want to see how much of the curriculum has been covered so far this year, so that I can understand my child's academic progress.

#### Acceptance Criteria

1. WHEN the Parent requests the curriculum progress for a linked child, THE Platform SHALL return the Curriculum_Coverage percentage for the child's section, computed as (unique chunks covered / total chunks) × 100.
2. WHEN the total chunks for the child's class is zero, THE Platform SHALL return a progress value of 0 and indicate that no curriculum has been uploaded.
3. THE Platform SHALL include the total number of chunks, the number of unique chunks covered, and the coverage percentage in the response.
4. THE Platform SHALL compute the coverage using only Daily_Completion records from the current academic year as defined by the school_calendar for the child's school.

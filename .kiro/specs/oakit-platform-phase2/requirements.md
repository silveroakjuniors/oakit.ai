# Requirements Document

## Introduction

Oakit.ai Phase 2 extends the existing curriculum management platform with a comprehensive set of school operations features. Phase 1 delivered curriculum PDF ingestion, day plan generation, teacher AI chat, and coverage logging. Phase 2 adds: mobile-number-based authentication with security-question password reset, teacher class assignment uniqueness enforcement, curriculum upload progress feedback, academic calendar improvements (year dropdown and holiday management with Excel import), student management (Excel import and photo upload), daily attendance marking with parent-facing absence summaries, and a full Teacher AI UX overhaul including a contextual greeting, thought for the day, attendance prompts, day planner PDF export, and scoped curriculum Q&A. Fee management and WhatsApp integration are documented as Phase 3 future requirements only.

---

## Glossary

- **Platform**: The Oakit.ai curriculum management system
- **School**: A registered educational institution
- **Admin**: A school-level administrator who manages users, classes, sections, curriculum, students, and calendar
- **Principal**: A school leader who monitors curriculum progress across all classes and teachers
- **Teacher**: A staff member assigned to one or more sections who uses the daily planner
- **Parent**: A guardian of a Student who can view attendance and missed topics
- **Student**: A learner enrolled in a Class and Section
- **Class_Teacher**: A Teacher designated as the primary teacher for a specific Section
- **Mobile_Number**: A ten-digit phone number used as the unique login identifier for all users
- **Security_Question**: A pre-set question and answer pair stored on a user account, used for password reset verification
- **Academic_Year**: A school year expressed as a string in the format YYYY-YY (e.g., 2025-26)
- **Holiday**: A named non-working date within a school calendar
- **Holiday_Import_File**: An Excel (.xlsx) file with columns "date" and "event_name" used to bulk-import holidays
- **Student_Import_File**: An Excel (.xlsx) file containing student records for bulk import
- **Attendance_Record**: A daily present/absent entry for a Student in a Section
- **Day_Plan**: The set of Curriculum_Chunks scheduled for a Teacher's Section on a specific calendar date
- **Coverage_Log**: A free-text entry submitted by a Teacher describing what was taught in a session
- **AI_Assistant**: The conversational AI component that answers Teacher queries
- **Planner_Service**: The backend service that generates and manages Day_Plans
- **Ingestion_Service**: The Python service responsible for parsing, chunking, and indexing curriculum PDFs
- **Day_Planner_PDF**: A formatted PDF export of one day's or one week's Day_Plan for a Teacher

---

## Requirements

### Requirement 1: Mobile Number Authentication

**User Story:** As a user (Admin, Teacher, Principal, or Parent), I want to log in with my mobile number instead of an email address, so that I can access the platform without needing to remember an email credential.

#### Acceptance Criteria

1. THE Platform SHALL accept a ten-digit mobile number as the primary login identifier for all user roles.
2. WHEN a new user account is created, THE Platform SHALL set the initial password to the user's mobile number.
3. WHEN a user logs in for the first time using the initial password, THE Platform SHALL redirect the user to a mandatory password-change screen before granting access to any other feature.
4. IF a user attempts to skip the mandatory password-change screen, THEN THE Platform SHALL block navigation and display a prompt requiring the password to be changed.
5. THE Platform SHALL validate that the new password chosen during the forced reset differs from the initial password (the mobile number).
6. THE Platform SHALL store mobile numbers as unique identifiers scoped to a School, so that the same mobile number may exist in different schools without conflict.
7. WHEN a user submits an incorrect mobile number or password, THE Platform SHALL return an authentication failure response without revealing which field was incorrect.

---

### Requirement 2: Security Question Password Reset

**User Story:** As a user, I want to reset my password by answering a security question, so that I can regain access without requiring OTP or SMS.

#### Acceptance Criteria

1. THE Platform SHALL present a fixed set of at least five security questions for users to choose from during account setup or first login.
2. WHEN a user completes the mandatory first-login password change, THE Platform SHALL prompt the user to select one security question and provide an answer.
3. THE Platform SHALL store the security question answer as a one-way hash.
4. THE Platform SHALL expose a "Forgot Password" option on the login screen for all user roles.
5. WHEN a user initiates a password reset, THE Platform SHALL display the user's chosen security question.
6. WHEN a user submits a correct answer to their security question, THE Platform SHALL allow the user to set a new password.
7. IF a user submits an incorrect answer to their security question, THEN THE Platform SHALL return a failure response without revealing the correct answer.
8. THE Platform SHALL allow any authenticated user to change their password from their account settings at any time.

---

### Requirement 3: Class Teacher Uniqueness Enforcement

**User Story:** As an Admin, I want to ensure a teacher can only be assigned as class teacher for one section, so that responsibility is unambiguous.

#### Acceptance Criteria

1. THE Platform SHALL designate at most one Class_Teacher per Section.
2. WHEN an Admin attempts to assign a Teacher as Class_Teacher for a Section, THE Platform SHALL verify that the Teacher is not already designated as Class_Teacher for any other Section within the same School.
3. IF a Teacher is already a Class_Teacher for another Section, THEN THE Platform SHALL reject the assignment and display an error identifying the conflicting Section.
4. THE Admin SHALL be able to remove a Class_Teacher designation from a Section without deleting the Teacher's account or other section assignments.

---

### Requirement 4: Curriculum Upload Progress Feedback

**User Story:** As an Admin, I want to see a progress bar during PDF upload and ingestion, so that I know the system is working and can estimate how long to wait.

#### Acceptance Criteria

1. WHEN an Admin initiates a Curriculum_Document upload, THE Platform SHALL display a progress bar reflecting the file upload percentage.
2. WHEN the file upload completes and ingestion begins, THE Platform SHALL update the progress indicator to reflect ingestion stages (e.g., extracting text, chunking, generating embeddings).
3. THE Platform SHALL display the current ingestion stage label alongside the progress indicator.
4. WHEN ingestion completes successfully, THE Platform SHALL display a completion message with the total number of chunks created.
5. IF the upload or ingestion fails at any stage, THEN THE Platform SHALL display an error message identifying the failed stage and allow the Admin to retry.

---

### Requirement 5: Academic Year Dropdown

**User Story:** As an Admin, I want to select the academic year from a pre-populated dropdown, so that I don't have to type it manually and can't enter an invalid format.

#### Acceptance Criteria

1. THE Platform SHALL populate the academic year selection field with the next ten academic years starting from the current calendar year, formatted as YYYY-YY (e.g., 2025-26, 2026-27, through 2034-35).
2. THE Platform SHALL present the academic year field as a dropdown (select input) rather than a free-text field.
3. WHEN the current calendar year changes, THE Platform SHALL automatically advance the dropdown range so it always shows the next ten years from the current year.
4. THE Admin SHALL be able to select any Academic_Year from the dropdown when creating or editing a school calendar entry.

---

### Requirement 6: Holiday Management

**User Story:** As an Admin, I want to add holidays manually or import them from an Excel file, so that the day plan generator skips those dates automatically.

#### Acceptance Criteria

1. THE Admin SHALL be able to add a Holiday to the school calendar by providing a date and an event name.
2. THE Admin SHALL be able to delete an existing Holiday from the school calendar.
3. THE Admin SHALL be able to import holidays by uploading a Holiday_Import_File (.xlsx) with columns named "date" and "event_name".
4. WHEN a Holiday_Import_File is uploaded, THE Platform SHALL parse each row and add the corresponding Holiday to the school calendar for the selected Academic_Year.
5. IF a row in the Holiday_Import_File contains an invalid or unparseable date, THEN THE Platform SHALL skip that row, record it as a validation error, and continue processing remaining rows.
6. WHEN holiday import completes, THE Platform SHALL display a summary showing the number of holidays successfully imported and the number of rows skipped with reasons.
7. WHEN the Planner_Service generates Day_Plans, THE Planner_Service SHALL skip all dates that are marked as Holidays in the school calendar.
8. IF a Day_Plan has already been generated for a date that is subsequently marked as a Holiday, THEN THE Planner_Service SHALL remove that Day_Plan and carry its Curriculum_Chunks forward to the next non-holiday working day.
9. THE Platform SHALL display the full list of Holidays for the selected Academic_Year in the calendar management screen, sorted by date.

---

### Requirement 7: Student Management — Excel Import

**User Story:** As an Admin or authorised user, I want to import students from an Excel file, so that I can onboard a large cohort without entering each record manually.

#### Acceptance Criteria

1. THE Admin SHALL be able to import students by uploading a Student_Import_File (.xlsx) containing the following columns: student name, father name, section, class, parent contact number.
2. WHEN a Student_Import_File is uploaded, THE Platform SHALL validate that all required columns are present before processing any rows.
3. IF a required column is missing from the Student_Import_File, THEN THE Platform SHALL reject the file and display an error listing the missing columns.
4. WHEN a valid Student_Import_File is processed, THE Platform SHALL create a Student record for each row, associating the student with the specified Class and Section within the School.
5. IF a row in the Student_Import_File references a Class or Section that does not exist in the School, THEN THE Platform SHALL skip that row, record it as a validation error, and continue processing remaining rows.
6. WHEN student import completes, THE Platform SHALL display a summary showing the number of students successfully imported and the number of rows skipped with reasons.
7. THE Admin SHALL be able to download a template Student_Import_File showing the required column headers.

---

### Requirement 8: Student Photo Upload

**User Story:** As an Admin, I want to upload a photo for each student, so that the platform can use it for future ID card generation.

#### Acceptance Criteria

1. THE Admin SHALL be able to upload a photo for an individual Student record.
2. THE Platform SHALL accept photo uploads in JPEG and PNG formats with a maximum file size of 5 MB per photo.
3. IF a photo upload exceeds 5 MB or is not in an accepted format, THEN THE Platform SHALL reject the upload and display a descriptive error message.
4. THE Platform SHALL store the uploaded photo and associate it with the Student record.
5. THE Platform SHALL display the student photo on the student detail screen when a photo has been uploaded.

---

### Requirement 9: Student Creation Permission Assignment

**User Story:** As an Admin, I want to control which roles can create student records, so that I can delegate data entry without granting full admin access.

#### Acceptance Criteria

1. THE Platform SHALL define a "create_students" permission that controls the ability to create and import Student records.
2. THE Admin SHALL be able to assign the "create_students" permission to any Role within the School (e.g., Class_Teacher, Admin).
3. WHEN a user without the "create_students" permission attempts to create or import a Student, THE Platform SHALL reject the request with an authorisation error.
4. THE Admin SHALL be able to revoke the "create_students" permission from a Role at any time.

---

### Requirement 10: Daily Attendance Marking

**User Story:** As a Teacher, I want to mark daily attendance for my section from my mobile device, so that absence records are captured in real time.

#### Acceptance Criteria

1. THE Teacher SHALL be able to mark each Student in their assigned Section as present or absent for the current school day.
2. THE Platform SHALL present the attendance marking interface in a mobile-optimised layout suitable for use on a smartphone browser.
3. WHEN a Teacher submits attendance for a Section on a given date, THE Platform SHALL store an Attendance_Record for each Student in that Section.
4. THE Teacher SHALL be able to edit attendance for the current day up until midnight of that day.
5. IF a Teacher attempts to submit attendance for a date that is a Holiday, THEN THE Platform SHALL display a warning and require confirmation before saving.
6. THE Platform SHALL prevent duplicate Attendance_Records for the same Student on the same date within the same Section.

---

### Requirement 11: Parent Absence Notification and Missed Topics

**User Story:** As a Parent, I want to see when my child was absent and what topics were missed, so that I can help my child catch up at home.

#### Acceptance Criteria

1. WHEN a Parent logs in, THE Platform SHALL display a message for each date on which the Parent's child was marked absent, including the date and the Curriculum_Chunks covered on that date.
2. THE Platform SHALL present a prompt asking the Parent whether they can help their child cover the missed topics.
3. WHEN a Parent marks a missed-topic task as done, THE Platform SHALL record the task completion and remove it from the active missed-topics list.
4. THE Platform SHALL display a consolidated list of all missed-topic tasks that have been marked as done by the Parent.
5. THE Platform SHALL display the Parent's child's name in all absence and missed-topic messages.

---

### Requirement 12: Teacher AI — Contextual Greeting and Thought for the Day

**User Story:** As a Teacher, I want to be greeted by name with a time-appropriate message and an inspiring thought when I log in, so that I feel welcomed and motivated.

#### Acceptance Criteria

1. WHEN a Teacher logs in, THE AI_Assistant SHALL greet the Teacher by their first name with a time-aware salutation: "Good morning" between 05:00 and 11:59, "Good afternoon" between 12:00 and 16:59, and "Good evening" between 17:00 and 04:59.
2. WHEN a Teacher logs in, THE Platform SHALL display a "Thought for the Day" message focused on teaching tips or keeping children engaged.
3. THE Platform SHALL rotate the Thought for the Day so that the same message is not shown on consecutive login days.
4. WHEN a Teacher logs in before the school's configured start time, THE AI_Assistant SHALL display a special acknowledgement message (e.g., "You're here early — that's dedication!") in addition to the standard greeting.

---

### Requirement 13: Teacher AI — Attendance Prompt on Login

**User Story:** As a Teacher, I want the AI to ask me if I want to take attendance when I log in during school hours, so that I don't forget to mark it.

#### Acceptance Criteria

1. WHEN a Teacher logs in during school hours and attendance has not yet been submitted for the current day, THE AI_Assistant SHALL ask the Teacher whether they want to mark attendance now.
2. WHEN the Teacher confirms, THE Platform SHALL navigate directly to the attendance marking screen for the Teacher's Section.
3. WHEN a Teacher logs in outside school hours, THE AI_Assistant SHALL skip the attendance prompt and instead ask how it can help the Teacher.
4. WHEN attendance has already been submitted for the current day, THE AI_Assistant SHALL not prompt the Teacher to mark attendance again.

---

### Requirement 14: Teacher AI — Scoped Curriculum Q&A

**User Story:** As a Teacher, I want the AI to answer curriculum questions only about today's assigned topics, so that I stay focused on the current day's plan.

#### Acceptance Criteria

1. WHEN a Teacher asks a curriculum question, THE AI_Assistant SHALL restrict its answer to Curriculum_Chunks that are part of the Teacher's Day_Plan for the current date.
2. IF a Teacher asks about a topic not in today's Day_Plan, THEN THE AI_Assistant SHALL inform the Teacher that the topic is not scheduled for today and indicate on which date it is scheduled, if known.
3. THE AI_Assistant SHALL include any pending Curriculum_Chunks carried forward from previous days as part of the answerable scope for the current day.

---

### Requirement 15: Teacher AI — Pending Work Visibility

**User Story:** As a Teacher, I want to see all pending work from previous days in one place, so that I can plan how to catch up.

#### Acceptance Criteria

1. THE Platform SHALL display a "Pending Work" section on the Teacher's dashboard listing all Curriculum_Chunks from prior Day_Plans that have not been marked as covered.
2. THE Pending Work list SHALL be sorted by original scheduled date, oldest first.
3. WHEN all pending Curriculum_Chunks for a prior day are covered, THE Platform SHALL remove that day's entry from the Pending Work list.

---

### Requirement 16: Teacher Daily Completion Submission

**User Story:** As a Teacher, I want to submit what I completed each day, so that the platform tracks my progress and parents can see what was taught.

#### Acceptance Criteria

1. THE Teacher SHALL be able to submit a daily completion entry indicating which Day_Plan items were completed in that session.
2. WHEN a Teacher submits a daily completion entry, THE Platform SHALL update the coverage status of the corresponding Curriculum_Chunks.
3. THE Platform SHALL make the completed topics for each day visible to Parents in their login view.
4. THE Teacher SHALL be able to submit one completion entry per Section per calendar day and edit it within 24 hours of submission.

---

### Requirement 17: Day Planner PDF Export

**User Story:** As a Teacher, I want to export my day plan as a PDF, so that I have a printable reference for the classroom.

#### Acceptance Criteria

1. THE Teacher SHALL be able to export the Day_Planner_PDF for a single day or for a period of up to one week.
2. WHEN a Day_Planner_PDF is generated, THE Platform SHALL apply a watermark on every page of the exported document.
3. THE Day_Planner_PDF SHALL include the Teacher's name, Section, date or date range, and the list of Curriculum_Chunks with topic names and Activity references.
4. WHEN a Teacher requests a PDF export, THE Platform SHALL generate and deliver the file within 10 seconds.
5. IF no Day_Plan exists for the requested date range, THEN THE Platform SHALL inform the Teacher that no plan is available for export.

---

## Phase 3 — Future Requirements (Do Not Build)

The following capabilities are documented for planning purposes only and MUST NOT be implemented in Phase 2.

### Future Requirement A: WhatsApp Parent Notifications

**User Story:** As a school, I want to send automated WhatsApp messages to parents about attendance and missed topics, so that parents are notified without needing to log in.

#### Acceptance Criteria (Future)

1. WHEN a Student is marked absent, THE Platform SHALL send a WhatsApp notification to the Parent's registered contact number.
2. THE Platform SHALL include the list of missed Curriculum_Chunks in the WhatsApp notification.
3. THE Admin SHALL be able to enable or disable WhatsApp notifications per School.

---

### Future Requirement B: Fee Module

**User Story:** As an Admin, I want a full fee management module, so that the school can track, collect, and reconcile student fees.

#### Acceptance Criteria (Future)

1. THE Admin SHALL be able to create fee structures including installment schedules, day care fees, and concessions.
2. THE Admin SHALL be able to bulk-assign fee structures to groups of Students.
3. THE Platform SHALL support fee reconciliation reports for the Accountant role.
4. THE Super_Admin SHALL be able to enable or disable the fee module per School.

---

### Future Requirement C: Parent Login and ID Card Generation

**User Story:** As a Parent, I want to log in and generate my child's ID card, so that I have an official school identity document.

#### Acceptance Criteria (Future)

1. THE Platform SHALL support a Parent role with login via mobile number.
2. WHEN a Parent requests an ID card, THE Platform SHALL generate a PDF ID card using the Student's name, class, section, and uploaded photo.
3. THE Platform SHALL allow the Parent to download the generated ID card as a PDF.

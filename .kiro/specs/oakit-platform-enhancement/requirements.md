# Requirements Document

## Introduction

Oakit is an AI-powered curriculum management platform for early childhood schools (Play Group, Nursery, LKG, UKG) in India. The platform currently supports admin, teacher, principal, parent, and super-admin portals with core features like curriculum upload, AI-assisted daily planning, attendance tracking, and parent communication.

This enhancement spec addresses gaps identified through competitive analysis against SchoolAI, Eduaide.AI, Education Copilot, and TeachMateAI. The goal is to make Oakit competitive for small Indian preschools by improving teacher productivity, parent engagement, data visibility, and school onboarding — with a mobile-first, simple UX approach.

The enhancements are grouped into eight focus areas: dashboard richness, teacher tools, student observations and assessments, in-app communication, gamification, reporting, resource library, and onboarding.

---

## Glossary

- **Oakit**: The AI-powered curriculum management platform being enhanced.
- **Oakie**: The AI assistant embedded in Oakit, accessible to teachers, principals, and parents.
- **Teacher**: A class teacher or subject teacher assigned to one or more sections.
- **Admin**: The school administrator who manages school setup, curriculum, and users.
- **Principal**: The school head who monitors attendance, coverage, and teacher performance.
- **Parent**: A guardian linked to one or more students in the school.
- **Student**: A child enrolled in a class (Play Group, Nursery, LKG, or UKG).
- **Section**: A class division (e.g., LKG-A, LKG-B) assigned to a teacher.
- **Observation**: A teacher-recorded note about a specific student's behavior, skill, or milestone.
- **Milestone**: A predefined developmental checkpoint for a student's age group.
- **Streak**: A consecutive-day count of a teacher completing their daily plan.
- **Resource**: A teaching material (activity idea, worksheet template, rhyme, story) stored in the shared library.
- **Announcement**: A school-wide or class-level message broadcast by admin or principal.
- **Term Report**: A generated summary of a student's attendance, curriculum coverage, and observations for a school term.
- **Setup_Wizard**: The guided onboarding flow for new schools configuring Oakit for the first time.
- **Dashboard**: The landing page for each portal role showing key metrics and quick actions.
- **Coverage_Chart**: A visual representation of curriculum completion percentage per section or student.
- **Engagement_Score**: A computed metric reflecting a teacher's consistency in plan completion, attendance marking, and parent communication.

---

## Requirements

### Requirement 1: Dashboard Data Visualizations

**User Story:** As an admin or principal, I want to see visual charts and color-coded indicators on my dashboard, so that I can understand school health at a glance without reading raw numbers.

#### Acceptance Criteria

1. THE Dashboard SHALL display a curriculum coverage chart showing completion percentage per section as a horizontal bar chart with color coding: green for ≥75%, amber for 40–74%, red for <40%.
2. THE Dashboard SHALL display an attendance trend chart showing the last 30 school days as a line graph with present, absent, and late counts per day.
3. WHEN the admin dashboard loads, THE Dashboard SHALL show today's snapshot including total students present, sections with attendance submitted, and sections with plans completed, updated within 60 seconds of the last teacher action.
4. WHEN a section's curriculum coverage drops below 40%, THE Dashboard SHALL display a red alert indicator on that section's card.
5. THE Dashboard SHALL display a "Plans Completed Today" counter that increments in real time as teachers mark their daily plans done.
6. IF no data is available for a chart, THEN THE Dashboard SHALL display a placeholder message explaining why the chart is empty and what action is needed to populate it.

---

### Requirement 2: Teacher Engagement Streaks and Milestones

**User Story:** As a teacher, I want to see my plan completion streak and milestone badges, so that I feel recognized for consistent effort and stay motivated.

#### Acceptance Criteria

1. THE Streak_Tracker SHALL compute a teacher's current streak as the number of consecutive school days on which the teacher marked their daily plan as completed.
2. WHEN a teacher completes their daily plan, THE Streak_Tracker SHALL increment the teacher's streak count and display the updated streak on the teacher portal home screen.
3. WHEN a teacher's streak reaches 5, 10, 20, or 30 consecutive school days, THE Streak_Tracker SHALL display a milestone celebration animation and a badge label (e.g., "5-Day Streak 🔥") on the teacher's home screen.
4. IF a teacher does not complete their plan on a school day, THEN THE Streak_Tracker SHALL reset the streak to zero on the following school day.
5. THE Streak_Tracker SHALL preserve the teacher's all-time best streak and display it alongside the current streak.
6. WHEN a teacher earns a new milestone badge, THE Dashboard SHALL display the badge persistently on the teacher's profile until a higher milestone is reached.

---

### Requirement 3: AI-Powered Activity and Resource Suggestions for Teachers

**User Story:** As a teacher, I want Oakie to suggest differentiated activity ideas and teaching resources for each subject in my daily plan, so that I can deliver more engaging lessons without spending time searching.

#### Acceptance Criteria

1. WHEN a teacher views their daily plan, THE Oakie_Assistant SHALL offer a "Suggest Activity" button for each subject in the plan.
2. WHEN a teacher taps "Suggest Activity" for a subject, THE Oakie_Assistant SHALL return at least 2 differentiated activity ideas tailored to the subject, the class level (Play Group / Nursery / LKG / UKG), and the topic being taught that day, within 5 seconds.
3. THE Oakie_Assistant SHALL label each suggested activity with a difficulty indicator: "Simple", "Standard", or "Extended", to support differentiated instruction.
4. WHEN a teacher taps "Suggest Activity", THE Oakie_Assistant SHALL include at least one activity idea suitable for students who need additional support and one suitable for students who are ahead.
5. WHERE the school has a Resource_Library, THE Oakie_Assistant SHALL surface relevant saved resources alongside AI-generated suggestions.
6. IF the AI service is unavailable, THEN THE Oakie_Assistant SHALL display a fallback message: "Oakie is unavailable right now. Try again shortly." and SHALL NOT display a blank screen.

---

### Requirement 4: Quick Worksheet and Activity Generator

**User Story:** As a teacher, I want to generate a simple printable worksheet or activity sheet for a topic in seconds, so that I can save preparation time and give students structured work.

#### Acceptance Criteria

1. THE Worksheet_Generator SHALL allow a teacher to select a subject, topic, and class level and generate a printable activity sheet within 10 seconds.
2. THE Worksheet_Generator SHALL produce activity sheets containing at least one of: fill-in-the-blank, matching, drawing prompt, or tracing exercise, appropriate to the selected class level.
3. WHEN a worksheet is generated, THE Worksheet_Generator SHALL display a preview before the teacher downloads or prints it.
4. THE Worksheet_Generator SHALL allow the teacher to regenerate a new variation of the worksheet with a single tap.
5. WHEN a teacher downloads a worksheet, THE Worksheet_Generator SHALL produce a PDF file named with the format `{class}-{subject}-{date}.pdf`.
6. IF the selected topic has no curriculum content loaded, THEN THE Worksheet_Generator SHALL notify the teacher: "No curriculum content found for this topic. The worksheet will use general age-appropriate content."

---

### Requirement 5: Student Observation Recording

**User Story:** As a teacher, I want to record observations about individual students during or after class, so that I can track each child's development and share insights with parents and the principal.

#### Acceptance Criteria

1. THE Observation_Tool SHALL allow a teacher to record a text observation of up to 500 characters for any student in their section.
2. THE Observation_Tool SHALL allow a teacher to tag each observation with one or more predefined categories: Behavior, Social Skills, Academic Progress, Motor Skills, Language, or Other.
3. WHEN a teacher saves an observation, THE Observation_Tool SHALL timestamp it with the current school date and associate it with the student and the teacher's section.
4. THE Observation_Tool SHALL allow a teacher to view all observations recorded for a student in reverse chronological order.
5. WHEN a principal views a student's profile, THE Observation_Tool SHALL display the observation history for that student, visible to the principal and admin.
6. IF a teacher attempts to save an observation with no text and no category, THEN THE Observation_Tool SHALL display a validation error: "Please add a note or select a category before saving."
7. THE Observation_Tool SHALL allow a teacher to mark an observation as "Share with Parent", which makes it visible in the parent portal under the student's profile.

---

### Requirement 6: Student Milestone Tracking

**User Story:** As a teacher, I want to mark developmental milestones for each student, so that I can track holistic progress beyond curriculum coverage.

#### Acceptance Criteria

1. THE Milestone_Tracker SHALL provide a predefined checklist of age-appropriate developmental milestones for each class level (Play Group, Nursery, LKG, UKG), with at least 10 milestones per level covering cognitive, social, motor, and language domains.
2. WHEN a teacher marks a milestone as achieved for a student, THE Milestone_Tracker SHALL record the date of achievement and the teacher's name.
3. THE Milestone_Tracker SHALL display a milestone completion percentage per student, calculated as (milestones achieved / total milestones for the class level) × 100, rounded to the nearest whole number.
4. WHEN a parent views their child's progress tab, THE Milestone_Tracker SHALL display the milestone completion percentage and a list of achieved milestones.
5. IF a milestone is marked as achieved and then unmarked, THEN THE Milestone_Tracker SHALL remove the achievement record and recalculate the completion percentage.
6. THE Milestone_Tracker SHALL allow the admin to add custom milestones for a specific class level, in addition to the predefined set.

---

### Requirement 7: In-App Teacher–Parent Messaging

**User Story:** As a teacher, I want to send direct messages to a student's parent within the app, so that I can communicate privately without using personal phone numbers.

#### Acceptance Criteria

1. THE Messaging_System SHALL allow a teacher to send a text message of up to 1000 characters to the parent(s) of any student in their section.
2. WHEN a parent receives a new message, THE Messaging_System SHALL display a notification badge on the parent portal's messages tab and send a push notification if the parent has enabled notifications.
3. THE Messaging_System SHALL display the conversation history between a teacher and a parent in a chronological thread, showing sender name, message text, and timestamp.
4. WHEN a parent replies to a teacher message, THE Messaging_System SHALL notify the teacher with a badge on the teacher portal's messages tab.
5. THE Messaging_System SHALL allow a teacher to view all active message threads with parents in their section, sorted by most recent message.
6. IF a message fails to send due to a network error, THEN THE Messaging_System SHALL display an error indicator on the failed message and provide a "Retry" option.
7. THE Messaging_System SHALL retain message history for a minimum of 90 days.
8. THE Messaging_System SHALL NOT allow parents to initiate new message threads; only teachers may start a conversation.

---

### Requirement 8: School Announcement Board

**User Story:** As an admin or principal, I want to post announcements visible to all teachers and parents, so that I can communicate school-wide information without using external messaging apps.

#### Acceptance Criteria

1. THE Announcement_Board SHALL allow an admin or principal to create an announcement with a title (up to 100 characters) and body (up to 1000 characters).
2. WHEN an announcement is published, THE Announcement_Board SHALL display it on the teacher portal home screen and the parent portal home screen within 60 seconds.
3. THE Announcement_Board SHALL allow the admin to target an announcement to: all users, all teachers only, all parents only, or a specific class.
4. WHEN a new announcement is published, THE Announcement_Board SHALL send a push notification to all targeted users who have enabled notifications.
5. THE Announcement_Board SHALL display announcements in reverse chronological order, showing the most recent first.
6. THE Announcement_Board SHALL allow the admin to set an expiry date for an announcement, after which it is automatically hidden from all portals.
7. IF an announcement has no expiry date set, THEN THE Announcement_Board SHALL retain it for 30 days before auto-archiving.
8. THE Announcement_Board SHALL allow the admin to delete or edit a published announcement at any time.

---

### Requirement 9: Printable and Exportable Reports

**User Story:** As an admin or teacher, I want to generate printable term-end reports for students and summary reports for the school, so that I can share progress with parents and management in a professional format.

#### Acceptance Criteria

1. THE Report_Generator SHALL produce a student term report as a PDF containing: student name, class, section, attendance percentage, curriculum coverage percentage, milestone completion percentage, and a list of teacher observations marked "Share with Parent".
2. WHEN an admin requests a term report for a student, THE Report_Generator SHALL generate the PDF within 15 seconds.
3. THE Report_Generator SHALL allow the admin to generate a batch of term reports for all students in a section as a single ZIP file containing individual PDFs.
4. THE Report_Generator SHALL produce a school summary report as a PDF containing: total students, overall attendance percentage, overall curriculum coverage percentage, and per-section breakdowns.
5. WHEN a teacher exports their daily plan PDF (existing feature), THE Report_Generator SHALL include the teacher's name, section, and date in the PDF header.
6. IF a student has no observations marked "Share with Parent", THEN THE Report_Generator SHALL include a placeholder line: "No observations recorded for this term."
7. THE Report_Generator SHALL format all reports using the school's name and logo as configured in the admin settings.

---

### Requirement 10: Shared Teacher Resource Library

**User Story:** As a teacher, I want to browse and save teaching resources shared by other teachers in my school, so that I can reuse good ideas and reduce preparation time.

#### Acceptance Criteria

1. THE Resource_Library SHALL allow a teacher to upload a resource with a title (up to 100 characters), description (up to 300 characters), subject tag, class level tag, and an optional file attachment (PDF or image, max 5 MB).
2. THE Resource_Library SHALL display all resources uploaded by teachers in the same school, searchable by subject and class level.
3. WHEN a teacher saves a resource to their personal collection, THE Resource_Library SHALL make it accessible from the teacher's "My Resources" list.
4. THE Resource_Library SHALL display the uploader's name and upload date for each resource.
5. WHEN a teacher uploads a resource, THE Resource_Library SHALL make it visible to all other teachers in the same school within 60 seconds.
6. IF a file attachment exceeds 5 MB, THEN THE Resource_Library SHALL reject the upload and display: "File too large. Maximum size is 5 MB."
7. THE Resource_Library SHALL allow the admin to delete any resource from the library.
8. THE Resource_Library SHALL allow a teacher to delete their own uploaded resources.

---

### Requirement 11: Guided School Setup Wizard

**User Story:** As a new school admin, I want a step-by-step setup wizard when I first log in, so that I can configure Oakit correctly without needing external support.

#### Acceptance Criteria

1. WHEN an admin logs in for the first time and no classes have been created, THE Setup_Wizard SHALL automatically launch and guide the admin through the setup steps in order: school profile → classes and sections → staff accounts → curriculum upload → calendar setup.
2. THE Setup_Wizard SHALL display a progress indicator showing the current step number and total steps (e.g., "Step 2 of 5").
3. WHEN the admin completes a step and clicks "Next", THE Setup_Wizard SHALL save the entered data before advancing to the next step.
4. THE Setup_Wizard SHALL allow the admin to skip any step and return to it later from a "Complete Setup" checklist on the admin dashboard.
5. WHEN all setup steps are marked complete, THE Setup_Wizard SHALL display a completion message and dismiss the checklist from the dashboard.
6. IF the admin closes the browser during setup, THEN THE Setup_Wizard SHALL resume from the last completed step on the next login.
7. THE Setup_Wizard SHALL include inline help text for each field explaining what is required and why, in plain language.
8. THE Setup_Wizard SHALL allow the admin to re-launch the setup checklist at any time from the admin settings page.

---

### Requirement 12: Parent Portal Engagement Enhancements

**User Story:** As a parent, I want richer visual feedback about my child's day and progress, so that I feel more connected to what is happening at school.

#### Acceptance Criteria

1. THE Parent_Portal SHALL display a "Today's Mood" indicator on the home tab, populated from the teacher's observation for that day if one exists and is marked "Share with Parent".
2. THE Parent_Portal SHALL display a weekly attendance summary as a 5-day strip (Mon–Fri) with color-coded dots: green for present, amber for late, red for absent, grey for holiday or weekend.
3. WHEN a student's curriculum coverage reaches 25%, 50%, 75%, or 100%, THE Parent_Portal SHALL display a milestone celebration card on the home tab with a congratulatory message.
4. THE Parent_Portal SHALL display the student's milestone completion percentage alongside the curriculum coverage percentage on the progress tab.
5. WHEN a new teacher message arrives, THE Parent_Portal SHALL display a red badge on the messages tab and show the message in a conversation thread.
6. THE Parent_Portal SHALL display school announcements targeted to parents or the student's class on the home tab, below the today's snapshot section.
7. IF the parent has not opened the app in 3 or more school days, THEN THE Parent_Portal SHALL display a "You've been away" summary card showing what the child covered during the missed days.

---

### Requirement 13: Principal Reporting and Oversight Enhancements

**User Story:** As a principal, I want to see teacher engagement metrics and be able to export school-level reports, so that I can identify teachers who need support and share progress with school management.

#### Acceptance Criteria

1. THE Principal_Dashboard SHALL display each teacher's current streak, last plan completion date, and a 30-day plan completion rate (percentage of school days on which the teacher completed their plan).
2. WHEN a teacher has not completed their plan for 3 or more consecutive school days, THE Principal_Dashboard SHALL highlight that teacher's card with an amber warning indicator.
3. THE Principal_Dashboard SHALL display a school-wide curriculum coverage chart showing coverage percentage per section, updated daily.
4. WHEN the principal requests a school summary report, THE Report_Generator SHALL produce a PDF within 15 seconds containing attendance, coverage, and teacher engagement data.
5. THE Principal_Dashboard SHALL allow the principal to filter the section overview by class (Play Group, Nursery, LKG, UKG).
6. IF a section has no curriculum assigned, THEN THE Principal_Dashboard SHALL display a "No curriculum" label on that section's card instead of a coverage percentage.

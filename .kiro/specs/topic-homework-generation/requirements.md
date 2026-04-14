# Requirements Document

## Introduction

The Topic-level Homework Generation feature allows teachers to generate AI-assisted homework for individual topics directly from their daily plan. For each topic in the day's plan, the teacher can trigger AI generation, review and edit the result, add personal comments, and submit. The AI then formats the homework into a clean, parent-friendly message that is sent to parents and made visible to parents, admin, and principal.

This replaces the confusing per-topic checkboxes in the daily plan with a purposeful "Generate Homework" action that fits naturally into the teacher's end-of-day workflow.

## Glossary

- **Homework_Generator**: The end-to-end feature — from the "Generate Homework" button to the parent-facing message.
- **Topic**: A single curriculum item (chunk) listed in the teacher's daily plan for today.
- **Homework_Draft**: The AI-generated homework text for a topic, before the teacher edits or submits it.
- **Homework_Record**: The confirmed, saved homework entry for a topic on a given date, associated with the teacher's section.
- **Formatted_Message**: The parent-friendly version of the homework, produced by the AI after the teacher submits, ready for delivery.
- **Parent_Message**: The message sent to parents via the existing messaging system, containing the Formatted_Message.
- **Teacher**: A logged-in user with the `teacher` role, viewing their own section's daily plan.
- **Parent**: A user with the `parent` role, linked to one or more students in the teacher's section.
- **Admin**: A user with the `admin` role at the school.
- **Principal**: A user with the `principal` role at the school.
- **Section**: The class section the teacher is assigned to.

---

## Requirements

### Requirement 1: Generate Homework Button on Daily Plan

**User Story:** As a teacher, I want a "Generate Homework" button next to each topic in my daily plan, so that I can quickly create homework for any topic I taught today.

#### Acceptance Criteria

1. THE Homework_Generator SHALL display a "Generate Homework" button alongside each Topic in the teacher's daily plan.
2. WHEN a Homework_Record already exists for a Topic on the current date, THE Homework_Generator SHALL replace the "Generate Homework" button with a "View / Edit Homework" button for that Topic.
3. WHILE homework generation is in progress for a Topic, THE Homework_Generator SHALL show a loading indicator on that Topic's button and disable it until generation completes.
4. IF the teacher's daily plan has no Topics for the current date, THEN THE Homework_Generator SHALL not display any "Generate Homework" buttons.

---

### Requirement 2: AI Homework Generation

**User Story:** As a teacher, I want the AI to generate relevant homework for a topic I select, so that I don't have to write it from scratch every day.

#### Acceptance Criteria

1. WHEN the teacher clicks "Generate Homework" for a Topic, THE Homework_Generator SHALL send the topic name and topic content to the AI and return a Homework_Draft within 15 seconds.
2. THE AI SHALL generate homework that is age-appropriate for preschool and primary school children, using simple language and short instructions.
3. THE Homework_Draft SHALL include: a brief description of what the child should do, any materials needed (if applicable), and an estimated time to complete.
4. IF the AI fails to generate a Homework_Draft within 15 seconds, THEN THE Homework_Generator SHALL display an error message and allow the teacher to retry.
5. THE Homework_Generator SHALL generate homework in the same language as the topic content (e.g. English topics produce English homework, Hindi topics produce Hindi homework).

---

### Requirement 3: Teacher Review and Edit

**User Story:** As a teacher, I want to review, edit, and add my own comments to the AI-generated homework before sending it to parents, so that I stay in control of what goes home.

#### Acceptance Criteria

1. WHEN a Homework_Draft is generated, THE Homework_Generator SHALL display it in an editable text area so the teacher can modify the content.
2. THE Homework_Generator SHALL provide a separate "Teacher's Comments" field where the teacher can add personal notes or instructions alongside the AI-generated homework.
3. THE Homework_Generator SHALL allow the teacher to clear the AI-generated text and write the homework entirely from scratch.
4. WHILE the teacher is editing, THE Homework_Generator SHALL preserve unsaved changes if the teacher navigates away and returns to the same topic within the same session.
5. THE Homework_Generator SHALL require the homework text field to be non-empty before the teacher can submit.

---

### Requirement 4: Homework Submission and AI Formatting

**User Story:** As a teacher, I want the AI to format my homework into a clean, friendly message for parents after I submit it, so that parents receive something easy to read and act on.

#### Acceptance Criteria

1. WHEN the teacher submits the homework, THE Homework_Generator SHALL send the edited homework text and teacher's comments to the AI for formatting.
2. THE AI SHALL produce a Formatted_Message that is warm, concise, and written in a tone suitable for parents of young children.
3. THE Formatted_Message SHALL include: the topic name, what the child needs to do, any materials needed, the teacher's comments (if provided), and a friendly closing line.
4. THE Homework_Generator SHALL display the Formatted_Message to the teacher for a final preview before it is sent to parents.
5. WHEN the teacher confirms the Formatted_Message, THE Homework_Generator SHALL save the Homework_Record with both the raw homework text and the Formatted_Message.
6. IF AI formatting fails, THEN THE Homework_Generator SHALL fall back to sending the teacher's raw homework text as the Parent_Message, and notify the teacher that formatting was skipped.

---

### Requirement 5: Delivery to Parents

**User Story:** As a teacher, I want the homework to be automatically sent to parents after I confirm it, so that I don't have to copy-paste or send messages manually.

#### Acceptance Criteria

1. WHEN the teacher confirms the Formatted_Message, THE Homework_Generator SHALL send a Parent_Message to every parent linked to a student in the teacher's Section.
2. THE Parent_Message SHALL be delivered via the existing school messaging system (the `messages` table), with `sender_role = 'teacher'`.
3. THE Homework_Generator SHALL send one Parent_Message per parent (not per student), even if a parent has multiple children in the same Section.
4. IF sending a Parent_Message fails for one or more parents, THEN THE Homework_Generator SHALL display the names of the affected parents and allow the teacher to retry delivery for those parents.
5. WHEN all Parent_Messages are sent successfully, THE Homework_Generator SHALL display a confirmation to the teacher showing how many parents were notified.

---

### Requirement 6: Visibility for Parents, Admin, and Principal

**User Story:** As a school admin or principal, I want to see all homework sent by teachers, so that I can monitor what is being assigned to students.

#### Acceptance Criteria

1. THE Homework_Record SHALL be visible to the teacher who created it, all parents in the Section, the school Admin, and the Principal.
2. WHEN a parent views their messages, THE Homework_Generator SHALL display the Formatted_Message in the parent's message thread with the teacher.
3. WHEN an admin or principal views homework records, THE Homework_Generator SHALL display a list of all Homework_Records for the school, filterable by date, class, and section.
4. THE Homework_Generator SHALL display each Homework_Record with: topic name, date, teacher name, class and section, and the Formatted_Message.
5. WHILE a Homework_Record exists for a Topic, THE Homework_Generator SHALL display a "Homework sent ✓" indicator on that Topic in the teacher's daily plan.

---

### Requirement 7: Edit and Resend Homework

**User Story:** As a teacher, I want to be able to edit and resend homework after it has been sent, so that I can correct mistakes or add information.

#### Acceptance Criteria

1. WHEN the teacher opens a Topic that already has a Homework_Record, THE Homework_Generator SHALL display the existing homework text and teacher's comments in editable fields.
2. WHEN the teacher saves changes to an existing Homework_Record, THE Homework_Generator SHALL re-run AI formatting and send an updated Parent_Message to all parents in the Section.
3. THE updated Parent_Message SHALL be clearly marked as an update (e.g. "📝 Updated Homework") so parents know it replaces the previous message.
4. THE Homework_Generator SHALL preserve the original Homework_Record and append the updated version, so the history of changes is not lost.


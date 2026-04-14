# Requirements Document

## Introduction

The Textbook-to-Planner Generator allows school admins to upload subject textbook PDFs, configure school parameters, and have the AI automatically generate a structured day-by-day academic planner. The generated planner is reviewed, optionally edited, and then pushed into the existing curriculum pipeline — producing `curriculum_chunks` that feed into `planner_service` exactly as if a pre-made planner PDF had been uploaded. This feature targets schools that have textbooks but no pre-made weekly curriculum planners.

## Design Philosophy

**Keep it simple. Keep it small. Keep it reviewable.**

The planner does NOT generate the full academic year in one shot. Instead:
- The admin generates **one month at a time**
- Each month is generated **one week at a time** — the AI receives only that week's context (subjects, topics due, holidays, special days)
- The admin reviews and confirms each month before it is pushed to teachers
- This keeps AI prompts small (no token overflow), costs low, and gives the admin full control

## Glossary

- **Planner_Generator**: The end-to-end feature — from textbook upload to monthly curriculum push.
- **TOC_Extractor**: The AI component that reads a PDF page and extracts chapter/topic structure from a Table of Contents.
- **Subject_Setup**: The admin workflow for registering subjects, uploading textbooks, and specifying TOC pages for a class.
- **School_Parameters**: The set of calendar, timing, and activity configurations required before planner generation.
- **Monthly_Plan**: The AI-generated day-by-day plan for a single calendar month, reviewed and confirmed by the admin before pushing to teachers.
- **Weekly_Batch**: The unit of AI generation — one week of teaching days sent to the AI at a time to produce daily plans.
- **Planner_Draft**: A saved but not-yet-confirmed Monthly_Plan that the admin can preview and edit.
- **Curriculum_Pipeline**: The existing flow: `curriculum_documents` → `curriculum_chunks` → `day_plans`, unchanged by this feature.
- **Academic_Year**: A school year record in the `school_calendar` table, identified by `school_id` and `academic_year` string.
- **Teaching_Day**: A working day that is not a holiday, not a full-day special day, and not an exam day.
- **Subject_Allocation**: The configured hours per week assigned to a subject within a class.
- **Chapter_Weight**: An estimated relative complexity value for a chapter, derived from its page span in the TOC.
- **Topic_Pointer**: A per-subject cursor tracking which topic is next to be taught, persisted across monthly generations.
- **Carry_Forward**: The mechanism by which a topic that overruns its scheduled day is moved to the next Teaching_Day.

---

## Requirements

### Requirement 1: Subject Setup

**User Story:** As a school admin, I want to register subjects for a class and upload their textbook PDFs, so that the AI can extract chapter and topic structure for planner generation.

#### Acceptance Criteria

1. THE Subject_Setup SHALL allow the admin to add one or more subjects to a class, each with a unique subject name within that class.
2. WHEN the admin uploads a textbook PDF for a subject, THE Subject_Setup SHALL accept files in PDF format only and reject all other file types with a descriptive error message.
3. WHEN a PDF is uploaded, THE Subject_Setup SHALL allow the admin to specify the page number that contains the Table of Contents.
4. WHEN the admin specifies a TOC page number that is less than 1 or greater than the total page count of the uploaded PDF, THE Subject_Setup SHALL reject the input and display a validation error.
5. WHEN the admin submits a subject with a valid PDF and TOC page, THE TOC_Extractor SHALL extract a list of chapters and topics from the specified page.
6. IF the TOC_Extractor cannot identify any chapters on the specified page, THEN THE Subject_Setup SHALL display an error message and allow the admin to specify a different page number.
7. WHEN TOC extraction succeeds, THE Subject_Setup SHALL display the extracted chapter and topic list for admin review before proceeding.
8. THE Subject_Setup SHALL allow the admin to manually add, edit, or remove chapters and topics from the extracted list.
9. THE Subject_Setup SHALL allow the admin to delete a subject and its associated PDF and extracted TOC data before the Planner_Draft is confirmed.

---

### Requirement 2: School Parameters Configuration

**User Story:** As a school admin, I want to configure school parameters before generating a planner, so that the generated schedule accurately reflects the school's actual calendar and daily structure.

#### Acceptance Criteria

1. WHEN the admin initiates planner generation, THE Planner_Generator SHALL check whether an Academic_Year record exists for the selected school and year.
2. IF no Academic_Year record exists, THEN THE Planner_Generator SHALL prompt the admin to configure academic year start and end dates before proceeding.
3. WHEN the admin initiates planner generation, THE Planner_Generator SHALL check whether working days are configured in the school calendar.
4. IF working days are not configured, THEN THE Planner_Generator SHALL prompt the admin to select working days (Monday through Friday by default, with custom selection supported) before proceeding.
5. WHEN the admin initiates planner generation, THE Planner_Generator SHALL display the count of holidays already present in the `holidays` table for the selected academic year.
6. WHERE the admin chooses to add holidays, THE Planner_Generator SHALL allow the admin to add holidays inline without leaving the planner setup flow.
7. WHEN the admin initiates planner generation, THE Planner_Generator SHALL display the count of special days (exam, revision, event) already present in the `special_days` table for the selected academic year.
8. WHERE the admin chooses to add special days, THE Planner_Generator SHALL allow the admin to add exam days, revision days, and event days inline without leaving the planner setup flow.
9. THE School_Parameters SHALL include class start time and end time, which default to the values stored in the `classes` table if already set.
10. THE School_Parameters SHALL include lunch break start time and end time.
11. WHERE a snack break is configured, THE School_Parameters SHALL include snack break start time and end time.
12. THE School_Parameters SHALL include a weekly Sports/PE time allocation in minutes.
13. WHERE non-academic activities are configured (assembly, library, etc.), THE School_Parameters SHALL allow the admin to specify each activity name and its daily time allocation in minutes.
14. WHEN the admin saves School_Parameters, THE Planner_Generator SHALL calculate and display the total available teaching minutes per day after subtracting all breaks and non-academic activities.
15. IF the total non-academic time equals or exceeds the total school day duration, THEN THE Planner_Generator SHALL display a validation error and prevent saving until the configuration is corrected.

---

### Requirement 3: Subject Time Allocation

**User Story:** As a school admin, I want to assign weekly teaching hours to each subject, so that the planner distributes content proportionally across the academic year.

#### Acceptance Criteria

1. THE Subject_Setup SHALL allow the admin to specify a weekly hours allocation for each subject.
2. WHEN the admin sets Subject_Allocation values, THE Planner_Generator SHALL calculate the total weekly hours across all subjects and display it alongside the total available teaching hours per week.
3. IF the total Subject_Allocation across all subjects exceeds the total available teaching hours per week, THEN THE Planner_Generator SHALL display a validation warning identifying the excess and prevent generation until resolved.
4. IF the total Subject_Allocation across all subjects is less than 80% of the total available teaching hours per week, THEN THE Planner_Generator SHALL display an advisory warning that teaching time is underutilised.
5. THE Planner_Generator SHALL calculate Chapter_Weight for each chapter as proportional to its page span relative to the total page count of the subject's textbook.
6. WHEN distributing topics across Teaching_Days, THE Planner_Engine SHALL use Chapter_Weight to allocate more days to longer chapters and fewer days to shorter chapters.

---

### Requirement 4: Test Configuration

**User Story:** As a school admin, I want to configure when and how tests are scheduled, so that the planner automatically inserts test days at the right points in the academic calendar.

#### Acceptance Criteria

1. THE Test_Schedule SHALL support four scheduling modes: end-of-chapter, every-N-weeks, specific-dates, and manual.
2. WHEN the admin selects end-of-chapter mode, THE Planner_Engine SHALL insert a test day immediately after the last Teaching_Day of each chapter for each subject.
3. WHEN the admin selects every-N-weeks mode, THE Planner_Engine SHALL insert a test day every N weeks from the academic year start date, where N is a positive integer between 1 and 52 inclusive.
4. WHEN the admin selects specific-dates mode, THE Planner_Generator SHALL allow the admin to select one or more dates from the academic calendar for test days.
5. IF a specific test date falls on a holiday or existing full-day special day, THEN THE Planner_Generator SHALL display a conflict warning and require the admin to select a different date.
6. WHEN the admin selects manual mode, THE Planner_Engine SHALL not insert any test days automatically, and the admin may mark days as exam days during the review phase.
7. THE Test_Schedule SHALL include a test duration expressed as a number of class periods (minimum 1, maximum 5).
8. WHEN test days are inserted, THE Planner_Engine SHALL add them to the `special_days` table with `day_type = 'exam'` and exclude them from Teaching_Day calculations.

---

### Requirement 5: Revision Buffer Auto-Insertion

**User Story:** As a school admin, I want revision days to be automatically inserted before exam days, so that students have structured preparation time built into the planner.

#### Acceptance Criteria

1. THE Planner_Engine SHALL automatically insert one Revision_Buffer day before each scheduled exam day.
2. WHEN inserting a Revision_Buffer day, THE Planner_Engine SHALL use the nearest preceding Teaching_Day that is not already allocated as a test, revision, or holiday.
3. WHEN a Revision_Buffer day is inserted, THE Planner_Engine SHALL add it to the `special_days` table with `day_type = 'revision'` and populate `revision_topics` with the chapters covered since the previous exam day.
4. IF no preceding Teaching_Day is available for a Revision_Buffer, THEN THE Planner_Engine SHALL log a warning and skip Revision_Buffer insertion for that exam day.
5. THE Planner_Generator SHALL display the count of auto-inserted Revision_Buffer days in the generation summary before the admin confirms.

---

### Requirement 6: Planner Generation

**User Story:** As a school admin, I want the system to generate a complete day-by-day planner from my textbook content and school parameters, so that I have a structured academic schedule without manual effort.

#### Acceptance Criteria

1. WHEN the admin triggers generation, THE Planner_Engine SHALL calculate the total number of Teaching_Days by subtracting holidays, full-day special days, exam days, and Revision_Buffer days from all working days in the Academic_Year.
2. THE Planner_Engine SHALL distribute each subject's chapters across Teaching_Days in proportion to the subject's Subject_Allocation and each chapter's Chapter_Weight.
3. WHEN distributing topics, THE Planner_Engine SHALL assign topics in the order they appear in the extracted TOC.
4. THE Planner_Engine SHALL produce a Planner_Draft where each Teaching_Day entry contains: the date, subject name, chapter name, topic name, and estimated duration in minutes.
5. WHEN the total topic content for a subject cannot fit within the calculated Teaching_Days for that subject, THE Planner_Engine SHALL distribute remaining topics evenly across the last available Teaching_Days for that subject rather than dropping them.
6. THE Planner_Engine SHALL save the Planner_Draft to a new `textbook_planner_drafts` table with status `draft` before presenting it to the admin.
7. WHEN generation is complete, THE Planner_Generator SHALL display a summary showing: total Teaching_Days, total exam days, total Revision_Buffer days, and per-subject chapter coverage percentage.
8. THE Planner_Engine SHALL complete generation for a full academic year within 30 seconds for a class with up to 10 subjects.

---

### Requirement 7: Carry-Forward Logic

**User Story:** As a school admin, I want topics that run over their scheduled time to automatically carry forward to the next available day, so that the planner stays accurate even when pacing changes.

#### Acceptance Criteria

1. WHEN a teacher marks a topic as incomplete at the end of a Teaching_Day, THE Planner_Generator SHALL move the incomplete topic to the next Teaching_Day for that subject.
2. WHEN a topic is carried forward, THE Planner_Engine SHALL shift all subsequent topics for that subject forward by one Teaching_Day.
3. IF carrying forward a topic causes the last topic of a subject to exceed the last Teaching_Day of the Academic_Year, THEN THE Planner_Engine SHALL flag the subject as overrun and display a warning to the admin.
4. THE Planner_Generator SHALL record each carry-forward event with the original date, new date, subject, and topic in the `textbook_planner_drafts` audit log.

---

### Requirement 8: Planner Preview and Edit

**User Story:** As a school admin, I want to preview and edit the generated planner before finalising it, so that I can correct any scheduling issues before teachers see their plans.

#### Acceptance Criteria

1. THE Planner_Generator SHALL present the Planner_Draft as a paginated calendar view, showing one week per page with each day's subject, chapter, and topic.
2. THE Planner_Generator SHALL allow the admin to drag and drop topics between Teaching_Days within the same subject.
3. THE Planner_Generator SHALL allow the admin to manually add a topic to any Teaching_Day.
4. THE Planner_Generator SHALL allow the admin to remove a topic from a Teaching_Day, which moves it to the next available Teaching_Day for that subject.
5. THE Planner_Generator SHALL allow the admin to mark any Teaching_Day as an exam day, revision day, or event day during the review phase.
6. WHEN the admin marks a Teaching_Day as an exam day during review, THE Planner_Engine SHALL re-run Revision_Buffer insertion for the affected exam day.
7. WHEN the admin saves edits to the Planner_Draft, THE Planner_Generator SHALL persist the changes to the `textbook_planner_drafts` table without confirming the planner.
8. THE Planner_Generator SHALL allow the admin to discard all edits and revert to the last generated version of the Planner_Draft.
9. THE Planner_Generator SHALL allow the admin to trigger re-generation of the entire Planner_Draft if school calendar parameters change, replacing the existing draft.

---

### Requirement 9: Push to Curriculum Pipeline

**User Story:** As a school admin, I want to confirm and push the finalised planner into the curriculum pipeline, so that teachers receive their daily plans through the existing system without any additional steps.

#### Acceptance Criteria

1. WHEN the admin confirms the Planner_Draft, THE Planner_Generator SHALL convert each day's topic entry into a `curriculum_chunks` record with `topic_label`, `content`, `chunk_index`, `class_id`, `school_id`, and `document_id`.
2. WHEN pushing to the Curriculum_Pipeline, THE Planner_Generator SHALL create a `curriculum_documents` record with `status = 'ready'` and `ingestion_stage = 'done'` to represent the generated planner.
3. AFTER chunks are created, THE Planner_Generator SHALL invoke the existing `planner_service.generate_plans` function for each section of the class to produce `day_plans`.
4. WHEN the push is complete, THE Planner_Generator SHALL update the Planner_Draft status to `confirmed` in the `textbook_planner_drafts` table.
5. IF the push fails for any section, THEN THE Planner_Generator SHALL roll back all chunk and plan inserts for that section and display a descriptive error to the admin.
6. THE Planner_Generator SHALL prevent a second push for a Planner_Draft that already has status `confirmed`, displaying an informational message instead.
7. WHEN a confirmed planner is pushed, THE Planner_Generator SHALL display a success summary showing the number of chunks created and the number of day plans generated per section.

---

### Requirement 10: Progress Tracking

**User Story:** As a school admin, I want to track which chapters have been covered versus planned, so that I can monitor curriculum delivery throughout the academic year.

#### Acceptance Criteria

1. THE Planner_Generator SHALL maintain a per-subject coverage record that tracks each chapter's status as `planned`, `in_progress`, or `completed`.
2. WHEN a teacher marks a day plan as completed, THE Planner_Generator SHALL update the coverage status of the associated chapter to `in_progress` if not all topics are done, or `completed` if all topics are done.
3. THE Planner_Generator SHALL expose a coverage summary endpoint that returns, per subject: total chapters, chapters completed, chapters in progress, and chapters not yet started.
4. WHEN the admin views the coverage summary, THE Planner_Generator SHALL display the percentage of the academic year elapsed alongside the percentage of curriculum covered, so that pacing can be assessed.
5. IF curriculum coverage falls more than 15% behind the elapsed academic year percentage, THEN THE Planner_Generator SHALL display a pacing alert to the admin.

---

### Requirement 11: Re-generation on Calendar Change

**User Story:** As a school admin, I want to re-generate the planner when the school calendar changes, so that the schedule stays accurate after holidays or events are added or removed.

#### Acceptance Criteria

1. WHEN a holiday or special day is added or removed from the school calendar after a Planner_Draft exists, THE Planner_Generator SHALL display a notification to the admin that the existing draft may be out of date.
2. THE Planner_Generator SHALL allow the admin to trigger a full re-generation of the Planner_Draft at any time before the draft is confirmed.
3. WHEN re-generation is triggered, THE Planner_Engine SHALL preserve any manual topic edits made by the admin in the previous draft where the associated Teaching_Day still exists in the new schedule.
4. WHEN re-generation is triggered on a confirmed planner, THE Planner_Generator SHALL require the admin to explicitly acknowledge that existing `day_plans` for the class will be replaced before proceeding.
5. IF re-generation would reduce the total number of Teaching_Days such that one or more subjects cannot cover all their chapters, THEN THE Planner_Engine SHALL flag the affected subjects and display the number of topics that cannot be scheduled.

---

### Requirement 12: Month-by-Month Generation (Enhancement)

**User Story:** As a school admin, I want to generate and review the planner one month at a time, so that I stay in control of what teachers see without being overwhelmed by a full-year plan.

#### Design Rationale

Generating the full academic year in one AI call causes token overflow, timeouts, and produces a plan too large to meaningfully review. The month-by-month approach:
- Keeps each AI call small (one week at a time = 5 days × subjects)
- Lets the admin review and confirm before teachers see anything
- Allows corrections mid-year without regenerating everything
- Costs less in AI credits

#### Acceptance Criteria

1. THE Planner_Generator SHALL generate plans **one month at a time**, not the full academic year at once.

2. WITHIN each month, THE Planner_Generator SHALL generate **one week at a time** — sending only that week's context to the AI:
   - The 5 teaching days for that week (dates, day names)
   - Holidays and special days falling in that week
   - For each subject: the next N topics due (based on Topic_Pointer), weekly hours, and subject name
   - School parameters (timings, breaks, activities)

3. THE Planner_Generator SHALL maintain a **Topic_Pointer** per subject that tracks which topic is next to be taught. The pointer advances as weeks are generated and persists across monthly generations.

4. WHEN the admin opens the Textbook Planner for a class, THE Planner_Generator SHALL show:
   - A list of months in the academic year
   - Status of each month: `not_generated`, `draft`, `confirmed`
   - A "Generate" button for the next ungenerated month
   - A "View / Edit" button for draft months
   - A "Confirmed ✓" badge for confirmed months

5. WHEN the admin clicks "Generate" for a month, THE Planner_Generator SHALL:
   a. Identify all Teaching_Days in that month
   b. Group them into weekly batches (Mon–Fri)
   c. For each week, call the AI with that week's compact context
   d. Assemble the weekly results into a monthly draft
   e. Display the monthly draft for admin review

6. THE AI prompt for each week SHALL be compact and structured:
   ```
   Week: June 23–27, 2025
   Teaching days: Mon Jun 23, Tue Jun 24, Wed Jun 25, Thu Jun 26, Fri Jun 27
   Holidays this week: none
   Special days: Thu Jun 26 = Sports Day (half day)

   Subjects and next topics:
   - English (3 hrs/wk): next topics → "Letters A-D: Letter A", "Letters A-D: Letter B"
   - Maths (5 hrs/wk): next topics → "Numbers 1-10: Counting to 5", "Numbers 1-10: Counting to 10"
   - Hindi (2 hrs/wk): next topics → "Unit 1: अ", "Unit 1: आ"

   Assign one subject per day. Interleave by hours. Return JSON only.
   ```

7. THE Planner_Generator SHALL display the monthly draft as a **week-by-week calendar** showing each day's subject, chapter, topic, and duration. The admin can edit any entry before confirming.

8. WHEN the admin clicks "Confirm Month", THE Planner_Generator SHALL:
   - Push that month's entries to `curriculum_chunks` and generate `day_plans` for all sections
   - Advance the Topic_Pointer for each subject to the next unplanned topic
   - Mark the month as `confirmed`
   - Show the next month's "Generate" button

9. THE Planner_Generator SHALL allow the admin to **regenerate a draft month** (before confirmation) without affecting confirmed months or the Topic_Pointer.

10. IF the admin confirms months out of order (e.g. skips a month), THE Planner_Generator SHALL warn that the Topic_Pointer may be inconsistent and require explicit acknowledgement.

11. THE Planner_Generator SHALL show a **year overview** — a simple grid of all 12 months with their status — so the admin can see at a glance how far the planner has progressed.

12. THE Planner_Generator SHALL allow the admin to **schedule automatic monthly generation** — a setting that triggers generation of the next month's draft on the 20th of the current month, ready for admin review before the month starts.

---

### Requirement 13: TOC Extraction Robustness (Enhancement)

**User Story:** As a school admin, I want the system to reliably extract chapters from any textbook PDF format, so that I don't have to manually enter all chapters.

#### Acceptance Criteria

1. THE TOC_Extractor SHALL use GPT-4o Vision as the primary extraction method — rendering the specified PDF page(s) as an image and sending it to the vision model.

2. THE TOC_Extractor SHALL accept a **TOC page range** (start page and end page) to handle multi-page tables of contents.

3. THE TOC_Extractor SHALL correctly parse:
   - Two-column layouts (title on left, decorative line in middle, page number on right)
   - Sub-headings with their own page numbers (stored as topics with page references)
   - Page ranges in formats: `4 - 11`, `4–11`, `4 – 11`
   - OCR artifacts such as `l` (lowercase L) misread as `1`

4. IF extraction fails or returns no chapters, THE Subject_Setup SHALL offer three alternatives:
   - Retry with a different page number
   - Import chapters from an Excel file (template: Chapter Title, Topics, Page Start, Page End)
   - Add chapters manually one by one

5. THE TOC_Extractor SHALL infer missing `page_end` values: if only `page_start` is shown, `page_end = next_chapter.page_start - 1` (last chapter uses total PDF page count).

6. THE TOC_Extractor SHALL normalise topics stored as `{name, page_start}` objects — always displaying the `name` field in the UI, never raw JSON.

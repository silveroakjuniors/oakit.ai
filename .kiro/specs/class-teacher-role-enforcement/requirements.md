# Requirements Document

## Introduction

This feature enforces a proper distinction between class teachers (one per section, primary responsible) and supporting teachers (many per section via `teacher_sections`). It fixes a bug where the `getTeacherSection` helper only queries `teacher_sections`, causing class teachers not in that table to receive "No section assigned" errors. It also adds multi-section selection for supporting teachers assigned to multiple sections, ensures the admin classes API returns class teacher data, and filters the admin dropdown to prevent assigning an already-assigned class teacher to a second section.

## Glossary

- **Class_Teacher**: A teacher assigned as the primary responsible teacher for a section via `sections.class_teacher_id`. There is at most one class teacher per section per school.
- **Supporting_Teacher**: A teacher assigned to a section via the `teacher_sections` join table. A supporting teacher may be assigned to multiple sections.
- **Section**: A subdivision of a class (e.g. "Grade 1 - A"). Stored in the `sections` table.
- **Teacher_Sections_Helper**: The shared utility function `getTeacherSections` in `src/lib/teacherSection.ts` that resolves all sections a teacher is authorized to act on.
- **Attendance_API**: The route handlers in `attendance.ts` that manage reading and submitting student attendance records.
- **Completion_API**: The route handlers in `completion.ts` that manage daily curriculum completion records.
- **Admin_Classes_API**: The `GET /api/v1/admin/classes` endpoint in `classes.ts`.
- **Teacher_Sections_API**: The new `GET /api/v1/teacher/sections` endpoint.
- **Admin_Classes_Page**: The frontend page at `admin/classes/page.tsx`.
- **Teacher_Attendance_Page**: The frontend page at `teacher/attendance/page.tsx`.

## Requirements

### Requirement 1: Unified Teacher Section Resolution

**User Story:** As a class teacher, I want the system to recognize my section assignment, so that I can take attendance and update completion without receiving "No section assigned" errors.

#### Acceptance Criteria

1. THE Teacher_Sections_Helper SHALL query both `sections.class_teacher_id` and `teacher_sections` to resolve all sections a teacher is authorized to act on.
2. WHEN a teacher is assigned as class teacher for a section, THE Teacher_Sections_Helper SHALL include that section with role `class_teacher` in the result.
3. WHEN a teacher is assigned as a supporting teacher for a section via `teacher_sections`, THE Teacher_Sections_Helper SHALL include that section with role `supporting` in the result.
4. WHEN a teacher is assigned as both class teacher and supporting teacher for the same section, THE Teacher_Sections_Helper SHALL return that section exactly once with role `class_teacher`.
5. WHEN a teacher has no section assignments of either type, THE Teacher_Sections_Helper SHALL return an empty array.
6. THE Teacher_Sections_Helper SHALL deduplicate results so each `section_id` appears at most once in the returned array.

### Requirement 2: Admin Classes API Returns Class Teacher Data

**User Story:** As an admin, I want the classes API to return class teacher information for each section, so that the frontend can display and filter class teacher assignments correctly.

#### Acceptance Criteria

1. WHEN the Admin_Classes_API is called, THE Admin_Classes_API SHALL include `class_teacher_id` and `class_teacher_name` fields in each section object of the response.
2. WHEN a section has no class teacher assigned, THE Admin_Classes_API SHALL return `null` for both `class_teacher_id` and `class_teacher_name` for that section.
3. WHEN a section has a class teacher assigned, THE Admin_Classes_API SHALL return the teacher's name in `class_teacher_name` via a LEFT JOIN on the `users` table.

### Requirement 3: Admin Class Teacher Dropdown Filtering

**User Story:** As an admin, I want the class teacher assignment dropdown to exclude teachers already assigned as class teacher elsewhere, so that I cannot accidentally assign a teacher to two sections as class teacher.

#### Acceptance Criteria

1. WHEN the Admin_Classes_Page renders the class teacher assignment dropdown for a section, THE Admin_Classes_Page SHALL exclude teachers who are already assigned as class teacher in any other section.
2. WHEN a section already has a class teacher assigned, THE Admin_Classes_Page SHALL include that teacher in the dropdown for their own section so they remain selectable.
3. WHEN the Admin_Classes_API returns `class_teacher_id` values, THE Admin_Classes_Page SHALL derive the set of assigned class teacher IDs from the loaded data to perform the filtering.

### Requirement 4: Teacher Sections Endpoint

**User Story:** As a teacher, I want an API endpoint that returns all sections I am authorized to act on, so that the frontend can present a section picker when I am assigned to multiple sections.

#### Acceptance Criteria

1. WHEN the Teacher_Sections_API is called by an authenticated teacher, THE Teacher_Sections_API SHALL return all sections the teacher is authorized to act on, including `section_id`, `section_label`, `class_name`, and `role`.
2. WHEN the teacher has no section assignments, THE Teacher_Sections_API SHALL return an empty array.
3. THE Teacher_Sections_API SHALL use the Teacher_Sections_Helper to resolve section assignments.

### Requirement 5: Attendance API Multi-Section Support

**User Story:** As a teacher assigned to multiple sections, I want to specify which section I am submitting attendance for, so that attendance is recorded against the correct section.

#### Acceptance Criteria

1. WHEN the Attendance_API receives a request, THE Attendance_API SHALL use the Teacher_Sections_Helper instead of the legacy `getTeacherSection` function to resolve the teacher's sections.
2. WHEN the Teacher_Sections_Helper returns an empty array, THE Attendance_API SHALL respond with HTTP 404 and error `No section assigned`.
3. WHEN the Teacher_Sections_Helper returns exactly one section, THE Attendance_API SHALL use that section automatically without requiring a `section_id` parameter.
4. WHEN the Teacher_Sections_Helper returns multiple sections and no `section_id` query parameter is provided, THE Attendance_API SHALL respond with HTTP 400 and error `section_id required — you are assigned to multiple sections`.
5. WHEN the Teacher_Sections_Helper returns multiple sections and a `section_id` query parameter is provided, THE Attendance_API SHALL validate that the requested section is in the teacher's authorized list.
6. IF the provided `section_id` is not in the teacher's authorized section list, THEN THE Attendance_API SHALL respond with HTTP 403 and error `Not authorized for this section`.

### Requirement 6: Completion API Multi-Section Support

**User Story:** As a teacher assigned to multiple sections, I want to specify which section I am submitting curriculum completion for, so that completion is recorded against the correct section.

#### Acceptance Criteria

1. WHEN the Completion_API receives a request, THE Completion_API SHALL use the Teacher_Sections_Helper instead of the legacy `getTeacherSection` function to resolve the teacher's sections.
2. WHEN the Teacher_Sections_Helper returns an empty array, THE Completion_API SHALL respond with HTTP 404 and error `No section assigned`.
3. WHEN the Teacher_Sections_Helper returns exactly one section, THE Completion_API SHALL use that section automatically without requiring a `section_id` parameter.
4. WHEN the Teacher_Sections_Helper returns multiple sections and no `section_id` parameter is provided, THE Completion_API SHALL respond with HTTP 400 and error `section_id required — you are assigned to multiple sections`.
5. WHEN the Teacher_Sections_Helper returns multiple sections and a `section_id` parameter is provided, THE Completion_API SHALL validate that the requested section is in the teacher's authorized list.
6. IF the provided `section_id` is not in the teacher's authorized section list, THEN THE Completion_API SHALL respond with HTTP 403 and error `Not authorized for this section`.

### Requirement 7: Teacher Attendance Page Section Picker

**User Story:** As a teacher assigned to multiple sections, I want the attendance page to show a section picker, so that I can choose which section to take attendance for before seeing the student list.

#### Acceptance Criteria

1. WHEN the Teacher_Attendance_Page loads, THE Teacher_Attendance_Page SHALL call the Teacher_Sections_API to retrieve the teacher's assigned sections.
2. WHEN the Teacher_Sections_API returns exactly one section, THE Teacher_Attendance_Page SHALL proceed directly to load attendance for that section without displaying a section picker.
3. WHEN the Teacher_Sections_API returns multiple sections, THE Teacher_Attendance_Page SHALL display a section picker UI before showing the attendance form.
4. WHEN a teacher selects a section from the picker, THE Teacher_Attendance_Page SHALL pass the selected `section_id` as a query parameter to all subsequent attendance API calls.

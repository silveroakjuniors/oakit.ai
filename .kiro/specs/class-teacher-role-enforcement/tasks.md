# Tasks: Class Teacher Role Enforcement

## Task 1: Create `getTeacherSections` shared helper

- [x] 1.1 Create `oakit/apps/api-gateway/src/lib/teacherSection.ts` with the `getTeacherSections` function that queries both `sections.class_teacher_id` and `teacher_sections`, merges results deduplicating by `section_id` with class_teacher role taking precedence, and returns an empty array when no sections are found
- [x] 1.2 Write unit tests for `getTeacherSections` covering: class teacher only, supporting only, both paths (same section dedup with precedence), neither (empty result), and multiple supporting sections

## Task 2: Update `GET /api/v1/admin/classes` to include class teacher fields

- [x] 2.1 In `oakit/apps/api-gateway/src/routes/admin/classes.ts`, add a LEFT JOIN on `users` aliased as `ct` on `ct.id = s.class_teacher_id` and include `class_teacher_id` and `class_teacher_name` (as `ct.name`) in the `json_build_object` for each section

## Task 3: Add `GET /api/v1/teacher/sections` endpoint

- [x] 3.1 Create `oakit/apps/api-gateway/src/routes/teacher/sections.ts` with a GET `/` handler that calls `getTeacherSections` and returns each section enriched with `section_label` and `class_name` via a JOIN on `sections` and `classes`
- [x] 3.2 Register the new router in `oakit/apps/api-gateway/src/index.ts` at `/api/v1/teacher/sections`

## Task 4: Update `attendance.ts` to use `getTeacherSections`

- [x] 4.1 Remove the local `getTeacherSection` function from `attendance.ts` and import `getTeacherSections` from `src/lib/teacherSection.ts`
- [x] 4.2 Update all three route handlers (`GET /today`, `POST /today`, `GET /:date`) to call `getTeacherSections`, return 404 when empty, auto-select when single, and require/validate `section_id` query param when multiple sections are returned

## Task 5: Update `completion.ts` to use `getTeacherSections`

- [x] 5.1 Remove the local `getTeacherSection` function from `completion.ts` and import `getTeacherSections` from `src/lib/teacherSection.ts`
- [x] 5.2 Update `POST /`, `PUT /:id`, and `GET /pending` handlers to call `getTeacherSections`, return 404 when empty, auto-select when single, and require/validate `section_id` param when multiple sections are returned

## Task 6: Update Admin Classes Page dropdown filtering

- [x] 6.1 In `oakit/apps/frontend/src/app/admin/classes/page.tsx`, derive `assignedClassTeacherIds` as a Set from all loaded sections' `class_teacher_id` values and filter the class teacher assignment dropdown to exclude teachers already assigned as class teacher in any other section (while keeping the current section's own teacher in the list)

## Task 7: Update Teacher Attendance Page with section picker

- [x] 7.1 In `oakit/apps/frontend/src/app/teacher/attendance/page.tsx`, add a `SectionOption` interface and state for `sections` and `selectedSectionId`; on load call `GET /api/v1/teacher/sections` and auto-select if only one section is returned
- [x] 7.2 Render a section picker UI (dropdown or card list) when `sections.length > 1` and no section is selected yet, and pass `?section_id=<id>` to all attendance API calls once a section is selected

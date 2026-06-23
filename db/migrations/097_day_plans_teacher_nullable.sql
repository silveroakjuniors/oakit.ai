-- Migration 097: Make day_plans.teacher_id nullable
-- Plans belong to the section, not the teacher.
-- A teacher change mid-year should not affect plan data.
-- Plans are always looked up by section_id — teacher_id is never used in queries.

-- 1. Drop the NOT NULL constraint and FK (we keep the column for audit trail but it's optional)
ALTER TABLE day_plans
  ALTER COLUMN teacher_id DROP NOT NULL;

-- 2. Drop the index that references teacher_id (section_id index is sufficient)
DROP INDEX IF EXISTS day_plans_teacher_id_plan_date_idx;

-- 3. Also make classTeacher assignment stop updating day_plans teacher_id
--    (handled in application code — no SQL needed here)

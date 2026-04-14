-- Migration 045: Add date_of_birth to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE;
CREATE INDEX IF NOT EXISTS idx_students_dob ON students(date_of_birth);
COMMENT ON COLUMN students.date_of_birth IS 'Used for birthday wishes and age calculations';

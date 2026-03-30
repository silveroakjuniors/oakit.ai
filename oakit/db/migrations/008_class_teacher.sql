-- Migration 008: Class teacher uniqueness per section

ALTER TABLE sections
  ADD COLUMN IF NOT EXISTS class_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- A teacher can be class_teacher for at most one section per school
CREATE UNIQUE INDEX IF NOT EXISTS sections_class_teacher_school_unique
  ON sections (class_teacher_id, school_id)
  WHERE class_teacher_id IS NOT NULL;

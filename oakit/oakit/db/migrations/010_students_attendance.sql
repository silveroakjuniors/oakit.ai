-- Migration 010: Students and attendance

CREATE TABLE IF NOT EXISTS students (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL REFERENCES classes(id),
  section_id      UUID NOT NULL REFERENCES sections(id),
  name            TEXT NOT NULL,
  father_name     TEXT,
  parent_contact  TEXT,
  photo_path      TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_school_section ON students(school_id, section_id);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students(school_id, class_id);

CREATE TABLE IF NOT EXISTS attendance_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id   UUID NOT NULL REFERENCES sections(id),
  student_id   UUID NOT NULL REFERENCES students(id),
  teacher_id   UUID NOT NULL REFERENCES users(id),
  attend_date  DATE NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (section_id, student_id, attend_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_section_date ON attendance_records(section_id, attend_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance_records(student_id, attend_date);

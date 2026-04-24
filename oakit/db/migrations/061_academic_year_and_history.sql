-- Migration 061: Academic year tracking, student history, and promotion support
--
-- Adds:
--   1. academic_year column to students (current enrollment year, e.g. "2024-25")
--   2. student_academic_history — one row per student per year, preserving class/section
--      and attendance/progress snapshots before promotion or termination
--   3. academic_years table — school-configured year definitions (start/end dates, label)
--   4. Indexes for efficient querying

-- ── Academic years (school-level configuration) ───────────────────────────────
CREATE TABLE IF NOT EXISTS academic_years (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  label        TEXT        NOT NULL,                    -- e.g. "2024-25"
  start_date   DATE        NOT NULL,
  end_date     DATE        NOT NULL,
  is_current   BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, label)
);

CREATE INDEX IF NOT EXISTS idx_academic_years_school
  ON academic_years(school_id, is_current);

-- Only one current year per school
CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_years_current
  ON academic_years(school_id)
  WHERE is_current = true;

-- ── Add academic_year label to students ───────────────────────────────────────
-- Stores the label of the year the student is currently enrolled in.
-- NULL means legacy record (pre-migration); treated as current year.
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS academic_year TEXT,          -- e.g. "2024-25"
  ADD COLUMN IF NOT EXISTS admission_date DATE,         -- date student was first admitted to the school
  ADD COLUMN IF NOT EXISTS terminated_at  TIMESTAMPTZ,  -- when is_active was set to false
  ADD COLUMN IF NOT EXISTS terminated_by  UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_academic_year
  ON students(school_id, academic_year);

-- ── Student academic history ──────────────────────────────────────────────────
-- One row per student per academic year.
-- Created automatically when a student is promoted or terminated.
-- Preserves the class/section they were in, plus snapshot stats.
CREATE TABLE IF NOT EXISTS student_academic_history (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id        UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year     TEXT        NOT NULL,               -- e.g. "2024-25"
  class_id          UUID        NOT NULL REFERENCES classes(id),
  section_id        UUID        NOT NULL REFERENCES sections(id),
  class_name        TEXT        NOT NULL,               -- denormalised for history display
  section_label     TEXT        NOT NULL,               -- denormalised for history display

  -- Outcome of this year
  outcome           TEXT        NOT NULL DEFAULT 'promoted'
    CHECK (outcome IN ('promoted', 'repeated', 'terminated', 'transferred', 'active')),

  -- Snapshot stats (populated at promotion/termination time)
  attendance_pct    NUMERIC(5,2),
  topics_covered    INT,
  total_topics      INT,

  -- Promotion target (populated when outcome = 'promoted' or 'repeated')
  promoted_to_class_id    UUID REFERENCES classes(id),
  promoted_to_section_id  UUID REFERENCES sections(id),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID        REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE (student_id, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_student_history_student
  ON student_academic_history(student_id, academic_year DESC);

CREATE INDEX IF NOT EXISTS idx_student_history_school_year
  ON student_academic_history(school_id, academic_year);

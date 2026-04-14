-- Migration 012: Special calendar days (settling, revision, exam, event)
-- These are school days where teachers are present but no new curriculum chunks are assigned

CREATE TABLE IF NOT EXISTS special_days (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  day_date      DATE NOT NULL,
  day_type      TEXT NOT NULL CHECK (day_type IN ('settling', 'revision', 'exam', 'event')),
  label         TEXT NOT NULL,  -- e.g. "Term 1 Exam", "Christmas Settling", "Sports Day"
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, academic_year, day_date)
);

CREATE INDEX IF NOT EXISTS idx_special_days_school_year ON special_days(school_id, academic_year, day_date);

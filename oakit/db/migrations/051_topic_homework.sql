-- Migration 051: Per-chunk topic homework generation
-- Extends teacher_homework to support per-chunk homework with history tracking.

ALTER TABLE teacher_homework
  ADD COLUMN IF NOT EXISTS chunk_id       UUID REFERENCES curriculum_chunks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS topic_label    TEXT,
  ADD COLUMN IF NOT EXISTS teacher_comments TEXT;

-- Drop old section+date unique constraint, add section+chunk+date unique
-- (old rows with chunk_id = NULL are unaffected — they keep the old section+date constraint)
ALTER TABLE teacher_homework
  DROP CONSTRAINT IF EXISTS teacher_homework_section_id_homework_date_key;

-- New unique: one homework per chunk per day per section
CREATE UNIQUE INDEX IF NOT EXISTS teacher_homework_chunk_date_unique
  ON teacher_homework (section_id, chunk_id, homework_date)
  WHERE chunk_id IS NOT NULL;

-- Keep old unique for legacy section-level homework (chunk_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS teacher_homework_section_date_unique
  ON teacher_homework (section_id, homework_date)
  WHERE chunk_id IS NULL;

-- Homework edit history (Req 7.4 — preserve original + all updates)
CREATE TABLE IF NOT EXISTS homework_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id     UUID NOT NULL REFERENCES teacher_homework(id) ON DELETE CASCADE,
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  raw_text        TEXT NOT NULL,
  formatted_text  TEXT,
  teacher_comments TEXT,
  saved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  saved_by        UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_homework_history_homework ON homework_history(homework_id, saved_at DESC);

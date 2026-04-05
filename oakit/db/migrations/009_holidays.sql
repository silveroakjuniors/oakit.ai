-- Migration 009: Dedicated holidays table

CREATE TABLE IF NOT EXISTS holidays (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  holiday_date  DATE NOT NULL,
  event_name    TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (school_id, academic_year, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_school_year_date
  ON holidays(school_id, academic_year, holiday_date);

-- Add start_page to curriculum_documents (for table-based PDFs)
ALTER TABLE curriculum_documents
  ADD COLUMN IF NOT EXISTS start_page INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ingestion_stage TEXT DEFAULT NULL;

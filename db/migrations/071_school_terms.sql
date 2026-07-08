-- Migration 071: School term date ranges
-- Allows admin to define Term 1, Term 2, Term 3 (and Annual) date ranges
-- These are used to filter milestones, reports, and progress tracking by term

CREATE TABLE IF NOT EXISTS school_terms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  term_name     TEXT NOT NULL CHECK (term_name IN ('Term 1', 'Term 2', 'Term 3', 'Annual')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, academic_year, term_name)
);

CREATE INDEX IF NOT EXISTS idx_school_terms_school ON school_terms(school_id, academic_year);

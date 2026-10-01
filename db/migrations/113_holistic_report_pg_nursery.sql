-- Migration 113: Add Playgroup/Nursery-specific fields to holistic_reports
-- These fields support the Silver Oak Juniors Progress Report format.
-- All columns are nullable so existing Jr.KG/Sr.KG reports are unaffected.

ALTER TABLE holistic_reports
  -- Playgroup/Nursery narrative sections
  ADD COLUMN IF NOT EXISTS strengths            TEXT,   -- "My Strengths" — what child enjoys/demonstrates well
  ADD COLUMN IF NOT EXISTS developing_skills    TEXT,   -- "Developing Skills" — what child is working towards
  ADD COLUMN IF NOT EXISTS at_school_support    TEXT,   -- "How We Can Support" — at school
  ADD COLUMN IF NOT EXISTS at_home_support      TEXT,   -- "How We Can Support" — at home
  ADD COLUMN IF NOT EXISTS silver_oak_moment    TEXT,   -- "My Silver Oak Moment" — something special noticed
  -- Child profile metadata (for PDF header)
  ADD COLUMN IF NOT EXISTS attendance           TEXT,   -- e.g. "42/50 days"
  -- report_format controls which PDF template to use
  ADD COLUMN IF NOT EXISTS report_format        TEXT NOT NULL DEFAULT 'standard'
    CHECK (report_format IN ('standard', 'pg_nursery'));
    -- 'pg_nursery'  → Silver Oak Juniors Playgroup/Nursery format (Growth Statements, narrative fields)
    -- 'standard'    → Jr.KG / Sr.KG format (E/V/G/S/P subject grades, NCFES)

COMMENT ON COLUMN holistic_reports.report_format IS
  'Controls which report template is rendered. pg_nursery uses Growth Statements and narrative fields; standard uses E/V/G/S/P ratings.';

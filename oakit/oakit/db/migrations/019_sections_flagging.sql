-- Migration 019: sections flagging columns

ALTER TABLE sections
  ADD COLUMN IF NOT EXISTS flagged     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_note   TEXT,
  ADD COLUMN IF NOT EXISTS flagged_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flagged_by  UUID REFERENCES users(id) ON DELETE SET NULL;

-- Partial index for fast lookup of flagged sections per school
CREATE INDEX IF NOT EXISTS idx_sections_flagged ON sections(school_id, flagged) WHERE flagged = true;

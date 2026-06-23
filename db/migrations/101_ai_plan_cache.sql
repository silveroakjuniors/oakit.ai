-- Migration 101: Separate AI plan cache table
-- Maps chunk_ids hash to generated plan text.
-- One row per unique set of chunks — no duplication across sections.

CREATE TABLE IF NOT EXISTS ai_plan_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_hash  TEXT NOT NULL UNIQUE,  -- MD5 hash of sorted chunk_ids array
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  chunk_ids   UUID[] NOT NULL,
  ai_text     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_plan_cache_hash ON ai_plan_cache(chunk_hash);

-- Remove the ai_plan_text column from day_plans (no longer needed)
ALTER TABLE day_plans DROP COLUMN IF EXISTS ai_plan_text;

COMMENT ON TABLE ai_plan_cache IS 'Stores AI-generated plan text per unique chunk combination. Shared across all sections with the same chunks.';

-- Migration 095: Fix special_days table — add missing columns and drop restrictive day_type CHECK
-- The original migration 012 only had 4 allowed day_type values and was missing several columns
-- that the API now uses. This migration safely adds them all.

-- 1. Drop the hard-coded CHECK constraint so any custom day_type is allowed
ALTER TABLE special_days DROP CONSTRAINT IF EXISTS special_days_day_type_check;

-- 2. Add activity_note (migration 014 equivalent)
ALTER TABLE special_days
  ADD COLUMN IF NOT EXISTS activity_note TEXT;

-- 3. Add start_time / end_time for settling periods (migration 015 equivalent)
ALTER TABLE special_days
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time   TIME;

-- 4. Add duration_type — full_day or half_day (migration 017 equivalent)
ALTER TABLE special_days
  ADD COLUMN IF NOT EXISTS duration_type TEXT NOT NULL DEFAULT 'full_day'
    CHECK (duration_type IN ('full_day', 'half_day'));

-- 5. Add revision_topics array (migration 017 equivalent)
ALTER TABLE special_days
  ADD COLUMN IF NOT EXISTS revision_topics TEXT[] DEFAULT '{}';

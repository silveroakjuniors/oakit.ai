-- Migration 016: Add settling_day_note to daily_completions
-- Used when teacher marks a settling day as completed — stores what was done for parent notification
ALTER TABLE daily_completions ADD COLUMN IF NOT EXISTS settling_day_note TEXT;

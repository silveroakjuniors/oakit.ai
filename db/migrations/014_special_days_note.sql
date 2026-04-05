-- Migration 014: Add activity_note to special_days for admin to specify what to do on that day
ALTER TABLE special_days ADD COLUMN IF NOT EXISTS activity_note TEXT;

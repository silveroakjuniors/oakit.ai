-- Migration 017: Smart Curriculum Planning schema changes
-- Supports extended event types, half-day handling, and revision topic tagging

-- Drop the hard-coded CHECK constraint on day_type to allow custom event types
ALTER TABLE special_days DROP CONSTRAINT IF EXISTS special_days_day_type_check;

-- Add duration_type with its own CHECK (full_day or half_day)
ALTER TABLE special_days
  ADD COLUMN IF NOT EXISTS duration_type TEXT NOT NULL DEFAULT 'full_day'
    CHECK (duration_type IN ('full_day', 'half_day'));

-- Add revision_topics array for tagging revision days with topic areas
ALTER TABLE special_days
  ADD COLUMN IF NOT EXISTS revision_topics TEXT[] DEFAULT '{}';

-- Add carry_forward_fragment to day_plans for half-day chunk overflow
ALTER TABLE day_plans
  ADD COLUMN IF NOT EXISTS carry_forward_fragment TEXT;

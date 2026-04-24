-- Migration 062: Add child_age to enquiries
-- Allows parents submitting public enquiries to specify their child's age,
-- which helps the school determine the appropriate class placement.

ALTER TABLE enquiries
  ADD COLUMN IF NOT EXISTS child_age TEXT;  -- free-text age, e.g. "4 years" or "4"

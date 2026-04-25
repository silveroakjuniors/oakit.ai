-- Migration 065: Instagram handle for school social sharing
-- Stores the school's Instagram username so it can be tagged in parent-shared feed posts

ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT;

COMMENT ON COLUMN school_settings.instagram_handle IS
  'School Instagram username (without @). Used to auto-tag the school when parents share class feed photos to Instagram/Facebook.';

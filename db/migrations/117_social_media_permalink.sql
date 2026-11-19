-- Migration 117: Add permalink column to social_media_post_platforms
-- Stores the direct URL to the post on Instagram/Facebook after publishing

ALTER TABLE social_media_post_platforms
  ADD COLUMN IF NOT EXISTS permalink TEXT DEFAULT NULL;

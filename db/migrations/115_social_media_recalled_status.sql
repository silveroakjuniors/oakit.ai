-- Migration 115: Add 'recalled' to social_media_posts status constraint

ALTER TABLE social_media_posts
  DROP CONSTRAINT IF EXISTS social_media_posts_status_check;

ALTER TABLE social_media_posts
  ADD CONSTRAINT social_media_posts_status_check
  CHECK (status IN ('pending_approval','approved','rejected','published','partially_published','failed','recalled'));

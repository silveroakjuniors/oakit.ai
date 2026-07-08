-- Migration 100: Add video support to feed posts
-- Videos: max 25MB, auto-delete after 5 days
ALTER TABLE feed_post_images ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image';
COMMENT ON COLUMN feed_post_images.media_type IS 'image or video';

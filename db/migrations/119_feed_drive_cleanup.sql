-- Migration 119: Feed Drive cleanup scheduling columns
-- Tracks when admin scheduled a cleanup and when files were deleted

ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS drive_cleanup_scheduled_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS drive_delete_after          DATE        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS drive_files_deleted         BOOLEAN     NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_feed_posts_drive_cleanup
  ON feed_posts(school_id, drive_delete_after)
  WHERE drive_files_deleted = false AND drive_delete_after IS NOT NULL;

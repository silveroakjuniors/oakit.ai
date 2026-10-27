-- Migration 108: Fix feed_post_images rows that were incorrectly tagged as 'image'
-- before migration 100 added the media_type column (DEFAULT was 'image' for all rows).
-- Detects videos by checking the storage_path file extension.

UPDATE feed_post_images
SET media_type = 'video'
WHERE media_type = 'image'
  AND (
    storage_path ~* '\.(mp4|mov|webm|3gp|m4v|quicktime)$'
    OR cdn_url    ~* '\.(mp4|mov|webm|3gp|m4v|quicktime)(\?.*)?$'
  );

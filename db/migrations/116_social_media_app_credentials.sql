-- Migration 116: Add app_id and app_secret to social_media_configs for token auto-refresh
ALTER TABLE social_media_configs
  ADD COLUMN IF NOT EXISTS app_id     TEXT,
  ADD COLUMN IF NOT EXISTS app_secret TEXT; -- AES-256 encrypted

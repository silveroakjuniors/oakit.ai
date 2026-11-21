-- Migration 107: Google Drive configuration for teacher media uploads
-- Stores school-level Google Drive folder configuration for media upload

CREATE TABLE IF NOT EXISTS google_drive_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    enabled         BOOLEAN NOT NULL DEFAULT false,
    folder_id       TEXT,                   -- Google Drive folder ID where media is uploaded
    auth            JSONB,                  -- OAuth credentials (access_token, refresh_token, etc.)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ,
    UNIQUE(school_id)
);

-- Add google_drive_config table to school_settings for easier config access
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS google_drive_enabled BOOLEAN DEFAULT false;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS google_drive_class_folder TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS google_drive_auth JSONB;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_google_drive_config_school ON google_drive_config(school_id);
CREATE INDEX IF NOT EXISTS idx_school_settings_drive ON school_settings(school_id);

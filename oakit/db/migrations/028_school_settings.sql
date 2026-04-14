-- Migration 028: School-level configurable settings
-- Stores per-school configuration like notes expiry days

CREATE TABLE IF NOT EXISTS school_settings (
    school_id           UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
    notes_expiry_days   INT NOT NULL DEFAULT 14,   -- how long teacher notes/attachments are kept
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default settings for all existing schools
INSERT INTO school_settings (school_id, notes_expiry_days)
SELECT id, 14 FROM schools
ON CONFLICT (school_id) DO NOTHING;

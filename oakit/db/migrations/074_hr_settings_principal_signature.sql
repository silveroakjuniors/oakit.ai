-- Migration 074: Add principal signature to hr_settings
ALTER TABLE hr_settings
  ADD COLUMN IF NOT EXISTS principal_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS principal_designation TEXT;

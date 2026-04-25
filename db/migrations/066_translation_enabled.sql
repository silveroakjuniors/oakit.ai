-- Migration 066: Translation feature flag per school
-- Enabled by default for all schools. Super admin can disable per school.

ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS translation_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN school_settings.translation_enabled IS
  'When true, parents can use the multilingual translation feature in the parent portal. Enabled by default. Super admin can disable per school.';

-- Enable for all existing schools
UPDATE school_settings SET translation_enabled = true WHERE translation_enabled IS NULL;

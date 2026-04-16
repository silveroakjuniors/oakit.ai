-- Migration 047: Voice input feature toggle
-- Adds voice_enabled flag to school_settings
-- Super admin and admin can enable/disable per school

ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS voice_enabled BOOLEAN NOT NULL DEFAULT false;

-- Comment for documentation
COMMENT ON COLUMN school_settings.voice_enabled IS
  'When true, voice input (mic button) is shown in Oakie chat for teachers and parents. Audio is transcribed via Gemini.';

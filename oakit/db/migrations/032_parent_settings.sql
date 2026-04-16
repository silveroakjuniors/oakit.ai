-- Migration 032: parent_settings
CREATE TABLE IF NOT EXISTS parent_settings (
  parent_id UUID PRIMARY KEY REFERENCES parent_users(id) ON DELETE CASCADE,
  notification_prefs JSONB DEFAULT '{}'::jsonb,
  calendar_sync BOOLEAN DEFAULT false,
  assistant_reminders BOOLEAN DEFAULT false,
  translation_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_settings_parent ON parent_settings(parent_id);

CREATE OR REPLACE FUNCTION set_updated_at_parent_settings()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_parent_settings ON parent_settings;
CREATE TRIGGER trg_set_updated_at_parent_settings
BEFORE UPDATE ON parent_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at_parent_settings();

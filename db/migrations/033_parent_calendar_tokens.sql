-- Migration 033: parent_calendar_tokens
CREATE TABLE IF NOT EXISTS parent_calendar_tokens (
  parent_id UUID REFERENCES parent_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  code TEXT,
  access_token TEXT,
  refresh_token TEXT,
  scope TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending', -- pending, authorized, error
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (parent_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_parent_calendar_tokens_parent ON parent_calendar_tokens(parent_id);

CREATE OR REPLACE FUNCTION set_updated_at_parent_calendar_tokens()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_parent_calendar_tokens ON parent_calendar_tokens;
CREATE TRIGGER trg_set_updated_at_parent_calendar_tokens
BEFORE UPDATE ON parent_calendar_tokens
FOR EACH ROW EXECUTE FUNCTION set_updated_at_parent_calendar_tokens();

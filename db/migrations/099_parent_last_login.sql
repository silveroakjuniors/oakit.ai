-- Migration 099: Add last_login to parent_users for tracking login activity
ALTER TABLE parent_users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_parent_users_last_login ON parent_users(school_id, last_login);
COMMENT ON COLUMN parent_users.last_login IS 'Timestamp of last successful login. NULL = never logged in.';

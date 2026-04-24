-- Migration 063: Track parent mobile number changes (once-only policy)
-- Once a parent's mobile number is updated from the parent portal,
-- it cannot be changed again (mobile is the login credential).

ALTER TABLE parent_users
  ADD COLUMN IF NOT EXISTS mobile_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mobile_updated_by TEXT; -- 'parent' | 'admin'

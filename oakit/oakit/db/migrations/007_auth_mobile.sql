-- Migration 007: Replace email with mobile number auth + security questions

-- Security questions lookup table
CREATE TABLE IF NOT EXISTS security_questions (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text  TEXT NOT NULL UNIQUE
);

INSERT INTO security_questions (text) VALUES
  ('What is the name of your first pet?'),
  ('What city were you born in?'),
  ('What is your mother''s maiden name?'),
  ('What was the name of your first school?'),
  ('What is your favourite childhood book?'),
  ('What is the name of your childhood best friend?')
ON CONFLICT (text) DO NOTHING;

-- Add mobile auth columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mobile TEXT,
  ADD COLUMN IF NOT EXISTS force_password_reset BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS security_question_id UUID REFERENCES security_questions(id),
  ADD COLUMN IF NOT EXISTS security_answer_hash TEXT;

-- Backfill mobile from email for existing users (use email as mobile placeholder)
UPDATE users SET mobile = email WHERE mobile IS NULL;

-- Make mobile NOT NULL after backfill
ALTER TABLE users ALTER COLUMN mobile SET NOT NULL;

-- Unique mobile per school
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_school_mobile_unique;
ALTER TABLE users ADD CONSTRAINT users_school_mobile_unique UNIQUE (school_id, mobile);

CREATE INDEX IF NOT EXISTS idx_users_school_mobile ON users(school_id, mobile);

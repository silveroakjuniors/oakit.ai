-- Migration 013: Make email nullable (mobile is now the primary auth identifier)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

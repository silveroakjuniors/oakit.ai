-- Migration 067: Add mobile update tracking columns to parent_users
ALTER TABLE parent_users
  ADD COLUMN IF NOT EXISTS mobile_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mobile_updated_by TEXT;

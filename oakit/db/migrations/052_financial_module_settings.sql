-- Migration 052: Financial Module Settings
-- Per-school toggle for the financial module and its sub-modules.
-- Also adds per-user financial permission overrides to the users table.

-- ── Financial module settings (one row per school) ────────────────────────────
CREATE TABLE IF NOT EXISTS financial_module_settings (
  school_id               UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  is_enabled              BOOLEAN NOT NULL DEFAULT true,
  expense_module_enabled  BOOLEAN NOT NULL DEFAULT true,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Initialise settings for all existing schools ──────────────────────────────
INSERT INTO financial_module_settings (school_id)
  SELECT id FROM schools
  ON CONFLICT (school_id) DO NOTHING;

-- ── Per-user financial permission overrides ───────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS financial_permissions JSONB NOT NULL DEFAULT '{}';

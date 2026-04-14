-- Migration 018: schools table additions and impersonation_logs

-- Add status, plan_type, billing_status, plan_updated_at to schools
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  ADD COLUMN IF NOT EXISTS plan_type      TEXT NOT NULL DEFAULT 'basic'  CHECK (plan_type IN ('basic', 'standard', 'premium')),
  ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'active' CHECK (billing_status IN ('active', 'past_due', 'cancelled')),
  ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMPTZ;

-- Allow super_admin users to have no school
ALTER TABLE users ALTER COLUMN school_id DROP NOT NULL;

-- Add role column to users if not already a text field (it may be role_id FK)
-- super_admin users will have role = 'super_admin' and school_id = NULL
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;

-- Impersonation audit log
CREATE TABLE IF NOT EXISTS impersonation_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  jti             TEXT NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_super_admin_id ON impersonation_logs(super_admin_id);

-- Migration 049: Franchise Admin
-- A franchise is a group of schools under one owner (e.g. a chain like "Silver Oak Juniors").
-- franchise_admin users can see all schools in their franchise — usage, credits, stats.
-- Super-admin creates franchises and assigns schools to them.
-- Franchise admins CANNOT modify school settings or recharge credits — read-only view.

-- ── Franchise groups ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS franchises (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  contact     JSONB,                          -- { email, phone, address }
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Link schools to a franchise (one school → one franchise) ─────────────────
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schools_franchise_id ON schools(franchise_id);

-- ── Franchise admin users live in the users table with role = 'franchise_admin'
-- They have school_id = NULL (like super_admin) but are scoped to their franchise.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_franchise_id ON users(franchise_id);

-- ── Franchise admin can be allocated a credit budget by super_admin.
-- When they recharge a school under them, it draws from this budget.
CREATE TABLE IF NOT EXISTS franchise_ai_wallet (
  franchise_id        UUID PRIMARY KEY REFERENCES franchises(id) ON DELETE CASCADE,
  balance_paise       BIGINT NOT NULL DEFAULT 0,
  lifetime_used_paise BIGINT NOT NULL DEFAULT 0,
  lifetime_recharged_paise BIGINT NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Franchise credit transactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS franchise_credit_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id        UUID NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  school_id           UUID REFERENCES schools(id) ON DELETE SET NULL,  -- null = franchise-level top-up
  type                TEXT NOT NULL CHECK (type IN ('recharge', 'allocation', 'adjustment')),
  amount_paise        BIGINT NOT NULL,
  balance_after_paise BIGINT NOT NULL,
  description         TEXT,
  actor_id            UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON franchise_credit_transactions(franchise_id, created_at DESC);

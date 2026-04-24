-- Migration 048: AI Credits & Usage Billing System
-- Super-admin allocates ₹ credits to each school.
-- Every AI call deducts a cost. When balance hits 0, AI is blocked until recharged.

-- ── School AI wallet ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_ai_wallet (
  school_id           UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  balance_paise       BIGINT NOT NULL DEFAULT 0,        -- balance in paise (₹1 = 100 paise)
  lifetime_used_paise BIGINT NOT NULL DEFAULT 0,        -- total ever consumed
  lifetime_recharged_paise BIGINT NOT NULL DEFAULT 0,   -- total ever added
  low_balance_alerted BOOLEAN NOT NULL DEFAULT false,   -- suppress duplicate low-balance alerts
  blocked             BOOLEAN NOT NULL DEFAULT false,   -- true = AI calls blocked
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Credit transactions (recharges + deductions) ─────────────────────────────
CREATE TABLE IF NOT EXISTS ai_credit_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('recharge', 'deduction', 'adjustment')),
  amount_paise    BIGINT NOT NULL,                      -- positive = credit, negative = debit
  balance_after_paise BIGINT NOT NULL,                  -- snapshot of balance after this txn
  description     TEXT,                                 -- e.g. "Monthly recharge by super_admin"
  endpoint        TEXT,                                 -- which AI endpoint caused deduction
  actor_id        UUID REFERENCES users(id),            -- who triggered (super_admin for recharges)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON ai_credit_transactions(school_id, created_at DESC);
CREATE INDEX ON ai_credit_transactions(school_id, type);

-- ── Per-call AI usage log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES users(id),
  actor_role      TEXT,
  endpoint        TEXT NOT NULL,                        -- e.g. 'query', 'topic-summary', 'quiz'
  provider        TEXT,                                 -- 'gemini' | 'openai' | 'none'
  input_tokens    INT NOT NULL DEFAULT 0,
  output_tokens   INT NOT NULL DEFAULT 0,
  cost_paise      INT NOT NULL DEFAULT 0,               -- cost charged for this call
  outcome         TEXT,                                 -- 'allowed' | 'blocked_limit' | etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON ai_usage_logs(school_id, created_at DESC);
CREATE INDEX ON ai_usage_logs(school_id, endpoint);
CREATE INDEX ON ai_usage_logs(created_at DESC);          -- for platform-wide reports

-- ── Per-school pricing config (set by super_admin) ───────────────────────────
CREATE TABLE IF NOT EXISTS school_ai_pricing (
  school_id           UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  -- Cost per 1000 tokens in paise (super_admin sets this, includes markup)
  cost_per_1k_input_paise   INT NOT NULL DEFAULT 15,    -- default ₹0.15 / 1K input tokens
  cost_per_1k_output_paise  INT NOT NULL DEFAULT 60,    -- default ₹0.60 / 1K output tokens
  -- Flat per-call cost for endpoints that don't report tokens
  flat_cost_paise           INT NOT NULL DEFAULT 5,     -- ₹0.05 per call fallback
  -- Low balance warning threshold
  low_balance_threshold_paise BIGINT NOT NULL DEFAULT 50000, -- warn at ₹500
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID REFERENCES users(id)
);

-- ── Initialise wallet + pricing for all existing schools ─────────────────────
INSERT INTO school_ai_wallet (school_id)
  SELECT id FROM schools
  ON CONFLICT (school_id) DO NOTHING;

INSERT INTO school_ai_pricing (school_id)
  SELECT id FROM schools
  ON CONFLICT (school_id) DO NOTHING;

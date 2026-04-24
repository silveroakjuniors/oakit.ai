-- Migration 053: Fee Structures
-- Defines the fee structure hierarchy: fee_structures → fee_heads → fee_instalments.
-- fee_structures are scoped to a school and optionally a class.
-- fee_heads describe individual charge components with flexible pricing models.
-- fee_instalments define the instalment schedule for instalment-based fee heads.

-- ── Fee structures (one per class per academic year) ──────────────────────────
CREATE TABLE IF NOT EXISTS fee_structures (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id        UUID        REFERENCES classes(id) ON DELETE SET NULL,  -- NULL = school-wide structure
  name            TEXT        NOT NULL,
  academic_year   TEXT        NOT NULL,                                    -- e.g. '2024-25'
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Fee heads (charge components within a fee structure) ──────────────────────
CREATE TABLE IF NOT EXISTS fee_heads (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_structure_id        UUID          NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
  school_id               UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name                    TEXT          NOT NULL,

  -- Category of charge
  type                    TEXT          NOT NULL
    CHECK (type IN ('admission', 'tuition', 'transport', 'activity', 'custom')),

  -- How the fee is billed
  pricing_model           TEXT          NOT NULL
    CHECK (pricing_model IN ('fixed', 'instalment', 'monthly_calculated')),

  -- Fixed / instalment amount
  amount                  NUMERIC(12,2),

  -- monthly_calculated inputs
  billing_basis           TEXT
    CHECK (billing_basis IN ('per_hour', 'per_day', 'per_week', 'per_month_flat')),
  rate                    NUMERIC(12,2),                                   -- rate per unit
  hours_per_day           NUMERIC(5,2),                                    -- for per_hour basis
  days_per_week           NUMERIC(5,2),                                    -- for per_hour / per_day basis

  -- monthly_calculated outputs (stored for display / audit)
  calculated_monthly_fee  NUMERIC(12,2),
  rounded_monthly_fee     NUMERIC(12,2),

  -- Instalment configuration
  instalment_count        INTEGER,                                         -- number of instalments
  booking_amount          NUMERIC(12,2),                                   -- upfront booking charge

  -- Late fee configuration
  late_fee_amount         NUMERIC(12,2),
  late_fee_grace_days     INTEGER       NOT NULL DEFAULT 0,                -- days after due date before late fee applies

  -- Flags
  is_variable             BOOLEAN       NOT NULL DEFAULT false,            -- amount can be overridden per student

  -- Soft-delete
  deleted_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Fee instalments (schedule for instalment-based fee heads) ─────────────────
CREATE TABLE IF NOT EXISTS fee_instalments (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_head_id         UUID          NOT NULL REFERENCES fee_heads(id) ON DELETE CASCADE,
  school_id           UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  due_date            DATE          NOT NULL,
  amount              NUMERIC(12,2) NOT NULL,
  instalment_number   INTEGER       NOT NULL,                              -- 1-based sequence within the fee head
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

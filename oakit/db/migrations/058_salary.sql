-- Migration 058: Salary
-- Manages staff salary configuration, monthly working day settings, generated
-- salary records with deduction/override logic, and the Principal PIN used to
-- gate access to all salary data.

-- ── Staff Salary Config ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_salary_config (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id        UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gross_salary   NUMERIC(12,2) NOT NULL CHECK (gross_salary > 0),
  components     JSONB         NOT NULL DEFAULT '[]',                       -- array of salary component objects (name, type, amount)
  effective_from DATE          NOT NULL,                                    -- date from which this salary config takes effect
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id, effective_from)
);

-- ── Monthly Working Days ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_working_days (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  year                INTEGER     NOT NULL,
  month               INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
  working_days        INTEGER     NOT NULL CHECK (working_days > 0),
  calculation_method  TEXT        NOT NULL
    CHECK (calculation_method IN ('weekday_count', 'calendar_days', 'custom_working_days')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, year, month)
);

-- ── Salary Records ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salary_records (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id          UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year             INTEGER       NOT NULL,
  month            INTEGER       NOT NULL CHECK (month BETWEEN 1 AND 12),
  gross_salary     NUMERIC(12,2) NOT NULL,
  present_days     INTEGER       NOT NULL DEFAULT 0,
  absent_days      INTEGER       NOT NULL DEFAULT 0,
  leave_days       INTEGER       NOT NULL DEFAULT 0,
  working_days     INTEGER       NOT NULL,
  per_day_rate     NUMERIC(12,4) NOT NULL,
  deduction_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_salary       NUMERIC(12,2) NOT NULL,
  override_amount  NUMERIC(12,2),                                           -- when set, overrides the calculated net_salary
  deduction_choice TEXT          NOT NULL
    CHECK (deduction_choice IN ('deduct', 'pay_full')),
  status           TEXT          NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'paid')),
  payment_mode     TEXT
    CHECK (payment_mode IN ('cash', 'upi', 'online', 'bank_transfer')),
  payment_date     DATE,                                                    -- date on which salary was marked as paid
  payslip_url      TEXT,                                                    -- Supabase Storage URL of the generated payslip PDF
  payslip_status   TEXT          NOT NULL DEFAULT 'draft'
    CHECK (payslip_status IN ('draft', 'released')),
  created_by       UUID          REFERENCES users(id) ON DELETE SET NULL,  -- Principal or Finance_Manager who generated the record
  deleted_at       TIMESTAMPTZ,                                             -- soft-delete timestamp; NULL means active
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id, year, month)
);

-- ── Principal PIN ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS principal_pin (
  school_id       UUID        PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  pin_hash        TEXT        NOT NULL,                                     -- bcrypt hash of the Principal's salary-access PIN
  failed_attempts INTEGER     NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,                                              -- non-NULL while account is locked after repeated failures
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

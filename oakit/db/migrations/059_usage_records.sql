-- Migration 059: Usage Records
-- Tracks per-student usage of variable-rate services (daycare hours and
-- activity attendance) submitted by Teachers for billing-period aggregation.

-- ── Usage Records ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_records (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id            UUID          NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_head_id           UUID          NOT NULL REFERENCES fee_heads(id) ON DELETE CASCADE,
  service_type          TEXT          NOT NULL
    CHECK (service_type IN ('daycare', 'activity')),
  date                  DATE          NOT NULL,                             -- calendar date on which the service was consumed
  quantity              NUMERIC(8,2)  NOT NULL CHECK (quantity > 0),       -- hours for daycare; sessions/units for activity
  submitted_by          UUID          REFERENCES users(id) ON DELETE SET NULL, -- Teacher who logged the record
  billing_period_year   INTEGER       NOT NULL,
  billing_period_month  INTEGER       NOT NULL CHECK (billing_period_month BETWEEN 1 AND 12),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

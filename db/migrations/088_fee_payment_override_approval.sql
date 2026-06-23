-- Migration 088: Override approval workflow for duplicate-reference fee payments
--
-- When admin records a payment with a duplicate reference number and ticks
-- "Override — send to principal for approval", the payment is held in
-- 'pending_override' status until the principal approves or rejects it.

ALTER TABLE fee_payments
  ADD COLUMN IF NOT EXISTS override_status      TEXT
    CHECK (override_status IN ('pending_approval', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS override_reason      TEXT,          -- reason entered by admin
  ADD COLUMN IF NOT EXISTS override_requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS override_approved_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS override_approved_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_fee_payments_override
  ON fee_payments(school_id, override_status)
  WHERE override_status = 'pending_approval';

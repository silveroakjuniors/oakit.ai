-- Migration 087: Track who collected each fee payment
--
-- Adds collected_by (user id) to fee_payments so every payment record
-- shows which staff member (admin / accountant / principal) recorded it,
-- or NULL when the payment was created via online reconciliation.

ALTER TABLE fee_payments
  ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fee_payments_collected_by
  ON fee_payments (collected_by)
  WHERE collected_by IS NOT NULL;

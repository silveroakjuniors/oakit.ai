-- Migration 084: Payment reference number controls + screenshot support
--
-- 1. online_payment_proofs: add screenshot_url, override fields for duplicate ref approval
-- 2. fee_payments: add screenshot_url for transaction evidence

-- ── online_payment_proofs additions ──────────────────────────────────────────
ALTER TABLE online_payment_proofs
  ADD COLUMN IF NOT EXISTS screenshot_url       TEXT,          -- uploaded transaction screenshot
  ADD COLUMN IF NOT EXISTS is_duplicate_ref     BOOLEAN NOT NULL DEFAULT false,  -- flagged as duplicate ref
  ADD COLUMN IF NOT EXISTS override_requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS override_status      TEXT CHECK (override_status IN ('pending_approval', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS override_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS override_approved_at TIMESTAMPTZ;

-- ── fee_payments additions ────────────────────────────────────────────────────
ALTER TABLE fee_payments
  ADD COLUMN IF NOT EXISTS screenshot_url TEXT,                -- transaction screenshot
  ADD COLUMN IF NOT EXISTS needs_reconciliation BOOLEAN NOT NULL DEFAULT false,  -- true for UPI/online/bank_transfer
  ADD COLUMN IF NOT EXISTS receipt_released_at TIMESTAMPTZ;   -- when receipt was released (after reconciliation for online)

-- Index for duplicate reference check
CREATE INDEX IF NOT EXISTS idx_fee_payments_ref ON fee_payments(school_id, reference_number)
  WHERE reference_number IS NOT NULL AND deleted_at IS NULL;

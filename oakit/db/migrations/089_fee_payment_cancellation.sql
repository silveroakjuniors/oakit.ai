-- Migration 089: Receipt cancellation workflow
--
-- Admin requests cancellation with a reason.
-- Principal approves → payment hard-deleted, balance restored, receipt link removed.
-- History shows the cancellation trail even after deletion via a separate log table.

ALTER TABLE fee_payments
  ADD COLUMN IF NOT EXISTS cancel_status        TEXT
    CHECK (cancel_status IN ('pending_approval', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS cancel_reason        TEXT,
  ADD COLUMN IF NOT EXISTS cancel_requested_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancel_requested_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_approved_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancel_approved_at   TIMESTAMPTZ;

-- Audit trail for cancelled payments (survives hard-delete)
CREATE TABLE IF NOT EXISTS fee_payment_cancellations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_head_id         UUID NOT NULL REFERENCES fee_heads(id) ON DELETE CASCADE,
  original_payment_id UUID NOT NULL,               -- the deleted fee_payment id
  receipt_number      TEXT NOT NULL,
  amount              NUMERIC(12,2) NOT NULL,
  payment_mode        TEXT NOT NULL,
  payment_date        DATE NOT NULL,
  reference_number    TEXT,
  cancel_reason       TEXT NOT NULL,
  requested_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by_name   TEXT,
  requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by_name    TEXT,
  approved_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fpc_school    ON fee_payment_cancellations(school_id);
CREATE INDEX IF NOT EXISTS idx_fpc_student   ON fee_payment_cancellations(student_id);
CREATE INDEX IF NOT EXISTS idx_fpc_receipt   ON fee_payment_cancellations(receipt_number);

CREATE INDEX IF NOT EXISTS idx_fee_payments_cancel
  ON fee_payments(school_id, cancel_status)
  WHERE cancel_status = 'pending_approval';

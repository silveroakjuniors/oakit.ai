-- Migration 083: Online Payment Reconciliation
--
-- Parents submit their UPI/bank transaction ID + amount after paying online.
-- Admin uploads a bank statement; the system matches by transaction ID + amount
-- in the same row. On match, the fee payment is recorded and receipt released.

CREATE TABLE IF NOT EXISTS online_payment_proofs (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id        UUID          NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_head_id       UUID          NOT NULL REFERENCES fee_heads(id) ON DELETE CASCADE,
  parent_id         UUID          REFERENCES parent_users(id) ON DELETE SET NULL,

  -- What the parent submitted
  transaction_id    TEXT          NOT NULL,                    -- UPI ref / UTR / bank ref number
  amount            NUMERIC(12,2) NOT NULL CHECK (amount > 0), -- amount parent claims to have paid
  payment_mode      TEXT          NOT NULL DEFAULT 'upi'
    CHECK (payment_mode IN ('upi', 'online', 'bank_transfer')),
  submitted_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  notes             TEXT,                                      -- optional note from parent

  -- Reconciliation outcome
  status            TEXT          NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'matched', 'rejected')),
  matched_at        TIMESTAMPTZ,                               -- when admin confirmed the match
  matched_by        UUID          REFERENCES users(id) ON DELETE SET NULL,
  bank_statement_date DATE,                                    -- transaction date from bank statement
  rejection_reason  TEXT,

  -- Linked fee payment (created on match)
  fee_payment_id    UUID          REFERENCES fee_payments(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opp_school      ON online_payment_proofs(school_id, status);
CREATE INDEX IF NOT EXISTS idx_opp_student     ON online_payment_proofs(student_id);
CREATE INDEX IF NOT EXISTS idx_opp_transaction ON online_payment_proofs(school_id, transaction_id);

-- Migration 077: Parent payment proof submissions
--
-- Parents can submit a transaction ID or screenshot as proof of payment
-- when they pay via UPI/bank transfer outside the app. Admin reviews and
-- manually confirms the payment.

CREATE TABLE IF NOT EXISTS parent_payment_proofs (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  parent_id       UUID          NOT NULL REFERENCES parent_users(id) ON DELETE CASCADE,
  student_id      UUID          REFERENCES students(id) ON DELETE SET NULL,
  transaction_id  TEXT,                                                    -- UPI/bank reference number
  screenshot_url  TEXT,                                                    -- Supabase Storage URL of uploaded screenshot
  status          TEXT          NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'rejected')),
  admin_note      TEXT,                                                    -- note from admin on review
  reviewed_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_proofs_school ON parent_payment_proofs(school_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_parent ON parent_payment_proofs(parent_id);

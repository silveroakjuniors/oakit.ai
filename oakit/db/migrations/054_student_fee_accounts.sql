-- Migration 054: Student Fee Accounts
-- Tracks per-student fee obligations, payment records, and credit balances.
-- student_fee_accounts links a student to a specific fee head with their assigned amount and outstanding balance.
-- fee_payments records each payment transaction against a student's fee head.
-- credit_balances holds excess payment amounts that can be applied to future invoices.

-- ── Student fee accounts (one per student per fee head) ───────────────────────
CREATE TABLE IF NOT EXISTS student_fee_accounts (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID          NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id           UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  fee_head_id         UUID          NOT NULL REFERENCES fee_heads(id) ON DELETE CASCADE,
  assigned_amount     NUMERIC(12,2) NOT NULL,                              -- total fee assigned to this student
  outstanding_balance NUMERIC(12,2) NOT NULL,                              -- remaining amount due
  status              TEXT          NOT NULL DEFAULT 'pending'
    CHECK (status IN ('paid', 'partially_paid', 'pending', 'overdue')),
  admission_date      DATE,                                                -- date student was admitted (for pro-rata calculation)

  -- Soft-delete
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Fee payments (individual payment transactions) ────────────────────────────
CREATE TABLE IF NOT EXISTS fee_payments (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id          UUID          NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_head_id         UUID          NOT NULL REFERENCES fee_heads(id) ON DELETE CASCADE,
  amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_mode        TEXT          NOT NULL
    CHECK (payment_mode IN ('cash', 'upi', 'online', 'bank_transfer')),
  payment_date        DATE          NOT NULL,
  reference_number    TEXT,                                                -- cheque / UTR / transaction reference
  receipt_number      TEXT,                                                -- sequential receipt identifier
  receipt_url         TEXT,                                                -- Supabase Storage URL for PDF receipt

  -- Payment gateway fields
  gateway_payment_id  TEXT,                                                -- Razorpay / PhonePe payment ID
  gateway_status      TEXT,                                                -- raw status from gateway

  -- Reconciliation
  reconciled_at       TIMESTAMPTZ,
  reconciled_by       UUID          REFERENCES users(id) ON DELETE SET NULL,

  -- Soft-delete
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Credit balances (one per student per school) ──────────────────────────────
CREATE TABLE IF NOT EXISTS credit_balances (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID          NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id   UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),       -- excess payment available for future invoices
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE (student_id, school_id)                                          -- one credit balance record per student per school
);

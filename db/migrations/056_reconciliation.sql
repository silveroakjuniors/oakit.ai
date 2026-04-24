-- Migration 056: Reconciliation
-- Supports both bank statement reconciliation (upload-based, AI-extracted) and
-- daily cash reconciliation logging with variance tracking.
-- Bank uploads are matched against fee_payments; cash logs require Principal review on mismatch.

-- ── Bank Reconciliation Uploads (one per uploaded statement file) ─────────────
CREATE TABLE IF NOT EXISTS bank_reconciliation_uploads (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  uploaded_by   UUID          REFERENCES users(id) ON DELETE SET NULL,
  file_url      TEXT          NOT NULL,                                    -- Supabase Storage URL of the uploaded PDF/CSV
  status        TEXT          NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),               -- processing → completed or failed after AI extraction
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Bank Reconciliation Items (one per extracted transaction line) ────────────
CREATE TABLE IF NOT EXISTS bank_reconciliation_items (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id           UUID          NOT NULL REFERENCES bank_reconciliation_uploads(id) ON DELETE CASCADE,
  school_id           UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  transaction_date    DATE          NOT NULL,
  amount              NUMERIC(12,2) NOT NULL,
  reference           TEXT,                                                -- bank reference / UTR number from statement
  match_status        TEXT          NOT NULL DEFAULT 'unmatched'
    CHECK (match_status IN ('matched', 'partial', 'unmatched')),           -- set by AI matching; confirmed by Finance_Manager
  matched_payment_id  UUID          REFERENCES fee_payments(id) ON DELETE SET NULL, -- populated when match_status = 'matched' or 'partial'
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Cash Reconciliation Logs (one per school per day) ────────────────────────
CREATE TABLE IF NOT EXISTS cash_reconciliation_logs (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  logged_by       UUID          REFERENCES users(id) ON DELETE SET NULL,   -- Finance_Manager who submitted the log
  date            DATE          NOT NULL,
  total_cash      NUMERIC(12,2) NOT NULL,                                  -- physical cash counted at end of day
  expected_cash   NUMERIC(12,2) NOT NULL,                                  -- sum of cash payments recorded in system
  variance        NUMERIC(12,2) GENERATED ALWAYS AS (total_cash - expected_cash) STORED, -- positive = surplus, negative = shortage
  status          TEXT          NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'matched', 'mismatch')),                  -- Principal sets to matched or mismatch after review
  reviewed_by     UUID          REFERENCES users(id) ON DELETE SET NULL,   -- Principal who reviewed
  reviewed_at     TIMESTAMPTZ,                                             -- timestamp of Principal review
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (school_id, date)                                                 -- one log per school per day
);

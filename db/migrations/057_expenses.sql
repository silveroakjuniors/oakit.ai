-- Migration 057: Expenses
-- Tracks school operational expenses across categories (rent, salary, utilities,
-- marketing, maintenance, miscellaneous) with optional attachment support and
-- soft-delete capability for audit trail preservation.

-- ── Expenses ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date           DATE          NOT NULL,
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category       TEXT          NOT NULL
    CHECK (category IN ('rent', 'salary', 'utilities', 'marketing', 'maintenance', 'miscellaneous')),
  notes          TEXT,                                                      -- optional description or context for the expense
  attachment_url TEXT,                                                      -- Supabase Storage URL of uploaded JPEG/PNG/PDF receipt
  created_by     UUID          REFERENCES users(id) ON DELETE SET NULL,    -- Finance_Manager or Principal who recorded the expense
  deleted_at     TIMESTAMPTZ,                                               -- soft-delete timestamp; NULL means active
  deleted_by     UUID          REFERENCES users(id) ON DELETE SET NULL,    -- user who performed the soft-delete
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

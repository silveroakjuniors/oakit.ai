-- Migration 055: Concessions
-- Tracks fee concessions granted to students against specific fee heads.
-- Concessions require Principal approval before being applied to a student's outstanding balance.
-- Supports both fixed-amount and percentage-based concessions with full audit trail.

-- ── Concessions (one per student per fee head per grant) ──────────────────────
CREATE TABLE IF NOT EXISTS concessions (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID          NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id        UUID          NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_head_id       UUID          NOT NULL REFERENCES fee_heads(id) ON DELETE CASCADE,
  type              TEXT          NOT NULL
    CHECK (type IN ('fixed', 'percentage')),                               -- fixed amount or percentage of fee head total
  value             NUMERIC(12,2) NOT NULL CHECK (value > 0),              -- amount (if fixed) or percentage (if percentage)
  reason            TEXT          NOT NULL,                                -- justification provided by creator
  status            TEXT          NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'rejected')),

  -- Audit / approval
  created_by        UUID          REFERENCES users(id) ON DELETE SET NULL, -- Finance_Manager or Admin who raised the concession
  approved_by       UUID          REFERENCES users(id) ON DELETE SET NULL, -- Principal who approved or rejected
  approved_at       TIMESTAMPTZ,                                           -- timestamp of approval or rejection decision
  rejection_reason  TEXT,                                                  -- populated when status = 'rejected'

  -- Soft-delete
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

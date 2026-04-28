-- Migration 080: School fee management additions
--
-- 1. student_fee_accounts: add updated_at (missing — causes UPDATE to fail when
--    the delete-fee-head route tries to set updated_at = now() on cascade)
-- 2. fee_structures: partial unique index for one-active-fee-structure-per-class-per-year
-- 3. Performance indexes on fee_structures, fee_heads, student_fee_accounts, concessions

-- ── 1. student_fee_accounts: add updated_at ───────────────────────────────────
ALTER TABLE student_fee_accounts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ── 2. fee_structures: unique constraint for one-per-class-per-year ───────────
-- Prevents two active fee structures for the same class in the same academic year.
-- Partial unique index: only enforces uniqueness when is_active = true and
-- class_id is not null (school-wide structures are excluded).
CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_structures_class_year_active
  ON fee_structures (school_id, class_id, academic_year)
  WHERE is_active = true AND class_id IS NOT NULL;

-- ── 3. Performance indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fee_structures_school_year
  ON fee_structures (school_id, academic_year);

CREATE INDEX IF NOT EXISTS idx_fee_heads_structure
  ON fee_heads (fee_structure_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_student_fee_accounts_head
  ON student_fee_accounts (fee_head_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_concessions_status
  ON concessions (school_id, status);

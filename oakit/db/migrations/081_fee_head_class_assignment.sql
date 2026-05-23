-- Migration 081: Move class assignment from fee_structures to fee_heads
--
-- The fee_structures table is a year-level container (one per school per academic year).
-- Individual fee types (fee_heads) are now assigned to a class or a student independently.
-- This allows Transport to be assigned only to students who use it, while Tuition
-- is assigned to the whole class — without bundling everything into one structure.
--
-- Changes:
--   1. Add class_id to fee_heads (nullable — NULL means not yet assigned to a class)
--   2. Null out class_id on fee_structures (container is now school+year level only)
--   3. Drop the unique index that enforced one-structure-per-class-per-year (no longer needed)
--   4. Add index on fee_heads(class_id) for efficient class-based queries

-- ── 1. Add class_id to fee_heads ──────────────────────────────────────────────
ALTER TABLE fee_heads
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

-- ── 2. Clear class_id on fee_structures (container is now year-level only) ────
-- We keep the column for backward compat but stop using it.
UPDATE fee_structures SET class_id = NULL WHERE class_id IS NOT NULL;

-- ── 3. Drop the one-per-class-per-year unique index (no longer applicable) ────
DROP INDEX IF EXISTS idx_fee_structures_class_year_active;

-- ── 4. Index for fee_heads class assignment queries ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_fee_heads_class
  ON fee_heads (school_id, class_id, deleted_at);

-- ── 5. One active fee head per type per class per academic year ───────────────
-- Prevents assigning the same fee type to the same class twice in the same year.
-- Joins through fee_structures to get academic_year.
-- Enforced at the application layer (no partial index possible across tables).
-- Application-level check added in the assign-class route.

-- Migration 076: Financial module fixes
--
-- 1. Add updated_at to fee_structures (referenced in PUT route but missing from schema)
-- 2. Add late_fee_applied_at to fee_instalments to prevent duplicate late fee charges
-- 3. Add updated_at to fee_heads for audit trail
-- 4. Add class_of_interest as nullable in enquiries (was NOT NULL but route allows null)

-- ── fee_structures: add updated_at ───────────────────────────────────────────
ALTER TABLE fee_structures
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ── fee_heads: add updated_at ─────────────────────────────────────────────────
ALTER TABLE fee_heads
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ── fee_instalments: add late_fee_applied_at for deduplication ───────────────
-- Tracks the last date a late fee was applied to this instalment.
-- The check-late-fees endpoint uses this to ensure late fees are applied at most
-- once per day per instalment, preventing duplicate charges on repeated calls.
ALTER TABLE fee_instalments
  ADD COLUMN IF NOT EXISTS late_fee_applied_at DATE;

-- ── enquiries: make class_of_interest nullable ────────────────────────────────
-- The route allows class_of_interest to be omitted (nullable), but the original
-- migration defined it as NOT NULL. Relax the constraint.
ALTER TABLE enquiries
  ALTER COLUMN class_of_interest DROP NOT NULL;

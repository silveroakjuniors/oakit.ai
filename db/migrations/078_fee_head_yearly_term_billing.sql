-- Migration 078: Add yearly and term-based billing to fee heads
--
-- Extends the fee_heads billing_basis to support:
--   per_year  — a single annual amount, divided by 12 for monthly equivalent
--   per_term  — an amount per school term; term count comes from school_terms
--
-- Also adds:
--   yearly_amount   — the total annual fee (used when billing_basis = 'per_year')
--   term_amount     — the fee per term (used when billing_basis = 'per_term')
--   term_count      — how many terms the fee is split across (snapshot at creation)
--
-- The existing pricing_model CHECK is extended to include 'yearly' and 'term'
-- as aliases for the fixed model with a specific billing cadence.

-- ── Extend billing_basis CHECK on fee_heads ───────────────────────────────────
ALTER TABLE fee_heads
  DROP CONSTRAINT IF EXISTS fee_heads_billing_basis_check;

ALTER TABLE fee_heads
  ADD CONSTRAINT fee_heads_billing_basis_check
    CHECK (billing_basis IN (
      'per_hour', 'per_day', 'per_week', 'per_month_flat',
      'per_year', 'per_term'
    ));

-- ── Add yearly / term amount columns ─────────────────────────────────────────
ALTER TABLE fee_heads
  ADD COLUMN IF NOT EXISTS yearly_amount  NUMERIC(12,2),   -- total annual fee
  ADD COLUMN IF NOT EXISTS term_amount    NUMERIC(12,2),   -- fee per term
  ADD COLUMN IF NOT EXISTS term_count     INTEGER;         -- number of terms (snapshot)

COMMENT ON COLUMN fee_heads.yearly_amount IS
  'Total annual fee. Used when billing_basis = ''per_year''. '
  'calculated_monthly_fee = yearly_amount / 12.';

COMMENT ON COLUMN fee_heads.term_amount IS
  'Fee per term. Used when billing_basis = ''per_term''. '
  'calculated_monthly_fee = term_amount * term_count / 12.';

COMMENT ON COLUMN fee_heads.term_count IS
  'Snapshot of the number of terms at the time the fee head was created. '
  'Prevents recalculation issues if the school later changes its term structure.';

-- Migration 079: Fix fee_heads constraints and add instalment labels
--
-- Fixes:
-- 1. billing_basis CHECK was missing per_year and per_term (added in 078 but
--    the original constraint in 053 was not dropped first — fix that here)
-- 2. pricing_model CHECK: add 'flat' as alias for 'fixed' (frontend sends 'flat')
--    and normalise to 'fixed' via a trigger, OR just add 'flat' to the check.
--    Simplest: rename 'flat' → 'fixed' at the DB level by widening the check.
-- 3. fee_instalments: add label column for custom instalment names
--    (e.g. "Booking Amount", "1st Instalment", "Term 1 Fee")

-- ── 1. Fix billing_basis CHECK ────────────────────────────────────────────────
ALTER TABLE fee_heads
  DROP CONSTRAINT IF EXISTS fee_heads_billing_basis_check;

ALTER TABLE fee_heads
  ADD CONSTRAINT fee_heads_billing_basis_check
    CHECK (billing_basis IN (
      'per_hour', 'per_day', 'per_week', 'per_month_flat',
      'per_year', 'per_term'
    ));

-- ── 2. Fix pricing_model CHECK ────────────────────────────────────────────────
-- Add 'flat' as a valid value (frontend sends 'flat'; backend stores it as-is)
ALTER TABLE fee_heads
  DROP CONSTRAINT IF EXISTS fee_heads_pricing_model_check;

ALTER TABLE fee_heads
  ADD CONSTRAINT fee_heads_pricing_model_check
    CHECK (pricing_model IN ('fixed', 'flat', 'instalment', 'monthly_calculated'));

-- Normalise existing 'flat' rows to 'fixed' for consistency
UPDATE fee_heads SET pricing_model = 'fixed' WHERE pricing_model = 'flat';

-- Now tighten back to not allow 'flat' going forward (optional — keep 'flat' for compat)
-- Leaving 'flat' in the check so existing frontend code keeps working.

-- ── 3. Add label column to fee_instalments ────────────────────────────────────
-- Allows custom names per instalment:
--   e.g. "Booking Amount", "1st Instalment", "Term 1 Fee", "Annual Fee"
ALTER TABLE fee_instalments
  ADD COLUMN IF NOT EXISTS label TEXT;

COMMENT ON COLUMN fee_instalments.label IS
  'Custom display name for this instalment. '
  'Examples: "Booking Amount", "1st Instalment", "Term 1 Fee". '
  'Falls back to "Instalment {instalment_number}" if NULL.';

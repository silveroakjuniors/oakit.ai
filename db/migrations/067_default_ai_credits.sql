-- Migration 067: Default AI credits for all schools
-- Give every school 2000 credits (₹20.00) by default on creation/migration.
-- 2000 credits = 200,000 paise = ₹2,000 (at ₹0.01 per credit)
-- Actually: balance_paise is in paise (₹1 = 100 paise)
-- 2000 credits at the default flat_cost_paise of 5 per call = 2000 * 5 = 10,000 paise = ₹100 worth of calls
-- We'll seed 200,000 paise (₹2,000) as a generous default

INSERT INTO school_ai_wallet (school_id, balance_paise, lifetime_recharged_paise)
SELECT id, 200000, 200000
FROM schools
ON CONFLICT (school_id) DO UPDATE
  SET balance_paise = GREATEST(school_ai_wallet.balance_paise, 200000),
      lifetime_recharged_paise = GREATEST(school_ai_wallet.lifetime_recharged_paise, 200000),
      blocked = false,
      updated_at = now()
WHERE school_ai_wallet.balance_paise < 200000;

-- Also record the initial recharge transaction for each school that doesn't have one
INSERT INTO ai_credit_transactions (school_id, type, amount_paise, balance_after_paise, description)
SELECT s.id, 'recharge', 200000, 200000, 'Default startup credits (₹2,000)'
FROM schools s
LEFT JOIN ai_credit_transactions t ON t.school_id = s.id AND t.description = 'Default startup credits (₹2,000)'
WHERE t.id IS NULL;

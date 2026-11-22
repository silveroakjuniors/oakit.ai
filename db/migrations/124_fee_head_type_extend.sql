-- Migration 124: Extend fee_heads.type CHECK to include daycare and bags_and_books
-- The frontend fee-structures page and fee wizard already allow these values
-- but the DB constraint was blocking inserts with a 500 error.

ALTER TABLE fee_heads
  DROP CONSTRAINT IF EXISTS fee_heads_type_check;

ALTER TABLE fee_heads
  ADD CONSTRAINT fee_heads_type_check
  CHECK (type IN ('admission', 'tuition', 'transport', 'activity', 'custom', 'daycare', 'bags_and_books'));

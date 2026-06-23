-- Migration 086: Add 'bags_and_books' to fee_heads type CHECK constraint
--
-- bags_and_books: class-wise, one-time fixed fee, assigned per student individually
-- (same assignment model as transport/activity/daycare — not school-wide like custom)

ALTER TABLE fee_heads
  DROP CONSTRAINT IF EXISTS fee_heads_type_check;

ALTER TABLE fee_heads
  ADD CONSTRAINT fee_heads_type_check
    CHECK (type IN ('admission', 'tuition', 'transport', 'activity', 'daycare', 'bags_and_books', 'custom'));

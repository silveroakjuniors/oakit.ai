-- Migration 085: Expand expenses category CHECK constraint
-- The original constraint only allowed 6 categories; the frontend supports more.

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_category_check;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_category_check
    CHECK (category IN (
      'rent', 'salary', 'utilities', 'marketing', 'maintenance',
      'supplies', 'transport', 'food', 'events', 'miscellaneous', 'other'
    ));

-- Migration 082: Add 'daycare' to fee_heads type CHECK constraint
--
-- The existing CHECK only allows: admission | tuition | transport | activity | custom
-- This migration drops the old constraint and recreates it with 'daycare' included.

ALTER TABLE fee_heads
  DROP CONSTRAINT IF EXISTS fee_heads_type_check;

ALTER TABLE fee_heads
  ADD CONSTRAINT fee_heads_type_check
    CHECK (type IN ('admission', 'tuition', 'transport', 'activity', 'daycare', 'custom'));

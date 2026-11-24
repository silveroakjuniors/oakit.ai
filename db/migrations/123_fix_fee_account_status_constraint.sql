-- Migration 123: Fix student_fee_accounts status constraint
-- Prod constraint diverged from migration 054 — missing 'partially_paid',
-- has extra values 'active', 'terminated', 'cancelled' from a different version.
-- Align to the full correct set.

ALTER TABLE student_fee_accounts
  DROP CONSTRAINT IF EXISTS student_fee_accounts_status_check;

ALTER TABLE student_fee_accounts
  ADD CONSTRAINT student_fee_accounts_status_check
  CHECK (status IN ('active', 'paid', 'partially_paid', 'overdue', 'cancelled', 'terminated', 'pending'));

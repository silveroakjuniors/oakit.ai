-- Migration 126: Per-student concession lock on student_fee_accounts
-- When concession_locked = true for a student+fee_head row,
-- no new concessions can be created for that student's fee head.
-- This is irreversible once set.

ALTER TABLE student_fee_accounts
  ADD COLUMN IF NOT EXISTS concession_locked BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN student_fee_accounts.concession_locked IS
  'When true, no new concessions can be raised for this student fee account. Irreversible.';

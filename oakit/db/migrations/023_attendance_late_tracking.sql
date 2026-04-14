-- Migration 023: Late arrival tracking on attendance records

-- arrived_at: timestamp when a late student was marked present (null = on time or absent)
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS arrived_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_late       BOOLEAN NOT NULL DEFAULT false,
  -- who last edited the record (for late updates)
  ADD COLUMN IF NOT EXISTS edited_by     UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS edited_at     TIMESTAMPTZ,
  -- first submission time (preserved even after edits)
  ADD COLUMN IF NOT EXISTS first_submitted_at TIMESTAMPTZ;

-- Backfill first_submitted_at from submitted_at for existing records
UPDATE attendance_records SET first_submitted_at = submitted_at WHERE first_submitted_at IS NULL;

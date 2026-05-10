-- Migration 072: Add requested_last_working_day to employment_records
-- Allows staff to optionally request a different last working day than the auto-calculated one.
-- Principal can override last_working_day when acknowledging.

ALTER TABLE employment_records
  ADD COLUMN IF NOT EXISTS requested_last_working_day DATE,
  ADD COLUMN IF NOT EXISTS principal_override_last_working_day DATE;

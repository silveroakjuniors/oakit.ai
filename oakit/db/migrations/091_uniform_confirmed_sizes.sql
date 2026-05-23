-- Migration 091: Add confirmed size columns to uniform_sizing_requests
-- Parents review the recommended sizes, can edit, then confirm.
-- confirmed_* columns store the parent-approved final sizes.

ALTER TABLE uniform_sizing_requests
  ADD COLUMN IF NOT EXISTS confirmed_shirt_size TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_pant_size  TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at         TIMESTAMPTZ;

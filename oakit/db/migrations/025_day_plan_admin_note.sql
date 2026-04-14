-- Migration 025: Add admin_note to day_plans for special day instructions
ALTER TABLE day_plans ADD COLUMN IF NOT EXISTS admin_note TEXT;

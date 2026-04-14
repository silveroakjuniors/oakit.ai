-- Migration 015: Class timings and settling period time overrides
-- Regular class timings stored on classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS day_start_time TIME DEFAULT '09:30';
ALTER TABLE classes ADD COLUMN IF NOT EXISTS day_end_time   TIME DEFAULT '13:30';

-- Settling period can have shorter timings — stored on special_days
ALTER TABLE special_days ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE special_days ADD COLUMN IF NOT EXISTS end_time   TIME;

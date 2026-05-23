-- Migration 073: Add letterhead_url to hr_settings
-- Allows schools to upload a letterhead image used as PDF background

ALTER TABLE hr_settings
  ADD COLUMN IF NOT EXISTS letterhead_url TEXT;

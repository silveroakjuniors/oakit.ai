-- Migration 024: Add mother name and contact to students
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS mother_name    TEXT,
  ADD COLUMN IF NOT EXISTS mother_contact TEXT;

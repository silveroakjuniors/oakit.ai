-- Migration 068: Add achievement comment to student_milestones
ALTER TABLE student_milestones
  ADD COLUMN IF NOT EXISTS achievement_comment TEXT;

-- Add term field to milestones for term-wise tracking
ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS term TEXT; -- e.g. 'Term 1', 'Term 2', 'Annual'

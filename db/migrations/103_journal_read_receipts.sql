-- Migration 103: Add read receipt tracking to child journey entries
-- read_at: when the parent first viewed/read this entry (NULL = not yet read)

ALTER TABLE child_journey_entries
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Index for quickly finding unread entries per student
CREATE INDEX IF NOT EXISTS idx_cje_read_status
  ON child_journey_entries(student_id, is_sent_to_parent, read_at)
  WHERE is_sent_to_parent = true AND read_at IS NULL;

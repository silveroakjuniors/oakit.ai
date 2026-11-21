-- Migration 118: Track Instagram follow acknowledgement per parent
-- Records when a parent clicked "I've followed" on the Instagram prompt

ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS instagram_follow_acknowledged_at TIMESTAMPTZ DEFAULT NULL;

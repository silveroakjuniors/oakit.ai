-- Migration 020: parent_notifications table

CREATE TABLE IF NOT EXISTS parent_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       UUID NOT NULL REFERENCES parent_users(id) ON DELETE CASCADE,
  completion_id   UUID NOT NULL REFERENCES daily_completions(id) ON DELETE CASCADE,
  section_id      UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  completion_date DATE NOT NULL,
  chunks_covered  INT NOT NULL DEFAULT 0,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_id, completion_id)
);

-- Fast lookup of unread notifications per parent
CREATE INDEX IF NOT EXISTS idx_parent_notifications_unread
  ON parent_notifications(parent_id, is_read) WHERE is_read = false;

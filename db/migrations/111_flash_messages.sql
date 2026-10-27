-- Migration 111: Parent/Teacher flash message popup system
-- Admin can schedule important messages to show as popups to specific roles
-- within a date range. Each user sees each message once per session.

CREATE TABLE IF NOT EXISTS flash_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  -- Comma-separated roles: 'parent', 'teacher', 'all'
  target_roles TEXT NOT NULL DEFAULT 'parent',
  start_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date     DATE NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flash_messages_school
  ON flash_messages(school_id, start_date, end_date, is_active);

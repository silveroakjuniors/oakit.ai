-- Migration 033: School announcement board
CREATE TABLE IF NOT EXISTS announcements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users(id),
    title           TEXT NOT NULL CHECK (char_length(title) <= 100),
    body            TEXT NOT NULL CHECK (char_length(body) <= 1000),
    target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all','teachers','parents','class')),
    target_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_announcements_school ON announcements(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(school_id, deleted_at, expires_at);

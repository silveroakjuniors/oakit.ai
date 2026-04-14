-- Migration 027: Teacher notes and homework
-- Homework: text per day, permanent, AI-formatted for parents
-- Notes: text/file, 14-day expiry, auto-deleted

CREATE TABLE IF NOT EXISTS teacher_homework (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    section_id      UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    teacher_id      UUID NOT NULL REFERENCES users(id),
    homework_date   DATE NOT NULL,
    raw_text        TEXT NOT NULL,          -- what teacher typed
    formatted_text  TEXT,                   -- AI-formatted version shown to parents
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ,
    UNIQUE(section_id, homework_date)
);
CREATE INDEX IF NOT EXISTS idx_teacher_homework_section_date ON teacher_homework(section_id, homework_date);

CREATE TABLE IF NOT EXISTS teacher_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    section_id      UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    teacher_id      UUID NOT NULL REFERENCES users(id),
    note_date       DATE NOT NULL,
    note_text       TEXT,                   -- typed/pasted text
    file_name       TEXT,                   -- original filename if uploaded
    file_path       TEXT,                   -- server path
    file_size       INT,                    -- bytes
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teacher_notes_section_date ON teacher_notes(section_id, note_date);
CREATE INDEX IF NOT EXISTS idx_teacher_notes_expires ON teacher_notes(expires_at);

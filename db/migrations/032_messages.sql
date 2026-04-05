-- Migration 032: Teacher-parent in-app messaging
CREATE TABLE IF NOT EXISTS messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id  UUID NOT NULL REFERENCES users(id),
    parent_id   UUID NOT NULL REFERENCES parent_users(id),
    student_id  UUID NOT NULL REFERENCES students(id),
    sender_role TEXT NOT NULL CHECK (sender_role IN ('teacher','parent')),
    body        TEXT NOT NULL CHECK (char_length(body) <= 1000),
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(teacher_id, parent_id, student_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_teacher ON messages(teacher_id, sent_at DESC);

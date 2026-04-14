-- Migration 034: Shared teacher resource library
CREATE TABLE IF NOT EXISTS resources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    uploader_id     UUID NOT NULL REFERENCES users(id),
    title           TEXT NOT NULL CHECK (char_length(title) <= 100),
    description     TEXT CHECK (char_length(description) <= 300),
    subject_tag     TEXT,
    class_level     TEXT CHECK (class_level IN ('Play Group','Nursery','LKG','UKG','All')),
    file_path       TEXT,
    file_name       TEXT,
    file_size_bytes INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resources_school ON resources(school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS teacher_saved_resources (
    teacher_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    saved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (teacher_id, resource_id)
);

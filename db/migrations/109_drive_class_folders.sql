-- Migration 109: Store Google Drive subfolder IDs per class/section
-- So parents and teachers can be linked directly to their class folder

CREATE TABLE IF NOT EXISTS drive_class_folders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    section_id      UUID REFERENCES sections(id) ON DELETE SET NULL,
    class_name      TEXT NOT NULL,               -- e.g. "Nursery - Section A"
    drive_folder_id TEXT NOT NULL,               -- Google Drive folder ID for this class
    drive_folder_url TEXT,                       -- Full shareable URL
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ,
    UNIQUE(school_id, class_name)
);

CREATE INDEX IF NOT EXISTS idx_drive_class_folders_school ON drive_class_folders(school_id);
CREATE INDEX IF NOT EXISTS idx_drive_class_folders_section ON drive_class_folders(section_id);

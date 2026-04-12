-- Migration 044: Child Journey
-- Teachers record daily/weekly observations about individual students.
-- AI beautifies the entries and parents can view their child's journey.

CREATE TABLE IF NOT EXISTS child_journey_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    section_id      UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    teacher_id      UUID NOT NULL REFERENCES users(id),
    entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_type      TEXT NOT NULL DEFAULT 'daily' CHECK (entry_type IN ('daily', 'weekly', 'highlight')),
    raw_text        TEXT NOT NULL,                    -- teacher's raw notes
    beautified_text TEXT,                             -- AI-beautified version
    is_sent_to_parent BOOLEAN NOT NULL DEFAULT false,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_child_journey_student ON child_journey_entries(student_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_child_journey_section ON child_journey_entries(section_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_child_journey_school ON child_journey_entries(school_id, entry_date DESC);

-- One entry per student per date per type
ALTER TABLE child_journey_entries
  ADD CONSTRAINT child_journey_student_date_type_key
  UNIQUE (student_id, entry_date, entry_type);

COMMENT ON TABLE child_journey_entries IS
    'Teacher observations about individual students — daily highlights, weekly summaries, special moments.';
COMMENT ON COLUMN child_journey_entries.raw_text IS 'Short teacher notes, 1-5 sentences';
COMMENT ON COLUMN child_journey_entries.beautified_text IS 'AI-formatted warm narrative for parents';

-- Migration 041: Textbook Planner Generator

-- Extend curriculum_documents with source and ingestion_stage
ALTER TABLE curriculum_documents ADD COLUMN IF NOT EXISTS ingestion_stage TEXT DEFAULT 'done';
ALTER TABLE curriculum_documents ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'upload';

-- One session per class per academic year
CREATE TABLE IF NOT EXISTS textbook_planner_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    academic_year   TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'generating', 'generated', 'stale', 'confirmed')),
    parameters      JSONB DEFAULT '{}',
    test_config     JSONB DEFAULT '{}',
    generation_summary JSONB,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(school_id, class_id, academic_year)
);

-- Subjects within a session
CREATE TABLE IF NOT EXISTS textbook_planner_subjects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES textbook_planner_sessions(id) ON DELETE CASCADE,
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    pdf_path        TEXT,
    pdf_page_count  INT,
    toc_page        INT,
    weekly_hours    NUMERIC(4,2) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(session_id, name)
);

-- Chapters extracted from TOC (or manually added)
CREATE TABLE IF NOT EXISTS textbook_planner_chapters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id      UUID NOT NULL REFERENCES textbook_planner_subjects(id) ON DELETE CASCADE,
    session_id      UUID NOT NULL REFERENCES textbook_planner_sessions(id) ON DELETE CASCADE,
    chapter_index   INT NOT NULL,
    title           TEXT NOT NULL,
    topics          JSONB NOT NULL DEFAULT '[]',
    page_start      INT,
    page_end        INT,
    chapter_weight  NUMERIC(8,6),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpc_subject ON textbook_planner_chapters(subject_id, chapter_index);
CREATE INDEX IF NOT EXISTS idx_tpc_session ON textbook_planner_chapters(session_id);

-- Generated day-by-day draft entries
CREATE TABLE IF NOT EXISTS textbook_planner_drafts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL REFERENCES textbook_planner_sessions(id) ON DELETE CASCADE,
    school_id           UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    entry_date          DATE NOT NULL,
    subject_id          UUID REFERENCES textbook_planner_subjects(id),
    subject_name        TEXT NOT NULL,
    chapter_name        TEXT NOT NULL,
    topic_name          TEXT NOT NULL,
    duration_minutes    INT NOT NULL DEFAULT 45,
    is_manual_edit      BOOLEAN DEFAULT false,
    carry_forward_from  DATE,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpd_session_date ON textbook_planner_drafts(session_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_tpd_session_subject ON textbook_planner_drafts(session_id, subject_id);

-- Trigger to mark sessions as stale when calendar changes
CREATE OR REPLACE FUNCTION mark_planner_sessions_stale()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE textbook_planner_sessions
    SET status = 'stale', updated_at = now()
    WHERE school_id = COALESCE(NEW.school_id, OLD.school_id)
      AND status IN ('generated', 'draft')
      AND academic_year = EXTRACT(YEAR FROM COALESCE(NEW.holiday_date, OLD.holiday_date, NEW.day_date, OLD.day_date))::text;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_holidays_stale
AFTER INSERT OR DELETE ON holidays
FOR EACH ROW EXECUTE FUNCTION mark_planner_sessions_stale();

CREATE OR REPLACE TRIGGER trg_special_days_stale
AFTER INSERT OR DELETE ON special_days
FOR EACH ROW EXECUTE FUNCTION mark_planner_sessions_stale();

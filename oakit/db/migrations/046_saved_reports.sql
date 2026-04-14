-- Migration 046: Saved student progress reports
CREATE TABLE IF NOT EXISTS saved_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    section_id      UUID NOT NULL REFERENCES sections(id),
    generated_by    UUID NOT NULL REFERENCES users(id),
    report_type     TEXT NOT NULL DEFAULT 'progress' CHECK (report_type IN ('progress', 'term', 'annual')),
    from_date       DATE NOT NULL,
    to_date         DATE NOT NULL,
    title           TEXT NOT NULL,
    ai_report       TEXT NOT NULL,
    report_data     JSONB NOT NULL DEFAULT '{}',
    shared_with_parent BOOLEAN NOT NULL DEFAULT false,
    shared_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_reports_student ON saved_reports(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_reports_school  ON saved_reports(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_reports_section ON saved_reports(section_id, from_date, to_date);

-- Prevent duplicate reports for same student + period + type
ALTER TABLE saved_reports
  ADD CONSTRAINT saved_reports_student_period_type_key
  UNIQUE (student_id, from_date, to_date, report_type);

-- Migration 039: Homework completion tracking per student

CREATE TABLE IF NOT EXISTS homework_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    section_id      UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    homework_date   DATE NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'not_submitted')),
    teacher_note    TEXT,
    recorded_by     UUID REFERENCES users(id),
    recorded_at     TIMESTAMPTZ DEFAULT now(),
    UNIQUE (student_id, homework_date)
);

CREATE INDEX ON homework_submissions(school_id, section_id, homework_date);
CREATE INDEX ON homework_submissions(student_id, homework_date DESC);
CREATE INDEX ON homework_submissions(school_id, status, homework_date DESC);

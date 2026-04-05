-- Migration 030: Student observations by teachers
CREATE TABLE IF NOT EXISTS student_observations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    teacher_id          UUID NOT NULL REFERENCES users(id),
    school_id           UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    obs_text            TEXT CHECK (char_length(obs_text) <= 500),
    categories          TEXT[] NOT NULL DEFAULT '{}',
    share_with_parent   BOOLEAN NOT NULL DEFAULT false,
    obs_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_observations_student ON student_observations(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_school ON student_observations(school_id);

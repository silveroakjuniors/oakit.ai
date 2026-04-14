-- Migration 029: Teacher streaks for gamification
CREATE TABLE IF NOT EXISTS teacher_streaks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    current_streak  INT NOT NULL DEFAULT 0,
    best_streak     INT NOT NULL DEFAULT 0,
    last_completed_date DATE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (teacher_id, school_id)
);
CREATE INDEX IF NOT EXISTS idx_teacher_streaks_teacher ON teacher_streaks(teacher_id);

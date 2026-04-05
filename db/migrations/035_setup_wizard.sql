-- Migration 035: School setup wizard progress tracking
CREATE TABLE IF NOT EXISTS setup_wizard_progress (
    school_id       UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
    completed_steps TEXT[] NOT NULL DEFAULT '{}',
    last_step       TEXT,
    completed_at    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration 043: Per-class AI Plan Mode
-- Replaces the school-level ai_plan_mode with per-class granularity.
-- The school-level column remains as a fallback default.

CREATE TABLE IF NOT EXISTS class_ai_settings (
    class_id    UUID PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE,
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    ai_plan_mode TEXT NOT NULL DEFAULT 'standard'
        CHECK (ai_plan_mode IN ('standard', 'ai_enhanced')),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_ai_settings_school ON class_ai_settings(school_id);

COMMENT ON TABLE class_ai_settings IS
    'Per-class AI plan mode. If no row exists for a class, falls back to school_settings.ai_plan_mode.';

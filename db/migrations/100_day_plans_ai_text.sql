-- Migration 100: Store AI-generated plan text in day_plans
-- Once generated, the same text is served to all teachers in the class.
-- This eliminates different AI responses per section and reduces AI calls.

ALTER TABLE day_plans ADD COLUMN IF NOT EXISTS ai_plan_text TEXT;

COMMENT ON COLUMN day_plans.ai_plan_text IS 'AI-generated plan text cached per plan. Generated once, served to all teachers in the class.';

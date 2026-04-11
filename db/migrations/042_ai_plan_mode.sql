-- Migration 042: AI Plan Mode setting
-- Adds per-school toggle to enable AI-enhanced daily plan generation.
-- When enabled, the teacher's daily plan is sent to AI for rich formatting.
-- This consumes AI credits per plan request.

ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS ai_plan_mode TEXT NOT NULL DEFAULT 'standard'
  CHECK (ai_plan_mode IN ('standard', 'ai_enhanced'));

COMMENT ON COLUMN school_settings.ai_plan_mode IS
  'standard = show curriculum chunks as-is; ai_enhanced = send to AI for rich formatted plan';

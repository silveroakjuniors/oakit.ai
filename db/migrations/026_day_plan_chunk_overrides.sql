-- Migration 026: Add chunk_label_overrides to day_plans
-- Stores per-section topic label overrides as {chunk_id: custom_label}
-- This allows editing a day's topic labels without affecting other sections
ALTER TABLE day_plans ADD COLUMN IF NOT EXISTS chunk_label_overrides JSONB NOT NULL DEFAULT '{}';

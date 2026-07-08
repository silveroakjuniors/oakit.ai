-- Migration 094: Add error_message column to curriculum_documents
-- Stores the actual error reason when ingestion fails, so admins can diagnose issues
ALTER TABLE curriculum_documents
  ADD COLUMN IF NOT EXISTS error_message TEXT DEFAULT NULL;

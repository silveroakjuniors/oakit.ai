-- Migration 022: Add portal_access to roles
-- Allows custom role names (e.g. "Center Head", "Accountant") to map to a system portal
-- Valid values: admin, principal, teacher, parent (null = use role name as-is)

ALTER TABLE roles ADD COLUMN IF NOT EXISTS portal_access TEXT
  CHECK (portal_access IN ('admin', 'principal', 'teacher', 'parent'));

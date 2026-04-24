-- Migration 064: Financial module role segregation
--
-- Segregation of duties:
--   principal       → all financial permissions (unchanged)
--   admin           → fee collection + fee structure management + reconciliation + reports
--                     NO salary, NO expenses
--   finance_manager → fee collection + view fees + view reconciliation + view reports
--                     (principal can grant additional permissions per-user)
--
-- New permission: MANAGE_FEE_STRUCTURE (create/edit/delete fee structures and fee heads)
-- This replaces the previous pattern of using VIEW_FEES for write operations on structures.

-- Update the roles table permissions arrays for existing schools.
-- The roles table stores permissions as a JSONB array.
-- We update admin and finance_manager to reflect the new segregation.

UPDATE roles
SET permissions = '["VIEW_FEES","COLLECT_PAYMENT","MANAGE_FEE_STRUCTURE","VIEW_RECONCILIATION","PERFORM_RECONCILIATION","VIEW_REPORTS","SEND_REMINDER"]'::jsonb
WHERE name = 'admin';

UPDATE roles
SET permissions = '["VIEW_FEES","COLLECT_PAYMENT","VIEW_RECONCILIATION","VIEW_REPORTS"]'::jsonb
WHERE name = 'finance_manager';

-- principal keeps all permissions (add MANAGE_FEE_STRUCTURE if not already present)
UPDATE roles
SET permissions = permissions || '["MANAGE_FEE_STRUCTURE"]'::jsonb
WHERE name = 'principal'
  AND NOT (permissions @> '["MANAGE_FEE_STRUCTURE"]'::jsonb);

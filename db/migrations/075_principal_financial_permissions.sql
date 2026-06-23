-- Migration 075: Grant full financial permissions to the principal role
--
-- Root cause: The principal role in the roles table only had general permissions
-- (read:all, read:dashboard, query:ai) from the initial seed. Financial permissions
-- were never explicitly added to the DB row, so the JWT built at login time
-- contained no financial permissions, causing 403 on all financial routes.
--
-- Fix: Set the complete financial permission set on every principal role row
-- across all schools. This is idempotent — running it again is safe.

UPDATE roles
SET permissions = (
  -- Preserve any existing non-financial permissions and merge in all financial ones
  (COALESCE(permissions, '[]'::jsonb) - 'VIEW_SALARY'::text)
  || '["VIEW_SALARY","EDIT_SALARY","PUSH_PAYSLIP","VIEW_EXPENSE","ADD_EXPENSE","MANAGE_FEE_STRUCTURE","VIEW_FEES","COLLECT_PAYMENT","MANAGE_CONCESSION","APPROVE_CONCESSION","VIEW_RECONCILIATION","PERFORM_RECONCILIATION","VIEW_REPORTS","VIEW_PROFIT","SEND_REMINDER","MANAGE_ATTENDANCE","MANAGE_HR","APPROVE_TERMINATION"]'::jsonb
)
WHERE name = 'principal';

-- Also update any custom roles that map to the principal portal
-- (e.g. "Center Head" roles that have portal_access = 'principal')
UPDATE roles
SET permissions = (
  (COALESCE(permissions, '[]'::jsonb))
  || '["VIEW_SALARY","EDIT_SALARY","PUSH_PAYSLIP","VIEW_EXPENSE","ADD_EXPENSE","MANAGE_FEE_STRUCTURE","VIEW_FEES","COLLECT_PAYMENT","MANAGE_CONCESSION","APPROVE_CONCESSION","VIEW_RECONCILIATION","PERFORM_RECONCILIATION","VIEW_REPORTS","VIEW_PROFIT","SEND_REMINDER","MANAGE_ATTENDANCE","MANAGE_HR","APPROVE_TERMINATION"]'::jsonb
)
WHERE portal_access = 'principal'
  AND name != 'principal';

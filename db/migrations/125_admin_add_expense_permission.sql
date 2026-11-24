-- Migration 125: Grant ADD_EXPENSE to admin role (but NOT VIEW_EXPENSE)
-- Admin can record expenses but cannot view the expense list or reports.
-- Only Principal can view expenses and financial reports that include expense data.

UPDATE roles
SET permissions = (permissions || '["ADD_EXPENSE"]'::jsonb) - 'VIEW_EXPENSE'
WHERE name = 'admin'
  AND NOT (permissions @> '["ADD_EXPENSE"]'::jsonb);

/**
 * Financial module permission constants and default role permission mappings.
 *
 * `PERMISSIONS` is a frozen constant object — use these values wherever a
 * permission string is required so that typos are caught at compile time.
 *
 * `DEFAULT_ROLE_PERMISSIONS` defines the baseline permission set assigned to
 * each role when a school's financial module is first configured.  Individual
 * users may have their permissions overridden via the `financial_permissions`
 * JSONB column on the `users` table (managed through the
 * `PUT /api/v1/financial/permissions/:userId` endpoint).
 */

/** All available financial-module permissions. */
export const PERMISSIONS = {
  VIEW_SALARY:              'VIEW_SALARY',
  EDIT_SALARY:              'EDIT_SALARY',
  VIEW_EXPENSE:             'VIEW_EXPENSE',
  ADD_EXPENSE:              'ADD_EXPENSE',
  VIEW_PROFIT:              'VIEW_PROFIT',
  VIEW_FEES:                'VIEW_FEES',
  COLLECT_PAYMENT:          'COLLECT_PAYMENT',
  MANAGE_FEE_STRUCTURE:     'MANAGE_FEE_STRUCTURE',   // create/edit/delete fee structures & heads
  MANAGE_CONCESSION:        'MANAGE_CONCESSION',
  VIEW_RECONCILIATION:      'VIEW_RECONCILIATION',
  PERFORM_RECONCILIATION:   'PERFORM_RECONCILIATION',
  VIEW_REPORTS:             'VIEW_REPORTS',
  SEND_REMINDER:            'SEND_REMINDER',
  PUSH_PAYSLIP:             'PUSH_PAYSLIP',
  MANAGE_ATTENDANCE:        'MANAGE_ATTENDANCE',
  MANAGE_HR:                'MANAGE_HR',
  APPROVE_TERMINATION:      'APPROVE_TERMINATION',
} as const;

/** Union type of all valid permission strings. */
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Default permission sets per role.
 *
 * Segregation of duties:
 *  - principal       → everything (salary, expenses, fee structures, collection, reports)
 *  - admin           → fee collection + fee structure management + reconciliation + reports
 *                      NO salary, NO expenses (those are principal/accountant only)
 *  - finance_manager → fee collection + view fees + view reconciliation + view reports
 *                      (principal can grant additional permissions per-user)
 *  - teacher/parent  → view fees only (parent portal)
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  principal:       Object.values(PERMISSIONS) as Permission[],
  admin:           [
    'VIEW_FEES',
    'COLLECT_PAYMENT',
    'MANAGE_FEE_STRUCTURE',
    'VIEW_RECONCILIATION',
    'PERFORM_RECONCILIATION',
    'VIEW_REPORTS',
    'SEND_REMINDER',
  ],
  finance_manager: [
    'VIEW_FEES',
    'COLLECT_PAYMENT',
    'VIEW_RECONCILIATION',
    'VIEW_REPORTS',
  ],
  teacher:         [],
  parent:          ['VIEW_FEES'],
};

/**
 * Financial module permission constants and default role permission mappings.
 *
 * Segregation of duties (SOD):
 *
 *  principal       → ALL permissions. Only principal can assign financial
 *                    permissions to other users.
 *
 *  admin           → Fee collection, fee structure management, view fees,
 *                    view reports, send reminders.
 *                    NO salary, NO expenses, NO reconciliation by default.
 *                    Principal can grant extras.
 *
 *  finance_manager → (Accountant role) Fee collection, view fees, add/view
 *                    expenses, manage concessions, reconciliation (bank + cash),
 *                    view reports.
 *                    NO salary by default — principal must explicitly grant.
 *
 *  teacher/parent  → View fees only (parent portal).
 */

/** All available financial-module permissions. */
export const PERMISSIONS = {
  // Salary (PIN-protected; principal-only by default)
  VIEW_SALARY:              'VIEW_SALARY',
  EDIT_SALARY:              'EDIT_SALARY',
  PUSH_PAYSLIP:             'PUSH_PAYSLIP',

  // Expenses (accountant + principal; admin needs explicit grant)
  VIEW_EXPENSE:             'VIEW_EXPENSE',
  ADD_EXPENSE:              'ADD_EXPENSE',

  // Fee structures (admin + accountant + principal)
  MANAGE_FEE_STRUCTURE:     'MANAGE_FEE_STRUCTURE',

  // Fee collection (admin + accountant; principal does NOT collect)
  VIEW_FEES:                'VIEW_FEES',
  COLLECT_PAYMENT:          'COLLECT_PAYMENT',

  // Concessions (create: admin + accountant; approve: accountant + principal)
  MANAGE_CONCESSION:        'MANAGE_CONCESSION',
  APPROVE_CONCESSION:       'APPROVE_CONCESSION',

  // Reconciliation (accountant + principal; NOT admin)
  VIEW_RECONCILIATION:      'VIEW_RECONCILIATION',
  PERFORM_RECONCILIATION:   'PERFORM_RECONCILIATION',

  // Reports & insights
  VIEW_REPORTS:             'VIEW_REPORTS',
  VIEW_PROFIT:              'VIEW_PROFIT',

  // Reminders
  SEND_REMINDER:            'SEND_REMINDER',

  // HR (future)
  MANAGE_ATTENDANCE:        'MANAGE_ATTENDANCE',
  MANAGE_HR:                'MANAGE_HR',
  APPROVE_TERMINATION:      'APPROVE_TERMINATION',
} as const;

/** Union type of all valid permission strings. */
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // Principal: everything
  principal: Object.values(PERMISSIONS) as Permission[],

  // Admin: fee collection + fee structures + view fees + reports + reminders
  // NO salary, NO expenses, NO reconciliation, NO concession approval by default
  admin: [
    'VIEW_FEES',
    'COLLECT_PAYMENT',
    'MANAGE_FEE_STRUCTURE',
    'MANAGE_CONCESSION',   // can create concessions; approval is separate
    'VIEW_REPORTS',
    'SEND_REMINDER',
  ],

  // Finance Manager (Accountant): fee collection + expenses + concessions +
  // reconciliation + reports. NO salary by default.
  finance_manager: [
    'VIEW_FEES',
    'COLLECT_PAYMENT',
    'MANAGE_FEE_STRUCTURE',
    'VIEW_EXPENSE',
    'ADD_EXPENSE',
    'MANAGE_CONCESSION',
    'APPROVE_CONCESSION',
    'VIEW_RECONCILIATION',
    'PERFORM_RECONCILIATION',
    'VIEW_REPORTS',
    'SEND_REMINDER',
  ],

  teacher: [],
  parent:  ['VIEW_FEES'],
};

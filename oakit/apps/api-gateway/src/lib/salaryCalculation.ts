/**
 * Salary Calculation Engine
 *
 * Provides `calculateMonthlySalary()` which computes a staff member's
 * monthly net salary from their gross salary, attendance data, and
 * deduction preferences.
 *
 * The Principal may override the computed net salary with an explicit
 * `override_amount`, which bypasses the formula while still recording
 * the underlying per-day rate and deduction for audit purposes.
 */

/**
 * How the school determines the number of working days in a month.
 * Stored in `monthly_working_days.calculation_method`.
 */
export type SalaryCalculationMethod =
  | 'weekday_count'
  | 'calendar_days'
  | 'custom_working_days';

/**
 * Whether absent days should be deducted from the gross salary or
 * the staff member should be paid in full regardless of absences.
 */
export type DeductionChoice = 'deduct' | 'pay_full';

/** Input required to calculate a monthly salary. */
export interface SalaryCalculationInput {
  /** Gross (full) monthly salary for the staff member in the school's currency. */
  gross_salary: number;
  /** Number of days the staff member was present during the month. */
  present_days: number;
  /** Number of days the staff member was absent (without approved leave). */
  absent_days: number;
  /** Number of approved leave days taken during the month. */
  leave_days: number;
  /**
   * Total working days in the month — the denominator used to derive the
   * per-day rate. Sourced from the `monthly_working_days` table.
   */
  working_days: number;
  /**
   * Whether absent days should be deducted (`'deduct'`) or the staff member
   * should receive full pay regardless of absences (`'pay_full'`).
   */
  deduction_choice: DeductionChoice;
  /**
   * Optional Principal override for the final net salary.
   * When provided (non-null), the formula result is ignored and this value
   * is used instead (clamped to a minimum of 0).
   */
  override_amount?: number | null;
}

/** Result returned by `calculateMonthlySalary()`. */
export interface SalaryCalculationResult {
  /**
   * Gross salary divided by working days.
   * Zero when `working_days` is 0 (guards against division by zero).
   */
  per_day_rate: number;
  /**
   * Amount deducted for absent days.
   * Zero when `deduction_choice` is `'pay_full'`.
   */
  deduction_amount: number;
  /**
   * Final net salary to be paid.
   * Equals `override_amount` (clamped ≥ 0) when an override is set,
   * otherwise equals `gross_salary − deduction_amount` (clamped ≥ 0).
   */
  net_salary: number;
}

/**
 * Calculate the net monthly salary for a staff member.
 *
 * Formulas:
 * - `per_day_rate`    = `working_days > 0 ? gross_salary / working_days : 0`
 * - `deduction_amount`= `deduction_choice === 'deduct' ? Math.max(0, absent_days × per_day_rate) : 0`
 * - `calculated_net`  = `Math.max(0, gross_salary − deduction_amount)`
 * - `net_salary`      = `override_amount != null ? Math.max(0, override_amount) : calculated_net`
 *
 * The `per_day_rate` and `deduction_amount` are always recorded in the
 * `salary_records` row even when an override is applied, preserving the
 * audit trail of what the formula would have produced.
 *
 * @param input - Gross salary, attendance figures, deduction choice, and optional override.
 * @returns The per-day rate, deduction amount, and final net salary.
 */
export function calculateMonthlySalary(input: SalaryCalculationInput): SalaryCalculationResult {
  const { gross_salary, absent_days, working_days, deduction_choice, override_amount } = input;

  const per_day_rate = working_days > 0 ? gross_salary / working_days : 0;

  const deduction_amount =
    deduction_choice === 'deduct' ? Math.max(0, absent_days * per_day_rate) : 0;

  const calculated_net = Math.max(0, gross_salary - deduction_amount);

  const net_salary = override_amount != null ? Math.max(0, override_amount) : calculated_net;

  return { per_day_rate, deduction_amount, net_salary };
}

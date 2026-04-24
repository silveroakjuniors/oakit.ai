/**
 * Fee Calculation Engine
 *
 * Provides `calculateMonthlyFee()` which converts a rate and billing basis
 * into a normalised monthly fee amount, using the industry-standard
 * approximation of 4.33 weeks per month.
 */

/** How the rate is expressed for a given fee head. */
export type BillingBasis = 'per_hour' | 'per_day' | 'per_week' | 'per_month_flat';

/** Input required to calculate a monthly fee. */
export interface FeeCalculationInput {
  /** The billing basis that determines which formula is applied. */
  billing_basis: BillingBasis;
  /** The rate value in the school's currency (e.g. ₹ per hour, ₹ per day, etc.). */
  rate: number;
  /** Hours attended per day — required when `billing_basis` is `per_hour`. */
  hours_per_day?: number;
  /** Days attended per week — required when `billing_basis` is `per_hour` or `per_day`. */
  days_per_week?: number;
}

/** Result returned by `calculateMonthlyFee()`. */
export interface FeeCalculationResult {
  /** The computed monthly fee in the school's currency. */
  calculated_monthly_fee: number;
  /** Human-readable description of the formula used, using × for multiplication. */
  formula_description: string;
}

/**
 * Average number of weeks in a calendar month.
 * Used as the standard multiplier when converting weekly or sub-weekly rates
 * to a monthly equivalent.
 */
const WEEKS_PER_MONTH = 4.33;

/**
 * Calculate the normalised monthly fee for a fee head.
 *
 * Formulas by billing basis:
 * - `per_hour`      → rate × hours_per_day × days_per_week × 4.33
 * - `per_day`       → rate × days_per_week × 4.33
 * - `per_week`      → rate × 4.33
 * - `per_month_flat`→ rate (flat, no multiplication)
 *
 * Missing optional inputs (`hours_per_day`, `days_per_week`) default to 0,
 * which naturally produces a 0 monthly fee rather than a runtime error.
 *
 * @param input - The billing basis, rate, and optional attendance parameters.
 * @returns The calculated monthly fee and a human-readable formula description.
 */
export function calculateMonthlyFee(input: FeeCalculationInput): FeeCalculationResult {
  const { billing_basis, rate, hours_per_day = 0, days_per_week = 0 } = input;

  switch (billing_basis) {
    case 'per_hour':
      return {
        calculated_monthly_fee: rate * hours_per_day * days_per_week * WEEKS_PER_MONTH,
        formula_description: `${rate} × ${hours_per_day}h/day × ${days_per_week}d/week × 4.33`,
      };

    case 'per_day':
      return {
        calculated_monthly_fee: rate * days_per_week * WEEKS_PER_MONTH,
        formula_description: `${rate} × ${days_per_week}d/week × 4.33`,
      };

    case 'per_week':
      return {
        calculated_monthly_fee: rate * WEEKS_PER_MONTH,
        formula_description: `${rate} × 4.33`,
      };

    case 'per_month_flat':
      return {
        calculated_monthly_fee: rate,
        formula_description: `flat ${rate}/month`,
      };
  }
}

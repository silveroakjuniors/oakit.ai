/**
 * Fee Calculation Engine
 *
 * Handles two distinct categories of fee billing:
 *
 * LUMP-SUM (no calculation needed):
 *   per_year  — a single annual amount collected once a year
 *   per_term  — a fixed amount per term (school defines its own terms)
 *
 * TIME-BASED (monthly equivalent calculated):
 *   per_hour       → rate × hours_per_day × days_per_week × 4.33
 *   per_day        → rate × days_per_week × 4.33
 *   per_week       → rate × 4.33
 *   per_month_flat → rate (flat, no multiplication)
 *
 * For per_year and per_term, the amount is stored as-is in `amount`.
 * No monthly conversion is performed — the school collects the lump sum
 * at the start of the year or term respectively.
 */

/** All valid billing basis values. */
export const VALID_BILLING_BASIS: string[] = [
  'per_hour',
  'per_day',
  'per_week',
  'per_month_flat',
  'per_year',
  'per_term',
];

/** How the fee is billed. */
export type BillingBasis =
  | 'per_hour'
  | 'per_day'
  | 'per_week'
  | 'per_month_flat'
  | 'per_year'
  | 'per_term';

/** Whether this billing basis is a lump-sum (no monthly calculation). */
export function isLumpSum(basis: BillingBasis): boolean {
  return basis === 'per_year' || basis === 'per_term';
}

/** Input for the fee calculation wizard. */
export interface FeeCalculationInput {
  billing_basis: BillingBasis;

  // Time-based inputs
  rate?: number;
  hours_per_day?: number;
  days_per_week?: number;

  // Lump-sum inputs
  yearly_amount?: number;
  term_amount?: number;
  term_count?: number;
}

/** Result from the fee calculation wizard. */
export interface FeeCalculationResult {
  /**
   * For time-based billing: the computed monthly fee.
   * For lump-sum billing: 0 (not applicable — use amount_display instead).
   */
  calculated_monthly_fee: number;
  /** Human-readable description of the fee. */
  formula_description: string;
  /**
   * The actual fee amount to store on the fee head.
   * For per_year: the yearly_amount.
   * For per_term: the term_amount.
   * For time-based: same as calculated_monthly_fee.
   */
  amount: number;
  /** True when billing_basis is per_year or per_term. */
  is_lump_sum: boolean;
  /** Label for display: 'year', 'term', or 'month'. */
  billing_label: 'year' | 'term' | 'month';
}

const WEEKS_PER_MONTH = 4.33;

export function calculateFee(input: FeeCalculationInput): FeeCalculationResult {
  const {
    billing_basis,
    rate = 0,
    hours_per_day = 0,
    days_per_week = 0,
    yearly_amount = 0,
    term_amount = 0,
  } = input;

  switch (billing_basis) {
    case 'per_year':
      return {
        calculated_monthly_fee: 0,
        formula_description: `₹${yearly_amount.toLocaleString('en-IN')} collected once per year`,
        amount: yearly_amount,
        is_lump_sum: true,
        billing_label: 'year',
      };

    case 'per_term':
      return {
        calculated_monthly_fee: 0,
        formula_description: `₹${term_amount.toLocaleString('en-IN')} collected per term`,
        amount: term_amount,
        is_lump_sum: true,
        billing_label: 'term',
      };

    case 'per_hour': {
      const monthly = rate * hours_per_day * days_per_week * WEEKS_PER_MONTH;
      return {
        calculated_monthly_fee: monthly,
        formula_description: `₹${rate}/hr × ${hours_per_day}h/day × ${days_per_week}d/week × 4.33 weeks`,
        amount: monthly,
        is_lump_sum: false,
        billing_label: 'month',
      };
    }

    case 'per_day': {
      const monthly = rate * days_per_week * WEEKS_PER_MONTH;
      return {
        calculated_monthly_fee: monthly,
        formula_description: `₹${rate}/day × ${days_per_week}d/week × 4.33 weeks`,
        amount: monthly,
        is_lump_sum: false,
        billing_label: 'month',
      };
    }

    case 'per_week': {
      const monthly = rate * WEEKS_PER_MONTH;
      return {
        calculated_monthly_fee: monthly,
        formula_description: `₹${rate}/week × 4.33 weeks`,
        amount: monthly,
        is_lump_sum: false,
        billing_label: 'month',
      };
    }

    case 'per_month_flat':
      return {
        calculated_monthly_fee: rate,
        formula_description: `₹${rate}/month (flat)`,
        amount: rate,
        is_lump_sum: false,
        billing_label: 'month',
      };

    default:
      return {
        calculated_monthly_fee: 0,
        formula_description: 'Unknown billing basis',
        amount: 0,
        is_lump_sum: false,
        billing_label: 'month',
      };
  }
}

/** Backward-compatible alias used by existing routes. */
export function calculateMonthlyFee(input: FeeCalculationInput): { calculated_monthly_fee: number; formula_description: string; annual_equivalent: number } {
  const result = calculateFee(input);
  return {
    calculated_monthly_fee: result.calculated_monthly_fee,
    formula_description: result.formula_description,
    annual_equivalent: result.calculated_monthly_fee * 12,
  };
}

/**
 * Normalise the pricing_model value before storing.
 * Maps legacy 'flat' → 'fixed'; all other values pass through unchanged.
 */
export function normalisePricingModel(value: string): string {
  return value === 'flat' ? 'fixed' : value;
}

/** Validate required inputs for a given billing basis. Returns error string or null. */
export function validateFeeCalculationInput(input: FeeCalculationInput): string | null {
  switch (input.billing_basis) {
    case 'per_hour':
      if (!input.rate || input.rate <= 0) return 'rate is required for per_hour billing';
      if (!input.hours_per_day || input.hours_per_day <= 0) return 'hours_per_day is required for per_hour billing';
      if (!input.days_per_week || input.days_per_week <= 0) return 'days_per_week is required for per_hour billing';
      break;
    case 'per_day':
      if (!input.rate || input.rate <= 0) return 'rate is required for per_day billing';
      if (!input.days_per_week || input.days_per_week <= 0) return 'days_per_week is required for per_day billing';
      break;
    case 'per_week':
      if (!input.rate || input.rate <= 0) return 'rate is required for per_week billing';
      break;
    case 'per_month_flat':
      if (input.rate === undefined || input.rate < 0) return 'rate is required for per_month_flat billing';
      break;
    case 'per_year':
      if (!input.yearly_amount || input.yearly_amount <= 0) return 'yearly_amount is required for per_year billing';
      break;
    case 'per_term':
      if (!input.term_amount || input.term_amount <= 0) return 'term_amount is required for per_term billing';
      break;
    default:
      return 'billing_basis must be one of: per_hour, per_day, per_week, per_month_flat, per_year, per_term';
  }
  return null;
}

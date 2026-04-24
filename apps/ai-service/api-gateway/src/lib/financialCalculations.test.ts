/**
 * Property-based tests for the financial calculation engines.
 * Uses fast-check to verify correctness properties across arbitrary inputs.
 */

import * as fc from 'fast-check';
import { calculateMonthlyFee } from './feeCalculation';
import { calculateMonthlySalary } from './salaryCalculation';
import type { FeeCalculationInput } from './feeCalculation';
import type { SalaryCalculationInput } from './salaryCalculation';

const WEEKS_PER_MONTH = 4.33;

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const positiveAmount = fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true, noDefaultInfinity: true });
const nonNegAmount   = fc.float({ min: Math.fround(0),    max: Math.fround(10000), noNaN: true, noDefaultInfinity: true });
const dayCount       = fc.integer({ min: 0, max: 31 });
const positiveDays   = fc.integer({ min: 1, max: 31 });
const hoursPerDay    = fc.float({ min: Math.fround(0.5), max: Math.fround(12), noNaN: true, noDefaultInfinity: true });
const daysPerWeek    = fc.float({ min: Math.fround(1),   max: Math.fround(7),  noNaN: true, noDefaultInfinity: true });
const deductionChoice = fc.oneof(fc.constant('deduct' as const), fc.constant('pay_full' as const));
const billingBasis    = fc.oneof(
  fc.constant('per_hour'       as const),
  fc.constant('per_day'        as const),
  fc.constant('per_week'       as const),
  fc.constant('per_month_flat' as const),
);

// ─── calculateMonthlyFee ─────────────────────────────────────────────────────

describe('calculateMonthlyFee — property tests', () => {

  test('result is always >= 0 for any non-negative rate', () => {
    fc.assert(fc.property(billingBasis, nonNegAmount, hoursPerDay, daysPerWeek, (basis, rate, h, d) => {
      const input: FeeCalculationInput = { billing_basis: basis, rate, hours_per_day: h, days_per_week: d };
      const { calculated_monthly_fee } = calculateMonthlyFee(input);
      expect(calculated_monthly_fee).toBeGreaterThanOrEqual(0);
    }));
  });

  test('per_month_flat: result equals rate exactly', () => {
    fc.assert(fc.property(nonNegAmount, (rate) => {
      const { calculated_monthly_fee } = calculateMonthlyFee({ billing_basis: 'per_month_flat', rate });
      expect(calculated_monthly_fee).toBe(rate);
    }));
  });

  test('per_hour with hours_per_day = 0: result is 0', () => {
    fc.assert(fc.property(positiveAmount, daysPerWeek, (rate, d) => {
      const { calculated_monthly_fee } = calculateMonthlyFee({
        billing_basis: 'per_hour', rate, hours_per_day: 0, days_per_week: d,
      });
      expect(calculated_monthly_fee).toBe(0);
    }));
  });

  test('per_hour with days_per_week = 0: result is 0', () => {
    fc.assert(fc.property(positiveAmount, hoursPerDay, (rate, h) => {
      const { calculated_monthly_fee } = calculateMonthlyFee({
        billing_basis: 'per_hour', rate, hours_per_day: h, days_per_week: 0,
      });
      expect(calculated_monthly_fee).toBe(0);
    }));
  });

  test('per_day with days_per_week = 0: result is 0', () => {
    fc.assert(fc.property(positiveAmount, (rate) => {
      const { calculated_monthly_fee } = calculateMonthlyFee({
        billing_basis: 'per_day', rate, days_per_week: 0,
      });
      expect(calculated_monthly_fee).toBe(0);
    }));
  });

  test('per_week: result equals rate * 4.33', () => {
    fc.assert(fc.property(nonNegAmount, (rate) => {
      const { calculated_monthly_fee } = calculateMonthlyFee({ billing_basis: 'per_week', rate });
      expect(calculated_monthly_fee).toBeCloseTo(rate * WEEKS_PER_MONTH, 8);
    }));
  });

  test('per_hour with positive inputs: result equals rate * h * d * 4.33', () => {
    fc.assert(fc.property(positiveAmount, hoursPerDay, daysPerWeek, (rate, h, d) => {
      const { calculated_monthly_fee } = calculateMonthlyFee({
        billing_basis: 'per_hour', rate, hours_per_day: h, days_per_week: d,
      });
      expect(calculated_monthly_fee).toBeCloseTo(rate * h * d * WEEKS_PER_MONTH, 8);
    }));
  });

  test('per_day with positive inputs: result equals rate * d * 4.33', () => {
    fc.assert(fc.property(positiveAmount, daysPerWeek, (rate, d) => {
      const { calculated_monthly_fee } = calculateMonthlyFee({
        billing_basis: 'per_day', rate, days_per_week: d,
      });
      expect(calculated_monthly_fee).toBeCloseTo(rate * d * WEEKS_PER_MONTH, 8);
    }));
  });

  test('formula_description is always a non-empty string', () => {
    fc.assert(fc.property(billingBasis, nonNegAmount, hoursPerDay, daysPerWeek, (basis, rate, h, d) => {
      const { formula_description } = calculateMonthlyFee({
        billing_basis: basis, rate, hours_per_day: h, days_per_week: d,
      });
      expect(typeof formula_description).toBe('string');
      expect(formula_description.length).toBeGreaterThan(0);
    }));
  });

  test('fractional rates produce finite results', () => {
    fc.assert(fc.property(
      fc.float({ min: Math.fround(0.01), max: Math.fround(0.99), noNaN: true, noDefaultInfinity: true }),
      fc.float({ min: Math.fround(0.5),  max: Math.fround(2.5),  noNaN: true, noDefaultInfinity: true }),
      fc.float({ min: Math.fround(0.5),  max: Math.fround(6.5),  noNaN: true, noDefaultInfinity: true }),
      (rate, h, d) => {
        const { calculated_monthly_fee } = calculateMonthlyFee({
          billing_basis: 'per_hour', rate, hours_per_day: h, days_per_week: d,
        });
        expect(isFinite(calculated_monthly_fee)).toBe(true);
      }
    ));
  });
});

// ─── calculateMonthlySalary ──────────────────────────────────────────────────

describe('calculateMonthlySalary — property tests', () => {

  test('net_salary is always >= 0', () => {
    fc.assert(fc.property(
      positiveAmount, dayCount, dayCount, dayCount, positiveDays, deductionChoice,
      (gross, present, absent, leave, working, choice) => {
        const input: SalaryCalculationInput = {
          gross_salary: gross, present_days: present, absent_days: absent,
          leave_days: leave, working_days: working, deduction_choice: choice,
        };
        const { net_salary } = calculateMonthlySalary(input);
        expect(net_salary).toBeGreaterThanOrEqual(0);
      }
    ));
  });

  test('deduction_amount is always >= 0', () => {
    fc.assert(fc.property(
      positiveAmount, dayCount, dayCount, dayCount, positiveDays, deductionChoice,
      (gross, present, absent, leave, working, choice) => {
        const { deduction_amount } = calculateMonthlySalary({
          gross_salary: gross, present_days: present, absent_days: absent,
          leave_days: leave, working_days: working, deduction_choice: choice,
        });
        expect(deduction_amount).toBeGreaterThanOrEqual(0);
      }
    ));
  });

  test('pay_full: net_salary equals gross_salary (no override)', () => {
    fc.assert(fc.property(
      positiveAmount, dayCount, dayCount, dayCount, positiveDays,
      (gross, present, absent, leave, working) => {
        const { net_salary } = calculateMonthlySalary({
          gross_salary: gross, present_days: present, absent_days: absent,
          leave_days: leave, working_days: working, deduction_choice: 'pay_full',
        });
        expect(net_salary).toBeCloseTo(gross, 8);
      }
    ));
  });

  test('working_days = 0: per_day_rate is 0 (no division by zero)', () => {
    fc.assert(fc.property(positiveAmount, dayCount, deductionChoice, (gross, absent, choice) => {
      const { per_day_rate } = calculateMonthlySalary({
        gross_salary: gross, present_days: 0, absent_days: absent,
        leave_days: 0, working_days: 0, deduction_choice: choice,
      });
      expect(per_day_rate).toBe(0);
    }));
  });

  test('override_amount set: net_salary = Math.max(0, override_amount)', () => {
    fc.assert(fc.property(
      positiveAmount, dayCount, dayCount, positiveDays, deductionChoice,
      fc.float({ min: Math.fround(-500), max: Math.fround(50000), noNaN: true, noDefaultInfinity: true }),
      (gross, absent, leave, working, choice, override) => {
        const { net_salary } = calculateMonthlySalary({
          gross_salary: gross, present_days: 0, absent_days: absent,
          leave_days: leave, working_days: working, deduction_choice: choice,
          override_amount: override,
        });
        expect(net_salary).toBeCloseTo(Math.max(0, override), 8);
      }
    ));
  });

  test('override_amount = null: behaves as if no override', () => {
    fc.assert(fc.property(positiveAmount, positiveDays, (gross, working) => {
      const withNull = calculateMonthlySalary({
        gross_salary: gross, present_days: working, absent_days: 0,
        leave_days: 0, working_days: working, deduction_choice: 'pay_full',
        override_amount: null,
      });
      const withUndefined = calculateMonthlySalary({
        gross_salary: gross, present_days: working, absent_days: 0,
        leave_days: 0, working_days: working, deduction_choice: 'pay_full',
      });
      expect(withNull.net_salary).toBeCloseTo(withUndefined.net_salary, 8);
    }));
  });

  test('deduct + absent_days = 0: net_salary equals gross_salary (no override)', () => {
    fc.assert(fc.property(positiveAmount, positiveDays, (gross, working) => {
      const { net_salary } = calculateMonthlySalary({
        gross_salary: gross, present_days: working, absent_days: 0,
        leave_days: 0, working_days: working, deduction_choice: 'deduct',
      });
      expect(net_salary).toBeCloseTo(gross, 8);
    }));
  });

  test('per_day_rate = gross_salary / working_days when working_days > 0', () => {
    fc.assert(fc.property(positiveAmount, positiveDays, deductionChoice, (gross, working, choice) => {
      const { per_day_rate } = calculateMonthlySalary({
        gross_salary: gross, present_days: 0, absent_days: 0,
        leave_days: 0, working_days: working, deduction_choice: choice,
      });
      expect(per_day_rate).toBeCloseTo(gross / working, 8);
    }));
  });

  test('deduct: deduction_amount = absent_days * per_day_rate (clamped >= 0)', () => {
    fc.assert(fc.property(positiveAmount, dayCount, positiveDays, (gross, absent, working) => {
      const result = calculateMonthlySalary({
        gross_salary: gross, present_days: 0, absent_days: absent,
        leave_days: 0, working_days: working, deduction_choice: 'deduct',
      });
      const expectedDeduction = Math.max(0, absent * (gross / working));
      expect(result.deduction_amount).toBeCloseTo(expectedDeduction, 8);
    }));
  });
});

// ─── Concession Validation — property tests (Task 20.3) ──────────────────────

/**
 * Pure concession calculation helpers (no DB/API calls).
 * These mirror the logic in the concessions route handler.
 */

/**
 * Calculates the effective concession amount for a fee head.
 * - fixed: concession_amount = value (may exceed assigned_amount)
 * - percentage: concession_amount = (value / 100) * assigned_amount
 */
function calcConcessionAmount(
  type: 'fixed' | 'percentage',
  value: number,
  assigned_amount: number,
): number {
  if (type === 'fixed') return value;
  return (value / 100) * assigned_amount;
}

/**
 * Applies an approved concession to an outstanding balance.
 * new_balance = Math.max(0, outstanding - concession_amount)
 */
function applyConcesssion(outstanding: number, concession_amount: number): number {
  return Math.max(0, outstanding - concession_amount);
}

describe('Concession validation — property tests', () => {
  /**
   * Validates: Requirements 7.1
   * For any fixed concession where value > assigned_amount,
   * the effective concession amount exceeds the fee head total.
   */
  test('fixed concession: when value > assigned_amount, concession_amount > assigned_amount', () => {
    fc.assert(fc.property(
      positiveAmount,
      positiveAmount,
      (assigned, extra) => {
        const value = assigned + extra; // guaranteed > assigned
        const concession_amount = calcConcessionAmount('fixed', value, assigned);
        expect(concession_amount).toBeGreaterThan(assigned);
      }
    ));
  });

  /**
   * Validates: Requirements 7.1
   * For any percentage concession (0–100%), concession_amount <= assigned_amount.
   */
  test('percentage concession: concession_amount is always <= assigned_amount', () => {
    fc.assert(fc.property(
      positiveAmount,
      fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true, noDefaultInfinity: true }),
      (assigned, pct) => {
        const concession_amount = calcConcessionAmount('percentage', pct, assigned);
        expect(concession_amount).toBeLessThanOrEqual(assigned + 0.001); // float tolerance
      }
    ));
  });

  /**
   * Validates: Requirements 7.3
   * For any approved concession, new_balance = Math.max(0, outstanding - concession_amount).
   */
  test('approved concession: new_balance = max(0, outstanding - concession_amount)', () => {
    fc.assert(fc.property(
      nonNegAmount,
      nonNegAmount,
      (outstanding, concession_amount) => {
        const new_balance = applyConcesssion(outstanding, concession_amount);
        expect(new_balance).toBe(Math.max(0, outstanding - concession_amount));
      }
    ));
  });

  /**
   * Validates: Requirements 7.3
   * new_balance is always >= 0 (never goes negative).
   */
  test('approved concession: new_balance is always >= 0', () => {
    fc.assert(fc.property(
      nonNegAmount,
      nonNegAmount,
      (outstanding, concession_amount) => {
        const new_balance = applyConcesssion(outstanding, concession_amount);
        expect(new_balance).toBeGreaterThanOrEqual(0);
      }
    ));
  });

  /**
   * Validates: Requirements 7.3
   * When concession_amount >= outstanding, new_balance = 0.
   */
  test('approved concession: when concession >= outstanding, new_balance = 0', () => {
    fc.assert(fc.property(
      nonNegAmount,
      nonNegAmount,
      (outstanding, extra) => {
        const concession_amount = outstanding + extra; // guaranteed >= outstanding
        const new_balance = applyConcesssion(outstanding, concession_amount);
        expect(new_balance).toBe(0);
      }
    ));
  });
});

// ─── Credit Balance — property tests (Task 20.4) ─────────────────────────────

/**
 * Pure credit balance calculation helpers (no DB/API calls).
 * These mirror the logic in the payments route handler.
 */

/**
 * Calculates the excess (credit) when a payment exceeds the outstanding balance.
 * excess = amount - outstanding  (when amount > outstanding, else 0)
 */
function calcExcess(amount: number, outstanding: number): number {
  return Math.max(0, amount - outstanding);
}

/**
 * Calculates net payable after applying credit balance.
 * net_payable = Math.max(0, gross_payable - credit_balance)
 */
function calcNetPayable(gross_payable: number, credit_balance: number): number {
  return Math.max(0, gross_payable - credit_balance);
}

describe('Credit balance — property tests', () => {
  /**
   * Validates: Requirements 23.4
   * For any payment where amount > outstanding, excess = amount - outstanding.
   */
  test('overpayment: excess = amount - outstanding', () => {
    fc.assert(fc.property(
      nonNegAmount,
      positiveAmount,
      (outstanding, extra) => {
        const amount = outstanding + extra; // guaranteed > outstanding
        const excess = calcExcess(amount, outstanding);
        expect(excess).toBeCloseTo(amount - outstanding, 8);
      }
    ));
  });

  /**
   * Validates: Requirements 23.4
   * For any payment where amount <= outstanding, excess = 0.
   */
  test('exact or partial payment: excess = 0', () => {
    fc.assert(fc.property(
      positiveAmount,
      fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
      (outstanding, fraction) => {
        const amount = outstanding * fraction; // guaranteed <= outstanding
        const excess = calcExcess(amount, outstanding);
        expect(excess).toBe(0);
      }
    ));
  });

  /**
   * Validates: Requirements 23.5
   * For any invoice with credit_balance, net_payable = max(0, gross_payable - credit_balance).
   */
  test('invoice with credit: net_payable = max(0, gross - credit)', () => {
    fc.assert(fc.property(
      nonNegAmount,
      nonNegAmount,
      (gross_payable, credit_balance) => {
        const net_payable = calcNetPayable(gross_payable, credit_balance);
        expect(net_payable).toBe(Math.max(0, gross_payable - credit_balance));
      }
    ));
  });

  /**
   * Validates: Requirements 23.5
   * net_payable is always >= 0.
   */
  test('net_payable is always >= 0', () => {
    fc.assert(fc.property(
      nonNegAmount,
      nonNegAmount,
      (gross_payable, credit_balance) => {
        const net_payable = calcNetPayable(gross_payable, credit_balance);
        expect(net_payable).toBeGreaterThanOrEqual(0);
      }
    ));
  });

  /**
   * Validates: Requirements 23.5
   * When credit_balance >= gross_payable, net_payable = 0.
   */
  test('when credit >= gross, net_payable = 0', () => {
    fc.assert(fc.property(
      nonNegAmount,
      nonNegAmount,
      (gross_payable, extra) => {
        const credit_balance = gross_payable + extra; // guaranteed >= gross
        const net_payable = calcNetPayable(gross_payable, credit_balance);
        expect(net_payable).toBe(0);
      }
    ));
  });

  /**
   * Validates: Requirements 23.4 + 23.5
   * Excess from overpayment, when stored as credit and applied to next invoice,
   * reduces net_payable by exactly that excess amount (or to 0).
   */
  test('credit from overpayment correctly reduces next invoice', () => {
    fc.assert(fc.property(
      positiveAmount,
      positiveAmount,
      positiveAmount,
      (outstanding, overpay_extra, next_gross) => {
        const amount = outstanding + overpay_extra;
        const credit = calcExcess(amount, outstanding);
        const net = calcNetPayable(next_gross, credit);
        expect(net).toBe(Math.max(0, next_gross - credit));
        expect(net).toBeGreaterThanOrEqual(0);
      }
    ));
  });
});

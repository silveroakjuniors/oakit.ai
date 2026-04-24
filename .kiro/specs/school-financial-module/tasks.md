# Tasks: School Financial Module

## Task 1: Database Migrations (Foundation)

- [x] 1.1 Create migration `052_financial_module_settings.sql` — table `financial_module_settings(school_id, is_enabled, expense_module_enabled, updated_at)` with default `is_enabled = true`; add `financial_permissions JSONB DEFAULT '{}'` column to `users` table for per-user permission overrides
- [x] 1.2 Create migration `053_fee_structures.sql` — tables: `fee_structures(id, school_id, class_id, name, academic_year, is_active)`, `fee_heads(id, fee_structure_id, school_id, name, type, pricing_model, amount, billing_basis, rate, hours_per_day, days_per_week, calculated_monthly_fee, rounded_monthly_fee, instalment_count, booking_amount, late_fee_amount, late_fee_grace_days, is_variable, deleted_at)`, `fee_instalments(id, fee_head_id, school_id, due_date, amount, instalment_number)`
- [x] 1.3 Create migration `054_student_fee_accounts.sql` — tables: `student_fee_accounts(id, student_id, school_id, fee_head_id, assigned_amount, outstanding_balance, status, admission_date, deleted_at)`, `fee_payments(id, school_id, student_id, fee_head_id, amount, payment_mode, payment_date, reference_number, receipt_number, receipt_url, gateway_payment_id, gateway_status, reconciled_at, reconciled_by, deleted_at)`, `credit_balances(id, student_id, school_id, amount, created_at)`
- [x] 1.4 Create migration `055_concessions.sql` — table `concessions(id, school_id, student_id, fee_head_id, type, value, reason, status, created_by, approved_by, approved_at, rejection_reason, deleted_at)`
- [x] 1.5 Create migration `056_reconciliation.sql` — tables: `bank_reconciliation_uploads(id, school_id, uploaded_by, file_url, status, created_at)`, `bank_reconciliation_items(id, upload_id, school_id, transaction_date, amount, reference, match_status, matched_payment_id)`, `cash_reconciliation_logs(id, school_id, logged_by, date, total_cash, expected_cash, variance, status, reviewed_by, reviewed_at)`
- [x] 1.6 Create migration `057_expenses.sql` — table `expenses(id, school_id, date, amount, category, notes, attachment_url, created_by, deleted_at, deleted_by)`
- [x] 1.7 Create migration `058_salary.sql` — tables: `staff_salary_config(id, school_id, user_id, gross_salary, components JSONB, effective_from)`, `monthly_working_days(id, school_id, year, month, working_days, calculation_method)`, `salary_records(id, school_id, user_id, year, month, gross_salary, present_days, absent_days, leave_days, working_days, per_day_rate, deduction_amount, net_salary, override_amount, deduction_choice, status, payment_mode, payment_date, payslip_url, payslip_status, created_by, deleted_at)`, `principal_pin(school_id, pin_hash, failed_attempts, locked_until)`
- [x] 1.8 Create migration `059_usage_records.sql` — table `usage_records(id, school_id, student_id, fee_head_id, service_type, date, quantity, submitted_by, billing_period_year, billing_period_month)`
- [x] 1.9 Create migration `060_enquiries.sql` — table `enquiries(id, school_id, student_name, parent_name, contact_number, class_of_interest, enquiry_date, status, converted_student_id, notes, created_by)`

## Task 2: Core Backend Infrastructure

- [x] 2.1 Create `oakit/apps/api-gateway/src/middleware/financialModuleGuard.ts` — checks `financial_module_settings` with 60s Redis cache (`financial_module:{school_id}`); returns 403 with `FINANCIAL_MODULE_DISABLED` code when disabled; bypasses for `super_admin` and `franchise_admin` roles
- [x] 2.2 Create `oakit/apps/api-gateway/src/lib/permissions.ts` — export `PERMISSIONS` constants object and `DEFAULT_ROLE_PERMISSIONS` map as specified in the design document
- [x] 2.3 Create `oakit/apps/api-gateway/src/lib/feeCalculation.ts` — implement `calculateMonthlyFee()` with `WEEKS_PER_MONTH = 4.33` for all four `BillingBasis` types as specified in the design document
- [x] 2.4 Create `oakit/apps/api-gateway/src/lib/salaryCalculation.ts` — implement `calculateMonthlySalary()` with `per_day_rate`, `deduction_amount`, and `net_salary` logic including `override_amount` support as specified in the design document
- [x] 2.5 Install `pdfkit` and `@types/pdfkit` in `oakit/apps/api-gateway`; create `oakit/apps/api-gateway/src/lib/pdfService.ts` with `generateReceiptPDF`, `generatePayslipPDF`, `generateReportPDF`, `generateOfferLetterPDF`, and `generateExperienceLetterPDF` functions — all include branded header (logo, school name, address), page footer (generated-by, page number, date), and non-refundable notice on receipts
- [x] 2.6 Write property-based tests using `fast-check` for `calculateMonthlyFee` (all four billing bases, zero inputs, fractional rates) and `calculateMonthlySalary` (deduct vs pay_full, override_amount, zero working_days guard)

## Task 3: Financial Module Settings API

- [x] 3.1 Create `oakit/apps/api-gateway/src/routes/financial/settings.ts` — `GET /api/v1/financial/settings` (returns module status for school), `PUT /api/v1/financial/settings` (super_admin/franchise_admin only — enable/disable module and expense sub-module, invalidates Redis cache), `GET /api/v1/financial/permissions` (returns current user's financial permissions), `PUT /api/v1/financial/permissions/:userId` (principal only — update a Finance_Manager's permission set, records Audit_Log entry)
- [x] 3.2 Register all financial routes in `oakit/apps/api-gateway/src/index.ts` under `/api/v1/financial` with `financialModuleGuard` in the middleware chain

## Task 4: Fee Structure Management API

- [x] 4.1 Create `oakit/apps/api-gateway/src/routes/financial/feeStructures.ts` — `POST /` creates a fee structure with fee heads; `GET /` lists all structures for the school; `GET /:id` returns a structure with its fee heads and instalments; `PUT /:id` updates; `DELETE /:id` soft-deletes — all guarded by `permissionGuard('VIEW_FEES')` or `permissionGuard('COLLECT_PAYMENT')` as appropriate
- [x] 4.2 Add `POST /fee-structures/:id/assign-class` endpoint — assigns a fee structure to a class and bulk-inserts `student_fee_accounts` rows for all currently enrolled students in that class
- [x] 4.3 Add `POST /fee-wizard/calculate` endpoint — accepts `FeeCalculationInput`, calls `calculateMonthlyFee()`, returns `calculated_monthly_fee` and `formula_description` (implements Req 27)
- [x] 4.4 Add late fee calculation: create a scheduled job or trigger-on-read that checks `fee_instalments.due_date` against today and applies `late_fee_amount` to `student_fee_accounts.outstanding_balance` when overdue and `late_fee_grace_days` has passed (Req 4.9)

## Task 5: Student Enquiry and Admission API

- [x] 5.1 Create `oakit/apps/api-gateway/src/routes/financial/enquiries.ts` — `POST /` creates enquiry; `GET /` lists with status filter; `PUT /:id` updates status; `POST /:id/convert` converts to admission — triggers student record creation, fee structure assignment, parent account creation (or linking if mobile exists), and `student_fee_accounts` population (Req 3.1–3.17)
- [x] 5.2 Implement `POST /enquiries/:id/onboarding-fee-assignment` — accepts selected fee components with optional custom amounts for variable components, transport route/stop selection, activity multi-select, and usage-based inputs (hours/day, days/week); returns summary before save; `POST /enquiries/:id/onboarding-fee-assignment/confirm` saves without Principal approval (Req 3.9–3.17)

## Task 6: Fee Collection API

- [x] 6.1 Create `oakit/apps/api-gateway/src/routes/financial/payments.ts` — `POST /` records a payment (validates amount > 0, updates `outstanding_balance`, sets `status`, generates sequential `receipt_number`, calls `generateReceiptPDF`, uploads to Supabase Storage, returns `receipt_url`); `GET /student/:studentId` lists payment history; `GET /receipt/:paymentId/pdf` streams the receipt PDF — guarded by `permissionGuard('COLLECT_PAYMENT')`
- [x] 6.2 Implement credit balance logic in payment recording: when `amount > outstanding_balance`, insert/update `credit_balances` row with the excess; when generating a new invoice for a student with credit balance, auto-apply it to reduce net payable (Req 23.4–23.5)
- [x] 6.3 Create `oakit/apps/api-gateway/src/routes/financial/webhooks.ts` — `POST /razorpay` and `POST /phonepe` handlers; verify HMAC signature (reject + log on failure); on `payment.captured` match by `gateway_payment_id` and mark reconciled within the handler; on `payment.failed` update status and queue WhatsApp notification; on `refund.processed` record refund and adjust `credit_balances` (Req 5.9–5.10, 15.4–15.7)

## Task 7: Concession Management API

- [x] 7.1 Create `oakit/apps/api-gateway/src/routes/financial/concessions.ts` — `POST /` creates concession in `PENDING_APPROVAL` status (validates value ≤ fee_head total, sends in-app notification to Principal, records Audit_Log); `GET /pending` lists pending for Principal; `POST /:id/approve` applies concession (recalculates `outstanding_balance`, updates invoice, records Audit_Log); `POST /:id/reject` marks rejected with reason (notifies creator, records Audit_Log); `POST /bulk-approve` approves multiple in one action; `GET /student/:studentId` lists applied concessions — guarded by `permissionGuard('MANAGE_CONCESSION')` for create/approve/reject, `permissionGuard('VIEW_FEES')` for read

## Task 8: Fee Reconciliation API

- [x] 8.1 Create `oakit/apps/api-gateway/src/routes/financial/reconciliation.ts` — `POST /bank/upload` accepts PDF or CSV (rejects other types), uploads to Supabase Storage, calls AI service `POST /extract-bank-statement`, stores extracted items in `bank_reconciliation_items` with match status; `GET /bank/:uploadId` returns summary (matched/partial/unmatched counts); `POST /bank/:uploadId/confirm` marks matched payments as reconciled, records Audit_Log (Req 6.3–6.8)
- [x] 8.2 Add `POST /cash` logs daily cash total; `GET /cash` lists logs with variance; `POST /cash/:id/review` Principal approves or flags mismatch (records Audit_Log on mismatch) (Req 6.9–6.13)

## Task 9: Expense Management API

- [x] 9.1 Create `oakit/apps/api-gateway/src/routes/financial/expenses.ts` — `POST /` creates expense (validates attachment type: JPEG/PNG/PDF only, uploads to Supabase Storage, records Audit_Log); `GET /` lists with date/category filters; `PUT /:id` edits (records Audit_Log with before/after); `DELETE /:id` soft-deletes (records Audit_Log); all routes guarded by `financialModuleGuard` + `permissionGuard('VIEW_EXPENSE')` or `permissionGuard('ADD_EXPENSE')` as appropriate; Finance_Manager edit/delete blocked regardless of permissions (Req 8.1–8.10)

## Task 10: Salary Management API

- [x] 10.1 Create `oakit/apps/api-gateway/src/routes/financial/salary/pin.ts` — `POST /set` hashes and stores Principal_PIN (bcrypt); `POST /verify` checks PIN, sets `salary_pin_session:{userId}` in Redis (session-scoped TTL), increments `failed_attempts` on failure, locks for 15 min after 3 failures and sends alert; `POST /change` requires current PIN verification; `GET /status` returns whether PIN is set (Req 19.1–19.7)
- [x] 10.2 Create `oakit/apps/api-gateway/src/middleware/salaryPinGuard.ts` — checks `salary_pin_session:{userId}` in Redis; returns 403 with `SALARY_PIN_REQUIRED` code if not present; applied to all salary routes
- [x] 10.3 Create `oakit/apps/api-gateway/src/routes/financial/salary/config.ts` — `POST /staff/:userId/config` sets gross salary and salary components; `GET /staff/:userId/config` returns config; `PUT /working-days` sets monthly working days and calculation method; `GET /working-days` returns current config (Req 9.5–9.6, 9.16–9.22)
- [x] 10.4 Create `oakit/apps/api-gateway/src/routes/financial/salary/records.ts` — `POST /generate/:userId/:year/:month` calls `calculateMonthlySalary()`, creates `salary_records` row in DRAFT status, prevents duplicates (Req 9.11); `GET /` lists all salary records for month; `PUT /:id` updates deduction choice or override amount; `POST /:id/mark-paid` marks as Paid with payment mode/date, calls `generatePayslipPDF`, uploads PDF, records Audit_Log; `DELETE /:id` soft-deletes (Finance_Manager blocked); all guarded by `salaryPinGuard` + `permissionGuard('VIEW_SALARY')` (Req 9.1–9.15)
- [x] 10.5 Add `POST /salary/records/:id/push-payslip` — changes status from DRAFT to RELEASED, sends in-app + optional WhatsApp notification to staff member; `GET /salary/my-payslips` for Teacher/Staff to view their own released payslips only (Req 9.26–9.30)

## Task 11: Usage Records API

- [x] 11.1 Create `oakit/apps/api-gateway/src/routes/financial/usageRecords.ts` — `POST /` allows Teacher to log daycare hours or activity attendance (validates Teacher role, records `submitted_by` and timestamp, blocks access to any financial data beyond this endpoint); `GET /student/:studentId` for Principal/Admin to view usage; `GET /billing-summary/:year/:month` aggregates usage per student for invoice generation (Req 17.1–17.7, 18.1–18.5)

## Task 12: Financial Reports API

- [ ] 12.1 Create `oakit/apps/api-gateway/src/routes/financial/reports.ts` — implement the following report endpoints, all guarded by `permissionGuard('VIEW_REPORTS')` with salary/profit reports additionally restricted to Principal only:
  - `GET /revenue` — total collected, total pending, collection rate for date range (Req 10.1)
  - `GET /expenses` — total expenses, by category, monthly trend (Req 10.2)
  - `GET /profit-loss` — income minus expenses for period, Principal only (Req 10.3)
  - `GET /daily-collection` — all payments for a date (Req 10.4)
  - `GET /monthly-collection` and `GET /annual-collection` (Req 10.5)
  - `GET /student-pending` — per-student outstanding balances (Req 10.6)
  - `GET /class-collection` — collected and pending per class (Req 10.7)
  - `GET /activity-revenue` — revenue per activity (Req 10.8)
  - `GET /daycare-usage` — daycare hours per student for period (Req 10.9)
  - `GET /reconciliation-summary` — matched/partial/unmatched/cash variance (Req 10.10)
- [x] 12.2 Add `GET /reports/:type/pdf` — calls `generateReportPDF` with branding context, streams PDF response; records Audit_Log entry for expense report views (Req 10.15–10.18, 25.5)

## Task 13: AI Insights and Financial Assistant API

- [x] 13.1 Add `GET /financial/insights` — calls AI service `POST /financial-insights` with aggregated school financial data; returns revenue forecast, expense forecast, default risk alerts, collection suggestions, and revenue composition; Admin receives collection-only subset; checks AI credits balance before calling (Req 16.1–16.8)
- [x] 13.2 Add `POST /financial/assistant` — accepts `{ query: string }`, calls AI service `POST /financial-assistant` with school financial context; enforces 10s timeout; returns answer or "insufficient data" message; checks AI credits and returns 402 with recharge prompt when balance is zero (Req 16.9–16.12)

## Task 14: Parent Fees API

- [x] 14.1 Create `oakit/apps/api-gateway/src/routes/parent/fees.ts` — `GET /invoice/:studentId` returns Consolidated_Invoice with instalment dues, usage charges, concessions, credit balance, and net payable (validates parent owns student); `GET /history/:studentId` returns payment history; `GET /receipt/:paymentId` streams receipt PDF; `POST /pay/:studentId` initiates payment gateway session (redirects to Razorpay/PhonePe), includes Non_Refundable_Notice acknowledgement check; `GET /siblings` returns consolidated outstanding across all children (Req 11.1–11.8, 23.8)

## Task 15: Principal PIN Security — Frontend

- [x] 15.1 Create `oakit/apps/frontend/src/app/admin/finance/salary/page.tsx` — renders PIN entry modal before any salary data is shown; calls `POST /api/v1/financial/salary/pin/verify`; on success stores session flag in memory (not localStorage); on 3 failures shows lockout message with countdown; if PIN not set, shows PIN setup flow first (Req 19.3–19.7)

## Task 16: Admin Finance Frontend Pages

- [x] 16.1 Create `oakit/apps/frontend/src/app/admin/finance/page.tsx` — Admin financial dashboard showing today's collections, pending payments, recent transactions, reconciliation tasks pending review, and payment reminders due; hides salary/expense/profit sections unless permissions granted (Req 21.1–21.5)
- [x] 16.2 Create `oakit/apps/frontend/src/app/admin/finance/fees/page.tsx` — fee collection page: student search, outstanding balance display, payment recording form (amount, mode, date, reference), receipt download; shows Non_Refundable_Notice prominently (Req 5.1–5.7, 5.11–5.13)
- [x] 16.3 Create `oakit/apps/frontend/src/app/admin/finance/concessions/page.tsx` — concession management: create concession form (fee head, type, value, reason), pending approval list for Principal, bulk approve UI, applied concessions view (Req 7.1–7.11)
- [x] 16.4 Create `oakit/apps/frontend/src/app/admin/finance/reconciliation/page.tsx` — bank statement upload (PDF/CSV), extracted transactions table with match status, confirm reconciliation button; cash reconciliation log form; cash variance display (Req 6.3–6.13)
- [x] 16.5 Create `oakit/apps/frontend/src/app/admin/finance/enquiries/page.tsx` — enquiry list with status filter, create enquiry form, convert-to-admission flow with Onboarding_Fee_Assignment wizard (step-by-step fee component selection, usage inputs, transport route/stop, activity multi-select, summary screen with editable line items, confirm button) (Req 3.1–3.17, 27.1–27.9)

## Task 17: Principal Finance Frontend Pages

- [x] 17.1 Create `oakit/apps/frontend/src/app/admin/finance/fee-structures/page.tsx` — fee structure builder: create/edit fee heads with Fee_Wizard (billing basis → rate inputs → calculated monthly fee → round-off option), instalment schedule builder, assign to class action (Req 4.1–4.10, 27.1–27.9)
- [x] 17.2 Create `oakit/apps/frontend/src/app/admin/finance/expenses/page.tsx` — expense list with date/category filters, create expense form with attachment upload (JPEG/PNG/PDF only), edit and soft-delete actions; hidden from Admin unless permission granted (Req 8.1–8.10)
- [x] 17.3 Create `oakit/apps/frontend/src/app/admin/finance/salary/page.tsx` — salary management: working days configuration, calculation method selector, staff salary list, generate payslip flow (deduction choice, override amount), DRAFT payslip review, push-payslip action; entire page behind PIN guard (Req 9.1–9.30)
- [x] 17.4 Create `oakit/apps/frontend/src/app/admin/finance/reports/page.tsx` — report selector with date range picker; renders report data in table; PDF download button for each report type; salary and profit reports hidden from non-Principal roles (Req 10.1–10.18)
- [x] 17.5 Create `oakit/apps/frontend/src/app/admin/finance/profitability/page.tsx` — profitability dashboard: total income, total expenses, net profit; drill-down by class and by fee component; AI insights panel with revenue trends, expense patterns, default risk alerts, collection suggestions; AI Financial Assistant chat input (Req 20.1–20.7, 22.1–22.6, 16.1–16.12)

## Task 18: Parent Fees Frontend

- [x] 18.1 Create `oakit/apps/frontend/src/app/parent/fees/page.tsx` — fee dashboard tab in parent portal: Consolidated_Invoice with line-item breakdown (instalments, usage charges, concessions, credit balance, net payable), payment history list, receipt download buttons, online payment button with Non_Refundable_Notice modal and acknowledgement checkbox, sibling consolidated view when multiple children (Req 11.1–11.8, 23.8)

## Task 19: Notifications and Alerts

- [x] 19.1 Add WhatsApp notification triggers in the payment recording handler (`POST /payments`) — send confirmation within 5 minutes of payment; in the webhook handler — send failure notification on `payment.failed`; in the salary push handler — notify staff on payslip release; in the overdue check job — notify parents when instalment is overdue by more than 7 days (Req 11.4–11.5, 12.5, 9.30)
- [ ] 19.2 Add daily collection summary notification: create a scheduled job (cron) that runs at end of school day, aggregates day's collections, and sends in-app notification to Principal; add large-expense alert in `POST /expenses` handler — when `amount > threshold` (default ₹10,000, configurable), send in-app alert to Principal (Req 12.1–12.4)

## Task 20: Property-Based Tests

- [ ] 20.1 Write `fast-check` property tests for `calculateMonthlyFee`: for any valid `FeeCalculationInput`, `calculated_monthly_fee` is always ≥ 0; for `per_month_flat`, result equals `rate` exactly; for `per_hour` with `hours_per_day = 0` or `days_per_week = 0`, result is 0
- [ ] 20.2 Write `fast-check` property tests for `calculateMonthlySalary`: for any input with `deduction_choice = 'pay_full'`, `net_salary = gross_salary`; for any input, `net_salary ≥ 0`; when `override_amount` is set, `net_salary = override_amount` (clamped to 0); when `working_days = 0`, `per_day_rate = 0` and no division error occurs
- [ ] 20.3 Write `fast-check` property tests for concession validation: for any concession where `value > fee_head_total`, the API returns a 400 error; for any approved concession, `outstanding_balance` decreases by exactly the concession amount (or to 0 if concession exceeds balance)
- [ ] 20.4 Write `fast-check` property tests for credit balance: for any payment where `amount > outstanding_balance`, `credit_balance` increases by exactly `amount - outstanding_balance`; for any invoice generated with a positive `credit_balance`, `net_payable = max(0, gross_payable - credit_balance)`

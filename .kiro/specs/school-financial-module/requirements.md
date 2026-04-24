# Requirements Document

## Introduction

The School Financial Module is a comprehensive, multi-tenant financial management system for the Oakit SaaS platform. It covers the full lifecycle of school finances: student admission with automatic fee assignment, fee collection and reconciliation, expense management, salary processing, and financial reporting. The module is controlled at the Super Admin level and can be enabled or disabled per school or franchise. Access to financial data is strictly role-gated, with the Principal holding the highest level of access within a school.

---

## Glossary

- **Oakit**: The multi-school SaaS platform owned and operated by the Super Admin.
- **Super_Admin**: The Oakit platform owner. Has cross-school analytics access but no direct access to individual school financial data unless explicitly granted.
- **Franchise_Admin**: An admin who manages a group of schools under a franchise. Can disable the financial module at the school level within their franchise.
- **Principal**: The school owner or head. Has full financial access within their school, including exclusive access to salary and full profit data.
- **Finance_Manager**: An optional role created exclusively by the Principal. Has individually toggled permissions for expenses and salary; cannot delete salary records or change financial settings.
- **Admin**: An operational role (also called Office Staff) responsible for day-to-day fee operations: assigning fees, generating invoices, collecting payments, uploading bank statements, performing reconciliation at review level, applying concessions (if permitted), and sending reminders. Does not see salary or expense tabs by default.
- **Teacher**: A school staff member with no financial access by default. Can mark daycare hours and activity attendance.
- **Parent**: A guardian of a student. Can view their child's current bill with usage breakdown, view past payments, make payments, and download receipts.
- **Financial_Module**: The collective set of features covering fees, expenses, salary, reconciliation, and reporting for a school.
- **Expense_Module**: The sub-module within the Financial_Module that handles school expense tracking.
- **Salary_Module**: The sub-module within the Financial_Module that handles staff salary configuration, payroll processing, and payslip generation. Private to the Principal by default.
- **Profitability_Module**: The sub-module that shows income, expenses, and net profit with drill-down by class and fee component. Visible to the Principal only by default.
- **Fee_Structure**: The set of fee heads (admission, tuition, transport, activity, custom) assigned to a class or student.
- **Fee_Head**: A named category of fee (e.g., Tuition Fee, Transport Fee, Activity Fee).
- **Pricing_Model**: The billing model for a Fee_Head — one of: fixed (one-time), instalment (scheduled partial payments), or monthly_calculated (usage-based, computed at month end).
- **Instalment_Plan**: Configuration for a Fee_Head billed in instalments: number of instalments, individual due dates, and booking amount.
- **Usage_Record**: A record of a student's consumption of a usage-based service (daycare hours or activity attendance) for a given day.
- **Consolidated_Invoice**: A single monthly invoice aggregating instalment dues, usage-based charges, and any extra fee components after applying concessions.
- **Installment**: A scheduled partial payment of a fee, either monthly or term-wise.
- **Receipt**: An auto-generated document confirming a fee payment.
- **Reconciliation**: The process of matching a bank statement, payment gateway record, or cash record against recorded fee payments.
- **Auto_Reconciliation**: Automatic matching of a payment gateway webhook event to an existing payment record.
- **Bank_Reconciliation**: Matching of transactions extracted from an uploaded PDF or CSV bank statement against recorded payments.
- **Cash_Reconciliation**: Admin-logged daily cash total verified by the Principal against expected cash collections.
- **Concession**: A discount or waiver applied to a student's fee obligation.
- **Enquiry**: A pre-admission record capturing a prospective student's interest.
- **Admission**: The formal enrollment of a student into the school, triggering fee assignment and parent login creation.
- **Payslip**: A document summarising a staff member's salary payment for a given month.
- **Salary_Deduction**: A named reduction applied to a staff member's gross salary (e.g., advance, absence, tax).
- **Audit_Log**: An immutable record capturing: user_id, actor role, action, module (salary/expense/fees/reconciliation), timestamp, before_data, and after_data.
- **RBAC**: Role-Based Access Control. The permission model governing which roles can perform which actions. Permissions are named constants (e.g., VIEW_SALARY, EDIT_SALARY, VIEW_EXPENSE, ADD_EXPENSE, VIEW_PROFIT).
- **Principal_PIN**: A numeric PIN set by the Principal, separate from login credentials, required as an additional authentication factor before accessing salary data.
- **Soft_Delete**: Marking a record as deleted without removing it from the database.
- **Webhook**: An HTTP callback used to receive real-time payment status updates from a payment gateway.
- **WhatsApp_Notification**: An automated message sent to a parent via WhatsApp.
- **Pro_Rated_Billing**: Billing calculated proportionally based on the number of days a student was enrolled within a billing period.
- **Credit_Balance**: An overpayment amount held against a student's account, applicable to the next invoice or refundable on request.
- **Fee_Wizard**: The guided step-by-step interface for configuring a new fee component's billing model and rate.
- **Billing_Basis**: The unit of measurement for a usage-based fee — one of: per_hour, per_day, per_week, per_month_flat.
- **Calculated_Monthly_Fee**: The system-computed monthly fee amount derived from the Billing_Basis, rate, hours/day, and days/week inputs.
- **Rounded_Monthly_Fee**: The admin-edited final monthly fee amount after rounding the Calculated_Monthly_Fee.
- **Concession_Approval**: The workflow where a Concession created by an Admin or Accountant is held in PENDING_APPROVAL status until the Principal approves or rejects it.
- **Bulk_Approval**: The Principal's ability to select and approve multiple pending Concessions in a single action.
- **Onboarding_Fee_Assignment**: The process of assigning fee components to a student during admission, guided by a series of questions, without requiring Principal approval.
- **Help_Panel**: A contextual, role-specific help overlay available on every financial module screen, providing step-by-step instructions for the current user.
- **Working_Days**: The configured number of working days for a school in a given month, used as the denominator for per-day salary calculation.
- **Salary_Calculation_Method**: The school-configured method for computing per-day salary rate — one of: weekday_count (total weekdays ÷ monthly salary), calendar_days (total calendar days ÷ monthly salary), or custom_working_days (configured Working_Days ÷ monthly salary).
- **Per_Day_Rate**: The computed daily salary rate = monthly gross salary ÷ Working_Days (using the configured Salary_Calculation_Method).
- **Payslip_Draft**: A generated payslip in DRAFT status, visible only to the Principal and Accountant, not yet released to the staff member.
- **Payslip_Push**: The action by which the Principal or Accountant releases a Payslip_Draft to the staff member's portal, making it visible to them.
- **Leave_Application**: A request submitted by a Teacher through the portal specifying leave date(s), type, and reason, pending approval by the Principal or Accountant.
- **Attendance_Record**: The monthly record of a staff member's present days, absent days, half-days, approved leaves, and holidays.
- **Non_Refundable_Notice**: The mandatory disclaimer displayed to Parents before and after fee payment, stating that fees once paid cannot be refunded.
- **Branded_Report**: A PDF report or payslip that includes the school's logo, name, and address in the header, and generation metadata in the footer.
- **Employment_Terms**: The school-configured employment policy document covering notice period, probation period, leave policy, holiday pay policy, salary components, and custom terms. Generated with AI assistance and approved by the Principal.
- **Offer_Letter**: A system-generated, school-branded employment offer document issued once per staff member, containing their role, salary breakdown, and employment terms. Generated at onboarding, locked after creation.
- **Experience_Letter**: A system-generated, school-branded document issued upon staff termination, confirming the staff member's employment period and role.
- **Termination_Request**: A formal request to end a staff member's employment, initiated by Admin/Accountant/Principal and requiring Principal approval before taking effect.
- **Salary_Component**: A named element of a staff member's salary structure (e.g., Basic Pay, HRA, Transport Allowance, PF deduction), configurable as a fixed amount, percentage of basic, or formula-based value.
- **Holiday_Pay_Policy**: The school-configured rule specifying whether staff are paid or unpaid during defined school holiday periods and long breaks.
- **Onboarding_Document_Checklist**: The school-configured list of documents a new staff member must upload and have verified before their onboarding is marked complete.
- **Leave_Policy**: The school-configured annual leave entitlements per leave type (sick, casual, earned), carry-forward rules, and leave behaviour during probation.
- **Probation_Period**: The configured initial employment period during which different leave and termination rules may apply, as defined in the school's Employment_Terms.
- **Notice_Period**: The configured minimum advance notice required before a staff member's resignation or termination takes effect, as defined in the school's Employment_Terms.

---

## Requirements

### Requirement 1: Financial Module Enablement

**User Story:** As a Super Admin, I want to control whether the Financial Module is active for each school or franchise, so that I can manage feature rollout and billing.

#### Acceptance Criteria

1. THE Financial_Module SHALL be enabled by default for every school at the time of school creation.
2. WHEN the Super_Admin disables the Financial_Module for a franchise, THE Financial_Module SHALL be disabled for all schools within that franchise.
3. WHEN the Super_Admin disables the Financial_Module for a specific school, THE Financial_Module SHALL be disabled for that school only, regardless of franchise membership.
4. WHEN the Franchise_Admin disables the Financial_Module for a school within their franchise, THE Financial_Module SHALL be disabled for that school.
5. WHILE the Financial_Module is disabled for a school, THE System SHALL deny access to all financial routes for that school and return a descriptive error to the requesting user.
6. THE Expense_Module SHALL be independently enabled or disabled at the school level or franchise level by the Super_Admin.
7. WHEN the Financial_Module is re-enabled for a school, THE System SHALL restore access to all previously recorded financial data for that school.

---

### Requirement 2: User Roles and Financial Access Permissions

**User Story:** As a Principal, I want financial data to be strictly access-controlled by role, so that sensitive school finances are not exposed to unauthorised users.

#### Acceptance Criteria

1. THE Principal SHALL have full read and write access to all financial data within their school, including fees, expenses, salary, and reports.
2. THE Admin SHALL be able to assign fees, generate invoices, collect payments, upload bank statements, perform reconciliation at review level, apply concessions (where the Principal has granted that permission), and send payment reminders.
3. THE System SHALL hide the salary tab and the expense tab from the Admin UI by default; THE System SHALL display those tabs only when the Principal has explicitly granted the corresponding permissions to the Admin role.
4. THE Finance_Manager role SHALL be created exclusively by the Principal.
5. WHEN the Principal creates a Finance_Manager, THE System SHALL require the Principal to configure the Finance_Manager's permission set — covering view_expense, add_expense, view_salary, and edit_salary — before the Finance_Manager account is activated.
6. IF a Finance_Manager attempts to delete a salary record, THEN THE System SHALL deny the action and return a permission error regardless of the Finance_Manager's configured permissions.
7. IF a Finance_Manager attempts to edit a salary record without the Principal having enabled the edit_salary permission for that Finance_Manager, THEN THE System SHALL deny the action and return a permission error.
8. THE Teacher SHALL have no access to any financial data.
9. WHERE the Principal enables the fee-status toggle for a Teacher, THE System SHALL allow that Teacher to view only the fee payment status (paid or pending) of students in their assigned sections, without exposing any fee amounts.
10. THE Parent SHALL have access to view their child's current bill with usage breakdown, view past payments, make payments, and download receipts.
11. IF a Parent has multiple children enrolled in the school, THE System SHALL display fee information for each child separately within the same parent portal session.
12. IF a Parent attempts to access another student's financial data, THEN THE System SHALL deny the request and return a permission error.
13. THE Super_Admin SHALL have access to cross-school financial analytics (aggregated totals, collection trends) but SHALL NOT have access to individual school transaction records unless the Principal explicitly grants access.
14. THE Franchise_Admin SHALL have no access to individual school financial data.
15. THE System SHALL use RBAC where permissions are named constants including at minimum: VIEW_SALARY, EDIT_SALARY, VIEW_EXPENSE, ADD_EXPENSE, VIEW_PROFIT, VIEW_FEES, COLLECT_PAYMENT, MANAGE_CONCESSION, VIEW_RECONCILIATION, and PERFORM_RECONCILIATION.
16. THE System SHALL derive UI element visibility from the authenticated user's permission set; a tab or action button SHALL be hidden when the user lacks the corresponding permission.
17. THE System SHALL enforce permission checks on every API endpoint independently of UI visibility, returning a 403 error when a request lacks the required permission.

---

### Requirement 3: Student Enquiry and Admission Flow

**User Story:** As an admin, I want to manage the full student journey from enquiry to admission, so that fee assignment and parent account creation happen automatically and consistently.

#### Acceptance Criteria

1. THE System SHALL allow an admin to create an Enquiry record for a prospective student containing: student name, parent name, contact number, class of interest, and enquiry date.
2. WHEN an Enquiry is converted to an Admission, THE System SHALL create a Student record and assign the Fee_Structure applicable to the student's class.
3. WHEN an Admission is created, THE System SHALL automatically create a Parent login account using the primary contact mobile number as both the username and the initial password.
4. WHEN an Admission is created, THE System SHALL prompt the admin to select any supplementary school activities (bus, day care, or other school-defined activities) for the student.
5. WHEN the admin selects a supplementary activity during Admission, THE System SHALL auto-enroll the student in that activity and assign the corresponding activity fee to the student's fee account.
6. IF a Parent login already exists for the given mobile number, THEN THE System SHALL link the new student to the existing Parent account rather than creating a duplicate.
7. WHEN an Admission is created, THE System SHALL begin fee payment tracking for the student from the admission date.
8. THE System SHALL allow an admin to view all Enquiry records with their current status (open, converted, closed).
9. WHEN an Admission is created, THE System SHALL present the Admin with an Onboarding_Fee_Assignment checklist showing all active fee components configured for the student's class.
10. WHEN the Admin selects a usage-based fee component (e.g., daycare) during Onboarding_Fee_Assignment, THE System SHALL prompt the Admin to enter: the number of hours per day the student will use the service and the number of days per week, then compute and display the resulting monthly fee for that student.
11. WHEN the Admin selects a transport fee component during Onboarding_Fee_Assignment, THE System SHALL prompt the Admin to select the student's route and stop, then assign the corresponding transport fee to the student's account.
12. WHEN the Admin selects an activity fee component during Onboarding_Fee_Assignment, THE System SHALL present a multi-select list of available activities and assign fees for each selected activity to the student's account.
13. WHEN a fee component marked as variable is included in the Onboarding_Fee_Assignment, THE System SHALL display the configured rate and allow the Admin to enter a custom amount for that student.
14. WHEN the Admin completes the Onboarding_Fee_Assignment selections, THE System SHALL display a summary screen listing all assigned fee components with their individual amounts and the calculated monthly total before the assignment is saved.
15. WHILE reviewing the Onboarding_Fee_Assignment summary, THE Admin SHALL be able to edit individual line item amounts before confirming.
16. WHEN the Admin confirms the Onboarding_Fee_Assignment, THE System SHALL save all assigned fees directly to the student's fee account without requiring Principal approval.
17. WHEN the Onboarding_Fee_Assignment is saved, THE System SHALL begin fee tracking for the student from the admission date.

---

### Requirement 4: Fee Structure Management

**User Story:** As a Principal, I want to define and manage fee structures per class with flexible pricing models, so that fees are consistently applied to all students in a class.

#### Acceptance Criteria

1. THE Principal SHALL be able to create a Fee_Structure containing one or more Fee_Heads for a given class.
2. THE System SHALL support the following standard Fee_Head types: Admission Fee, Tuition Fee, Transport Fee, Activity Fee, and Custom Fee.
3. THE Principal SHALL be able to configure each Fee_Head with a Pricing_Model of: fixed (one-time amount), instalment (scheduled partial payments), or monthly_calculated (usage-based, computed at month end).
4. WHEN a Fee_Head is configured with the instalment Pricing_Model, THE System SHALL require the Principal to specify: number of instalments, individual due date for each instalment, and a booking amount.
5. WHEN a Fee_Head is configured with the monthly_calculated Pricing_Model, THE System SHALL compute the charge at month end based on the student's Usage_Records for that fee component.
6. WHEN a Fee_Structure is assigned to a class, THE System SHALL apply that structure to all students currently enrolled in that class.
7. WHEN a new student is admitted to a class, THE System SHALL automatically assign the active Fee_Structure for that class to the student.
8. THE Principal SHALL be able to create class-wise installment schedules (monthly or term-wise) for any Fee_Head.
9. WHEN a fee installment becomes overdue, THE System SHALL calculate and apply a late fee according to the configured late fee rule for that Fee_Head.
10. IF no late fee rule is configured for a Fee_Head, THEN THE System SHALL not apply any late fee for overdue installments of that Fee_Head.

---

### Requirement 5: Fee Collection

**User Story:** As a Finance Manager, I want to record fee payments from parents, so that the school's fee collection is accurately tracked.

#### Acceptance Criteria

1. THE Finance_Manager SHALL be able to record a fee payment for a student specifying: amount, payment mode (cash, UPI, online, bank transfer), payment date, and an optional reference number.
2. THE System SHALL support partial payments, recording the paid amount and updating the outstanding balance accordingly.
3. WHEN a fee payment is recorded, THE System SHALL auto-generate a Receipt containing: receipt number, student name, class, fee head breakdown, amount paid, payment mode, payment date, and school name.
4. THE System SHALL assign a unique, sequential receipt number to each Receipt within a school.
5. WHEN a Receipt is generated, THE System SHALL make it available for download in PDF format.
6. THE System SHALL track each student's fee status as one of: Paid, Partially Paid, Pending, or Overdue.
7. WHEN a student's total outstanding balance reaches zero, THE System SHALL update the student's fee status to Paid.
8. THE Parent SHALL be able to initiate an online fee payment via UPI or a configured payment gateway (Razorpay or PhonePe).
9. WHEN a payment gateway Webhook is received, THE System SHALL update the corresponding payment record status within 30 seconds of receipt.
10. IF a Webhook payload fails signature verification, THEN THE System SHALL reject the payload, log the rejection, and not update any payment record.
11. WHEN a Parent views their child's fee invoice or payment screen, THE System SHALL display a prominent Non_Refundable_Notice: "Please note: Fees once paid cannot be refunded under any circumstances. Please verify the amount before making payment."
12. WHEN a Parent initiates an online payment, THE System SHALL require the Parent to acknowledge the Non_Refundable_Notice by checking a confirmation checkbox before the payment can be submitted.
13. THE Non_Refundable_Notice SHALL be printed on every generated Receipt PDF.

---

### Requirement 6: Fee Reconciliation

**User Story:** As a Principal, I want to reconcile payment gateway records, bank statements, and cash collections against recorded payments, so that I can confirm all collected fees are accurately reflected in the system.

#### Acceptance Criteria

1. WHEN a payment gateway Webhook event with status payment.captured is received, THE System SHALL automatically match the event to the corresponding payment record and mark it as reconciled within 30 seconds of receipt (Auto_Reconciliation).
2. IF a payment gateway Webhook event cannot be matched to an existing payment record, THEN THE System SHALL flag the event as unmatched and add it to the reconciliation review queue.
3. THE System SHALL accept PDF or CSV files for bank statement reconciliation uploads.
4. IF a file other than PDF or CSV is uploaded for bank reconciliation, THEN THE System SHALL reject the upload and return a descriptive error.
5. WHEN a bank statement file is uploaded, THE System SHALL use AI extraction to identify each transaction's date, amount, and reference number from the file.
6. WHEN bank statement transactions are extracted, THE System SHALL run a matching engine that classifies each transaction as matched, partial, or unmatched against recorded payment records.
7. WHEN a bank reconciliation is processed, THE System SHALL present a summary of matched, partial, and unmatched transactions for the Admin or Principal to review before confirming.
8. WHEN the Principal confirms a bank reconciliation, THE System SHALL mark the matched payment records as reconciled and record the reconciliation date and actor.
9. THE Admin SHALL be able to log a daily cash total for Cash_Reconciliation, specifying the date and total cash amount collected.
10. WHEN a daily cash total is logged, THE System SHALL compare it against the sum of cash payment records for that date and display the variance to the Principal.
11. THE Principal SHALL be able to approve a Cash_Reconciliation as matched or flag it as a mismatch.
12. IF the Principal flags a Cash_Reconciliation as a mismatch, THEN THE System SHALL record the mismatch status and variance amount in the Audit_Log.
13. THE System SHALL maintain an Audit_Log entry for every reconciliation action, capturing: user_id, action, module (reconciliation), timestamp, and reconciliation outcome.

---

### Requirement 7: Concession Management

**User Story:** As an admin, I want to apply fee concessions to individual students, so that eligible students receive the correct discounted fee obligation after Principal approval.

#### Acceptance Criteria

1. THE Admin SHALL be able to create a Concession record for a student specifying: the Fee_Head to which the concession applies, the concession type (fixed amount or percentage), the concession value, and a reason.
2. WHEN a Concession is created by an Admin or Accountant, THE System SHALL save it with a status of PENDING_APPROVAL and SHALL NOT apply it to the student's fee account until the Principal approves it.
3. WHEN a Concession is saved in PENDING_APPROVAL status, THE System SHALL send a notification to the Principal indicating that a concession is awaiting approval, including the student name, fee head, concession type, value, and reason.
4. THE Principal SHALL be able to view all Concessions in PENDING_APPROVAL status and approve or reject each one individually.
5. THE Principal SHALL be able to perform a Bulk_Approval by selecting multiple Concessions in PENDING_APPROVAL status and approving all selected concessions in a single action.
6. WHEN the Principal approves a Concession, THE System SHALL apply it to the student's fee account, recalculate the student's outstanding balance for the applicable Fee_Head, and update the Consolidated_Invoice to reflect the concession.
7. WHEN the Principal rejects a Concession, THE System SHALL mark it with a status of REJECTED and send a notification to the Admin or Accountant who created it, including the rejection reason if provided.
8. THE System SHALL display the original fee amount, the concession amount, and the net payable amount separately on the student's fee account view.
9. THE Finance_Manager SHALL be able to view applied concessions but SHALL NOT be able to create, edit, or delete concessions.
10. IF a Concession value exceeds the total fee amount for the applicable Fee_Head, THEN THE System SHALL reject the concession and return a validation error.
11. THE System SHALL record an Audit_Log entry for every concession creation, approval, rejection, modification, or deletion, capturing: actor user_id, actor role, action, student ID, concession details, and timestamp.

---

### Requirement 8: Expense Management

**User Story:** As a Principal, I want to record and track school expenses with controlled visibility, so that I have an accurate view of outgoings for profit/loss analysis while keeping expense data private from unauthorised roles.

#### Acceptance Criteria

1. THE Principal SHALL be able to create an expense record containing: date, amount, category, notes, and an optional attachment (image or PDF of the bill).
2. THE System SHALL support the following expense categories: Rent, Salary, Utilities, Marketing, Maintenance, and Miscellaneous.
3. THE Principal SHALL be able to edit or soft-delete any expense record.
4. WHEN an expense record is soft-deleted, THE System SHALL retain the record in the database with a deleted flag and exclude it from all financial reports and views.
5. THE Expense_Module SHALL be hidden from all roles except the Principal and Finance_Manager by default.
6. WHERE the Principal enables the view_expense permission for the Finance_Manager, THE Finance_Manager SHALL be able to view all expense records.
7. WHERE the Principal enables the add_expense permission for the Finance_Manager, THE Finance_Manager SHALL be able to create new expense records.
8. IF a Finance_Manager attempts to edit or delete an expense record without the Principal having granted that permission, THEN THE System SHALL deny the action and return a permission error.
9. THE System SHALL record an Audit_Log entry for every expense creation, edit, or soft-delete, capturing: user_id, action, module (expense), timestamp, before_data, and after_data.
10. WHEN an expense attachment is uploaded, THE System SHALL accept only image files (JPEG, PNG) or PDF files and reject all other file types.

---

### Requirement 9: Salary Management

**User Story:** As a Principal, I want to manage staff salaries with strict privacy controls, so that payroll is processed accurately, payslips are available for staff records, and salary data remains confidential.

#### Acceptance Criteria

1. THE Salary_Module SHALL be private to the Principal by default; no Admin, Teacher, or other staff member SHALL have visibility into salary data unless the Principal explicitly grants the VIEW_SALARY permission.
2. THE Principal SHALL be able to set a Principal_PIN that is separate from their login credentials and is required as an additional authentication factor before the Salary_Module is accessible.
3. WHEN the Principal attempts to access the Salary_Module, THE System SHALL prompt for the Principal_PIN before displaying any salary data.
4. IF the Principal_PIN entered is incorrect, THEN THE System SHALL deny access to the Salary_Module and return an authentication error.
5. THE Principal SHALL be able to configure a monthly gross salary amount and any Salary_Deductions for each staff member.
6. THE System SHALL support named Salary_Deductions (e.g., advance, absence, tax) that reduce the net salary displayed on the Payslip.
7. THE Principal SHALL be able to mark a staff member's salary for a given month as Paid or Unpaid, specifying the payment mode and payment date.
8. WHEN a salary is marked as Paid, THE System SHALL auto-generate a Payslip containing: staff name, role, month, gross salary, itemised deductions, net salary, payment mode, payment date, and school name.
9. THE System SHALL make the generated Payslip available for download in PDF format.
10. THE System SHALL display a monthly salary expense summary to the Principal showing total salary outflow and a per-staff breakdown.
11. IF a salary record for a staff member and month already exists, THEN THE System SHALL prevent duplicate salary entries and return a validation error.
12. THE System SHALL record an Audit_Log entry for every salary create, edit, or status change, capturing: user_id, action, module (salary), timestamp, before_data, and after_data.
13. THE System SHALL deny any API request to read salary data from a user whose permission set does not include VIEW_SALARY, returning a 403 error.
14. THE Admin SHALL NOT be able to export salary data in any format.
15. WHEN a salary is marked as Paid, THE generated Payslip PDF SHALL include: school logo, school name, school address, staff name, role, month/year, total Working_Days in the month (as configured), staff's present days, absent days, leaves taken, gross salary, Per_Day_Rate, itemised Salary_Deductions, net salary, payment mode, payment date, and the disclaimer "This is a system-generated salary slip."
16. THE Principal OR Accountant SHALL be able to set the total number of Working_Days for a given month for the school.
17. THE System SHALL provide an import option (CSV or Excel) to bulk-enter Working_Days data for a month.
18. THE Principal SHALL be able to edit the total Working_Days for any month before the payslip is finalised.
19. THE System SHALL use the configured Working_Days as the denominator for Per_Day_Rate calculation.
20. WHEN setting up salary processing for a month, THE System SHALL require the Principal OR Accountant to select a Salary_Calculation_Method from the following options: (a) weekday_count — total weekdays in month ÷ monthly salary = Per_Day_Rate; (b) calendar_days — total calendar days in month ÷ monthly salary = Per_Day_Rate; (c) custom_working_days — configured Working_Days ÷ monthly salary = Per_Day_Rate.
21. THE selected Salary_Calculation_Method SHALL be stored per school and applied consistently for all staff in that month.
22. THE Principal SHALL be able to change the Salary_Calculation_Method before finalising the monthly payroll.
23. WHEN finalising a staff member's monthly salary, THE System SHALL present the Principal OR Accountant with a deduction choice: (a) "Deduct salary for absent days" — net salary = gross salary − (absent_days × Per_Day_Rate); or (b) "Pay full salary regardless of attendance."
24. THE deduction choice SHALL be configurable per staff member per month.
25. THE Principal SHALL be able to override the calculated net salary amount and save a custom amount before generating the payslip.
26. WHEN a payslip is generated, THE System SHALL save it in DRAFT status (Payslip_Draft) and SHALL NOT make it visible to the Teacher or Staff member.
27. THE Principal SHALL be able to review all Payslip_Draft records for a month before releasing them.
28. WHEN the Principal OR Accountant (with Principal permission) performs a Payslip_Push, THE System SHALL change the payslip status from DRAFT to RELEASED and make it visible to the Teacher or Staff member in their portal.
29. WHILE a payslip remains in DRAFT status, THE System SHALL deny any Teacher or Staff member access to salary information for that month.
30. WHEN a Payslip_Push is performed, THE System SHALL send a notification to the Teacher or Staff member via the portal and optionally via WhatsApp.

---

### Requirement 10: Financial Reports and Analytics

**User Story:** As a Principal, I want access to comprehensive financial reports, so that I can make informed decisions about the school's financial health.

#### Acceptance Criteria

1. THE Principal SHALL have access to a Revenue Report showing: total fees collected, total fees pending, and collection rate for a selected date range.
2. THE Principal SHALL have access to an Expense Report showing: total expenses, expenses grouped by category, and a monthly trend for a selected date range.
3. THE Principal SHALL have access to a Profit/Loss Report showing: total income minus total expenses for a selected period.
4. THE Principal SHALL have access to a Daily Collection Report showing all fee payments recorded on a selected date.
5. THE Principal SHALL have access to a Monthly Collection Report and an Annual Collection Report.
6. THE Principal SHALL have access to a Student-Wise Pending Fees Report listing each student's outstanding balance.
7. THE Principal SHALL have access to a Class-Wise Collection Report showing total collected and pending amounts per class.
8. THE Principal SHALL have access to an Activity Revenue Report showing revenue generated per school activity.
9. THE Principal SHALL have access to a Daycare Usage Report showing daycare hours logged per student for a selected period.
10. THE Principal SHALL have access to a Reconciliation Report showing matched, partial, and unmatched transactions and cash variance for a selected period.
11. THE Admin SHALL have access to collection reports (daily, monthly, student-wise pending, class-wise) but SHALL NOT have access to expense reports, salary reports, or profit/loss reports.
12. THE System SHALL restrict salary reports and profit/loss reports to the Principal only.
13. IF a Teacher or Parent attempts to access a financial report, THEN THE System SHALL deny the request and return a permission error.
14. THE System SHALL provide smart insights on the Principal dashboard, including: month-over-month fee collection change, month-over-month expense change, and a flag when expenses increase by more than 20% compared to the previous month.
15. ALL generated report PDFs (fee reports, collection reports, expense reports, reconciliation reports, payslips) SHALL be Branded_Reports including: the school's logo, school name, and school address in the header.
16. THE school logo and name used in Branded_Reports SHALL be sourced from the school's profile settings.
17. IF the school has not uploaded a logo, THEN THE System SHALL use a default Oakit placeholder logo in the Branded_Report header.
18. ALL Branded_Report PDFs SHALL include a footer containing: report generation date, generated-by user name and role, and page number.

---

### Requirement 11: Parent Fee Dashboard

**User Story:** As a parent, I want to view my child's fee status and make payments online, so that I can manage school fees conveniently.

#### Acceptance Criteria

1. THE Parent SHALL be able to view their child's current Consolidated_Invoice with a breakdown showing: instalment dues, usage-based charges (daycare hours, activity attendance), extra fee components, applied concessions, and net payable amount.
2. THE Parent SHALL be able to view their child's complete payment history.
3. THE Parent SHALL be able to download any previously generated Receipt for their child's payments.
4. THE System SHALL send a WhatsApp_Notification to the Parent when a fee installment is due, at least 3 days before the due date.
5. THE System SHALL send a WhatsApp_Notification to the Parent confirming a successful fee payment within 5 minutes of the payment being recorded.
6. IF a Parent has multiple children enrolled in the school, THE System SHALL display fee information for each child separately within the same parent portal session, with a consolidated sibling view showing total outstanding across all children.
7. WHEN a Parent initiates an online payment, THE System SHALL redirect the Parent to the configured payment gateway and return the Parent to the portal upon completion.
8. WHEN a payment is completed, THE System SHALL make the Receipt available for download immediately within the parent portal.

---

### Requirement 12: Notifications and Alerts

**User Story:** As a Principal, I want to receive automated alerts about financial activity, so that I can stay informed without manually checking reports.

#### Acceptance Criteria

1. THE System SHALL send a daily collection summary notification to the Principal at the end of each school day, showing total fees collected that day.
2. WHEN a single expense record exceeds a configurable large-expense threshold, THE System SHALL send an alert notification to the Principal.
3. THE Principal SHALL be able to configure the large-expense alert threshold in the financial settings.
4. IF the large-expense threshold is not configured, THEN THE System SHALL use a default threshold of ₹10,000.
5. THE System SHALL send a WhatsApp_Notification to the Parent when a fee payment is overdue by more than 7 days.

---

### Requirement 13: Security, Audit, and Data Integrity

**User Story:** As a Principal, I want all financial data to be secure, auditable, and protected from accidental loss, so that the school's financial records are trustworthy.

#### Acceptance Criteria

1. THE System SHALL use soft-delete for all financial records; no financial record SHALL be permanently deleted through the application interface.
2. THE System SHALL encrypt all financial data at rest and all payment details in transit using TLS 1.2 or higher.
3. THE System SHALL record an Audit_Log entry for every create, update, and soft-delete action on any financial record, capturing: user_id, actor role, action type, module (salary/expense/fees/reconciliation), affected record ID, timestamp, before_data, and after_data.
4. THE System SHALL ensure that each school's financial data is logically isolated and inaccessible to users of other schools.
5. WHEN a payment gateway Webhook is received, THE System SHALL verify the payload signature before processing the event.
6. THE System SHALL retain Audit_Log entries for a minimum of 3 years.
7. IF an unauthorised user attempts to access financial data of another school, THEN THE System SHALL deny the request, log the attempt in the Audit_Log, and return a 403 error.
8. THE System SHALL deny any API request to read salary data from a user whose permission set does not include VIEW_SALARY, returning a 403 error regardless of the request origin.
9. THE Admin SHALL NOT be able to export salary data in any format through the application interface.
10. THE System SHALL log an Audit_Log entry when any user views an expense report, including the viewer's user_id, role, and timestamp.

---

### Requirement 14: Multi-School SaaS Architecture

**User Story:** As the Super Admin, I want each school's financial data to be fully isolated, so that no school can access another school's financial information.

#### Acceptance Criteria

1. THE System SHALL scope all financial database queries by school_id to ensure data isolation between schools.
2. THE Super_Admin SHALL be able to view aggregated financial analytics across all schools (total platform revenue collected, total active fee accounts) without accessing individual school transaction records.
3. WHEN the Super_Admin views cross-school analytics, THE System SHALL display only aggregated, anonymised totals and SHALL NOT expose individual student or transaction records.
4. THE System SHALL support independent fee structures, expense categories, and salary configurations per school.

---

### Requirement 15: Payment Gateway Integration

**User Story:** As a Principal, I want to integrate with Indian payment gateways, so that parents can pay fees online without visiting the school.

#### Acceptance Criteria

1. THE System SHALL support UPI as a payment mode for online fee collection.
2. THE System SHALL support integration with Razorpay and PhonePe as payment gateway providers.
3. WHEN a payment gateway is configured for a school, THE System SHALL use that gateway for all online fee payment requests from parents of that school.
4. THE System SHALL handle payment gateway Webhook events for the following statuses: payment.captured, payment.failed, and refund.processed.
5. WHEN a payment.failed event is received, THE System SHALL update the payment record status to Failed and send a WhatsApp_Notification to the Parent.
6. WHEN a refund.processed event is received, THE System SHALL record the refund against the original payment and update the student's outstanding balance accordingly.
7. THE System SHALL store only the payment gateway transaction reference ID and status; raw card or UPI credential data SHALL NOT be stored.

---

### Requirement 16: Advanced Insights and Forecasting

**User Story:** As a Principal, I want AI-powered financial insights and forecasts, so that I can proactively manage the school's financial health.

#### Acceptance Criteria

1. THE System SHALL provide a monthly revenue forecast on the Principal dashboard, based on historical fee collection patterns.
2. THE System SHALL provide a monthly expense forecast on the Principal dashboard, based on historical expense patterns.
3. THE System SHALL surface a smart insight when fee collection for the current month is more than 10% lower than the same month in the previous year.
4. THE Principal SHALL have access to full AI insights including: profit trends, salary trends, expense patterns, revenue trends, growth opportunities, and default risk identification.
5. THE System SHALL surface an AI risk alert when the predicted probability of payment delay exceeds a configurable threshold for a cohort of students (e.g., "15 students likely to delay payment").
6. THE System SHALL surface an AI collection suggestion when outstanding balances can be recovered by sending reminders (e.g., "Send reminders today to recover ₹80,000").
7. THE System SHALL surface an AI revenue composition insight showing the percentage contribution of each fee component to total revenue (e.g., "Daycare contributes 22% of revenue").
8. THE Admin SHALL have access to limited AI insights covering collection performance only; THE System SHALL not surface salary, expense, or profit insights to the Admin.
9. THE System SHALL provide an AI Financial Assistant that accepts natural language queries from the Principal and returns answers based on the school's financial data.
10. WHEN the Principal submits a query to the AI Financial Assistant, THE System SHALL respond within 10 seconds.
11. IF the AI Financial Assistant cannot determine an answer from available financial data, THEN THE System SHALL respond with a clear message indicating that the data is insufficient to answer the query.
12. WHERE the AI credits balance for a school is zero, THE System SHALL disable the AI Financial Assistant for that school and display a message prompting the Principal to recharge AI credits.

---

### Requirement 17: Usage-Based Billing

**User Story:** As a Principal, I want to bill students based on their actual usage of daycare and activity services, so that charges accurately reflect each student's consumption.

#### Acceptance Criteria

1. THE Teacher SHALL be able to log a Usage_Record for a student specifying: service type (daycare or activity), date, and quantity (hours for daycare, attendance count for activities).
2. THE System SHALL store each Usage_Record associated with the student, service type, and billing period (month).
3. WHEN the monthly billing cycle runs, THE System SHALL aggregate all Usage_Records for each student within the billing period and compute the usage-based charge using the configured rate for each service.
4. WHEN the monthly Consolidated_Invoice is generated, THE System SHALL include: all instalment dues falling within the period, all usage-based charges, all extra fee components, and applied concessions, producing a single net payable amount.
5. THE System SHALL apply all active Concessions to the Consolidated_Invoice before presenting the net payable amount to the Parent.
6. THE Principal SHALL be able to configure a per-unit rate for each usage-based Fee_Head (e.g., rate per daycare hour, rate per activity session).
7. IF no Usage_Records exist for a student in a billing period for a usage-based Fee_Head, THEN THE System SHALL set the usage charge for that Fee_Head to zero for that period.

---

### Requirement 18: Teacher Usage Entry or school admin

**User Story:** As a Teacher or a scool admin , I want to mark daycare hours and activity attendance for students, so that usage-based billing is accurately captured.

#### Acceptance Criteria

1. THE Teacher SHALL be able to log daycare hours for students in their assigned sections by specifying the student, date, and number of hours.
2. THE Teacher SHALL be able to mark activity attendance for students in their assigned sections by specifying the student, activity, and date.
3. THE Teacher SHALL have no access to any financial data, fee amounts, invoices, payment records, or reports.
4. IF a Teacher attempts to access any financial record beyond usage entry, THEN THE System SHALL deny the request and return a permission error.
5. WHEN a Teacher submits a Usage_Record, THE System SHALL record the submitting Teacher's user_id and timestamp alongside the record.

---

### Requirement 19: Principal PIN Security for Salary Access

**User Story:** As a Principal, I want salary data protected by a separate PIN, so that even if my login session is compromised, salary information remains secure.

#### Acceptance Criteria

1. THE Principal SHALL be able to set a Principal_PIN of at least 4 digits through the security settings of the Financial_Module.
2. THE Principal_PIN SHALL be stored as a hashed value and SHALL NOT be stored in plain text.
3. WHEN the Principal navigates to the Salary_Module, THE System SHALL display a PIN entry prompt before revealing any salary data.
4. IF the correct Principal_PIN is entered, THEN THE System SHALL grant access to the Salary_Module for the duration of the current session without re-prompting until the session ends or the Principal explicitly locks the module.
5. IF an incorrect Principal_PIN is entered three consecutive times, THEN THE System SHALL lock the Salary_Module for 15 minutes and send an alert notification to the Principal's registered contact.
6. WHEN the Principal changes the Principal_PIN, THE System SHALL require the current PIN to be verified before accepting the new PIN.
7. IF the Principal has not set a Principal_PIN, THEN THE System SHALL prompt the Principal to set one before the Salary_Module can be accessed for the first time.

---

### Requirement 20: Profitability Module

**User Story:** As a Principal, I want a dedicated profitability view showing income, expenses, and net profit with drill-down capability, so that I can understand the financial performance of each class and fee component.

#### Acceptance Criteria

1. THE Profitability_Module SHALL be accessible to the Principal only; THE System SHALL deny access to all other roles and return a permission error.
2. THE Profitability_Module SHALL display: total income (all fee collections), total expenses, and net profit for a selected period.
3. THE Principal SHALL be able to drill down into profitability by class, viewing income, expenses allocated to that class, and net profit per class.
4. THE Principal SHALL be able to drill down into profitability by fee component, viewing revenue contribution per Fee_Head (e.g., tuition, daycare, activity).
5. THE Admin SHALL have access to collection totals only and SHALL NOT have access to the Profitability_Module or any profit/loss figures.
6. IF a Finance_Manager attempts to access the Profitability_Module without the VIEW_PROFIT permission being granted by the Principal, THEN THE System SHALL deny the request and return a permission error.
7. THE System SHALL update profitability figures in real time as new payments are recorded or expenses are added.

---

### Requirement 21: Admin Dashboard

**User Story:** As an Admin, I want a focused operational dashboard, so that I can manage daily fee collection tasks efficiently.

#### Acceptance Criteria

1. THE Admin dashboard SHALL display: today's total collections, total pending payments, and a list of recent transactions.
2. THE Admin dashboard SHALL display a task panel showing: reconciliation items pending review and payment reminders due to be sent.
3. THE Admin SHALL be able to initiate a payment reminder to a Parent directly from the dashboard task panel.
4. THE System SHALL hide salary, expense, and profit sections from the Admin dashboard unless the Principal has explicitly granted the corresponding permissions.
5. WHEN the Admin completes a reconciliation review task, THE System SHALL remove it from the pending task panel and record the action in the Audit_Log.

---

### Requirement 22: Principal Dashboard Enhancements

**User Story:** As a Principal, I want my dashboard to surface component-level revenue insights and critical alerts, so that I can act on financial issues quickly.

#### Acceptance Criteria

1. THE Principal dashboard SHALL display component-level revenue insights showing: daycare revenue, activity revenue, and tuition revenue for the current month.
2. THE Principal dashboard SHALL display a high-pending alert when the total outstanding fees exceed a configurable threshold.
3. THE Principal dashboard SHALL display a cash mismatch alert when a Cash_Reconciliation has been flagged as a mismatch and is awaiting resolution.
4. THE Principal dashboard SHALL include an AI insights panel surfacing: revenue trends, expense patterns, default risk alerts, and collection suggestions.
5. THE Principal SHALL be able to configure the high-pending alert threshold in the financial settings.
6. IF the high-pending alert threshold is not configured, THEN THE System SHALL use a default threshold of ₹50,000.

---

### Requirement 23: Edge Case Billing Handling

**User Story:** As a Principal, I want the system to handle mid-month joins, exits, partial payments, overpayments, refunds, and sibling billing correctly, so that every student's financial record is accurate regardless of their enrolment circumstances.

#### Acceptance Criteria

1. WHEN a student is admitted mid-month, THE System SHALL apply Pro_Rated_Billing for all monthly Fee_Heads, calculating the charge proportionally based on the number of remaining days in the month from the admission date.
2. WHEN a student exits mid-month, THE System SHALL apply Pro_Rated_Billing for all monthly Fee_Heads, calculating the charge proportionally based on the number of days the student was enrolled in that month.
3. THE System SHALL support partial payments, recording the paid amount and updating the outstanding balance for the relevant Fee_Head without closing the invoice.
4. WHEN a payment is received that exceeds the student's outstanding balance, THE System SHALL record the excess as a Credit_Balance on the student's account.
5. WHEN a Consolidated_Invoice is generated for a student with a Credit_Balance, THE System SHALL automatically apply the Credit_Balance to reduce the net payable amount on the new invoice.
6. THE Principal SHALL be able to initiate a refund of a Credit_Balance to the Parent, recording the refund amount, mode, and date against the original payment.
7. WHEN a refund is recorded, THE System SHALL reduce the student's Credit_Balance by the refunded amount and generate a refund receipt.
8. IF a Parent has multiple children enrolled in the school, THE System SHALL provide a consolidated sibling view showing the combined outstanding balance across all children and allow a single payment to be split across siblings.

---

### Requirement 24: RBAC Permission Model

**User Story:** As a Principal, I want the system's access control to be driven by a formal permission model, so that role capabilities are explicit, auditable, and consistently enforced across UI and API.

#### Acceptance Criteria

1. THE System SHALL implement RBAC where each role is associated with a permissions array containing named permission constants.
2. THE System SHALL define the following permission constants at minimum: VIEW_SALARY, EDIT_SALARY, VIEW_EXPENSE, ADD_EXPENSE, VIEW_PROFIT, VIEW_FEES, COLLECT_PAYMENT, MANAGE_CONCESSION, VIEW_RECONCILIATION, PERFORM_RECONCILIATION, VIEW_REPORTS, and SEND_REMINDER.
3. THE System SHALL evaluate a user's permissions array on every API request and deny the request with a 403 error if the required permission is absent.
4. THE System SHALL evaluate a user's permissions array when rendering the UI and hide tabs, buttons, and sections for which the user lacks the corresponding permission.
5. THE Principal SHALL be able to toggle individual permissions on or off for a Finance_Manager through the role management settings.
6. WHEN the Principal updates a Finance_Manager's permissions, THE System SHALL apply the updated permissions to all subsequent requests from that Finance_Manager within 60 seconds.
7. THE System SHALL record an Audit_Log entry whenever a role's permissions are modified, capturing: actor user_id, modified role, changed permissions, and timestamp.
8. THE System SHALL define a default permissions set for each role (Admin, Finance_Manager, Teacher, Parent) that is applied at role creation and can be overridden by the Principal.

---

### Requirement 25: Finance Manager Audit Logging

**User Story:** As a Principal, I want all Finance Manager actions to be fully audit logged, so that I can review any financial operation performed on my behalf.

#### Acceptance Criteria

1. THE System SHALL record an Audit_Log entry for every financial action performed by a Finance_Manager, including: fee payment recording, expense creation, concession viewing, report generation, and reconciliation review.
2. EACH Audit_Log entry for a Finance_Manager action SHALL capture: user_id, actor role, action type, module, affected record ID, timestamp, before_data, and after_data.
3. THE Principal SHALL be able to filter the Audit_Log by actor, module, action type, and date range.
4. THE System SHALL make the Audit_Log read-only; no user including the Principal SHALL be able to edit or delete Audit_Log entries through the application interface.
5. WHEN a Finance_Manager views a salary record (where VIEW_SALARY is granted), THE System SHALL record an Audit_Log entry noting the viewer's user_id, the record accessed, and the timestamp.

---

### Requirement 26: Fee Collection — Concession Application by Admin

**User Story:** As an Admin, I want to apply pre-approved concessions to student invoices when permitted by the Principal, so that eligible students receive their discounts at the point of collection.

#### Acceptance Criteria

1. WHERE the Principal has granted the MANAGE_CONCESSION permission to the Admin, THE Admin SHALL be able to apply an existing Concession template to a student's fee account.
2. IF the Admin does not have the MANAGE_CONCESSION permission, THEN THE System SHALL hide the concession application option from the Admin UI and deny any API request to apply a concession, returning a 403 error.
3. WHEN the Admin applies a Concession, THE System SHALL recalculate the student's outstanding balance and update the Consolidated_Invoice to reflect the concession.
4. THE System SHALL record an Audit_Log entry for every concession application by an Admin, capturing: actor user_id, student ID, concession type, concession value, and timestamp.
5. THE Admin SHALL NOT be able to create, edit, or delete Concession templates; only the Principal SHALL have those capabilities.

---

### Requirement 27: Guided Fee Configuration Wizard

**User Story:** As a Principal, Admin, or Accountant, I want a guided step-by-step wizard when creating a new fee component, so that the billing model and rate are configured correctly and the monthly fee is calculated consistently.

#### Acceptance Criteria

1. WHEN a Principal, Admin, or Accountant initiates the creation of a new fee component, THE Fee_Wizard SHALL present a step-by-step guided interface that collects configuration inputs in sequence, where each subsequent step depends on the answer to the previous step.
2. THE Fee_Wizard SHALL present Step 1 as a Billing_Basis selection with the following options: per_hour, per_day, per_week, or per_month_flat.
3. WHEN the Billing_Basis selected is per_hour, THE Fee_Wizard SHALL present the following steps in sequence: (a) prompt for the number of hours per day the service is used (numeric input), (b) prompt for the number of days per week the service is used (numeric input), (c) prompt for the rate per hour (amount input), then compute the Calculated_Monthly_Fee as: rate_per_hour × hours_per_day × days_per_week × 4.33.
4. WHEN the Billing_Basis selected is per_day, THE Fee_Wizard SHALL present the following steps in sequence: (a) prompt for the number of days per week the service is used (numeric input), (b) prompt for the rate per day (amount input), then compute the Calculated_Monthly_Fee as: rate_per_day × days_per_week × 4.33.
5. WHEN the Billing_Basis selected is per_week, THE Fee_Wizard SHALL prompt for the rate per week (amount input) and compute the Calculated_Monthly_Fee as: rate_per_week × 4.33.
6. WHEN the Billing_Basis selected is per_month_flat, THE Fee_Wizard SHALL prompt for the flat monthly amount (amount input) and set the Calculated_Monthly_Fee equal to the entered amount without further computation.
7. WHEN the Calculated_Monthly_Fee has been determined, THE Fee_Wizard SHALL display the computed amount and ask whether the user wants to round off the amount (yes/no).
8. WHEN the user selects yes to round off, THE Fee_Wizard SHALL prompt the user to enter a Rounded_Monthly_Fee and allow the user to edit the displayed amount before proceeding.
9. WHEN the user selects no to round off, THE Fee_Wizard SHALL use the Calculated_Monthly_Fee as the final monthly amount without modification.
10. AFTER the monthly fee amount is confirmed, THE Fee_Wizard SHALL ask whether the fee is fixed for all students or variable per student (fixed / variable selection).
11. AFTER the fixed/variable selection, THE Fee_Wizard SHALL present a multi-select class list and require the user to select which classes the fee component applies to.
12. AFTER the class selection, THE Fee_Wizard SHALL ask whether the fee should be included in the student onboarding checklist (yes/no).
13. WHILE the user is in the Fee_Wizard, THE Admin or Accountant SHALL be able to edit the final calculated or rounded monthly amount before saving.
14. WHEN the user completes all Fee_Wizard steps and confirms, THE System SHALL store all wizard inputs including: Billing_Basis, rate, hours_per_day (if applicable), days_per_week (if applicable), Calculated_Monthly_Fee, Rounded_Monthly_Fee (if applicable), fixed/variable flag, applicable classes, and onboarding checklist inclusion flag.
15. IF any required numeric input in the Fee_Wizard is zero or negative, THEN THE System SHALL display a validation error and prevent the user from advancing to the next step.

---

### Requirement 28: Contextual Help System

**User Story:** As a user of the Financial Module, I want contextual, role-specific help available on every screen, so that I can understand what each screen does and how to use it without needing external training.

#### Acceptance Criteria

1. THE System SHALL display a help icon (e.g., a "?" button) on every Financial_Module screen.
2. WHEN a user clicks the help icon, THE Help_Panel SHALL open and display role-specific step-by-step instructions for the current screen.
3. THE Help_Panel content SHALL be tailored to the role of the authenticated user; a Principal SHALL see Principal-specific instructions, an Admin SHALL see Admin-specific instructions, and so on for each defined role.
4. THE Help_Panel content SHALL be written in plain language with numbered step-by-step instructions covering: what the screen does, what actions the user can take, what happens after each action, and any important warnings.
5. WHEN the Fee Configuration screen is viewed by a Principal, THE Help_Panel SHALL include instructions such as: "Step 1: Click 'Add Fee Component'. Step 2: The wizard will ask how the fee is billed — select per hour, per day, per week, or flat monthly. Step 3: Enter the rate and usage details. Step 4: Review the calculated monthly amount and round off if needed. Step 5: Select which classes this fee applies to."
6. WHEN the Concession screen is viewed by an Admin, THE Help_Panel SHALL include instructions such as: "Step 1: Search for the student. Step 2: Select the fee head to apply the concession to. Step 3: Choose fixed amount or percentage. Step 4: Enter the value and reason. Step 5: Submit for Principal approval. Note: The concession will not take effect until the Principal approves it."
7. WHEN the Fee Collection screen is viewed by an Admin, THE Help_Panel SHALL include instructions such as: "Step 1: Search for the student. Step 2: Select the fee head(s) to collect payment for. Step 3: Enter the amount received and payment mode. Step 4: Click 'Record Payment'. A receipt will be auto-generated and available for download."
8. THE Help_Panel SHALL be dismissible by the user and SHALL NOT block or overlay the main screen content in a way that prevents interaction with the screen.
9. WHEN a user accesses a Financial_Module screen for the first time, THE System SHALL display a one-time onboarding tooltip for that screen to draw attention to the help icon.
10. AFTER the onboarding tooltip has been shown once for a given screen and user, THE System SHALL NOT display it again for that user on subsequent visits to the same screen.

---

### Requirement 29: Teacher Attendance and Leave Management

**User Story:** As a Principal or Accountant, I want to manage teacher attendance and leave records, so that salary calculations accurately reflect each staff member's working days and approved absences.

#### Acceptance Criteria

1. THE Teacher SHALL be able to submit a Leave_Application through the portal specifying: leave date(s), leave type (sick leave, casual leave, or other), and reason.
2. WHEN a Leave_Application is submitted, THE System SHALL route it to the Principal or Accountant for approval.
3. THE Principal OR Accountant SHALL be able to approve or reject a Leave_Application.
4. WHEN a Leave_Application is approved, THE System SHALL automatically update the teacher's Attendance_Record for the applicable date(s) to reflect the approved leave status.
5. THE Principal, Accountant, OR Admin SHALL be able to mark teacher attendance for a single day, a full week (bulk mark), or a full month (bulk mark).
6. THE System SHALL support the following attendance status values for each day: Present, Absent, Half-Day, On Leave (approved), and Holiday.
7. THE System SHALL auto-calculate and maintain a running total for each teacher per month showing: total Working_Days, days present, days absent, half-days, approved leave days, and remaining leave balance.
8. WHEN a Leave_Application is approved, THE System SHALL automatically deduct the approved leave day(s) from the teacher's present days count for the month and update the running totals accordingly.
9. THE Principal SHALL be able to view a monthly attendance summary for all staff showing each staff member's present days, absent days, leave days, and remaining leave balance.
10. WHEN the monthly salary is being finalised for a staff member, THE System SHALL automatically retrieve the staff member's Attendance_Record (present days, absent days, approved leave days) for that month.
11. WHEN the salary finalisation screen is displayed, THE System SHALL show the staff member's attendance summary alongside the salary calculation so the Principal or Accountant can review the data before finalising.

---

### Requirement 30: Employment Terms and Conditions Configuration

**User Story:** As a Principal or Admin, I want to configure the school's employment terms and conditions, so that all staff are onboarded with a consistent, school-specific employment policy.

#### Acceptance Criteria

**Terms & Conditions Configuration:**

1. THE Principal OR Admin SHALL be able to configure the following Employment_Terms policy fields for the school: Notice_Period (in days, weeks, or months), Probation_Period (in months), Holiday_Pay_Policy, Leave_Policy (sick leave days, casual leave days, and earned leave days per year), leave carry-forward policy (whether unused leave carries to the next year and the maximum carry-forward limit), whether leaves during Probation_Period are paid or unpaid, working days per week, working hours per day, and any additional custom terms.
2. THE System SHALL use the Salary_Calculation_Method configured under Requirement 9 as the salary calculation method within the Employment_Terms; THE Principal SHALL NOT be required to re-configure it here.

**AI-Generated Terms & Conditions:**

3. WHEN the Principal OR Admin initiates the Employment_Terms configuration, THE System SHALL present a guided questionnaire collecting all policy fields listed in criterion 1.
4. WHEN the Principal OR Admin completes the questionnaire, THE System SHALL use AI to generate a complete, professionally worded Employment_Terms document based on the provided inputs.
5. THE Principal SHALL be able to review, edit, and approve the AI-generated Employment_Terms document before it is saved as the school's active policy.
6. WHEN the Principal approves the Employment_Terms document, THE System SHALL save it as the active Employment_Terms for the school.
7. THE System SHALL version the Employment_Terms document; WHEN the Principal updates and re-approves it, THE System SHALL save the new version and retain all previous versions in history.
8. THE System SHALL use the approved Employment_Terms document as the basis for generating Offer_Letters.

**Salary Components Configuration:**

9. THE Principal SHALL be able to define custom Salary_Components for the school (e.g., Basic Pay, HRA, Transport Allowance, Special Allowance, PF deduction, Professional Tax).
10. EACH Salary_Component SHALL be configurable as: a fixed amount, a percentage of basic pay, or a formula-based value.
11. THE System SHALL use the configured Salary_Components when generating payslips, displaying each component as a separate line item.

**Teacher Onboarding Document Requirements:**

12. THE Principal OR Admin SHALL be able to configure an Onboarding_Document_Checklist specifying the documents a new teacher must upload during onboarding (e.g., ID proof, address proof, educational certificates, experience certificates, PAN card, bank account details, passport photo).
13. THE System SHALL present the Onboarding_Document_Checklist to the teacher during their onboarding flow.
14. THE System SHALL track the upload status of each required document per teacher as one of: uploaded, pending, or rejected.
15. THE Principal OR Admin SHALL be able to mark a document as verified or rejected; WHEN a document is rejected, THE System SHALL require a rejection reason to be provided.
16. IF any required document in the Onboarding_Document_Checklist has not been uploaded and verified, THEN THE System SHALL prevent the teacher's onboarding from being marked as complete.

**Holiday Pay Configuration:**

17. THE Principal SHALL be able to define school holidays and long breaks (e.g., summer holidays, Diwali break, Christmas break) in the school calendar.
18. FOR EACH defined holiday or break period, THE Principal SHALL be able to configure whether it is paid or unpaid for staff as part of the Holiday_Pay_Policy.
19. THE System SHALL use the Holiday_Pay_Policy when calculating monthly salary for staff members who have days falling within a defined holiday or break period.

---

### Requirement 31: Offer Letter Generation

**User Story:** As a Principal, I want the system to generate a formal offer letter for each new staff member, so that employment terms are documented and communicated consistently.

#### Acceptance Criteria

1. WHEN a new staff member is onboarded, THE System SHALL generate an Offer_Letter for that staff member using the school's approved Employment_Terms document and the staff member's specific employment details: name, role, start date, gross salary, Salary_Components breakdown, Notice_Period, Probation_Period, leave entitlements, and Holiday_Pay_Policy.
2. THE Offer_Letter SHALL be a Branded_Report including: school logo, school name, school address, date of issue, staff member's name and role, salary breakdown by Salary_Component, Notice_Period, Probation_Period, leave entitlements, Holiday_Pay_Policy, and any custom terms configured by the school.
3. THE System SHALL generate an Offer_Letter only once per staff member's lifetime in the system; IF an Offer_Letter already exists for a staff member, THEN THE System SHALL prevent a second Offer_Letter from being generated for that staff member and return a validation error.
4. WHEN the Offer_Letter is generated, THE System SHALL save it in LOCKED status; the content SHALL NOT be editable after generation.
5. WHILE the Offer_Letter is in LOCKED status and has not been explicitly released by the Principal, THE System SHALL deny access to the Offer_Letter by the Teacher or Staff member.
6. THE Principal OR Admin SHALL be able to download the Offer_Letter at any time after generation.
7. THE Principal SHALL be able to explicitly release the Offer_Letter to the staff member's portal, making it visible and downloadable by the staff member.
8. THE System SHALL record an Audit_Log entry when the Offer_Letter is generated, released, or downloaded, capturing: actor user_id, staff member ID, action, and timestamp.

---

### Requirement 32: Employee Termination Workflow

**User Story:** As a Principal, I want a formal termination workflow for staff, so that employment endings are handled consistently, documented properly, and the staff member's account is deactivated while preserving all their work.

#### Acceptance Criteria

**Termination Initiation:**

1. THE Admin, Accountant, OR Principal SHALL be able to initiate a Termination_Request for a staff member by specifying: staff member name, termination date, reason for termination, and any final settlement notes.
2. WHEN a Termination_Request is initiated by an Admin or Accountant, THE System SHALL route it to the Principal for approval.
3. WHEN a Termination_Request is initiated by the Principal directly, THE System SHALL require the Principal to confirm the action before proceeding.

**Principal Approval:**

4. WHEN a Termination_Request is pending approval, THE System SHALL send a notification to the Principal.
5. THE Principal SHALL be able to review the Termination_Request details and approve or reject it.
6. WHEN the Principal approves the Termination_Request, THE System SHALL digitally record the Principal's approval with timestamp.

**Experience Letter Generation:**

7. WHEN the Principal approves the Termination_Request, THE System SHALL automatically generate an Experience_Letter for the staff member.
8. THE Experience_Letter SHALL be a Branded_Report including: school logo, school name, school address, staff member's name, role, date of joining, last working date, a statement of employment, and the Principal's name and designation.
9. WHEN the Experience_Letter is generated, THE System SHALL save it in the system and make it available for download by the Admin.
10. THE Admin SHALL be able to send the Experience_Letter to the staff member via email directly from the system.

**Account Deactivation:**

11. WHEN the Termination_Request is approved, THE System SHALL deactivate the staff member's login account; IF the staff member attempts to log in on or after the termination effective date, THEN THE System SHALL deny the login and return an appropriate error.
12. WHEN the staff member's account is deactivated, THE System SHALL preserve ALL data associated with that staff member including: attendance records, usage entries, uploaded documents, leave history, and salary records.
13. ALL historical data entered by the terminated staff member SHALL remain intact and accessible to the Principal and Admin.
14. THE System SHALL display a "Terminated" status badge on the staff member's profile visible to the Principal and Admin.

**Offer Letter Release on Termination:**

15. WHEN a Termination_Request is approved, THE System SHALL make the staff member's Offer_Letter available for download by the staff member from their portal in read-only format.
16. WHEN the Offer_Letter and Experience_Letter are made available following termination, THE System SHALL notify the staff member that both documents are available for download.

**Audit Trail:**

17. THE System SHALL record a full Audit_Log entry for the termination event capturing: initiator user_id, Principal approver user_id, staff member ID, termination date, reason, and timestamp.

---

### Requirement 33: Teacher Self-Service Portal (HR)

**User Story:** As a Teacher, I want a self-service HR section in my portal, so that I can manage my leave applications, view my onboarding document status, and access my employment documents.

#### Acceptance Criteria

1. THE Teacher SHALL be able to view their Onboarding_Document_Checklist showing: document name, upload status (uploaded, pending, or rejected), and rejection reason where applicable.
2. THE Teacher SHALL be able to upload required onboarding documents directly from their portal.
3. WHEN a document is rejected by the Principal or Admin, THE System SHALL notify the Teacher with the rejection reason and allow the Teacher to re-upload the document.
4. THE Teacher SHALL be able to view their leave balance showing: total entitlement, leaves taken, and remaining balance for each leave type.
5. THE Teacher SHALL be able to submit a Leave_Application from their portal as defined in Requirement 29.
6. THE Teacher SHALL be able to view the status of their submitted Leave_Applications as one of: pending, approved, or rejected.
7. THE Teacher SHALL be able to view their released payslips (Payslip_Push status = RELEASED) from their portal.
8. WHILE a payslip remains in DRAFT status, THE System SHALL deny the Teacher access to that payslip.
9. WHEN the Teacher is terminated and the Termination_Request is approved, THE System SHALL make the Offer_Letter and Experience_Letter available for download from the Teacher's portal in read-only format.
10. IF a Teacher attempts to access any financial data, fee records, or other students' information through the self-service portal, THEN THE System SHALL deny the request and return a permission error.

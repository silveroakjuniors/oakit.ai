# Oakit — Role-by-Role Testing Guide

This document describes what each user role can see and do in Oakit.  
Share the relevant section with each tester so they know exactly what to verify.

---

## Table of Contents

1. [Parent](#1-parent)
2. [Teacher](#2-teacher)
3. [Admin](#3-admin)
4. [Principal](#4-principal)
5. [Accountant (Finance Manager)](#5-accountant-finance-manager)
6. [Franchise Admin](#6-franchise-admin)
7. [Super Admin](#7-super-admin)

---

## 1. Parent

> **Who is this?** A parent or guardian of one or more enrolled students.

### Where to log in
`/login` → role redirects to `/parent`

### Dashboard (`/parent`)
- See a greeting with your child's name and today's date.
- View a summary card: attendance percentage, curriculum coverage, and homework status.
- Quick-access tiles to Feed, Fees, Journey, and Messages.

### Class Feed (`/parent/feed`)
- View photos and updates posted by the class teacher.
- Cannot post anything — read-only.

### Attendance
- View your child's attendance record: present/absent per day.
- See the overall attendance percentage for the term.
- Cannot mark or edit attendance.

### Curriculum Progress
- See which topics have been covered in each subject.
- View coverage percentage per subject.
- Cannot edit or add topics.

### Homework
- View homework assignments sent by the teacher.
- See due dates and descriptions.
- Cannot create or delete homework.

### Observations
- Read teacher observations recorded about your child.
- Cannot add or edit observations.

### Calendar
- View school events and holidays.
- Cannot create or modify events.

### Messages
- Send and receive messages with the class teacher.
- View message history.

### Fees (`/parent/fees`)
- View all fee invoices for your child.
- See outstanding balance, due dates, and payment history.
- **Cannot pay online** (payment is recorded by admin/accountant at school).
- Cannot edit fee structures or amounts.

### AI Assistant (Oakie)
- Ask questions about your child's progress, attendance, or homework.
- Example: *"How many days was my child absent this month?"*

### Settings
- Update your notification preferences.
- View your profile details.

### What a Parent **cannot** do
- Cannot see other students' data.
- Cannot access any financial management screens.
- Cannot view salary, expenses, or reconciliation.
- Cannot create announcements or calendar events.
- Cannot access admin, teacher, or principal dashboards.

---

## 2. Teacher

> **Who is this?** A class teacher assigned to one or more sections.

### Where to log in
`/login` → role redirects to `/teacher`

### Dashboard (`/teacher`)
- See today's summary: sections assigned, attendance submitted, plans completed.
- Streak counter showing consecutive days of completed lesson plans.
- Quick links to all teacher tools.

### Attendance (`/teacher/attendance`)
- Mark students present or absent for each assigned section.
- Can only mark attendance for today (time-locked).
- View attendance history for your sections.

### Lesson Plans
- Create daily lesson plans for each section.
- Mark a plan as complete once the lesson is delivered.
- View plan history and coverage percentage.

### Class Feed (`/teacher/feed`)
- Post photos and updates for parents to see.
- Delete your own posts.
- Cannot see or edit other teachers' posts.

### Homework (`/teacher/homework`)
- Create homework assignments for your sections.
- Set due dates and descriptions.
- View submitted homework status.

### Student Journey (`/teacher/journey`)
- View and add observations for individual students.
- Record milestones and developmental notes.
- View the child's learning journey timeline.

### Messages (`/teacher/messages`)
- Send and receive messages with parents of your students.
- View full message history per parent.

### Resources (`/teacher/resources`)
- Upload and manage teaching resources (PDFs, documents).
- Share resources with students or parents.

### Students (`/teacher/students`)
- View the list of students in your assigned sections.
- View individual student profiles.
- Manage student login credentials (username/password for student portal).

### Quizzes (`/teacher/quiz`)
- Create quizzes and assign them to students.
- View quiz results and scores.

### Supplementary Content
- Add supplementary learning materials for students.

### What a Teacher **cannot** do
- Cannot access admin, principal, or financial dashboards.
- Cannot view or manage fees, salary, or expenses.
- Cannot create or edit classes, curriculum structure, or school settings.
- Cannot see students outside their assigned sections.
- Cannot view other teachers' plans or attendance.

---

## 3. Admin

> **Who is this?** A school administrator who manages day-to-day school operations.

### Where to log in
`/login` → role redirects to `/admin`

### Dashboard (`/admin`)
- School-wide summary: total students, attendance rate, active teachers.
- Quick links to all admin modules.

### User Management (`/admin/users`)
- Create new users: teachers, parents, accountants.
- Edit user details (name, email, phone).
- Deactivate or reactivate user accounts.
- Reset user passwords.
- Cannot create principal or super admin accounts.

### Class Management (`/admin/classes`)
- Create and edit classes and sections (e.g., Class 1 - Section A).
- Assign class teachers to sections.
- Manage class capacity and details.

### Student Management (`/admin/students`)
- Enroll new students.
- Edit student profiles (name, DOB, parent details, photo).
- Manage student records and documents.
- View student portal access.

### Curriculum Management (`/admin/curriculum`)
- Create and manage the school curriculum structure.
- Add subjects, topics, and sub-topics.
- Assign curriculum to classes.

### Calendar (`/admin/calendar`)
- Create school events, holidays, and exam dates.
- Edit and delete calendar entries.

### Announcements (`/admin/announcements`)
- Create school-wide announcements visible to all parents and teachers.
- Edit and delete announcements.

### Enquiries (`/admin/enquiries`)
- View and manage student admission enquiries.
- Update enquiry status (new, contacted, enrolled, rejected).

### Reports (`/admin/reports`)
- View school-wide attendance reports.
- View curriculum coverage reports.
- Export reports as PDF or spreadsheet.

### Audit Log (`/admin/audit`)
- View a log of all system actions (who did what and when).
- View content safety alerts flagged by the system.

### Textbook Planner (`/admin/textbook-planner`)
- Plan textbook usage across classes and subjects.

### Quizzes (`/admin/quizzes`)
- Manage quizzes across the school.
- View quiz results.

### Smart Alerts (`/admin/smart-alerts`)
- View automated alerts about attendance drops, plan gaps, etc.

### AI Usage (`/admin/ai-usage`)
- Monitor how many AI credits the school has used.

### Financial Module (`/admin/finance`) — Default Permissions
The admin has **limited** financial access by default. The principal can grant additional permissions.

| Feature | Default Access |
|---|---|
| View fee invoices | ✅ Yes |
| Collect payments (record a payment) | ✅ Yes |
| Create/edit fee structures | ✅ Yes |
| Create fee concessions | ✅ Yes |
| Send payment reminders | ✅ Yes |
| View financial reports | ✅ Yes |
| Approve concessions | ❌ No (principal must grant) |
| View expenses | ❌ No (principal must grant) |
| Add expenses | ❌ No (principal must grant) |
| View reconciliation | ❌ No (principal must grant) |
| Perform reconciliation | ❌ No (principal must grant) |
| View salary | ❌ No (principal must grant) |
| Edit salary | ❌ No (principal must grant) |
| View profitability | ❌ No (principal must grant) |

### What an Admin **cannot** do
- Cannot access the principal dashboard.
- Cannot assign financial permissions to other users (only principal can).
- Cannot set or change the salary PIN.
- Cannot access salary, expenses, or reconciliation unless explicitly granted by the principal.
- Cannot access franchise or super admin screens.

---

## 4. Principal

> **Who is this?** The school principal — the highest authority within a single school.

### Where to log in
`/login` → role redirects to `/principal`

### Dashboard (`/principal`)
- Live school health overview: total students, present today, absent today.
- Three donut charts: curriculum coverage %, attendance submitted %, plans completed %.
- Quick-stat tiles: sections, teachers, classes.
- Safety alert banner if any content flags exist.
- Birthday widget: today's birthdays with option to send AI-formatted wishes to parents.
- Teaching consistency leaderboard (top 5 teachers by streak).
- Teaching engagement table (30-day plan completion rate per teacher).
- AI assistant (Oakie) — ask anything about the school.

### Attendance Overview (`/principal/attendance`)
- View attendance for every section across the school.
- See which sections have and haven't submitted attendance today.
- Drill down into individual section attendance.

### Teachers (`/principal/teachers`)
- View all teachers and their assigned sections.
- See each teacher's plan completion rate and streak.
- View teacher engagement metrics over 30 days.
- Flag underperforming teachers.

### Curriculum Coverage (`/principal/coverage`)
- View curriculum coverage percentage per class and section.
- Identify sections that are behind schedule.
- Drill into specific subjects and topics.

### Reports (`/principal/overview`)
- School-wide reports: attendance, curriculum, homework.
- Export reports.

### Financial Module (`/principal/finance`) — Full Access
The principal has **all** financial permissions with no restrictions.

#### Fee Structures (`/principal/finance/fee-structures`)
- Create, edit, and delete fee structures (e.g., Tuition, Transport, Activity).
- Add fee heads and amounts per class.

#### Fee Collection (`/principal/finance/fees`)
- View all student fee invoices.
- Record payments (cash, bank transfer, UPI, cheque).
- View payment history and outstanding balances.
- Search and filter by student, class, or status.

#### Concessions (`/principal/finance/concessions`)
- Create fee concessions for individual students.
- Approve or reject concession requests.
- View all active concessions.

#### Expenses (`/principal/finance/expenses`)
- Add school expenses (utilities, supplies, maintenance, etc.).
- View and filter expense records.
- View expense totals by category.

#### Reconciliation (`/principal/finance/reconciliation`)
- Perform bank reconciliation: match bank statement entries to recorded payments.
- Perform cash reconciliation: verify cash collected vs. recorded.
- View reconciliation history.

#### Salary (`/principal/finance/salary`) — PIN Protected
- **Set and change the salary PIN** (only the principal can do this).
- Configure salary structures for each staff member.
- Record monthly salary payments.
- Push payslips to staff.
- View salary history.
- All salary operations require entering the PIN first.

#### Financial Reports (`/principal/finance/reports`)
- View fee collection summaries.
- View expense summaries.
- View profitability insights (income vs. expenses).
- Export reports as PDF.

#### Permission Management (`/principal/finance/permissions`)
- **Exclusively available to the principal.**
- Grant or revoke financial permissions for individual admin and accountant users.
- Example: grant an admin the ability to view expenses, or grant an accountant salary access.

### What a Principal **cannot** do
- Cannot access franchise or super admin screens.
- Cannot see data from other schools.
- Cannot create or delete the school itself (super admin function).

---

## 5. Accountant (Finance Manager)

> **Who is this?** A dedicated finance staff member responsible for day-to-day financial operations.

### Where to log in
`/login` → role redirects to `/admin` (uses the same admin UI but with finance-focused permissions)

### Financial Module — Default Permissions

| Feature | Default Access |
|---|---|
| View fee invoices | ✅ Yes |
| Collect payments | ✅ Yes |
| Create/edit fee structures | ✅ Yes |
| Create fee concessions | ✅ Yes |
| **Approve concessions** | ✅ Yes (unlike admin) |
| View expenses | ✅ Yes |
| Add expenses | ✅ Yes |
| View reconciliation | ✅ Yes |
| **Perform reconciliation** | ✅ Yes (unlike admin) |
| View financial reports | ✅ Yes |
| Send payment reminders | ✅ Yes |
| View salary | ❌ No (principal must grant) |
| Edit salary | ❌ No (principal must grant) |
| Push payslips | ❌ No (principal must grant) |
| View profitability | ❌ No |

### Fee Collection (`/admin/finance/fees`)
- Record fee payments for students.
- View all invoices and outstanding balances.
- Search by student name, class, or payment status.
- Send payment reminders to parents.

### Fee Structures (`/admin/finance/fee-structures`)
- Create and edit fee structures and fee heads.
- Cannot delete fee structures that have active invoices.

### Concessions (`/admin/finance/concessions`)
- Create concession requests for students.
- **Approve or reject concessions** (this is a key difference from admin).
- View all active and historical concessions.

### Expenses (`/admin/finance/expenses`)
- Add new expense records (category, amount, date, description).
- View all expense records.
- **Cannot edit or delete** expense records once submitted (immutable audit trail).

### Reconciliation (`/admin/finance/reconciliation`)
- Perform bank reconciliation: match bank entries to system records.
- Perform cash reconciliation: verify cash collected.
- Mark reconciliation periods as complete.
- View reconciliation history.

### Reports (`/admin/finance/reports`)
- View fee collection summaries.
- View expense summaries.
- Export reports.

### Salary (if granted by principal)
- If the principal grants salary permissions, the accountant can:
  - View salary records.
  - Record salary payments.
  - Push payslips.
- Salary operations always require the salary PIN (set by principal).

### What an Accountant **cannot** do
- Cannot access school management features (users, classes, students, curriculum).
- Cannot access the principal or teacher dashboards.
- Cannot set or change the salary PIN.
- Cannot assign financial permissions to other users.
- Cannot edit or delete expense records.
- Cannot view profitability insights (principal-only).
- Cannot access franchise or super admin screens.

---

## 6. Franchise Admin

> **Who is this?** An owner or manager of a franchise that operates multiple schools under one brand.

### Where to log in
`/login` → role redirects to `/franchise-admin`

### Franchise Dashboard (`/franchise/dashboard`)
- Aggregated view across all schools in the franchise.
- Total students, teachers, and sections across all schools.
- Attendance rates and curriculum coverage averages.
- Per-school breakdown with drill-down capability.

### Schools Management (`/franchise/schools`)
- View all schools in the franchise.
- Add new schools to the franchise.
- View school-level statistics (student count, active users, AI usage).
- Enable or disable the financial module for individual schools.
- Cannot directly edit school data (that is done by each school's admin/principal).

### Curriculum Management (`/franchise/curriculum`)
- Manage the shared franchise curriculum template.
- Push curriculum updates to all schools in the franchise.
- Schools can customise within the franchise template.

### What a Franchise Admin **can** see
- Aggregated statistics across all their schools.
- School-level summaries (not individual student/teacher data).
- Curriculum structure and coverage at a high level.

### What a Franchise Admin **cannot** do
- **Cannot access individual student, teacher, or parent personal data** (PII is blocked).
- Cannot directly modify records within a school (attendance, plans, fees, etc.).
- Cannot access financial data of individual schools (fees, salary, expenses).
- Cannot access super admin screens.
- Cannot see schools outside their franchise.
- Cannot impersonate users.

---

## 7. Super Admin

> **Who is this?** The platform operator — manages the entire Oakit platform across all franchises and schools.

### Where to log in
`/super-admin/login` → redirects to `/super-admin`

### Super Admin Dashboard (`/super-admin`)
- Platform-wide statistics: total schools, total students, total teachers.
- AI credit usage across all schools.
- Recent activity and system health.

### Schools Management (`/super-admin/schools`)
- View all schools on the platform (across all franchises).
- Create new schools.
- Edit school details (name, address, contact, settings).
- Deactivate or reactivate schools.
- Enable or disable the financial module per school.
- View per-school usage statistics.

### School Detail (`/super-admin/schools/[id]`)
- Deep-dive into any school's configuration.
- View the school's users, classes, and settings.
- Manage billing and subscription for the school.

### Franchise Management (`/super-admin/franchises`)
- Create and manage franchises.
- Assign schools to franchises.
- Assign franchise admin users.
- View franchise-level statistics.

### Billing & Usage (`/super-admin/billing`)
- View AI credit consumption per school.
- Manage subscription plans and billing.
- View platform-wide revenue and usage trends.

### Impersonation
- **Temporarily act as any user** on the platform for support and debugging.
- Impersonation creates a time-limited token.
- All impersonation sessions are logged in the audit trail.
- The impersonated session can be revoked at any time.

### Financial Module Settings
- Enable or disable the financial module for any school.
- View platform-wide financial module adoption.

### What a Super Admin **can** do that no one else can
- Access any school's data regardless of franchise or school_id.
- Create and delete schools and franchises.
- Impersonate any user.
- View platform-wide billing and usage.
- Bypass all school-scope and franchise-scope guards.

### What a Super Admin **cannot** do
- Cannot perform day-to-day school operations (marking attendance, creating plans, etc.) — use impersonation for that.
- Cannot access individual school financial data directly (use impersonation to act as a principal).

---

## Quick Reference: Financial Permissions Matrix

| Permission | Principal | Admin (default) | Accountant (default) | Teacher | Parent |
|---|:---:|:---:|:---:|:---:|:---:|
| View fee invoices | ✅ | ✅ | ✅ | ❌ | ✅ |
| Collect payments | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage fee structures | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create concessions | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Approve concessions** | ✅ | ❌* | ✅ | ❌ | ❌ |
| View expenses | ✅ | ❌* | ✅ | ❌ | ❌ |
| Add expenses | ✅ | ❌* | ✅ | ❌ | ❌ |
| View reconciliation | ✅ | ❌* | ✅ | ❌ | ❌ |
| Perform reconciliation | ✅ | ❌* | ✅ | ❌ | ❌ |
| View reports | ✅ | ✅ | ✅ | ❌ | ❌ |
| View profitability | ✅ | ❌* | ❌ | ❌ | ❌ |
| Send reminders | ✅ | ✅ | ✅ | ❌ | ❌ |
| View salary | ✅ | ❌* | ❌* | ❌ | ❌ |
| Edit salary | ✅ | ❌* | ❌* | ❌ | ❌ |
| Push payslips | ✅ | ❌* | ❌* | ❌ | ❌ |
| **Set salary PIN** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Assign permissions** | ✅ | ❌ | ❌ | ❌ | ❌ |

*Can be granted by the principal on a per-user basis via `/principal/finance/permissions`.

---

## Notes for Testers

- **Salary PIN**: All salary screens require a PIN. Only the principal sets this. Test by navigating to `/principal/finance/salary` — you will be prompted for the PIN before any data is shown.
- **Permission grants**: To test an admin or accountant with extra permissions, ask the principal to grant them via the Permissions screen first.
- **Force password reset**: New accounts may require a password change on first login. You will be redirected automatically.
- **Financial module toggle**: If the financial module is disabled for a school, all `/finance` routes will return a 403. Super admin or franchise admin can re-enable it.
- **Cross-school access**: Any attempt by a school-scoped user (admin, teacher, parent, principal) to access another school's data will be blocked with a 403.
- **Impersonation (super admin only)**: After impersonating a user, all actions are logged. The session expires automatically.

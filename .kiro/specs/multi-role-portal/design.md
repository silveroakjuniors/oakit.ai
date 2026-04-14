# Design Document: Multi-Role Portal

## Overview

This feature extends the Oakit platform with three role improvements:

1. **Super Admin** — a new platform-level role (school_id = NULL) that manages all schools, can impersonate school admin contexts, and views platform-wide statistics.
2. **Principal** — gains attendance oversight, teacher activity monitoring, curriculum coverage reporting, section flagging, and a school-context-aware AI assistant.
3. **Parent** — gains a daily activity feed, 30-day attendance history, in-app completion notifications, settling/special day visibility, and a curriculum progress indicator.

The implementation touches the database schema (3 migrations), the API gateway (new route files + middleware changes), and the frontend (new/updated pages for each role).

---

## Architecture

```mermaid
graph TD
  subgraph Frontend [Next.js Frontend]
    SA[/super-admin pages/]
    PR[/principal pages/]
    PA[/parent pages/]
  end

  subgraph API [API Gateway - Express]
    SAR[/api/v1/super-admin/*]
    PRR[/api/v1/principal/*]
    PAR[/api/v1/parent/*]
    AIR[/api/v1/ai/query]
    AUTH[/api/v1/auth/login]
    MW[Middleware: jwtVerify → schoolScope → roleGuard]
  end

  subgraph DB [PostgreSQL]
    schools_t[schools table]
    sections_t[sections table]
    pn_t[parent_notifications table]
    users_t[users table]
    dc_t[daily_completions table]
    ar_t[attendance_records table]
    il_t[impersonation_logs table]
  end

  subgraph AI [AI Service - Python]
    QP[query_pipeline]
  end

  SA --> SAR
  PR --> PRR
  PA --> PAR
  PR --> AIR
  SAR --> MW
  PRR --> MW
  PAR --> MW
  MW --> DB
  AIR --> QP
  QP --> DB
  AUTH --> DB
```

Key architectural decisions:

- **Super admin bypass in schoolScope**: `schoolScope` is updated to skip the school_id check when `req.user.role === 'super_admin'`. This is the minimal change needed — all other middleware remains unchanged.
- **Impersonation via short-lived JWT**: Rather than a session store, impersonation issues a scoped JWT (role=admin, school_id=target) with a 2-hour TTL. Exit invalidates it via a Redis denylist keyed by `jti`.
- **Parent notifications as in-app only**: No push/email infrastructure is added. Notifications are rows in `parent_notifications` created by a DB trigger on `daily_completions` insert, preventing duplicates on edit.
- **Principal AI context injection**: The existing `/api/v1/ai/query` endpoint is extended to accept an optional `context` payload. The principal frontend assembles the context (lagging sections, pending attendance, flagged sections) and sends it with the query.

---

## Components and Interfaces

### Middleware Changes

**`schoolScope` update** (`src/middleware/auth.ts`):
```typescript
export function schoolScope(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  // Super admins are not scoped to any school
  if (req.user.role === 'super_admin') return next();
  const paramSchoolId = req.params.school_id || req.body?.school_id;
  if (paramSchoolId && paramSchoolId !== req.user.school_id) {
    return res.status(403).json({ error: 'Access denied: cross-school request' });
  }
  return next();
}
```

**`JwtPayload` update** (`src/lib/jwt.ts`):
```typescript
export interface JwtPayload {
  user_id: string;
  school_id: string | null;  // null for super_admin
  role: string;
  permissions: string[];
  jti?: string;              // for impersonation token revocation
  force_password_reset?: boolean;
}
```

### New Route Files

| File | Prefix | Guards |
|------|--------|--------|
| `src/routes/super-admin/schools.ts` | `/api/v1/super-admin/schools` | `jwtVerify, roleGuard('super_admin')` |
| `src/routes/super-admin/stats.ts` | `/api/v1/super-admin/stats` | `jwtVerify, roleGuard('super_admin')` |
| `src/routes/super-admin/impersonate.ts` | `/api/v1/super-admin/impersonate` | `jwtVerify, roleGuard('super_admin')` |
| `src/routes/principal/attendance.ts` | `/api/v1/principal/attendance` | `jwtVerify, schoolScope, roleGuard('principal', 'admin')` |
| `src/routes/principal/teachers.ts` | `/api/v1/principal/teachers` | `jwtVerify, schoolScope, roleGuard('principal', 'admin')` |
| `src/routes/principal/coverage.ts` | `/api/v1/principal/coverage` | `jwtVerify, schoolScope, roleGuard('principal', 'admin')` |
| `src/routes/principal/plans.ts` | `/api/v1/principal/plans` | `jwtVerify, schoolScope, roleGuard('principal', 'admin')` |
| `src/routes/principal/flags.ts` | `/api/v1/principal/flags` | `jwtVerify, schoolScope, roleGuard('principal', 'admin')` |
| `src/routes/parent/feed.ts` | `/api/v1/parent/feed` | `jwtVerify, forceResetGuard, schoolScope, roleGuard('parent')` |
| `src/routes/parent/attendance.ts` | `/api/v1/parent/attendance` | `jwtVerify, forceResetGuard, schoolScope, roleGuard('parent')` |
| `src/routes/parent/notifications.ts` | `/api/v1/parent/notifications` | `jwtVerify, forceResetGuard, schoolScope, roleGuard('parent')` |
| `src/routes/parent/progress.ts` | `/api/v1/parent/progress` | `jwtVerify, forceResetGuard, schoolScope, roleGuard('parent')` |

### Super Admin API Endpoints

```
GET    /api/v1/super-admin/schools              — list all schools (filter: status, search: name)
POST   /api/v1/super-admin/schools              — create school
GET    /api/v1/super-admin/schools/:id          — get school details (includes plan_type, billing_status)
PATCH  /api/v1/super-admin/schools/:id          — update school (status, plan_type, billing_status)
POST   /api/v1/super-admin/schools/:id/activate   — activate school
POST   /api/v1/super-admin/schools/:id/deactivate — deactivate school
GET    /api/v1/super-admin/schools/:id/users    — list users for a school
POST   /api/v1/super-admin/schools/:id/users    — create user in a school
POST   /api/v1/super-admin/impersonate/:school_id — issue impersonation token
POST   /api/v1/super-admin/impersonate/exit     — revoke impersonation token
GET    /api/v1/super-admin/stats                — platform-wide statistics
```

### Principal API Endpoints

```
GET  /api/v1/principal/attendance/overview      — all sections with today's attendance status
GET  /api/v1/principal/teachers/activity        — all teachers with today's completion status
GET  /api/v1/principal/coverage                 — all sections with curriculum coverage %
GET  /api/v1/principal/plans/:section_id        — day_plan for a section on a given date (?date=)
POST /api/v1/principal/flags/:section_id        — flag a section (body: { note? })
DELETE /api/v1/principal/flags/:section_id      — unflag a section
```

The existing `/api/v1/ai/query` endpoint is extended to accept an optional `context` field in the request body for principal use.

### Parent API Endpoints

```
GET  /api/v1/parent/feed                        — daily activity feed for today (or ?date=)
GET  /api/v1/parent/attendance                  — 30-day attendance history per child
GET  /api/v1/parent/notifications               — unread notifications
POST /api/v1/parent/notifications/:id/read      — mark notification as read
GET  /api/v1/parent/progress                    — curriculum progress per linked child
```

### Frontend Pages

| Route | Component | Role |
|-------|-----------|------|
| `/super-admin` | `SuperAdminDashboard` | super_admin |
| `/super-admin/schools` | `SchoolListPage` | super_admin |
| `/super-admin/schools/[id]` | `SchoolDetailPage` | super_admin |
| `/principal` | Updated `PrincipalDashboard` | principal |
| `/principal/attendance` | `AttendanceOverviewPage` | principal |
| `/principal/teachers` | `TeacherActivityPage` | principal |
| `/parent` | Updated `ParentPage` | parent |

The login flow (`/api/v1/auth/login`) is extended to handle `role: 'super_admin'` — super admins log in without a `school_code` (or with a special platform code), and the token is issued with `school_id: null`.

---

## Data Models

### Migration 018: Schools table additions

```sql
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  ADD COLUMN IF NOT EXISTS plan_type     TEXT NOT NULL DEFAULT 'basic'
    CHECK (plan_type IN ('basic', 'standard', 'premium')),
  ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'active'
    CHECK (billing_status IN ('active', 'past_due', 'cancelled')),
  ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMPTZ;

-- Allow school_id to be NULL for super_admin users
ALTER TABLE users
  ALTER COLUMN school_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS impersonation_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id  UUID NOT NULL REFERENCES users(id),
  target_school_id UUID NOT NULL REFERENCES schools(id),
  token_jti       TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  exited_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_admin ON impersonation_logs(super_admin_id);
```

### Migration 019: Sections flagging

```sql
ALTER TABLE sections
  ADD COLUMN IF NOT EXISTS flagged     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_note   TEXT,
  ADD COLUMN IF NOT EXISTS flagged_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flagged_by  UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sections_flagged ON sections(school_id, flagged)
  WHERE flagged = true;
```

### Migration 020: Parent notifications

```sql
CREATE TABLE IF NOT EXISTS parent_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       UUID NOT NULL REFERENCES parent_users(id) ON DELETE CASCADE,
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id      UUID NOT NULL REFERENCES sections(id),
  completion_id   UUID NOT NULL REFERENCES daily_completions(id),
  completion_date DATE NOT NULL,
  chunks_covered  INT NOT NULL DEFAULT 0,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_notifications_unique
  ON parent_notifications(parent_id, completion_id);

CREATE INDEX IF NOT EXISTS idx_parent_notifications_parent_unread
  ON parent_notifications(parent_id, is_read)
  WHERE is_read = false;
```

The unique index on `(parent_id, completion_id)` enforces the no-duplicate-notification rule when a teacher edits an existing completion. Notifications are created by the completion submission endpoint (not a DB trigger) using an `INSERT ... ON CONFLICT DO NOTHING` pattern.

### Key Type Shapes (TypeScript)

```typescript
// Super Admin
interface SchoolListItem {
  id: string; name: string; subdomain: string;
  status: 'active' | 'inactive'; plan_type: string;
  billing_status: string; created_at: string;
}

interface PlatformStats {
  total_schools: number; active_schools: number;
  total_teachers: number; total_students: number;
  total_day_plans: number;
}

interface ImpersonationToken {
  token: string; expires_at: string; school_id: string;
}

// Principal
interface AttendanceOverviewItem {
  section_id: string; section_label: string; class_name: string;
  status: 'submitted' | 'pending';
  present_count?: number; absent_count?: number;
  flagged: boolean; flag_note?: string;
}

interface TeacherActivityItem {
  teacher_id: string; teacher_name: string;
  status: 'submitted' | 'behind' | 'not_working_day';
  section_name?: string; chunks_covered?: number;
}

interface CoverageReportItem {
  section_id: string; section_label: string; class_name: string;
  total_chunks: number; covered_chunks: number; coverage_pct: number;
  last_completion_date: string | null; has_curriculum: boolean;
  flagged: boolean; flag_note?: string;
}

// Parent
interface DailyFeedResponse {
  date: string;
  type: 'curriculum' | 'settling' | 'special_day' | 'empty';
  topic_labels: string[];
  settling_day_note?: string;
  special_day_type?: string;
  special_day_label?: string;
  message?: string;
}

interface AttendanceHistoryItem {
  date: string; student_id: string; student_name: string;
  status: 'present' | 'absent';
}

interface AttendanceHistoryResponse {
  records: AttendanceHistoryItem[];
  attendance_pct: number;
}

interface ParentNotification {
  id: string; section_name: string; completion_date: string;
  chunks_covered: number; is_read: boolean; created_at: string;
}

interface CurriculumProgressResponse {
  section_id: string; student_name: string;
  total_chunks: number; covered_chunks: number;
  coverage_pct: number; has_curriculum: boolean;
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: School list contains required fields and is sorted

*For any* set of schools in the database, the school list endpoint should return all schools with name, status, plan_type, and created_at fields present, and the list should be ordered by created_at descending.

**Validates: Requirements 1.1, 1.2**

### Property 2: School list filter correctness

*For any* set of schools with mixed statuses, filtering by `status=active` should return only schools where status is 'active', and filtering by `status=inactive` should return only schools where status is 'inactive'. No schools of the opposite status should appear in the filtered result.

**Validates: Requirements 1.4**

### Property 3: School name search is case-insensitive partial match

*For any* search query string and any set of schools, all returned schools should have names that contain the query string (case-insensitive), and no school whose name does not contain the query should be returned.

**Validates: Requirements 1.5**

### Property 4: School creation round-trip with invariants

*For any* valid school creation payload (name, plan_type, contact), the created school should be retrievable by its returned id, should have status='active', and should have a non-empty subdomain derived from the name.

**Validates: Requirements 2.1, 2.4, 2.5**

### Property 5: School creation rejects invalid payloads

*For any* school creation request missing name or plan_type, the system should return a 400 error and no school record should be created.

**Validates: Requirements 2.2**

### Property 6: Impersonation token has correct claims and scope

*For any* active school, the impersonation token issued by the super admin should contain role='admin' and school_id equal to the target school's id. Subsequent requests using that token should be scoped to that school_id and rejected for other school_ids.

**Validates: Requirements 4.1, 4.2**

### Property 7: Impersonation events are logged

*For any* impersonation request, an entry should exist in impersonation_logs with the correct super_admin_id, target_school_id, and a non-null created_at timestamp.

**Validates: Requirements 4.5**

### Property 8: Platform stats total/active school count invariant

*For any* set of schools with mixed statuses, the platform stats response should satisfy: total_schools = active_schools + inactive_schools, and active_schools should equal the count of schools with status='active'.

**Validates: Requirements 5.1, 5.3**

### Property 9: School deactivation/reactivation round-trip preserves data

*For any* active school, deactivating it should set status='inactive' and block user authentication for that school. Reactivating it should set status='active' and restore authentication. All school data (users, sections, etc.) should remain intact throughout.

**Validates: Requirements 6.1, 6.2, 6.5**

### Property 10: School detail includes billing fields

*For any* school, the detail endpoint response should include plan_type and billing_status fields. After updating plan_type, the response should reflect the new value and plan_updated_at should be non-null.

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 11: Super admin role access control

*For any* request to a super_admin endpoint using a token with role other than 'super_admin', the system should return a 403 error. For any super_admin token, the schoolScope middleware should not reject the request due to missing school_id.

**Validates: Requirements 8.2, 8.4**

### Property 12: Attendance overview completeness and accuracy

*For any* school with sections, the attendance overview should include every section. For sections with at least one attendance_record today, status should be 'submitted' and present_count + absent_count should equal the total records for that section today. For sections with no records today, status should be 'pending'. Each section's flagged status should match the sections table.

**Validates: Requirements 9.1, 9.2, 9.3, 13.3**

### Property 13: Teacher activity feed completeness and accuracy

*For any* school with teachers, the activity feed should include every teacher. Teachers with a daily_completion record for any of their sections today should have status='submitted' with the section name and chunks_covered. Teachers with no completion on a working day should have status='behind'. Teachers with only inactive sections should not be counted as behind.

**Validates: Requirements 10.1, 10.2, 10.3**

### Property 14: Coverage report completeness and formula correctness

*For any* school with sections, the coverage report should include every section with coverage_pct = (unique covered chunk_ids in daily_completions / total chunks in curriculum_chunks for the class) × 100, rounded. last_completion_date should equal the maximum completion_date in daily_completions for that section. Sections with no curriculum should have coverage_pct=0 and has_curriculum=false.

**Validates: Requirements 11.1, 11.2, 11.4**

### Property 15: Principal plan view cross-school enforcement

*For any* principal, requesting a day_plan for a section belonging to a different school should return a 403 error. Requesting a plan for a section in the same school should return the plan with topic_labels populated.

**Validates: Requirements 12.3, 12.4**

### Property 16: Section flagging round-trip with note

*For any* section in the principal's school, flagging it with an optional note should set flagged=true, flagged_at to a non-null timestamp, flagged_by to the principal's user_id, and flag_note to the provided note. Unflagging should set flagged=false and clear flagged_at, flagged_by, and flag_note.

**Validates: Requirements 13.1, 13.2, 13.5**

### Property 17: Principal AI context includes school state

*For any* principal AI query, the context payload sent to the AI service should include: sections with coverage_pct < 50%, sections with no attendance submitted today, and sections where flagged=true. No sections outside the principal's school should appear in the context.

**Validates: Requirements 14.1, 14.2, 14.3**

### Property 18: Parent daily feed is scoped to linked children

*For any* parent, the daily feed should only return data for sections linked to the parent's children via parent_student_links. The response type should be 'curriculum' when a daily_completion exists (including settling_day_note if present), 'special_day' when a special_days record exists but no completion, and 'empty' otherwise.

**Validates: Requirements 15.1, 15.3, 15.4, 18.1, 18.3**

### Property 19: Attendance history window and percentage

*For any* parent, the attendance history response should contain only records where attend_date is within the 30 calendar days ending today. The attendance_pct should equal (count of 'present' records / total records in the period) × 100, rounded. Each record should include date, student_name, and status.

**Validates: Requirements 16.1, 16.2, 16.4**

### Property 20: Notification creation and idempotency

*For any* daily_completion submission for a section, a notification should be created for every parent linked to a student in that section, with is_read=false. If the same completion record is edited (same section_id + completion_date), no additional notifications should be created for parents who already have a notification for that completion_id.

**Validates: Requirements 17.1, 17.2, 17.5**

### Property 21: Notification read status update

*For any* unread notification belonging to a parent, marking it as read should set is_read=true. The notification should no longer appear in the unread notifications list. The notification should include section_name, completion_date, and chunks_covered.

**Validates: Requirements 17.3, 17.4**

### Property 22: Curriculum progress formula and academic year scoping

*For any* parent with linked children, the progress response should include total_chunks, covered_chunks, and coverage_pct = (covered_chunks / total_chunks) × 100. covered_chunks should be computed using only daily_completion records where completion_date falls within the current academic year as defined by school_calendar. When total_chunks = 0, coverage_pct should be 0 and has_curriculum should be false.

**Validates: Requirements 19.1, 19.3, 19.4**

---

## Error Handling

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Missing JWT | 401 | `{ error: 'Missing authorization token' }` |
| Invalid/expired JWT | 401 | `{ error: 'Invalid or expired token' }` |
| Wrong role for endpoint | 403 | `{ error: 'Insufficient permissions' }` |
| Cross-school access attempt | 403 | `{ error: 'Access denied: cross-school request' }` |
| Impersonating inactive school | 403 | `{ error: 'School is inactive' }` |
| School not found | 404 | `{ error: 'School not found' }` |
| Day plan not found | 404 | `{ error: 'No plan found for this section and date' }` |
| Duplicate school name | 409 | `{ error: 'A school with this name already exists' }` |
| Deactivating already inactive school | 409 | `{ error: 'School is already inactive' }` |
| Reactivating already active school | 409 | `{ error: 'School is already active' }` |
| Missing required fields | 400 | `{ error: 'Missing required field: <field_name>' }` |
| AI service unavailable | 503 | `{ error: 'AI assistant is temporarily unavailable' }` |

**School status check on login**: The auth login route is updated to check `schools.status = 'active'` after finding the school by subdomain. If inactive, return 401 with `{ error: 'Invalid credentials' }` (same generic message to avoid information leakage).

**Impersonation token revocation**: On exit, the token's `jti` is added to a Redis set `impersonation:revoked` with TTL matching the token's remaining lifetime. The `jwtVerify` middleware checks this set for tokens with a `jti` claim.

---

## Testing Strategy

### Unit Tests

Focus on specific examples, edge cases, and integration points:

- Auth login returns 401 for users of an inactive school
- Super admin login succeeds without school_code
- Impersonation token contains correct claims
- Impersonation exit adds jti to Redis denylist
- Duplicate school name returns 409
- Missing required fields return 400 with correct field name
- Cross-school plan view returns 403
- Flagging a section from another school returns 403
- AI service timeout returns 503 with user-facing message
- Attendance overview returns 'pending' for sections with no records today
- Coverage report returns has_curriculum=false when no chunks exist
- Notification creation uses INSERT ON CONFLICT DO NOTHING

### Property-Based Tests

Using **fast-check** (TypeScript) for the API gateway and **Hypothesis** (Python) for the AI service context assembly.

Each property test runs a minimum of **100 iterations**.

Tag format: `// Feature: multi-role-portal, Property N: <property_text>`

| Property | Test Description | Library |
|----------|-----------------|---------|
| P1 | Generate random school sets, verify list fields and sort order | fast-check |
| P2 | Generate schools with random statuses, verify filter correctness | fast-check |
| P3 | Generate random school names and queries, verify partial match | fast-check |
| P4 | Generate valid creation payloads, verify round-trip and invariants | fast-check |
| P5 | Generate payloads missing required fields, verify 400 | fast-check |
| P8 | Generate mixed active/inactive school sets, verify stats invariant | fast-check |
| P11 | Generate tokens with non-super_admin roles, verify 403 on super_admin endpoints | fast-check |
| P12 | Generate sections with random attendance records, verify overview accuracy | fast-check |
| P14 | Generate sections with random completion records, verify coverage formula | fast-check |
| P16 | Generate sections and flag/unflag operations, verify round-trip | fast-check |
| P19 | Generate attendance records across date ranges, verify 30-day window and percentage | fast-check |
| P20 | Generate completion submissions and edits, verify notification idempotency | fast-check |
| P22 | Generate completions across academic year boundaries, verify scoping | fast-check |

Each property test must include a comment referencing the design property:
```typescript
// Feature: multi-role-portal, Property 2: School list filter correctness
test.prop([schoolArrayArb, fc.constantFrom('active', 'inactive')])(
  'filter returns only matching status schools',
  async (schools, filterStatus) => { ... }
);
```

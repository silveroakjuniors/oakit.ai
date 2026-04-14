# Design Document: Oakit Platform Enhancement

## Overview

This document describes the technical design for 13 enhancement areas across the Oakit platform. The goal is to extend the existing system incrementally — reusing established patterns (Express routers, pool.query, Next.js App Router pages, SVG charts) and adding new DB tables, API routes, and frontend pages without introducing heavy new dependencies.

All new migrations start at 029 and increment sequentially. All new API routes follow the existing middleware chain: `jwtVerify → forceResetGuard → schoolScope → roleGuard(role)`.

## Architecture

The system retains its existing three-tier architecture:

```
Next.js 14 (App Router)
        ↕ REST (fetch / apiGet / apiPost)
Express API Gateway (Node.js + TypeScript)
        ↕ pg pool.query
PostgreSQL (Supabase)
        ↕ HTTP (axios)
Python FastAPI AI Service
        ↕ Redis (cache layer for streaks, announcement counts)
```

New additions per tier:

- **Frontend**: 6 new pages + enhancements to 4 existing pages
- **API Gateway**: 8 new route files + enhancements to 3 existing routes
- **Database**: 7 new tables across 7 migrations (029–035)
- **AI Service**: 2 new endpoints (`/internal/suggest-activity`, `/internal/generate-worksheet`)

## Components and Interfaces

### 1. Dashboard Data Visualizations (Req 1, 13)

**New API endpoint**: `GET /api/v1/admin/dashboard/charts`

Returns:
```typescript
{
  coverage_by_section: { section_id, section_label, class_name, coverage_pct }[];
  attendance_trend: { date, present, absent, late }[];  // last 30 school days
  today_snapshot: { students_present, sections_attendance_done, sections_plans_done };
}
```

**Chart rendering**: Lightweight SVG-only, consistent with the existing circular progress chart in `parent/page.tsx`. No chart library added.

- Coverage bar chart: horizontal `<rect>` elements, color determined by `coverageColor(pct)` utility
- Attendance trend: polyline SVG with three series (present/absent/late)
- Both charts render a placeholder `<div>` when data arrays are empty

**Principal dashboard** (`GET /api/v1/principal/teachers/engagement`) returns per-teacher:
```typescript
{
  teacher_id, teacher_name, current_streak, last_completion_date,
  thirty_day_rate: number,  // pct of school days in last 30 with completed plan
  alert: boolean            // true if no completion for 3+ consecutive school days
}
```

### 2. Teacher Engagement Streaks (Req 2, 13)

**New table**: `teacher_streaks` (migration 029)

```sql
CREATE TABLE teacher_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id),
  teacher_id uuid NOT NULL REFERENCES users(id),
  current_streak int NOT NULL DEFAULT 0,
  best_streak int NOT NULL DEFAULT 0,
  last_completion_date date,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, teacher_id)
);
```

**Streak update logic**: Called inside the existing `POST /api/v1/teacher/completion` handler after a successful insert into `daily_completions`. Uses school calendar to determine if the previous school day was also completed (consecutive check). Resets to 0 if a gap is detected on the next school day.

**New route**: `GET /api/v1/teacher/streaks` — returns `{ current_streak, best_streak, last_completion_date, milestone_badge }` for the authenticated teacher.

`milestone_badge` is computed server-side: `[5, 10, 20, 30].filter(t => current_streak >= t).pop() ?? null`

### 3 & 4. AI Activity Suggestions and Worksheet Generator (Req 3, 4)

**New AI endpoints** (Python FastAPI):

`POST /internal/suggest-activity`
```python
class SuggestActivityRequest(BaseModel):
    subject: str
    class_level: str   # "Play Group" | "Nursery" | "LKG" | "UKG"
    topic: str
    school_id: str
    section_id: str
```
Returns: `{ activities: [{ title, description, difficulty: "Simple"|"Standard"|"Extended" }] }` — minimum 2 items.

`POST /internal/generate-worksheet`
```python
class WorksheetRequest(BaseModel):
    subject: str
    topic: str
    class_level: str
    school_id: str
```
Returns: PDF bytes (application/pdf). Filename pattern enforced by the API gateway: `{class_level}-{subject}-{YYYY-MM-DD}.pdf`.

**API gateway proxy routes**:
- `POST /api/v1/teacher/suggestions` → proxies to `/internal/suggest-activity`
- `POST /api/v1/teacher/worksheet` → proxies to `/internal/generate-worksheet`, streams PDF response

Fallback: if AI service returns non-2xx or times out (5s for suggestions, 10s for worksheet), the gateway returns `{ error: "Oakie is unavailable right now. Try again shortly." }` with HTTP 503.

### 5. Student Observations (Req 5, 12)

**New table**: `student_observations` (migration 030)

```sql
CREATE TABLE student_observations (
  id uuid PRIMARY KEY DEFAULT g
# Design Document — Oakit UI Redesign

## Overview

This document specifies the technical design for a modern, premium UI/UX redesign of all four Oakit portals (Admin, Teacher, Principal, Parent). The redesign targets a clean, white-background aesthetic inspired by Notion, Linear, and Vercel — while preserving every existing API contract, data model, and business logic.

The implementation is purely a frontend concern: Tailwind CSS classes, shared React components, CSS variables, and layout structure. No new npm dependencies are introduced. All styling uses the existing Tailwind/Next.js stack, SVG, and CSS.

### Design Philosophy

- **Calm and focused**: White backgrounds, generous whitespace, subtle shadows — not loud or colourful
- **Consistent primitives**: Every portal shares the same Card, Button, Badge, Input, EmptyState, and SkeletonLoader components
- **Mobile-first**: Layouts are designed for 375px first, then enhanced for 1024px+
- **Meaningful feedback**: Every loading state, empty state, and error state is explicitly designed

---

## Architecture

The redesign touches three layers:

```
┌─────────────────────────────────────────────────────────┐
│  Design Tokens (tailwind.config.ts + globals.css)        │
│  Colours · Spacing · Typography · Shadows · Animations   │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  Shared Component Library (src/components/ui/)           │
│  Card · Button · Badge · Input · EmptyState · Skeleton   │
│  ProgressRing · StatCard · BottomNav · Sidebar           │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  Portal Layouts & Pages (src/app/{portal}/*)             │
│  AdminLayout · TeacherLayout · PrincipalLayout           │
│  ParentLayout · per-page components                      │
└─────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **No new dependencies**: All visual effects use Tailwind utilities, CSS custom properties, and inline SVG. No icon library, chart library, or animation library is added.

2. **Shared layout shell**: Each portal has a layout component (`AdminLayout`, `TeacherLayout`, etc.) that owns the sidebar/top-bar/bottom-nav chrome. Pages only render their content.

3. **Responsive strategy**: Sidebar on `lg:` (≥1024px), BottomNav on mobile. The breakpoint is consistent across all portals.

4. **Component-driven empty/loading states**: `EmptyState` and `SkeletonLoader` are generic components parameterised by shape, so every page uses the same visual language for these states.

---

## Components and Interfaces

### Design Token Extensions (tailwind.config.ts)

The existing config already defines the primary colour palette. The following additions are required:

```typescript
// Additional tokens needed
colors: {
  // Already present: primary, accent, neutral, surface, bg
  // Add explicit emerald alias for focus rings
  emerald: { 500: '#2E7D5E', 600: '#1A3C2E' }
}
animation: {
  'shimmer': 'shimmer 1.5s infinite',
  'fade-slide-up': 'fadeslideup 0.3s ease-out',
  'streak-pop': 'streakpop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
}
keyframes: {
  shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
  fadeslideup: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
  streakpop: { from: { opacity: '0', transform: 'scale(0.8)' }, to: { opacity: '1', transform: 'scale(1)' } },
}
```

### Shared Component Interfaces

#### `Card`
```typescript
interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  hover?: boolean;       // enables hover:shadow-md hover:-translate-y-0.5
  onClick?: () => void;
}
// Base classes: bg-white rounded-2xl border border-neutral-100 shadow-sm
// Hover classes: hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
```

#### `Button`
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'amber';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;     // shows inline SVG spinner, disables button, preserves dimensions
  children: ReactNode;
}
// Min touch target: min-h-[44px] min-w-[44px] on size md/lg
```

#### `Badge`
```typescript
interface BadgeProps {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'neutral' | 'info' | 'amber' | 'purple';
  dot?: boolean;
  size?: 'sm' | 'md';
}
// success: bg-emerald-50 text-emerald-700 border-emerald-200/80
// warning: bg-amber-50 text-amber-700 border-amber-200/80
// error:   bg-red-50 text-red-600 border-red-200/80
// neutral: bg-neutral-100 text-neutral-600 border-neutral-200/80
```

#### `Input`
```typescript
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;   // triggers border-red-400 + text-xs text-red-500 message below
  hint?: string;
  icon?: ReactNode;
}
// Base: rounded-xl border border-neutral-200 px-3 py-2 text-sm
// Focus: focus:ring-2 focus:ring-emerald-500/30 focus:border-primary-400
// Error: border-red-400 bg-red-50/30
```

#### `EmptyState` (new component)
```typescript
interface EmptyStateProps {
  emoji: string;           // large emoji or illustration
  heading: string;         // font-semibold text-neutral-700
  description?: string;    // text-sm text-neutral-400
  action?: { label: string; onClick: () => void };
}
```

#### `SkeletonLoader` (new component)
```typescript
interface SkeletonLoaderProps {
  variant: 'text' | 'card' | 'stat' | 'row' | 'circle';
  count?: number;          // number of skeleton rows/cards to render
  className?: string;
}
// Uses shimmer animation: bg-gradient shimmer class from globals.css
```

#### `StatCard` (new component)
```typescript
interface StatCardProps {
  label: string;
  value: string | number;
  loading?: boolean;       // shows SkeletonLoader instead of value
  colorScheme?: 'green' | 'blue' | 'amber' | 'red' | 'neutral';
  trend?: { direction: 'up' | 'down'; label: string };
}
```

#### `ProgressRing` (new component — SVG only)
```typescript
interface ProgressRingProps {
  pct: number;             // 0–100
  size?: number;           // SVG viewBox size, default 120
  strokeWidth?: number;    // default 12
  label?: string;          // centre label override
}
// Colour: pct >= 75 → #10b981 (green), 40–74 → #f59e0b (amber), <40 → #ef4444 (red)
```

#### `BottomNav` (new component)
```typescript
interface BottomNavProps {
  tabs: { id: string; icon: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
}
// Fixed bottom, bg-white border-t border-neutral-200
// Active: text-emerald-600 + small dot below icon
// pb-[calc(80px+env(safe-area-inset-bottom))] on page content
```

#### `Sidebar` (new generic component)
```typescript
interface SidebarProps {
  items: { href?: string; id?: string; label: string; icon: string }[];
  activeId: string;
  onItemClick?: (id: string) => void;
  header?: ReactNode;
  footer?: ReactNode;
}
// bg-[#1A3C2E] w-56 fixed left-0 top-0 h-full
// Active item: bg-white/15 text-white rounded-xl + accent dot
// Inactive: text-white/60 hover:bg-white/8 hover:text-white/90
// transition-colors duration-150 on all items
```

---

## Data Models

No new data models are introduced. The redesign consumes existing API response shapes unchanged. The following types are referenced in component props:

```typescript
// Already defined in portal pages — no changes needed
type AttendanceStatus = 'present' | 'absent' | 'late';
type CoverageBand = 'green' | 'amber' | 'red';
type BadgeVariant = 'success' | 'warning' | 'error' | 'neutral';
```

---

## Page-by-Page Layout Specifications

### Admin Portal

**Layout shell (`AdminLayout`)**
- Top bar: `h-14 bg-white border-b border-neutral-200 shadow-sm` — OakitLogo left, "Sign out" right
- Sidebar: `w-56 bg-[#1A3C2E]` fixed left, visible on `lg:` only
- Mobile: hamburger icon in top bar triggers slide-over drawer + semi-transparent backdrop (`bg-black/40`)
- Oakie mascot `32×32px` in sidebar header next to OakitLogo

**Admin Dashboard (`/admin`)**
```
┌─────────────────────────────────────────────────────┐
│  Page title + subtitle                               │
├──────────┬──────────┬──────────┬────────────────────┤
│ Students │ Present  │Attendance│ Plans completed    │  ← 4-col StatCard row (2×2 on mobile)
│  stat    │  today   │submitted │                    │
├──────────┴──────────┴──────────┴────────────────────┤
│  Curriculum Coverage bar chart (Card)                │
├─────────────────────────────────────────────────────┤
│  30-day Attendance Trend SVG polyline (Card)         │
├─────────────────────────────────────────────────────┤
│  Setup Checklist (amber Card, hidden when complete)  │
├──────────┬──────────┬──────────────────────────────┤
│ Users    │ Classes  │ Curriculum  (quick-links grid) │
│ Calendar │ Plans    │ Activities                    │
└──────────┴──────────┴──────────────────────────────┘
```

**Admin Forms & Lists**
- Validation: `border-red-400` on input + `text-xs text-red-500` below
- Success banner: `bg-green-50 border border-green-200 text-green-700` auto-dismisses 4s
- List items: Card with circular avatar (initials fallback), `font-semibold` name, `text-xs text-neutral-500` metadata, right-aligned action buttons
- Announcement cards: coloured left border (`border-l-4`), title `font-semibold`, body truncated 2 lines, relative timestamp Badge

---

### Teacher Portal

**Layout shell (`TeacherLayout`)**
- Top bar: `h-14 bg-white border-b border-neutral-200` — OakitLogo left, date label centre, "Sign out" right
- Desktop (≥1024px): Split panel — left `flex-1` (plan), right `w-96` (Oakie chat)
- Mobile (<1024px): BottomNav with tabs "Plan" | "Oakie" | "Help"
- Page content: `pb-[calc(80px+env(safe-area-inset-bottom))]`

**Teacher Dashboard (`/teacher`)**
```
Desktop:
┌──────────────────────────────┬──────────────────────┐
│  Daily Plan Panel            │  Oakie AI Chat Panel  │
│  ─ Attendance prompt (amber) │  ─ Chat header        │
│  ─ Activity rows (checkboxes)│    (Oakie 40×40px)    │
│  ─ Mark Complete button      │  ─ Message bubbles    │
│  ─ Tomorrow preview          │  ─ Input + send       │
└──────────────────────────────┴──────────────────────┘

Mobile (tabs):
┌─────────────────────────────────────────────────────┐
│  [Plan tab content] or [Oakie tab] or [Help tab]     │
└─────────────────────────────────────────────────────┘
│  Plan  │  Oakie  │  Help  │  ← BottomNav
```

- Activity rows: `min-h-[52px]` full-width tap target, circular checkbox, subject label, "Ask" button
- Checked state: `line-through opacity-70 text-emerald-700 bg-emerald-50/60`
- Streak celebration: full-width banner `bg-emerald-50 border-emerald-200`, streak count + badge emoji, auto-dismisses 3s

---

### Principal Portal

**Layout shell**
- Top bar: gradient `#1A3C2E → #2E7D5E`, OakitLogo `variant="light"`, principal name, "Sign out"
- Desktop: left main area `flex-1` + right Oakie chat panel `w-80`
- Mobile: Oakie chat as bottom sheet (slide-up from bottom)

**Principal Dashboard (`/principal`)**
```
┌─────────────────────────────────────────────────────┐
│  Summary StatCard row: Students | Present | Absent | │
│  Attendance ratio                                    │
├──────────┬──────────┬──────────────────────────────┤
│Attendance│ Teachers │ Curriculum Coverage (3-col)   │
├──────────┴──────────┴──────────────────────────────┤
│  Section cards grouped by class name                 │
│  Each: section label, teacher name, student count,   │
│  present/absent, attendance progress bar,            │
│  Badge: amber "Pending" or green "Submitted"         │
└─────────────────────────────────────────────────────┘
```

---

### Parent Portal

**Layout shell**
- Desktop (≥1024px): Sidebar `w-64 bg-[#1A3C2E]` with 6 nav items
- Mobile: BottomNav with 6 tabs (Home, Attendance, Progress, Oakie, Chat, Updates)
- Child-switcher chips: `overflow-x-auto` horizontal scroll, hidden scrollbar

**Parent Home (`/parent` — Home tab)**
```
┌──────────────────┬──────────────────────────────────┐
│ Attendance       │  Active Homework (full-width)     │
│ StatCard         ├──────────────────┬───────────────┤
├──────────────────┤  Learning Goals  │  Need Help?   │
│ Curriculum       │  (topics card)   │  CTA card     │
│ Progress         │                  │               │
└──────────────────┴──────────────────┴───────────────┘
```

- Attendance tab: 2-col stat grid + 60-day dot calendar (green/amber/red)
- Progress tab: ProgressRing (SVG) + milestones bar
- Oakie chat tab: full-height chat, dark green header, Oakie `48×48px` avatar + green online dot, emerald user bubbles / white AI bubbles, typing indicator (3 bouncing dots), optimistic message append
- Child-switcher: `overflow-x-auto pb-2 scrollbar-hide` horizontal chips

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Badge variant colour correctness

*For any* Badge component rendered with a valid variant prop (`success`, `warning`, `error`, `neutral`), the rendered output should contain the CSS classes corresponding to that variant's colour scheme (e.g., `success` → `bg-emerald-50 text-emerald-700`).

**Validates: Requirements 1.6**

---

### Property 2: Card hover classes applied

*For any* Card component rendered with `hover={true}`, the rendered output should contain `hover:shadow-md`, `hover:-translate-y-0.5`, and `transition-all duration-200` classes.

**Validates: Requirements 1.2, 10.1**

---

### Property 3: Active nav item highlight

*For any* sidebar or bottom nav rendered with a given active item ID, the element corresponding to that ID should contain the active highlight classes (`bg-white/15 text-white rounded-xl`) and the accent dot indicator, while all other items should not contain those classes.

**Validates: Requirements 2.3, 9.3**

---

### Property 4: Setup checklist conditional visibility

*For any* admin dashboard rendered with a `setupStatus` object, the setup checklist card should be visible if and only if `setupStatus.complete === false`.

**Validates: Requirements 3.6**

---

### Property 5: Input error state display

*For any* Input component rendered with a non-empty `error` prop, the rendered output should contain `border-red-400` on the input element and a `text-xs text-red-500` error message element below it.

**Validates: Requirements 4.1, 1.4**

---

### Property 6: List card completeness

*For any* student or user object rendered as a list card, the rendered output should contain: a circular avatar element (or initials fallback), the full name in `font-semibold`, supporting metadata in `text-xs text-neutral-500`, and at least one action button aligned to the right.

**Validates: Requirements 4.3**

---

### Property 7: Announcement card completeness

*For any* announcement object rendered as a card, the rendered output should contain: a coloured left border accent (`border-l-4`), the title in `font-semibold`, a body preview truncated to 2 lines, and a relative timestamp Badge.

**Validates: Requirements 4.5**

---

### Property 8: Plan activity row completeness and checked state

*For any* plan activity rendered as a row, the output should contain a circular checkbox, a subject label, and an "Ask" button. When the checkbox is checked, the subject label should have `line-through` applied and the row should have a green tint background.

**Validates: Requirements 5.6**

---

### Property 9: Attendance row completeness

*For any* student object rendered as an attendance row, the output should contain: a circular avatar, the student's name, the father's name, and exactly three toggle buttons (Present / Late / Absent) with colour-coded active states.

**Validates: Requirements 6.1**

---

### Property 10: Student card completeness

*For any* student object rendered as a student card, the output should contain: a circular avatar, the student's name, a class/section Badge, and action buttons for "Observations" and "Milestones".

**Validates: Requirements 6.3**

---

### Property 11: Resource card completeness

*For any* resource object rendered as a resource card, the output should contain: a file-type icon, the file name, the file size, the upload date, and a download button.

**Validates: Requirements 6.5**

---

### Property 12: Section card badge correctness

*For any* section object rendered as a section card, if `attendance_submitted` is `false` the card should display an amber "Pending" Badge; if `attendance_submitted` is `true` the card should display a green "Submitted" Badge and an attendance percentage progress bar.

**Validates: Requirements 7.2, 7.3, 7.4**

---

### Property 13: Child switcher triggers data reload

*For any* parent portal rendered with multiple children, switching the active child chip to a different child ID should trigger a data fetch for that child's feed, attendance, and progress data.

**Validates: Requirements 8.4**

---

### Property 14: Attendance dot colour coding

*For any* attendance record rendered as a dot in the 60-day calendar, the dot's colour class should match the record's status: `bg-emerald-100 text-emerald-700` for present, `bg-amber-100 text-amber-700` for late, `bg-red-100 text-red-600` for absent.

**Validates: Requirements 8.7**

---

### Property 15: Progress ring colour coding

*For any* ProgressRing rendered with a `pct` value, the SVG stroke colour should be `#10b981` (green) when `pct >= 75`, `#f59e0b` (amber) when `40 <= pct < 75`, and `#ef4444` (red) when `pct < 40`.

**Validates: Requirements 8.8**

---

### Property 16: Optimistic chat message append

*For any* chat message sent by the parent, the message should appear in the chat list immediately (before the API call resolves), with `role: 'user'` and the correct text content.

**Validates: Requirements 8.10**

---

### Property 17: Interactive element touch target size

*For any* interactive element (button, checkbox, nav item) rendered in the design system, the element's effective tap area should be at least 44×44px on mobile viewports.

**Validates: Requirements 9.1**

---

### Property 18: Activity row minimum height

*For any* plan activity row rendered in the Teacher Portal, the row's minimum height should be 52px and the tap target should span the full row width.

**Validates: Requirements 9.5**

---

### Property 19: EmptyState component completeness

*For any* EmptyState component rendered with valid props, the output should contain: a large emoji or illustration element, a heading in `font-semibold text-neutral-700`, a supporting description in `text-sm text-neutral-400`, and (when provided) a call-to-action Button.

**Validates: Requirements 11.1**

---

### Property 20: API error state includes retry button

*For any* component that renders an error state (triggered by a failed API call), the rendered output should contain an inline error message and a "Retry" button that re-triggers the failed request.

**Validates: Requirements 11.5**

---

### Property 21: Oakie mascot minimum render size

*For any* render of the Oakie mascot image (`/oakie.png`), the rendered `width` and `height` attributes should both be ≥ 24px.

**Validates: Requirements 12.4**

---

### Property 22: OakitLogo light variant on dark backgrounds

*For any* OakitLogo rendered inside a dark-background header or sidebar (`bg-[#1A3C2E]` or equivalent), the `variant` prop should be `"light"`.

**Validates: Requirements 12.5**

---

### Property 23: Nav item transition classes

*For any* navigation item rendered in a sidebar or BottomNav, the element should contain `transition-colors` and `duration-150` classes.

**Validates: Requirements 10.6**

---

## Error Handling

### API Failures
- Every data-fetching component wraps its `useEffect` in try/catch
- On failure: render an `EmptyState`-style inline error with a "Retry" button that re-calls the fetch function
- Pattern: `const [error, setError] = useState<string | null>(null)` — render `<ErrorState onRetry={load} />` when set

### Form Validation
- Client-side: Input `error` prop drives red border + message
- Server-side errors: displayed as a red banner above the form, auto-dismissed after 5s
- Success: green banner auto-dismissed after 4s

### Loading States
- Initial page load: SkeletonLoader matching the shape of expected content
- Subsequent fetches (e.g., child switch): spinner overlay on the affected card only
- Button actions: `loading` prop on Button — spinner inline, dimensions preserved

### Empty States
- Every list/data section has an explicit EmptyState defined
- EmptyState includes a contextual emoji, heading, description, and optional CTA
- Network error empty states include a "Retry" button

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:
- **Unit tests** verify specific examples, edge cases, and integration points
- **Property tests** verify universal properties across many generated inputs

### Unit Tests

Focus areas:
- Specific render examples (e.g., "AdminLayout renders top bar with logo and sign-out button")
- Conditional renders (e.g., "setup checklist hidden when complete=true")
- Integration points (e.g., "child switcher calls fetchChildData with correct ID")
- Edge cases (e.g., "EmptyState renders without optional action prop")

Recommended library: **React Testing Library** + **Vitest**

### Property-Based Tests

Each correctness property (P1–P23) must be implemented as a single property-based test.

Recommended library: **fast-check** (TypeScript-native, works with Vitest)

Configuration:
- Minimum **100 iterations** per property test
- Each test tagged with a comment referencing the design property

Tag format:
```typescript
// Feature: oakit-ui-redesign, Property N: <property_text>
```

Example property test structure:
```typescript
import fc from 'fast-check';
import { render } from '@testing-library/react';

// Feature: oakit-ui-redesign, Property 1: Badge variant colour correctness
it('Badge renders correct colour classes for any valid variant', () => {
  const variants = ['success', 'warning', 'error', 'neutral'] as const;
  fc.assert(
    fc.property(fc.constantFrom(...variants), fc.string({ minLength: 1 }), (variant, label) => {
      const { container } = render(<Badge variant={variant} label={label} />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain(variantClassMap[variant]);
    }),
    { numRuns: 100 }
  );
});
```

### Property Test Coverage Map

| Property | Component Under Test | Generator Strategy |
|----------|---------------------|-------------------|
| P1 | `Badge` | `fc.constantFrom(...variants)` |
| P2 | `Card` | `fc.boolean()` for hover prop |
| P3 | `Sidebar` / `BottomNav` | `fc.array(navItem)`, `fc.nat()` for active index |
| P4 | Admin Dashboard | `fc.record({ complete: fc.boolean(), ... })` |
| P5 | `Input` | `fc.string()` for error prop |
| P6 | Student list card | `fc.record({ name, metadata })` |
| P7 | Announcement card | `fc.record({ title, body, created_at })` |
| P8 | Plan activity row | `fc.record({ label, checked: fc.boolean() })` |
| P9 | Attendance row | `fc.record({ name, father_name })` |
| P10 | Student card | `fc.record({ name, class_name, section_label })` |
| P11 | Resource card | `fc.record({ file_name, file_size, created_at })` |
| P12 | Section card | `fc.record({ attendance_submitted: fc.boolean(), ... })` |
| P13 | Parent portal | `fc.array(child, { minLength: 2 })` |
| P14 | Attendance dot | `fc.constantFrom('present', 'late', 'absent')` |
| P15 | `ProgressRing` | `fc.integer({ min: 0, max: 100 })` |
| P16 | Parent chat | `fc.string({ minLength: 1 })` for message text |
| P17 | All interactive elements | `fc.constantFrom(...interactiveComponents)` |
| P18 | Activity row | `fc.record({ label: fc.string() })` |
| P19 | `EmptyState` | `fc.record({ emoji, heading, description? })` |
| P20 | Error state components | `fc.constantFrom(...errorStateComponents)` |
| P21 | Oakie mascot renders | `fc.constantFrom(...mascotSizes)` |
| P22 | `OakitLogo` | `fc.constantFrom('dark', 'light')` for background context |
| P23 | Nav items | `fc.array(navItem, { minLength: 1 })` |

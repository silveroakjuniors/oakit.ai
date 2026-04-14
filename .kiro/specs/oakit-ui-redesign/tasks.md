# Implementation Plan: Oakit UI Redesign

## Overview

Incremental frontend-only redesign of all four Oakit portals. Each task builds on the previous, starting with the shared design system and component library, then applying them portal by portal. No API contracts or data models change.

## Tasks

- [x] 1. Extend Tailwind config and global CSS with design tokens
  - Add emerald colour alias, shimmer/fade-slide-up/streak-pop animations and keyframes to `tailwind.config.js`
  - Add shimmer gradient utility and `scrollbar-hide` to `globals.css`
  - _Requirements: 1.1, 10.2_

- [x] 2. Build shared UI component library in `src/components/ui/`
  - [x] 2.1 Implement `Card` component
    - Base classes: `bg-white rounded-2xl border border-neutral-100 shadow-sm`
    - Support `padding`, `hover`, and `onClick` props
    - _Requirements: 1.2, 10.1_

  - [ ]* 2.2 Write property test for `Card` hover classes (Property 2)
    - **Property 2: Card hover classes applied**
    - **Validates: Requirements 1.2, 10.1**

  - [x] 2.3 Implement `Button` component
    - Variants: `primary`, `secondary`, `ghost`, `danger`, `amber`
    - `loading` prop: inline SVG spinner, disabled, dimensions preserved
    - Min touch target `min-h-[44px] min-w-[44px]` on `md`/`lg` sizes
    - _Requirements: 1.5, 9.1, 10.4_

  - [x] 2.4 Implement `Badge` component
    - Variants: `success`, `warning`, `error`, `neutral`, `info`, `amber`, `purple`
    - Support `dot` and `size` props
    - _Requirements: 1.6_

  - [ ]* 2.5 Write property test for `Badge` variant colour correctness (Property 1)
    - **Property 1: Badge variant colour correctness**
    - **Validates: Requirements 1.6**

  - [x] 2.6 Implement `Input` component
    - Base: `rounded-xl border border-neutral-200 px-3 py-2 text-sm`
    - Focus ring: `focus:ring-2 focus:ring-emerald-500/30`
    - `error` prop: `border-red-400` + `text-xs text-red-500` message below
    - _Requirements: 1.4, 4.1_

  - [ ]* 2.7 Write property test for `Input` error state display (Property 5)
    - **Property 5: Input error state display**
    - **Validates: Requirements 4.1, 1.4**

  - [x] 2.8 Implement `EmptyState` component
    - Props: `emoji`, `heading`, `description`, optional `action`
    - Heading: `font-semibold text-neutral-700`; description: `text-sm text-neutral-400`
    - _Requirements: 11.1_

  - [ ]* 2.9 Write property test for `EmptyState` completeness (Property 19)
    - **Property 19: EmptyState component completeness**
    - **Validates: Requirements 11.1**

  - [x] 2.10 Implement `SkeletonLoader` component
    - Variants: `text`, `card`, `stat`, `row`, `circle`
    - Uses shimmer animation from globals.css
    - _Requirements: 10.3_

  - [x] 2.11 Implement `StatCard` component
    - Props: `label`, `value`, `loading`, `colorScheme`, `trend`
    - Shows `SkeletonLoader` when `loading={true}`
    - _Requirements: 3.1, 3.2_

  - [x] 2.12 Implement `ProgressRing` component (SVG only)
    - Colour: green ≥75%, amber 40–74%, red <40%
    - Props: `pct`, `size`, `strokeWidth`, `label`
    - _Requirements: 8.8_

  - [ ]* 2.13 Write property test for `ProgressRing` colour coding (Property 15)
    - **Property 15: Progress ring colour coding**
    - **Validates: Requirements 8.8**

  - [x] 2.14 Implement `BottomNav` component
    - Fixed bottom, `bg-white border-t border-neutral-200`
    - Active tab: `text-emerald-600` + small dot below icon
    - `transition-colors duration-150` on all items
    - _Requirements: 9.2, 9.3_

  - [ ]* 2.15 Write property test for active nav item highlight (Property 3)
    - **Property 3: Active nav item highlight**
    - **Validates: Requirements 2.3, 9.3**

  - [ ]* 2.16 Write property test for nav item transition classes (Property 23)
    - **Property 23: Nav item transition classes**
    - **Validates: Requirements 10.6**

  - [x] 2.17 Implement `Sidebar` component
    - `bg-[#1A3C2E] w-56 fixed left-0 top-0 h-full`
    - Active item: `bg-white/15 text-white rounded-xl` + accent dot
    - `transition-colors duration-150` on all items
    - _Requirements: 2.2, 2.3, 10.6_

  - [ ]* 2.18 Write property test for interactive element touch target size (Property 17)
    - **Property 17: Interactive element touch target size**
    - **Validates: Requirements 9.1**

- [ ] 3. Checkpoint — Ensure all shared component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Admin Portal layout and navigation
  - [x] 4.1 Rewrite `AdminLayout` with new top bar and sidebar
    - Top bar: `h-14 bg-white border-b border-neutral-200 shadow-sm`, OakitLogo left, "Sign out" right
    - Sidebar: use `Sidebar` component, Oakie mascot `32×32px` in header
    - Mobile: hamburger triggers slide-over drawer + `bg-black/40` backdrop
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 12.1, 12.5_

  - [ ]* 4.2 Write property test for OakitLogo light variant on dark backgrounds (Property 22)
    - **Property 22: OakitLogo light variant on dark backgrounds**
    - **Validates: Requirements 12.5**

- [ ] 5. Implement Admin Dashboard bento grid
  - [x] 5.1 Rewrite `/admin/page.tsx` with bento grid layout
    - Four `StatCard` components in 2×2 mobile / 4-col desktop row
    - Curriculum coverage bar chart (SVG, inline) inside `Card` with green/amber/red legend
    - 30-day attendance trend SVG polyline (present/absent/late lines) inside `Card`
    - Setup checklist `Card` (amber) — visible only when `setupStatus.complete === false`
    - Quick-links 2-col (mobile) / 3-col (desktop) grid of `Card` components
    - `SkeletonLoader` placeholders while data loads; `EmptyState` when arrays are empty
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 5.2 Write property test for setup checklist conditional visibility (Property 4)
    - **Property 4: Setup checklist conditional visibility**
    - **Validates: Requirements 3.6**

- [ ] 6. Implement Admin Portal forms and list pages
  - [x] 6.1 Apply new design to admin list pages (students, users, classes, announcements)
    - List items as `Card` with circular avatar (initials fallback), `font-semibold` name, `text-xs text-neutral-500` metadata, right-aligned action buttons
    - `EmptyState` when list is empty with CTA button
    - Announcement cards: `border-l-4` accent, title `font-semibold`, body truncated 2 lines, relative timestamp `Badge`
    - _Requirements: 4.3, 4.4, 4.5_

  - [ ]* 6.2 Write property test for list card completeness (Property 6)
    - **Property 6: List card completeness**
    - **Validates: Requirements 4.3**

  - [ ]* 6.3 Write property test for announcement card completeness (Property 7)
    - **Property 7: Announcement card completeness**
    - **Validates: Requirements 4.5**

  - [ ] 6.4 Apply new design to admin form pages (settings, setup wizard, curriculum, plans)
    - Use `Input` component with `error` prop for validation
    - Success banner: `bg-green-50 border border-green-200 text-green-700` auto-dismisses 4s
    - `Button` with `loading` prop on submit
    - _Requirements: 4.1, 4.2, 1.5_

- [ ] 7. Checkpoint — Ensure all admin portal tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Teacher Portal layout and dashboard
  - [ ] 8.1 Rewrite `TeacherLayout` with split-panel desktop and BottomNav mobile
    - Top bar: `h-14`, OakitLogo left, date label centre, "Sign out" right
    - Desktop: left `flex-1` plan panel + right `w-96` Oakie chat panel
    - Mobile: `BottomNav` with "Plan" | "Oakie" | "Help" tabs
    - Page content: `pb-[calc(80px+env(safe-area-inset-bottom))]`
    - _Requirements: 5.1, 5.2, 5.3, 9.2, 12.1_

  - [ ] 8.2 Rewrite `/teacher/page.tsx` daily plan panel
    - Activity rows: `min-h-[52px]` full-width tap target, circular checkbox, subject label, "Ask Oakie" button
    - Checked state: `line-through opacity-70 text-emerald-700 bg-emerald-50/60`
    - `SkeletonLoader` (3 rows) while loading; `EmptyState` when no plan
    - "Mark Complete" button → streak celebration banner (auto-dismisses 3s)
    - _Requirements: 5.4, 5.5, 5.6, 5.7, 10.5_

  - [ ]* 8.3 Write property test for plan activity row completeness and checked state (Property 8)
    - **Property 8: Plan activity row completeness and checked state**
    - **Validates: Requirements 5.6**

  - [ ]* 8.4 Write property test for activity row minimum height (Property 18)
    - **Property 18: Activity row minimum height**
    - **Validates: Requirements 9.5**

- [ ] 9. Implement Teacher Portal — Attendance, Students, and Resources pages
  - [ ] 9.1 Rewrite `/teacher/attendance` page
    - Each student as row `Card`: avatar, name, father's name, three toggle buttons (Present/Late/Absent) with colour-coded active states
    - Read-only view with green "Submitted" banner when already submitted; disable all toggles
    - _Requirements: 6.1, 6.2_

  - [ ]* 9.2 Write property test for attendance row completeness (Property 9)
    - **Property 9: Attendance row completeness**
    - **Validates: Requirements 6.1**

  - [ ] 9.3 Rewrite `/teacher/students` page
    - Each student as `Card`: avatar, name, class/section `Badge`, "Observations" and "Milestones" action buttons
    - `EmptyState` inside student detail panel when no observations
    - _Requirements: 6.3, 6.4_

  - [ ]* 9.4 Write property test for student card completeness (Property 10)
    - **Property 10: Student card completeness**
    - **Validates: Requirements 6.3**

  - [ ] 9.5 Rewrite `/teacher/resources` page
    - Each resource as `Card`: file-type icon, file name, size, upload date, download button
    - `EmptyState` with upload prompt and dashed-border upload zone when empty
    - _Requirements: 6.5, 6.6_

  - [ ]* 9.6 Write property test for resource card completeness (Property 11)
    - **Property 11: Resource card completeness**
    - **Validates: Requirements 6.5**

- [ ] 10. Checkpoint — Ensure all teacher portal tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement Principal Portal layout and dashboard
  - [ ] 11.1 Rewrite Principal layout shell
    - Top bar: gradient `#1A3C2E → #2E7D5E`, OakitLogo `variant="light"`, principal name, "Sign out"
    - Desktop: main area `flex-1` + right Oakie chat panel `w-80`
    - Mobile: Oakie chat as bottom sheet (slide-up)
    - `SkeletonLoader` for summary row and section cards while loading
    - _Requirements: 7.5, 7.6, 12.1, 12.5_

  - [-] 11.2 Rewrite `/principal/page.tsx` dashboard
    - Summary `StatCard` row: total students, present, absent, attendance ratio
    - Quick-nav 3-col grid: Attendance, Teachers, Curriculum Coverage
    - Section cards grouped by class: section label, teacher name, student count, present/absent counts, attendance progress bar, amber "Pending" or green "Submitted" `Badge`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.7_

  - [ ]* 11.3 Write property test for section card badge correctness (Property 12)
    - **Property 12: Section card badge correctness**
    - **Validates: Requirements 7.2, 7.3, 7.4**

- [ ] 12. Implement Parent Portal layout and all tabs
  - [ ] 12.1 Rewrite Parent layout shell
    - Desktop: `Sidebar` `w-64 bg-[#1A3C2E]` with 6 nav items
    - Mobile: `BottomNav` with 6 tabs (Home, Attendance, Progress, Oakie, Chat, Updates)
    - Child-switcher chips: `overflow-x-auto pb-2 scrollbar-hide` horizontal scroll in header
    - _Requirements: 8.2, 8.3, 8.4, 9.6, 12.1_

  - [ ]* 12.2 Write property test for child switcher triggers data reload (Property 13)
    - **Property 13: Child switcher triggers data reload**
    - **Validates: Requirements 8.4**

  - [ ] 12.3 Rewrite `/parent/page.tsx` Home tab bento grid
    - Attendance `StatCard` top-left, curriculum progress `StatCard` bottom-left
    - Full-width homework card top-right, topics card middle-right, "Need Help?" CTA card bottom-right
    - `SkeletonLoader` while loading; `EmptyState` ("No pending homework — great job!") when no homework
    - _Requirements: 8.1, 8.5, 8.6_

  - [ ] 12.4 Implement Parent Attendance tab
    - 2-col stat grid (attendance % and punctuality %)
    - 60-day dot calendar: green (present), amber (late), red (absent)
    - `EmptyState` ("Attendance records will appear here once the school year begins.") when no records
    - _Requirements: 8.7, 11.3_

  - [ ]* 12.5 Write property test for attendance dot colour coding (Property 14)
    - **Property 14: Attendance dot colour coding**
    - **Validates: Requirements 8.7**

  - [ ] 12.6 Implement Parent Progress tab
    - `ProgressRing` SVG showing curriculum coverage percentage
    - Milestones bar below the ring
    - _Requirements: 8.8_

  - [ ] 12.7 Implement Parent Oakie chat tab
    - Full-height chat, dark green header, Oakie `48×48px` avatar + green online dot
    - User bubbles: emerald; AI bubbles: white
    - Typing indicator: 3 bouncing dots
    - Optimistic message append on send (before API response)
    - _Requirements: 8.9, 8.10, 12.3_

  - [ ]* 12.8 Write property test for optimistic chat message append (Property 16)
    - **Property 16: Optimistic chat message append**
    - **Validates: Requirements 8.10**

- [ ] 13. Implement error states with Retry button across all portals
  - Add `ErrorState` inline component (or extend `EmptyState`) with a "Retry" button
  - Wrap all `useEffect` data fetches in try/catch; render `ErrorState` on failure
  - _Requirements: 11.5_

  - [ ]* 13.1 Write property test for API error state includes retry button (Property 20)
    - **Property 20: API error state includes retry button**
    - **Validates: Requirements 11.5**

- [ ] 14. Validate Oakie mascot and OakitLogo usage across all portals
  - [ ] 14.1 Audit all Oakie mascot renders — ensure no render below 24×24px
    - Teacher chat header: `40×40px`; Parent chat header: `48×48px` with green online dot
    - Admin sidebar: `32×32px`
    - _Requirements: 12.2, 12.3, 12.4_

  - [ ]* 14.2 Write property test for Oakie mascot minimum render size (Property 21)
    - **Property 21: Oakie mascot minimum render size**
    - **Validates: Requirements 12.4**

- [ ] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use **fast-check** with a minimum of 100 iterations per test
- Unit tests use **React Testing Library** + **Vitest**
- Tag format for property tests: `// Feature: oakit-ui-redesign, Property N: <property_text>`
- No new npm dependencies are introduced — all styling uses Tailwind, CSS custom properties, and inline SVG

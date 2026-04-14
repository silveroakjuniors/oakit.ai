# Requirements Document

## Introduction

A modern, premium UI/UX redesign of the entire Oakit platform covering all four portals: Admin, Teacher, Principal, and Parent. The current design uses a dark green sidebar with basic cards. The redesign targets a clean, white-background aesthetic inspired by tools like Notion, Linear, Vercel, and SchoolAI — with a consistent design system, rich data visualisation, mobile-first layouts, micro-interactions, meaningful empty states, and tasteful Oakit branding throughout.

The redesign is purely a frontend concern: all existing API contracts, data models, and business logic remain unchanged. Only the visual layer (components, layouts, CSS, Tailwind classes) is modified.

---

## Glossary

- **Design_System**: The shared set of Tailwind tokens, CSS variables, component primitives (Card, Button, Badge, Input), and typography scale used across all portals.
- **Admin_Portal**: The Next.js pages under `/admin/*` used by school administrators.
- **Teacher_Portal**: The Next.js pages under `/teacher/*` used by classroom teachers.
- **Principal_Portal**: The Next.js pages under `/principal/*` used by school principals.
- **Parent_Portal**: The Next.js pages under `/parent/*` used by parents/guardians.
- **Bento_Grid**: A CSS grid layout where stat cards and content blocks are arranged in a magazine-style mosaic.
- **Bottom_Nav**: A fixed bottom navigation bar used on mobile viewports (< lg breakpoint).
- **Sidebar**: A fixed left-side navigation panel used on desktop viewports (≥ lg breakpoint).
- **Skeleton_Loader**: A shimmer placeholder element shown while data is being fetched.
- **Empty_State**: A full-area illustration + message shown when a list or data section has no content.
- **Oakie**: The Oakit AI mascot (oak tree character) used in branding and chat interfaces.
- **Progress_Ring**: An SVG circular progress indicator used to display percentage values.
- **Stat_Card**: A compact card displaying a single metric with label, value, and optional trend indicator.
- **Split_Panel**: A two-column layout where the left panel shows the daily plan and the right panel shows the Oakie AI chat.

---

## Requirements

### Requirement 1: Unified Design System Tokens

**User Story:** As a developer, I want a single source of truth for colours, spacing, typography, and component styles, so that all portals look and feel consistent without duplicating CSS.

#### Acceptance Criteria

1. THE Design_System SHALL define a primary colour of `#1A3C2E`, an accent emerald of `#2E7D5E`, and a neutral grey scale from `#F8FAFC` (background) to `#1C1917` (text) as Tailwind CSS custom tokens in `tailwind.config.js`.
2. THE Design_System SHALL define a single card style: white background, `rounded-2xl` border radius, `border border-neutral-100`, and `shadow-sm` — applied via a shared `Card` component.
3. THE Design_System SHALL define a typography scale: `text-2xl font-bold` for page titles, `text-sm font-semibold` for section headings, `text-xs text-neutral-500` for supporting labels.
4. THE Design_System SHALL define consistent input styles: `rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/30` applied via the shared `Input` component.
5. WHEN a button is in a loading state, THE Design_System SHALL display an inline spinner and disable pointer events without changing the button's dimensions.
6. THE Design_System SHALL export a `Badge` component supporting `success` (green), `warning` (amber), `error` (red), and `neutral` (grey) variants with consistent padding and font weight.

---

### Requirement 2: Admin Portal — Layout and Navigation

**User Story:** As an admin, I want a clean top bar and sidebar navigation, so that I can move between sections quickly on both desktop and mobile.

#### Acceptance Criteria

1. THE Admin_Portal SHALL render a fixed top bar (height 56px) containing the Oakit logo on the left and a "Sign out" button on the right, with a `border-b border-neutral-200 bg-white shadow-sm` style.
2. THE Admin_Portal SHALL render a fixed left sidebar (width 224px) on viewports ≥ 1024px, using `bg-[#1A3C2E]` background with white navigation items.
3. WHEN a sidebar navigation item is active, THE Admin_Portal SHALL highlight it with `bg-white/15 text-white rounded-xl` and show a small emerald dot indicator on the right.
4. THE Admin_Portal SHALL collapse the sidebar into a slide-over drawer on viewports < 1024px, triggered by a hamburger icon in the top bar.
5. WHEN the sidebar drawer is open on mobile, THE Admin_Portal SHALL render a semi-transparent backdrop overlay behind the drawer.
6. THE Admin_Portal SHALL display the Oakie mascot image in the sidebar header area at 32×32px.

---

### Requirement 3: Admin Dashboard — Bento Grid Layout

**User Story:** As an admin, I want a bento-grid dashboard with live stats, coverage chart, and attendance trend, so that I can see the school's health at a glance.

#### Acceptance Criteria

1. THE Admin_Portal SHALL render today's snapshot as four Stat_Cards in a 2×2 grid on mobile and a 4-column row on desktop, showing: total students, students present today, attendance submitted (x/total sections), and plans completed (x/total sections).
2. WHEN attendance or plan data is loading, THE Admin_Portal SHALL display Skeleton_Loader placeholders in each Stat_Card slot.
3. THE Admin_Portal SHALL render the curriculum coverage bar chart inside a Card with a labelled legend showing green (≥75%), amber (40–74%), and red (<40%) bands.
4. THE Admin_Portal SHALL render the 30-day attendance trend as an SVG polyline chart with present (green), absent (red), and late (amber dashed) lines inside a Card.
5. WHEN the coverage or trend arrays are empty, THE Admin_Portal SHALL display an Empty_State message ("No data yet — check back after teachers submit attendance") instead of a blank chart area.
6. THE Admin_Portal SHALL render the setup checklist card only when `setupStatus.complete === false`, and hide it once all steps are complete.
7. THE Admin_Portal SHALL render the quick-links grid as a 2-column (mobile) / 3-column (desktop) grid of Cards, each showing an icon, label, description, and live stat count.

---

### Requirement 4: Admin Portal — Forms and Lists

**User Story:** As an admin, I want consistent form inputs and list cards across all admin pages, so that data entry feels polished and errors are clearly communicated.

#### Acceptance Criteria

1. WHEN a form field fails validation, THE Admin_Portal SHALL display a red border (`border-red-400`) on the input and a `text-xs text-red-500` error message below it.
2. WHEN a form is submitted successfully, THE Admin_Portal SHALL display a green success banner (`bg-green-50 border border-green-200 text-green-700`) that auto-dismisses after 4 seconds.
3. THE Admin_Portal SHALL render student and user list items as Cards with: a circular avatar (initials fallback), full name in `font-semibold`, supporting metadata in `text-xs text-neutral-500`, and action buttons aligned to the right.
4. WHEN a list has no items, THE Admin_Portal SHALL display an Empty_State with a relevant icon and a call-to-action button (e.g., "Add your first student").
5. THE Admin_Portal SHALL render announcement cards with a coloured left border accent, title in `font-semibold`, body preview truncated to 2 lines, and a relative timestamp badge.

---

### Requirement 5: Teacher Portal — Split-Panel Layout

**User Story:** As a teacher, I want a split-panel view with my daily plan on the left and Oakie AI on the right on desktop, and tab-based navigation on mobile, so that I can reference my plan while chatting with Oakie.

#### Acceptance Criteria

1. ON viewports ≥ 1024px, THE Teacher_Portal SHALL render a two-column Split_Panel: left panel (flex: 1) showing the daily plan, right panel (width 384px) showing the Oakie AI chat.
2. ON viewports < 1024px, THE Teacher_Portal SHALL render a tab bar with three tabs — "Plan", "Oakie", "Help" — as a Bottom_Nav fixed to the bottom of the screen.
3. THE Teacher_Portal SHALL render a fixed top bar (height 56px) with the Oakit logo, today's date label, and a "Sign out" button.
4. WHEN the daily plan is loading, THE Teacher_Portal SHALL display three Skeleton_Loader rows in the plan panel.
5. WHEN the plan has no chunks (e.g., holiday or settling day), THE Teacher_Portal SHALL display an Empty_State card with the special day label and a friendly message.
6. THE Teacher_Portal SHALL render each plan activity as a tappable row with a circular checkbox, subject label, and an "Ask Oakie" button — with a strikethrough and green tint when checked.
7. WHEN all activities are checked and the teacher taps "Mark Complete", THE Teacher_Portal SHALL display a full-width success banner with a streak badge if the streak count increased.

---

### Requirement 6: Teacher Portal — Attendance, Students, and Resources Pages

**User Story:** As a teacher, I want consistent card-based layouts on the attendance, students, and resources pages, so that all pages feel part of the same product.

#### Acceptance Criteria

1. THE Teacher_Portal attendance page SHALL render each student as a row Card with avatar, name, father's name, and three toggle buttons (Present / Late / Absent) using colour-coded active states.
2. WHEN attendance has already been submitted for today, THE Teacher_Portal SHALL display a read-only view with a green "Submitted" banner and disable all toggle buttons.
3. THE Teacher_Portal students page SHALL render each student as a Card with avatar, name, class/section badge, and quick-action buttons for "Observations" and "Milestones".
4. WHEN a student has no observations, THE Teacher_Portal SHALL display an Empty_State inside the student detail panel with a prompt to add the first observation.
5. THE Teacher_Portal resources page SHALL render uploaded resources as Cards with file-type icon, file name, size, upload date, and a download button.
6. WHEN the resources list is empty, THE Teacher_Portal SHALL display an Empty_State with an upload prompt and a dashed-border upload zone.

---

### Requirement 7: Principal Portal — Data-Rich Dashboard

**User Story:** As a principal, I want a data-rich dashboard with teacher engagement metrics and section-level attendance, so that I can identify issues without drilling into individual pages.

#### Acceptance Criteria

1. THE Principal_Portal SHALL render a school-wide summary row of Stat_Cards showing: total students, present today, absent today, and attendance submission ratio (x/total sections).
2. THE Principal_Portal SHALL render section cards grouped by class name, each showing: section label, class teacher name (or "No teacher assigned" warning), student count, present/absent counts, and an attendance progress bar.
3. WHEN a section has not submitted attendance, THE Principal_Portal SHALL display an amber "Pending" badge on that section card.
4. WHEN a section has submitted attendance, THE Principal_Portal SHALL display a green "Submitted" badge and show the attendance percentage bar.
5. THE Principal_Portal SHALL render the Oakie AI chat panel as a right-side panel (width 320px) on desktop and as a bottom sheet on mobile.
6. WHEN the principal's context data is loading, THE Principal_Portal SHALL display Skeleton_Loader placeholders for the summary row and section cards.
7. THE Principal_Portal SHALL render quick-navigation cards for "Attendance", "Teachers", and "Curriculum Coverage" in a 3-column grid below the summary row.

---

### Requirement 8: Parent Portal — Card-Based Home and Navigation

**User Story:** As a parent, I want a card-based home screen with homework, topics, and notes prominently displayed, and working tab navigation, so that I can quickly check on my child's school day.

#### Acceptance Criteria

1. THE Parent_Portal SHALL render a bento-grid home tab with: an attendance Stat_Card (top-left), a curriculum progress Stat_Card (bottom-left), a full-width homework card (top-right), a topics card (middle-right), and a "Need Help?" CTA card (bottom-right).
2. THE Parent_Portal SHALL render a Bottom_Nav on viewports < 1024px with six tabs: Home, Attendance, Progress, Oakie, Chat, Updates — each with an icon and label.
3. THE Parent_Portal SHALL render a left Sidebar on viewports ≥ 1024px with the same six navigation items using `bg-[#1A3C2E]` background.
4. WHEN a parent has multiple children, THE Parent_Portal SHALL render child-switcher chips in the header, and switching chips SHALL reload the active child's data.
5. WHEN the active child's feed is loading, THE Parent_Portal SHALL display Skeleton_Loader placeholders in the homework and topics cards.
6. WHEN the active child has no homework, THE Parent_Portal SHALL display an Empty_State message ("No pending homework — great job!") in the homework card instead of a blank area.
7. THE Parent_Portal attendance tab SHALL render a 2-column stat grid (attendance % and punctuality %) and a calendar-style dot grid for the last 60 days with colour coding: green (present), amber (late), red (absent).
8. THE Parent_Portal progress tab SHALL render a Progress_Ring showing curriculum coverage percentage, with colour coding: green (≥75%), amber (40–74%), red (<40%).
9. THE Parent_Portal Oakie chat tab SHALL render a full-height chat interface with a dark green header, message bubbles (user: emerald, AI: white), a typing indicator, and a text input with send button.
10. WHEN the parent sends a chat message, THE Parent_Portal SHALL optimistically append the user message to the chat list before the API response arrives.

---

### Requirement 9: Mobile-First Responsive Behaviour

**User Story:** As a user on a mobile device, I want all pages to be fully usable on a small screen with touch-friendly targets, so that I can use Oakit on my phone without frustration.

#### Acceptance Criteria

1. THE Design_System SHALL ensure all interactive elements (buttons, checkboxes, nav items) have a minimum touch target of 44×44px on mobile viewports.
2. THE Design_System SHALL use `pb-[calc(80px+env(safe-area-inset-bottom))]` bottom padding on scrollable page content to prevent the Bottom_Nav from obscuring content on iOS devices.
3. WHEN a Bottom_Nav tab is active, THE Design_System SHALL highlight it with `text-emerald-600` and a small dot indicator below the icon.
4. THE Admin_Portal SHALL use a full-width single-column layout for all cards and lists on viewports < 640px.
5. THE Teacher_Portal plan activity rows SHALL have a minimum height of 52px and a tap target spanning the full row width on mobile.
6. THE Parent_Portal child-switcher chips SHALL be horizontally scrollable on mobile with `overflow-x-auto` and hidden scrollbar.

---

### Requirement 10: Micro-Interactions and Loading States

**User Story:** As a user, I want smooth transitions, hover states, and loading feedback, so that the app feels responsive and polished.

#### Acceptance Criteria

1. WHEN a Card has `hover` prop enabled, THE Design_System SHALL apply `hover:shadow-md hover:-translate-y-0.5 transition-all duration-200` on mouse enter.
2. WHEN a page tab changes, THE Design_System SHALL apply a `fade-in slide-in-from-bottom-2 duration-300` animation to the incoming content.
3. WHEN data is being fetched on initial page load, THE Design_System SHALL display Skeleton_Loader shimmer placeholders matching the shape of the expected content.
4. WHEN a form submit button is clicked, THE Design_System SHALL immediately show a spinner inside the button and prevent double-submission.
5. WHEN a streak milestone is reached after marking a plan complete, THE Teacher_Portal SHALL display a celebratory banner with the streak count and badge emoji for 3 seconds before auto-dismissing.
6. THE Design_System SHALL apply `transition-colors duration-150` to all navigation items so hover and active state changes are smooth.

---

### Requirement 11: Empty States

**User Story:** As a user, I want meaningful empty state messages instead of blank pages, so that I understand what to do next when there is no data.

#### Acceptance Criteria

1. WHEN a list page has no items, THE Design_System SHALL render an Empty_State component with: a large emoji or illustration, a heading in `font-semibold text-neutral-700`, a supporting description in `text-sm text-neutral-400`, and an optional call-to-action Button.
2. WHEN the teacher has no plan for today (e.g., weekend or unplanned date), THE Teacher_Portal SHALL display an Empty_State with the message "No plan for today" and a link to contact the admin.
3. WHEN the parent's child has no attendance records, THE Parent_Portal SHALL display an Empty_State with the message "Attendance records will appear here once the school year begins."
4. WHEN the principal has no sections configured, THE Principal_Portal SHALL display an Empty_State with the message "No sections found — ask your admin to set up classes."
5. IF an API call fails with a network error, THEN THE Design_System SHALL display an inline error state with a "Retry" button rather than leaving the section blank.

---

### Requirement 12: Branding — Oakit Logo and Oakie Mascot

**User Story:** As a product owner, I want the Oakit logo and Oakie mascot used consistently and tastefully across all portals, so that the brand identity is reinforced without being intrusive.

#### Acceptance Criteria

1. THE Design_System SHALL render the Oakit wordmark logo via the existing `OakitLogo` component in the sidebar header of Admin_Portal and Parent_Portal, and in the top bar of Teacher_Portal and Principal_Portal.
2. THE Teacher_Portal Oakie chat panel SHALL display the Oakie mascot image (`/oakie.png`) as a 40×40px rounded avatar in the chat header.
3. THE Parent_Portal Oakie chat tab SHALL display the Oakie mascot as a 48×48px rounded avatar in the chat header with a green online indicator dot.
4. THE Design_System SHALL NOT render the Oakie mascot image at sizes smaller than 24×24px to preserve legibility.
5. WHERE the portal uses a dark background header, THE Design_System SHALL use the `variant="light"` prop on `OakitLogo` to render the white version of the wordmark.

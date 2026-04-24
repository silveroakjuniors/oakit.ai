# Requirements Document

## Introduction

Oakit is a school management platform serving four distinct user groups: parents, teachers, principals, and admins. The current UI has a solid foundation — design tokens, dark/light mode, and a UIComponents library — but lacks the polish, animation depth, and emotional resonance needed for a best-in-class children's education platform.

This spec defines a full design system overhaul inspired by warm, playful children's education UI patterns (reference: the attached design images). The new direction replaces the current neutral/corporate aesthetic with:

- **Oakit colour palette** — deep forest green (`#0a1f14`) as the primary brand, with lighter greens (`#2d6a4f`, `#52b788`) for gradients and accents, warm cream (`#fdf8f0`) as the page background, and vibrant subject-tile colours (teal, amber, purple, coral, blue) for activity cards
- **Oakie mascot** — the Oakie character (tree/nature themed) replaces any generic illustrations; appears as a floating hero illustration in headers, as the chat avatar in the AI panel, and as a celebration animation on completion
- **Warm rounded cards** — all surfaces use `border-radius: 20–24px`, soft drop shadows, and the cream background instead of stark white
- **Colourful subject tiles** — each subject/activity (English, Math, Circle Time, Art, GK, etc.) gets a distinct vibrant colour tile with a white icon, matching the second reference image's grid layout
- **Subtle animations** — a soft green glow pulse on the Oakie avatar, floating particle effects on the header, and spring-based card entrance animations
- **Typography** — friendly rounded font feel; headings use the brand green, body uses warm neutral-800

The work covers 10 core reusable components and the redesign of all 4 portals using those components. The teacher module is the primary focus and reference implementation; the same design language then extends to parent, principal, and admin portals.

The tech stack is Next.js 14, React 18, TypeScript, Tailwind CSS, framer-motion, and lucide-react. Three libraries need to be added: Radix UI (headless primitives), shadcn/ui (accessible pre-built components), and Zustand (global state management).

---

## Glossary

- **Design_System**: The complete set of components, tokens, patterns, and guidelines defined in this spec
- **UIComponents**: The existing component library at `oakit/apps/frontend/src/UIComponents/`
- **Component**: A reusable React/TypeScript UI element exported from UIComponents
- **Portal**: One of the four role-specific views — Parent Portal, Teacher Dashboard, Principal Dashboard, Admin Panel
- **Micro_Animation**: A Framer Motion animation applied to an interactive element (press, hover, mount, exit)
- **Dark_Mode**: The `.dark` CSS class applied to the root element, toggling CSS custom properties
- **Design_Token**: A CSS custom property or Tailwind class that encodes a design decision (color, spacing, radius, shadow)
- **Streak**: A consecutive-day activity counter displayed on the Teacher Dashboard
- **XP**: Experience points earned by teachers for completing daily plans, displayed as a numeric badge
- **Radix_UI**: The `@radix-ui/*` family of headless, accessible React primitives
- **shadcn_ui**: Pre-built accessible components built on Radix UI, installed via the shadcn CLI
- **Zustand**: A lightweight React state management library used for global UI state (toasts, modals, theme)
- **Bottom_Sheet**: A mobile-first modal variant that slides up from the bottom of the screen
- **Activity_Step**: A single step in an Uber-style guided flow with a status of pending, active, or done
- **Timeline_Item**: A chronological entry card showing an avatar, date, and content block
- **Hero_Card**: The prominent top card on the Parent Portal featuring an animated ring around the child's avatar
- **Animated_Ring**: A conic-gradient rotating border animation around an avatar, indicating live/active status
- **Subject_Tile**: A colourful rounded card representing a single subject/activity, with a white icon and label, used in the Teacher Dashboard plan view
- **Oakie_Avatar**: The Oakie mascot character used as the AI chat avatar, hero illustration, and celebration graphic
- **Cream_Surface**: The warm off-white background colour (`#fdf8f0`) used as the page-level background across all portals
- **Glow_Pulse**: A soft green radial glow animation applied to the Oakie avatar and active status indicators

---

## Requirements

---

### Requirement 1: Dependency Installation

**User Story:** As a developer, I want the three missing libraries installed and configured, so that I can build accessible, animated components without reinventing primitives.

#### Acceptance Criteria

1. THE Design_System SHALL declare `@radix-ui/react-dialog`, `@radix-ui/react-toast`, `@radix-ui/react-avatar`, `@radix-ui/react-progress`, and `@radix-ui/react-slot` as dependencies in `package.json`
2. THE Design_System SHALL declare `shadcn/ui` components as dependencies, initialized via `npx shadcn@latest init` targeting the existing Tailwind config
3. THE Design_System SHALL declare `zustand` as a dependency in `package.json`
4. WHEN the dependencies are installed, THE Design_System SHALL not introduce breaking changes to existing component imports from `@/UIComponents`
5. THE Design_System SHALL configure shadcn/ui to use the existing CSS custom properties (`--brand-primary`, `--bg-elevated`, `--border`, etc.) as its theme variables

---

### Requirement 2: Design Token Update — Oakit Colour Palette

**User Story:** As a developer, I want the design tokens updated to reflect the new Oakit colour palette, so that all components automatically adopt the warm, nature-inspired visual language.

#### Acceptance Criteria

1. THE Design_System SHALL update `globals.css` to define the following new tokens:
   - `--cream-bg: #fdf8f0` — warm page background
   - `--brand-green-deep: #0a1f14` — header/hero gradient start
   - `--brand-green-mid: #1a3c2e` — header gradient mid
   - `--brand-green-light: #2d6a4f` — header gradient end / accent
   - `--brand-green-soft: #52b788` — interactive highlights, progress fills
   - `--brand-green-pale: #d8f3dc` — light tint backgrounds
   - `--subject-teal: #00b4a6` — Circle Time, Morning Meet tiles
   - `--subject-amber: #f59e0b` — Math, GK tiles
   - `--subject-purple: #7c3aed` — English Speaking, Music tiles
   - `--subject-coral: #f97316` — Art, Drawing tiles
   - `--subject-blue: #3b82f6` — English, Writing tiles
   - `--subject-pink: #ec4899` — Regional Language, Hindi tiles
2. THE Design_System SHALL update `--brand-primary` to `#2d6a4f` (brand-green-light) as the primary interactive colour
3. THE Design_System SHALL set the default page background to `var(--cream-bg)` in the root `body` styles
4. THE Design_System SHALL define a `--header-gradient` CSS variable: `linear-gradient(135deg, #0a1f14 0%, #1a3c2e 60%, #2d6a4f 100%)`
5. WHEN dark mode is active, THE Design_System SHALL keep `--cream-bg` as `#1a1a1a` and adjust all surface tokens accordingly

---

### Requirement 3: Subject Tile Component

**User Story:** As a teacher, I want each subject/activity displayed as a colourful tile with an icon, so that I can scan today's plan at a glance like a visual grid.

#### Acceptance Criteria

1. THE Subject_Tile SHALL render as a rounded card (`border-radius: 20px`) with a solid background colour from the subject colour map
2. THE Subject_Tile SHALL accept a `subject` prop (e.g. `"english"`, `"math"`, `"circle_time"`) and automatically apply the correct `--subject-*` colour token
3. THE Subject_Tile SHALL render a white lucide-react icon centred in the upper portion of the tile
4. THE Subject_Tile SHALL render the subject label in white, bold, centred at the bottom of the tile
5. THE Subject_Tile SHALL support sizes: `sm` (80×80px), `md` (100×100px), `lg` (120×120px)
6. WHEN the Subject_Tile is pressed, THE Subject_Tile SHALL apply a Framer Motion `whileTap` scale of 0.94 and a `whileHover` scale of 1.04
7. THE Subject_Tile SHALL accept an `onClick` prop and a `completed` boolean prop; WHEN `completed` is `true`, THE Subject_Tile SHALL render a green checkmark overlay at 60% opacity
8. THE Subject_Tile SHALL accept a `videoId` prop; WHEN provided, a small YouTube icon button SHALL appear in the top-right corner of the tile
9. THE Subject_Tile SHALL animate in on mount using a Framer Motion `scaleIn` with a stagger delay based on its index

---

### Requirement 4: Card Component

**User Story:** As a developer, I want a warm rounded Card component, so that I can create elevated surfaces that feel consistent with the new Oakit aesthetic.

#### Acceptance Criteria

1. THE Card SHALL render a surface using `var(--bg-elevated)` as its background color with `border-radius: 20px`
2. THE Card SHALL apply `var(--border)` as its border color in both light and dark mode
3. THE Card SHALL support padding variants: `none`, `xs` (12px), `sm` (16px), `md` (20px), `lg` (28px)
4. THE Card SHALL support an `elevated` boolean prop that applies a warm shadow: `0 4px 24px rgba(10,31,20,0.08)`
5. WHEN the Card receives an `onClick` prop, THE Card SHALL apply a Framer Motion `whileHover` that translates Y by -2px and `whileTap` that scales to 0.98
6. THE Card SHALL accept a `glow` boolean prop that applies a soft green border glow on hover using `--brand-green-soft`
7. THE Card SHALL accept a `cream` boolean prop that uses `var(--cream-bg)` as the background instead of `var(--bg-elevated)`
8. THE Card SHALL accept a `className` prop for additional Tailwind overrides

---

### Requirement 5: Button Component

**User Story:** As a developer, I want a Button component with full variant coverage and Framer Motion press feedback, so that every interactive action feels responsive and polished.

#### Acceptance Criteria

1. THE Button SHALL support variants: `primary`, `secondary`, `ghost`, `destructive`, `success`
2. THE Button SHALL support sizes: `xs`, `sm`, `md`, `lg`
3. WHEN the Button `loading` prop is `true`, THE Button SHALL render a spinning Framer Motion animated SVG icon and disable the button
4. WHEN the Button is pressed, THE Button SHALL apply a Framer Motion `whileTap` scale of 0.96
5. WHEN the Button is hovered, THE Button SHALL apply a Framer Motion `whileHover` scale of 1.02
6. THE Button SHALL accept `icon` and `iconPosition` (`left` | `right`) props
7. THE Button SHALL accept a `fullWidth` boolean prop that sets `width: 100%`
8. WHEN the Button is disabled, THE Button SHALL render at 40% opacity and suppress all animations
9. THE Button `primary` variant SHALL use `var(--brand-green-light)` background with white text
10. THE Button SHALL forward all native `ButtonHTMLAttributes` to the underlying element

---

### Requirement 6: Oakie Avatar & Mascot Component

**User Story:** As a user, I want to see the Oakie mascot character consistently across the app, so that the platform feels warm, friendly, and distinctly Oakit.

#### Acceptance Criteria

1. THE Oakie_Avatar SHALL render the Oakie mascot image (`/public/oakie.png`) as a circular avatar
2. THE Oakie_Avatar SHALL support sizes: `sm` (32px), `md` (48px), `lg` (64px), `xl` (96px), `hero` (128px)
3. WHEN the `glow` prop is `true`, THE Oakie_Avatar SHALL apply a Glow_Pulse animation — a soft green radial box-shadow that pulses between `0 0 0 0 rgba(82,183,136,0.4)` and `0 0 20px 8px rgba(82,183,136,0)` on a 2s loop
4. WHEN the `hero` size is used, THE Oakie_Avatar SHALL render with a floating animation — a subtle `translateY` oscillation of ±6px on a 3s ease-in-out loop using Framer Motion
5. THE Oakie_Avatar SHALL accept a `badge` prop that renders a small emoji or icon badge in the bottom-right corner
6. THE Oakie_Avatar SHALL be used as the chat message avatar in the Oakie AI panel (replacing the current Sparkles icon)
7. THE Oakie_Avatar SHALL be used as the hero illustration in the Teacher Dashboard header area
8. WHEN a teacher completes all topics for the day, THE Oakie_Avatar SHALL play a celebration animation — scale from 1 to 1.3 and back with a bounce easing

---

### Requirement 7: Progress Bar Component

**User Story:** As a developer, I want a Duolingo-style animated Progress Bar, so that I can show completion and XP progress with visual energy.

#### Acceptance Criteria

1. THE Progress_Bar SHALL accept a `value` prop (0–100) and animate the fill width using a Framer Motion spring transition on mount and value change
2. THE Progress_Bar SHALL support color variants: `primary`, `success`, `warning`, `danger`, `xp`, `green`
3. WHEN the `green` variant is used, THE Progress_Bar SHALL apply a gradient from `var(--brand-green-soft)` to `var(--brand-green-light)`
4. WHEN the `xp` color variant is used, THE Progress_Bar SHALL apply the existing `.progress-fill-xp` gradient (`#58CC02` → `#89E219`)
5. THE Progress_Bar SHALL support size variants: `xs` (4px), `sm` (6px), `md` (8px), `lg` (12px)
6. WHEN the `glow` prop is `true`, THE Progress_Bar SHALL apply a box-shadow using the fill color at 40% opacity
7. THE Progress_Bar SHALL accept `label` and `sublabel` string props rendered above the track
8. WHEN the fill reaches 100%, THE Progress_Bar SHALL trigger a Framer Motion scale pulse animation on the track

---

### Requirement 8: Activity Step Component

**User Story:** As a developer, I want an Uber-style Activity Step component, so that I can render guided multi-step flows with clear status indicators.

#### Acceptance Criteria

1. THE Activity_Step SHALL accept a `status` prop with values: `pending`, `active`, `done`
2. WHEN `status` is `done`, THE Activity_Step SHALL render a filled green circle (`var(--brand-green-soft)`) with a checkmark icon
3. WHEN `status` is `active`, THE Activity_Step SHALL render a pulsing brand-coloured circle with a Framer Motion `animate` pulse on the ring
4. WHEN `status` is `pending`, THE Activity_Step SHALL render an empty circle with `var(--border-strong)` stroke
5. THE Activity_Step SHALL render a vertical connector line between steps
6. THE Activity_Step SHALL accept `title`, `subtitle`, `timestamp`, and `subjectColour` props; WHEN `subjectColour` is provided, the step icon SHALL use that colour
7. WHEN `status` transitions from `pending` to `active`, THE Activity_Step SHALL animate the circle fill using a Framer Motion spring
8. THE Activity_Step SHALL accept a `children` prop for rendering additional content below the title row
9. THE Activity_Step SHALL accept an `isLast` boolean prop that hides the connector line on the final step

---

### Requirement 9: Timeline Item Component

**User Story:** As a developer, I want a Timeline Item component, so that I can render chronological journey entries on the Parent Portal.

#### Acceptance Criteria

1. THE Timeline_Item SHALL accept `avatarSrc`, `avatarName`, `date`, `title`, and `content` props
2. THE Timeline_Item SHALL render the Avatar component with a size of `sm` (32px)
3. THE Timeline_Item SHALL render a vertical line connector using `var(--border)` that connects adjacent items
4. WHEN the Timeline_Item mounts, THE Timeline_Item SHALL animate in using a Framer Motion `fadeIn` + `slideUp` with a configurable `delay` prop
5. THE Timeline_Item SHALL accept a `badge` prop that renders a Badge component inline with the title
6. THE Timeline_Item SHALL accept a `media` prop (image URL) that renders a rounded image below the content
7. WHEN rendered in dark mode, THE Timeline_Item SHALL use `var(--bg-elevated)` for the card surface

---

### Requirement 10: Modal Component

**User Story:** As a developer, I want a Modal component built on Radix Dialog, so that I can render accessible overlays with smooth Framer Motion enter/exit animations.

#### Acceptance Criteria

1. THE Modal SHALL use `@radix-ui/react-dialog` as its underlying primitive for accessibility
2. WHEN the Modal opens, THE Modal SHALL animate the backdrop from `opacity: 0` to `opacity: 1`
3. WHEN the Modal opens, THE Modal SHALL animate the panel using a Framer Motion spring: `opacity: 0, scale: 0.95, y: 8` → `opacity: 1, scale: 1, y: 0`
4. WHEN the Modal closes, THE Modal SHALL animate the panel out before unmounting
5. THE Modal SHALL support size variants: `sm`, `md`, `lg`, `xl`, `full`
6. THE Modal SHALL accept `title`, `subtitle`, `children`, and `footer` props
7. WHEN the backdrop is clicked and `closeOnBackdrop` is `true`, THE Modal SHALL close
8. THE Modal SHALL render a close button (X icon) in the header
9. THE Modal panel SHALL use `border-radius: 24px` and `var(--cream-bg)` as its background

---

### Requirement 11: Badge Component

**User Story:** As a developer, I want a Badge component with semantic and engagement variants, so that I can communicate status and reward states clearly.

#### Acceptance Criteria

1. THE Badge SHALL support semantic variants: `success`, `warning`, `danger`, `info`, `neutral`
2. THE Badge SHALL support engagement variants: `streak`, `xp`, `primary`, `purple`
3. WHEN the `streak` variant is used, THE Badge SHALL apply `var(--streak-bg)` background and render a 🔥 icon prefix
4. WHEN the `xp` variant is used, THE Badge SHALL apply `var(--xp-bg)` background and render a ⚡ icon prefix
5. THE Badge SHALL support sizes: `xs`, `sm`, `md`
6. THE Badge SHALL accept a `dot` boolean prop that renders a coloured status dot
7. WHEN the Badge mounts with the `streak` or `xp` variant, THE Badge SHALL play the existing `.bounce-in` CSS animation

---

### Requirement 12: Avatar Component

**User Story:** As a developer, I want an Avatar component with upload support, fallback initials, and an online indicator.

#### Acceptance Criteria

1. THE Avatar SHALL render an `<img>` when `src` is provided, with `object-fit: cover`
2. WHEN `src` is not provided or fails to load, THE Avatar SHALL render a coloured div with the user's initials
3. THE Avatar SHALL deterministically assign a background colour from the subject colour palette based on the first character of the `name` prop
4. THE Avatar SHALL support sizes: `xs` (24px), `sm` (32px), `md` (40px), `lg` (48px), `xl` (64px), `2xl` (80px)
5. THE Avatar SHALL support shape variants: `circle` and `rounded`
6. WHEN the `online` prop is `true`, THE Avatar SHALL render a green dot indicator positioned at the bottom-right
7. WHEN the `ring` prop is `true`, THE Avatar SHALL apply the existing `.rotating-border` CSS animation
8. THE Avatar SHALL accept an `onUpload` callback prop with a camera icon overlay on hover

---

### Requirement 13: Toast Component

**User Story:** As a developer, I want a Toast notification system, so that I can show auto-dismissing feedback messages.

#### Acceptance Criteria

1. THE Toast SHALL use `@radix-ui/react-toast` as its underlying primitive
2. THE Toast SHALL support variants: `success`, `error`, `warning`, `info`
3. WHEN a Toast is triggered, THE Toast SHALL animate in from the bottom using a Framer Motion spring
4. WHEN a Toast is dismissed or times out, THE Toast SHALL animate out before unmounting
5. THE Toast SHALL auto-dismiss after a configurable `duration` prop (default: 3000ms)
6. THE Toast SHALL be managed by a Zustand store (`useToastStore`) with `addToast` and `removeToast` actions
7. THE Toast SHALL use `var(--cream-bg)` background with a coloured left border matching the variant

---

### Requirement 14: Bottom Sheet Component

**User Story:** As a developer, I want a Bottom Sheet component for mobile-first interactions.

#### Acceptance Criteria

1. THE Bottom_Sheet SHALL use `@radix-ui/react-dialog` as its underlying primitive
2. WHEN the Bottom_Sheet opens, THE Bottom_Sheet SHALL animate in from the bottom using a Framer Motion spring
3. WHEN the Bottom_Sheet closes, THE Bottom_Sheet SHALL animate out before unmounting
4. THE Bottom_Sheet SHALL render a drag handle bar centred at the top of the sheet
5. WHEN the user drags the sheet downward more than 80px, THE Bottom_Sheet SHALL close
6. THE Bottom_Sheet SHALL render with `border-radius: 24px` on the top corners only
7. WHEN rendered on screens wider than 640px, THE Bottom_Sheet SHALL fall back to rendering as a centred Modal

---

### Requirement 15: Teacher Dashboard Redesign

**User Story:** As a teacher, I want a warm, visually engaging dashboard that feels like a children's education app, so that I enjoy using it every day and can see my plan at a glance.

#### Acceptance Criteria

1. THE Teacher_Dashboard header SHALL use `var(--header-gradient)` as its background with the Oakie_Avatar in `hero` size floating on the right side of the header, with the `glow` prop enabled
2. THE Teacher_Dashboard header SHALL display the teacher's name, class name, and today's date in white text with the streak Badge and XP Badge
3. THE Teacher_Dashboard plan view SHALL render today's subjects as a grid of Subject_Tile components — 2 columns on mobile, 3–4 columns on tablet/desktop
4. WHEN a teacher taps a Subject_Tile, THE Teacher_Dashboard SHALL expand an inline detail card below the tile showing the activity description, "Ask Oakie" button, and the YouTube video icon
5. THE Teacher_Dashboard SHALL render a daily completion Progress_Bar with the `green` variant below the subject grid, showing `X of Y topics done`
6. WHEN all topics are marked done, THE Teacher_Dashboard SHALL display a full-screen celebration: the Oakie_Avatar plays its celebration animation, confetti particles fall, and a "Well done!" card slides up
7. THE Teacher_Dashboard Oakie chat panel SHALL use the Oakie_Avatar as the message avatar instead of the current Sparkles icon
8. THE Teacher_Dashboard SHALL render the pending topics section using warm amber Card components with a clock icon
9. THE Teacher_Dashboard page background SHALL use `var(--cream-bg)` for all content areas outside the header
10. WHEN the Teacher_Dashboard mounts, each Subject_Tile SHALL stagger-animate in with 60ms delay between tiles using Framer Motion
11. THE Teacher_Dashboard SHALL be fully functional on screens as narrow as 320px

---

### Requirement 16: Parent Portal Redesign

**User Story:** As a parent, I want an emotionally engaging portal that feels warm and child-friendly, so that I feel connected to my child's school journey.

#### Acceptance Criteria

1. THE Parent_Portal header SHALL use `var(--header-gradient)` with the child's Avatar featuring the `ring` animation
2. THE Parent_Portal SHALL display the child's name, grade, and attendance status using the Badge component
3. THE Parent_Portal SHALL render a Timeline of the child's recent school journey using Timeline_Item components
4. THE Parent_Portal SHALL render subject coverage as Subject_Tile components in a compact grid showing what was covered today
5. THE Parent_Portal SHALL render homework and notes using warm Card components with `cream` prop
6. THE Parent_Portal page background SHALL use `var(--cream-bg)`
7. WHEN the Parent_Portal mounts, each section SHALL stagger-animate in with 80ms delay between sections

---

### Requirement 17: Principal Dashboard Redesign

**User Story:** As a principal, I want an authoritative, data-rich dashboard with the same warm visual language, so that I can assess school health at a glance.

#### Acceptance Criteria

1. THE Principal_Dashboard header SHALL use `var(--header-gradient)` with the Oakie_Avatar in `lg` size
2. THE Principal_Dashboard SHALL render animated donut charts for key metrics using Framer Motion path animations
3. THE Principal_Dashboard SHALL render school health Cards using the Card component with `elevated` prop
4. THE Principal_Dashboard SHALL render a teacher engagement leaderboard showing teacher Avatars, streak Badges, and XP Badges
5. WHEN a metric is below threshold, THE Principal_Dashboard SHALL render a `danger` or `warning` Badge on the corresponding Card
6. THE Principal_Dashboard page background SHALL use `var(--cream-bg)`

---

### Requirement 18: Admin Panel Redesign

**User Story:** As an admin, I want a clean, functional panel with the Oakit visual language, so that I can manage school data efficiently.

#### Acceptance Criteria

1. THE Admin_Panel header SHALL use `var(--header-gradient)`
2. THE Admin_Panel SHALL render data tables with `var(--cream-bg)` row backgrounds and `var(--border)` dividers
3. THE Admin_Panel SHALL render the calendar using Card components with Subject_Tile colour coding for event types
4. WHEN an admin performs a destructive action, THE Admin_Panel SHALL present a confirmation Modal
5. THE Admin_Panel SHALL render success/error feedback using the Toast system
6. THE Admin_Panel page background SHALL use `var(--cream-bg)`

---

### Requirement 19: Animation System

**User Story:** As a developer, I want a consistent animation system, so that every interactive element has a Framer Motion micro-animation without inconsistency.

#### Acceptance Criteria

1. THE Design_System SHALL define a shared `motionConfig` object exported from `@/UIComponents/tokens` containing reusable Framer Motion `variants` for: `fadeIn`, `slideUp`, `scaleIn`, `staggerContainer`, `staggerItem`, and `floatLoop`
2. THE Design_System SHALL define `springConfig` (`stiffness: 400, damping: 30`) for press/tap interactions
3. THE Design_System SHALL define `smoothConfig` (`stiffness: 200, damping: 25`) for mount/enter animations
4. THE Design_System SHALL define `floatConfig` — a looping `translateY` animation (`0px → -6px → 0px`, 3s ease-in-out) for the Oakie hero illustration
5. THE Design_System SHALL define `glowPulse` — a looping box-shadow animation for the Oakie avatar glow effect
6. THE Design_System SHALL export a `<MotionCard>` wrapper that applies `staggerContainer` to its children
7. THE Design_System SHALL export a `<SubjectTileGrid>` wrapper that applies staggered `scaleIn` to Subject_Tile children

---

### Requirement 20: Dark Mode Compliance

**User Story:** As a user, I want every component to look correct in dark mode.

#### Acceptance Criteria

1. THE Design_System SHALL use only CSS custom properties for all colour values — no hardcoded hex or Tailwind colour classes
2. WHEN the `.dark` class is applied to the root element, THE Design_System SHALL automatically update all component colours
3. WHEN dark mode is active, `--cream-bg` SHALL map to `#1a1a1a` and all surface tokens SHALL adjust accordingly
4. THE header gradient SHALL remain dark in both light and dark mode (it is always the deep forest green)

---

### Requirement 21: Mobile-First Responsive Behaviour

**User Story:** As a mobile user, I want every portal to feel native on iOS and Android.

#### Acceptance Criteria

1. THE Design_System SHALL ensure all components render correctly at a minimum viewport width of 320px
2. THE Design_System SHALL use the existing `.pb-safe-nav` utility class on portal pages for iOS safe area insets
3. WHEN a Modal is rendered on a screen narrower than 640px, THE Modal SHALL render as a Bottom_Sheet
4. THE Design_System SHALL use `touch-action: manipulation` on all interactive elements
5. THE Design_System SHALL ensure tap targets are a minimum of 44×44px on all interactive elements
6. THE Subject_Tile grid SHALL use 2 columns on mobile (`< 640px`), 3 columns on tablet (`640–1024px`), and 4 columns on desktop (`> 1024px`)

---

## Glossary

- **Design_System**: The complete set of components, tokens, patterns, and guidelines defined in this spec
- **UIComponents**: The existing component library at `oakit/apps/frontend/src/UIComponents/`
- **Component**: A reusable React/TypeScript UI element exported from UIComponents
- **Portal**: One of the four role-specific views — Parent Portal, Teacher Dashboard, Principal Dashboard, Admin Panel
- **Micro_Animation**: A Framer Motion animation applied to an interactive element (press, hover, mount, exit)
- **Dark_Mode**: The `.dark` CSS class applied to the root element, toggling CSS custom properties
- **Design_Token**: A CSS custom property or Tailwind class that encodes a design decision (color, spacing, radius, shadow)
- **Streak**: A consecutive-day activity counter displayed on the Teacher Dashboard
- **XP**: Experience points earned by teachers for completing daily plans, displayed as a numeric badge
- **Radix_UI**: The `@radix-ui/*` family of headless, accessible React primitives
- **shadcn_ui**: Pre-built accessible components built on Radix UI, installed via the shadcn CLI
- **Zustand**: A lightweight React state management library used for global UI state (toasts, modals, theme)
- **Bottom_Sheet**: A mobile-first modal variant that slides up from the bottom of the screen
- **Activity_Step**: A single step in an Uber-style guided flow with a status of pending, active, or done
- **Timeline_Item**: A chronological entry card showing an avatar, date, and content block
- **Hero_Card**: The prominent top card on the Parent Portal featuring an animated ring around the child's avatar
- **Animated_Ring**: A conic-gradient rotating border animation around an avatar, indicating live/active status

---

## Requirements

---

### Requirement 1: Dependency Installation

**User Story:** As a developer, I want the three missing libraries installed and configured, so that I can build accessible, animated components without reinventing primitives.

#### Acceptance Criteria

1. THE Design_System SHALL declare `@radix-ui/react-dialog`, `@radix-ui/react-toast`, `@radix-ui/react-avatar`, `@radix-ui/react-progress`, and `@radix-ui/react-slot` as dependencies in `package.json`
2. THE Design_System SHALL declare `shadcn/ui` components as dependencies, initialized via `npx shadcn@latest init` targeting the existing Tailwind config
3. THE Design_System SHALL declare `zustand` as a dependency in `package.json`
4. WHEN the dependencies are installed, THE Design_System SHALL not introduce breaking changes to existing component imports from `@/UIComponents`
5. THE Design_System SHALL configure shadcn/ui to use the existing CSS custom properties (`--brand-primary`, `--bg-elevated`, `--border`, etc.) as its theme variables

---

### Requirement 2: Card Component

**User Story:** As a developer, I want a Notion-style Card component, so that I can create elevated surfaces that work in both light and dark mode.

#### Acceptance Criteria

1. THE Card SHALL render a surface using `var(--bg-elevated)` as its background color
2. THE Card SHALL apply `var(--border)` as its border color in both light and dark mode
3. THE Card SHALL support padding variants: `none`, `xs` (12px), `sm` (16px), `md` (20px), `lg` (28px)
4. THE Card SHALL support an `elevated` boolean prop that applies `var(--shadow-md)` instead of `var(--shadow-sm)`
5. WHEN the Card receives an `onClick` prop or `hover` prop, THE Card SHALL apply a Framer Motion `whileHover` that translates Y by -2px and increases shadow to `var(--shadow-lg)`
6. WHEN the Card receives an `onClick` prop, THE Card SHALL apply a Framer Motion `whileTap` that scales to 0.98
7. THE Card SHALL accept a `glow` boolean prop that applies the existing `.glow-card` CSS class for a brand-colored border glow on hover
8. THE Card SHALL accept a `className` prop for additional Tailwind overrides
9. WHEN rendered in dark mode, THE Card SHALL use `var(--bg-elevated)` and `var(--border)` without any hardcoded `bg-white` or `border-neutral-100` classes

---

### Requirement 3: Button Component

**User Story:** As a developer, I want a Button component with full variant coverage and Framer Motion press feedback, so that every interactive action feels responsive and polished.

#### Acceptance Criteria

1. THE Button SHALL support variants: `primary`, `secondary`, `ghost`, `destructive`
2. THE Button SHALL support sizes: `xs`, `sm`, `md`, `lg`
3. WHEN the Button `loading` prop is `true`, THE Button SHALL render a spinning Framer Motion animated SVG icon and disable the button
4. WHEN the Button is pressed, THE Button SHALL apply a Framer Motion `whileTap` scale of 0.96
5. WHEN the Button is hovered, THE Button SHALL apply a Framer Motion `whileHover` scale of 1.02
6. THE Button SHALL accept `icon` and `iconPosition` (`left` | `right`) props
7. THE Button SHALL accept a `fullWidth` boolean prop that sets `width: 100%`
8. WHEN the Button is disabled, THE Button SHALL render at 40% opacity and suppress all animations
9. THE Button SHALL use `var(--brand-primary)` for the `primary` variant background in both light and dark mode
10. THE Button SHALL forward all native `ButtonHTMLAttributes` to the underlying element

---

### Requirement 4: Progress Bar Component

**User Story:** As a developer, I want a Duolingo-style animated Progress Bar, so that I can show completion and XP progress with visual energy.

#### Acceptance Criteria

1. THE Progress_Bar SHALL accept a `value` prop (0–100) and animate the fill width using a Framer Motion spring transition on mount and value change
2. THE Progress_Bar SHALL support color variants: `primary`, `success`, `warning`, `danger`, `xp`
3. WHEN the `xp` color variant is used, THE Progress_Bar SHALL apply the existing `.progress-fill-xp` gradient (`#58CC02` → `#89E219`)
4. THE Progress_Bar SHALL support size variants: `xs` (4px height), `sm` (6px height), `md` (8px height), `lg` (12px height)
5. WHEN the `glow` prop is `true`, THE Progress_Bar SHALL apply a box-shadow using the fill color at 40% opacity to create a Duolingo-style glow effect
6. THE Progress_Bar SHALL accept `label` and `sublabel` string props rendered above the track
7. THE Progress_Bar SHALL accept a `showValue` boolean prop that renders the percentage value as text
8. WHEN the fill reaches 100%, THE Progress_Bar SHALL trigger a Framer Motion scale pulse animation on the track

---

### Requirement 5: Activity Step Component

**User Story:** As a developer, I want an Uber-style Activity Step component, so that I can render guided multi-step flows with clear status indicators.

#### Acceptance Criteria

1. THE Activity_Step SHALL accept a `status` prop with values: `pending`, `active`, `done`
2. WHEN `status` is `done`, THE Activity_Step SHALL render a filled green circle with a checkmark icon
3. WHEN `status` is `active`, THE Activity_Step SHALL render a pulsing brand-colored circle with a Framer Motion `animate` pulse on the ring
4. WHEN `status` is `pending`, THE Activity_Step SHALL render an empty circle with `var(--border-strong)` stroke
5. THE Activity_Step SHALL render a vertical connector line between steps, using `var(--border)` for pending and `var(--brand-primary)` for completed segments
6. THE Activity_Step SHALL accept `title`, `subtitle`, and `timestamp` string props
7. WHEN `status` transitions from `pending` to `active`, THE Activity_Step SHALL animate the circle fill using a Framer Motion spring
8. THE Activity_Step SHALL accept a `children` prop for rendering additional content below the title row
9. THE Activity_Step SHALL accept an `isLast` boolean prop that hides the connector line on the final step

---

### Requirement 6: Timeline Item Component

**User Story:** As a developer, I want a Timeline Item component, so that I can render chronological journey entries on the Parent Portal.

#### Acceptance Criteria

1. THE Timeline_Item SHALL accept `avatarSrc`, `avatarName`, `date`, `title`, and `content` props
2. THE Timeline_Item SHALL render the Avatar component with a size of `sm` (32px)
3. THE Timeline_Item SHALL render a vertical line connector using `var(--border)` that connects adjacent items
4. WHEN the Timeline_Item mounts, THE Timeline_Item SHALL animate in using a Framer Motion `fadeIn` + `slideUp` with a configurable `delay` prop
5. THE Timeline_Item SHALL accept a `badge` prop that renders a Badge component inline with the title
6. THE Timeline_Item SHALL accept a `media` prop (image URL) that renders a rounded image below the content
7. WHEN rendered in dark mode, THE Timeline_Item SHALL use `var(--bg-elevated)` for the card surface and `var(--border)` for the connector line

---

### Requirement 7: Modal Component

**User Story:** As a developer, I want a Modal component built on Radix Dialog, so that I can render accessible overlays with smooth Framer Motion enter/exit animations.

#### Acceptance Criteria

1. THE Modal SHALL use `@radix-ui/react-dialog` as its underlying primitive for accessibility (focus trap, ARIA roles, escape key dismissal)
2. WHEN the Modal opens, THE Modal SHALL animate the backdrop from `opacity: 0` to `opacity: 1` using Framer Motion
3. WHEN the Modal opens, THE Modal SHALL animate the panel using a Framer Motion spring: `opacity: 0, scale: 0.95, y: 8` → `opacity: 1, scale: 1, y: 0`
4. WHEN the Modal closes, THE Modal SHALL animate the panel out using the reverse of the open animation before unmounting
5. THE Modal SHALL support size variants: `sm` (384px), `md` (448px), `lg` (560px), `xl` (672px), `full` (100vw on mobile)
6. THE Modal SHALL accept `title`, `subtitle`, `children`, and `footer` props
7. WHEN the backdrop is clicked and `closeOnBackdrop` is `true`, THE Modal SHALL close
8. THE Modal SHALL render a close button (X icon) in the header that triggers the `onClose` callback
9. WHEN rendered in dark mode, THE Modal SHALL use `var(--bg-elevated)` for the panel background and `var(--border)` for the header divider

---

### Requirement 8: Badge Component

**User Story:** As a developer, I want a Badge component with semantic and engagement variants, so that I can communicate status and reward states clearly.

#### Acceptance Criteria

1. THE Badge SHALL support semantic variants: `success`, `warning`, `danger`, `info`, `neutral`
2. THE Badge SHALL support engagement variants: `streak`, `xp`, `primary`, `purple`
3. WHEN the `streak` variant is used, THE Badge SHALL apply `var(--streak-bg)` background, `var(--streak-fire)` text color, and render a 🔥 icon prefix
4. WHEN the `xp` variant is used, THE Badge SHALL apply `var(--xp-bg)` background, `var(--xp-green)` text color, and render a ⚡ icon prefix
5. THE Badge SHALL support sizes: `xs`, `sm`, `md`
6. THE Badge SHALL accept a `dot` boolean prop that renders a colored status dot
7. THE Badge SHALL accept an `icon` prop for a custom lucide-react icon
8. WHEN the Badge mounts with the `streak` or `xp` variant, THE Badge SHALL play the existing `.bounce-in` CSS animation
9. THE Badge SHALL use `var(--border)` for its border color in dark mode

---

### Requirement 9: Avatar Component

**User Story:** As a developer, I want an Avatar component with upload support, fallback initials, and an online indicator, so that I can represent users consistently across all portals.

#### Acceptance Criteria

1. THE Avatar SHALL render an `<img>` when `src` is provided, with `object-fit: cover`
2. WHEN `src` is not provided or fails to load, THE Avatar SHALL render a colored div with the user's initials (first two words, first letter each, uppercase)
3. THE Avatar SHALL deterministically assign a background color from a palette of 6 colors based on the first character of the `name` prop
4. THE Avatar SHALL support sizes: `xs` (24px), `sm` (32px), `md` (40px), `lg` (48px), `xl` (64px), `2xl` (80px)
5. THE Avatar SHALL support shape variants: `circle` (`border-radius: 9999px`) and `rounded` (`border-radius: var(--radius-xl)`)
6. WHEN the `online` prop is `true`, THE Avatar SHALL render a green dot indicator (10px) with a white border, positioned at the bottom-right
7. WHEN the `ring` prop is `true`, THE Avatar SHALL apply the existing `.rotating-border` CSS animation for the animated ring effect
8. THE Avatar SHALL accept an `onUpload` callback prop; WHEN provided, THE Avatar SHALL render a camera icon overlay on hover that triggers the callback
9. WHEN the `onUpload` overlay is hovered, THE Avatar SHALL animate the overlay opacity from 0 to 0.85 using Framer Motion

---

### Requirement 10: Toast Component

**User Story:** As a developer, I want a Toast notification system built on Radix Toast, so that I can show auto-dismissing feedback messages that slide in from the bottom.

#### Acceptance Criteria

1. THE Toast SHALL use `@radix-ui/react-toast` as its underlying primitive for accessibility (ARIA live region, focus management)
2. THE Toast SHALL support variants: `success`, `error`, `warning`, `info`
3. WHEN a Toast is triggered, THE Toast SHALL animate in from the bottom using a Framer Motion spring: `y: 100, opacity: 0` → `y: 0, opacity: 1`
4. WHEN a Toast is dismissed or times out, THE Toast SHALL animate out: `y: 100, opacity: 0` before unmounting
5. THE Toast SHALL auto-dismiss after a configurable `duration` prop (default: 3000ms)
6. THE Toast SHALL render a close button that triggers immediate dismissal
7. THE Toast SHALL be managed by a Zustand store (`useToastStore`) with `addToast` and `removeToast` actions
8. THE Design_System SHALL export a `<ToastProvider>` component that renders the Radix Toast viewport at the bottom of the screen
9. WHEN multiple Toasts are queued, THE Toast SHALL stack them vertically with 8px gap, newest on top
10. WHEN rendered in dark mode, THE Toast SHALL use `var(--bg-elevated)` background with a `var(--border-strong)` border

---

### Requirement 11: Bottom Sheet Component

**User Story:** As a developer, I want a Bottom Sheet component for mobile-first interactions, so that I can present contextual actions and content in a native-feeling overlay.

#### Acceptance Criteria

1. THE Bottom_Sheet SHALL use `@radix-ui/react-dialog` as its underlying primitive for accessibility
2. WHEN the Bottom_Sheet opens, THE Bottom_Sheet SHALL animate in from the bottom: `y: '100%', opacity: 0` → `y: 0, opacity: 1` using a Framer Motion spring
3. WHEN the Bottom_Sheet closes, THE Bottom_Sheet SHALL animate out to `y: '100%', opacity: 0` before unmounting
4. THE Bottom_Sheet SHALL render a drag handle bar (40px × 4px, `var(--border-strong)` color) centered at the top of the sheet
5. WHEN the user drags the sheet downward more than 80px, THE Bottom_Sheet SHALL close using Framer Motion `useDragControls`
6. THE Bottom_Sheet SHALL support a `snapPoints` prop (array of height percentages) for multi-snap behavior
7. THE Bottom_Sheet SHALL render with `border-radius: var(--radius-2xl)` on the top corners only
8. WHEN rendered on screens wider than 640px, THE Bottom_Sheet SHALL fall back to rendering as a centered Modal
9. THE Bottom_Sheet SHALL accept `title`, `children`, and `footer` props with the same structure as the Modal component

---

### Requirement 12: Parent Portal Redesign

**User Story:** As a parent, I want an emotionally engaging portal, so that I feel connected to my child's school journey at a glance.

#### Acceptance Criteria

1. THE Parent_Portal SHALL render a Hero_Card at the top of the page featuring the child's Avatar with the `ring` prop enabled (animated rotating border)
2. THE Parent_Portal SHALL display the child's name, grade, and current attendance status on the Hero_Card using the Badge component
3. WHEN the child is marked present, THE Parent_Portal SHALL render a `success` Badge; WHEN absent, a `danger` Badge; WHEN late, a `warning` Badge
4. THE Parent_Portal SHALL render a Timeline of the child's recent school journey using Timeline_Item components, ordered newest-first
5. THE Parent_Portal SHALL render a homework Card using the Card component with `elevated` prop, showing subject, due date, and a Progress_Bar for completion
6. THE Parent_Portal SHALL render a Quick Actions row with Button components for "Message Teacher", "View Report", and "Request Meeting"
7. WHEN the Parent_Portal mounts, THE Parent_Portal SHALL stagger-animate each section using Framer Motion with 80ms delay between sections
8. THE Parent_Portal SHALL work correctly in both light and dark mode using only design tokens (no hardcoded colors)
9. THE Parent_Portal SHALL be fully functional on screens as narrow as 320px

---

### Requirement 13: Teacher Dashboard Redesign

**User Story:** As a teacher, I want a fast, clarity-focused dashboard, so that I can see my day's plan and track my engagement streak without friction.

#### Acceptance Criteria

1. THE Teacher_Dashboard SHALL render today's lesson plan as a sequence of Activity_Step components in an Uber-style guided flow
2. WHEN a teacher marks a step complete, THE Teacher_Dashboard SHALL animate the Activity_Step status from `active` to `done` and advance to the next step
3. THE Teacher_Dashboard SHALL render the teacher's current streak using a Badge with the `streak` variant in the dashboard header
4. THE Teacher_Dashboard SHALL render the teacher's XP total using a Badge with the `xp` variant adjacent to the streak badge
5. THE Teacher_Dashboard SHALL render the Oakie chat interface using the existing `OakieMessage` component, accessible via a floating action button
6. WHEN a teacher completes all steps for the day, THE Teacher_Dashboard SHALL display a full-screen Framer Motion celebration animation (confetti or scale-in card)
7. THE Teacher_Dashboard SHALL render a Progress_Bar with the `xp` color variant showing daily plan completion percentage
8. THE Teacher_Dashboard SHALL work correctly in both light and dark mode using only design tokens
9. THE Teacher_Dashboard SHALL be fully functional on screens as narrow as 320px

---

### Requirement 14: Principal Dashboard Redesign

**User Story:** As a principal, I want an authoritative, data-rich dashboard, so that I can assess school health and teacher engagement at a glance.

#### Acceptance Criteria

1. THE Principal_Dashboard SHALL render animated donut charts for key school metrics (attendance rate, plan completion rate, assessment scores) using Framer Motion path animations
2. THE Principal_Dashboard SHALL render school health Cards using the Card component with `elevated` prop, each containing a metric value, trend indicator, and Badge
3. THE Principal_Dashboard SHALL render a teacher engagement leaderboard showing teacher Avatars, names, streak Badges, and XP Badges
4. WHEN a metric is below a threshold (attendance < 80%, plan completion < 70%), THE Principal_Dashboard SHALL render a `danger` or `warning` Badge on the corresponding Card
5. THE Principal_Dashboard SHALL render a real-time attendance status indicator using the `glow-pulse` CSS animation on a live dot
6. THE Principal_Dashboard SHALL work correctly in both light and dark mode using only design tokens
7. THE Principal_Dashboard SHALL be fully functional on screens as narrow as 320px

---

### Requirement 15: Admin Panel Redesign

**User Story:** As an admin, I want a clean, functional panel with breathing room, so that I can manage school data efficiently without visual clutter.

#### Acceptance Criteria

1. THE Admin_Panel SHALL render data tables using a consistent table component with `var(--bg-elevated)` rows, `var(--border)` dividers, and hover state using `var(--bg-hover)`
2. THE Admin_Panel SHALL render the calendar view using Card components for each day cell, with Badge components for event indicators
3. THE Admin_Panel SHALL render curriculum management using CollapsiblePanel components (already in UIComponents) for subject/unit grouping
4. WHEN an admin performs a destructive action (delete, archive), THE Admin_Panel SHALL present a confirmation Modal using the redesigned Modal component
5. THE Admin_Panel SHALL render action buttons using the Button component with appropriate variants (`primary` for create, `destructive` for delete, `ghost` for cancel)
6. THE Admin_Panel SHALL render success/error feedback using the Toast system via `useToastStore`
7. THE Admin_Panel SHALL work correctly in both light and dark mode using only design tokens
8. THE Admin_Panel SHALL be fully functional on screens as narrow as 320px

---

### Requirement 16: Animation System

**User Story:** As a developer, I want a consistent animation system, so that every interactive element has a Framer Motion micro-animation without inconsistency across components.

#### Acceptance Criteria

1. THE Design_System SHALL define a shared `motionConfig` object exported from `@/UIComponents/tokens` containing reusable Framer Motion `variants` for: `fadeIn`, `slideUp`, `scaleIn`, `staggerContainer`, and `staggerItem`
2. THE Design_System SHALL define a shared `springConfig` object with `type: 'spring', stiffness: 400, damping: 30` for press/tap interactions
3. THE Design_System SHALL define a shared `smoothConfig` object with `type: 'spring', stiffness: 200, damping: 25` for mount/enter animations
4. WHEN any interactive component (Button, Card with onClick, Activity_Step) is pressed, THE Design_System SHALL use `springConfig` for the tap animation
5. WHEN any component mounts for the first time, THE Design_System SHALL use `smoothConfig` for the enter animation
6. THE Design_System SHALL export a `<MotionCard>` wrapper component that applies `staggerContainer` to its children for automatic stagger effects

---

### Requirement 17: Dark Mode Compliance

**User Story:** As a user, I want every component to look correct in dark mode, so that I can use Oakit comfortably in low-light environments.

#### Acceptance Criteria

1. THE Design_System SHALL use only CSS custom properties (`var(--bg-elevated)`, `var(--border)`, `var(--text-primary)`, etc.) for all color values in components — no hardcoded hex or Tailwind color classes that don't map to tokens
2. WHEN the `.dark` class is applied to the root element, THE Design_System SHALL automatically update all component colors without any JavaScript intervention
3. THE Design_System SHALL not use `dark:` Tailwind variants as the primary dark mode mechanism — CSS custom properties SHALL be the single source of truth
4. WHEN a new component is added to UIComponents, THE Design_System SHALL verify it renders correctly in both modes by checking against the token definitions in `globals.css`

---

### Requirement 18: Mobile-First Responsive Behavior

**User Story:** As a mobile user, I want every portal to feel native on iOS and Android, so that I can use Oakit on my phone without a degraded experience.

#### Acceptance Criteria

1. THE Design_System SHALL ensure all components render correctly at a minimum viewport width of 320px
2. THE Design_System SHALL use the existing `.pb-safe-nav` utility class on portal pages to account for iOS safe area insets
3. WHEN a Modal is rendered on a screen narrower than 640px, THE Modal SHALL render as a Bottom_Sheet instead
4. THE Design_System SHALL use `touch-action: manipulation` on all interactive elements to eliminate the 300ms tap delay on iOS
5. WHEN a Bottom_Sheet is open on mobile, THE Design_System SHALL prevent body scroll using `overflow: hidden` on the document body
6. THE Design_System SHALL ensure tap targets are a minimum of 44×44px on all interactive elements per iOS HIG guidelines

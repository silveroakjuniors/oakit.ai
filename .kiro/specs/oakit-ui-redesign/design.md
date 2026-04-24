# Oakit UI Redesign — Design Spec

## Vision
Notion (clean) + Uber (guided flow) + Duolingo (engagement) + FlowFunds (editorial desktop)

## Color Palette

| Token | Value | Usage |
|---|---|---|
| Primary | `#1A3C2E` | Nav, buttons, hero |
| Primary light | `#2E7D5E` | Accents, active states |
| Pastel green | `#D6EDE4` | Attendance, present, success |
| Pastel amber | `#FEF3C7` | Homework, warnings |
| Pastel blue | `#DBEAFE` | Messages, info |
| Pastel purple | `#EDE9FE` | Journey, insights |
| Pastel pink | `#FCE7F3` | Birthdays, celebrations |
| Pastel red | `#FEE2E2` | Absent, alerts |
| Streak orange | `#FFF3E0` | Streak, XP |
| Surface | `#FFFFFF` | Cards |
| Background | `#F7F7F5` | Page bg |

## Pastel Card Color Assignments

| Card type | Pastel bg | Icon color | Border |
|---|---|---|---|
| Attendance / Present | `#D6EDE4` | `#1A3C2E` | `#A7D7C5` |
| Homework | `#FEF3C7` | `#D97706` | `#FDE68A` |
| Journey / Highlights | `#EDE9FE` | `#7C3AED` | `#DDD6FE` |
| Messages | `#DBEAFE` | `#2563EB` | `#BFDBFE` |
| Alerts / Absent | `#FEE2E2` | `#DC2626` | `#FECACA` |
| Streak / XP | `#FFF3E0` | `#FF9600` | `#FFD580` |
| Curriculum / Plans | `#F0FDF4` | `#16A34A` | `#BBF7D0` |
| Birthdays | `#FCE7F3` | `#DB2777` | `#FBCFE8` |

## Desktop Layout (≥1024px)

- Top nav (sticky, h-14, blur backdrop): Logo + role nav items + notifications + user avatar
- Hero section: Big greeting left + 3D CSS animated visual right + stat cards below
- Oakie panel: Fixed right (280px expanded / 48px collapsed), collapsible, state in localStorage
- Main content: Left "needs attention" panel + center timeline/feed

## Mobile Layout (<1024px)

- Minimal top bar: Logo + notifications (h-12)
- Full-width hero card (200px): 3D visual + greeting + stats
- Scrollable pastel content cards
- Floating Oakie button (FAB, 56px circle, above bottom nav)
- Fixed bottom nav (60px + safe area): 5 role-specific tabs

## 3D Hero Visual — CSS Animated (no images)

Three layered elements per role:

**Teacher:** Pastel green circle (float 6s) + Oakit green blob (rotate 20s) + Oakie mascot PNG (bob 4s) + sparkles when streak > 0

**Principal:** Grid lines (drift) + donut ring (spin 30s) + school icon (float)

**Parent:** Radial gradient blob (pulse 5s) + leaf shape (sway) + child avatar (rotating-border)

**Admin:** Grid pattern (scale pulse) + abstract cube (rotate) + gear icon (spin 60s)

## Animations

```css
@keyframes oakieBob {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50%       { transform: translateY(-10px) rotate(2deg); }
}
@keyframes blobRotate {
  from { transform: rotate(0deg) scale(1); }
  50%  { transform: rotate(180deg) scale(1.05); }
  to   { transform: rotate(360deg) scale(1); }
}
@keyframes sparklePop {
  0%, 100% { opacity: 0; transform: scale(0); }
  50%       { opacity: 1; transform: scale(1); }
}
```

## Top Nav Items Per Role

| Teacher | Principal | Admin | Parent |
|---|---|---|---|
| Home | Dashboard | Dashboard | Home |
| Today's Plan | Attendance | Calendar | Journey |
| Attendance | Coverage | Curriculum | Attendance |
| Homework | Teachers | Plans | Messages |
| Notes | Reports | Students | Insights |
| — | — | Settings | — |

## Oakie Panel

- Desktop: Fixed right panel, 280px expanded / 48px collapsed icon-only
- Collapse button top-right of panel
- State: `localStorage('oakie_panel_open')`
- Contains: Oakie avatar + chat history + suggested question chips + input + voice button
- Mobile: Not a panel — triggered via FAB → opens as bottom sheet

## Components to Build

1. `OakitTopNav` — replaces all current headers
2. `HeroSection` — greeting + 3D CSS visual + stat cards (role-aware)
3. `OakiePanel` — collapsible right panel wrapping existing chat
4. `PastelCard` — base card with color variant prop
5. `FloatingOakieButton` — mobile FAB
6. `BottomNav` — mobile fixed nav (role-aware)
7. `AnimatedBlob` — 3D CSS visual component

## Build Order

1. `globals.css` — pastel tokens + new animations
2. `OakitTopNav` — biggest immediate visual impact
3. `HeroSection` + `AnimatedBlob` — wow factor
4. `OakiePanel` — collapsible
5. `PastelCard` — swap all white cards
6. `BottomNav` + `FloatingOakieButton` — mobile
7. Apply: Teacher → Principal → Parent → Admin

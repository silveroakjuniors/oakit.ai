# Oakit UI Component Library

Single source of truth for all UI components across the Oakit platform.

## Import

```tsx
import { Button, Card, Alert, CollapsiblePanel, Tabs } from '@/UIComponents';
```

## Structure

```
UIComponents/
├── tokens/           Design tokens — colors, spacing, typography, animation
├── primitives/       Atoms (smallest reusable units)
│   ├── Button        Primary, secondary, ghost, danger, amber, success variants
│   ├── Badge         Status badges with dot indicator
│   ├── Input         Text input with label, hint, error, icon
│   ├── Toggle        On/off switch with optional label
│   ├── Spinner       Loading indicator
│   └── Avatar        User avatar with image or initials fallback
├── components/       Molecules (composed from primitives)
│   ├── Card          White card with padding and shadow variants
│   ├── CollapsiblePanel  Accordion-style expandable section
│   ├── Alert         Success/warning/danger/info banners
│   ├── Tabs          Underline, pill, and segment tab variants
│   ├── Modal         Accessible modal dialog
│   └── ProgressBar   Animated progress indicator
├── patterns/         Organisms (page-level patterns)
│   ├── PageHeader    Title + subtitle + icon + actions + breadcrumb
│   ├── EmptyState    Empty list/page state with optional CTA
│   └── StatCard      Metric card with trend indicator
└── feedback/         Loading and notification states
    ├── Skeleton      Content placeholder shimmer
    ├── SkeletonCard  Card-shaped skeleton
    └── Toast         Auto-dismissing notification
```

## Usage Examples

```tsx
// Button
<Button variant="primary" size="md" loading={saving} icon={<Save />}>
  Save Changes
</Button>

// CollapsiblePanel (like Homework & Notes)
<CollapsiblePanel title="Today's Topics" icon={<BookOpen />} badge={<Badge label="6" />}>
  {/* content */}
</CollapsiblePanel>

// Alert
<Alert variant="warning" title="Carry forward" message="2 topics will move to tomorrow." />

// Tabs (segment style)
<Tabs variant="segment" tabs={[{id:'raw',label:'Quick View'},{id:'oakie',label:"Ask Oakie",icon:<Sparkles/>}]}
  activeTab={tab} onChange={setTab} />

// StatCard
<StatCard label="Present Today" value="24" subvalue="of 28 students" color="success" icon={<Users/>} />
```

## Design Principles

1. **Oakit brand first** — primary green, warm neutrals, no generic blue defaults
2. **Mobile-first** — all components work on 320px screens
3. **Accessible** — focus rings, ARIA attributes, keyboard navigation
4. **Consistent spacing** — p-3/p-4/p-5 rhythm, gap-2/gap-3/gap-4
5. **No AI mentions** — use "Oakie" everywhere in user-facing text

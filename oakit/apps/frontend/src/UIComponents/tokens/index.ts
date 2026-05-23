/**
 * Oakit Design Tokens
 * Single source of truth for all design decisions.
 * These map to the Tailwind config — use these constants in JS/TS logic,
 * use the Tailwind classes in JSX.
 *
 * PALETTE SPEC (Apple-level, from design brief):
 *   Brand:    #166A4D (Primary 600) → #1F7A5A (500) → #52B788 (400)
 *   Page bg:  linear-gradient(135deg, #F0FFF4, #F5F0FF, #EAF4FF)
 *   Sidebar:  linear-gradient(160deg, #B8D8F8, #C4B8F0, #B8E0F8)
 *   Cards:    rgba(255,255,255,0.85) + backdropFilter blur(16px)
 *   Vivid tiles: teal #2EC4B6, amber #F4B942, purple #9B5DE5, coral #F4845F
 */

// ── Brand greens ──────────────────────────────────────────────────────────
export const brand = {
  50:  '#F0FFF4',
  100: '#D8F3DC',
  200: '#B7E4C7',
  300: '#74C69D',
  400: '#52B788',
  500: '#1F7A5A',
  600: '#166A4D',   // primary button / active state
  700: '#0F5038',
  800: '#0A3828',
  900: '#062518',
} as const;

// ── Vivid accent palette (for stat tiles, nav items, category chips) ──────
export const vivid = {
  teal:    '#2EC4B6',
  amber:   '#F4B942',
  purple:  '#9B5DE5',
  coral:   '#F4845F',
  blue:    '#4A90D9',
  pink:    '#E84393',
  emerald: '#2ECC8A',
  indigo:  '#6B7FD4',
  violet:  '#C264E8',
} as const;

// ── Nav item colours (sidebar coloured pills) ─────────────────────────────
export const navColors = [
  { bg: '#93C5FD', active: '#1D4ED8', dot: '#3B82F6' },  // home — blue
  { bg: '#6EE7B7', active: '#065F46', dot: '#10B981' },  // attendance — mint
  { bg: '#FCD34D', active: '#92400E', dot: '#F59E0B' },  // progress — amber
  { bg: '#C4B5FD', active: '#4C1D95', dot: '#7C3AED' },  // insights — violet
  { bg: '#99F6E4', active: '#134E4A', dot: '#14B8A6' },  // chat — teal
  { bg: '#F9A8D4', active: '#9D174D', dot: '#EC4899' },  // messages — pink
  { bg: '#FDBA74', active: '#7C2D12', dot: '#F97316' },  // updates — orange
  { bg: '#7DD3FC', active: '#0C4A6E', dot: '#0EA5E9' },  // settings — sky
] as const;

// ── Backgrounds ───────────────────────────────────────────────────────────
export const backgrounds = {
  page:    'linear-gradient(135deg,#F0FFF4 0%,#F5F0FF 40%,#EAF4FF 100%)',
  sidebar: 'linear-gradient(160deg,#B8D8F8 0%,#C4B8F0 50%,#B8E0F8 100%)',
  header:  'linear-gradient(135deg,#166A4D 0%,#1F7A5A 50%,#52B788 100%)',
  glass:   'rgba(255,255,255,0.85)',
} as const;

// ── Glass card style (apply as inline style) ──────────────────────────────
export const glassCard = {
  background:           backgrounds.glass,
  backdropFilter:       'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  boxShadow:            '0 2px 4px rgba(22,106,77,0.06), 0 8px 24px rgba(22,106,77,0.08), inset 0 1px 0 rgba(255,255,255,0.95)',
  border:               '1px solid rgba(255,255,255,0.7)',
} as const;

// ── Legacy token names (kept for backward compat with existing pages) ─────
export const colors = {
  primary: {
    50:  brand[50],
    100: brand[100],
    200: brand[200],
    300: brand[300],
    400: brand[400],
    500: brand[500],
    600: 'var(--brand-primary)',
    700: 'var(--brand-primary-dark)',
  },
  accent: {
    50:  '#FFF8E7',
    500: '#E8960C',
    600: '#C47A08',
  },
  neutral: {
    0:   '#FFFFFF',
    50:  '#FAFAF9',
    100: '#F5F4F2',
    200: '#ECEAE7',
    300: '#DDD9D4',
    400: '#C4BEB7',
    500: '#9E9690',
    600: '#736D67',
    700: '#524E4A',
    800: '#332F2C',
    900: '#1C1917',
  },
  semantic: {
    success: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    warning: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'  },
    danger:  { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200'    },
    info:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'   },
  },
} as const;

export const spacing = {
  xs:  'p-2',
  sm:  'p-3',
  md:  'p-4',
  lg:  'p-5',
  xl:  'p-6',
  '2xl': 'p-8',
} as const;

export const radius = {
  sm:  'rounded-lg',
  md:  'rounded-xl',
  lg:  'rounded-2xl',
  xl:  'rounded-3xl',
  full: 'rounded-full',
} as const;

export const shadow = {
  xs:   'shadow-xs',
  sm:   'shadow-sm',
  md:   'shadow-md',
  card: 'shadow-card',
  'card-hover': 'shadow-card-hover',
} as const;

export const typography = {
  heading: {
    xl:  'text-2xl font-semibold text-neutral-900',
    lg:  'text-xl font-semibold text-neutral-900',
    md:  'text-base font-semibold text-neutral-800',
    sm:  'text-sm font-semibold text-neutral-800',
    xs:  'text-xs font-semibold text-neutral-700',
  },
  body: {
    lg:  'text-base text-neutral-700',
    md:  'text-sm text-neutral-700',
    sm:  'text-xs text-neutral-600',
    xs:  'text-2xs text-neutral-500',
  },
  muted: 'text-neutral-500',
  label: 'text-xs font-medium text-neutral-600',
} as const;

export const animation = {
  fadeIn:    'animate-fade-in',
  slideUp:   'animate-slide-up',
  scaleIn:   'animate-scale-in',
  shimmer:   'animate-shimmer',
} as const;

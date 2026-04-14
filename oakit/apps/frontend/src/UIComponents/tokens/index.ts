/**
 * Oakit Design Tokens
 * Single source of truth for all design decisions.
 * These map to the Tailwind config — use these constants in JS/TS logic,
 * use the Tailwind classes in JSX.
 */

export const colors = {
  primary: {
    50:  '#F0F7F4',
    100: '#D6EDE4',
    200: '#AEDBC9',
    300: '#7DC3A8',
    400: '#4FA585',
    500: '#2E7D5E',
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

import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Primary — uses CSS variable so brand color changes apply everywhere
        primary: {
          DEFAULT: 'var(--brand-primary)',
          50:  '#F0F7F4',
          100: '#D6EDE4',
          200: '#AEDBC9',
          300: '#7DC3A8',
          400: '#4FA585',
          500: '#2E7D5E',
          600: 'var(--brand-primary)',  // main
          700: 'var(--brand-primary-dark)',
          800: '#0F261B',
          900: '#091810',
        },
        // Accent — warm amber
        accent: {
          DEFAULT: '#E8960C',
          50:  '#FFF8E7',
          100: '#FEEFC3',
          200: '#FDDF87',
          300: '#FCC94B',
          400: '#F5B01A',
          500: '#E8960C',  // main
          600: '#C47A08',
          700: '#9A5F06',
          800: '#714504',
          900: '#4A2D02',
        },
        // Neutrals — warm gray (Apple-like)
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
        surface: '#FFFFFF',
        bg: '#F7F6F4',
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"',
          '"Segoe UI"', 'Inter', 'sans-serif'
        ],
        mono: ['"SF Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'xs':   '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        'sm':   '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'md':   '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
        'lg':   '0 10px 15px -3px rgb(0 0 0 / 0.06), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
        'xl':   '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.04)',
        '2xl':  '0 25px 50px -12px rgb(0 0 0 / 0.18)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04)',
        'inner-sm': 'inset 0 1px 2px 0 rgb(0 0 0 / 0.04)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-hero': 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-light) 50%, var(--brand-primary) 100%)',
        'gradient-card': 'linear-gradient(145deg, #FFFFFF 0%, #F7F6F4 100%)',
        'gradient-amber': 'linear-gradient(135deg, #E8960C 0%, #F5B01A 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'shimmer': 'shimmer 1.5s infinite',
        'fade-slide-up': 'fadeslideup 0.3s ease-out',
        'streak-pop': 'streakpop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        'bounce-dot': 'bouncedot 1.2s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        fadeslideup: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        streakpop: { from: { opacity: '0', transform: 'scale(0.8)' }, to: { opacity: '1', transform: 'scale(1)' } },
        bouncedot: { '0%, 80%, 100%': { transform: 'scale(0)' }, '40%': { transform: 'scale(1)' } },
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
    },
  },
  plugins: [],
};

export default config;

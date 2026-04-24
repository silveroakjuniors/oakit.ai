'use client';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface ThemeToggleProps {
  variant?: 'icon' | 'pill';
  className?: string;
}

export default function ThemeToggle({ variant = 'pill', className = '' }: ThemeToggleProps) {
  const { colorMode, toggleColorMode } = useTheme();
  const isDark = colorMode === 'dark';

  if (variant === 'icon') {
    return (
      <button
        onClick={toggleColorMode}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
          isDark
            ? 'bg-white/10 hover:bg-white/20 text-white/70'
            : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
        } ${className}`}
      >
        {isDark ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    );
  }

  // Pill variant — Airbnb-style toggle
  return (
    <button
      onClick={toggleColorMode}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`relative flex items-center gap-1 p-1 rounded-full border transition-all active:scale-95 ${
        isDark
          ? 'bg-white/10 border-white/15 hover:bg-white/15'
          : 'bg-neutral-100 border-neutral-200 hover:bg-neutral-200'
      } ${className}`}
    >
      {/* Sun */}
      <span className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
        !isDark ? 'bg-white shadow-sm text-amber-500' : 'text-white/40'
      }`}>
        <Sun size={13} />
      </span>
      {/* Moon */}
      <span className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
        isDark ? 'bg-white/20 text-white' : 'text-neutral-400'
      }`}>
        <Moon size={13} />
      </span>
    </button>
  );
}

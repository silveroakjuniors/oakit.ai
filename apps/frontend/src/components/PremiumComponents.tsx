'use client';

import { useTheme } from '@/contexts/ThemeContext';

/**
 * Premium Brand Header Component
 * Displays OakIT logo and branding
 */
export function BrandHeader() {
  const { palette } = useTheme();

  return (
    <div className="flex items-center gap-3 px-4">
      {/* Lion Logo Placeholder - Replace with actual SVG/image */}
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
        style={{ backgroundColor: palette.primary }}
      >
        🦁
      </div>
      <div className="flex flex-col">
        <h1 className="font-black text-lg tracking-tight" style={{ color: palette.primary }}>
          OakIT.ai
        </h1>
        <p className="text-xs text-neutral-500">Curriculum Platform</p>
      </div>
    </div>
  );
}

/**
 * Premium Button Component
 */
interface PremiumButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export function PremiumButton({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  disabled,
  className = '',
  icon,
}: PremiumButtonProps) {
  const { palette } = useTheme();

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const baseClasses = `${sizeClasses[size]} font-semibold rounded-lg flex items-center gap-2 transition-all duration-200`;

  let variantClasses = '';
  let style = {};

  if (variant === 'primary') {
    variantClasses = 'text-white hover:shadow-lg active:scale-95';
    style = { backgroundColor: palette.primary };
  } else if (variant === 'secondary') {
    variantClasses = 'border-2 hover:shadow-md active:scale-95';
    style = { borderColor: palette.primary, color: palette.primary };
  } else if (variant === 'ghost') {
    variantClasses = 'hover:bg-neutral-100 active:scale-95';
    style = { color: palette.primary };
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      style={style}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * Premium Card Component
 */
interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  gradient?: boolean;
  onClick?: () => void;
}

export function PremiumCard({ children, className = '', elevated = false, gradient = false, onClick }: PremiumCardProps) {
  const { palette } = useTheme();

  const baseClasses = 'bg-white rounded-2xl border border-neutral-200 transition-all duration-200';
  const hoverClasses = onClick ? 'cursor-pointer hover:shadow-lg hover:border-neutral-300' : '';
  const shadowClasses = elevated ? 'shadow-lg' : 'shadow-sm';
  
  let style = {};
  if (gradient) {
    style = {
      backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.9), ${palette.primaryLightest}20)`,
    };
  }

  return (
    <div
      onClick={onClick}
      className={`${baseClasses} ${hoverClasses} ${shadowClasses} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

/**
 * Premium Stat Pill Component
 */
interface PremiumStatPillProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  color?: 'primary' | 'success' | 'warning' | 'error';
}

export function PremiumStatPill({
  label,
  value,
  icon,
  trend,
  trendLabel,
  color = 'primary',
}: PremiumStatPillProps) {
  const { palette } = useTheme();

  const colorMap = {
    primary: { bg: palette.primaryLightest, text: palette.primary },
    success: { bg: '#D1FAE5', text: '#059669' },
    warning: { bg: '#FEF3C7', text: '#B45309' },
    error: { bg: '#FEE2E2', text: '#DC2626' },
  };

  const colorConfig = colorMap[color];

  return (
    <div className="bg-white rounded-xl p-4 border border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-neutral-600">{label}</p>
        {icon && <div className="text-lg opacity-60">{icon}</div>}
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-neutral-900">{value}</p>
        {trend !== undefined && (
          <div
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              trend >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </div>
        )}
      </div>
      {trendLabel && <p className="text-xs text-neutral-500 mt-2">{trendLabel}</p>}
    </div>
  );
}

/**
 * Premium Header with Theme
 */
interface PremiumHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function PremiumHeader({ title, subtitle, icon, action }: PremiumHeaderProps) {
  const { palette } = useTheme();

  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-neutral-200 shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon && <div className="text-2xl">{icon}</div>}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">{title}</h1>
            {subtitle && <p className="text-xs sm:text-sm text-neutral-500 mt-1">{subtitle}</p>}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}

/**
 * Premium Badge Component
 */
interface PremiumBadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  size?: 'sm' | 'md';
}

export function PremiumBadge({ label, variant = 'primary', size = 'sm' }: PremiumBadgeProps) {
  const { palette } = useTheme();

  const variants = {
    primary: { bg: palette.primaryLightest, text: palette.primary },
    success: { bg: '#D1FAE5', text: '#059669' },
    warning: { bg: '#FEF3C7', text: '#B45309' },
    error: { bg: '#FEE2E2', text: '#DC2626' },
    neutral: { bg: '#F3F4F6', text: '#6B7280' },
  };

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5';
  const config = variants[variant];

  return (
    <span
      className={`${sizeClasses} rounded-full font-semibold whitespace-nowrap`}
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {label}
    </span>
  );
}

/**
 * Premium Grid Container
 */
interface PremiumGridProps {
  children: React.ReactNode;
  cols?: number;
  gap?: 'sm' | 'md' | 'lg';
}

export function PremiumGrid({ children, cols = 3, gap = 'md' }: PremiumGridProps) {
  const gapClasses = {
    sm: 'gap-2 sm:gap-3',
    md: 'gap-3 sm:gap-4',
    lg: 'gap-4 sm:gap-6',
  };

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${cols} ${gapClasses[gap]}`}>
      {children}
    </div>
  );
}

/**
 * Premium TabNav Component
 */
interface TabNavItem {
  id: string;
  label: string;
  icon?: string;
}

interface PremiumTabNavProps {
  tabs: TabNavItem[];
  activeTab: string;
  onChangeTab: (tabId: string) => void;
}

export function PremiumTabNav({ tabs, activeTab, onChangeTab }: PremiumTabNavProps) {
  const { palette } = useTheme();

  return (
    <div className="sticky top-16 sm:top-20 z-30 bg-white border-b border-neutral-200 overflow-x-auto">
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex gap-1 sm:gap-2 py-3">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'text-white shadow-sm'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
              style={
                activeTab === tab.id
                  ? { backgroundColor: palette.primary }
                  : {}
              }
            >
              {tab.icon && <span className="mr-1">{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

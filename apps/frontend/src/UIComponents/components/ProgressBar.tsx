interface ProgressBarProps {
  value: number;        // 0–100
  max?: number;
  label?: string;
  sublabel?: string;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'amber';
  size?: 'xs' | 'sm' | 'md';
  showValue?: boolean;
  animated?: boolean;
}

const colors = {
  primary: 'bg-primary-600',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  amber:   'bg-accent-500',
};

const heights = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2',
};

export function ProgressBar({ value, max = 100, label, sublabel, color = 'primary', size = 'sm', showValue = false, animated = false }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs font-medium text-neutral-700">{label}</span>}
          {sublabel && <span className="text-xs text-neutral-500">{sublabel}</span>}
          {showValue && !sublabel && <span className="text-xs font-semibold text-neutral-700">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className={`w-full bg-neutral-100 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${heights[size]} rounded-full transition-all duration-500 ease-out ${colors[color]} ${animated ? 'animate-shimmer bg-gradient-to-r from-current via-white/20 to-current bg-[length:200%_100%]' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;

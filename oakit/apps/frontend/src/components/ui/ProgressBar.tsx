'use client';

interface ProgressBarProps {
  percent: number;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export default function ProgressBar({ percent, label, className = '', size = 'md', showLabel = true }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const color = clamped >= 70 ? 'bg-emerald-500' : clamped >= 40 ? 'bg-accent-500' : 'bg-red-400';
  const trackH = size === 'sm' ? 'h-1.5' : 'h-2';

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {(label || showLabel) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-xs text-neutral-500">{label}</span>}
          {showLabel && (
            <span className={`text-xs font-semibold tabular-nums ${
              clamped >= 70 ? 'text-emerald-600' : clamped >= 40 ? 'text-accent-600' : 'text-red-500'
            }`}>{clamped}%</span>
          )}
        </div>
      )}
      <div className={`w-full bg-neutral-100 rounded-full ${trackH} overflow-hidden`}>
        <div
          className={`${trackH} rounded-full transition-all duration-700 ease-apple ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

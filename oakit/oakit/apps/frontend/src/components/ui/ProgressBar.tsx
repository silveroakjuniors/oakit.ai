'use client';

interface ProgressBarProps {
  percent: number;
  label?: string;
  className?: string;
}

export default function ProgressBar({ percent, label, className = '' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <span className="text-xs text-gray-500">{label}</span>}
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-primary h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 text-right">{clamped}%</span>
    </div>
  );
}

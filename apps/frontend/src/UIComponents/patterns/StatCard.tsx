import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subvalue?: string;
  icon?: ReactNode;
  trend?: { value: number; label?: string };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'blue' | 'purple';
  onClick?: () => void;
}

// Icon container tints — small usage only, not full card backgrounds
const iconColors = {
  primary: 'bg-primary-50 text-primary-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger:  'bg-red-50 text-red-600',
  neutral: 'bg-neutral-100 text-neutral-500',
  blue:    'bg-blue-50 text-blue-600',
  purple:  'bg-purple-50 text-purple-600',
};

export function StatCard({ label, value, subvalue, icon, trend, color = 'neutral', onClick }: StatCardProps) {
  const ic = iconColors[color];
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-neutral-200 p-4 transition-all duration-150 ${onClick ? 'hover:border-neutral-300 cursor-pointer' : ''}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-neutral-500 mb-1 truncate">{label}</p>
          <p className="text-2xl font-semibold text-neutral-900 leading-tight">{value}</p>
          {subvalue && <p className="text-xs text-neutral-400 mt-0.5">{subvalue}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              {trend.label && <span className="text-neutral-400 font-normal">{trend.label}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ic}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;

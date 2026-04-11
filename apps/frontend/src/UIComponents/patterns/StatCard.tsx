import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subvalue?: string;
  icon?: ReactNode;
  trend?: { value: number; label?: string };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  onClick?: () => void;
}

const colors = {
  primary: { icon: 'bg-primary-50 text-primary-600', value: 'text-primary-700' },
  success: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-700' },
  warning: { icon: 'bg-amber-50 text-amber-600',     value: 'text-amber-700'   },
  danger:  { icon: 'bg-red-50 text-red-600',         value: 'text-red-700'     },
  neutral: { icon: 'bg-neutral-100 text-neutral-600', value: 'text-neutral-800' },
};

export function StatCard({ label, value, subvalue, icon, trend, color = 'neutral', onClick }: StatCardProps) {
  const c = colors[color];
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-neutral-200/80 shadow-card p-4 transition-all duration-150 ${onClick ? 'hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-neutral-500 mb-1 truncate">{label}</p>
          <p className={`text-2xl font-bold ${c.value}`}>{value}</p>
          {subvalue && <p className="text-xs text-neutral-400 mt-0.5">{subvalue}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
              {trend.label && <span className="text-neutral-400 font-normal">{trend.label}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.icon}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;

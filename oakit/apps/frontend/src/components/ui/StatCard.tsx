import SkeletonLoader from './SkeletonLoader';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  loading?: boolean;
  colorScheme?: 'green' | 'blue' | 'amber' | 'red' | 'neutral' | 'primary';
  trend?: { direction: 'up' | 'down'; label: string };
  className?: string;
}

// Icon tints only — no full colored card backgrounds
const iconTints = {
  green:   'bg-emerald-50 text-emerald-600',
  blue:    'bg-blue-50 text-blue-600',
  amber:   'bg-amber-50 text-amber-600',
  red:     'bg-red-50 text-red-600',
  neutral: 'bg-neutral-100 text-neutral-500',
  primary: 'bg-primary-50 text-primary-600',
};

export default function StatCard({ label, value, sub, loading, colorScheme = 'neutral', trend, className = '' }: StatCardProps) {
  const tint = iconTints[colorScheme];
  return (
    <div className={`bg-white border border-neutral-200 rounded-xl p-4 ${className}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      {loading ? (
        <SkeletonLoader variant="stat" count={1} />
      ) : (
        <>
          <p className="text-xs font-medium text-neutral-500 mb-1">{label}</p>
          <p className="text-2xl font-semibold text-neutral-900 leading-tight">{value}</p>
          {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
          {trend && (
            <p className={`text-xs mt-1 font-medium ${trend.direction === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend.direction === 'up' ? '↑' : '↓'} {trend.label}
            </p>
          )}
        </>
      )}
    </div>
  );
}

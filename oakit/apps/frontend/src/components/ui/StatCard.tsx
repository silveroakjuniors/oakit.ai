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

const schemes = {
  green:   { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700', sub: 'text-emerald-600/70' },
  blue:    { bg: 'bg-blue-50 border-blue-100',       text: 'text-blue-700',    sub: 'text-blue-600/70' },
  amber:   { bg: 'bg-amber-50 border-amber-100',     text: 'text-amber-700',   sub: 'text-amber-600/70' },
  red:     { bg: 'bg-red-50 border-red-100',         text: 'text-red-600',     sub: 'text-red-500/70' },
  neutral: { bg: 'bg-white border-neutral-100',      text: 'text-neutral-800', sub: 'text-neutral-500' },
  primary: { bg: 'bg-primary-50 border-primary-100', text: 'text-primary-700', sub: 'text-primary-600/70' },
};

export default function StatCard({ label, value, sub, loading, colorScheme = 'neutral', trend, className = '' }: StatCardProps) {
  const s = schemes[colorScheme];
  return (
    <div className={`${s.bg} border rounded-2xl p-4 ${className}`}>
      {loading ? (
        <SkeletonLoader variant="stat" count={1} />
      ) : (
        <>
          <p className="text-xs font-medium text-neutral-500 mb-1">{label}</p>
          <p className={`text-2xl font-bold leading-tight ${s.text}`}>{value}</p>
          {sub && <p className={`text-xs mt-0.5 ${s.sub}`}>{sub}</p>}
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

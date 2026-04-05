interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'amber' | 'purple';
  size?: 'sm' | 'md';
  dot?: boolean;
}

const variants = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  warning: 'bg-amber-50 text-amber-700 border-amber-200/80',
  danger:  'bg-red-50 text-red-600 border-red-200/80',
  info:    'bg-blue-50 text-blue-700 border-blue-200/80',
  neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200/80',
  amber:   'bg-accent-50 text-accent-700 border-accent-200/80',
  purple:  'bg-purple-50 text-purple-700 border-purple-200/80',
};

const dotColors = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  neutral: 'bg-neutral-400',
  amber:   'bg-accent-500',
  purple:  'bg-purple-500',
};

const sizes = {
  sm: 'px-2 py-0.5 text-2xs',
  md: 'px-2.5 py-1 text-xs',
};

export default function Badge({ label, variant = 'neutral', size = 'md', dot = false }: BadgeProps) {
  return (
    <span className={`
      inline-flex items-center gap-1.5 rounded-full font-medium border
      ${variants[variant]} ${sizes[size]}
    `}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />}
      {label}
    </span>
  );
}

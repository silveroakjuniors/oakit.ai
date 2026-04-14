interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'neutral';
  label?: string;
}

const sizes = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-2',
};

const colors = {
  primary: 'border-primary-200 border-t-primary-600',
  white:   'border-white/30 border-t-white',
  neutral: 'border-neutral-200 border-t-neutral-500',
};

export function Spinner({ size = 'md', color = 'primary', label }: SpinnerProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`rounded-full animate-spin ${sizes[size]} ${colors[color]}`} />
      {label && <p className="text-xs text-neutral-500">{label}</p>}
    </div>
  );
}

export default Spinner;

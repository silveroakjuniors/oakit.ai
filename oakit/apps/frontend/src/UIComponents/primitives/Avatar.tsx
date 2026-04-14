interface AvatarProps {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'circle' | 'rounded';
}

const sizes = {
  xs: 'w-6 h-6 text-2xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function getColor(name: string): string {
  const colors = [
    'bg-primary-100 text-primary-700',
    'bg-amber-100 text-amber-700',
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-emerald-100 text-emerald-700',
    'bg-rose-100 text-rose-700',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export function Avatar({ name = '', src, size = 'md', variant = 'circle' }: AvatarProps) {
  const radius = variant === 'circle' ? 'rounded-full' : 'rounded-xl';
  const sizeClass = sizes[size];

  if (src) {
    return (
      <img src={src} alt={name} className={`${sizeClass} ${radius} object-cover shrink-0`} />
    );
  }

  return (
    <div className={`${sizeClass} ${radius} ${getColor(name)} flex items-center justify-center font-semibold shrink-0`}>
      {getInitials(name) || '?'}
    </div>
  );
}

export default Avatar;

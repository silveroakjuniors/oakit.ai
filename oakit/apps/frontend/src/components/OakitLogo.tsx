interface OakitLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
}

const sizeMap = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-5xl',
};

export default function OakitLogo({ size = 'md', variant = 'dark' }: OakitLogoProps) {
  const oakitColor = variant === 'dark' ? '#1B4332' : '#FFFFFF';
  return (
    <span className={`font-bold tracking-tight ${sizeMap[size]}`}>
      <span style={{ color: oakitColor }}>Oakit</span>
      <span style={{ color: '#F5A623' }}>.ai</span>
    </span>
  );
}

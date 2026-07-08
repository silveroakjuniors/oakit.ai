import { ReactNode, CSSProperties } from 'react';
import { glassCard } from '../tokens';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const paddingMap = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' };

/**
 * GlassCard — Apple-level glassmorphism card.
 * Uses the design-system glass token so the look is consistent
 * across parent, teacher, principal, admin, and student portals.
 *
 * Usage:
 *   import { GlassCard } from '@/UIComponents';
 *   <GlassCard>…</GlassCard>
 */
export function GlassCard({ children, className = '', style, padding = 'md', onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl ${paddingMap[padding]} ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`}
      style={{ ...glassCard, ...style }}
    >
      {children}
    </div>
  );
}

export default GlassCard;

/**
 * Ring — animated SVG progress ring.
 * Used in parent portal, principal dashboard, student portal.
 *
 * Usage:
 *   import { Ring } from '@/UIComponents';
 *   <Ring pct={74} color="#166A4D" size={100} stroke={10} />
 */
interface RingProps {
  pct: number;
  color: string;
  size?: number;
  stroke?: number;
  trackColor?: string;
}

export function Ring({ pct, color, size = 100, stroke = 10, trackColor = 'rgba(255,255,255,0.4)' }: RingProps) {
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${(clamped / 100) * c} ${c}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
    </svg>
  );
}

export default Ring;

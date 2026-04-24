'use client';
import { useState, useEffect } from 'react';
import { Calendar, Clock, UserCheck, UserX } from 'lucide-react';
import type { AttendanceData } from '../types';

const P = {
  brand: '#1F7A5A', brandDark: '#166A4D', brandSoft: '#E8F3EF', brandBorder: '#A7D4C0',
  bg: '#F8FAFC', card: '#F8FAFC', border: '#E4E4E7',
  text: '#18181B', textSub: '#3F3F46', textMuted: '#71717A',
};

const cardStyle: React.CSSProperties = {
  background: P.card, border: `1px solid ${P.border}`,
  borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  transition: 'box-shadow 0.18s ease, transform 0.18s ease',
};

const cardHoverClass = 'hover:shadow-md hover:-translate-y-0.5';

function SectionLabel({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={14} strokeWidth={1.75} style={{ color: P.textMuted }} />
      <p className="text-sm font-semibold" style={{ color: P.textSub }}>{text}</p>
    </div>
  );
}

function Ring({ pct, color, size = 110, stroke = 11 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const [a, setA] = useState(0);
  useEffect(() => { const id = setTimeout(() => setA(pct), 120); return () => clearTimeout(id); }, [pct]);
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={P.border} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${(a/100)*c} ${c}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
    </svg>
  );
}

export default function AttendanceTab({ data }: { data: AttendanceData | null }) {
  if (!data) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: P.brandSoft }}>
        <Calendar size={28} strokeWidth={1.5} style={{ color: P.brand }} />
      </div>
      <p className="text-sm font-semibold mb-1" style={{ color: P.text }}>No attendance data yet</p>
      <p className="text-sm" style={{ color: P.textMuted }}>Attendance will appear once the teacher starts marking</p>
    </div>
  );

  const { stats, attendance_pct, punctuality_pct, records } = data;
  const attColor  = attendance_pct  >= 75 ? P.brand    : '#DC2626';
  const punctColor = punctuality_pct >= 80 ? '#1D4ED8' : '#B45309';

  return (
    <div className="space-y-4 pb-6">

      {/* Stat rings */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-5 flex flex-col items-center ${cardHoverClass}`} style={cardStyle}>
          <div className="relative flex items-center justify-center mb-2">
            <Ring pct={attendance_pct} color={attColor} />
            <div className="absolute text-center">
              <p className="text-xl font-semibold leading-none" style={{ color: attColor }}>{attendance_pct}%</p>
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: P.textMuted }}>Attendance</p>
          <p className="text-xs mt-1" style={{ color: P.textMuted }}>{stats.present} present · {stats.absent} absent</p>
        </div>
        <div className={`p-5 flex flex-col items-center ${cardHoverClass}`} style={cardStyle}>
          <div className="relative flex items-center justify-center mb-2">
            <Ring pct={punctuality_pct} color={punctColor} />
            <div className="absolute text-center">
              <p className="text-xl font-semibold leading-none" style={{ color: punctColor }}>{punctuality_pct}%</p>
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: P.textMuted }}>Punctuality</p>
          <p className="text-xs mt-1" style={{ color: P.textMuted }}>{stats.on_time} on time · {stats.late} late</p>
        </div>
      </div>

      {/* Calendar grid */}
      <div className={`p-5 ${cardHoverClass}`} style={cardStyle}>
        <SectionLabel icon={Calendar} text="Attendance — Last 60 Days" />
        <div className="flex flex-wrap gap-1.5">
          {records.map((r, i) => {
            const day = parseInt((r.attend_date || '').split('T')[0].split('-')[2] || '0');
            const isLate    = r.status === 'present' && r.is_late;
            const isPresent = r.status === 'present' && !r.is_late;
            const bg    = isLate ? '#FEF9C3' : isPresent ? P.brandSoft : '#FEE2E2';
            const color = isLate ? '#B45309'  : isPresent ? P.brandDark : '#DC2626';
            const mark  = isLate ? '~' : isPresent ? '✓' : '✗';
            return (
              <div key={i} title={(r.attend_date || '').split('T')[0]}
                className="w-9 h-9 rounded-lg flex flex-col items-center justify-center transition-all hover:scale-110 hover:shadow-sm cursor-default"
                style={{ background: bg, border: `1px solid ${color}25` }}>
                <span className="text-[11px] leading-none font-semibold" style={{ color }}>{day}</span>
                <span className="text-[9px] leading-none mt-0.5 font-bold" style={{ color }}>{mark}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-4 pt-3 text-xs border-t" style={{ borderColor: P.border }}>
          <span className="flex items-center gap-1.5" style={{ color: P.textMuted }}>
            <span className="w-3 h-3 rounded" style={{ background: P.brandSoft, display: 'inline-block' }} />Present
          </span>
          <span className="flex items-center gap-1.5" style={{ color: P.textMuted }}>
            <span className="w-3 h-3 rounded" style={{ background: '#FEF9C3', display: 'inline-block' }} />Late
          </span>
          <span className="flex items-center gap-1.5" style={{ color: P.textMuted }}>
            <span className="w-3 h-3 rounded" style={{ background: '#FEE2E2', display: 'inline-block' }} />Absent
          </span>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Days', value: stats.total,   color: P.text,    Icon: Calendar  },
          { label: 'Present',    value: stats.present, color: P.brand,   Icon: UserCheck },
          { label: 'Absent',     value: stats.absent,  color: '#DC2626', Icon: UserX     },
        ].map(s => (
          <div key={s.label} className={`p-4 text-center ${cardHoverClass}`} style={cardStyle}>
            <s.Icon size={16} strokeWidth={1.75} className="mx-auto mb-1" style={{ color: s.color }} />
            <p className="text-2xl font-semibold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: P.textMuted }}>{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

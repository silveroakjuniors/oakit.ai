'use client';
import { LogOut, Bell } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import AnimatedNumber from './AnimatedNumber';
import type { PrincipalContext } from './types';

interface Props {
  ctx: PrincipalContext;
  todayLabel: string;
  onSignOut: () => void;
  pendingCount: number;
}

export default function HeroHeader({ ctx, todayLabel, onSignOut, pendingCount }: Props) {
  const attendancePct = ctx.summary.total_students > 0
    ? Math.round((ctx.summary.total_present / ctx.summary.total_students) * 100)
    : 0;

  const stats = [
    { label: 'Students',  value: ctx.summary.total_students, sub: `${ctx.summary.total_sections} sections`, color: '#74c69d' },
    { label: 'Present',   value: ctx.summary.total_present,  sub: `${attendancePct}% today`,                color: '#4ade80' },
    { label: 'Absent',    value: ctx.summary.total_absent,   sub: 'follow up',                              color: '#f87171' },
  ];

  return (
    <header
      className="relative overflow-hidden text-white shrink-0"
      style={{ background: 'linear-gradient(135deg, #0a1f14 0%, #1a3c2e 55%, #2d6a4f 100%)' }}
    >
      {/* subtle blob */}
      <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-[0.08] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #52b788, transparent)' }} />

      <div className="relative z-10 flex items-center gap-4 px-5 py-3.5">

        {/* Left: greeting */}
        <div className="flex-1 min-w-0">
          <p className="text-white/40 text-[10px] leading-none mb-0.5">{todayLabel}</p>
          <p className="text-white font-bold text-base leading-tight truncate">{ctx.greeting}</p>
          <p className="text-white/30 text-[10px] mt-0.5 italic truncate hidden sm:block">
            "{ctx.thought_for_day}"
          </p>
        </div>

        {/* Centre: 3 stat pills — hidden on very small screens, shown from sm */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {stats.map((s, i) => (
            <div key={i}
              className="flex flex-col items-center px-3 py-2 rounded-xl border border-white/10 min-w-[68px]"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <p className="text-xl font-black leading-none" style={{ color: s.color }}>
                <AnimatedNumber value={s.value} />
              </p>
              <p className="text-white/60 text-[9px] font-semibold mt-0.5">{s.label}</p>
              <p className="text-white/25 text-[8px]">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <div className="relative">
              <Bell className="w-4 h-4 text-white/50" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            </div>
          )}
          <ThemeToggle variant="icon" />
          <button
            onClick={onSignOut}
            className="text-white/30 hover:text-white/70 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile: stat strip below greeting */}
      <div className="md:hidden flex border-t border-white/10">
        {stats.map((s, i) => (
          <div key={i}
            className={`flex-1 py-2 text-center ${i < stats.length - 1 ? 'border-r border-white/10' : ''}`}>
            <p className="text-lg font-black leading-none" style={{ color: s.color }}>
              <AnimatedNumber value={s.value} />
            </p>
            <p className="text-white/50 text-[9px] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </header>
  );
}

'use client';
import { useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import Link from 'next/link';
import type { PrincipalContext } from './types';

const RADIAN = Math.PI / 180;
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.08) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
    fontSize={9} fontWeight={700}>{`${(percent * 100).toFixed(0)}%`}</text>;
}

// ── Attendance drill-down popup ───────────────────────────────────────────────
function AttendanceDrillDown({
  byClass, onClose,
}: {
  byClass: Record<string, any[]>;
  onClose: () => void;
}) {
  const classBar = Object.entries(byClass).map(([name, secs]) => ({
    name: name.length > 8 ? name.slice(0, 7) : name,
    full: name,
    present:  secs.reduce((s: number, sec: any) => s + sec.present_today, 0),
    absent:   secs.reduce((s: number, sec: any) => s + sec.absent_today, 0),
    total:    secs.reduce((s: number, sec: any) => s + sec.total_students, 0),
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div>
            <p className="text-sm font-bold text-neutral-800">Attendance by Class</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">Today's attendance breakdown per class</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/principal/attendance"
              className="text-xs font-semibold text-[#1B4332] hover:underline">
              Full report →
            </Link>
            <button onClick={onClose}
              className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-colors">
              ✕
            </button>
          </div>
        </div>

        <div className="p-5">
          {/* Bar chart */}
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classBar} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: any, name: string, p: any) => [
                    `${v} students (${p.payload.full})`,
                    name === 'present' ? 'Present' : 'Absent',
                  ]} />
                <Bar dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent"  name="Absent"  fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Per-class rows */}
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
            {classBar.map(c => {
              const pct = c.total > 0 ? Math.round((c.present / c.total) * 100) : 0;
              return (
                <div key={c.full} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-100">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-neutral-800">{c.full}</p>
                      <span className={`text-[10px] font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                      <div className="h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#f87171' }} />
                    </div>
                    <p className="text-[9px] text-neutral-400 mt-0.5">
                      {c.present} present · {c.absent} absent · {c.total} total
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  ctx: PrincipalContext;
  avgCovPct: number;
  attPct: number;
  planPct: number;
  byClass: Record<string, any[]>;
}

export default function SchoolHealthCharts({ ctx, avgCovPct, attPct, planPct, byClass }: Props) {
  const [showAttDrill, setShowAttDrill] = useState(false);
  const totalSections = ctx.summary.total_sections;
  const hwPct = totalSections > 0
    ? Math.round(((ctx.summary.homework_sent ?? 0) / totalSections) * 100)
    : 0;

  // Attendance pie (for the clickable card)
  const attPie = [
    { name: 'Present',    value: ctx.summary.total_present,  color: '#10b981' },
    { name: 'Absent',     value: ctx.summary.total_absent,   color: '#f87171' },
    {
      name: 'Not Marked',
      value: Math.max(0, ctx.summary.total_students - ctx.summary.total_present - ctx.summary.total_absent),
      color: '#d1d5db',
    },
  ].filter(d => d.value > 0);

  const attendancePct = ctx.summary.total_students > 0
    ? Math.round((ctx.summary.total_present / ctx.summary.total_students) * 100)
    : 0;

  // 4 KPI rings — each links to its module
  const kpis = [
    {
      label: 'Curriculum', value: avgCovPct,
      sub: 'avg coverage',
      color: '#10b981', track: '#d1fae5',
      href: '/principal/coverage',
    },
    {
      label: 'Att. Submitted', value: attPct,
      sub: `${ctx.summary.attendance_submitted}/${totalSections}`,
      color: '#6366f1', track: '#e0e7ff',
      href: '/principal/attendance',
    },
    {
      label: 'Plans Done', value: planPct,
      sub: `${ctx.summary.plans_completed ?? 0}/${totalSections}`,
      color: '#f59e0b', track: '#fef3c7',
      href: '/principal/teachers',
    },
    {
      label: 'Homework', value: hwPct,
      sub: `${ctx.summary.homework_sent ?? 0}/${totalSections}`,
      color: '#38bdf8', track: '#e0f2fe',
      href: '/principal/teachers',
    },
  ];

  return (
    <>
      <div className="space-y-3">
        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
          Today's School Health
        </p>

        {/* ── 4 KPI rings — each is a link to the relevant page ── */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          {/* 2x2 on mobile, 4x1 on sm+ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {kpis.map(m => (
              <Link key={m.label} href={m.href}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-neutral-50 transition-colors group">
                {/* SVG ring */}
                <div className="relative w-12 h-12 sm:w-14 sm:h-14">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke={m.track} strokeWidth="3.5" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke={m.color} strokeWidth="3.5"
                      strokeDasharray={`${m.value} ${100 - m.value}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dasharray 1s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[11px] font-black" style={{ color: m.color }}>{m.value}%</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-neutral-700 group-hover:text-[#1B4332] transition-colors leading-tight">
                    {m.label}
                  </p>
                  <p className="text-[9px] text-neutral-400 leading-tight">{m.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Attendance pie — click to open class-wise drill-down ── */}
        {/* Only show when at least some attendance has been marked */}
        {(ctx.summary.total_present > 0 || ctx.summary.total_absent > 0) && (
        <button
          onClick={() => setShowAttDrill(true)}
          className="w-full bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 hover:border-[#1B4332]/30 hover:shadow-md transition-all text-left group"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-neutral-700">📊 Attendance Breakdown</p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-emerald-600">{attendancePct}% present</span>
              <span className="text-[10px] text-neutral-400 group-hover:text-[#1B4332] transition-colors">
                Class-wise →
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Donut */}
            <div className="w-24 h-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={attPie} cx="50%" cy="50%"
                    innerRadius={26} outerRadius={44}
                    dataKey="value" labelLine={false} label={PieLabel}>
                    {attPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(v: any) => [`${v} students`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex-1 space-y-1.5">
              {attPie.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                  <div className="flex-1 flex items-center justify-between">
                    <p className="text-[10px] text-neutral-600">{d.name}</p>
                    <p className="text-[10px] font-bold text-neutral-800">{d.value}</p>
                  </div>
                </div>
              ))}
              <div className="pt-1 border-t border-neutral-100">
                <p className="text-[9px] text-neutral-400">Tap to see class-wise breakdown</p>
              </div>
            </div>
          </div>
        </button>
        )}
      </div>

      {/* ── Drill-down popup ── */}
      {showAttDrill && (
        <AttendanceDrillDown byClass={byClass} onClose={() => setShowAttDrill(false)} />
      )}
    </>
  );
}

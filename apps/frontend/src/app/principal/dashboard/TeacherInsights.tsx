'use client';
import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Flame, X, TrendingUp, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { EngagementTeacher, TeacherStreak } from './types';

interface Props {
  engagement: EngagementTeacher[];
  streaks: TeacherStreak[];
  schoolDays30d: number;
}

const getColor  = (r: number) => r >= 80 ? '#10b981' : r >= 50 ? '#f59e0b' : '#f87171';
const getStatus = (r: number) => r >= 80 ? 'Excellent' : r >= 50 ? 'Moderate' : 'Needs attention';
const getStatusBg = (r: number) => r >= 80 ? 'bg-emerald-50 text-emerald-700' : r >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600';

const RADIAN = Math.PI / 180;
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.1) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
    fontSize={9} fontWeight={700}>{`${(percent * 100).toFixed(0)}%`}</text>;
}

// ── Individual teacher popup ──────────────────────────────────────────────────
function TeacherPopup({ teacher, schoolDays30d, onClose }: {
  teacher: EngagementTeacher; schoolDays30d: number; onClose: () => void;
}) {
  const rate = teacher.completion_rate_30d;
  const color = getColor(rate);
  const completed = teacher.completions_30d;
  const missed = Math.max(0, schoolDays30d - completed);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ background: color }}>{teacher.name[0]}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-neutral-800 truncate">{teacher.name}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getStatusBg(rate)}`}>
              {getStatus(rate)}
            </span>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-bold text-neutral-700">30-Day Plan Completion</p>
              <p className="text-xs font-black" style={{ color }}>{rate}%</p>
            </div>
            <div className="w-full bg-neutral-100 rounded-full h-3 overflow-hidden">
              <div className="h-3 rounded-full transition-all duration-700"
                style={{ width: `${rate}%`, background: `linear-gradient(90deg, ${color}80, ${color})` }} />
            </div>
            <div className="flex justify-between mt-1">
              <p className="text-[9px] text-neutral-400">{completed} plans completed</p>
              <p className="text-[9px] text-neutral-400">{missed} missed · {schoolDays30d} total days</p>
            </div>
          </div>

          {/* Streak dots */}
          <div>
            <p className="text-xs font-bold text-neutral-700 mb-2">Streak History</p>
            <div className="flex items-center gap-1 flex-wrap">
              {Array.from({ length: Math.min(teacher.best_streak, 20) }).map((_, i) => (
                <div key={i} className="w-3 h-3 rounded-sm"
                  style={{ background: i < teacher.current_streak ? (i < 5 ? '#f59e0b' : i < 10 ? '#10b981' : '#6366f1') : '#f3f4f6' }} />
              ))}
              {teacher.best_streak > 20 && <span className="text-[9px] text-neutral-400">+{teacher.best_streak - 20}</span>}
            </div>
            <div className="flex gap-3 mt-1">
              <p className="text-[9px] text-neutral-400"><span className="font-bold text-amber-600">{teacher.current_streak}</span> current</p>
              <p className="text-[9px] text-neutral-400"><span className="font-bold text-indigo-600">{teacher.best_streak}</span> best</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { l: 'Plans', v: `${completed}/${schoolDays30d}`, c: color },
              { l: 'Rate',  v: `${rate}%`,                     c: color },
              { l: 'Streak', v: `${teacher.current_streak}d`,  c: '#f59e0b' },
              { l: 'Best',  v: `${teacher.best_streak}d`,      c: '#6366f1' },
              { l: 'Last Plan', v: teacher.last_completed_date ?? 'Never', c: '#9ca3af' },
              { l: 'Status', v: getStatus(rate),               c: color },
            ].map(s => (
              <div key={s.l} className="bg-neutral-50 rounded-xl p-2 border border-neutral-100 text-center">
                <p className="text-[9px] text-neutral-400">{s.l}</p>
                <p className="text-[10px] font-black mt-0.5 leading-tight" style={{ color: s.c }}>{s.v}</p>
              </div>
            ))}
          </div>

          {teacher.amber_warning && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <span>⚠️</span>
              <p className="text-xs text-amber-700">No plan in <strong>{teacher.days_since_last}</strong> days. Follow up recommended.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Full list popup ───────────────────────────────────────────────────────────
function FullListPopup({ engagement, streaks, schoolDays30d, onClose, onSelectTeacher }: {
  engagement: EngagementTeacher[]; streaks: TeacherStreak[];
  schoolDays30d: number; onClose: () => void;
  onSelectTeacher: (t: EngagementTeacher) => void;
}) {
  const [tab, setTab] = useState<'eng' | 'streak'>('eng');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
          <div>
            <p className="text-sm font-bold text-neutral-800">Teacher Performance</p>
            <p className="text-[10px] text-neutral-400">{engagement.length} teachers · {schoolDays30d} school days</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/principal/teachers" className="text-xs font-semibold text-[#1B4332] hover:underline">
              Full report →
            </Link>
            <button onClick={onClose}
              className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 shrink-0">
          {[['eng', '📊 Engagement'], ['streak', '🔥 Streaks']] .map(([v, lbl]) => (
            <button key={v} onClick={() => setTab(v as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                tab === v ? 'bg-[#1B4332] text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
              }`}>{lbl}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {tab === 'eng' && engagement.map(t => (
            <button key={t.id} onClick={() => { onClose(); onSelectTeacher(t); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-50 border border-transparent hover:border-neutral-100 transition-all text-left">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: getColor(t.completion_rate_30d) }}>{t.name[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-xs font-semibold text-neutral-800 truncate">{t.name}</p>
                  {t.amber_warning && <span className="text-[8px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded shrink-0">⚠</span>}
                  {t.current_streak >= 5 && (
                    <span className="text-[8px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded shrink-0 flex items-center gap-0.5">
                      <Flame size={7} />{t.current_streak}
                    </span>
                  )}
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                  <div className="h-1.5 rounded-full" style={{ width: `${t.completion_rate_30d}%`, background: getColor(t.completion_rate_30d) }} />
                </div>
                <p className="text-[9px] text-neutral-400 mt-0.5">{t.completions_30d}/{schoolDays30d} plans · last: {t.last_completed_date ? new Date(t.last_completed_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'never'}</p>
              </div>
              <p className="text-sm font-black shrink-0" style={{ color: getColor(t.completion_rate_30d) }}>
                {t.completion_rate_30d}%
              </p>
            </button>
          ))}

          {tab === 'streak' && streaks.map((t, i) => (
            <div key={t.teacher_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-neutral-200 text-neutral-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-neutral-100 text-neutral-500'
              }`}>{i + 1}</div>
              <p className="text-xs font-semibold text-neutral-800 flex-1 truncate">{t.teacher_name}</p>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(t.current_streak, 7) }).map((_, j) => (
                  <div key={j} className="w-1.5 h-1.5 rounded-full"
                    style={{ background: j < 3 ? '#f59e0b' : j < 5 ? '#10b981' : '#6366f1' }} />
                ))}
                {t.current_streak > 7 && <span className="text-[9px] text-neutral-400">+{t.current_streak - 7}</span>}
              </div>
              <p className="text-sm font-black text-amber-600 flex items-center gap-0.5 shrink-0">
                <Flame size={11} className="text-orange-500" />{t.current_streak ?? 0}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main compact card ─────────────────────────────────────────────────────────
export default function TeacherInsights({ engagement, streaks, schoolDays30d }: Props) {
  const [showList, setShowList]           = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<EngagementTeacher | null>(null);

  if (engagement.length === 0 && streaks.length === 0) return null;

  const excellent = engagement.filter(t => t.completion_rate_30d >= 80);
  const moderate  = engagement.filter(t => t.completion_rate_30d >= 50 && t.completion_rate_30d < 80);
  const needsAttn = engagement.filter(t => t.completion_rate_30d < 50);

  const donutData = [
    { name: 'Excellent ≥80%',  value: excellent.length, color: '#10b981' },
    { name: 'Moderate 50–79%', value: moderate.length,  color: '#f59e0b' },
    { name: 'Needs attention', value: needsAttn.length, color: '#f87171' },
  ].filter(d => d.value > 0);

  // Top 3 needing attention first, then by rate
  const top3 = [...needsAttn, ...moderate, ...excellent].slice(0, 3);

  return (
    <>
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden
        animate-fade-in hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="px-4 pt-3.5 pb-3 border-b border-neutral-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-neutral-400" />
            <p className="text-sm font-bold text-neutral-800">Teacher Performance</p>
            <span className="text-[10px] text-neutral-400">· {schoolDays30d} school days</span>
          </div>
          <button onClick={() => setShowList(true)}
            className="text-[10px] font-semibold text-[#1B4332] hover:underline flex items-center gap-0.5">
            Full list <ChevronRight size={10} />
          </button>
        </div>

        <div className="p-4">
          {/* Donut + legend */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-24 h-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%"
                    innerRadius={26} outerRadius={44}
                    dataKey="value" labelLine={false} label={PieLabel}>
                    {donutData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }}
                    formatter={(v: any, name: any) => [`${v} teachers`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {donutData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                  <div className="flex-1 flex items-center justify-between">
                    <p className="text-[10px] text-neutral-600">{d.name}</p>
                    <p className="text-[10px] font-bold text-neutral-800">{d.value}</p>
                  </div>
                </div>
              ))}
              <div className="pt-1 border-t border-neutral-100">
                <p className="text-[9px] text-neutral-400">{engagement.length} teachers · click name to drill down</p>
              </div>
            </div>
          </div>

          {/* Top 3 — compact, clickable */}
          <div className="space-y-1">
            {top3.map(t => (
              <button key={t.id} onClick={() => setSelectedTeacher(t)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-neutral-50
                  border border-transparent hover:border-neutral-100 transition-all text-left group">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ background: getColor(t.completion_rate_30d) }}>{t.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-neutral-800 truncate">{t.name}</p>
                  <div className="w-full bg-neutral-100 rounded-full h-1 overflow-hidden mt-0.5">
                    <div className="h-1 rounded-full" style={{ width: `${t.completion_rate_30d}%`, background: getColor(t.completion_rate_30d) }} />
                  </div>
                </div>
                <p className="text-xs font-black shrink-0" style={{ color: getColor(t.completion_rate_30d) }}>
                  {t.completion_rate_30d}%
                </p>
              </button>
            ))}
          </div>

          {engagement.length > 3 && (
            <button onClick={() => setShowList(true)}
              className="w-full mt-2 py-1.5 text-[10px] font-semibold text-neutral-400 hover:text-[#1B4332] hover:bg-neutral-50 rounded-xl transition-colors">
              + {engagement.length - 3} more teachers
            </button>
          )}
        </div>
      </div>

      {showList && (
        <FullListPopup
          engagement={engagement} streaks={streaks}
          schoolDays30d={schoolDays30d}
          onClose={() => setShowList(false)}
          onSelectTeacher={t => setSelectedTeacher(t)}
        />
      )}

      {selectedTeacher && (
        <TeacherPopup
          teacher={selectedTeacher}
          schoolDays30d={schoolDays30d}
          onClose={() => setSelectedTeacher(null)}
        />
      )}
    </>
  );
}

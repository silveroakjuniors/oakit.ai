'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { ChevronLeft, TrendingUp, TrendingDown, Users, AlertCircle } from 'lucide-react';

interface DailyRow { date: string; present: number; absent: number; total: number; }
interface Summary {
  today_pct: number; week_pct: number; month_pct: number;
  absent_today: number; present_today: number;
}
interface TeacherStats {
  today: string; from: string; to: string; range_pct: number | null;
  summary: Summary; daily: DailyRow[];
  section_id: string; class_name: string; section_label: string;
}
interface SectionOption {
  section_id: string; section_label: string; class_name: string;
}

function pct(present: number, total: number) {
  return total > 0 ? Math.round((present / total) * 100) : 0;
}
function pctColor(p: number) {
  return p >= 90 ? 'text-emerald-600' : p >= 75 ? 'text-amber-600' : 'text-red-500';
}
function pctBg(p: number) {
  return p >= 90 ? 'bg-emerald-500' : p >= 75 ? 'bg-amber-500' : 'bg-red-500';
}

export default function TeacherAttendanceTrends() {
  const router = useRouter();
  const token = getToken() || '';

  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    init();
  }, []);

  async function init() {
    try {
      const secs = await apiGet<SectionOption[]>('/api/v1/teacher/sections', token);
      setSections(secs || []);
      const firstId = secs?.[0]?.section_id || '';
      setSelectedSectionId(firstId);
      if (firstId) {
        const s = await apiGet<TeacherStats>(
          `/api/v1/teacher/attendance/stats?section_id=${firstId}`, token
        );
        setStats(s);
        setRangeTo(s.today);
        const d = new Date(s.today + 'T12:00:00');
        d.setDate(1);
        setRangeFrom(d.toISOString().split('T')[0]);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function loadRange(from: string, to: string, sectionId?: string) {
    setRangeLoading(true);
    try {
      const sid = sectionId || selectedSectionId;
      const params = new URLSearchParams({ from, to });
      if (sid) params.set('section_id', sid);
      const s = await apiGet<TeacherStats>(`/api/v1/teacher/attendance/stats?${params}`, token);
      setStats(s);
    } catch { /* ignore */ }
    finally { setRangeLoading(false); }
  }

  async function switchSection(sectionId: string) {
    setSelectedSectionId(sectionId);
    setRangeLoading(true);
    try {
      const params = new URLSearchParams({ section_id: sectionId });
      if (rangeFrom) params.set('from', rangeFrom);
      if (rangeTo)   params.set('to', rangeTo);
      const s = await apiGet<TeacherStats>(`/api/v1/teacher/attendance/stats?${params}`, token);
      setStats(s);
    } catch { /* ignore */ }
    finally { setRangeLoading(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const s = stats?.summary;
  const activeDays   = (stats?.daily || []).filter(d => d.total > 0);
  const rangeDays    = activeDays.length || 1;
  const rangePresent = activeDays.reduce((sum, d) => sum + d.present, 0);
  const rangeAbsent  = activeDays.reduce((sum, d) => sum + d.absent, 0);
  const rangeTotal   = rangePresent + rangeAbsent;
  const rangePct     = rangeTotal > 0 ? Math.round(rangePresent / rangeTotal * 100) : (stats?.range_pct ?? 0);
  const avgPresent   = Math.round(rangePresent / rangeDays);
  const avgAbsent    = Math.round(rangeAbsent / rangeDays);

  const sortedDays = [...activeDays].map(d => ({ ...d, pct: pct(d.present, d.total) }));
  const bestDay  = sortedDays.length ? sortedDays.reduce((a, b) => a.pct >= b.pct ? a : b) : null;
  const worstDay = sortedDays.length ? sortedDays.reduce((a, b) => a.pct <= b.pct ? a : b) : null;

  const dailyChart = activeDays.map(d => ({
    name: new Date(d.date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    pct: pct(d.present, d.total),
    present: d.present,
    absent: d.absent,
  }));

  const rangeLabel = stats?.from && stats?.to
    ? `${new Date(stats.from + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(stats.to + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
    : '';

  const currentSection = sections.find(s => s.section_id === selectedSectionId);

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-neutral-400 hover:text-neutral-600 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-neutral-900">Attendance Trends</h1>
          {currentSection && (
            <p className="text-xs text-neutral-500">
              {currentSection.class_name} — Section {currentSection.section_label}
            </p>
          )}
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Section selector — only for teachers with multiple sections */}
        {sections.length > 1 && (
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 block">Section</label>
            <div className="flex gap-2 flex-wrap">
              {sections.map(sec => (
                <button key={sec.section_id}
                  onClick={() => switchSection(sec.section_id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    selectedSectionId === sec.section_id
                      ? 'bg-primary-600 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}>
                  {sec.class_name} — {sec.section_label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Range Avg', value: `${rangePct}%`, sub: rangeLabel, color: rangePct, icon: TrendingUp },
            { label: 'Avg Daily Present', value: `${avgPresent}`, sub: `~${avgAbsent} absent · ${rangeDays} days`, color: rangePct, icon: Users },
            { label: 'Best Day', value: bestDay ? `${bestDay.pct}%` : '—', sub: bestDay ? new Date(bestDay.date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No data', color: bestDay?.pct ?? 0, icon: TrendingUp },
            { label: 'Worst Day', value: worstDay ? `${worstDay.pct}%` : '—', sub: worstDay ? new Date(worstDay.date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No data', color: worstDay?.pct ?? 0, icon: TrendingDown },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">{k.label}</p>
                <k.icon size={14} className={pctColor(k.color)} />
              </div>
              <p className={`text-2xl font-black ${pctColor(k.color)}`}>{k.value}</p>
              <p className="text-[10px] text-neutral-400 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Today / Week / Month summary */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Today", value: `${s?.today_pct ?? 0}%`, sub: `${s?.present_today ?? 0}P · ${s?.absent_today ?? 0}A`, color: s?.today_pct ?? 0 },
            { label: 'This Week', value: `${s?.week_pct ?? 0}%`, sub: '7-day avg', color: s?.week_pct ?? 0 },
            { label: 'This Month', value: `${s?.month_pct ?? 0}%`, sub: 'Monthly avg', color: s?.month_pct ?? 0 },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-neutral-100 shadow-sm px-3 py-3">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">{k.label}</p>
              <p className={`text-lg font-black ${pctColor(k.color)}`}>{k.value}</p>
              <p className="text-[10px] text-neutral-400">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Date range filter */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">Date Range</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-neutral-500">From</label>
              <input type="date" value={rangeFrom} max={rangeTo || stats?.today}
                onChange={e => setRangeFrom(e.target.value)}
                className="text-sm border border-neutral-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-neutral-500">To</label>
              <input type="date" value={rangeTo} min={rangeFrom} max={stats?.today}
                onChange={e => setRangeTo(e.target.value)}
                className="text-sm border border-neutral-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <button onClick={() => loadRange(rangeFrom, rangeTo)}
              disabled={!rangeFrom || !rangeTo || rangeLoading}
              className="px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
              {rangeLoading ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              Apply
            </button>
          </div>
          {/* Quick presets */}
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {[
              { label: 'This week', days: 7 },
              { label: 'This month', days: 30 },
              { label: 'Last 3 months', days: 90 },
            ].map(p => (
              <button key={p.label}
                onClick={() => {
                  const to = stats?.today || new Date().toISOString().split('T')[0];
                  const from = new Date(to + 'T12:00:00');
                  from.setDate(from.getDate() - p.days + 1);
                  const f = from.toISOString().split('T')[0];
                  setRangeFrom(f); setRangeTo(to);
                  loadRange(f, to);
                }}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Daily trend chart */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">
            Daily Attendance % — {rangeLabel || 'This Month'}
          </p>
          {dailyChart.length > 0 ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="teacherAttGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1B4332" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1B4332" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={Math.floor(dailyChart.length / 8)} />
                  <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(v: any) => [`${v}%`, 'Attendance']}
                    labelFormatter={(l: any) => `${l}`}
                  />
                  <Area type="monotone" dataKey="pct" stroke="#1B4332" strokeWidth={2}
                    fill="url(#teacherAttGrad)" dot={{ r: 2.5, fill: '#1B4332' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center">
              <p className="text-sm text-neutral-400">No data for selected range</p>
            </div>
          )}
        </div>

        {/* Day-by-day table */}
        {activeDays.length > 0 && (
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100">
              <p className="text-sm font-bold text-neutral-800">Day-by-Day Breakdown</p>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-100 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-neutral-500">Date</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-neutral-500">Present</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-neutral-500">Absent</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-neutral-500">Total</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-neutral-500">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {[...activeDays].reverse().map(d => {
                    const p = pct(d.present, d.total);
                    return (
                      <tr key={d.date} className="hover:bg-neutral-50/60">
                        <td className="px-4 py-2.5 text-neutral-700 text-xs">
                          {new Date(d.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 text-xs">{d.present}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-red-500 text-xs">{d.absent}</td>
                        <td className="px-4 py-2.5 text-right text-neutral-500 text-xs">{d.total}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-1.5 rounded-full ${pctBg(p)}`} style={{ width: `${p}%` }} />
                            </div>
                            <span className={`text-xs font-bold w-8 text-right ${pctColor(p)}`}>{p}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

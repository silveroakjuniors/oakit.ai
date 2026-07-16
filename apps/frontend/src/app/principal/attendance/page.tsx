'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Users, TrendingUp, TrendingDown, Calendar, ChevronLeft, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AttendanceItem {
  section_id: string; section_label: string; class_name: string;
  class_teacher_name: string | null; status: 'submitted' | 'pending';
  present_count: number; absent_count: number; total_students: number;
  flagged: boolean; flag_note: string | null;
}
interface DailyRow { date: string; present: number; absent: number; total: number; }
interface ClassRow { class_name: string; present: number; absent: number; total: number; attendance_pct: number; }
interface Summary { today_pct: number; week_pct: number; month_pct: number; absent_today: number; present_today: number; }
interface Stats { today: string; from: string; to: string; range_pct: number | null; summary: Summary; daily: DailyRow[]; by_class: ClassRow[]; }

function pct(present: number, total: number) {
  return total > 0 ? Math.round((present / total) * 100) : 0;
}
function pctColor(p: number) {
  return p >= 90 ? 'text-emerald-600' : p >= 75 ? 'text-amber-600' : 'text-red-500';
}
function pctBg(p: number) {
  return p >= 90 ? 'bg-emerald-500' : p >= 75 ? 'bg-amber-500' : 'bg-red-500';
}

export default function AttendancePage() {
  const router = useRouter();
  const token = getToken() || '';
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<AttendanceItem[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiGet<Stats>('/api/v1/principal/attendance/stats', token),
      apiGet<AttendanceItem[]>('/api/v1/principal/attendance/overview', token),
    ]).then(([s, i]) => {
      setStats(s);
      setItems(i);
      setSelectedDate(s.today);
      setRangeTo(s.today);
      // Default range: start of current month
      const d = new Date(s.today + 'T12:00:00');
      d.setDate(1);
      setRangeFrom(d.toISOString().split('T')[0]);
    }).catch(() => setError('Failed to load attendance data'))
      .finally(() => setLoading(false));
  }, []);

  async function loadRange(from: string, to: string) {
    setRangeLoading(true);
    try {
      const s = await apiGet<Stats>(`/api/v1/principal/attendance/stats?from=${from}&to=${to}`, token);
      setStats(prev => prev ? { ...prev, from, to, range_pct: s.range_pct, daily: s.daily, by_class: s.by_class } : s);
    } catch { /* ignore */ }
    finally { setRangeLoading(false); }
  }

  async function loadDate(date: string) {
    setSelectedDate(date);
    setTableLoading(true);
    try {
      const i = await apiGet<AttendanceItem[]>(`/api/v1/principal/attendance/overview?date=${date}`, token);
      setItems(i);
    } catch { /* ignore */ }
    finally { setTableLoading(false); }
  }

  async function toggleFlag(item: AttendanceItem) {
    try {
      if (item.flagged) {
        await fetch(`${API_BASE}/api/v1/principal/flags/${item.section_id}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        });
        setItems(prev => prev.map(i => i.section_id === item.section_id ? { ...i, flagged: false, flag_note: null } : i));
      } else {
        const note = prompt('Flag note (optional):') ?? '';
        await apiPost(`/api/v1/principal/flags/${item.section_id}`, { flag_note: note }, token);
        setItems(prev => prev.map(i => i.section_id === item.section_id ? { ...i, flagged: true, flag_note: note } : i));
      }
    } catch (e: any) { alert(e.message); }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-[#1B4332]/20 border-t-[#1B4332] rounded-full animate-spin" />
      </div>
    );
  }

  const s = stats?.summary;
  const todayLabel = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  // Build daily chart data — show last 30 with formatted date
  const dailyChart = (stats?.daily || []).map(d => ({
    name: new Date(d.date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    pct: pct(d.present, d.total),
    present: d.present,
    absent: d.absent,
  }));

  const submittedCount = items.filter(i => i.status === 'submitted').length;
  const totalSections = items.length;

  return (
    <div className="p-5 lg:p-7 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/principal')}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 transition-colors">
          <ChevronLeft size={16} /> Dashboard
        </button>
        <span className="text-neutral-300">/</span>
        <h1 className="text-xl font-bold text-neutral-900">Attendance</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Today's Attendance", value: `${s?.today_pct ?? 0}%`, sub: `${s?.present_today ?? 0} present · ${s?.absent_today ?? 0} absent`, color: s?.today_pct ?? 0, icon: Users },
          { label: 'This Week Avg', value: `${s?.week_pct ?? 0}%`, sub: 'Rolling 7-day average', color: s?.week_pct ?? 0, icon: Calendar },
          { label: 'This Month Avg', value: `${s?.month_pct ?? 0}%`, sub: 'Since 1st of month', color: s?.month_pct ?? 0, icon: TrendingUp },
          { label: 'Submitted Today', value: `${submittedCount}/${totalSections}`, sub: submittedCount === totalSections ? 'All sections done' : `${totalSections - submittedCount} pending`, color: submittedCount === totalSections ? 95 : 60, icon: CheckCircle2 },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">{k.label}</p>
              <k.icon size={16} className={pctColor(typeof k.color === 'number' ? k.color : 90)} />
            </div>
            <p className={`text-2xl font-black ${pctColor(typeof k.color === 'number' ? k.color : 90)}`}>{k.value}</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Date range filter */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest shrink-0">Date Range</p>
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-500">From</label>
              <input type="date" value={rangeFrom} max={rangeTo || stats?.today}
                onChange={e => setRangeFrom(e.target.value)}
                className="text-sm border border-neutral-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-500">To</label>
              <input type="date" value={rangeTo} min={rangeFrom} max={stats?.today}
                onChange={e => setRangeTo(e.target.value)}
                className="text-sm border border-neutral-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20" />
            </div>
            <button
              onClick={() => loadRange(rangeFrom, rangeTo)}
              disabled={!rangeFrom || !rangeTo || rangeLoading}
              className="px-4 py-1.5 bg-[#1B4332] text-white text-sm font-semibold rounded-xl hover:bg-[#1B4332]/90 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {rangeLoading ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              Apply
            </button>
            {/* Quick presets */}
            <div className="flex gap-1.5 flex-wrap">
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
          {stats?.range_pct != null && (
            <div className="shrink-0 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 flex items-center gap-3">
              <div>
                <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wide">Range Avg</p>
                <p className={`text-xl font-black ${pctColor(stats.range_pct)}`}>{stats.range_pct}%</p>
              </div>
              <div className="text-[10px] text-neutral-400 text-right">
                <p>{stats.from} to</p>
                <p>{stats.to}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">
            Daily Attendance % {stats?.from && stats?.to ? `— ${stats.from} to ${stats.to}` : '— Last 30 Days'}
          </p>
          {dailyChart.length > 0 ? (
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1B4332" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1B4332" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={4} />
                  <YAxis tick={{ fontSize: 9 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(v: any, name: string) => [`${v}%`, 'Attendance']}
                    labelFormatter={(l) => `Date: ${l}`}
                  />
                  <Area type="monotone" dataKey="pct" stroke="#1B4332" strokeWidth={2}
                    fill="url(#attGrad)" dot={{ r: 2, fill: '#1B4332' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center">
              <p className="text-sm text-neutral-400">No historical data yet</p>
            </div>
          )}
        </div>

        {/* Class-wise this month */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">
            By Class {stats?.from && stats?.to ? `(${stats.from} to ${stats.to})` : '— This Month'}
          </p>
          {stats?.by_class && stats.by_class.length > 0 ? (
            <div className="space-y-3">
              {stats.by_class.map(c => (
                <div key={c.class_name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-neutral-700">{c.class_name}</span>
                    <span className={`text-xs font-bold ${pctColor(c.attendance_pct)}`}>{c.attendance_pct}%</span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-1.5 rounded-full transition-all ${pctBg(c.attendance_pct)}`}
                      style={{ width: `${Math.min(c.attendance_pct, 100)}%` }} />
                  </div>
                  <p className="text-[9px] text-neutral-400 mt-0.5">{c.present} present of {c.total} records</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center">
              <p className="text-sm text-neutral-400">No data this month</p>
            </div>
          )}
        </div>
      </div>

      {/* Daily detail table with date picker */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-neutral-800">Section-wise Detail</p>
            <p className="text-xs text-neutral-400 mt-0.5">{todayLabel}</p>
          </div>
          <input
            type="date"
            value={selectedDate}
            max={stats?.today}
            onChange={e => loadDate(e.target.value)}
            className="text-sm border border-neutral-200 rounded-xl px-3 py-2 text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
          />
        </div>

        {tableLoading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-6 h-6 border-3 border-[#1B4332]/20 border-t-[#1B4332] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500">Class</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500">Section</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500">Class Teacher</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500">Present</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500">Absent</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500">Total</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500">%</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {items.map(item => {
                  const p = pct(item.present_count, item.present_count + item.absent_count);
                  return (
                    <tr key={item.section_id} className={`hover:bg-neutral-50/60 transition-colors ${item.flagged ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 font-semibold text-neutral-800">{item.class_name}</td>
                      <td className="px-4 py-3 text-neutral-700">
                        Section {item.section_label}
                        {item.flagged && item.flag_note && (
                          <span className="ml-2 text-[10px] text-red-500 font-medium">{item.flag_note}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{item.class_teacher_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.status === 'submitted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.status === 'submitted' ? 'Submitted' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">{item.present_count}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-500">{item.absent_count}</td>
                      <td className="px-4 py-3 text-right text-neutral-500">{item.total_students}</td>
                      <td className="px-4 py-3 text-right">
                        {item.status === 'submitted' ? (
                          <span className={`text-xs font-bold ${pctColor(p)}`}>{p}%</span>
                        ) : <span className="text-neutral-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleFlag(item)}
                          className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                            item.flagged ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                          }`}>
                          {item.flagged ? 'Unflag' : 'Flag'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-neutral-400 text-sm">
                      No attendance data for this date
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

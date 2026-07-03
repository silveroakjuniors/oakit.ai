'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from 'recharts';
import {
  ChevronLeft, Users, BookOpen, CheckCircle2, Clock,
  Send, UserCheck, TrendingUp, Award, Loader2, X, Phone,
  AlertTriangle, Cake, MessageSquare, Flame, Trophy, FileText,
  Check, CheckCheck,
} from 'lucide-react';

interface JournalEntry {
  id: string;
  entry_date: string;
  entry_type: string;
  beautified_text: string;
  raw_text: string;
  is_sent_to_parent: boolean;
  sent_at: string | null;
  read_at: string | null;
  student_name: string;
}

interface ParentDetail {
  id: string;
  parent_name: string;
  mobile: string;
  student_name: string;
  status: 'active' | 'inactive' | 'never_logged_in';
  messages_30d: number;
  last_message_at: string | null;
}

interface PerformanceData {
  section_id: string;
  section_label: string;
  class_name: string;
  total_students: number;
  today: string;
  day_start_time: string;
  attendance: {
    days_marked: number;
    avg_pct: number;
    total_present: number;
    total_absent: number;
    avg_time: string | null;
  };
  curriculum: {
    total_chunks: number;
    covered_chunks: number;
    coverage_pct: number;
  };
  completion: {
    days_completed: number;
    avg_time: string | null;
  };
  journal: {
    total_entries: number;
    sent_to_parents: number;
  };
  parents: {
    total: number;
    active: number;
    inactive: number;
    never_logged_in: number;
    details: ParentDetail[];
  };
  school_comparison: {
    section_id: string;
    section_label: string;
    class_name: string;
    completions_30d: number;
    att_pct: number;
    comments_sent: number;
  }[];
  section_scores: {
    section_id: string;
    section_label: string;
    class_name: string;
    rank: number;
    score: number;
    breakdown: {
      completion: number;
      comp_timeliness: number;
      att_timeliness: number;
      journal: number;
      feed: number;
      milestones: number;
      homework: number;
      observations: number;
    };
  }[];
  weekly_trend: {
    week_start: string;
    att_pct: number;
    days: number;
  }[];
  daily_att_time: { date: string; time_minutes: number }[];
  daily_comp_time: { date: string; time_minutes: number }[];
  attendance_outliers: { id: string; name: string; present_days: number; absent_days: number; att_pct: number }[];
  no_journal_students: { id: string; name: string }[];
  birthdays: { id: string; name: string; date_of_birth: string }[];
  homework: { total_sent: number; days_with_homework: number };
  unread_messages: number;
  pending_topics: number;
  streak: { current: number; best: number };
  school_rank: { rank: number; total: number };
}

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#f87171', '#38bdf8', '#a78bfa'];
const PIE_COLORS = { active: '#10b981', inactive: '#f59e0b', never_logged_in: '#f87171' };

function Ring({ pct, color, size = 80, stroke = 8 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease' }} />
    </svg>
  );
}

export default function ClassPerformancePage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [allSections, setAllSections] = useState<{ section_id: string; section_label: string; class_name: string; role: string }[]>([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [showParentDrill, setShowParentDrill] = useState(false);
  const [parentFilter, setParentFilter] = useState<'all' | 'active' | 'never_logged_in'>('all');
  const [showJournalDrill, setShowJournalDrill] = useState(false);
  const [journalFilter, setJournalFilter] = useState<'all' | 'sent' | 'unsent'>('all');
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [showRankDrill, setShowRankDrill] = useState(false);

  useEffect(() => {
    const t = getToken() || '';
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadContext();
  }, [token]);

  useEffect(() => {
    if (!token || !selectedSection) return;
    loadPerformance(selectedSection);
  }, [selectedSection]);

  async function loadContext() {
    try {
      const ctx = await apiGet<any>('/api/v1/teacher/context', token);
      setAllSections(ctx.all_sections || []);
      if (ctx.section_id) {
        setSelectedSection(ctx.section_id);
      }
    } catch { router.push('/login'); }
  }

  async function loadPerformance(sectionId: string) {
    setLoading(true);
    try {
      const d = await apiGet<PerformanceData>(`/api/v1/teacher/class-performance?section_id=${sectionId}`, token);
      setData(d);
    } catch (e: any) {
      console.error('Class performance load failed:', e.message);
      setData(null);
    }
    finally { setLoading(false); }
  }

  async function loadJournalEntries(filter: 'all' | 'sent' | 'unsent') {
    setJournalLoading(true);
    try {
      const res = await apiGet<{ entries: JournalEntry[] }>(
        `/api/v1/teacher/class-performance/journal-entries?section_id=${selectedSection}&filter=${filter}`,
        token
      );
      setJournalEntries(res.entries || []);
    } catch (e: any) {
      console.error('Journal entries load failed:', e.message);
      setJournalEntries([]);
    } finally { setJournalLoading(false); }
  }

  function openJournalDrill(filter: 'all' | 'sent' | 'unsent' = 'all') {
    setJournalFilter(filter);
    setShowJournalDrill(true);
    loadJournalEntries(filter);
  }

  if (!token) return null;

  const parentPie = data ? [
    { name: 'Logged in', value: data.parents.active + data.parents.inactive, color: '#10b981' },
    { name: 'Not logged in', value: data.parents.never_logged_in, color: '#f87171' },
  ].filter(d => d.value > 0) : [];

  const mySection = data?.school_comparison.find(s => s.section_id === selectedSection);
  const schoolAvgAtt = data?.school_comparison.length
    ? Math.round(data.school_comparison.reduce((s, c) => s + c.att_pct, 0) / data.school_comparison.length)
    : 0;
  const schoolAvgComments = data?.school_comparison.length
    ? Math.round(data.school_comparison.reduce((s, c) => s + c.comments_sent, 0) / data.school_comparison.length)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg, #1B4332 0%, #2d6a4f 100%)' }}>
        <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white truncate">Class Performance</h1>
          {data && <p className="text-[10px] text-white/60">{data.class_name} · Section {data.section_label}</p>}
        </div>
        {allSections.length > 1 && (
          <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
            className="text-xs bg-white/10 text-white border border-white/20 rounded-lg px-2 py-1.5 max-w-[140px]">
            {allSections.map(s => (
              <option key={s.section_id} value={s.section_id} className="text-neutral-800">
                {s.class_name} {s.section_label} ({s.role === 'class_teacher' ? 'CT' : 'ST'})
              </option>
            ))}
          </select>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : data ? (
        <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">

          {/* ── KPI Rings Row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Students', value: data.total_students, unit: '', color: '#6366f1', icon: Users, pct: 100 },
              { label: 'Attendance', value: data.attendance.avg_pct, unit: '%', color: '#10b981', icon: UserCheck, pct: data.attendance.avg_pct },
              { label: 'Curriculum', value: data.curriculum.coverage_pct, unit: '%', color: '#f59e0b', icon: BookOpen, pct: data.curriculum.coverage_pct },
              { label: 'Plans Done', value: data.completion.days_completed, unit: 'd', color: '#38bdf8', icon: CheckCircle2, pct: Math.min(100, Math.round((data.completion.days_completed / 22) * 100)) },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-3 flex flex-col items-center gap-2">
                <div className="relative">
                  <Ring pct={kpi.pct} color={kpi.color} size={64} stroke={6} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black" style={{ color: kpi.color }}>{kpi.value}{kpi.unit}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <kpi.icon size={12} className="text-neutral-400" />
                  <span className="text-[10px] font-semibold text-neutral-600">{kpi.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Daily Timing Graph — Attendance & Completion ── */}
          {((data.daily_att_time?.length || 0) > 0 || (data.daily_comp_time?.length || 0) > 0) && (() => {
            // Merge both datasets into a single timeline
            const dateMap = new Map<string, { date: string; att_time: number | null; comp_time: number | null }>();
            (data.daily_att_time || []).forEach(d => {
              dateMap.set(d.date?.split('T')[0], { date: d.date?.split('T')[0], att_time: d.time_minutes, comp_time: null });
            });
            (data.daily_comp_time || []).forEach(d => {
              const key = d.date?.split('T')[0];
              const existing = dateMap.get(key);
              if (existing) { existing.comp_time = d.time_minutes; }
              else { dateMap.set(key, { date: key, att_time: null, comp_time: d.time_minutes }); }
            });
            const chartData = Array.from(dateMap.values())
              .filter(d => { const day = new Date(d.date + 'T12:00:00').getDay(); return day !== 0 && day !== 6; })
              .filter(d => d.date >= '2026-06-08')
              .sort((a, b) => a.date.localeCompare(b.date));
            const fmtTime = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(Math.round(mins % 60)).padStart(2, '0')}`;

            return (
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className="text-indigo-500" />
                  <p className="text-xs font-bold text-neutral-700">Daily Timing (30 days)</p>
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 rounded bg-indigo-500" />
                    <span className="text-[10px] text-neutral-500">Attendance marked</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 rounded bg-emerald-500" />
                    <span className="text-[10px] text-neutral-500">Plan completed</span>
                  </div>
                </div>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="date" tick={{ fontSize: 8 }}
                        tickFormatter={v => new Date(v + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        interval={Math.max(0, Math.floor(chartData.length / 6))} />
                      <YAxis tick={{ fontSize: 9 }} domain={[360, 900]}
                        tickFormatter={v => fmtTime(Number(v))} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        labelFormatter={v => new Date(v + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        formatter={(v: any, name: any) => [v ? fmtTime(v) : '—', name === 'att_time' ? 'Attendance' : 'Completion']} />
                      <Line type="monotone" dataKey="att_time" stroke="#6366f1" strokeWidth={2}
                        dot={{ fill: '#6366f1', r: 3 }} connectNulls name="att_time" />
                      <Line type="monotone" dataKey="comp_time" stroke="#10b981" strokeWidth={2}
                        dot={{ fill: '#10b981', r: 3 }} connectNulls name="comp_time" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[9px] text-neutral-400 mt-2 text-center">
                  School starts at {data.day_start_time?.slice(0, 5) || '09:30'} · Lower is better for attendance, shows consistency for completion
                </p>
              </div>
            );
          })()}

          {/* ── Parent Engagement ── */}
          <button onClick={() => setShowParentDrill(true)} className="w-full bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 hover:border-violet-200 hover:shadow-md transition-all text-left group">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-violet-500" />
              <p className="text-xs font-bold text-neutral-700">Parent Engagement</p>
              <span className="text-[10px] text-neutral-400 ml-auto">{data.parents.total} parents</span>
              <span className="text-[10px] text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity">Details →</span>
            </div>
            <div className="flex items-center gap-4">
              {parentPie.length > 0 ? (
                <>
                  <div className="w-24 h-24 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={parentPie} cx="50%" cy="50%" innerRadius={24} outerRadius={42}
                          dataKey="value" labelLine={false}>
                          {parentPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                          formatter={(v: any) => [`${v} parents`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {parentPie.map(d => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-[11px] text-neutral-600 flex-1">{d.name}</span>
                        <span className="text-[11px] font-bold text-neutral-800">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-neutral-400 py-4 text-center w-full">No parent data available</p>
              )}
            </div>
          </button>

          {/* ── Journal / Comments ── */}
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Send size={14} className="text-amber-500" />
              <p className="text-xs font-bold text-neutral-700">Comments to Parents (30 days)</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => openJournalDrill('all')} className="bg-amber-50 rounded-xl p-3 text-center hover:bg-amber-100 hover:shadow-sm transition-all active:scale-95">
                <p className="text-2xl font-black text-amber-600">{data.journal.total_entries}</p>
                <p className="text-[10px] text-amber-700 font-medium mt-1">Total Entries</p>
              </button>
              <button onClick={() => openJournalDrill('sent')} className="bg-emerald-50 rounded-xl p-3 text-center hover:bg-emerald-100 hover:shadow-sm transition-all active:scale-95">
                <p className="text-2xl font-black text-emerald-600">{data.journal.sent_to_parents}</p>
                <p className="text-[10px] text-emerald-700 font-medium mt-1">Sent to Parents</p>
              </button>
            </div>
          </div>

          {/* ── School Comparison ── */}
          {data.school_comparison.length > 1 && (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Award size={14} className="text-indigo-500" />
                <p className="text-xs font-bold text-neutral-700">Your Class vs School</p>
              </div>
              {/* Comparison bars */}
              <div className="space-y-3">
                {/* Attendance comparison */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-neutral-600">Attendance</span>
                    <span className="text-[10px] text-neutral-400">School avg: {schoolAvgAtt}%</span>
                  </div>
                  <div className="relative w-full bg-neutral-100 rounded-full h-4 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                      style={{ width: `${mySection?.att_pct || 0}%`, background: (mySection?.att_pct || 0) >= schoolAvgAtt ? '#10b981' : '#f87171' }} />
                    <div className="absolute inset-y-0 flex items-center" style={{ left: `${schoolAvgAtt}%` }}>
                      <div className="w-0.5 h-full bg-neutral-800/40" />
                    </div>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white mix-blend-difference">
                      {mySection?.att_pct || 0}%
                    </span>
                  </div>
                </div>

                {/* Comments comparison */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-neutral-600">Comments Sent</span>
                    <span className="text-[10px] text-neutral-400">School avg: {schoolAvgComments}</span>
                  </div>
                  <div className="relative w-full bg-neutral-100 rounded-full h-4 overflow-hidden">
                    {(() => {
                      const max = Math.max(...data.school_comparison.map(s => s.comments_sent), 1);
                      const myPct = Math.round(((mySection?.comments_sent || 0) / max) * 100);
                      const avgPct = Math.round((schoolAvgComments / max) * 100);
                      return (
                        <>
                          <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                            style={{ width: `${myPct}%`, background: (mySection?.comments_sent || 0) >= schoolAvgComments ? '#6366f1' : '#f59e0b' }} />
                          <div className="absolute inset-y-0 flex items-center" style={{ left: `${avgPct}%` }}>
                            <div className="w-0.5 h-full bg-neutral-800/40" />
                          </div>
                          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white mix-blend-difference">
                            {mySection?.comments_sent || 0}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Plans comparison */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-neutral-600">Plans Completed</span>
                    <span className="text-[10px] text-neutral-400">
                      School avg: {data.school_comparison.length ? Math.round(data.school_comparison.reduce((s, c) => s + c.completions_30d, 0) / data.school_comparison.length) : 0}
                    </span>
                  </div>
                  <div className="relative w-full bg-neutral-100 rounded-full h-4 overflow-hidden">
                    {(() => {
                      const max = Math.max(...data.school_comparison.map(s => s.completions_30d), 1);
                      const myPct = Math.round(((mySection?.completions_30d || 0) / max) * 100);
                      const schoolAvgPlans = data.school_comparison.length ? Math.round(data.school_comparison.reduce((s, c) => s + c.completions_30d, 0) / data.school_comparison.length) : 0;
                      const avgPct = Math.round((schoolAvgPlans / max) * 100);
                      return (
                        <>
                          <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                            style={{ width: `${myPct}%`, background: (mySection?.completions_30d || 0) >= schoolAvgPlans ? '#38bdf8' : '#f59e0b' }} />
                          <div className="absolute inset-y-0 flex items-center" style={{ left: `${avgPct}%` }}>
                            <div className="w-0.5 h-full bg-neutral-800/40" />
                          </div>
                          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white mix-blend-difference">
                            {mySection?.completions_30d || 0}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ── Quick Stats Row: Streak, Rank, Homework, Messages ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-3 text-center">
              <Flame size={18} className="text-amber-500 mx-auto mb-1" />
              <p className="text-lg font-black text-neutral-800">{data.streak?.current || 0}</p>
              <p className="text-[10px] text-neutral-500">Day Streak</p>
              <p className="text-[9px] text-neutral-400">Best: {data.streak?.best || 0}</p>
            </div>
            <button onClick={() => setShowRankDrill(true)} className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-3 text-center hover:border-indigo-200 hover:shadow-md transition-all active:scale-95">
              <Trophy size={18} className="text-indigo-500 mx-auto mb-1" />
              <p className="text-lg font-black text-neutral-800">#{data.school_rank?.rank || '—'}</p>
              <p className="text-[10px] text-neutral-500">School Rank</p>
              <p className="text-[9px] text-neutral-400">of {data.school_rank?.total || 0} sections</p>
            </button>
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-3 text-center">
              <FileText size={18} className="text-cyan-500 mx-auto mb-1" />
              <p className="text-lg font-black text-neutral-800">{data.homework?.days_with_homework || 0}</p>
              <p className="text-[10px] text-neutral-500">HW Days</p>
              <p className="text-[9px] text-neutral-400">of ~22 school days</p>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-3 text-center">
              <MessageSquare size={18} className={`mx-auto mb-1 ${(data.unread_messages || 0) > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
              <p className={`text-lg font-black ${(data.unread_messages || 0) > 0 ? 'text-red-600' : 'text-neutral-800'}`}>{data.unread_messages || 0}</p>
              <p className="text-[10px] text-neutral-500">Unread Messages</p>
              <p className="text-[9px] text-neutral-400">from parents</p>
            </div>
          </div>

          {/* ── Pending Topics ── */}
          {(data.pending_topics || 0) > 0 && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <BookOpen size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-800">{data.pending_topics} pending topics</p>
                <p className="text-[10px] text-amber-600">Curriculum topics from past days that haven't been completed yet</p>
              </div>
            </div>
          )}

          {/* ── Attendance Outliers ── */}
          {(data.attendance_outliers?.length || 0) > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-red-500" />
                <p className="text-xs font-bold text-neutral-700">Low Attendance Students</p>
                <span className="text-[10px] text-red-500 font-semibold ml-auto">&lt;70%</span>
              </div>
              <div className="space-y-2">
                {data.attendance_outliers.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
                    <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-700 shrink-0">
                      {s.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-neutral-800 truncate">{s.name}</p>
                      <p className="text-[10px] text-neutral-500">{s.present_days} present · {s.absent_days} absent</p>
                    </div>
                    <span className="text-xs font-black text-red-600">{s.att_pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Students Without Journal Entry ── */}
          {(data.no_journal_students?.length || 0) > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Send size={14} className="text-amber-500" />
                <p className="text-xs font-bold text-neutral-700">No Journal Entry (14 days)</p>
                <span className="text-[10px] text-amber-600 font-semibold ml-auto">{data.no_journal_students.length} students</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.no_journal_students.map(s => (
                  <span key={s.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-[11px] font-medium text-amber-800">
                    {s.name}
                  </span>
                ))}
              </div>
              <p className="text-[9px] text-neutral-400 mt-2">These students haven't received any daily note in the last 2 weeks</p>
            </div>
          )}

          {/* ── Upcoming Birthdays ── */}
          {(data.birthdays?.length || 0) > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Cake size={14} className="text-pink-500" />
                <p className="text-xs font-bold text-neutral-700">Birthdays This Week</p>
              </div>
              <div className="space-y-2">
                {data.birthdays.map(s => {
                  const bday = new Date(s.date_of_birth + 'T12:00:00');
                  const dayMonth = bday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-pink-50 border border-pink-100">
                      <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-sm">
                        🎂
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-neutral-800">{s.name}</p>
                        <p className="text-[10px] text-pink-600">{dayMonth}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-sm font-semibold text-neutral-600">No data available</p>
        </div>
      )}

      {/* ── Parent Drill-Down Modal ── */}
      {showParentDrill && data && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowParentDrill(false)}>
          <div className="relative w-full sm:w-[480px] max-h-[85vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
              <div>
                <p className="text-sm font-bold text-neutral-800">Parent Activity</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">{data.parents.total} parents in {data.class_name} · Section {data.section_label}</p>
              </div>
              <button onClick={() => setShowParentDrill(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 px-5 py-3 border-b border-neutral-50 shrink-0 overflow-x-auto">
              {([
                { key: 'all', label: 'All', count: data.parents.total, color: 'bg-neutral-600' },
                { key: 'active', label: 'Logged in', count: data.parents.active + data.parents.inactive, color: 'bg-emerald-500' },
                { key: 'never_logged_in', label: 'Not logged in', count: data.parents.never_logged_in, color: 'bg-red-400' },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setParentFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
                    parentFilter === tab.key
                      ? `${tab.color} text-white shadow-sm`
                      : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                  }`}>
                  {tab.label}
                  <span className={`text-[10px] ${parentFilter === tab.key ? 'text-white/80' : 'text-neutral-400'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Parent list */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {(data.parents.details || [])
                .filter(p => parentFilter === 'all' || p.status === parentFilter)
                .map(parent => (
                  <div key={parent.id} className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    {/* Status dot */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      parent.status === 'never_logged_in' ? 'bg-red-400' : 'bg-emerald-400'
                    }`} />
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-neutral-800 truncate">{parent.parent_name}</p>
                      <p className="text-[10px] text-neutral-500 truncate">
                        Child: {parent.student_name}
                      </p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        {parent.status === 'never_logged_in' ? 'Has not opened the app yet' : 'Logged in'}
                      </p>
                    </div>
                    {/* Phone action */}
                    {parent.mobile && (
                      <a href={`tel:${parent.mobile}`}
                        className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center text-emerald-600 transition-colors shrink-0"
                        title={`Call ${parent.mobile}`}>
                        <Phone size={14} />
                      </a>
                    )}
                  </div>
                ))}
              {(data.parents.details || []).filter(p => parentFilter === 'all' || p.status === parentFilter).length === 0 && (
                <p className="text-xs text-neutral-400 text-center py-8">No parents in this category</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Rank Drill-Down Modal ── */}
      {showRankDrill && data && (() => {
        const ranked = data.section_scores || [];
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowRankDrill(false)}>
            <div className="relative w-full sm:w-[520px] max-h-[85vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
                <div>
                  <p className="text-sm font-bold text-neutral-800">Class Rankings</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">Performance score (last 30 days)</p>
                </div>
                <button onClick={() => setShowRankDrill(false)}
                  className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Rankings list */}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
                {ranked.map(section => {
                  const isMe = section.section_id === selectedSection;
                  return (
                    <div key={section.section_id} className={`p-3 rounded-xl border ${isMe ? 'bg-indigo-50 border-indigo-200' : 'bg-neutral-50 border-neutral-100'}`}>
                      <div className="flex items-center gap-3 mb-2">
                        {/* Rank badge */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-sm ${
                          section.rank === 1 ? 'bg-amber-100 text-amber-700' :
                          section.rank === 2 ? 'bg-neutral-200 text-neutral-600' :
                          section.rank === 3 ? 'bg-orange-100 text-orange-700' :
                          'bg-neutral-100 text-neutral-500'
                        }`}>
                          #{section.rank}
                        </div>
                        {/* Section info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-xs font-semibold truncate ${isMe ? 'text-indigo-700' : 'text-neutral-800'}`}>
                              {section.class_name} · {section.section_label}
                            </p>
                            {isMe && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-200 text-indigo-700 font-medium">You</span>}
                          </div>
                        </div>
                        {/* Score */}
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-black ${isMe ? 'text-indigo-600' : 'text-neutral-700'}`}>{section.score}</p>
                          <p className="text-[9px] text-neutral-400">/100</p>
                        </div>
                      </div>
                      {/* Score breakdown bars */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { key: 'completion', label: 'Plans', color: 'bg-emerald-400' },
                          { key: 'comp_timeliness', label: 'Plan Speed', color: 'bg-cyan-400' },
                          { key: 'att_timeliness', label: 'Att. Speed', color: 'bg-indigo-400' },
                          { key: 'journal', label: 'Comments', color: 'bg-amber-400' },
                          { key: 'feed', label: 'Feed', color: 'bg-violet-400' },
                          { key: 'milestones', label: 'Milestones', color: 'bg-pink-400' },
                          { key: 'homework', label: 'Homework', color: 'bg-sky-400' },
                          { key: 'observations', label: 'Obs.', color: 'bg-orange-400' },
                        ] as const).map(item => (
                          <div key={item.key} className="text-center">
                            <div className="w-full bg-neutral-100 rounded-full h-1.5 mb-0.5">
                              <div className={`h-1.5 rounded-full ${item.color} transition-all`}
                                style={{ width: `${(section.breakdown as any)[item.key] || 0}%` }} />
                            </div>
                            <p className="text-[8px] text-neutral-400 leading-tight">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer explanation */}
              <div className="px-5 py-3 border-t border-neutral-100 shrink-0">
                <p className="text-[9px] text-neutral-400 text-center leading-relaxed">
                  Score based on: Plan completion (20%) + Completion speed (15%) + Attendance speed (15%) + Comments to parents (15%) + Feed posts (10%) + Milestones (10%) + Homework (10%) + Observations (5%)
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Journal Drill-Down Modal ── */}
      {showJournalDrill && data && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowJournalDrill(false)}>
          <div className="relative w-full sm:w-[520px] max-h-[85vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
              <div>
                <p className="text-sm font-bold text-neutral-800">Journal Entries</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Last 30 days · {data.class_name} · Section {data.section_label}</p>
              </div>
              <button onClick={() => setShowJournalDrill(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 px-5 py-3 border-b border-neutral-50 shrink-0 overflow-x-auto">
              {([
                { key: 'all', label: 'All', count: data.journal.total_entries, color: 'bg-neutral-600' },
                { key: 'sent', label: 'Sent to Parents', count: data.journal.sent_to_parents, color: 'bg-emerald-500' },
                { key: 'unsent', label: 'Not Sent', count: data.journal.total_entries - data.journal.sent_to_parents, color: 'bg-amber-500' },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => { setJournalFilter(tab.key); loadJournalEntries(tab.key); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
                    journalFilter === tab.key
                      ? `${tab.color} text-white shadow-sm`
                      : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                  }`}>
                  {tab.label}
                  <span className={`text-[10px] ${journalFilter === tab.key ? 'text-white/80' : 'text-neutral-400'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Journal entries list */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {journalLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                </div>
              ) : journalEntries.length > 0 ? (
                journalEntries.map(entry => (
                  <div key={entry.id} className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    <div className="flex items-start gap-3">
                      {/* Entry type badge */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        entry.entry_type === 'highlight' ? 'bg-amber-100' :
                        entry.entry_type === 'weekly' ? 'bg-indigo-100' : 'bg-emerald-100'
                      }`}>
                        <Send size={14} className={
                          entry.entry_type === 'highlight' ? 'text-amber-600' :
                          entry.entry_type === 'weekly' ? 'text-indigo-600' : 'text-emerald-600'
                        } />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-semibold text-neutral-800 truncate">{entry.student_name}</p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                            entry.entry_type === 'highlight' ? 'bg-amber-100 text-amber-700' :
                            entry.entry_type === 'weekly' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {entry.entry_type}
                          </span>
                          {entry.is_sent_to_parent && (
                            entry.read_at
                              ? <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium"><CheckCheck size={10} /> read</span>
                              : <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium"><Check size={10} /> sent</span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-600 line-clamp-3 leading-relaxed">
                          {entry.beautified_text || entry.raw_text}
                        </p>
                        <p className="text-[9px] text-neutral-400 mt-1.5">
                          {(() => { const d = new Date(entry.entry_date); return isNaN(d.getTime()) ? entry.entry_date : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); })()}
                          {entry.read_at && ` · Read ${new Date(entry.read_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-neutral-400 text-center py-8">No journal entries found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, Button, EmptyState } from '@/components/ui';
import {
  activateTimeMachine,
  deactivateTimeMachine,
  dismissAllSafetyAlerts,
  dismissSafetyAlert,
  fetchAttendanceTrend,
  fetchCoverage,
  fetchDashboardStats,
  fetchDrillDown,
  fetchEngagement,
  fetchSetupStatus,
  fetchSmartAlerts,
  fetchSafetyAlerts,
  fetchTimeMachine,
  fetchTodaySnapshot,
} from '@/features/admin/api/dashboard';
import {
  CoverageRow,
  DashStats,
  DrillDown,
  EngagementData,
  SetupStatus,
  SmartAlertsData,
  SafetyAlert,
  TimeMachine,
  TodaySnap,
  TrendRow,
} from '@/features/admin/types';
import { getToken } from '@/lib/auth';
import { ChevronDown, ChevronUp, X, AlertCircle, TrendingUp, Users, BookOpen, Calendar } from 'lucide-react';

const BAND_COLORS = { green: '#10b981', amber: '#f59e0b', red: '#ef4444' } as const;
const BAND_BG = { green: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-600' } as const;

const quickLinks = [
  { href: '/admin/users', icon: '👥', label: 'Users', desc: 'Staff accounts' },
  { href: '/admin/classes', icon: '🏫', label: 'Classes', desc: 'Sections' },
  { href: '/admin/curriculum', icon: '📄', label: 'Curriculum',desc: 'PDFs' },
  { href: '/admin/supplementary', icon: '🎵', label: 'Activities', desc: 'Rhymes' },
  { href: '/admin/calendar', icon: '📅', label: 'Calendar', desc: 'Holidays' },
  { href: '/admin/plans', icon: '📋', label: 'Plans', desc: 'View' },
  { href: '/admin/textbook-planner', icon: '📚', label: 'Planner', desc: 'AI' },
];

function StatPill({ label, value, icon, trend, color }: { label: string; value: string | number; icon: string; trend?: number; color?: 'emerald' | 'amber' | 'blue' | 'red' }) {
  const colors = {
    emerald: 'bg-emerald-50 border-emerald-200',
    amber: 'bg-amber-50 border-amber-200',
    blue: 'bg-blue-50 border-blue-200',
    red: 'bg-red-50 border-red-200',
  };
  const textColors = {
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    blue: 'text-blue-700',
    red: 'text-red-600',
  };

  return (
    <div className={`${colors[color || 'blue']} border-2 rounded-2xl px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between gap-3 hover:shadow-md transition-all duration-200`}>
      <div className="min-w-0">
        <p className="text-xs sm:text-xs font-medium text-neutral-500 mb-1">{label}</p>
        <p className={`text-xl sm:text-2xl font-bold ${textColors[color || 'blue']}`}>{value}</p>
        {trend !== undefined && <p className="text-[10px] sm:text-xs text-neutral-400 mt-0.5">{trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% from last week</p>}
      </div>
      <div className={`text-3xl sm:text-4xl shrink-0 opacity-40`}>{icon}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const token = getToken() || '';
  const [stats, setStats] = useState<DashStats | null>(null);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [todaySnap, setTodaySnap] = useState<TodaySnap | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [tm, setTm] = useState<TimeMachine | null>(null);
  const [tmDate, setTmDate] = useState('');
  const [tmHours, setTmHours] = useState(24);
  const [tmLoading, setTmLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [safetyAlerts, setSafetyAlerts] = useState<SafetyAlert[]>([]);
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const [smartAlerts, setSmartAlerts] = useState<SmartAlertsData | null>(null);
  const [smartAlertsLoading, setSmartAlertsLoading] = useState(false);
  const [smartAlertsExpanded, setSmartAlertsExpanded] = useState(false);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [engagementTab, setEngagementTab] = useState<'teachers' | 'parents' | 'homework' | 'messages'>('teachers');
  const [engagementFilter, setEngagementFilter] = useState<string>('all');
  const [engagementExpanded, setEngagementExpanded] = useState(false);
  const [teacherDrillDown, setTeacherDrillDown] = useState<SmartAlertsData['teacher_scores'][number] | null>(null);

  const loadSnap = useCallback(async () => {
    try {
      setTodaySnap(await fetchTodaySnapshot(token));
    } catch {
      // ignore
    }
  }, [token]);

  async function loadDrillDown(sectionId: string) {
    setDrillLoading(true);
    try {
      setDrillDown(await fetchDrillDown(sectionId, token));
      setExpandedDocs(new Set());
    } catch {
      // ignore
    } finally {
      setDrillLoading(false);
    }
  }

  async function dismissAlert(id: string) {
    try {
      await dismissSafetyAlert(id, token);
      setSafetyAlerts(prev => prev.filter(alert => alert.id !== id));
    } catch {
      // ignore
    }
  }

  async function dismissAllAlerts() {
    try {
      await dismissAllSafetyAlerts(token);
      setSafetyAlerts([]);
      setAlertsExpanded(false);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    setStatsLoading(true);
    Promise.all([
      fetchDashboardStats(token).then(setStats).catch(() => {}),
      fetchCoverage(token).then(setCoverage).catch(() => {}),
      fetchAttendanceTrend(token).then(setTrend).catch(() => {}),
      fetchSetupStatus(token).then(setSetupStatus).catch(() => {}),
      fetchTimeMachine(token).then(setTm).catch(() => {}),
      fetchSafetyAlerts(token).then(d => {
        setSafetyAlerts(d.alerts);
        if (d.unread_count > 0) setAlertsExpanded(true);
      }).catch(() => {}),
      loadSnap(),
    ]).finally(() => setStatsLoading(false));

    setSmartAlertsLoading(true);
    fetchSmartAlerts(token)
      .then(setSmartAlerts)
      .catch(() => {})
      .finally(() => setSmartAlertsLoading(false));

    setEngagementLoading(true);
    fetchEngagement(token)
      .then(setEngagement)
      .catch(() => {})
      .finally(() => setEngagementLoading(false));

    const interval = setInterval(loadSnap, 60000);
    return () => clearInterval(interval);
  }, [loadSnap, token]);

  async function activateTm() {
    if (!tmDate) return;
    setTmLoading(true);
    try {
      await activateTimeMachine(tmDate, tmHours, token);
      setTm(await fetchTimeMachine(token));
    } catch {
      // ignore
    } finally {
      setTmLoading(false);
    }
  }

  async function deactivateTmHandler() {
    setTmLoading(true);
    try {
      await deactivateTimeMachine(token);
      setTm({ active: false, mock_date: null, expires_at: null, ttl_seconds: 0 });
    } catch {
      // ignore
    } finally {
      setTmLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-100">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-neutral-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Dashboard</h1>
              <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            {todaySnap && (
              <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-emerald-50 border border-emerald-200">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs sm:text-sm font-medium text-emerald-700">Live</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Safety Alerts */}
        {safetyAlerts.length > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl overflow-hidden">
            <button onClick={() => setAlertsExpanded(v => !v)} className="w-full flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 hover:bg-red-100/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl sm:text-2xl animate-pulse">🚨</span>
                <div className="text-left min-w-0">
                  <p className="text-sm sm:text-base font-bold text-red-800">Security Alert</p>
                  <p className="text-xs text-red-600 mt-0.5">{safetyAlerts.length} inappropriate content {safetyAlerts.length > 1 ? 'queries' : 'query'} detected</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={e => { e.stopPropagation(); dismissAllAlerts(); }} className="text-xs sm:text-sm text-red-600 hover:text-red-800 font-medium px-2 sm:px-3 py-1 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap">
                  Dismiss All
                </button>
                <ChevronDown className={`w-4 h-4 text-red-400 transition-transform ${alertsExpanded ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {alertsExpanded && (
              <div className="border-t border-red-200 divide-y divide-red-100 max-h-96 overflow-y-auto">
                {safetyAlerts.map(alert => (
                  <div key={alert.id} className="flex items-start gap-3 p-4 sm:p-4 bg-white/60 hover:bg-white/80 transition-colors">
                    <span className="text-base shrink-0 mt-0.5">⚠️</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-red-800">{alert.actor_name}</span>
                        <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full capitalize font-medium">{alert.actor_role}</span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-neutral-400 mt-1">
                        {new Date(alert.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button onClick={() => dismissAlert(alert.id)} className="text-neutral-400 hover:text-neutral-600 text-xs px-2 py-1 rounded hover:bg-neutral-200 shrink-0 transition-colors">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats Grid */}
        {statsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 sm:h-28 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatPill label="Total Students" value={stats?.students ?? '—'} icon="🎓" color="blue" />
            <StatPill label="Present Today" value={todaySnap?.students_present ?? '—'} icon="✅" color={todaySnap && todaySnap.students_present > 0 ? 'emerald' : 'amber'} />
            <StatPill label="Attendance Logged" value={`${todaySnap?.sections_attendance_submitted ?? 0}/${todaySnap?.total_sections ?? 0}`} icon="📋" color={todaySnap && todaySnap.sections_attendance_submitted === todaySnap.total_sections ? 'emerald' : 'amber'} />
            <StatPill label="Plans Done" value={`${todaySnap?.sections_plans_completed ?? 0}/${todaySnap?.total_sections ?? 0}`} icon="📚" color={todaySnap && todaySnap.sections_plans_completed === todaySnap.total_sections ? 'emerald' : 'blue'} />
          </div>
        )}

        {/* Setup Status */}
        {setupStatus && !setupStatus.complete && (
          <div className="bg-gradient-to-br from-amber-50 to-amber-50/50 border-2 border-amber-200 rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🧭</span>
                <div>
                  <p className="text-sm sm:text-base font-bold text-amber-900">Complete School Setup</p>
                  <p className="text-xs text-amber-700 mt-0.5">{setupStatus.completed_steps.length} of {setupStatus.all_steps.length} completed</p>
                </div>
              </div>
              <Link href="/admin/setup" className="text-xs sm:text-sm text-amber-700 font-semibold hover:underline whitespace-nowrap">
                View All →
              </Link>
            </div>
            <div className="w-full bg-amber-100 rounded-full h-2 mb-4">
              <div className="h-2 rounded-full bg-amber-500 transition-all" style={{ width: `${(setupStatus.completed_steps.length / setupStatus.all_steps.length) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Coverage Section */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <button onClick={() => setExpandedDocs(prev => { const next = new Set(prev); next.has('__coverage__') ? next.delete('__coverage__') : next.add('__coverage__'); return next; })}
            className="w-full flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg shrink-0">📊</div>
              <div className="text-left">
                <p className="text-sm sm:text-base font-bold text-neutral-900">Curriculum Coverage</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {coverage.length > 0 ? `${coverage.filter(r => r.band === 'green').length} on track` : 'View coverage breakdown'}
                </p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 text-neutral-400 transition-transform shrink-0 ${expandedDocs.has('__coverage__') ? 'rotate-180' : ''}`} />
          </button>

          {expandedDocs.has('__coverage__') && (
            <div className="border-t border-neutral-100 px-4 sm:px-6 py-4 sm:py-5 space-y-3">
              {coverage.length === 0 ? (
                <p className="text-sm text-neutral-500 py-4 text-center">No coverage data yet</p>
              ) : (
                coverage.map(row => (
                  <button key={row.section_id} onClick={() => loadDrillDown(row.section_id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 transition-colors text-left group">
                    <div className="text-xs sm:text-sm text-neutral-600 font-medium w-28 shrink-0 truncate">{row.class_name} {row.section_label}</div>
                    <div className="flex-1 bg-neutral-100 rounded-full h-6 overflow-hidden">
                      <div className="h-6 rounded-full transition-all" style={{ width: `${Math.max(Math.min(row.coverage_pct, 100), 2)}%`, backgroundColor: row.coverage_pct >= 75 ? '#10b981' : row.coverage_pct >= 40 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${row.band === 'green' ? 'bg-emerald-100 text-emerald-700' : row.band === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                      {row.coverage_pct}%
                    </span>
                    <ChevronDown className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Drill Down */}
        {(drillDown || drillLoading) && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-neutral-100">
              {drillDown && (
                <div>
                  <p className="text-sm sm:text-base font-semibold text-neutral-800">{drillDown.class_name} {drillDown.section_label}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{drillDown.coverage_pct}% coverage</p>
                </div>
              )}
              <button onClick={() => setDrillDown(null)} className="text-neutral-400 hover:text-neutral-600 p-2 rounded-lg hover:bg-neutral-100 transition-colors">
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {drillDown && (
              <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-2 max-h-96 overflow-y-auto">
                {drillDown.documents.map(doc => (
                  <button key={doc.title} onClick={() => setExpandedDocs(prev => { const next = new Set(prev); next.has(doc.title) ? next.delete(doc.title) : next.add(doc.title); return next; })}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 transition-colors text-left">
                    <span className="text-base shrink-0">📄</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-neutral-700 truncate">{doc.title}</p>
                      <p className="text-[10px] text-neutral-500 mt-0.5">{doc.covered}/{doc.total} topics</p>
                    </div>
                    <div className="w-16 bg-neutral-200 rounded-full h-1.5 shrink-0">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${(doc.covered / doc.total) * 100}%`, backgroundColor: (doc.covered / doc.total) >= 0.75 ? '#10b981' : (doc.covered / doc.total) >= 0.4 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Links */}
        <div>
          <p className="text-xs sm:text-sm font-bold text-neutral-600 uppercase tracking-widest mb-3 px-1">Quick Access</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {quickLinks.map(({ href, icon, label, desc }) => (
              <Link key={href} href={href}>
                <div className="group bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md transition-all duration-200 cursor-pointer h-full flex flex-col gap-2">
                  <div className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">{icon}</div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-neutral-800 truncate">{label}</p>
                    <p className="text-[10px] text-neutral-400 line-clamp-1">{desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Time Machine */}
        {tm && (
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <span className="text-lg sm:text-xl">🕰️</span>
                <div>
                  <p className="text-sm sm:text-base font-semibold text-neutral-800">Time Machine</p>
                  <p className="text-xs text-neutral-500">Test with different dates</p>
                </div>
                {tm.active && <span className="ml-auto px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Active</span>}
              </div>
            </div>
            <div className="px-4 sm:px-6 py-4 sm:py-5">
              {tm.active ? (
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-800">Using <strong>{tm.mock_date}</strong> as today</p>
                    <p className="text-xs text-neutral-500 mt-1">Resets in {Math.ceil((tm.ttl_seconds ?? 0) / 3600)}h</p>
                  </div>
                  <button onClick={deactivateTmHandler} disabled={tmLoading} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 whitespace-nowrap">
                    Disable
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Date</label>
                      <input type="date" value={tmDate} onChange={e => setTmDate(e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Duration</label>
                      <select value={tmHours} onChange={e => setTmHours(Number(e.target.value))} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {[1, 4, 8, 24, 48, 72].map(h => <option key={h} value={h}>{h}h</option>)}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button onClick={activateTm} disabled={!tmDate || tmLoading} className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                        {tmLoading ? 'Loading...' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Button } from '@/components/ui';
import { StatCard, SkeletonLoader, EmptyState } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import Link from 'next/link';

interface DashStats {
  staff: number; students: number; classes: number; sections: number;
  curriculum_docs: number; curriculum_chunks: number; activity_pools: number;
  holidays: number; special_days: number; sections_with_plans: number;
  today_attendance_sections: number; today_completions: number;
}
interface CoverageRow {
  section_id: string; section_label: string; class_name: string;
  total_chunks: number; covered_chunks: number; coverage_pct: number;
  band: 'green' | 'amber' | 'red'; alert: boolean;
}
interface DrillDoc {
  title: string; total: number; covered: number;
  topics: { id: string; label: string; covered: boolean; completion_date: string | null }[];
}
interface DrillDown {
  section_label: string; class_name: string; teacher_name: string | null;
  total_chunks: number; covered_chunks: number; coverage_pct: number;
  documents: DrillDoc[];
}
interface TrendRow { date: string; present: number; absent: number; late: number; }
interface TodaySnap {
  students_present: number; sections_attendance_submitted: number;
  sections_plans_completed: number; total_sections: number; date: string;
}
interface SetupStatus { complete: boolean; completed_steps: string[]; pending_steps: string[]; all_steps: string[]; }
interface TimeMachine { active: boolean; mock_date: string | null; expires_at: string | null; ttl_seconds: number; }
interface SafetyAlert { id: string; actor_name: string; actor_role: string; query_text: string; dismissed_at: string | null; created_at: string; }

const BAND_COLORS = { green: '#10b981', amber: '#f59e0b', red: '#ef4444' };
const BAND_BG = { green: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-600' };
const STEP_LABELS: Record<string, string> = {
  school_profile: 'School Profile', classes_sections: 'Classes & Sections',
  staff_accounts: 'Staff Accounts', curriculum_upload: 'Curriculum Upload', calendar_setup: 'Calendar Setup',
};

const quickLinks = [
  { href: '/admin/users',         icon: '👥', label: 'Users & Roles',  desc: 'Manage staff accounts' },
  { href: '/admin/classes',       icon: '🏫', label: 'Classes',        desc: 'Sections & teachers' },
  { href: '/admin/curriculum',    icon: '📄', label: 'Curriculum',     desc: 'Upload & manage PDFs' },
  { href: '/admin/supplementary', icon: '🎵', label: 'Activities',     desc: 'Rhymes, stories & more' },
  { href: '/admin/calendar',      icon: '📅', label: 'Calendar',       desc: 'Holidays & special days' },
  { href: '/admin/plans',         icon: '📋', label: 'Plans',          desc: 'View & export plans' },
];

export default function AdminDashboard() {
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
  const [tmMsg, setTmMsg] = useState('');
  const [statsLoading, setStatsLoading] = useState(true);
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [safetyAlerts, setSafetyAlerts] = useState<SafetyAlert[]>([]);
  const [alertsExpanded, setAlertsExpanded] = useState(false);

  const loadSnap = useCallback(async () => {
    try { setTodaySnap(await apiGet<TodaySnap>('/api/v1/admin/dashboard/today', token)); } catch {}
  }, [token]);

  async function loadDrillDown(sectionId: string) {
    setDrillLoading(true);
    try {
      const data = await apiGet<DrillDown>(`/api/v1/admin/dashboard/coverage/${sectionId}`, token);
      setDrillDown(data);
      setExpandedDocs(new Set());
    } catch { /* ignore */ }
    finally { setDrillLoading(false); }
  }

  async function dismissAlert(id: string) {
    try {
      await apiPost(`/api/v1/admin/audit/safety-alerts/${id}/dismiss`, {}, token);
      setSafetyAlerts(prev => prev.filter(a => a.id !== id));
    } catch { /* ignore */ }
  }

  async function dismissAllAlerts() {
    try {
      await apiPost('/api/v1/admin/audit/safety-alerts/dismiss-all', {}, token);
      setSafetyAlerts([]);
      setAlertsExpanded(false);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    setStatsLoading(true);
    Promise.all([
      apiGet<DashStats>('/api/v1/admin/users/dashboard-stats', token).then(setStats).catch(() => {}),
      apiGet<CoverageRow[]>('/api/v1/admin/dashboard/coverage', token).then(setCoverage).catch(() => {}),
      apiGet<TrendRow[]>('/api/v1/admin/dashboard/attendance-trend', token).then(setTrend).catch(() => {}),
      apiGet<SetupStatus>('/api/v1/admin/setup/status', token).then(setSetupStatus).catch(() => {}),
      apiGet<TimeMachine>('/api/v1/admin/time-machine', token).then(setTm).catch(() => {}),
      apiGet<{ alerts: SafetyAlert[]; unread_count: number }>('/api/v1/admin/audit/safety-alerts', token)
        .then(d => { setSafetyAlerts(d.alerts); if (d.unread_count > 0) setAlertsExpanded(true); })
        .catch(() => {}),
      loadSnap(),
    ]).finally(() => setStatsLoading(false));
    const interval = setInterval(loadSnap, 60000);
    return () => clearInterval(interval);
  }, []);

  async function activateTm() {
    if (!tmDate) return;
    setTmLoading(true); setTmMsg('');
    try {
      const res = await apiPost<TimeMachine>('/api/v1/admin/time-machine', { date: tmDate, ttl_hours: tmHours }, token);
      setTm(res); setTmMsg(`Time machine active — using ${tmDate} as today`);
    } catch (e: any) { setTmMsg(e.message); }
    finally { setTmLoading(false); }
  }

  async function deactivateTm() {
    setTmLoading(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/time-machine`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setTm({ active: false, mock_date: null, expires_at: null, ttl_seconds: 0 });
      setTmMsg('Time machine disabled');
    } catch (e: any) { setTmMsg(e.message); }
    finally { setTmLoading(false); }
  }

  return (
    <div className="p-5 lg:p-7 max-w-6xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Manage your school from one place</p>
      </div>

      {/* Safety alerts banner */}
      {safetyAlerts.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl overflow-hidden">
          <button
            onClick={() => setAlertsExpanded(e => !e)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-red-100/50 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-pulse">🚨</span>
              <div className="text-left">
                <p className="text-sm font-bold text-red-800">
                  {safetyAlerts.length} Inappropriate Content Alert{safetyAlerts.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  {safetyAlerts.length === 1
                    ? `${safetyAlerts[0].actor_name} (${safetyAlerts[0].actor_role}) asked inappropriate content`
                    : `${safetyAlerts.length} users asked inappropriate content — review and take action`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={e => { e.stopPropagation(); dismissAllAlerts(); }}
                className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
                Dismiss all
              </button>
              <span className="text-red-400 text-sm">{alertsExpanded ? '▲' : '▼'}</span>
            </div>
          </button>

          {alertsExpanded && (
            <div className="border-t border-red-200 divide-y divide-red-100">
              {safetyAlerts.map(alert => (
                <div key={alert.id} className="flex items-start gap-4 px-5 py-3 bg-white/60">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm">⚠️</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-red-800">{alert.actor_name}</span>
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full capitalize">{alert.actor_role}</span>
                      <span className="text-xs text-neutral-400">
                        {new Date(alert.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-red-700 mt-1 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1.5">
                      "{alert.query_text}"
                    </p>
                  </div>
                  <button onClick={() => dismissAlert(alert.id)}
                    className="text-xs text-neutral-400 hover:text-neutral-600 px-2 py-1 rounded hover:bg-neutral-100 shrink-0 transition-colors">
                    Dismiss
                  </button>
                </div>
              ))}
              <div className="px-5 py-3 bg-red-50/50 flex items-center justify-between">
                <p className="text-xs text-red-600">Review full history in <Link href="/admin/audit" className="font-semibold underline">Audit Log → AI Queries</Link></p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Setup checklist */}
      {setupStatus && !setupStatus.complete && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧭</span>
              <p className="text-sm font-semibold text-amber-800">Complete School Setup</p>
            </div>
            <Link href="/admin/setup" className="text-xs text-amber-700 font-medium hover:underline">View all →</Link>
          </div>
          <div className="w-full bg-amber-100 rounded-full h-1.5 mb-3">
            <div className="h-1.5 rounded-full bg-amber-500 transition-all"
              style={{ width: `${(setupStatus.completed_steps.length / setupStatus.all_steps.length) * 100}%` }} />
          </div>
          <div className="flex flex-col gap-1">
            {setupStatus.pending_steps.slice(0, 3).map(step => (
              <div key={step} className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 shrink-0" />
                <span className="text-xs text-amber-700">{STEP_LABELS[step] ?? step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's snapshot — 4 stat cards */}
      {statsLoading ? (
        <StatCard label="" value="" loading className="h-20" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Students" value={stats?.students ?? '—'} colorScheme="neutral" />
          <StatCard label="Present Today" value={todaySnap?.students_present ?? '—'} colorScheme="green"
            sub={todaySnap ? `of ${stats?.students ?? '?'} students` : undefined} />
          <StatCard label="Attendance Submitted" value={todaySnap ? `${todaySnap.sections_attendance_submitted}/${todaySnap.total_sections}` : '—'} colorScheme="blue" sub="sections" />
          <StatCard label="Plans Completed" value={todaySnap ? `${todaySnap.sections_plans_completed}/${todaySnap.total_sections}` : '—'} colorScheme="primary" sub="sections today" />
        </div>
      )}

      {/* Coverage chart */}
      <Card padding="md">
        <p className="text-sm font-semibold text-neutral-800 mb-4">📊 Curriculum Coverage by Section</p>
        {coverage.length === 0 ? (
          <EmptyState emoji="📚" heading="No curriculum data yet" description="Upload curriculum PDFs and generate plans to see coverage." />
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              {coverage.map(row => (
                <button key={row.section_id} type="button"
                  onClick={() => loadDrillDown(row.section_id)}
                  className="flex items-center gap-3 w-full text-left rounded-xl px-2 py-1.5 hover:bg-neutral-50 transition-colors group">
                  <div className="w-20 shrink-0 text-xs text-neutral-600 font-medium truncate">{row.class_name} {row.section_label}</div>
                  <div className="flex-1 bg-neutral-100 rounded-full h-5 overflow-hidden">
                    <div className="h-5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(row.coverage_pct, 2)}%`, backgroundColor: BAND_COLORS[row.band] }} />
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${BAND_BG[row.band]}`}>{row.coverage_pct}%</span>
                  {row.alert && <span className="text-red-500 text-xs shrink-0">⚠</span>}
                  <span className="text-neutral-300 group-hover:text-neutral-500 text-xs shrink-0 transition-colors">›</span>
                </button>
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-neutral-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />≥75%</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />40–74%</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" />&lt;40%</span>
            </div>
          </>
        )}
      </Card>

      {/* Drill-down panel */}
      {(drillDown || drillLoading) && (
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div>
              {drillDown && (
                <>
                  <p className="text-sm font-semibold text-neutral-800">
                    {drillDown.class_name} {drillDown.section_label} — Topic Breakdown
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {drillDown.teacher_name ? `👩‍🏫 ${drillDown.teacher_name} · ` : ''}
                    {drillDown.covered_chunks} of {drillDown.total_chunks} topics covered ({drillDown.coverage_pct}%)
                  </p>
                </>
              )}
              {drillLoading && <p className="text-sm text-neutral-400">Loading...</p>}
            </div>
            <button onClick={() => setDrillDown(null)}
              className="text-neutral-400 hover:text-neutral-600 text-lg w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors">✕</button>
          </div>

          {drillDown && (
            <div className="flex flex-col gap-3">
              {drillDown.documents.length === 0 ? (
                <div className="text-center py-6 text-neutral-400">
                  <p className="text-sm">No curriculum uploaded for this class yet.</p>
                  <p className="text-xs mt-1">Upload curriculum PDFs in the Curriculum section.</p>
                </div>
              ) : (
                drillDown.documents.map(doc => {
                  const isExpanded = expandedDocs.has(doc.title);
                  const docPct = doc.total > 0 ? Math.round((doc.covered / doc.total) * 100) : 0;
                  return (
                    <div key={doc.title} className="border border-neutral-100 rounded-xl overflow-hidden">
                      {/* Document header — click to expand */}
                      <button type="button"
                        onClick={() => setExpandedDocs(prev => {
                          const next = new Set(prev);
                          next.has(doc.title) ? next.delete(doc.title) : next.add(doc.title);
                          return next;
                        })}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition-colors text-left">
                        <span className="text-sm font-medium text-neutral-700 flex-1 truncate">📄 {doc.title}</span>
                        <span className="text-xs text-neutral-500 shrink-0">{doc.covered}/{doc.total}</span>
                        <div className="w-24 bg-neutral-200 rounded-full h-1.5 shrink-0">
                          <div className="h-1.5 rounded-full transition-all"
                            style={{ width: `${docPct}%`, backgroundColor: BAND_COLORS[docPct >= 75 ? 'green' : docPct >= 40 ? 'amber' : 'red'] }} />
                        </div>
                        <span className="text-xs font-bold text-neutral-500 shrink-0 w-8 text-right">{docPct}%</span>
                        <span className={`text-neutral-400 text-xs transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                      </button>

                      {/* Topics list */}
                      {isExpanded && (
                        <div className="divide-y divide-neutral-50">
                          {doc.topics.map(topic => (
                            <div key={topic.id} className={`flex items-center gap-3 px-4 py-2.5 ${topic.covered ? 'bg-emerald-50/40' : ''}`}>
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-xs ${
                                topic.covered ? 'bg-emerald-500 text-white' : 'border-2 border-neutral-200'
                              }`}>
                                {topic.covered ? '✓' : ''}
                              </span>
                              <span className={`text-xs flex-1 ${topic.covered ? 'text-emerald-700' : 'text-neutral-600'}`}>
                                {topic.label}
                              </span>
                              {topic.covered && topic.completion_date && (
                                <span className="text-xs text-neutral-400 shrink-0">
                                  {(() => {
                                    const d = new Date(topic.completion_date);
                                    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                                  })()}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </Card>
      )}

      {/* Attendance trend */}
      <Card padding="md">
        <p className="text-sm font-semibold text-neutral-800 mb-4">📈 Attendance Trend (Last 30 Days)</p>
        {trend.length === 0 ? (
          <EmptyState emoji="📅" heading="No attendance data yet" description="Attendance records will appear here once teachers start marking." />
        ) : (
          <AttendanceTrendChart data={trend} />
        )}
      </Card>

      {/* Quick links */}
      <div>
        <p className="text-sm font-semibold text-neutral-700 mb-3">Quick Access</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickLinks.map(({ href, icon, label, desc }) => (
            <Link key={href} href={href}>
              <Card hover padding="sm" className="h-full">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-800">{label}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{desc}</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Time Machine */}
      <Card padding="md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-lg">🕰️</div>
          <div>
            <p className="text-sm font-semibold text-neutral-800">Time Machine</p>
            <p className="text-xs text-neutral-400">Test the system with a different date</p>
          </div>
          {tm?.active && (
            <span className="ml-auto px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Active · {Math.ceil((tm.ttl_seconds ?? 0) / 3600)}h left
            </span>
          )}
        </div>
        {tm?.active ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-800">Using <strong>{tm.mock_date}</strong> as today</p>
              <p className="text-xs text-amber-600 mt-0.5">Resets at {tm.expires_at ? new Date(tm.expires_at).toLocaleString('en-IN') : '—'}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={deactivateTm} loading={tmLoading}>Disable</Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-600">Mock Date</label>
              <input type="date" value={tmDate} onChange={e => setTmDate(e.target.value)}
                className="px-3 py-2 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-400" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-600">Duration</label>
              <select value={tmHours} onChange={e => setTmHours(Number(e.target.value))}
                className="px-3 py-2 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none">
                {[1,4,8,24,48,72].map(h => <option key={h} value={h}>{h}h</option>)}
              </select>
            </div>
            <Button size="sm" onClick={activateTm} loading={tmLoading} disabled={!tmDate}>Activate</Button>
          </div>
        )}
        {tmMsg && <p className="text-xs mt-3 text-neutral-500">{tmMsg}</p>}
      </Card>
    </div>
  );
}

function AttendanceTrendChart({ data }: { data: TrendRow[] }) {
  const maxVal = Math.max(...data.map(d => Number(d.present) + Number(d.absent)), 1);
  const W = 600; const H = 80; const pad = 4;
  const xStep = (W - pad * 2) / Math.max(data.length - 1, 1);
  function pts(key: 'present' | 'absent' | 'late') {
    return data.map((d, i) => `${pad + i * xStep},${H - pad - (Number(d[key]) / maxVal) * (H - pad * 2)}`).join(' ');
  }
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280, height: 80 }}>
        <polyline points={pts('present')} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />
        <polyline points={pts('absent')} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" />
        <polyline points={pts('late')} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4 2" />
      </svg>
      <div className="flex gap-4 mt-2 text-xs text-neutral-400">
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-emerald-400 inline-block rounded" />Present</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-red-400 inline-block rounded" />Absent</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-amber-400 inline-block rounded" />Late</span>
      </div>
    </div>
  );
}

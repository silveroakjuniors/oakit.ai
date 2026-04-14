'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Button } from '@/components/ui';
import { StatCard, SkeletonLoader, EmptyState } from '@/components/ui';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
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

interface SmartAlert {
  type: string; severity: 'high' | 'medium'; title: string; detail: string;
  teacher_id?: string; section_id?: string; section_label?: string; class_name?: string;
  unlogged_days?: number; attendance_pct?: number; coverage_pct?: number;
  avg_pct?: number; performance_score?: number; subject?: string;
}
interface TeacherScore {
  teacher_id: string; teacher_name: string; section_label: string; class_name: string;
  compliance_pct: number; current_streak: number; best_streak: number; ai_queries_7d: number;
  performance_score: number; band: 'green' | 'amber' | 'red';
  att_days_marked: number; homework_days_sent: number; notes_sent: number;
  journey_entries: number; observations_made: number; working_days: number;
  factors?: Record<string, { score: number; weight: number; label: string; detail: string }>;
}
interface SmartAlertsData {
  alerts: SmartAlert[]; teacher_scores: TeacherScore[];
  summary: { total_alerts: number; high: number; medium: number };
}

interface TeacherEngagement {
  id: string; name: string; mobile: string;
  section_label: string; class_name: string;
  days_completed_30d: number; last_completion: string | null;
  days_attendance_30d: number; homework_sent_30d: number;
  notes_sent_30d: number; messages_sent_30d: number;
  streak: number; activity_status: 'active' | 'low' | 'inactive';
}
interface ParentEngagement {
  id: string; name: string; mobile: string;
  children_count: number; children_names: string;
  messages_sent_30d: number; notifications_read_30d: number;
  unread_notifications: number; last_message_at: string | null;
  activity_status: 'active' | 'inactive' | 'never_logged_in';
}
interface HwHistory {
  date: string; section_label: string; class_name: string; teacher_name: string;
  completed: number; partial: number; not_submitted: number; total_students: number;
}
interface EngagementData {
  teachers: { total: number; active: number; low: number; inactive: number; list: TeacherEngagement[] };
  parents: { total: number; active: number; inactive: number; never_logged_in: number; list: ParentEngagement[] };
  homework: { days_sent: number; completed: number; partial: number; not_submitted: number; history: HwHistory[] };
  messages: { total: number; teacher_sent: number; parent_sent: number; active_threads: number };
}

const BAND_COLORS = { green: '#10b981', amber: '#f59e0b', red: '#ef4444' };
const BAND_BG = { green: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-600' };
const STEP_LABELS: Record<string, string> = {
  school_profile: 'School Profile', classes_sections: 'Classes & Sections',
  staff_accounts: 'Staff Accounts', curriculum_upload: 'Curriculum Upload', calendar_setup: 'Calendar Setup',
};

const quickLinks = [
  { href: '/admin/users',             icon: '👥', label: 'Users & Roles',      desc: 'Manage staff accounts' },
  { href: '/admin/classes',           icon: '🏫', label: 'Classes',            desc: 'Sections & teachers' },
  { href: '/admin/curriculum',        icon: '📄', label: 'Curriculum',         desc: 'Upload & manage PDFs' },
  { href: '/admin/supplementary',     icon: '🎵', label: 'Activities',         desc: 'Rhymes, stories & more' },
  { href: '/admin/calendar',          icon: '📅', label: 'Calendar',           desc: 'Holidays & special days' },
  { href: '/admin/plans',             icon: '📋', label: 'Plans',              desc: 'View & export plans' },
  { href: '/admin/textbook-planner',  icon: '📚', label: 'Textbook Planner',   desc: 'AI-powered planner wizard' },
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
  const [smartAlerts, setSmartAlerts] = useState<SmartAlertsData | null>(null);
  const [smartAlertsLoading, setSmartAlertsLoading] = useState(false);
  const [smartAlertsExpanded, setSmartAlertsExpanded] = useState(false);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [engagementTab, setEngagementTab] = useState<'teachers' | 'parents' | 'homework' | 'messages'>('teachers');
  const [engagementFilter, setEngagementFilter] = useState<string>('all');
  const [engagementExpanded, setEngagementExpanded] = useState(false);
  const [teacherDrillDown, setTeacherDrillDown] = useState<TeacherScore | null>(null);

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
    // Load smart alerts separately (heavier query, 5-min cache)
    setSmartAlertsLoading(true);
    apiGet<SmartAlertsData>('/api/v1/admin/smart-alerts', token)
      .then(d => { setSmartAlerts(d); }) // collapsed by default — never auto-expand
      .catch(() => {})
      .finally(() => setSmartAlertsLoading(false));
    // Load engagement stats
    setEngagementLoading(true);
    apiGet<EngagementData>('/api/v1/admin/dashboard/engagement', token)
      .then(setEngagement).catch(() => {}).finally(() => setEngagementLoading(false));
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
      await fetch(`${API_BASE}/api/v1/admin/time-machine`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setTm({ active: false, mock_date: null, expires_at: null, ttl_seconds: 0 });
      setTmMsg('Time machine disabled');
    } catch (e: any) { setTmMsg(e.message); }
    finally { setTmLoading(false); }
  }

  return (
    <div className="p-5 lg:p-7 max-w-6xl space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {todaySnap && (
            <span className="pill bg-emerald-50 text-emerald-700 border border-emerald-100">
              🟢 Live
            </span>
          )}
        </div>
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

      {/* Smart Alerts — AI School Intelligence */}
      {(smartAlertsLoading || smartAlerts) && (
        <div className={`rounded-2xl border-2 overflow-hidden shadow-sm ${
          smartAlerts && smartAlerts.summary.high > 0
            ? 'border-red-200 bg-gradient-to-br from-red-50 to-orange-50'
            : 'border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50'
        }`}>
          {/* Header — always visible, click to collapse */}
          <button
            onClick={() => setSmartAlertsExpanded(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                smartAlerts && smartAlerts.summary.high > 0 ? 'bg-red-100' : 'bg-amber-100'
              }`}>🧠</div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-neutral-900">School Intelligence</p>
                  {smartAlerts && (
                    <>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        smartAlerts.summary.high > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {smartAlerts.summary.total_alerts} alert{smartAlerts.summary.total_alerts !== 1 ? 's' : ''}
                      </span>
                      {smartAlerts.summary.high > 0 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                          {smartAlerts.summary.high} urgent
                        </span>
                      )}
                    </>
                  )}
                  {smartAlertsLoading && <span className="text-xs text-neutral-400">Analysing…</span>}
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">Oakie-detected issues across teachers, attendance, curriculum, and quizzes</p>
              </div>
            </div>
            <span className={`text-neutral-400 text-sm transition-transform ${smartAlertsExpanded ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {smartAlertsExpanded && smartAlerts && (
            <div className="border-t border-orange-200/60">
              {/* Alert list */}
              {smartAlerts.alerts.length > 0 ? (
                <div className="divide-y divide-orange-100/60">
                  {smartAlerts.alerts.map((alert, i) => {
                    const icons: Record<string, string> = {
                      teacher_not_completing: '📋',
                      low_attendance_trend: '📉',
                      class_falling_behind: '⏳',
                      weak_subject: '📝',
                      low_teacher_performance: '👩‍🏫',
                    };
                    return (
                      <div key={i} className={`flex items-start gap-3 px-5 py-3.5 ${alert.severity === 'high' ? 'bg-red-50/70' : 'bg-white/50'}`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 mt-0.5 ${
                          alert.severity === 'high' ? 'bg-red-100' : 'bg-amber-100'
                        }`}>{icons[alert.type] || '⚠️'}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-neutral-800">{alert.title}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              alert.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {alert.severity === 'high' ? '🔴 URGENT' : '🟡 WATCH'}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{alert.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-5 py-6 text-center">
                  <p className="text-2xl mb-2">✅</p>
                  <p className="text-sm font-semibold text-emerald-700">All clear — no issues detected</p>
                  <p className="text-xs text-neutral-400 mt-1">Oakie is monitoring your school in real time</p>
                </div>
              )}

              {/* Teacher Performance Scores */}
              {smartAlerts.teacher_scores.length > 0 && (
                <div className="border-t border-orange-200/60 px-5 py-4 bg-white/40">
                  <p className="text-xs font-bold text-neutral-600 uppercase tracking-wide mb-3">Teacher Performance · click a score for breakdown</p>
                  <div className="space-y-3">
                    {smartAlerts.teacher_scores
                      .sort((a, b) => a.performance_score - b.performance_score)
                      .map((t, i) => (
                        <button key={i} onClick={() => setTeacherDrillDown(teacherDrillDown?.teacher_id === t.teacher_id ? null : t)}
                          className="w-full flex items-center gap-3 bg-white/80 rounded-xl px-3 py-2.5 border border-neutral-100 hover:border-primary-200 hover:bg-primary-50/30 transition-colors text-left">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                            t.band === 'green' ? 'bg-emerald-100 text-emerald-700' :
                            t.band === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>{t.performance_score}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-semibold text-neutral-700 truncate">{t.teacher_name}</p>
                              <span className="text-[10px] text-neutral-400 shrink-0">{t.class_name} {t.section_label}</span>
                            </div>
                            <div className="flex gap-3 text-[10px] text-neutral-400 mt-0.5">
                              <span>📋 {t.compliance_pct}%</span>
                              <span>🔥 {t.current_streak}d</span>
                              <span>💬 {t.ai_queries_7d} AI</span>
                              <span>📚 {t.homework_days_sent} HW</span>
                              <span>📎 {t.notes_sent} notes</span>
                            </div>
                          </div>
                          <div className="w-20 bg-neutral-200 rounded-full h-2 shrink-0 overflow-hidden">
                            <div className={`h-2 rounded-full transition-all ${
                              t.band === 'green' ? 'bg-emerald-500' : t.band === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                            }`} style={{ width: `${Math.min(t.performance_score, 100)}%` }} />
                          </div>
                          <span className="text-neutral-300 text-xs shrink-0">›</span>
                        </button>
                      ))}
                  </div>

                  {/* Drill-down panel */}
                  {teacherDrillDown && (
                    <div className="mt-4 bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                      <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-neutral-800">{teacherDrillDown.teacher_name} — Score Breakdown</p>
                          <p className="text-xs text-neutral-400">{teacherDrillDown.class_name} · Section {teacherDrillDown.section_label} · Last 30 days</p>
                        </div>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-black ${
                          teacherDrillDown.band === 'green' ? 'bg-emerald-100 text-emerald-700' :
                          teacherDrillDown.band === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>{teacherDrillDown.performance_score}</div>
                      </div>

                      {/* Formula explanation */}
                      <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                        <p className="text-xs font-semibold text-blue-800 mb-1">How this score is calculated</p>
                        <p className="text-xs text-blue-700">7 factors measured over the last 30 working days. Each factor has a weight. Score = sum of (factor% × weight).</p>
                      </div>

                      {/* Factor breakdown */}
                      <div className="divide-y divide-neutral-50">
                        {teacherDrillDown.factors ? Object.entries(teacherDrillDown.factors).map(([key, f]) => (
                          <div key={key} className="px-4 py-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-neutral-700">{f.label}</p>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] text-neutral-400">weight {f.weight}%</span>
                                  <span className={`text-xs font-bold w-8 text-right ${
                                    f.score >= 75 ? 'text-emerald-600' : f.score >= 50 ? 'text-amber-600' : 'text-red-500'
                                  }`}>{f.score}%</span>
                                </div>
                              </div>
                              <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden mb-1">
                                <div className={`h-1.5 rounded-full transition-all ${
                                  f.score >= 75 ? 'bg-emerald-500' : f.score >= 50 ? 'bg-amber-500' : 'bg-red-400'
                                }`} style={{ width: `${Math.min(f.score, 100)}%` }} />
                              </div>
                              <p className="text-[10px] text-neutral-400">{f.detail}</p>
                            </div>
                            <div className="text-xs font-bold text-neutral-500 shrink-0 w-12 text-right">
                              +{Math.round(f.score * f.weight / 100)}pts
                            </div>
                          </div>
                        )) : (
                          // Fallback for old data without factors
                          <div className="px-4 py-3 space-y-2">
                            {[
                              { label: 'Plan Completion', value: teacherDrillDown.compliance_pct, weight: 30, detail: `${teacherDrillDown.compliance_pct}% of working days logged` },
                              { label: 'Teaching Streak', value: Math.min(Math.round((teacherDrillDown.current_streak/30)*100),100), weight: 10, detail: `${teacherDrillDown.current_streak} day streak` },
                              { label: 'Oakie AI Engagement', value: Math.min(Math.round((teacherDrillDown.ai_queries_7d/20)*100),100), weight: 10, detail: `${teacherDrillDown.ai_queries_7d} queries this week` },
                            ].map((f, i) => (
                              <div key={i} className="flex items-center gap-3">
                                <div className="flex-1">
                                  <div className="flex justify-between mb-0.5">
                                    <span className="text-xs font-medium text-neutral-700">{f.label}</span>
                                    <span className="text-xs text-neutral-400">weight {f.weight}% · {f.value}%</span>
                                  </div>
                                  <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                                    <div className={`h-1.5 rounded-full ${f.value >= 75 ? 'bg-emerald-500' : f.value >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                                      style={{ width: `${f.value}%` }} />
                                  </div>
                                  <p className="text-[10px] text-neutral-400 mt-0.5">{f.detail}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="px-4 py-2.5 bg-neutral-50 border-t border-neutral-100">
                        <p className="text-[10px] text-neutral-400">
                          Refreshes every 5 minutes · Scores above 75 = 🟢 Green · 50-74 = 🟡 Amber · Below 50 = 🔴 Red
                        </p>
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-neutral-400 mt-3">
                    Score = Plan Completion (30%) + Attendance (15%) + Homework (15%) + Streak (10%) + AI (10%) + Student Tracking (10%) + Parent Comms (10%)
                  </p>
                </div>
              )}
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
          <div className="bg-white border border-neutral-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-xl shrink-0">🎓</div>
            <div>
              <p className="text-xs text-neutral-500">Total Students</p>
              <p className="text-2xl font-black text-neutral-800">{stats?.students ?? '—'}</p>
              <p className="text-[10px] text-neutral-400">{stats?.classes ?? 0} classes · {stats?.sections ?? 0} sections</p>
            </div>
          </div>
          <div className={`border rounded-2xl p-4 shadow-sm flex items-center gap-3 ${(todaySnap?.students_present ?? 0) > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-neutral-100'}`}>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-xl shrink-0">✅</div>
            <div>
              <p className="text-xs text-neutral-500">Present Today</p>
              <p className="text-2xl font-black text-emerald-700">{todaySnap?.students_present ?? '—'}</p>
              <p className="text-[10px] text-neutral-400">of {stats?.students ?? '?'} students</p>
            </div>
          </div>
          <div className={`border rounded-2xl p-4 shadow-sm flex items-center gap-3 ${
            todaySnap && todaySnap.sections_attendance_submitted === todaySnap.total_sections
              ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'
          }`}>
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl shrink-0">📋</div>
            <div>
              <p className="text-xs text-neutral-500">Attendance</p>
              <p className={`text-2xl font-black ${todaySnap && todaySnap.sections_attendance_submitted === todaySnap.total_sections ? 'text-emerald-700' : 'text-amber-700'}`}>
                {todaySnap ? `${todaySnap.sections_attendance_submitted}/${todaySnap.total_sections}` : '—'}
              </p>
              <p className="text-[10px] text-neutral-400">sections submitted</p>
            </div>
          </div>
          <div className={`border rounded-2xl p-4 shadow-sm flex items-center gap-3 ${
            todaySnap && todaySnap.sections_plans_completed === todaySnap.total_sections
              ? 'bg-primary-50 border-primary-100' : 'bg-white border-neutral-100'
          }`}>
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-xl shrink-0">📚</div>
            <div>
              <p className="text-xs text-neutral-500">Plans Done</p>
              <p className="text-2xl font-black text-primary-700">
                {todaySnap ? `${todaySnap.sections_plans_completed}/${todaySnap.total_sections}` : '—'}
              </p>
              <p className="text-[10px] text-neutral-400">sections today</p>
            </div>
          </div>
        </div>
      )}

      {/* Coverage chart — collapsible */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => setExpandedDocs(prev => { const n = new Set(prev); n.has('__coverage__') ? n.delete('__coverage__') : n.add('__coverage__'); return n; })}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-neutral-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl shrink-0">📊</div>
            <div>
              <p className="text-sm font-bold text-neutral-900">Curriculum Coverage by Section</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                {coverage.length > 0
                  ? `${coverage.filter(r => r.band === 'green').length} on track · ${coverage.filter(r => r.alert).length} need attention`
                  : 'Click to view coverage breakdown'}
              </p>
            </div>
          </div>
          <span className={`text-neutral-400 text-sm transition-transform ${expandedDocs.has('__coverage__') ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {expandedDocs.has('__coverage__') && (
          <div className="border-t border-neutral-100 px-5 py-4">
            {coverage.length === 0 ? (
              <EmptyState title="No curriculum data yet" description="Upload curriculum PDFs and generate plans to see coverage." />
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
                          style={{ width: `${Math.max(Math.min(row.coverage_pct, 100), 2)}%`, backgroundColor: BAND_COLORS[row.band] }} />
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
          </div>
        )}
      </div>

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
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-neutral-800">Attendance Trend</p>
          <span className="section-header">Last 30 days</span>
        </div>
        {trend.length === 0 ? (
          <EmptyState title="No attendance data yet" description="Attendance records will appear here once teachers start marking." />
        ) : (
          <AttendanceTrendChart data={trend} />
        )}
      </Card>

      {/* Engagement Intelligence */}
      <div className="rounded-2xl border-2 border-primary-100 bg-gradient-to-br from-primary-50 to-white overflow-hidden shadow-sm">
        <button
          onClick={() => setEngagementExpanded(v => !v)}
          className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-primary-50/60 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center text-xl shrink-0">📊</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-neutral-900">Engagement Intelligence</p>
            <p className="text-xs text-neutral-500">Last 30 days · Teachers, Parents, Homework, Messages</p>
          </div>
          {engagementLoading && <span className="text-xs text-neutral-400 animate-pulse">Loading…</span>}
          <span className={`text-neutral-400 text-sm transition-transform duration-200 ${engagementExpanded ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {engagementExpanded && (
        <>
        {/* Summary pills */}
        {engagement && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-4 border-t border-primary-100 border-b border-primary-100">
            <button onClick={() => setEngagementTab('teachers')}
              className={`rounded-xl p-3 text-left transition-all border-2 ${engagementTab === 'teachers' ? 'border-primary-400 bg-white shadow-sm' : 'border-transparent bg-white/60 hover:bg-white'}`}>
              <p className="text-xs text-neutral-500 mb-1">👩‍🏫 Teachers</p>
              <div className="flex items-end gap-1.5">
                <span className="text-xl font-black text-emerald-600">{engagement.teachers.active}</span>
                <span className="text-xs text-neutral-400 mb-0.5">active</span>
              </div>
              <div className="flex gap-2 mt-1">
                {engagement.teachers.low > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{engagement.teachers.low} low</span>}
                {engagement.teachers.inactive > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{engagement.teachers.inactive} inactive</span>}
              </div>
            </button>
            <button onClick={() => setEngagementTab('parents')}
              className={`rounded-xl p-3 text-left transition-all border-2 ${engagementTab === 'parents' ? 'border-primary-400 bg-white shadow-sm' : 'border-transparent bg-white/60 hover:bg-white'}`}>
              <p className="text-xs text-neutral-500 mb-1">👨‍👩‍👧 Parents</p>
              <div className="flex items-end gap-1.5">
                <span className="text-xl font-black text-emerald-600">{engagement.parents.active}</span>
                <span className="text-xs text-neutral-400 mb-0.5">active</span>
              </div>
              <div className="flex gap-2 mt-1">
                {engagement.parents.never_logged_in > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{engagement.parents.never_logged_in} never logged in</span>}
                {engagement.parents.inactive > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{engagement.parents.inactive} inactive</span>}
              </div>
            </button>
            <button onClick={() => setEngagementTab('homework')}
              className={`rounded-xl p-3 text-left transition-all border-2 ${engagementTab === 'homework' ? 'border-primary-400 bg-white shadow-sm' : 'border-transparent bg-white/60 hover:bg-white'}`}>
              <p className="text-xs text-neutral-500 mb-1">📚 Homework</p>
              <div className="flex items-end gap-1.5">
                <span className="text-xl font-black text-primary-600">{engagement.homework.days_sent}</span>
                <span className="text-xs text-neutral-400 mb-0.5">days sent</span>
              </div>
              <div className="flex gap-2 mt-1">
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{engagement.homework.completed} ✓</span>
                <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{engagement.homework.not_submitted} ✗</span>
              </div>
            </button>
            <button onClick={() => setEngagementTab('messages')}
              className={`rounded-xl p-3 text-left transition-all border-2 ${engagementTab === 'messages' ? 'border-primary-400 bg-white shadow-sm' : 'border-transparent bg-white/60 hover:bg-white'}`}>
              <p className="text-xs text-neutral-500 mb-1">💬 Messages</p>
              <div className="flex items-end gap-1.5">
                <span className="text-xl font-black text-primary-600">{engagement.messages.total}</span>
                <span className="text-xs text-neutral-400 mb-0.5">total</span>
              </div>
              <div className="flex gap-2 mt-1">
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{engagement.messages.active_threads} threads</span>
              </div>
            </button>
          </div>
        )}

        {/* Drill-down content */}
        {engagement && (
          <div className="px-5 py-4">

            {/* TEACHERS tab */}
            {engagementTab === 'teachers' && (
              <div>
                <div className="flex gap-2 mb-3">
                  {(['all','active','low','inactive'] as const).map(f => (
                    <button key={f} onClick={() => setEngagementFilter(f)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                        engagementFilter === f ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}>
                      {f === 'all' ? `All (${engagement.teachers.total})` :
                       f === 'active' ? `🟢 Active (${engagement.teachers.active})` :
                       f === 'low' ? `🟡 Low (${engagement.teachers.low})` :
                       `🔴 Inactive (${engagement.teachers.inactive})`}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {engagement.teachers.list
                    .filter(t => engagementFilter === 'all' || t.activity_status === engagementFilter)
                    .map(t => (
                      <div key={t.id} className={`rounded-xl border px-4 py-3 ${
                        t.activity_status === 'active' ? 'bg-emerald-50/50 border-emerald-100' :
                        t.activity_status === 'low' ? 'bg-amber-50/50 border-amber-100' :
                        'bg-red-50/50 border-red-100'
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-neutral-800">{t.name}</p>
                              <span className="text-[10px] text-neutral-400">{t.class_name} {t.section_label}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                t.activity_status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                t.activity_status === 'low' ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-600'
                              }`}>
                                {t.activity_status === 'active' ? '🟢 Active' : t.activity_status === 'low' ? '🟡 Low' : '🔴 Inactive'}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-neutral-500">
                              <span title="Days plan completed in last 30 days">📋 {t.days_completed_30d} completions</span>
                              <span title="Homework sent in last 30 days">📚 {t.homework_sent_30d} homework</span>
                              <span title="Notes sent in last 30 days">📎 {t.notes_sent_30d} notes</span>
                              <span title="Messages sent in last 30 days">💬 {t.messages_sent_30d} messages</span>
                              <span title="Current streak">🔥 {t.streak}d streak</span>
                            </div>
                            {/* Activity bar — capped at 100% */}
                            {(() => {
                              const pct = Math.min(Math.round((t.days_completed_30d / 22) * 100), 100);
                              return (
                                <div className="mt-2">
                                  <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                                    <div className={`h-1.5 rounded-full transition-all ${
                                      pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400'
                                    }`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <p className="text-[10px] text-neutral-400 mt-0.5">{pct}% activity rate (30-day)</p>
                                </div>
                              );
                            })()}
                            {t.last_completion && (
                              <p className="text-[10px] text-neutral-400 mt-1">
                                Last completion: {new Date(t.last_completion + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </p>
                            )}
                            {!t.last_completion && (
                              <p className="text-[10px] text-red-500 mt-1 font-medium">⚠ No completions logged in 30 days</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  {engagement.teachers.list.filter(t => engagementFilter === 'all' || t.activity_status === engagementFilter).length === 0 && (
                    <p className="text-sm text-neutral-400 text-center py-4">No teachers in this category</p>
                  )}
                </div>
              </div>
            )}

            {/* PARENTS tab */}
            {engagementTab === 'parents' && (
              <div>
                <div className="flex gap-2 mb-3 flex-wrap">
                  {(['all','active','inactive','never_logged_in'] as const).map(f => (
                    <button key={f} onClick={() => setEngagementFilter(f)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                        engagementFilter === f ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}>
                      {f === 'all' ? `All (${engagement.parents.total})` :
                       f === 'active' ? `🟢 Active (${engagement.parents.active})` :
                       f === 'inactive' ? `🟡 Inactive (${engagement.parents.inactive})` :
                       `🔴 Never logged in (${engagement.parents.never_logged_in})`}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {engagement.parents.list
                    .filter(p => engagementFilter === 'all' || p.activity_status === engagementFilter)
                    .map(p => (
                      <div key={p.id} className={`rounded-xl border px-4 py-3 ${
                        p.activity_status === 'active' ? 'bg-emerald-50/50 border-emerald-100' :
                        p.activity_status === 'never_logged_in' ? 'bg-red-50/50 border-red-100' :
                        'bg-amber-50/50 border-amber-100'
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-neutral-800">{p.name || 'Unknown'}</p>
                              <span className="text-[10px] text-neutral-400">📱 {p.mobile}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                p.activity_status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                p.activity_status === 'never_logged_in' ? 'bg-red-100 text-red-600' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {p.activity_status === 'active' ? '🟢 Active' :
                                 p.activity_status === 'never_logged_in' ? '🔴 Never logged in' : '🟡 Inactive'}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-500 mt-1">
                              👶 {p.children_names || 'No children linked'}
                            </p>
                            <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-neutral-500">
                              <span>💬 {p.messages_sent_30d} messages</span>
                              <span>🔔 {p.notifications_read_30d} notifications read</span>
                              {p.unread_notifications > 0 && (
                                <span className="text-amber-600 font-medium">⚠ {p.unread_notifications} unread</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  {engagement.parents.list.filter(p => engagementFilter === 'all' || p.activity_status === engagementFilter).length === 0 && (
                    <p className="text-sm text-neutral-400 text-center py-4">No parents in this category</p>
                  )}
                </div>
              </div>
            )}

            {/* HOMEWORK tab */}
            {engagementTab === 'homework' && (
              <div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-emerald-700">{engagement.homework.completed}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">✓ Completed</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-amber-700">{engagement.homework.partial}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">½ Partial</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-red-600">{engagement.homework.not_submitted}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">✗ Not submitted</p>
                  </div>
                </div>
                <p className="text-xs font-semibold text-neutral-600 mb-2">Recent homework days</p>
                <div className="space-y-2">
                  {engagement.homework.history.slice(0, 10).map((hw, i) => {
                    const total = hw.completed + hw.partial + hw.not_submitted;
                    const pct = total > 0 ? Math.round((hw.completed / total) * 100) : 0;
                    const rawDate = (hw.date || '').split('T')[0];
                    return (
                      <div key={i} className="bg-white border border-neutral-100 rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div>
                            <span className="text-xs font-semibold text-neutral-700">
                              {rawDate ? new Date(rawDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
                            </span>
                            <span className="text-[10px] text-neutral-400 ml-2">{hw.class_name} {hw.section_label} · {hw.teacher_name}</span>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct >= 75 ? 'bg-emerald-100 text-emerald-700' : pct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                            {pct}% done
                          </span>
                        </div>
                        <div className="flex gap-3 text-[11px]">
                          <span className="text-emerald-600">✓ {hw.completed}</span>
                          <span className="text-amber-600">½ {hw.partial}</span>
                          <span className="text-red-500">✗ {hw.not_submitted}</span>
                        </div>
                        <div className="w-full bg-neutral-100 rounded-full h-1.5 mt-2">
                          <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {engagement.homework.history.length === 0 && (
                    <p className="text-sm text-neutral-400 text-center py-4">No homework sent in the last 30 days</p>
                  )}
                </div>
              </div>
            )}

            {/* MESSAGES tab */}
            {engagementTab === 'messages' && (
              <div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <div className="bg-white border border-neutral-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-primary-700">{engagement.messages.total}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">Total messages</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-blue-700">{engagement.messages.teacher_sent}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">👩‍🏫 By teachers</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-purple-700">{engagement.messages.parent_sent}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">👨‍👩‍👧 By parents</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-emerald-700">{engagement.messages.active_threads}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">Active threads</p>
                  </div>
                </div>
                <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-4 text-center">
                  <p className="text-xs text-neutral-500">
                    {engagement.messages.total === 0
                      ? 'No messages exchanged in the last 30 days. Encourage teachers to message parents!'
                      : `${engagement.messages.active_threads} teacher-parent conversation${engagement.messages.active_threads !== 1 ? 's' : ''} active in the last 30 days.`}
                  </p>
                </div>
              </div>
            )}

          </div>
        )}

        {!engagement && !engagementLoading && (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-neutral-400">No engagement data yet</p>
          </div>
        )}
        </>
        )}
      </div>

      {/* Quick links */}
      <div>
        <p className="section-header mb-3">Quick Access</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {quickLinks.map(({ href, icon, label, desc }) => (
            <Link key={href} href={href}>
              <div className="metric-card flex items-start gap-3 cursor-pointer group">
                <div className="w-9 h-9 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-center text-lg shrink-0 group-hover:bg-primary-50 group-hover:border-primary-100 transition-colors">
                  {icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-800 group-hover:text-primary-700 transition-colors">{label}</p>
                  <p className="text-xs text-neutral-400 mt-0.5 leading-snug">{desc}</p>
                </div>
              </div>
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

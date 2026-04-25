'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSessionManager } from '@/hooks/useSessionManager';
import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import {
  activateTimeMachine, deactivateTimeMachine, dismissAllSafetyAlerts, dismissSafetyAlert,
  fetchAttendanceTrend, fetchCoverage, fetchDashboardStats, fetchDrillDown, fetchEngagement,
  fetchSetupStatus, fetchSmartAlerts, fetchSafetyAlerts, fetchTimeMachine, fetchTodaySnapshot,
  fetchAdminBirthdays, BirthdayRow,
} from '@/features/admin/api/dashboard';
import {
  CoverageRow, DashStats, DrillDown, EngagementData, SetupStatus,
  SmartAlertsData, SafetyAlert, TimeMachine, TodaySnap, TrendRow,
} from '@/features/admin/types';
import { getToken, signOut } from '@/lib/auth';
import { apiGet, apiPost } from '@/lib/api';
import { ChevronDown, X, Send, TrendingUp, Users, BookOpen, CheckSquare, AlertTriangle, Brain, Cake, Megaphone, Clock, Zap } from 'lucide-react';
import StatDrillModal from '@/features/admin/components/StatDrillModal';
import BirthdayWishModal from '@/features/admin/components/BirthdayWishModal';

/* ÔöÇÔöÇÔöÇ Local types ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
interface Announcement { id: string; title: string; body: string; target_audience: string; created_at: string; author_name: string; }

/* ÔöÇÔöÇÔöÇ Quick links ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
const quickLinks = [
  { href: '/admin/users',            icon: '­ƒæÑ', label: 'Users',       desc: 'Staff accounts',   bg: 'bg-blue-50',   iconBg: 'bg-blue-100',   text: 'text-blue-700' },
  { href: '/admin/classes',          icon: '­ƒÅ½', label: 'Classes',     desc: 'Sections',         bg: 'bg-indigo-50', iconBg: 'bg-indigo-100', text: 'text-indigo-700' },
  { href: '/admin/students',         icon: '­ƒÄô', label: 'Students',    desc: 'All students',     bg: 'bg-violet-50', iconBg: 'bg-violet-100', text: 'text-violet-700' },
  { href: '/admin/curriculum',       icon: '­ƒôä', label: 'Curriculum',  desc: 'Upload PDFs',      bg: 'bg-emerald-50',iconBg: 'bg-emerald-100',text: 'text-emerald-700' },
  { href: '/admin/supplementary',    icon: '­ƒÄÁ', label: 'Activities',  desc: 'Rhymes & stories', bg: 'bg-teal-50',   iconBg: 'bg-teal-100',   text: 'text-teal-700' },
  { href: '/admin/calendar',         icon: '­ƒôà', label: 'Calendar',    desc: 'Holidays',         bg: 'bg-cyan-50',   iconBg: 'bg-cyan-100',   text: 'text-cyan-700' },
  { href: '/admin/plans',            icon: '­ƒôï', label: 'Plans',       desc: 'View & export',    bg: 'bg-amber-50',  iconBg: 'bg-amber-100',  text: 'text-amber-700' },
  { href: '/admin/textbook-planner', icon: '­ƒôÜ', label: 'Planner',     desc: 'AI wizard',        bg: 'bg-orange-50', iconBg: 'bg-orange-100', text: 'text-orange-700' },
  { href: '/admin/reports',          icon: '­ƒôè', label: 'Reports',     desc: 'Progress reports', bg: 'bg-rose-50',   iconBg: 'bg-rose-100',   text: 'text-rose-700' },
  { href: '/admin/announcements',    icon: '­ƒôó', label: 'Announce',    desc: 'Broadcast',        bg: 'bg-pink-50',   iconBg: 'bg-pink-100',   text: 'text-pink-700' },
  { href: '/admin/audit',            icon: '­ƒöì', label: 'Audit Log',   desc: 'AI queries',       bg: 'bg-slate-50',  iconBg: 'bg-slate-100',  text: 'text-slate-700' },
];

/* ÔöÇÔöÇÔöÇ Reusable primitives ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-neutral-200/80 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function PanelHeader({ icon, title, subtitle, badge, badgeColor = 'bg-neutral-100 text-neutral-500', expanded, onToggle }: {
  icon: React.ReactNode; title: string; subtitle?: string; badge?: string;
  badgeColor?: string; expanded?: boolean; onToggle?: () => void;
}) {
  const inner = (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-center shrink-0 text-[18px]">{icon}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-semibold text-neutral-800">{title}</p>
            {badge && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>}
          </div>
          {subtitle && <p className="text-[11px] text-neutral-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {onToggle !== undefined && (
        <ChevronDown className={`w-4 h-4 text-neutral-300 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      )}
    </div>
  );
  if (onToggle) return <button onClick={onToggle} className="w-full text-left hover:bg-neutral-50/60 transition-colors rounded-t-2xl">{inner}</button>;
  return <div>{inner}</div>;
}

/* Stat card ÔÇö Apple-style: white bg, large number, colored accent bar */
function StatCard({ label, value, sub, icon, accentColor, progress, onClick }: {
  label: string; value: string | number; sub: string;
  icon: React.ReactNode; accentColor: string; progress?: number; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${onClick ? 'cursor-pointer hover:border-primary-200' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accentColor}`}>{icon}</div>
        <div className="flex items-center gap-1.5">
          {progress !== undefined && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${progress === 100 ? 'bg-emerald-100 text-emerald-700' : progress > 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
              {progress}%
            </span>
          )}
          {onClick && <span className="text-[10px] text-neutral-300 font-medium">tap ÔÇ║</span>}
        </div>
      </div>
      <div>
        <p className="text-[28px] font-black text-neutral-900 leading-none" style={{ letterSpacing: '-0.04em' }}>{value}</p>
        <p className="text-[11px] font-medium text-neutral-400 mt-1">{label}</p>
      </div>
      {progress !== undefined && (
        <div className="w-full bg-neutral-100 rounded-full h-1">
          <div className={`h-1 rounded-full transition-all duration-700 ${progress === 100 ? 'bg-emerald-500' : progress > 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${progress}%` }} />
        </div>
      )}
      <p className="text-[10px] text-neutral-400 -mt-1">{sub}</p>
    </div>
  );
}

/* ÔöÇÔöÇÔöÇ Main component ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
export default function AdminDashboardPage() {
  const token = getToken() || '';
  useSessionManager();
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
  const [engagementFilter, setEngagementFilter] = useState('all');
  const [engagementExpanded, setEngagementExpanded] = useState(false);
  const [teacherDrillDown, setTeacherDrillDown] = useState<SmartAlertsData['teacher_scores'][number] | null>(null);
  const [birthdays, setBirthdays] = useState<BirthdayRow[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annExpanded, setAnnExpanded] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnBody, setNewAnnBody] = useState('');
  const [annPosting, setAnnPosting] = useState(false);
  const [coverageExpanded, setCoverageExpanded] = useState(false);
  const [drillModal, setDrillModal] = useState<'students' | 'attendance' | 'plans' | null>(null);
  const [birthdayModal, setBirthdayModal] = useState(false);

  const loadSnap = useCallback(async () => {
    try { setTodaySnap(await fetchTodaySnapshot(token)); } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    setStatsLoading(true);
    Promise.all([
      fetchDashboardStats(token).then(setStats).catch(() => {}),
      fetchCoverage(token).then(setCoverage).catch(() => {}),
      fetchAttendanceTrend(token).then(setTrend).catch(() => {}),
      fetchSetupStatus(token).then(setSetupStatus).catch(() => {}),
      fetchTimeMachine(token).then(setTm).catch(() => {}),
      fetchSafetyAlerts(token).then(d => { setSafetyAlerts(d.alerts); if (d.unread_count > 0) setAlertsExpanded(true); }).catch(() => {}),
      loadSnap(),
    ]).finally(() => setStatsLoading(false));
    setSmartAlertsLoading(true);
    fetchSmartAlerts(token).then(setSmartAlerts).catch(() => {}).finally(() => setSmartAlertsLoading(false));
    setEngagementLoading(true);
    fetchEngagement(token).then(setEngagement).catch(() => {}).finally(() => setEngagementLoading(false));
    fetchAdminBirthdays(token, 7).then(setBirthdays).catch(() => {});
    apiGet<Announcement[]>('/api/v1/admin/announcements', token).then(d => setAnnouncements(d.slice(0, 5))).catch(() => {});
    const iv = setInterval(loadSnap, 60000);
    return () => clearInterval(iv);
  }, [loadSnap, token]);

  async function loadDrillDown(id: string) {
    setDrillLoading(true);
    try { setDrillDown(await fetchDrillDown(id, token)); setExpandedDocs(new Set()); }
    catch { /* ignore */ } finally { setDrillLoading(false); }
  }
  async function dismissAlert(id: string) {
    try { await dismissSafetyAlert(id, token); setSafetyAlerts(p => p.filter(a => a.id !== id)); } catch { /* ignore */ }
  }
  async function dismissAllAlerts() {
    try { await dismissAllSafetyAlerts(token); setSafetyAlerts([]); setAlertsExpanded(false); } catch { /* ignore */ }
  }
  async function activateTm() {
    if (!tmDate) return; setTmLoading(true);
    try { await activateTimeMachine(tmDate, tmHours, token); setTm(await fetchTimeMachine(token)); }
    catch { /* ignore */ } finally { setTmLoading(false); }
  }
  async function deactivateTmHandler() {
    setTmLoading(true);
    try { await deactivateTimeMachine(token); setTm({ active: false, mock_date: null, expires_at: null, ttl_seconds: 0 }); }
    catch { /* ignore */ } finally { setTmLoading(false); }
  }
  async function postAnnouncement() {
    if (!newAnnTitle.trim() || !newAnnBody.trim()) return; setAnnPosting(true);
    try {
      const c = await apiPost<Announcement>('/api/v1/admin/announcements', { title: newAnnTitle.trim(), body: newAnnBody.trim(), target_audience: 'all' }, token);
      setAnnouncements(p => [c, ...p].slice(0, 5)); setNewAnnTitle(''); setNewAnnBody('');
    } catch { /* ignore */ } finally { setAnnPosting(false); }
  }

  const attPct = todaySnap && todaySnap.total_sections > 0 ? Math.round((todaySnap.sections_attendance_submitted / todaySnap.total_sections) * 100) : 0;
  const planPct = todaySnap && todaySnap.total_sections > 0 ? Math.round((todaySnap.sections_plans_completed / todaySnap.total_sections) * 100) : 0;
  const pendingAtt = todaySnap ? todaySnap.total_sections - todaySnap.sections_attendance_submitted : 0;
  const pendingPlan = todaySnap ? todaySnap.total_sections - todaySnap.sections_plans_completed : 0;
  const todayBdays = birthdays.filter(b => b.days_until === 0);

  return (
    <>
    <div className="min-h-screen bg-neutral-50/80">

      {/* ÔöÇÔöÇ PAGE HEADER ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
      <div className="bg-white border-b border-neutral-200/80 px-6 sm:px-8 lg:px-10 py-6">
        <div className="max-w-7xl mx-auto flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-neutral-400 mb-1">Overview</p>
            <h1 className="text-[28px] font-black text-neutral-900" style={{ letterSpacing: '-0.04em' }}>Dashboard</h1>
            <p className="text-[13px] text-neutral-400 mt-0.5">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            {todaySnap && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[11px] font-semibold text-emerald-700">Live</span>
              </div>
            )}
            {tm?.active && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
                <Clock className="w-3 h-3 text-amber-600" />
                <span className="text-[11px] font-semibold text-amber-700">Time Machine ┬À {tm.mock_date}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ÔöÇÔöÇ BODY ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
      <div className="px-6 sm:px-8 lg:px-10 py-7 max-w-7xl mx-auto space-y-6">

        {/* ÔöÇÔöÇ SAFETY ALERTS ÔöÇÔöÇ */}
        {safetyAlerts.length > 0 && (
          <div className="rounded-2xl overflow-hidden border border-red-200 bg-red-50">
            <button onClick={() => setAlertsExpanded(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-red-100/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-red-900">Security Alert</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">{safetyAlerts.length}</span>
                  </div>
                  <p className="text-[11px] text-red-600 mt-0.5">Inappropriate content detected ÔÇö review required</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={e => { e.stopPropagation(); dismissAllAlerts(); }}
                  className="text-[11px] text-red-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">Dismiss all</button>
                <ChevronDown className={`w-4 h-4 text-red-400 transition-transform ${alertsExpanded ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {alertsExpanded && (
              <div className="border-t border-red-200 divide-y divide-red-100 max-h-72 overflow-y-auto">
                {safetyAlerts.map(a => (
                  <div key={a.id} className="flex items-start gap-3 px-5 py-3 bg-white/70">
                    <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5 text-xs">ÔÜá´©Å</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-red-800">{a.actor_name}</span>
                        <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full capitalize font-medium">{a.actor_role}</span>
                        <span className="text-[11px] text-neutral-400">{new Date(a.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-[11px] text-red-700 mt-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2 font-medium">"{a.query_text}"</p>
                    </div>
                    <button onClick={() => dismissAlert(a.id)} className="text-neutral-400 hover:text-neutral-600 text-[11px] px-2 py-1 rounded hover:bg-neutral-100 shrink-0">Dismiss</button>
                  </div>
                ))}
                <div className="px-5 py-2.5 bg-red-50/60">
                  <p className="text-[11px] text-red-600">Full history in <Link href="/admin/audit" className="font-bold underline">Audit Log ÔåÆ AI Queries</Link></p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ÔöÇÔöÇ SETUP BANNER ÔöÇÔöÇ */}
        {setupStatus && !setupStatus.complete && (
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50/60 px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl shrink-0">­ƒº¡</span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-amber-900">Complete School Setup</p>
                <p className="text-[11px] text-amber-600 mt-0.5">{setupStatus.completed_steps.length} of {setupStatus.all_steps.length} steps done</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-28 bg-amber-200 rounded-full h-1.5 hidden sm:block">
                <div className="h-1.5 rounded-full bg-amber-500 transition-all" style={{ width: `${(setupStatus.completed_steps.length / setupStatus.all_steps.length) * 100}%` }} />
              </div>
              <Link href="/admin/setup" className="text-[11px] font-bold text-amber-700 hover:text-amber-900 whitespace-nowrap">View all ÔåÆ</Link>
            </div>
          </div>
        )}

        {/* ÔöÇÔöÇ STAT CARDS ÔöÇÔöÇ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            [1,2,3,4].map(i => <div key={i} className="h-36 rounded-2xl bg-white border border-neutral-200/80 animate-pulse" />)
          ) : (
            <>
              <StatCard onClick={() => setDrillModal('students')} label="Total Students" value={stats?.students ?? 'ÔÇö'}
                sub={`${stats?.classes ?? 0} classes ┬À ${stats?.sections ?? 0} sections`}
                icon={<Users className="w-4 h-4 text-blue-600" />}
                accentColor="bg-blue-100"
              />
              <StatCard
                label="Present Today" value={todaySnap?.students_present ?? 'ÔÇö'}
                sub={`of ${stats?.students ?? '?'} enrolled`}
                icon={<CheckSquare className="w-4 h-4 text-emerald-600" />}
                accentColor="bg-emerald-100"
              />
              <StatCard
                label="Attendance Logged"
                value={`${todaySnap?.sections_attendance_submitted ?? 0}/${todaySnap?.total_sections ?? 0}`}
                sub={`${attPct}% sections submitted`}
                icon={<BookOpen className="w-4 h-4 text-amber-600" />}
                accentColor="bg-amber-100"
                progress={attPct}
              />
              <StatCard
                label="Plans Done"
                value={`${todaySnap?.sections_plans_completed ?? 0}/${todaySnap?.total_sections ?? 0}`}
                sub={`${planPct}% sections complete`}
                icon={<TrendingUp className="w-4 h-4 text-violet-600" />}
                accentColor="bg-violet-100"
                progress={planPct}
              />
            </>
          )}
        </div>

        {/* ÔöÇÔöÇ PENDING + BIRTHDAYS ÔöÇÔöÇ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pending Today ÔÇö only shown when there are pending items */}
          {todaySnap && (pendingAtt > 0 || pendingPlan > 0) && (
            <Panel>
              <PanelHeader icon={<Clock className="w-4 h-4 text-amber-500" />} title="Pending Today" subtitle="Actions still needed across sections" />
              <div className="px-5 pb-5 space-y-2.5 border-t border-neutral-100">
                <div className="pt-3 space-y-2.5">
                  {pendingAtt > 0 && (
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                      <span className="text-xl shrink-0">­ƒôï</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-amber-800">{pendingAtt} section{pendingAtt > 1 ? 's' : ''} haven't marked attendance</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 bg-amber-200 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-amber-500 transition-all" style={{ width: `${attPct}%` }} /></div>
                          <span className="text-[10px] text-amber-600 font-semibold shrink-0">{attPct}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {pendingPlan > 0 && (
                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                      <span className="text-xl shrink-0">­ƒôÜ</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-blue-800">{pendingPlan} section{pendingPlan > 1 ? 's' : ''} haven't completed plans</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 bg-blue-200 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${planPct}%` }} /></div>
                          <span className="text-[10px] text-blue-600 font-semibold shrink-0">{planPct}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          )}

          {/* Birthdays ÔÇö always shown */}
          <Panel>
            <PanelHeader
              icon={<Cake className="w-4 h-4 text-pink-500" />}
              title="Birthdays"
              subtitle="Next 7 days"
              badge={todayBdays.length > 0 ? `${todayBdays.length} today ­ƒÄë` : birthdays.length > 0 ? `${birthdays.length} upcoming` : undefined}
              badgeColor={todayBdays.length > 0 ? 'bg-pink-100 text-pink-700' : 'bg-neutral-100 text-neutral-500'}
            />
            <div className="px-5 pb-5 pt-3 border-t border-neutral-100">
              {birthdays.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <span className="text-3xl mb-2">­ƒÄé</span>
                  <p className="text-[12px] font-semibold text-neutral-600">No birthdays in the next 7 days</p>
                  <p className="text-[11px] text-neutral-400 mt-1">Check back soon!</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {birthdays.map(b => (
                    <div key={b.student_id}
                      onClick={b.days_until === 0 ? () => setBirthdayModal(true) : undefined}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${b.days_until === 0 ? 'bg-pink-50 border-pink-200 cursor-pointer hover:bg-pink-100 hover:shadow-sm' : 'bg-neutral-50 border-neutral-100'}`}>
                      <span className="text-base">{b.days_until === 0 ? '­ƒÄë' : '­ƒÄê'}</span>
                      <div>
                        <p className="text-[11px] font-semibold text-neutral-800 leading-tight">{b.name}</p>
                        <p className="text-[10px] text-neutral-400">{b.class_name} {b.section_label}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${b.days_until === 0 ? 'bg-pink-500 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                        {b.days_until === 0 ? 'Today! ­ƒÄü' : `in ${b.days_until}d`}
                      </span>
                    </div>
                  ))}
                  {todayBdays.length > 0 && (
                    <button onClick={() => setBirthdayModal(true)}
                      className="w-full mt-1 text-xs font-bold text-pink-600 hover:text-pink-800 py-2 rounded-xl hover:bg-pink-50 transition-colors">
                      Ô£¿ Send birthday wishes to parents ÔåÆ
                    </button>
                  )}
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* ÔöÇÔöÇ SCHOOL INTELLIGENCE ÔöÇÔöÇ */}
        {(smartAlertsLoading || smartAlerts) && (
          <Panel>
            <PanelHeader
              icon={<Brain className="w-4 h-4 text-violet-500" />}
              title="School Intelligence"
              subtitle="Oakie-detected issues across teachers, attendance & curriculum"
              badge={smartAlerts ? (smartAlerts.summary.high > 0 ? `${smartAlerts.summary.high} urgent` : `${smartAlerts.summary.total_alerts} alerts`) : 'AnalysingÔÇª'}
              badgeColor={smartAlerts && smartAlerts.summary.high > 0 ? 'bg-red-100 text-red-700' : 'bg-violet-100 text-violet-700'}
              expanded={smartAlertsExpanded} onToggle={() => setSmartAlertsExpanded(v => !v)}
            />
            {smartAlertsExpanded && smartAlerts && (
              <div className="border-t border-neutral-100">
                {smartAlerts.alerts.length === 0 ? (
                  <div className="px-5 py-8 text-center"><p className="text-2xl mb-2">Ô£à</p><p className="text-[13px] font-semibold text-emerald-700">All clear</p><p className="text-[11px] text-neutral-400 mt-1">Oakie is monitoring your school in real time</p></div>
                ) : (
                  <div className="divide-y divide-neutral-50">
                    {smartAlerts.alerts.map((a, i) => {
                      const icons: Record<string, string> = { teacher_not_completing: '­ƒôï', low_attendance_trend: '­ƒôë', class_falling_behind: 'ÔÅ│', weak_subject: '­ƒôØ', low_teacher_performance: '­ƒæ®ÔÇì­ƒÅ½' };
                      return (
                        <div key={i} className={`flex items-start gap-3 px-5 py-3.5 ${a.severity === 'high' ? 'bg-red-50/50' : ''}`}>
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 mt-0.5 ${a.severity === 'high' ? 'bg-red-100' : 'bg-amber-100'}`}>{icons[a.type] || 'ÔÜá´©Å'}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-[13px] font-semibold text-neutral-800">{a.title}</p>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${a.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{a.severity === 'high' ? '­ƒö┤ URGENT' : '­ƒƒí WATCH'}</span>
                            </div>
                            <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">{a.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {smartAlerts.teacher_scores.length > 0 && (
                  <div className="border-t border-neutral-100 px-5 py-4 bg-neutral-50/50">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3">Teacher Performance</p>
                    <div className="space-y-2">
                      {smartAlerts.teacher_scores.sort((a, b) => a.performance_score - b.performance_score).map((t, i) => (
                        <button key={i} onClick={() => setTeacherDrillDown(teacherDrillDown?.teacher_id === t.teacher_id ? null : t)}
                          className="w-full flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-neutral-100 hover:border-neutral-300 hover:shadow-sm transition-all text-left">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-black shrink-0 ${t.band === 'green' ? 'bg-emerald-100 text-emerald-700' : t.band === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{t.performance_score}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2"><p className="text-[12px] font-semibold text-neutral-700 truncate">{t.teacher_name}</p><span className="text-[10px] text-neutral-400 shrink-0">{t.class_name} {t.section_label}</span></div>
                            <div className="flex gap-3 text-[10px] text-neutral-400 mt-0.5"><span>­ƒôï {t.compliance_pct}%</span><span>­ƒöÑ {t.current_streak}d</span><span>­ƒÆ¼ {t.ai_queries_7d} AI</span><span>­ƒôÜ {t.homework_days_sent} HW</span></div>
                          </div>
                          <div className="w-16 bg-neutral-100 rounded-full h-1.5 shrink-0"><div className={`h-1.5 rounded-full ${t.band === 'green' ? 'bg-emerald-500' : t.band === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(t.performance_score, 100)}%` }} /></div>
                          <span className="text-neutral-300 text-xs shrink-0">ÔÇ║</span>
                        </button>
                      ))}
                    </div>
                    {teacherDrillDown && (
                      <div className="mt-3 bg-white border border-neutral-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
                          <div><p className="text-[13px] font-bold text-neutral-800">{teacherDrillDown.teacher_name} ÔÇö Score Breakdown</p><p className="text-[11px] text-neutral-400">{teacherDrillDown.class_name} ┬À {teacherDrillDown.section_label} ┬À Last 30 days</p></div>
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-black ${teacherDrillDown.band === 'green' ? 'bg-emerald-100 text-emerald-700' : teacherDrillDown.band === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{teacherDrillDown.performance_score}</div>
                        </div>
                        <div className="divide-y divide-neutral-50">
                          {teacherDrillDown.factors ? Object.entries(teacherDrillDown.factors as Record<string, { score: number; weight: number; label: string; detail: string }>).map(([k, f]) => (
                            <div key={k} className="px-4 py-3">
                              <div className="flex items-center justify-between mb-1"><p className="text-[12px] font-semibold text-neutral-700">{f.label}</p><div className="flex items-center gap-2"><span className="text-[10px] text-neutral-400">weight {f.weight}%</span><span className="text-[12px] font-bold text-neutral-600">{f.score}%</span></div></div>
                              <div className="w-full bg-neutral-100 rounded-full h-1.5 mb-1"><div className={`h-1.5 rounded-full ${f.score >= 75 ? 'bg-emerald-500' : f.score >= 50 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${f.score}%` }} /></div>
                              <p className="text-[10px] text-neutral-400">{f.detail}</p>
                            </div>
                          )) : null}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Panel>
        )}

        {/* ÔöÇÔöÇ CURRICULUM COVERAGE ÔöÇÔöÇ */}
        <Panel>
          <PanelHeader
            icon="­ƒôè"
            title="Curriculum Coverage"
            subtitle={coverage.length > 0 ? `${coverage.filter(r => r.band === 'green').length} on track ┬À ${coverage.filter(r => r.band === 'red').length} critical` : 'View coverage by section'}
            badge={coverage.filter(r => r.alert).length > 0 ? `ÔÜá´©Å ${coverage.filter(r => r.alert).length} need attention` : undefined}
            badgeColor="bg-red-100 text-red-700"
            expanded={coverageExpanded} onToggle={() => setCoverageExpanded(v => !v)}
          />
          {coverageExpanded && (
            <div className="border-t border-neutral-100 px-5 py-4 space-y-2">
              {coverage.length === 0 ? (
                <p className="text-[13px] text-neutral-400 text-center py-6">No coverage data yet</p>
              ) : coverage.map(row => (
                <button key={row.section_id} onClick={() => loadDrillDown(row.section_id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 transition-colors text-left group">
                  <div className="text-[12px] font-semibold text-neutral-600 w-28 shrink-0 truncate">{row.class_name} {row.section_label}</div>
                  <div className="flex-1 bg-neutral-100 rounded-full h-4 overflow-hidden">
                    <div className="h-4 rounded-full transition-all duration-500" style={{ width: `${Math.max(Math.min(row.coverage_pct, 100), 2)}%`, backgroundColor: row.coverage_pct >= 75 ? '#10b981' : row.coverage_pct >= 40 ? '#f59e0b' : '#ef4444' }} />
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${row.band === 'green' ? 'bg-emerald-100 text-emerald-700' : row.band === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{row.coverage_pct}%</span>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-500 shrink-0 -rotate-90" />
                </button>
              ))}
              {coverage.length > 0 && (
                <div className="flex gap-4 pt-2 text-[11px] text-neutral-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />ÔëÑ75%</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />40ÔÇô74%</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />&lt;40%</span>
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* ÔöÇÔöÇ DRILL-DOWN ÔöÇÔöÇ */}
        {(drillDown || drillLoading) && (
          <Panel>
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <div>
                {drillDown && <><p className="text-[13px] font-bold text-neutral-800">{drillDown.class_name} {drillDown.section_label} ÔÇö Topic Breakdown</p><p className="text-[11px] text-neutral-400 mt-0.5">{drillDown.teacher_name ? `­ƒæ®ÔÇì­ƒÅ½ ${drillDown.teacher_name} ┬À ` : ''}{drillDown.covered_chunks}/{drillDown.total_chunks} topics covered ({drillDown.coverage_pct}%)</p></>}
                {drillLoading && <p className="text-[13px] text-neutral-400">LoadingÔÇª</p>}
              </div>
              <button onClick={() => setDrillDown(null)} className="w-8 h-8 rounded-xl hover:bg-neutral-100 flex items-center justify-center transition-colors"><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            {drillDown && (
              <div className="px-5 py-4 space-y-2 max-h-[28rem] overflow-y-auto">
                {drillDown.documents.length === 0 ? (
                  <p className="text-[13px] text-neutral-400 text-center py-6">No curriculum uploaded yet</p>
                ) : drillDown.documents.map(doc => {
                  const isExp = expandedDocs.has(doc.title);
                  const pct = doc.total > 0 ? Math.round((doc.covered / doc.total) * 100) : 0;
                  return (
                    <div key={doc.title} className="border border-neutral-100 rounded-xl overflow-hidden">
                      <button onClick={() => setExpandedDocs(p => { const n = new Set(p); n.has(doc.title) ? n.delete(doc.title) : n.add(doc.title); return n; })}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition-colors text-left">
                        <span className="text-[13px] font-medium text-neutral-700 flex-1 truncate">­ƒôä {doc.title}</span>
                        <span className="text-[11px] text-neutral-400 shrink-0">{doc.covered}/{doc.total}</span>
                        <div className="w-20 bg-neutral-200 rounded-full h-1.5 shrink-0"><div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444' }} /></div>
                        <span className="text-[11px] font-bold text-neutral-500 w-8 text-right shrink-0">{pct}%</span>
                        <span className={`text-neutral-400 text-xs shrink-0 transition-transform ${isExp ? 'rotate-90' : ''}`}>ÔÇ║</span>
                      </button>
                      {isExp && (
                        <div className="divide-y divide-neutral-50">
                          {doc.topics.map(t => (
                            <div key={t.id} className={`flex items-center gap-3 px-4 py-2.5 ${t.covered ? 'bg-emerald-50/40' : ''}`}>
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] ${t.covered ? 'bg-emerald-500 text-white' : 'border-2 border-neutral-200'}`}>{t.covered ? 'Ô£ô' : ''}</span>
                              <span className={`text-[11px] flex-1 ${t.covered ? 'text-emerald-700' : 'text-neutral-600'}`}>{t.label}</span>
                              {t.covered && t.completion_date && <span className="text-[10px] text-neutral-400 shrink-0">{(() => { const d = new Date(t.completion_date); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); })()}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        )}

        {/* ÔöÇÔöÇ ATTENDANCE TREND ÔöÇÔöÇ */}
        <Panel>
          <div className="px-5 py-4 flex items-center justify-between border-b border-neutral-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-center text-[18px]">­ƒôê</div>
              <div><p className="text-[13px] font-semibold text-neutral-800">Attendance Trend</p><p className="text-[11px] text-neutral-400">Last 30 days</p></div>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-neutral-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" />Present</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-400 inline-block rounded" />Absent</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-400 inline-block rounded" />Late</span>
            </div>
          </div>
          <div className="px-5 py-4">
            {trend.length === 0 ? <EmptyState title="No attendance data yet" description="Records will appear once teachers start marking." /> : <AttendanceTrendChart data={trend} />}
          </div>
        </Panel>

        {/* ÔöÇÔöÇ ENGAGEMENT INTELLIGENCE ÔöÇÔöÇ */}
        <Panel>
          <PanelHeader
            icon={<Zap className="w-4 h-4 text-amber-500" />}
            title="Engagement Intelligence"
            subtitle="Last 30 days ┬À Teachers, Parents, Homework, Messages"
            badge={engagementLoading ? 'LoadingÔÇª' : undefined}
            expanded={engagementExpanded} onToggle={() => setEngagementExpanded(v => !v)}
          />
          {engagementExpanded && engagement && (
            <div className="border-t border-neutral-100">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4 border-b border-neutral-100">
                {([
                  { key: 'teachers', icon: '­ƒæ®ÔÇì­ƒÅ½', label: 'Teachers', val: engagement.teachers.active, sub: `${engagement.teachers.inactive} inactive` },
                  { key: 'parents',  icon: '­ƒæ¿ÔÇì­ƒæ®ÔÇì­ƒæº', label: 'Parents',  val: engagement.parents.active,  sub: `${engagement.parents.never_logged_in} never logged in` },
                  { key: 'homework', icon: '­ƒôÜ',    label: 'Homework', val: engagement.homework.days_sent, sub: `${engagement.homework.completed} completed` },
                  { key: 'messages', icon: '­ƒÆ¼',    label: 'Messages', val: engagement.messages.total,    sub: `${engagement.messages.active_threads} threads` },
                ] as const).map(tab => (
                  <button key={tab.key} onClick={() => setEngagementTab(tab.key)}
                    className={`rounded-xl p-3 text-left transition-all border ${engagementTab === tab.key ? 'border-neutral-900 bg-neutral-900 shadow-sm' : 'border-neutral-100 bg-neutral-50 hover:bg-neutral-100'}`}>
                    <p className={`text-[11px] mb-1 ${engagementTab === tab.key ? 'text-white/60' : 'text-neutral-500'}`}>{tab.icon} {tab.label}</p>
                    <p className={`text-[22px] font-black leading-none ${engagementTab === tab.key ? 'text-white' : 'text-neutral-800'}`} style={{ letterSpacing: '-0.04em' }}>{tab.val}</p>
                    <p className={`text-[10px] mt-1 ${engagementTab === tab.key ? 'text-white/40' : 'text-neutral-400'}`}>{tab.sub}</p>
                  </button>
                ))}
              </div>
              <div className="px-5 py-4">
                {engagementTab === 'teachers' && (
                  <div>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {(['all', 'active', 'low', 'inactive'] as const).map(f => (
                        <button key={f} onClick={() => setEngagementFilter(f)} className={`text-[11px] px-3 py-1.5 rounded-full font-semibold transition-colors ${engagementFilter === f ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                          {f === 'all' ? `All (${engagement.teachers.total})` : f === 'active' ? `­ƒƒó Active (${engagement.teachers.active})` : f === 'low' ? `­ƒƒí Low (${engagement.teachers.low})` : `­ƒö┤ Inactive (${engagement.teachers.inactive})`}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {engagement.teachers.list.filter(t => engagementFilter === 'all' || t.activity_status === engagementFilter).map(t => (
                        <div key={t.id} className={`rounded-xl border px-4 py-3 ${t.activity_status === 'active' ? 'bg-emerald-50/60 border-emerald-100' : t.activity_status === 'low' ? 'bg-amber-50/60 border-amber-100' : 'bg-red-50/60 border-red-100'}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[13px] font-semibold text-neutral-800">{t.name}</p>
                            <span className="text-[10px] text-neutral-400">{t.class_name} {t.section_label}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.activity_status === 'active' ? 'bg-emerald-100 text-emerald-700' : t.activity_status === 'low' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{t.activity_status === 'active' ? '­ƒƒó Active' : t.activity_status === 'low' ? '­ƒƒí Low' : '­ƒö┤ Inactive'}</span>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-neutral-500">
                            <span>­ƒôï {t.days_completed_30d} completions</span><span>­ƒôÜ {t.homework_sent_30d} HW</span><span>­ƒôÄ {t.notes_sent_30d} notes</span><span>­ƒÆ¼ {t.messages_sent_30d} msgs</span><span>­ƒÅå {t.streak}d streak</span>
                          </div>
                          {(() => { const pct = Math.min(Math.round((t.days_completed_30d / 22) * 100), 100); return (<div className="mt-2"><div className="w-full bg-neutral-200 rounded-full h-1 overflow-hidden"><div className={`h-1 rounded-full ${pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} /></div><p className="text-[10px] text-neutral-400 mt-0.5">{pct}% activity rate</p></div>); })()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {engagementTab === 'parents' && (
                  <div>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {(['all', 'active', 'inactive', 'never_logged_in'] as const).map(f => (
                        <button key={f} onClick={() => setEngagementFilter(f)} className={`text-[11px] px-3 py-1.5 rounded-full font-semibold transition-colors ${engagementFilter === f ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                          {f === 'all' ? `All (${engagement.parents.total})` : f === 'active' ? `­ƒƒó Active (${engagement.parents.active})` : f === 'inactive' ? `­ƒƒí Inactive (${engagement.parents.inactive})` : `­ƒö┤ Never logged in (${engagement.parents.never_logged_in})`}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {engagement.parents.list.filter(p => engagementFilter === 'all' || p.activity_status === engagementFilter).map(p => (
                        <div key={p.id} className={`rounded-xl border px-4 py-3 ${p.activity_status === 'active' ? 'bg-emerald-50/60 border-emerald-100' : p.activity_status === 'never_logged_in' ? 'bg-red-50/60 border-red-100' : 'bg-amber-50/60 border-amber-100'}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[13px] font-semibold text-neutral-800">{p.name || 'Unknown'}</p>
                            <span className="text-[10px] text-neutral-400">­ƒô▒ {p.mobile}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${p.activity_status === 'active' ? 'bg-emerald-100 text-emerald-700' : p.activity_status === 'never_logged_in' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>{p.activity_status === 'active' ? '­ƒƒó Active' : p.activity_status === 'never_logged_in' ? '­ƒö┤ Never logged in' : '­ƒƒí Inactive'}</span>
                          </div>
                          <p className="text-[11px] text-neutral-500 mt-1">­ƒæÂ {p.children_names || 'No children linked'}</p>
                          <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-neutral-500"><span>­ƒÆ¼ {p.messages_sent_30d} msgs</span><span>­ƒöö {p.notifications_read_30d} read</span>{p.unread_notifications > 0 && <span className="text-amber-600 font-medium">ÔÜá {p.unread_notifications} unread</span>}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {engagementTab === 'homework' && (
                  <div>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center"><p className="text-[22px] font-black text-emerald-700" style={{ letterSpacing: '-0.04em' }}>{engagement.homework.completed}</p><p className="text-[11px] text-neutral-500 mt-0.5">Ô£ô Completed</p></div>
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center"><p className="text-[22px] font-black text-amber-700" style={{ letterSpacing: '-0.04em' }}>{engagement.homework.partial}</p><p className="text-[11px] text-neutral-500 mt-0.5">┬¢ Partial</p></div>
                      <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center"><p className="text-[22px] font-black text-red-600" style={{ letterSpacing: '-0.04em' }}>{engagement.homework.not_submitted}</p><p className="text-[11px] text-neutral-500 mt-0.5">Ô£ù Not submitted</p></div>
                    </div>
                    <div className="space-y-2">
                      {engagement.homework.history.slice(0, 10).map((hw, i) => {
                        const total = hw.completed + hw.partial + hw.not_submitted;
                        const pct = total > 0 ? Math.round((hw.completed / total) * 100) : 0;
                        const raw = (hw.date || '').split('T')[0];
                        return (
                          <div key={i} className="bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <div><span className="text-[12px] font-semibold text-neutral-700">{raw ? new Date(raw + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : 'ÔÇö'}</span><span className="text-[10px] text-neutral-400 ml-2">{hw.class_name} {hw.section_label} ┬À {hw.teacher_name}</span></div>
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${pct >= 75 ? 'bg-emerald-100 text-emerald-700' : pct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{pct}%</span>
                            </div>
                            <div className="flex gap-3 text-[11px]"><span className="text-emerald-600">Ô£ô {hw.completed}</span><span className="text-amber-600">┬¢ {hw.partial}</span><span className="text-red-500">Ô£ù {hw.not_submitted}</span></div>
                            <div className="w-full bg-neutral-200 rounded-full h-1 mt-2"><div className="h-1 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {engagementTab === 'messages' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-4 text-center"><p className="text-[22px] font-black text-neutral-800" style={{ letterSpacing: '-0.04em' }}>{engagement.messages.total}</p><p className="text-[11px] text-neutral-500 mt-0.5">Total</p></div>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center"><p className="text-[22px] font-black text-blue-700" style={{ letterSpacing: '-0.04em' }}>{engagement.messages.teacher_sent}</p><p className="text-[11px] text-neutral-500 mt-0.5">­ƒæ®ÔÇì­ƒÅ½ Teachers</p></div>
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-center"><p className="text-[22px] font-black text-purple-700" style={{ letterSpacing: '-0.04em' }}>{engagement.messages.parent_sent}</p><p className="text-[11px] text-neutral-500 mt-0.5">­ƒæ¿ÔÇì­ƒæ®ÔÇì­ƒæº Parents</p></div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center"><p className="text-[22px] font-black text-emerald-700" style={{ letterSpacing: '-0.04em' }}>{engagement.messages.active_threads}</p><p className="text-[11px] text-neutral-500 mt-0.5">Active threads</p></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Panel>

        {/* ÔöÇÔöÇ ANNOUNCEMENTS ÔöÇÔöÇ */}
        <Panel>
          <PanelHeader
            icon={<Megaphone className="w-4 h-4 text-purple-500" />}
            title="Announcements"
            subtitle={announcements.length > 0 ? `${announcements.length} recent ┬À post new below` : 'No announcements yet'}
            expanded={annExpanded} onToggle={() => setAnnExpanded(v => !v)}
          />
          {annExpanded && (
            <div className="border-t border-neutral-100 px-5 py-4 space-y-4">
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Post New Announcement</p>
                <input type="text" placeholder="Title (max 100 chars)" value={newAnnTitle} onChange={e => setNewAnnTitle(e.target.value)} maxLength={100}
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-white" />
                <textarea placeholder="Message bodyÔÇª" value={newAnnBody} onChange={e => setNewAnnBody(e.target.value)} maxLength={1000} rows={3}
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-white resize-none" />
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-neutral-400">Sent to all teachers & parents</p>
                  <button onClick={postAnnouncement} disabled={!newAnnTitle.trim() || !newAnnBody.trim() || annPosting}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white text-[12px] font-bold rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-40">
                    <Send className="w-3 h-3" />{annPosting ? 'PostingÔÇª' : 'Post'}
                  </button>
                </div>
              </div>
              {announcements.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Recent</p>
                  {announcements.map(a => (
                    <div key={a.id} className="bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-neutral-800 truncate">{a.title}</p>
                        <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-2">{a.body}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.target_audience === 'all' ? 'bg-blue-100 text-blue-700' : a.target_audience === 'teachers' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'}`}>{a.target_audience === 'all' ? 'Everyone' : a.target_audience}</span>
                        <p className="text-[10px] text-neutral-400 mt-1">{new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                      </div>
                    </div>
                  ))}
                  <Link href="/admin/announcements" className="block text-center text-[11px] text-neutral-500 font-semibold hover:text-neutral-800 transition-colors pt-1">Manage all ÔåÆ</Link>
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* ÔöÇÔöÇ QUICK ACCESS ÔöÇÔöÇ */}
        <div>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3">Quick Access</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {quickLinks.map(({ href, icon, label, desc, bg, iconBg, text }) => (
              <Link key={href} href={href}>
                <div className={`group ${bg} border border-neutral-200/60 rounded-2xl p-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col items-center text-center gap-2.5`}>
                  <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center text-xl group-hover:scale-110 transition-transform duration-200`}>{icon}</div>
                  <div>
                    <p className={`text-[11px] font-bold ${text} leading-tight`}>{label}</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5 leading-tight">{desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ÔöÇÔöÇ TIME MACHINE ÔöÇÔöÇ */}
        {tm && (
          <Panel>
            <div className="px-5 py-4 flex items-center gap-3 border-b border-neutral-100">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-[18px]">­ƒò░´©Å</div>
              <div className="flex-1"><p className="text-[13px] font-semibold text-neutral-800">Time Machine</p><p className="text-[11px] text-neutral-400">Test the system with a different date</p></div>
              {tm.active && <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Active ┬À {Math.ceil((tm.ttl_seconds ?? 0) / 3600)}h left</span>}
            </div>
            <div className="px-5 py-4">
              {tm.active ? (
                <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <div><p className="text-[13px] font-semibold text-amber-800">Using <strong>{tm.mock_date}</strong> as today</p><p className="text-[11px] text-amber-600 mt-0.5">Resets at {tm.expires_at ? new Date(tm.expires_at).toLocaleString('en-IN') : 'ÔÇö'}</p></div>
                  <button onClick={deactivateTmHandler} disabled={tmLoading} className="px-4 py-2 bg-red-600 text-white text-[12px] font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50">{tmLoading ? 'ÔÇª' : 'Disable'}</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><label className="text-[11px] font-semibold text-neutral-500 mb-1.5 block">Mock Date</label><input type="date" value={tmDate} onChange={e => setTmDate(e.target.value)} className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-neutral-400" /></div>
                  <div><label className="text-[11px] font-semibold text-neutral-500 mb-1.5 block">Duration</label><select value={tmHours} onChange={e => setTmHours(Number(e.target.value))} className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-[13px] focus:outline-none">{[1,4,8,24,48,72].map(h => <option key={h} value={h}>{h}h</option>)}</select></div>
                  <div className="flex items-end"><button onClick={activateTm} disabled={!tmDate || tmLoading} className="w-full px-4 py-2.5 bg-neutral-900 text-white text-[13px] font-bold rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-40">{tmLoading ? 'LoadingÔÇª' : 'Activate'}</button></div>
                </div>
              )}
            </div>
          </Panel>
        )}

      </div>
    </div>

    {/* ÔöÇÔöÇ MODALS ÔöÇÔöÇ */}
    {drillModal && (
      <StatDrillModal type={drillModal} todaySnap={todaySnap} stats={stats} onClose={() => setDrillModal(null)} />
    )}
    {birthdayModal && (
      <BirthdayWishModal birthdays={birthdays} onClose={() => setBirthdayModal(false)} />
    )}
    </>
  );
}


/* ÔöÇÔöÇ Attendance chart ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */
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
    </div>
  );
}

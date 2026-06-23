'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

import { apiGet } from '@/lib/api';
import { getToken, clearToken, getRoleRedirect } from '@/lib/auth';
import FeeSummaryCard from '@/features/admin/fees/FeeSummaryCard';

import HeroHeader             from './dashboard/HeroHeader';
import SchoolHealthCharts     from './dashboard/SchoolHealthCharts';
import TeacherInsights        from './dashboard/TeacherInsights';
import CoverageChart          from './dashboard/CoverageChart';
import SectionsDrillDown      from './dashboard/SectionsDrillDown';
import BirthdayPanel          from './dashboard/BirthdayPanel';
import PendingApprovalsBanner from './dashboard/PendingApprovalsBanner';
import FinanceSnapshot        from './dashboard/FinanceSnapshot';
import SchoolFeedPanel        from './dashboard/SchoolFeedPanel';
import InsightsPanel          from './dashboard/InsightsPanel';
import OakieFloatingChat      from './dashboard/OakieFloatingChat';
import type {
  PrincipalContext, EngagementTeacher, BirthdayKid,
  PendingApprovals, Message, SectionSummary,
} from './dashboard/types';

export default function PrincipalDashboard() {
  const router = useRouter();
  const token  = getToken() || '';

  const [ctx,              setCtx]              = useState<PrincipalContext | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [initialMessages,  setInitialMessages]  = useState<Message[]>([]);
  const [safetyAlerts,     setSafetyAlerts]     = useState<any[]>([]);
  const [birthdays,        setBirthdays]        = useState<BirthdayKid[]>([]);
  const [engagement,       setEngagement]       = useState<EngagementTeacher[]>([]);
  const [schoolDays30d,    setSchoolDays30d]    = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovals>({
    concessions: 0, overrides: 0, cancellations: 0,
  });

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    const role = localStorage.getItem('oakit_role');
    if (role && !['principal', 'admin'].includes(role.toLowerCase())) {
      router.push(getRoleRedirect(role)); return;
    }

    (async () => {
    // Load context first — it's the critical call
    let ctxData: PrincipalContext;
    try {
      ctxData = await apiGet<PrincipalContext>('/api/v1/principal/context', token);
    } catch (err: any) {
      console.error('[principal/context]', err);
      // If it's a 401/403, redirect to login
      if (err?.message?.includes('401') || err?.message?.includes('403') || err?.message?.includes('Unauthorized')) {
        clearToken();
        router.push('/login');
        return;
      }
      // For any other error, show a minimal fallback context so the page still renders
      ctxData = {
        principal_name: 'Principal',
        greeting: 'Good day!',
        thought_for_day: '',
        today: new Date().toISOString().split('T')[0],
        sections: [],
        teacher_streaks: [],
        summary: {
          total_students: 0, total_present: 0, total_absent: 0,
          attendance_submitted: 0, plans_completed: 0, homework_sent: 0, total_sections: 0,
        },
      };
    }

    setCtx(ctxData);
    setInitialMessages([{ role: 'assistant', text: `${ctxData.greeting}${ctxData.thought_for_day ? `\n\n${ctxData.thought_for_day}` : ''}` }]);

    // Load everything else in parallel — all failures are silent
    const [safetyData, bdData, engData, [conc, ovr, cncl]] = await Promise.all([
      apiGet<{ alerts: any[] }>('/api/v1/admin/audit/safety-alerts', token).catch(() => ({ alerts: [] })),
      apiGet<BirthdayKid[]>('/api/v1/principal/birthdays?days=7', token).catch(() => []),
      apiGet<{ teachers: EngagementTeacher[]; school_days_30d: number }>(
        '/api/v1/principal/teachers/engagement', token
      ).catch(() => ({ teachers: [], school_days_30d: 0 })),
      Promise.all([
        apiGet<any[]>('/api/v1/financial/concessions/pending', token).catch(() => []),
        apiGet<any[]>('/api/v1/financial/payments/pending-overrides', token).catch(() => []),
        apiGet<any[]>('/api/v1/financial/payments/pending-cancellations', token).catch(() => []),
      ]),
    ]);

    setSafetyAlerts(safetyData.alerts || []);
    setBirthdays((bdData || []).filter(
      (k: BirthdayKid) => k.name && typeof k.days_until === 'number' && k.id
    ));
    setEngagement(engData.teachers || []);
    setSchoolDays30d(engData.school_days_30d || 0);
    setPendingApprovals({
      concessions:   Array.isArray(conc) ? conc.length : 0,
      overrides:     Array.isArray(ovr)  ? ovr.length  : 0,
      cancellations: Array.isArray(cncl) ? cncl.length : 0,
    });

    setLoading(false);
    })();
  }, []);

  /* ── derived ── */
  const todayLabel = ctx?.today
    ? new Date(ctx.today + 'T12:00:00').toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : '';

  const byClass: Record<string, SectionSummary[]> = {};
  (ctx?.sections || []).forEach(s => {
    if (!byClass[s.class_name]) byClass[s.class_name] = [];
    byClass[s.class_name].push(s);
  });

  const totalSections = ctx?.summary.total_sections ?? 0;
  const attPct    = ctx ? Math.round((ctx.summary.attendance_submitted / Math.max(totalSections, 1)) * 100) : 0;
  const planPct   = ctx ? Math.round(((ctx.summary.plans_completed ?? 0) / Math.max(totalSections, 1)) * 100) : 0;
  const avgCovPct = ctx?.sections.length
    ? Math.round(ctx.sections.reduce((s, sec) => s + (sec.coverage_pct ?? 0), 0) / ctx.sections.length)
    : 0;
  const pendingTotal = pendingApprovals.concessions + pendingApprovals.overrides + pendingApprovals.cancellations;

  /* ── loading / error ── */
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-[#1B4332]/20 border-t-[#1B4332] animate-spin" />
          <p className="text-sm text-neutral-500">Loading dashboard…</p>
        </div>
      </div>
    );
  }
  if (!ctx) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-50">
        <p className="text-sm text-neutral-500">Failed to load. Please refresh.</p>
      </div>
    );
  }

  /* ── render ── */
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#F0F2F5' }}>

      {/* ── Hero header (full width) ── */}
      <HeroHeader
        ctx={ctx}
        todayLabel={todayLabel}
        onSignOut={() => { clearToken(); router.push('/login'); }}
        pendingCount={pendingTotal}
      />

      {/* ── Responsive body ── */}
      {/* Mobile: single column scroll | lg: 2 cols | xl: 3 cols */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col xl:flex-row min-h-full">

          {/* ════ LEFT + CENTRE merged on mobile, split on lg ════ */}
          <div className="flex flex-col lg:flex-row flex-1 min-w-0">

            {/* ── LEFT COLUMN ── */}
            <div className="flex-1 min-w-0 p-4 space-y-4">

              {/* Safety alerts */}
              {safetyAlerts.length > 0 && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3 widget-enter widget-enter-1 widget-alert">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-800">
                      {safetyAlerts.length} Content Alert{safetyAlerts.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">Review in Admin → Audit Log</p>
                  </div>
                </div>
              )}

              <div className="widget-enter widget-enter-1">
                <PendingApprovalsBanner pending={pendingApprovals} />
              </div>

              <div className="widget-enter widget-enter-2">
                <SchoolHealthCharts
                  ctx={ctx}
                  avgCovPct={avgCovPct}
                  attPct={attPct}
                  planPct={planPct}
                  byClass={byClass}
                />
              </div>

              <div className="widget-enter widget-enter-3">
                <FinanceSnapshot token={token} />
              </div>

              <div className="widget-enter widget-enter-4">
                <FeeSummaryCard token={token} />
              </div>

              <div className="widget-enter widget-enter-5">
                <BirthdayPanel birthdays={birthdays} token={token} />
              </div>

              {/* On mobile: show centre-column content inline */}
              <div className="lg:hidden space-y-4">
                <InsightsPanel token={token} />
                {(engagement.length > 0 || ctx.teacher_streaks.length > 0) && (
                  <TeacherInsights
                    engagement={engagement}
                    streaks={ctx.teacher_streaks}
                    schoolDays30d={schoolDays30d}
                  />
                )}
                <CoverageChart sections={ctx.sections} byClass={byClass} />
                <SectionsDrillDown byClass={byClass} totalStudents={ctx.summary.total_students} />
              </div>

              {/* On mobile: show feed inline */}
              <div className="xl:hidden">
                <SchoolFeedPanel token={token} maxPosts={3} />
              </div>

            </div>

            {/* ── CENTRE COLUMN (lg+) ── */}
            <div
              className="hidden lg:flex flex-col overflow-y-auto shrink-0 p-4 space-y-4 border-l border-neutral-200/70"
              style={{ width: 380 }}
            >
              <div className="widget-enter widget-enter-1">
                <InsightsPanel token={token} />
              </div>
              {(engagement.length > 0 || ctx.teacher_streaks.length > 0) && (
                <div className="widget-enter widget-enter-2">
                  <TeacherInsights
                    engagement={engagement}
                    streaks={ctx.teacher_streaks}
                    schoolDays30d={schoolDays30d}
                  />
                </div>
              )}
              <div className="widget-enter widget-enter-3">
                <CoverageChart sections={ctx.sections} byClass={byClass} />
              </div>
              <div className="widget-enter widget-enter-4">
                <SectionsDrillDown byClass={byClass} totalStudents={ctx.summary.total_students} />
              </div>
            </div>

          </div>

          {/* ── RIGHT COLUMN — feed (xl+) ── */}
          <div
            className="hidden xl:flex flex-col overflow-y-auto shrink-0 border-l border-neutral-200/70 p-4 space-y-4"
            style={{ width: 340 }}
          >
            <div className="widget-enter widget-enter-1">
              <SchoolFeedPanel token={token} maxPosts={3} />
            </div>
          </div>

        </div>
      </div>

      {/* ── Floating Oakie chat button ── */}
      <OakieFloatingChat initialMessages={initialMessages} token={token} />
    </div>
  );
}

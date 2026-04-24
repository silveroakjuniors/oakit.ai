'use client';
import { Lightbulb, TrendingUp, Target, BarChart2, CheckCircle2, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { useTranslation } from '../context';
import type { ParentInsights, ChildComparison, Child, Goal } from '../types';

const P = {
  brand: '#1F7A5A', brandDark: '#166A4D', brandSoft: '#E8F3EF', brandBorder: '#A7D4C0',
  bg: '#F8FAFC', card: '#F8FAFC', border: '#E4E4E7',
  text: '#18181B', textSub: '#3F3F46', textMuted: '#71717A',
};

const cardStyle: React.CSSProperties = {
  background: P.card, border: `1px solid ${P.border}`,
  borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden',
  transition: 'box-shadow 0.18s ease, transform 0.18s ease',
};

const cardHoverClass = 'hover:shadow-md hover:-translate-y-0.5';

function SectionLabel({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={14} strokeWidth={1.75} style={{ color: P.textMuted }} />
      <p className="text-sm font-semibold" style={{ color: P.textSub }}>{text}</p>
    </div>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full" style={{ background: P.border }}>
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function statusStyle(status: Goal['status']) {
  if (status === 'completed')  return { bg: P.brandSoft,  color: P.brandDark };
  if (status === 'in_progress') return { bg: '#EFF6FF',    color: '#1D4ED8'   };
  if (status === 'overdue')     return { bg: '#FEF2F2',    color: '#DC2626'   };
  return { bg: P.bg, color: P.textMuted };
}

export default function InsightsTab({ insights, comparisons, activeChild }: {
  insights: ParentInsights | null; comparisons: ChildComparison[]; activeChild: Child | null;
}) {
  const { t } = useTranslation();

  if (!insights || !activeChild) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: P.brandSoft }}>
        <Lightbulb size={28} strokeWidth={1.5} style={{ color: P.brand }} />
      </div>
      <p className="text-sm font-semibold mb-1" style={{ color: P.text }}>Loading insights…</p>
      <p className="text-sm" style={{ color: P.textMuted }}>AI is analysing your child's progress</p>
    </div>
  );

  const name = activeChild.name.split(' ')[0];

  return (
    <div className="space-y-4 pb-6">

      {/* AI Insights */}
      <div className={cardHoverClass} style={cardStyle}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}`, background: P.bg }}>
          <SectionLabel icon={Lightbulb} text={`AI Insights — ${name}`} />
          <p className="text-xs -mt-2" style={{ color: P.textMuted }}>Observations from {name}'s teacher</p>
        </div>
        <div className="px-5 py-4 space-y-5">

          {/* Strengths */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: P.brand }}>Strengths</p>
            <div className="space-y-2">
              {insights.strengths?.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 size={13} strokeWidth={2} className="shrink-0 mt-0.5" style={{ color: P.brand }} />
                  <p className="text-sm" style={{ color: P.textSub }}>{s}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Areas for improvement */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#B45309' }}>Areas for Improvement</p>
            <div className="space-y-2">
              {insights.areasForImprovement?.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: '#B45309' }} />
                  <p className="text-sm" style={{ color: P.textSub }}>{s}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Teacher actions */}
          {insights.teacherFeedback?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: P.textMuted }}>Teacher's Actions</p>
              <div className="space-y-2">
                {insights.teacherFeedback.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm" style={{ color: P.textSub }}>
                    <CheckCircle2 size={13} strokeWidth={2} className="shrink-0 mt-0.5" style={{ color: P.textMuted }} />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Predictions */}
      <div className={cardHoverClass} style={cardStyle}>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}`, background: P.bg }}>
          <SectionLabel icon={TrendingUp} text="Predictions" />
        </div>
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Next Week Attendance',  value: `${insights.predictions.nextWeekAttendance}%`,  color: P.brand   },
              { label: 'End of Month Progress', value: `${insights.predictions.endOfMonthProgress}%`, color: '#1D4ED8' },
              { label: 'Participation Score',   value: `${insights.participationScore}`,               color: '#7C3AED' },
            ].map(p => (
              <div key={p.label} className="rounded-lg p-3 text-center transition-all hover:shadow-md hover:-translate-y-0.5"
                style={{ background: P.bg, border: `1px solid ${P.border}` }}>
                <p className="text-xl font-semibold" style={{ color: p.color }}>{p.value}</p>
                <p className="text-[10px] mt-0.5 leading-tight" style={{ color: P.textMuted }}>{p.label}</p>
              </div>
            ))}
          </div>

          {insights.predictions.areasNeedingAttention?.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: P.textMuted }}>How You Can Help at Home</p>
              <div className="space-y-2">
                {insights.predictions.areasNeedingAttention.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm" style={{ color: P.textSub }}>
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: P.brand }} />
                    {a}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Goals */}
      {insights.goals && (
        <div className={cardHoverClass} style={cardStyle}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}`, background: P.bg }}>
            <SectionLabel icon={Target} text={t('Goal Setting', 'Goals')} />
          </div>
          <div className="px-5 py-4 space-y-3">
            {Object.entries(insights.goals).flatMap(([, goals]) => goals).map(goal => {
              const sc = statusStyle(goal.status);
              const numCurrent = parseFloat(goal.current) || 0;
              const numTarget  = parseFloat(goal.target.replace('%','').replace('x/week','')) || 1;
              const barPct = Math.min(100, Math.round((numCurrent / numTarget) * 100));
              return (
                <div key={goal.id} className="rounded-lg p-4 transition-all hover:shadow-sm hover:-translate-y-0.5"
                  style={{ background: P.bg, border: `1px solid ${P.border}` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium" style={{ color: P.text }}>{goal.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: sc.bg, color: sc.color }}>
                      {goal.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs mb-2" style={{ color: P.textMuted }}>{goal.description}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1"><Bar pct={barPct} color={P.brand} /></div>
                    <span className="text-[10px] shrink-0" style={{ color: P.textMuted }}>{goal.current} / {goal.target}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comparison */}
      {comparisons.length > 0 && (
        <div className={cardHoverClass} style={cardStyle}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${P.border}`, background: P.bg }}>
            <SectionLabel icon={BarChart2} text={t('Performance Comparison', 'Performance')} />
          </div>
          <div className="px-5 py-4 space-y-3">
            {comparisons.map(comp => {
              const TrendIcon = comp.trend === 'up' ? ArrowUpRight : comp.trend === 'down' ? ArrowDownRight : Minus;
              const trendColor = comp.trend === 'up' ? P.brand : comp.trend === 'down' ? '#DC2626' : P.textMuted;
              const isActive = comp.childId === activeChild.id;
              return (
                <div key={comp.childId} className="rounded-lg p-4 transition-all hover:shadow-sm hover:-translate-y-0.5"
                  style={{ background: isActive ? P.brandSoft : P.bg, border: `1px solid ${isActive ? P.brandBorder : P.border}` }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold" style={{ color: P.text }}>{comp.name}</span>
                    <div className="flex items-center gap-1">
                      <TrendIcon size={14} strokeWidth={2} style={{ color: trendColor }} />
                      <span className="text-xs font-medium" style={{ color: trendColor }}>
                        {comp.trend === 'up' ? 'Improving' : comp.trend === 'down' ? 'Declining' : 'Stable'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[['Attendance', comp.attendance], ['Progress', comp.progress], ['Participation', comp.participation]].map(([l, v]) => (
                      <div key={l as string}>
                        <p style={{ color: P.textMuted }}>{l as string}</p>
                        <p className="font-semibold" style={{ color: P.text }}>{v as number}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

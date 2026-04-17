'use client';
import { Loader2, TrendingUp, BarChart3, Target, BookOpen, User, Calendar, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useTranslation } from '../context';
import type { ParentInsights, ChildComparison, Child, Goal } from '../types';

export default function InsightsTab({ insights, comparisons, activeChild }: {
  insights: ParentInsights | null; comparisons: ChildComparison[]; activeChild: Child | null;
}) {
  const { t } = useTranslation();

  if (!insights || !activeChild) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-neutral-300 animate-spin" />
      </div>
    );
  }

  const childFirstName = activeChild.name.split(' ')[0];

  function getStatusColor(status: Goal['status']) {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'overdue': return 'text-red-600 bg-red-50';
      default: return 'text-neutral-600 bg-neutral-50';
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Period header ── */}
      <div className="flex items-center gap-2 px-1">
        <Calendar size={14} className="text-neutral-400" />
        <p className="text-xs font-semibold text-neutral-500">Insights from the last 16 days · June 1 – 16, 2026</p>
      </div>

      {/* ── Key Findings ── */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-50 bg-amber-50/50">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600" />
            <h2 className="text-sm font-bold text-neutral-800">Key Findings — {childFirstName}</h2>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">Observations recorded by {childFirstName}'s teacher over the past 16 days</p>
        </div>
        <div className="divide-y divide-neutral-50">
          {insights.areasForImprovement?.map((area, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3.5">
              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs">⚠️</span>
              </div>
              <p className="text-sm text-neutral-700 leading-relaxed">{area}</p>
            </div>
          ))}
          {insights.strengths?.map((s, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3.5">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 size={12} className="text-emerald-600" />
              </div>
              <p className="text-sm text-neutral-700 leading-relaxed">{s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Teacher's Plan ── */}
      {insights.teacherFeedback && insights.teacherFeedback.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-50 bg-blue-50/50">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-blue-600" />
              <h2 className="text-sm font-bold text-neutral-800">Teacher's Plan for {childFirstName}</h2>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">What the teacher is focusing on in the coming days</p>
          </div>
          <div className="divide-y divide-neutral-50">
            {insights.teacherFeedback.map((f, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                <ArrowRight size={14} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-sm text-neutral-700 leading-relaxed">{f}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── How Parents Can Help ── */}
      {insights.predictions?.areasNeedingAttention && insights.predictions.areasNeedingAttention.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-50 bg-emerald-50/50">
            <div className="flex items-center gap-2">
              <User size={16} className="text-emerald-600" />
              <h2 className="text-sm font-bold text-neutral-800">How You Can Help at Home</h2>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">Simple things parents can do to support {childFirstName}'s growth</p>
          </div>
          <div className="divide-y divide-neutral-50">
            {insights.predictions.areasNeedingAttention.map((area, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs">💚</span>
                </div>
                <p className="text-sm text-neutral-700 leading-relaxed">{area}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Progress Predictions ── */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-emerald-600" />
          <h2 className="text-sm font-bold text-neutral-800">{t('Progress Predictions')}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4">
            <p className="text-xs font-medium text-emerald-800 mb-1">{t('Next Week Attendance')}</p>
            <div className="text-2xl font-bold text-emerald-700">{insights.predictions.nextWeekAttendance}%</div>
            <div className="text-[10px] text-emerald-600 mt-1">Predicted</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
            <p className="text-xs font-medium text-blue-800 mb-1">{t('End of Month Progress')}</p>
            <div className="text-2xl font-bold text-blue-700">{insights.predictions.endOfMonthProgress}%</div>
            <div className="text-[10px] text-blue-600 mt-1">Expected</div>
          </div>
        </div>
      </div>

      {/* ── Goals ── */}
      {insights.goals && (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} className="text-purple-600" />
            <h2 className="text-sm font-bold text-neutral-800">{t('Goal Setting')}</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(insights.goals).flatMap(([, goals]) => goals).map(goal => (
              <div key={goal.id} className="border border-neutral-100 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-neutral-800">{goal.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${getStatusColor(goal.status)}`}>
                    {goal.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mb-2">{goal.description}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-neutral-100 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (parseFloat(goal.current) / parseFloat(goal.target.replace('%', ''))) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-neutral-500 shrink-0">{goal.current} / {goal.target}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Performance Comparison ── */}
      {comparisons.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-indigo-600" />
            <h2 className="text-sm font-bold text-neutral-800">{t('Performance Comparison')}</h2>
          </div>
          <div className="space-y-3">
            {comparisons.map(comp => (
              <div key={comp.childId} className={`border rounded-xl p-3 ${comp.childId === activeChild.id ? 'border-emerald-300 bg-emerald-50' : 'border-neutral-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-neutral-800">{comp.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${comp.trend === 'up' ? 'text-green-600 bg-green-50' : comp.trend === 'down' ? 'text-red-600 bg-red-50' : 'text-neutral-600 bg-neutral-50'}`}>
                    {comp.trend === 'up' ? '↗️' : comp.trend === 'down' ? '↘️' : '→'} {comp.trend}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><div className="text-neutral-400">Attendance</div><div className="font-semibold">{comp.attendance}%</div></div>
                  <div><div className="text-neutral-400">Progress</div><div className="font-semibold">{comp.progress}%</div></div>
                  <div><div className="text-neutral-400">Participation</div><div className="font-semibold">{comp.participation}%</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

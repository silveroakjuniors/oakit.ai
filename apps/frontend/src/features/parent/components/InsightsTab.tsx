'use client';
import { Loader2, TrendingUp, BarChart3, Target, BookOpen, User, Calendar, AlertCircle } from 'lucide-react';
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

  function getStatusColor(status: Goal['status']) {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'overdue': return 'text-red-600 bg-red-50';
      default: return 'text-neutral-600 bg-neutral-50';
    }
  }

  function getStatusIcon(status: Goal['status']) {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '🔄';
      case 'overdue': return '⚠️';
      default: return '⏳';
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress Predictions */}
      <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-6 h-6 text-emerald-600" />
          <h2 className="text-xl font-bold text-neutral-800">{t('Progress Predictions')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-emerald-800">{t('Next Week Attendance')}</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-700">{insights.predictions.nextWeekAttendance}%</div>
            <div className="text-xs text-emerald-600 mt-1">{t('Predicted attendance rate')}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-800">{t('End of Month Progress')}</span>
              <BarChart3 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-700">{insights.predictions.endOfMonthProgress}%</div>
            <div className="text-xs text-blue-600 mt-1">{t('Expected academic progress')}</div>
          </div>
        </div>
        {insights.predictions.areasNeedingAttention.length > 0 && (
          <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 mb-2">{t('Areas Needing Attention')}</h3>
                <ul className="text-sm text-amber-700 space-y-1">
                  {insights.predictions.areasNeedingAttention.map((area, idx) => (
                    <li key={idx}>• {area}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Goal Setting */}
      {insights.goals && (
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-neutral-800">{t('Goal Setting')}</h2>
          </div>
          <div className="space-y-4">
            {Object.entries(insights.goals).map(([category, goals]) => (
              <div key={category}>
                <h3 className="font-semibold text-neutral-700 mb-3 capitalize flex items-center gap-2">
                  {category === 'academic' && <BookOpen className="w-4 h-4" />}
                  {category === 'behavioral' && <User className="w-4 h-4" />}
                  {category === 'attendance' && <Calendar className="w-4 h-4" />}
                  {t(`${category.charAt(0).toUpperCase() + category.slice(1)} Goals`, `${category} Goals`)}
                </h3>
                <div className="space-y-3">
                  {goals.map(goal => (
                    <div key={goal.id} className="border border-neutral-200 rounded-xl p-4 hover:bg-neutral-50 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-neutral-800">{goal.title}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(goal.status)}`}>
                          {getStatusIcon(goal.status)} {goal.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 mb-2">{goal.description}</p>
                      <div className="flex items-center gap-4 text-xs text-neutral-500 mb-3">
                        <span>Target: {goal.target}</span>
                        <span>Current: {goal.current}</span>
                        <span>Due: {new Date(goal.deadline).toLocaleDateString()}</span>
                      </div>
                      <div className="w-full bg-neutral-200 rounded-full h-2">
                        <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (parseFloat(goal.current) / parseFloat(goal.target.replace('%', ''))) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Comparison */}
      <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-neutral-800">{t('Performance Comparison')}</h2>
        </div>
        <div className="space-y-3">
          {comparisons.map(comp => (
            <div key={comp.childId} className={`border rounded-xl p-4 ${comp.childId === activeChild.id ? 'border-emerald-300 bg-emerald-50' : 'border-neutral-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-neutral-800">{comp.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-600">Rank #{comp.rank}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${comp.trend === 'up' ? 'text-green-600 bg-green-50' : comp.trend === 'down' ? 'text-red-600 bg-red-50' : 'text-neutral-600 bg-neutral-50'}`}>
                    {comp.trend === 'up' ? '↗️' : comp.trend === 'down' ? '↘️' : '→'} {comp.trend}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><div className="text-neutral-500">Attendance</div><div className="font-semibold text-neutral-800">{comp.attendance}%</div></div>
                <div><div className="text-neutral-500">Progress</div><div className="font-semibold text-neutral-800">{comp.progress}%</div></div>
                <div><div className="text-neutral-500">Participation</div><div className="font-semibold text-neutral-800">{comp.participation}%</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

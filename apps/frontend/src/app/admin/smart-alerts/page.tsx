'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface Alert {
  type: string;
  severity: 'high' | 'medium';
  title: string;
  detail: string;
  teacher_id?: string;
  section_label?: string;
  class_name?: string;
  coverage_pct?: number;
  attendance_pct?: number;
  performance_score?: number;
  avg_pct?: number;
  subject?: string;
  unlogged_days?: number;
}

interface TeacherScore {
  teacher_id: string;
  teacher_name: string;
  class_name: string;
  section_label: string;
  performance_score: number;
  band: 'green' | 'amber' | 'red';
  compliance_pct: number;
  current_streak: number;
  ai_queries_7d: number;
  att_days_marked: number;
  homework_days_sent: number;
  notes_sent: number;
  factors: Record<string, { score: number; weight: number; label: string; detail: string }>;
}

interface AlertsData {
  alerts: Alert[];
  teacher_scores: TeacherScore[];
  summary: {
    total_alerts: number;
    high: number;
    medium: number;
  };
  generated_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  teacher_not_completing: '📋',
  low_attendance_trend: '📉',
  class_falling_behind: '📚',
  weak_subject: '🧪',
  low_teacher_performance: '⚠️',
};

const TYPE_LABELS: Record<string, string> = {
  teacher_not_completing: 'Plan Completion',
  low_attendance_trend: 'Attendance',
  class_falling_behind: 'Curriculum Coverage',
  weak_subject: 'Quiz Performance',
  low_teacher_performance: 'Teacher Performance',
};

export default function SmartAlertsPage() {
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'alerts' | 'scores'>('alerts');
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);
  const token = getToken();

  useEffect(() => {
    if (!token) return;
    apiGet<AlertsData>('/api/v1/admin/smart-alerts', token)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const bandColor = (band: string) =>
    band === 'green' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    band === 'amber' ? 'text-amber-700 bg-amber-50 border-amber-200' :
    'text-red-700 bg-red-50 border-red-200';

  const severityColor = (s: string) =>
    s === 'high' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200';

  if (loading) return <div className="p-6 text-gray-400">Loading smart alerts...</div>;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Smart Alerts</h1>
        <p className="text-sm text-gray-500 mt-1">AI-computed school intelligence — attendance, coverage, teacher performance</p>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-3xl font-bold text-gray-900">{data.summary.total_alerts}</p>
            <p className="text-xs text-gray-500 mt-1">Total Alerts</p>
          </div>
          <div className="bg-red-50 rounded-2xl border border-red-100 p-4 text-center">
            <p className="text-3xl font-bold text-red-700">{data.summary.high}</p>
            <p className="text-xs text-red-600 mt-1">High Priority</p>
          </div>
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 text-center">
            <p className="text-3xl font-bold text-amber-700">{data.summary.medium}</p>
            <p className="text-xs text-amber-600 mt-1">Medium Priority</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2">
        {(['alerts', 'scores'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'text-gray-500 hover:bg-gray-50'
            }`}>
            {t === 'alerts' ? '🚨 Alerts' : '📊 Teacher Scores'}
          </button>
        ))}
      </div>

      {tab === 'alerts' && (
        <div className="space-y-3">
          {!data?.alerts.length ? (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-8 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="font-semibold text-emerald-800">All clear!</p>
              <p className="text-sm text-emerald-600 mt-1">No alerts at this time.</p>
            </div>
          ) : data.alerts.map((alert, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{TYPE_ICONS[alert.type] || '⚠️'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-gray-900 text-sm">{alert.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${severityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {TYPE_LABELS[alert.type]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{alert.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'scores' && (
        <div className="space-y-3">
          {!data?.teacher_scores.length ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">No teacher data available.</div>
          ) : data.teacher_scores
              .sort((a, b) => a.performance_score - b.performance_score)
              .map(t => (
            <div key={t.teacher_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button className="w-full p-4 text-left" onClick={() => setExpandedTeacher(expandedTeacher === t.teacher_id ? null : t.teacher_id)}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg border ${bandColor(t.band)}`}>
                      {t.performance_score}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{t.teacher_name}</p>
                      <p className="text-xs text-gray-500">{t.class_name} – Section {t.section_label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${bandColor(t.band)}`}>
                      {t.band === 'green' ? 'Good' : t.band === 'amber' ? 'Needs Attention' : 'At Risk'}
                    </span>
                    <span className="text-gray-400 text-sm">{expandedTeacher === t.teacher_id ? '▲' : '▼'}</span>
                  </div>
                </div>
              </button>

              {expandedTeacher === t.teacher_id && (
                <div className="px-4 pb-4 border-t border-gray-50 pt-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.values(t.factors).map(f => (
                      <div key={f.label} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-gray-700">{f.label}</p>
                          <span className="text-xs font-bold text-gray-900">{f.score}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                          <div className={`h-1.5 rounded-full ${f.score >= 75 ? 'bg-emerald-500' : f.score >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${f.score}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-500">{f.detail}</p>
                        <p className="text-[10px] text-gray-400">Weight: {f.weight}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {data && (
        <p className="text-xs text-gray-400 text-center mt-4">
          Last updated: {new Date(data.generated_at).toLocaleString('en-IN')} · Refreshes every 5 minutes
        </p>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import Badge from '@/components/ui/Badge';

interface SectionActivity {
  section_id: string; section_name: string;
  status: 'submitted' | 'behind' | 'not_working_day'; chunks_covered: number;
}
interface TeacherActivity {
  teacher_id: string; teacher_name: string; sections: SectionActivity[];
}
interface EngagementTeacher {
  id: string; name: string; role_name: string;
  current_streak: number; best_streak: number; last_completed_date: string | null;
  completions_30d: number; completion_rate_30d: number; days_since_last: number; amber_warning: boolean;
}

const statusVariant = (s: string) =>
  s === 'submitted' ? 'success' : s === 'behind' ? 'danger' : 'neutral';

export default function TeacherActivityPage() {
  const [teachers, setTeachers] = useState<TeacherActivity[]>([]);
  const [engagement, setEngagement] = useState<EngagementTeacher[]>([]);
  const [schoolDays, setSchoolDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'activity' | 'engagement'>('activity');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    Promise.all([
      apiGet<TeacherActivity[]>('/api/v1/principal/teachers/activity', token),
      apiGet<{ teachers: EngagementTeacher[]; school_days_30d: number }>('/api/v1/principal/teachers/engagement', token).catch(() => ({ teachers: [], school_days_30d: 0 })),
    ]).then(([act, eng]) => {
      setTeachers(act);
      setEngagement(eng.teachers);
      setSchoolDays(eng.school_days_30d);
    }).catch(() => setError('Failed to load teacher data'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/principal" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
        <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 mb-6 w-fit">
        {(['activity', 'engagement'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === t ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
            {t === 'activity' ? '📋 Today\'s Activity' : '📊 Engagement (30d)'}
          </button>
        ))}
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}
      {loading ? <p className="text-gray-400">Loading...</p> : (
        <>
          {activeTab === 'activity' && (
            <div className="flex flex-col gap-4">
              {teachers.map((teacher) => (
                <div key={teacher.teacher_id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="font-semibold text-gray-800 mb-3">{teacher.teacher_name}</h2>
                  <div className="flex flex-col gap-2">
                    {teacher.sections.map((sec) => (
                      <div key={sec.section_id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{sec.section_name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 text-xs">{sec.chunks_covered} chunks</span>
                          <Badge label={sec.status.replace('_', ' ')} variant={statusVariant(sec.status)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {teachers.length === 0 && <p className="text-gray-400">No teacher activity data</p>}
            </div>
          )}

          {activeTab === 'engagement' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-neutral-500 mb-1">Based on last {schoolDays} school days</p>
              {engagement.map(t => (
                <div key={t.id} className={`bg-white rounded-2xl border p-4 shadow-sm ${t.amber_warning ? 'border-amber-300 bg-amber-50/30' : 'border-neutral-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-neutral-800">{t.name}</p>
                        <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full capitalize">{t.role_name}</span>
                        {t.amber_warning && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">⚠ {t.days_since_last}d no plan</span>}
                        {t.current_streak >= 5 && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">🔥 {t.current_streak} streak</span>}
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        Last plan: {t.last_completed_date ?? 'Never'} · Best streak: {t.best_streak} days
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xl font-bold ${t.completion_rate_30d >= 80 ? 'text-green-600' : t.completion_rate_30d >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                        {t.completion_rate_30d}%
                      </p>
                      <p className="text-xs text-neutral-400">30-day rate</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 w-full bg-neutral-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${t.completion_rate_30d >= 80 ? 'bg-green-500' : t.completion_rate_30d >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                      style={{ width: `${t.completion_rate_30d}%` }} />
                  </div>
                </div>
              ))}
              {engagement.length === 0 && <p className="text-gray-400">No engagement data yet</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

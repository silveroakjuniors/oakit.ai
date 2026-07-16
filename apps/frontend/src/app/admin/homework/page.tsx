'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface HomeworkItem {
  id: string;
  topic_label: string;
  homework_date: string;
  raw_text: string;
  formatted_text?: string;
  teacher_comments?: string;
  teacher_name: string;
  class_name: string;
  section_label: string;
}

interface ClassOption { id: string; name: string; }

interface SectionStat {
  class_id: string;
  class_name: string;
  section_id: string;
  section_label: string;
  completed: number;
  partial: number;
  not_done: number;
  days_tracked: number;
}

interface StudentStat {
  id: string;
  name: string;
  completed: number;
  partial: number;
  not_done: number;
}

export default function AdminHomeworkPage() {
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(() => {
    // Use IST date to avoid UTC midnight offset issues
    return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
  });
  const [classId, setClassId] = useState('');
  const [stats, setStats] = useState<SectionStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [drillSection, setDrillSection] = useState<SectionStat | null>(null);
  const [drillStudents, setDrillStudents] = useState<StudentStat[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [tab, setTab] = useState<'list' | 'analytics'>('analytics');
  const token = getToken();

  useEffect(() => {
    if (!token) return;
    apiGet<{ id: string; name: string }[]>('/api/v1/admin/classes', token)
      .then(setClasses).catch(console.error);
    loadStats();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ date });
    if (classId) params.set('class_id', classId);
    apiGet<HomeworkItem[]>(`/api/v1/admin/homework?${params}`, token)
      .then(setItems).catch(console.error).finally(() => setLoading(false));
  }, [token, date, classId]);

  function loadStats() {
    if (!token) return;
    setStatsLoading(true);
    apiGet<SectionStat[]>('/api/v1/admin/homework/stats', token)
      .then(setStats).catch(console.error).finally(() => setStatsLoading(false));
  }

  function openDrill(section: SectionStat) {
    setDrillSection(section);
    setDrillLoading(true);
    apiGet<StudentStat[]>(`/api/v1/admin/homework/stats/students?section_id=${section.section_id}`, token!)
      .then(setDrillStudents).catch(console.error).finally(() => setDrillLoading(false));
  }

  const chartData = stats.map(s => ({
    name: `${s.class_name} ${s.section_label}`,
    Completed: s.completed,
    Partial: s.partial,
    'Not Done': s.not_done,
    section_id: s.section_id,
    _raw: s,
  }));

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Homework</h1>
        <p className="text-sm text-gray-500 mt-1">View homework assigned by teachers and track completion</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
        {(['analytics', 'list'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'analytics' ? 'Completion Analytics' : 'Homework List'}
          </button>
        ))}
      </div>

      {tab === 'analytics' && (
        <div className="space-y-4">
          {/* Bar Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-800 mb-1">Homework Completion (Last 15 Days)</p>
            <p className="text-xs text-gray-400 mb-4">Tap a bar to see student-level breakdown</p>
            {statsLoading ? (
              <p className="text-xs text-gray-400 py-8 text-center">Loading...</p>
            ) : chartData.length === 0 ? (
              <p className="text-xs text-gray-400 py-8 text-center">No tracking data yet</p>
            ) : (
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Partial" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Not Done" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Section cards — tap to drill down */}
          {stats.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Tap a class to see student details</p>
              {stats.map(s => {
                const total = s.completed + s.partial + s.not_done;
                const pct = total > 0 ? Math.round((s.completed / total) * 100) : 0;
                return (
                  <button key={s.section_id} onClick={() => openDrill(s)}
                    className="w-full bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 hover:border-emerald-200 hover:shadow-md transition-all text-left active:scale-[0.98]">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{s.class_name} - {s.section_label}</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-[10px] text-emerald-600 font-medium">{s.completed} done</span>
                        <span className="text-[10px] text-amber-600 font-medium">{s.partial} partial</span>
                        <span className="text-[10px] text-red-500 font-medium">{s.not_done} missed</span>
                      </div>
                    </div>
                    <span className={`text-lg font-black ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Drill-down modal */}
          {drillSection && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setDrillSection(null)}>
              <div className="relative w-full sm:w-[480px] max-h-[80vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{drillSection.class_name} - {drillSection.section_label}</p>
                    <p className="text-[10px] text-gray-400">Student homework completion (last 15 days)</p>
                  </div>
                  <button onClick={() => setDrillSection(null)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-lg">&times;</button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-3">
                  {drillLoading ? (
                    <p className="text-xs text-gray-400 text-center py-8">Loading...</p>
                  ) : drillStudents.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8">No data</p>
                  ) : (
                    <div className="space-y-2">
                      {drillStudents.map(s => {
                        const total = s.completed + s.partial + s.not_done;
                        const pct = total > 0 ? Math.round((s.completed / total) * 100) : 0;
                        return (
                          <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-gray-500">{s.name[0]}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate">{s.name}</p>
                              <div className="flex gap-2 mt-0.5">
                                <span className="text-[10px] text-emerald-600">{s.completed} done</span>
                                <span className="text-[10px] text-amber-600">{s.partial} partial</span>
                                <span className="text-[10px] text-red-500">{s.not_done} missed</span>
                              </div>
                            </div>
                            <span className={`text-xs font-black ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'list' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-5">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 bg-white" />
            <select value={classId} onChange={e => setClassId(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 bg-white appearance-none">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="text-gray-400 text-sm">Loading...</div>
          ) : !items.length ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
              No homework found for this date
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(hw => (
                <div key={hw.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{hw.topic_label}</p>
                      <p className="text-xs text-gray-500">{hw.class_name} - Section {hw.section_label} · {hw.teacher_name}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {(() => {
                        const raw = (hw.homework_date || '').toString();
                        // DATE columns come back as ISO timestamp - use UTC date directly
                        const d = new Date(raw);
                        const utcDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
                        return new Date(utcDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                      })()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{hw.formatted_text || hw.raw_text}</p>
                  {hw.teacher_comments && (
                    <p className="text-xs text-gray-500 mt-2 italic">Note: {hw.teacher_comments}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

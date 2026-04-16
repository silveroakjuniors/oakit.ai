'use client';

import { useEffect, useState } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Users } from 'lucide-react';
import { fetchTodaySections, TodaySectionRow } from '@/features/admin/api/dashboard';
import { getToken } from '@/lib/auth';

type ModalType = 'students' | 'attendance' | 'plans' | null;

interface Props {
  type: ModalType;
  todaySnap: { students_present: number; sections_attendance_submitted: number; sections_plans_completed: number; total_sections: number } | null;
  stats: { students: number; classes: number; sections: number } | null;
  onClose: () => void;
}

export default function StatDrillModal({ type, todaySnap, stats, onClose }: Props) {
  const token = getToken() || '';
  const [sections, setSections] = useState<TodaySectionRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!type || type === 'students') return;
    setLoading(true);
    fetchTodaySections(token)
      .then(d => setSections(d.sections))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [type, token]);

  if (!type) return null;

  const titles: Record<NonNullable<ModalType>, string> = {
    students: 'Students by Class',
    attendance: 'Attendance Status — Today',
    plans: 'Plan Completion — Today',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <p className="text-base font-bold text-neutral-900">{titles[type]}</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-neutral-100 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {/* ── STUDENTS modal ── */}
          {type === 'students' && stats && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-blue-700">{stats.students}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Total Students</p>
                </div>
                <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-neutral-700">{stats.classes}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Classes</p>
                </div>
                <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-neutral-700">{stats.sections}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Sections</p>
                </div>
              </div>
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
              ) : (
                <div className="space-y-2">
                  {sections.map(s => (
                    <div key={s.section_id} className="flex items-center gap-3 bg-neutral-50 border border-neutral-100 rounded-2xl px-4 py-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-800">{s.class_name} — Section {s.section_label}</p>
                        <p className="text-xs text-neutral-400">{s.teacher_name || 'No teacher assigned'}</p>
                      </div>
                      <span className="text-lg font-black text-blue-700 shrink-0">{s.total_students}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ATTENDANCE modal ── */}
          {type === 'attendance' && (
            <div className="space-y-2">
              {/* Summary strip */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-emerald-700">{todaySnap?.sections_attendance_submitted ?? 0}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Submitted</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-red-600">{(todaySnap?.total_sections ?? 0) - (todaySnap?.sections_attendance_submitted ?? 0)}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Pending</p>
                </div>
              </div>
              {loading ? (
                <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
              ) : sections.map(s => (
                <div key={s.section_id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${s.attendance_submitted ? 'bg-emerald-50/60 border-emerald-100' : 'bg-red-50/60 border-red-100'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.attendance_submitted ? 'bg-emerald-100' : 'bg-red-100'}`}>
                    {s.attendance_submitted
                      ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                      : <XCircle className="w-4 h-4 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-800">{s.class_name} — Section {s.section_label}</p>
                    <p className="text-xs text-neutral-400">{s.teacher_name || 'No teacher'}</p>
                  </div>
                  {s.attendance_submitted ? (
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-emerald-700">{s.present} present</p>
                      <p className="text-xs text-red-500">{s.absent} absent</p>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-red-500 shrink-0">Not submitted</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── PLANS modal ── */}
          {type === 'plans' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-emerald-700">{todaySnap?.sections_plans_completed ?? 0}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Completed</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center">
                  <p className="text-2xl font-black text-amber-700">{(todaySnap?.total_sections ?? 0) - (todaySnap?.sections_plans_completed ?? 0)}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Pending</p>
                </div>
              </div>
              {loading ? (
                <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 rounded-2xl bg-neutral-100 animate-pulse" />)}</div>
              ) : sections.map(s => (
                <div key={s.section_id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${s.plan_completed ? 'bg-emerald-50/60 border-emerald-100' : 'bg-amber-50/60 border-amber-100'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.plan_completed ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    {s.plan_completed
                      ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                      : <AlertCircle className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-800">{s.class_name} — Section {s.section_label}</p>
                    <p className="text-xs text-neutral-400">{s.teacher_name || 'No teacher'}</p>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${s.plan_completed ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {s.plan_completed ? '✓ Done' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

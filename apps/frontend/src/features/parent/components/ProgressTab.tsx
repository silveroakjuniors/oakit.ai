'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';
import { apiGet } from '@/lib/api';
import type { ProgressData, Child, HomeworkRecord } from '../types';

export default function ProgressTab({ data, activeChild, token }: {
  data: ProgressData | null; activeChild: Child | null; token: string;
}) {
  const [milestoneData, setMilestoneData] = useState<{ completion_pct: number; achieved: number; total: number; class_level: string } | null>(null);
  const [hwHistory, setHwHistory] = useState<HomeworkRecord[]>([]);
  const [hwLoading, setHwLoading] = useState(false);

  useEffect(() => {
    if (!activeChild?.id || !token) return;
    apiGet<any>(`/api/v1/teacher/milestones/${activeChild.id}`, token)
      .then(d => setMilestoneData({ completion_pct: d.completion_pct, achieved: d.achieved, total: d.total, class_level: d.class_level }))
      .catch(() => {});
    setHwLoading(true);
    apiGet<HomeworkRecord[]>(`/api/v1/parent/homework/history?student_id=${activeChild.id}`, token)
      .then(d => setHwHistory(d || []))
      .catch(() => {})
      .finally(() => setHwLoading(false));
  }, [activeChild?.id]);

  if (!data) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <TrendingUp size={48} className="text-neutral-300 mb-3" />
      <p className="text-neutral-500 font-medium">No progress data yet</p>
    </div>
  );

  const pct = data.coverage_pct;
  const strokeColor = pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const r = 50; const circ = 2 * Math.PI * r;
  const missedCount = hwHistory.filter(h => h.status !== 'completed').length;
  const completedCount = hwHistory.filter(h => h.status === 'completed').length;

  return (
    <div className="space-y-4">
      <div className="bg-[#0f2417] rounded-2xl p-6 flex flex-col items-center">
        <div className="relative w-36 h-36 mb-4">
          <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
            <circle cx="60" cy="60" r={r} fill="none" stroke={strokeColor} strokeWidth="12"
              strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-white">{pct}%</span>
            <span className="text-xs text-white/50">covered</span>
          </div>
        </div>
        {data.has_curriculum ? (
          <>
            <p className="font-bold text-white mb-1">{activeChild?.name.split(' ')[0]}&apos;s Curriculum</p>
            <p className="text-xs text-white/50">{data.covered} of {data.total_chunks} topics completed</p>
          </>
        ) : <p className="text-white/50 text-sm">No curriculum assigned yet</p>}
      </div>

      {milestoneData && (
        <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-neutral-800">🏆 Milestones</p>
            <span className="text-emerald-600 font-bold text-sm">{milestoneData.completion_pct}%</span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-2.5 mb-2">
            <div className="h-2.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${milestoneData.completion_pct}%` }} />
          </div>
          <p className="text-xs text-neutral-400">{milestoneData.achieved} of {milestoneData.total} {milestoneData.class_level} milestones achieved</p>
        </div>
      )}

      <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-neutral-800">📚 Homework History</p>
          {hwHistory.length > 0 && (
            <div className="flex gap-2 text-xs">
              <span className="text-emerald-600 font-medium">{completedCount} done</span>
              {missedCount > 0 && <span className="text-red-500 font-medium">{missedCount} missed</span>}
            </div>
          )}
        </div>
        {hwLoading ? (
          <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-neutral-300" /></div>
        ) : hwHistory.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-600 py-2">
            <CheckCircle2 size={16} />
            <p className="text-sm font-medium">No homework records yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hwHistory.map((hw, i) => {
              const rawDate = (hw.homework_date || '').toString().split('T')[0];
              const dateStr = rawDate
                ? new Date(rawDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
                : '—';
              const statusConfig = ({
                completed: { label: '✓ Done', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                partial: { label: '½ Partial', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
                not_submitted: { label: '✗ Not submitted', cls: 'bg-red-50 text-red-600 border-red-100' },
              } as Record<string, { label: string; cls: string }>)[hw.status] || { label: hw.status, cls: 'bg-neutral-50 text-neutral-600 border-neutral-100' };
              return (
                <details key={i} className={`rounded-xl border ${statusConfig.cls} group`}>
                  <summary className="flex items-center justify-between px-3 py-2.5 cursor-pointer list-none select-none">
                    <div className="flex items-center gap-2">
                      <ChevronRight size={14} className="shrink-0 transition-transform group-open:rotate-90" />
                      <span className="text-xs font-medium">{dateStr}</span>
                    </div>
                    <span className="text-xs font-bold">{statusConfig.label}</span>
                  </summary>
                  <div className="px-3 pb-3 pt-1 border-t border-current/10">
                    {hw.homework_text ? (
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{hw.homework_text}</p>
                    ) : (
                      <p className="text-xs text-neutral-400 italic">No homework text recorded</p>
                    )}
                    {hw.teacher_note && <p className="text-xs text-neutral-500 mt-1 italic">Note: {hw.teacher_note}</p>}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

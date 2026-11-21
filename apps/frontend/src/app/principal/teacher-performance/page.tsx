'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import { ChevronLeft, Trophy, TrendingUp, Star, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TeacherScore {
  rank: number;
  name: string;
  class_teacher: string;
  supporting_teachers: string | null;
  initials: string;
  score: number;
  rate: number;
  completions: number;
  streak: number;
  is_me: boolean;
}

interface Reason { factor: string; your_value: string; impact: 'high'|'medium'|'low'; status: 'good'|'warn'|'bad'; }

interface TeacherDetail {
  name: string;
  month: string;
  is_supporting: boolean;
  completion_rate_month: number;
  completions_month: number;
  school_days_month: number;
  total_score: number;
  current_streak: number;
  best_streak: number;
  rank: number;
  total_teachers: number;
  leaderboard: TeacherScore[];
  reasons: Reason[];
  tips: string[];
}

function pctColor(p: number) { return p >= 90 ? '#16a34a' : p >= 70 ? '#d97706' : '#dc2626'; }
function pctBg(p: number) { return p >= 90 ? 'bg-emerald-500' : p >= 70 ? 'bg-amber-500' : 'bg-red-400'; }

export default function PrincipalTeacherPerformancePage() {
  const router = useRouter();
  const token = getToken() || '';
  const [leaderboard, setLeaderboard] = useState<TeacherScore[]>([]);
  const [selected, setSelected] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [month, setMonth] = useState('');

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    setLoading(true);
    // Use the school-wide leaderboard endpoint (principal can see all teachers)
    apiGet<TeacherDetail>('/api/v1/principal/teacher-performance', token)
      .then(d => {
        setLeaderboard(d.leaderboard || []);
        setMonth(d.month || '');
      })
      .catch(e => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token]);

  async function loadDetail(teacherId: string) {
    setDetailLoading(true);
    try {
      const d = await apiGet<TeacherDetail>(`/api/v1/principal/teacher-performance?teacher_id=${teacherId}`, token);
      setSelected(d);
    } catch { /* ignore */ }
    finally { setDetailLoading(false); }
  }

  const monthLabel = month ? new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '';

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-neutral-400 hover:text-neutral-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-neutral-900">Teacher Performance</h1>
          <p className="text-xs text-neutral-500">{monthLabel} — all teachers</p>
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {loading && <div className="text-center py-16 text-neutral-400 text-sm">Loading…</div>}
        {error && <div className="bg-red-50 text-red-600 rounded-xl p-4 text-sm">{error}</div>}

        {!loading && !error && (
          <>
            {/* Leaderboard */}
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
                <Trophy size={16} className="text-amber-500" />
                <p className="text-sm font-bold text-neutral-800">Monthly Leaderboard</p>
                <span className="text-[10px] bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full font-semibold ml-auto">{leaderboard.length} classes</span>
              </div>
              <div className="divide-y divide-neutral-50">
                {leaderboard.map((t, i) => (
                  <button key={i} onClick={() => loadDetail(t.class_teacher)}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors text-left">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5 ${
                      t.rank === 1 ? 'bg-amber-100 text-amber-700' : t.rank === 2 ? 'bg-neutral-200 text-neutral-600' : t.rank === 3 ? 'bg-orange-100 text-orange-600' : 'bg-neutral-100 text-neutral-400'
                    }`}>
                      {t.rank === 1 ? <Star size={11} className="fill-amber-500 text-amber-500" /> : t.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-neutral-800 truncate">{t.name}</p>
                      <p className="text-[10px] text-neutral-500 truncate">
                        {t.class_teacher}{t.supporting_teachers ? ` + ${t.supporting_teachers}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-16 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-1.5 rounded-full ${pctBg(t.score)}`} style={{ width: `${t.score}%` }} />
                      </div>
                      <span className="text-xs font-bold w-12 text-right" style={{ color: pctColor(t.score) }}>{t.score}/100</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail panel */}
            {detailLoading && <div className="text-center py-8 text-neutral-400 text-sm">Loading details…</div>}
            {selected && !detailLoading && (
              <div className="space-y-4">
                <div className={`bg-gradient-to-br from-[#1B4332] to-emerald-700 rounded-2xl p-5 text-white`}>
                  <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">{selected.name}</p>
                  <p className="text-4xl font-black">{selected.total_score}<span className="text-xl font-normal text-white/60">/100</span></p>
                  <p className="text-white/80 text-xs mt-1">Rank #{selected.rank} of {selected.total_teachers} · {selected.school_days_month} school days</p>
                </div>

                <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-neutral-100">
                    <p className="text-sm font-bold text-neutral-800">Score Breakdown</p>
                  </div>
                  <div className="divide-y divide-neutral-50">
                    {selected.reasons.map((r, i) => (
                      <div key={i} className="px-4 py-3 flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${r.status === 'good' ? 'bg-emerald-500' : r.status === 'warn' ? 'bg-amber-500' : 'bg-red-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-neutral-800">{r.factor}</p>
                          <p className={`text-[10px] font-semibold mt-0.5 ${r.status === 'good' ? 'text-emerald-600' : r.status === 'warn' ? 'text-amber-600' : 'text-red-500'}`}>{r.your_value}</p>
                        </div>
                        <div className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 ${r.status === 'good' ? 'bg-emerald-100 text-emerald-700' : r.status === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                          {r.status === 'good' ? 'Good' : r.status === 'warn' ? 'Improve' : 'Low'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selected.tips.length > 0 && (
                  <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-neutral-100">
                      <p className="text-sm font-bold text-neutral-800">Improvement Tips</p>
                    </div>
                    <div className="px-4 py-4 space-y-3">
                      {selected.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                          <p className="text-xs text-neutral-700 leading-relaxed">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ChevronLeft, TrendingUp, Flame, Medal, Users, Target, AlertCircle } from 'lucide-react';

interface DailyRow { date: string; sections_completed: number; }
interface TeacherRank { id: string; name: string; rate: number; }
interface PerformanceData {
  name: string;
  completion_rate_30d: number;
  completions_30d: number;
  school_days_30d: number;
  attendance_rate_30d: number;
  homework_rate_30d: number;
  observations_30d: number;
  current_streak: number;
  best_streak: number;
  last_completed_date: string | null;
  rank: number;
  total_teachers: number;
  school_avg_rate: number;
  top_25pct_rate: number;
  reasons: { factor: string; your_value: string; school_avg: string; impact: 'high' | 'medium' | 'low'; status: 'good' | 'warn' | 'bad' }[];
  tips: string[];
  daily: DailyRow[];
  all_teachers: TeacherRank[];
}

function pctColor(p: number) {
  return p >= 80 ? 'text-emerald-600' : p >= 50 ? 'text-amber-600' : 'text-red-500';
}
function pctBg(p: number) {
  return p >= 80 ? 'bg-emerald-500' : p >= 50 ? 'bg-amber-500' : 'bg-red-400';
}
function rankLabel(rank: number, total: number) {
  const pct = Math.round((rank / total) * 100);
  if (pct <= 10) return { label: 'Top 10%', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
  if (pct <= 25) return { label: 'Top 25%', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
  if (pct <= 50) return { label: 'Top 50%', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
  return { label: 'Below avg', color: 'text-red-500', bg: 'bg-red-50 border-red-200' };
}

export default function MyPerformancePage() {
  const router = useRouter();
  const token = getToken() || '';
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRankList, setShowRankList] = useState(false);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    apiGet<PerformanceData>('/api/v1/teacher/context/performance', token)
      .then(setData)
      .catch(e => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-neutral-50 p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          <p className="text-sm text-red-700">{error || 'No data available'}</p>
        </div>
      </div>
    );
  }

  const myRate = data.completion_rate_30d;
  const rank = rankLabel(data.rank, data.total_teachers);
  const missed = Math.max(0, data.school_days_30d - data.completions_30d);
  const aboveAvg = myRate - data.school_avg_rate;

  const dailyChart = data.daily.map(d => ({
    name: new Date(d.date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    completed: d.sections_completed > 0 ? 1 : 0,
    date: d.date,
  }));

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-neutral-400 hover:text-neutral-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-neutral-900">My Performance</h1>
          <p className="text-xs text-neutral-500">Last 30 school days</p>
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto space-y-4">

        {/* Hero card — big completion rate + rank */}
        <div className="bg-gradient-to-br from-[#1B4332] to-emerald-700 rounded-2xl p-5 text-white">
          <p className="text-xs font-semibold opacity-70 uppercase tracking-wide mb-1">{data.name}</p>
          <div className="flex items-end gap-4 mb-4">
            <div>
              <p className="text-5xl font-black leading-none">{myRate}%</p>
              <p className="text-xs opacity-70 mt-1">plan completion rate</p>
            </div>
            <div className={`ml-auto px-3 py-1.5 rounded-xl border text-xs font-bold ${rank.bg} ${rank.color}`}>
              #{data.rank} of {data.total_teachers} teachers
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
            <div className="h-2.5 rounded-full bg-white transition-all duration-700"
              style={{ width: `${myRate}%` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <p className="text-[10px] opacity-60">{data.completions_30d} days completed</p>
            <p className="text-[10px] opacity-60">{missed} missed &middot; {data.school_days_30d} total</p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Flame size={15} className="text-amber-500" />
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Current Streak</p>
            </div>
            <p className="text-2xl font-black text-amber-600">{data.current_streak}d</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">Best ever: {data.best_streak}d</p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users size={15} className="text-blue-500" />
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">vs School Avg</p>
            </div>
            <p className={`text-2xl font-black ${aboveAvg >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {aboveAvg >= 0 ? '+' : ''}{aboveAvg}%
            </p>
            <p className="text-[10px] text-neutral-400 mt-0.5">School avg: {data.school_avg_rate}%</p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Medal size={15} className="text-indigo-500" />
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Rank</p>
            </div>
            <p className={`text-2xl font-black ${rank.color}`}>#{data.rank}</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">{rank.label} in school</p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target size={15} className="text-purple-500" />
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Top 25% Target</p>
            </div>
            <p className="text-2xl font-black text-purple-600">{data.top_25pct_rate}%</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              {myRate >= data.top_25pct_rate ? 'You are in top 25%!' : `${data.top_25pct_rate - myRate}% to reach top 25%`}
            </p>
          </div>
        </div>

        {/* Daily completion chart */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Daily Plan Completion — Last 30 Days</p>
          {dailyChart.length > 0 ? (
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChart} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1B4332" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#1B4332" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={Math.floor(dailyChart.length / 6)} />
                  <YAxis tick={{ fontSize: 8 }} domain={[0, 1]} ticks={[0, 1]}
                    tickFormatter={v => v === 1 ? 'Done' : 'Missed'} width={40} />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }}
                    formatter={(v: any) => [v === 1 ? 'Completed' : 'Not completed', 'Plan']} />
                  <ReferenceLine y={0.5} stroke="#e5e7eb" strokeDasharray="3 3" />
                  <Area type="step" dataKey="completed" stroke="#1B4332" strokeWidth={2}
                    fill="url(#perfGrad)" dot={{ r: 3, fill: '#1B4332' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center">
              <p className="text-sm text-neutral-400">No completion data yet</p>
            </div>
          )}
        </div>

        {/* Why this rank — factor breakdown */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100">
            <p className="text-sm font-bold text-neutral-800">Why you are ranked #{data.rank}</p>
            <p className="text-xs text-neutral-400 mt-0.5">These factors determine your ranking in the school</p>
          </div>
          <div className="divide-y divide-neutral-50">
            {data.reasons.map((r, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${r.status === 'good' ? 'bg-emerald-500' : r.status === 'warn' ? 'bg-amber-500' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-semibold text-neutral-800">{r.factor}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${r.impact === 'high' ? 'bg-red-50 text-red-600' : r.impact === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-neutral-100 text-neutral-500'}`}>
                      {r.impact} impact
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={`text-[10px] font-semibold ${r.status === 'good' ? 'text-emerald-600' : r.status === 'warn' ? 'text-amber-600' : 'text-red-500'}`}>
                      You: {r.your_value}
                    </p>
                    {r.school_avg !== '—' && (
                      <p className="text-[10px] text-neutral-400">Avg: {r.school_avg}</p>
                    )}
                  </div>
                </div>
                <div className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 ${r.status === 'good' ? 'bg-emerald-100 text-emerald-700' : r.status === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                  {r.status === 'good' ? 'Good' : r.status === 'warn' ? 'Improve' : 'Low'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How to improve */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100">
            <p className="text-sm font-bold text-neutral-800">How to improve your rank</p>
          </div>
          <div className="px-4 py-3 space-y-3">
            {data.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                <p className="text-xs text-neutral-700 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* School ranking list */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowRankList(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors"
          >
            <p className="text-sm font-bold text-neutral-800">School Ranking</p>
            <span className="text-xs text-neutral-400">{showRankList ? 'Hide' : 'Show all'}</span>
          </button>
          {showRankList && (
            <div className="border-t border-neutral-100 max-h-72 overflow-y-auto">
              {data.all_teachers.map((t, i) => {
                const isMe = t.id === undefined /* we don't have ID on all_teachers */
                  ? t.name === data.name
                  : false;
                // Use name match as proxy
                const isMyEntry = t.name === data.name && t.rate === myRate;
                return (
                  <div key={i} className={`flex items-center gap-3 px-4 py-2.5 border-b border-neutral-50 last:border-0 ${isMyEntry ? 'bg-emerald-50' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-neutral-200 text-neutral-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-neutral-100 text-neutral-400'
                    }`}>{i + 1}</div>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: t.rate >= 80 ? '#10b981' : t.rate >= 50 ? '#f59e0b' : '#f87171' }}>
                      {t.name[0]}
                    </div>
                    <p className={`text-xs flex-1 font-${isMyEntry ? 'bold' : 'medium'} text-neutral-800 truncate`}>
                      {t.name}{isMyEntry ? ' (You)' : ''}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-16 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-1.5 rounded-full ${pctBg(t.rate)}`} style={{ width: `${t.rate}%` }} />
                      </div>
                      <p className={`text-xs font-bold w-8 text-right ${pctColor(t.rate)}`}>{t.rate}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Motivation message */}
        <div className={`rounded-2xl border px-4 py-3 ${myRate >= 80 ? 'bg-emerald-50 border-emerald-200' : myRate >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-sm font-semibold ${myRate >= 80 ? 'text-emerald-800' : myRate >= 50 ? 'text-amber-800' : 'text-red-700'}`}>
            {myRate >= 80
              ? `Excellent work! You are completing ${myRate}% of your plans. Keep the streak going!`
              : myRate >= 50
              ? `Good effort at ${myRate}%. Complete ${data.school_days_30d - data.completions_30d} more days this month to reach ${data.school_avg_rate}%+ avg.`
              : `Your completion rate needs improvement. You have completed ${data.completions_30d} of ${data.school_days_30d} school days. Try to mark your daily plan done every day.`
            }
          </p>
        </div>

      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { ChevronLeft, Flame, Target, AlertCircle, CheckCircle2, Calendar, Star, Trophy } from 'lucide-react';

interface DailyRow { date: string; sections_completed: number; }
interface LeaderboardEntry { rank: number; name: string; initials: string; score: number; rate: number; completions: number; streak: number; is_me: boolean; }
interface PerformanceData {
  name: string;
  month: string;
  completion_rate_month: number;
  completions_month: number;
  school_days_month: number;
  attendance_rate_month: number;
  homework_rate_month: number;
  observations_month: number;
  feed_posts_month: number;
  total_score: number;
  current_streak: number;
  best_streak: number;
  rank: number;
  total_teachers: number;
  days_to_top: number;
  leaderboard: LeaderboardEntry[];
  reasons: { factor: string; your_value: string; impact: 'high' | 'medium' | 'low'; status: 'good' | 'warn' | 'bad' }[];
  tips: string[];
  daily: DailyRow[];
}

function pctColor(p: number) { return p >= 90 ? 'text-emerald-600' : p >= 70 ? 'text-amber-600' : 'text-red-500'; }
function pctBg(p: number) { return p >= 90 ? 'bg-emerald-500' : p >= 70 ? 'bg-amber-500' : 'bg-red-400'; }
function heroGradient(rate: number) {
  if (rate >= 90) return 'from-emerald-700 to-emerald-600';
  if (rate >= 70) return 'from-[#1B4332] to-emerald-700';
  if (rate >= 50) return 'from-amber-600 to-amber-500';
  return 'from-red-700 to-red-600';
}
function rankBadge(rank: number, total: number) {
  if (rank === 1) return { label: 'Star of the Month', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-300' };
  const pct = Math.round((rank / total) * 100);
  if (pct <= 25) return { label: 'Top 25%', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (pct <= 50) return { label: 'Top 50%', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' };
  return { label: `#${rank} this month`, color: 'text-neutral-600', bg: 'bg-neutral-50 border-neutral-200' };
}

export default function MyPerformancePage() {
  const router = useRouter();
  const token = getToken() || '';
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLeaderboard, setShowLeaderboard] = useState(false);

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

  const rate = data.completion_rate_month;
  const missed = Math.max(0, data.school_days_month - data.completions_month);
  const score = data.total_score ?? 0;
  const badge = rankBadge(data.rank, data.total_teachers);
  const monthLabel = data.month
    ? new Date(data.month + '-15T12:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : '';

  const dailyChart = data.daily.map(d => ({
    name: new Date(d.date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    completed: d.sections_completed > 0 ? 1 : 0,
  }));

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-neutral-400 hover:text-neutral-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-neutral-900">My Performance</h1>
          <p className="text-xs text-neutral-500">{monthLabel}</p>
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto space-y-4">

        {/* Hero */}
        <div className={`bg-gradient-to-br ${heroGradient(rate)} rounded-2xl p-5 text-white`}>
          <p className="text-xs font-semibold opacity-70 uppercase tracking-wide mb-1">{data.name}</p>
          <div className="flex items-end gap-3 mb-4">
            <div>
              <p className="text-5xl font-black leading-none">{score}<span className="text-xl opacity-60">/100</span></p>
              <p className="text-xs opacity-70 mt-1">composite score · {rate}% plans completed</p>
            </div>
            <div className={`ml-auto px-3 py-1.5 rounded-xl border text-xs font-bold ${badge.bg} ${badge.color}`}>
              {data.rank === 1 && <Star size={10} className="inline mr-1 fill-amber-500 text-amber-500" />}
              {badge.label}
            </div>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
            <div className="h-2.5 rounded-full bg-white transition-all" style={{ width: `${score}%` }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <p className="text-[10px] opacity-60">{data.completions_month} plans done &middot; {missed} missed</p>
            <p className="text-[10px] opacity-60">{data.school_days_month} school days</p>
          </div>
          {data.days_to_top > 0 && (
            <p className="text-[11px] mt-2 bg-white/15 rounded-lg px-3 py-1.5 font-semibold">
              {data.days_to_top} point{data.days_to_top !== 1 ? 's' : ''} behind #1 — check tips below to improve
            </p>
          )}
          {data.rank === 1 && (
            <p className="text-[11px] mt-2 bg-white/15 rounded-lg px-3 py-1.5 font-semibold">
              You are #1 this month — keep completing all activities to stay on top!
            </p>
          )}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Flame size={15} className="text-amber-500" />
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Streak</p>
            </div>
            <p className="text-2xl font-black text-amber-600">{data.current_streak}d</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">Personal best: {data.best_streak}d</p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={15} className="text-blue-500" />
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">This Month</p>
            </div>
            <p className="text-2xl font-black text-blue-600">{data.completions_month}</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">of {data.school_days_month} school days</p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={15} className="text-emerald-500" />
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Attendance</p>
            </div>
            <p className={`text-2xl font-black ${pctColor(data.attendance_rate_month)}`}>{data.attendance_rate_month}%</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">submission rate</p>
          </div>
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target size={15} className="text-purple-500" />
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Target</p>
            </div>
            <p className="text-2xl font-black text-purple-600">90%</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              {rate >= 90 ? 'Target reached!' : `${90 - rate}% to reach target`}
            </p>
          </div>
        </div>

        {/* Monthly leaderboard */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <button onClick={() => setShowLeaderboard(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-amber-500" />
              <div>
                <p className="text-sm font-bold text-neutral-800">Monthly Leaderboard</p>
                <p className="text-[10px] text-neutral-400">Score = plans(40) + attendance(20) + homework(15) + observations(15) + feed(10)</p>
              </div>
              <span className="text-[10px] bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full font-semibold">{data.total_teachers} teachers</span>
            </div>
            <span className="text-xs text-neutral-400 shrink-0 ml-2">{showLeaderboard ? 'Hide' : 'Show'}</span>
          </button>
          {showLeaderboard && (
            <div className="border-t border-neutral-100 max-h-80 overflow-y-auto">
              {data.leaderboard.map((t) => (
                <div key={t.name} className={`flex items-center gap-3 px-4 py-2.5 border-b border-neutral-50 last:border-0 ${t.is_me ? 'bg-primary-50' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    t.rank === 1 ? 'bg-amber-100 text-amber-700' : t.rank === 2 ? 'bg-neutral-200 text-neutral-600' : t.rank === 3 ? 'bg-orange-100 text-orange-600' : 'bg-neutral-100 text-neutral-400'
                  }`}>
                    {t.rank === 1 ? <Star size={10} className="fill-amber-500 text-amber-500" /> : t.rank}
                  </div>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: t.rate >= 90 ? '#10b981' : t.rate >= 70 ? '#f59e0b' : '#f87171' }}>
                    {t.initials}
                  </div>
                  <p className={`text-xs flex-1 truncate ${t.is_me ? 'font-bold text-primary-800' : 'font-medium text-neutral-800'}`}>
                    {t.name}{t.is_me ? ' (You)' : ''}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-14 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-1.5 rounded-full ${pctBg(t.score ?? t.rate)}`} style={{ width: `${t.score ?? t.rate}%` }} />
                    </div>
                    <p className={`text-xs font-bold w-10 text-right ${pctColor(t.score ?? t.rate)}`}>{t.score ?? t.rate}/100</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Daily chart */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Daily Completion — {monthLabel}</p>
          {dailyChart.length > 0 ? (
            <div style={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChart} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1B4332" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#1B4332" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={Math.max(0, Math.floor(dailyChart.length / 6) - 1)} />
                  <YAxis tick={{ fontSize: 8 }} domain={[0, 1]} ticks={[0, 1]} tickFormatter={v => v === 1 ? 'Done' : ''} width={30} />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }}
                    formatter={(v: any) => [v === 1 ? 'Completed' : 'Not completed', 'Plan']} />
                  <Area type="step" dataKey="completed" stroke="#1B4332" strokeWidth={2}
                    fill="url(#perfGrad)" dot={{ r: 3, fill: '#1B4332' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-28 flex items-center justify-center">
              <p className="text-sm text-neutral-400">No completions yet this month</p>
            </div>
          )}
        </div>

        {/* Factor breakdown */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100">
            <p className="text-sm font-bold text-neutral-800">Performance Breakdown</p>
          </div>
          <div className="divide-y divide-neutral-50">
            {data.reasons.map((r, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${r.status === 'good' ? 'bg-emerald-500' : r.status === 'warn' ? 'bg-amber-500' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-semibold text-neutral-800">{r.factor}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${r.impact === 'high' ? 'bg-red-50 text-red-600' : r.impact === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-neutral-100 text-neutral-500'}`}>
                      {r.impact}
                    </span>
                  </div>
                  <p className={`text-[10px] font-semibold ${r.status === 'good' ? 'text-emerald-600' : r.status === 'warn' ? 'text-amber-600' : 'text-red-500'}`}>{r.your_value}</p>
                </div>
                <div className={`text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 ${r.status === 'good' ? 'bg-emerald-100 text-emerald-700' : r.status === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                  {r.status === 'good' ? 'Good' : r.status === 'warn' ? 'Improve' : 'Low'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100">
            <p className="text-sm font-bold text-neutral-800">How to improve your rank</p>
          </div>
          <div className="px-4 py-4 space-y-3">
            {data.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                <p className="text-xs text-neutral-700 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

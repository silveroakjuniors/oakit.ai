'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, clearToken } from '@/lib/auth';
import { API_BASE } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardData {
  franchise_id: string;
  franchise_name: string;
  total_schools: number;
  active_schools: number;
  total_students: number;
  total_teachers: number;
  blocked_schools: number;
  low_balance_schools: number;
  total_balance_inr: string;
  total_used_inr: string;
  total_recharged_inr: string;
  this_month_calls: number;
  this_month_inr: string;
  franchise_balance_inr: string;
  franchise_lifetime_recharged_inr: string;
  daily_usage: { day: string; calls: number; inr: string; active_schools: number }[];
  top_endpoints: { endpoint: string; calls: number; inr: string }[];
}

interface SchoolRow {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  balance_inr: string;
  lifetime_used_inr: string;
  this_month_inr: string;
  this_month_calls: number;
  blocked: boolean;
  credit_status: 'healthy' | 'low' | 'blocked';
  total_students: number;
  total_teachers: number;
}

interface SchoolDetail {
  school: { id: string; name: string };
  balance_inr: string;
  lifetime_used_inr: string;
  lifetime_recharged_inr: string;
  blocked: boolean;
  low_balance_threshold_inr: string;
  transactions: { type: string; amount_inr: string; balance_after_inr: string; description: string; date: string }[];
  daily_usage: { day: string; calls: number; inr: string }[];
  by_endpoint: { endpoint: string; calls: number; inr: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const ENDPOINT_LABELS: Record<string, string> = {
  'query': 'Oakie Chat',
  'topic-summary': 'Topic Summary',
  'day-highlights': 'Day Highlights',
  'suggest-activity': 'Activity Suggest',
  'generate-quiz': 'Quiz Generate',
  'evaluate-quiz': 'Quiz Evaluate',
  'format-homework': 'Homework Format',
  'beautify-child-journey': 'Child Journey',
  'snapshot': 'Child Snapshot',
  'generate-worksheet': 'Worksheet',
  'generate-report': 'Progress Report',
  'generate-plans': 'Plan Generate',
  'birthday-wish': 'Birthday Wish',
};

function fmt(inr: string) {
  return `₹${parseFloat(inr).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function CreditBadge({ status }: { status: 'healthy' | 'low' | 'blocked' }) {
  const map = {
    healthy: { bg: '#D1FAE5', color: '#065F46', label: '● Healthy' },
    low:     { bg: '#FEF3C7', color: '#92400E', label: '⚠ Low' },
    blocked: { bg: '#FEE2E2', color: '#991B1B', label: '✕ Blocked' },
  };
  const s = map[status];
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}>{s.label}</span>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#fff', border: '1px solid #F3F4F6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <p className="text-xs font-semibold text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Mini bar chart ────────────────────────────────────────────────────────────
function MiniBarChart({ data }: { data: { day: string; inr: string }[] }) {
  if (!data.length) return <p className="text-xs text-gray-400 py-4 text-center">No data yet</p>;
  const max = Math.max(...data.map(d => parseFloat(d.inr)), 0.01);
  return (
    <div className="flex items-end gap-0.5 h-16">
      {data.map((d, i) => {
        const h = Math.max((parseFloat(d.inr) / max) * 100, 4);
        const isToday = i === data.length - 1;
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div className="w-full rounded-t-sm transition-all"
              style={{ height: `${h}%`, background: isToday ? '#7C6FE8' : '#E8E5FF', minHeight: 3 }} />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10">
              <div className="bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap">
                {new Date(d.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ₹{d.inr}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── School detail drawer ──────────────────────────────────────────────────────
function SchoolDrawer({ schoolId, token, onClose }: { schoolId: string; token: string; onClose: () => void }) {
  const [data, setData] = useState<SchoolDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/franchise/schools/${schoolId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [schoolId, token]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#3B2F8F,#7C6FE8)', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
          <div>
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">School Detail</p>
            <p className="text-white font-black text-lg">{data?.school.name || '...'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:bg-white/20 text-xl font-bold">×</button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#7C6FE8', borderTopColor: 'transparent' }} />
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Failed to load</div>
        ) : (
          <div className="flex-1 p-5 space-y-5">
            {/* Balance cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ background: data.blocked ? '#FEE2E2' : '#F0FDF4', border: `1px solid ${data.blocked ? '#FECACA' : '#BBF7D0'}` }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: data.blocked ? '#991B1B' : '#065F46' }}>
                  {data.blocked ? '✕ Blocked' : '● Balance'}
                </p>
                <p className="text-xl font-black" style={{ color: data.blocked ? '#DC2626' : '#059669' }}>{fmt(data.balance_inr)}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: '#F8F7FF', border: '1px solid #E8E5FF' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-purple-400">This Month</p>
                <p className="text-xl font-black text-purple-700">{fmt(data.by_endpoint.reduce((s, e) => s + parseFloat(e.inr), 0).toFixed(2))}</p>
              </div>
            </div>

            {/* Usage chart */}
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">📊 Last 30 Days Usage</p>
              <MiniBarChart data={data.daily_usage} />
            </div>

            {/* By endpoint */}
            {data.by_endpoint.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">🔧 Usage by Feature (This Month)</p>
                <div className="space-y-1.5">
                  {data.by_endpoint.map((e, i) => {
                    const total = data.by_endpoint.reduce((s, x) => s + parseFloat(x.inr), 0);
                    const pct = total > 0 ? (parseFloat(e.inr) / total) * 100 : 0;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-gray-600 font-medium">{ENDPOINT_LABELS[e.endpoint] || e.endpoint}</span>
                          <span className="font-bold text-purple-700">{fmt(e.inr)} <span className="text-gray-400 font-normal">({e.calls})</span></span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100">
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: '#7C6FE8' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent transactions */}
            {data.transactions.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">💳 Recent Transactions</p>
                <div className="space-y-1.5">
                  {data.transactions.map((t, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2"
                      style={{ background: t.type === 'recharge' ? '#F0FDF4' : '#FAFAFA', border: '1px solid #F3F4F6' }}>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{t.description || t.type}</p>
                        <p className="text-[10px] text-gray-400">{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <p className="text-sm font-bold" style={{ color: t.type === 'recharge' ? '#059669' : '#DC2626' }}>
                        {t.type === 'recharge' ? '+' : '-'}{fmt(t.amount_inr)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FranchiseAdminPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    Promise.all([
      fetch(`${API_BASE}/api/v1/franchise/dashboard`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_BASE}/api/v1/franchise/schools`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([dash, schs]) => {
      if (dash.error) { setError(dash.error); return; }
      setDashboard(dash);
      setSchools(Array.isArray(schs) ? schs : []);
    }).catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = schools.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.subdomain.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#EEF0FF,#F5F0FF)' }}>
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3" style={{ borderColor: '#7C6FE8', borderTopColor: 'transparent' }} />
        <p className="text-sm text-purple-400 font-medium">Loading franchise dashboard…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="text-gray-700 font-semibold mb-2">Could not load dashboard</p>
        <p className="text-sm text-gray-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
        <button onClick={() => { clearToken(); router.push('/login'); }}
          className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: '#7C6FE8' }}>
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#EEF0FF 0%,#F5F0FF 40%,#EAF4FF 100%)' }}>
      {selectedSchool && (
        <SchoolDrawer schoolId={selectedSchool} token={token} onClose={() => setSelectedSchool(null)} />
      )}

      {/* Top bar */}
      <div className="sticky top-0 z-30 px-6 py-4 flex items-center justify-between"
        style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(124,111,232,0.12)', boxShadow: '0 1px 12px rgba(91,79,207,0.08)' }}>
        <div>
          <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest">Franchise Admin</p>
          <h1 className="text-xl font-black text-gray-900">{dashboard?.franchise_name || 'Dashboard'}</h1>
        </div>
        <button onClick={() => { clearToken(); router.push('/login'); }}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
          Sign out
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* ── Summary stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Schools" value={String(dashboard?.total_schools ?? 0)} sub={`${dashboard?.active_schools ?? 0} active`} color="#3B2F8F" />
          <StatCard label="Total Students" value={String(dashboard?.total_students ?? 0)} color="#2EC4B6" />
          <StatCard label="This Month AI Cost" value={fmt(dashboard?.this_month_inr ?? '0')} sub={`${dashboard?.this_month_calls ?? 0} calls`} color="#7C6FE8" />
          <StatCard label="Total Balance" value={fmt(dashboard?.total_balance_inr ?? '0')} sub={`${dashboard?.blocked_schools ?? 0} blocked`} color={Number(dashboard?.blocked_schools) > 0 ? '#DC2626' : '#059669'} />
        </div>

        {/* ── Alert banners ── */}
        {Number(dashboard?.blocked_schools) > 0 && (
          <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
            style={{ background: '#FEE2E2', border: '1px solid #FECACA' }}>
            <span className="text-2xl">🚨</span>
            <div>
              <p className="text-sm font-bold text-red-800">{dashboard!.blocked_schools} school{dashboard!.blocked_schools > 1 ? 's' : ''} blocked — AI credits exhausted</p>
              <p className="text-xs text-red-600 mt-0.5">Contact your Oakit super-admin to recharge these schools immediately.</p>
            </div>
          </div>
        )}
        {Number(dashboard?.low_balance_schools) > 0 && (
          <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
            style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-sm font-bold text-amber-800">{dashboard!.low_balance_schools} school{dashboard!.low_balance_schools > 1 ? 's' : ''} running low on AI credits</p>
              <p className="text-xs text-amber-600 mt-0.5">Request a recharge from your Oakit super-admin before AI gets blocked.</p>
            </div>
          </div>
        )}

        {/* ── Usage chart + top endpoints ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 rounded-2xl p-5 bg-white" style={{ border: '1px solid #F3F4F6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <p className="text-sm font-bold text-gray-700 mb-3">📊 Franchise-wide AI Usage — Last 30 Days</p>
            <MiniBarChart data={dashboard?.daily_usage ?? []} />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>{dashboard?.daily_usage[0] ? new Date(dashboard.daily_usage[0].day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</span>
              <span>Today</span>
            </div>
          </div>

          <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid #F3F4F6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <p className="text-sm font-bold text-gray-700 mb-3">🔧 Top Features This Month</p>
            {(dashboard?.top_endpoints ?? []).length === 0 ? (
              <p className="text-xs text-gray-400">No usage yet</p>
            ) : (
              <div className="space-y-2">
                {(dashboard?.top_endpoints ?? []).map((e, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 font-medium">{ENDPOINT_LABELS[e.endpoint] || e.endpoint}</span>
                    <div className="text-right">
                      <p className="text-xs font-bold text-purple-700">{fmt(e.inr)}</p>
                      <p className="text-[10px] text-gray-400">{e.calls} calls</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Schools table ── */}
        <div className="rounded-2xl bg-white overflow-hidden" style={{ border: '1px solid #F3F4F6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <p className="text-sm font-bold text-gray-800">🏫 Schools ({schools.length})</p>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search schools…"
              className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 outline-none focus:border-purple-400 w-48"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F3F4F6' }}>
                  {['School', 'Status', 'Balance', 'This Month', 'Lifetime Used', 'Students', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F9FAFB', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800">{s.name}</p>
                      <p className="text-[11px] text-gray-400">{s.subdomain}</p>
                    </td>
                    <td className="px-4 py-3"><CreditBadge status={s.credit_status} /></td>
                    <td className="px-4 py-3">
                      <p className="font-bold" style={{ color: s.blocked ? '#DC2626' : '#059669' }}>{fmt(s.balance_inr)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-purple-700">{fmt(s.this_month_inr)}</p>
                      <p className="text-[11px] text-gray-400">{s.this_month_calls} calls</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-medium">{fmt(s.lifetime_used_inr)}</td>
                    <td className="px-4 py-3 text-gray-500">{s.total_students}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedSchool(s.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
                        style={{ background: '#F3F1FF', color: '#7C6FE8', border: '1px solid #E8E5FF' }}>
                        Details →
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">No schools found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer totals */}
          <div className="px-5 py-3 flex items-center gap-6 text-xs font-semibold text-gray-500"
            style={{ borderTop: '1px solid #F3F4F6', background: '#FAFAFA' }}>
            <span>Total balance: <strong className="text-green-700">{fmt(dashboard?.total_balance_inr ?? '0')}</strong></span>
            <span>This month: <strong className="text-purple-700">{fmt(dashboard?.this_month_inr ?? '0')}</strong></span>
            <span>Lifetime used: <strong className="text-gray-700">{fmt(dashboard?.total_used_inr ?? '0')}</strong></span>
            <span className="ml-auto">Total recharged: <strong className="text-blue-700">{fmt(dashboard?.total_recharged_inr ?? '0')}</strong></span>
          </div>
        </div>

      </div>
    </div>
  );
}

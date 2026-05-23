'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────
interface MonthlyRow      { month: string; total: number; count: number; }
interface ClassRow        { class_name: string; total_collected: number; total_pending: number; }
interface ProfitLoss      { total_income: number; total_expenses: number; net_profit: number; }
interface ReconPending    { count: number; total_amount: number; }
interface InstalmentRow   {
  instalment_number: number; label: string; due_date: string | null;
  fee_head_name: string; student_count: number;
  total_instalment_amount: number; total_paid: number; total_pending: number;
}
interface FeeSummary {
  total_collected: number; total_assigned: number; total_outstanding: number;
  instalments: InstalmentRow[];
}

// ── Inline SVG bar chart ──────────────────────────────────────────────────────
function BarChart({ data, color = '#1B4332' }: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  if (!data.length) return <p className="text-xs text-gray-400 text-center py-4">No data</p>;
  const max = Math.max(...data.map(d => d.value), 1);
  const H = 100;
  const totalBars = Math.max(data.length, 6); // always render at least 6 slots so bars aren't huge
  const slotW = 100 / totalBars;
  const barW = slotW * 0.55;
  const barOffset = (slotW - barW) / 2;

  return (
    <div className="w-full" style={{ height: 130 }}>
      <svg viewBox={`0 0 100 ${H + 22}`} className="w-full h-full" preserveAspectRatio="xMidYMax meet">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(pct => (
          <line key={pct}
            x1={0} y1={H - pct * H} x2={100} y2={H - pct * H}
            stroke="#f3f4f6" strokeWidth="0.5" />
        ))}
        {data.map((d, i) => {
          const barH = Math.max(2, (d.value / max) * H);
          const x = i * slotW + barOffset;
          const y = H - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx="1.5" fill={color} opacity="0.85" />
              <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize="5.5" fill="#9ca3af">
                {d.label}
              </text>
              {d.value > 0 && (
                <text x={x + barW / 2} y={y - 2} textAnchor="middle" fontSize="4.5" fill={color} opacity="0.7">
                  {d.value >= 100000
                    ? `${(d.value / 100000).toFixed(1)}L`
                    : d.value >= 1000
                    ? `${(d.value / 1000).toFixed(0)}K`
                    : d.value}
                </text>
              )}
            </g>
          );
        })}
        {/* Baseline */}
        <line x1={0} y1={H} x2={100} y2={H} stroke="#e5e7eb" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────
function DonutChart({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return <p className="text-xs text-gray-400 text-center py-4">No data</p>;
  const R = 40, cx = 50, cy = 50, stroke = 18;
  let offset = 0;
  const circ = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 100 100" className="w-full max-w-[140px] mx-auto">
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circ;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={R}
            fill="none" stroke={seg.color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset * circ}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        offset += pct;
        return el;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1f2937">
        {Math.round((segments[0]?.value / total) * 100)}%
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="6" fill="#6b7280">collected</text>
    </svg>
  );
}

// ── Horizontal bar ────────────────────────────────────────────────────────────
function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ── Quick action tile ─────────────────────────────────────────────────────────
function ActionTile({ href, icon, label, desc, badge, badgeColor = 'bg-red-500' }: {
  href: string; icon: string; label: string; desc: string;
  badge?: number; badgeColor?: string;
}) {
  return (
    <Link href={href}
      className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col gap-2 group">
      {badge !== undefined && badge > 0 && (
        <span className={`absolute -top-1.5 -right-1.5 ${badgeColor} text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center`}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-gray-800 group-hover:text-primary transition-colors">{label}</p>
        <p className="text-xs text-gray-400 leading-snug mt-0.5">{desc}</p>
      </div>
    </Link>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, gradient, icon, onClick }: {
  label: string; value: string; sub?: string;
  gradient: string; icon: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick}
      className={`rounded-2xl p-5 text-white ${gradient} ${onClick ? 'cursor-pointer hover:opacity-90' : ''} shadow-md transition-all`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium opacity-80">{label}</p>
        <span className="text-2xl opacity-70">{icon}</span>
      </div>
      <p className="text-2xl font-black tracking-tight">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PrincipalFinanceOverview() {
  const token = getToken() || '';
  const router = useRouter();

  const [monthly,            setMonthly]            = useState<MonthlyRow[]>([]);
  const [classData,          setClassData]          = useState<ClassRow[]>([]);
  const [profitLoss,         setProfitLoss]         = useState<ProfitLoss | null>(null);
  const [feeSummary,         setFeeSummary]         = useState<FeeSummary | null>(null);
  const [reconPending,       setReconPending]       = useState<ReconPending>({ count: 0, total_amount: 0 });
  const [pendingConcessions, setPendingConcessions] = useState(0);
  const [pendingOverrides,   setPendingOverrides]   = useState(0);
  const [pendingCancels,     setPendingCancels]     = useState(0);
  const [loading,            setLoading]            = useState(true);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    Promise.all([
      apiGet<MonthlyRow[]>(`/api/v1/financial/reports/monthly-collection?year=${currentYear}`, token).catch(() => []),
      apiGet<ClassRow[]>('/api/v1/financial/reports/class-collection', token).catch(() => []),
      apiGet<ProfitLoss>(`/api/v1/financial/reports/profit-loss?from=${currentYear}-04-01`, token).catch(() => null),
      apiGet<FeeSummary>('/api/v1/financial/reports/fee-summary', token).catch(() => null),
      apiGet<ReconPending>('/api/v1/financial/reports/reconciliation-pending', token).catch(() => ({ count: 0, total_amount: 0 })),
      apiGet<any[]>('/api/v1/financial/concessions/pending', token).catch(() => []),
      apiGet<any[]>('/api/v1/financial/payments/pending-overrides', token).catch(() => []),
      apiGet<any[]>('/api/v1/financial/payments/pending-cancellations', token).catch(() => []),
    ]).then(([m, cls, pl, feeSumm, recon, conc, ovr, cncl]) => {
      setMonthly(Array.isArray(m) ? (m as MonthlyRow[]).slice(0, 6).reverse() : []);
      setClassData(Array.isArray(cls) ? (cls as ClassRow[]).slice(0, 6) : []);
      setProfitLoss(pl as ProfitLoss | null);
      setFeeSummary(feeSumm as FeeSummary | null);
      setReconPending(recon as ReconPending);
      setPendingConcessions(Array.isArray(conc) ? conc.length : 0);
      setPendingOverrides(Array.isArray(ovr) ? ovr.length : 0);
      setPendingCancels(Array.isArray(cncl) ? cncl.length : 0);
    }).finally(() => setLoading(false));
  }, []);

  const monthlyBars = monthly.map(m => ({
    label: new Date(m.month).toLocaleDateString('en-IN', { month: 'short' }),
    value: Number(m.total),
  }));

  const maxClass = Math.max(...classData.map(c => Number(c.total_collected) + Number(c.total_pending)), 1);

  const totalActions = pendingConcessions + pendingOverrides + pendingCancels;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Finance Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {totalActions > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
            <span className="text-red-600 font-bold text-lg">{totalActions}</span>
            <span className="text-xs text-red-500">actions needed</span>
          </div>
        )}
      </div>

      {/* ── Top KPI strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Total Collected"
          value={loading ? '—' : `Rs. ${(feeSummary?.total_collected || 0).toLocaleString('en-IN')}`}
          sub={`of Rs. ${(feeSummary?.total_assigned || 0).toLocaleString('en-IN')} assigned`}
          gradient="bg-gradient-to-br from-[#1B4332] to-[#2d6a4f]"
          icon="✅"
        />
        <StatTile
          label="Total Pending"
          value={loading ? '—' : `Rs. ${(feeSummary?.total_outstanding || 0).toLocaleString('en-IN')}`}
          sub={`${feeSummary ? Math.round(((feeSummary.total_assigned - feeSummary.total_outstanding) / Math.max(feeSummary.total_assigned, 1)) * 100) : 0}% collected`}
          gradient="bg-gradient-to-br from-amber-500 to-orange-500"
          icon="⏳"
          onClick={() => router.push('/principal/finance/fees')}
        />
        <StatTile
          label="Collection Rate"
          value={loading ? '—' : (() => {
            const assigned = feeSummary?.total_assigned || 0;
            const collected = feeSummary?.total_collected || 0;
            return assigned > 0 ? `${Math.round((collected / assigned) * 100)}%` : '0%';
          })()}
          sub={`Rs. ${(feeSummary?.total_collected || 0).toLocaleString('en-IN')} of Rs. ${(feeSummary?.total_assigned || 0).toLocaleString('en-IN')}`}
          gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          icon="📊"
        />
        <StatTile
          label="Net Profit (YTD)"
          value={loading ? '—' : `Rs. ${Math.abs(profitLoss?.net_profit || 0).toLocaleString('en-IN')}`}
          sub={(profitLoss?.net_profit || 0) >= 0 ? '▲ surplus' : '▼ deficit'}
          gradient={(profitLoss?.net_profit || 0) >= 0
            ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
            : 'bg-gradient-to-br from-red-500 to-rose-600'}
          icon="💹"
          onClick={() => router.push('/principal/finance/reports')}
        />
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Monthly revenue bar chart */}
        <div className="sm:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Monthly Collections</h2>
              <p className="text-xs text-gray-400">{currentYear} — last 6 months</p>
            </div>
            <Link href="/principal/finance/reports" className="text-xs text-primary hover:underline">View report →</Link>
          </div>
          {loading ? (
            <div className="h-32 bg-gray-50 rounded-xl animate-pulse" />
          ) : (
            <BarChart data={monthlyBars} color="#1B4332" />
          )}
          {!loading && monthly.length > 0 && (
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">
                Total: ₹{monthly.reduce((s, m) => s + Number(m.total), 0).toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-gray-400">
                Avg: ₹{Math.round(monthly.reduce((s, m) => s + Number(m.total), 0) / (monthly.length || 1)).toLocaleString('en-IN')}/mo
              </span>
            </div>
          )}
        </div>

        {/* Collection vs pending donut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
          <h2 className="text-sm font-bold text-gray-800 mb-1">Fee Health</h2>
          <p className="text-xs text-gray-400 mb-4">Collected vs outstanding</p>
          {loading ? (
            <div className="flex-1 bg-gray-50 rounded-xl animate-pulse" />
          ) : (
            <>
              <DonutChart segments={[
                { value: feeSummary?.total_collected || 0,   color: '#1B4332', label: 'Collected' },
                { value: feeSummary?.total_outstanding || 0, color: '#E8960C', label: 'Pending' },
              ]} />
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1B4332] shrink-0" />
                  <span className="text-gray-600">Collected</span>
                  <span className="ml-auto font-semibold text-gray-800">Rs. {(feeSummary?.total_collected || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-gray-600">Pending</span>
                  <span className="ml-auto font-semibold text-gray-800">Rs. {(feeSummary?.total_outstanding || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Instalment-wise pending breakdown ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-800">Instalment-wise Fee Status</h2>
            <p className="text-xs text-gray-400">Collected vs pending per instalment across all students</p>
          </div>
          <Link href="/principal/finance/reports" className="text-xs text-primary hover:underline">Full report →</Link>
        </div>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />)}</div>
        ) : !feeSummary?.instalments?.length ? (
          <p className="text-xs text-gray-400 text-center py-6">No instalment data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-500">
                  <th className="text-left py-2 px-3">Instalment</th>
                  <th className="text-left py-2 px-3">Fee Head</th>
                  <th className="text-center py-2 px-3">Due Date</th>
                  <th className="text-right py-2 px-3">Total Due</th>
                  <th className="text-right py-2 px-3">Collected</th>
                  <th className="text-right py-2 px-3">Pending</th>
                  <th className="py-2 px-3 w-32">Progress</th>
                </tr>
              </thead>
              <tbody>
                {feeSummary.instalments.map((inst, i) => {
                  const pct = inst.total_instalment_amount > 0
                    ? Math.round((inst.total_paid / inst.total_instalment_amount) * 100) : 0;
                  const isOverdue = inst.due_date && new Date(inst.due_date) < new Date() && inst.total_pending > 0;
                  return (
                    <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${isOverdue ? 'bg-red-50/30' : ''}`}>
                      <td className="py-2.5 px-3">
                        <span className="text-xs font-semibold text-gray-700">{inst.label}</span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500">{inst.fee_head_name}</td>
                      <td className="py-2.5 px-3 text-center text-xs">
                        {inst.due_date ? (
                          <span className={`px-2 py-0.5 rounded-full ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                            {new Date(inst.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {isOverdue && ' ⚠'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs text-gray-700">
                        Rs. {inst.total_instalment_amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs font-semibold text-green-700">
                        Rs. {inst.total_paid.toLocaleString('en-IN')}
                      </td>
                      <td className={`py-2.5 px-3 text-right text-xs font-semibold ${inst.total_pending > 0 ? (isOverdue ? 'text-red-600' : 'text-amber-600') : 'text-gray-400'}`}>
                        {inst.total_pending > 0 ? `Rs. ${inst.total_pending.toLocaleString('en-IN')}` : '✓ Cleared'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : isOverdue ? '#ef4444' : '#E8960C' }} />
                          </div>
                          <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={3} className="py-2.5 px-3 text-xs font-bold text-gray-700">Total</td>
                  <td className="py-2.5 px-3 text-right text-xs font-bold text-gray-800">
                    Rs. {feeSummary.total_assigned.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs font-bold text-green-700">
                    Rs. {feeSummary.total_collected.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs font-bold text-amber-600">
                    Rs. {feeSummary.total_outstanding.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#1B4332] rounded-full"
                          style={{ width: `${feeSummary.total_assigned > 0 ? Math.round((feeSummary.total_collected / feeSummary.total_assigned) * 100) : 0}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-600 w-8 text-right">
                        {feeSummary.total_assigned > 0 ? Math.round((feeSummary.total_collected / feeSummary.total_assigned) * 100) : 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Income vs Expense + Class breakdown ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* P&L summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-800">Income vs Expenses (YTD)</h2>
            <Link href="/principal/finance/reports" className="text-xs text-primary hover:underline">Details →</Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Income</span>
                  <span className="font-semibold text-emerald-700">₹{(profitLoss?.total_income || 0).toLocaleString('en-IN')}</span>
                </div>
                <HBar value={profitLoss?.total_income || 0} max={Math.max(profitLoss?.total_income || 0, profitLoss?.total_expenses || 0, 1)} color="#10b981" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Expenses</span>
                  <span className="font-semibold text-red-600">₹{(profitLoss?.total_expenses || 0).toLocaleString('en-IN')}</span>
                </div>
                <HBar value={profitLoss?.total_expenses || 0} max={Math.max(profitLoss?.total_income || 0, profitLoss?.total_expenses || 0, 1)} color="#ef4444" />
              </div>
              <div className={`rounded-xl p-3 ${(profitLoss?.net_profit || 0) >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-600">Net {(profitLoss?.net_profit || 0) >= 0 ? 'Surplus' : 'Deficit'}</span>
                  <span className={`text-base font-black ${(profitLoss?.net_profit || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    ₹{Math.abs(profitLoss?.net_profit || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Class-wise collection */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-800">Class-wise Collection</h2>
            <Link href="/principal/finance/reports" className="text-xs text-primary hover:underline">All →</Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-7 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : classData.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No class data</p>
          ) : (
            <div className="space-y-3">
              {classData.map((c, i) => {
                const total = Number(c.total_collected) + Number(c.total_pending);
                const pct = total > 0 ? Math.round((Number(c.total_collected) / total) * 100) : 0;
                const colors = ['#1B4332','#2d6a4f','#40916c','#52b788','#74c69d','#95d5b2'];
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{c.class_name}</span>
                      <span className="text-gray-400">{pct}% · ₹{Number(c.total_collected).toLocaleString('en-IN')}</span>
                    </div>
                    <HBar value={Number(c.total_collected)} max={maxClass} color={colors[i % colors.length]} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Alerts / action items ───────────────────────────────────────────── */}
      {(pendingConcessions > 0 || pendingOverrides > 0 || pendingCancels > 0 || reconPending.count > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-3">⚡ Action Required</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {pendingConcessions > 0 && (
              <button onClick={() => router.push('/principal/finance/concessions')}
                className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors text-left">
                <span className="text-xl">🎁</span>
                <div>
                  <p className="text-xs font-bold text-amber-800">{pendingConcessions} Concession{pendingConcessions !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-amber-600">awaiting approval</p>
                </div>
              </button>
            )}
            {pendingOverrides > 0 && (
              <button onClick={() => router.push('/principal/finance/overrides')}
                className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 transition-colors text-left">
                <span className="text-xl">🔑</span>
                <div>
                  <p className="text-xs font-bold text-red-800">{pendingOverrides} Override{pendingOverrides !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-red-600">duplicate ref pending</p>
                </div>
              </button>
            )}
            {pendingCancels > 0 && (
              <button onClick={() => router.push('/principal/finance/cancellations')}
                className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 transition-colors text-left">
                <span className="text-xl">🗑️</span>
                <div>
                  <p className="text-xs font-bold text-red-800">{pendingCancels} Cancellation{pendingCancels !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-red-600">receipts pending cancel</p>
                </div>
              </button>
            )}
            {reconPending.count > 0 && (
              <button onClick={() => router.push('/principal/finance/reconciliation/online')}
                className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors text-left">
                <span className="text-xl">🔍</span>
                <div>
                  <p className="text-xs font-bold text-blue-800">{reconPending.count} Payment{reconPending.count !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-blue-600">pending bank match</p>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Quick actions grid ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ActionTile href="/principal/finance/fees"           icon="💳" label="Collect Fee"          desc="Record payments" />
          <ActionTile href="/principal/finance/fee-structures" icon="🏷️" label="Fee Structures"       desc="Create & assign" />
          <ActionTile href="/principal/finance/concessions"    icon="🎁" label="Concessions"          desc="Approve requests" badge={pendingConcessions} badgeColor="bg-amber-500" />
          <ActionTile href="/principal/finance/overrides"      icon="🔑" label="Overrides"            desc="Duplicate refs"   badge={pendingOverrides} />
          <ActionTile href="/principal/finance/cancellations"  icon="🗑️" label="Cancellations"        desc="Receipt cancels"  badge={pendingCancels} />
          <ActionTile href="/principal/finance/expenses"       icon="🧾" label="Expenses"             desc="View & add" />
          <ActionTile href="/principal/finance/salary"         icon="👔" label="Salary"               desc="Staff payroll" />
          <ActionTile href="/principal/finance/reconciliation" icon="💵" label="Cash Recon"           desc="Reconcile cash" />
          <ActionTile href="/principal/finance/reconciliation/online" icon="🔍" label="Online Recon" desc="Verify UPI/bank" badge={reconPending.count} badgeColor="bg-blue-500" />
          <ActionTile href="/principal/finance/reports"        icon="📈" label="Reports"              desc="Charts & exports" />
          <ActionTile href="/principal/finance/permissions"    icon="🔐" label="Permissions"          desc="Finance roles" />
          <ActionTile href="/principal/hr"                     icon="👥" label="HR"                   desc="Staff management" />
        </div>
      </div>

    </div>
  );
}

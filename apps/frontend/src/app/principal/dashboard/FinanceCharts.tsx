'use client';
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface RevenueData {
  total_collected: number;
  total_pending: number;
  collection_rate: number;
}
interface ProfitLoss {
  total_income: number;
  total_expenses: number;
  net_profit: number;
}
interface MonthlyRow {
  month: string;
  total: number;
  count: number;
}
interface ClassCollection {
  class_name: string;
  total_collected: number;
  total_pending: number;
}

const fmt = (n: number) =>
  n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000
    ? `₹${(n / 1000).toFixed(1)}K`
    : `₹${n.toFixed(0)}`;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function FinanceCharts({ token }: { token: string }) {
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [pl, setPl] = useState<ProfitLoss | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [classData, setClassData] = useState<ClassCollection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const year = new Date().getFullYear();
    Promise.all([
      apiGet<RevenueData>('/api/v1/financial/reports/revenue', token).catch(() => null),
      apiGet<ProfitLoss>('/api/v1/financial/reports/profit-loss', token).catch(() => null),
      apiGet<MonthlyRow[]>(`/api/v1/financial/reports/monthly-collection?year=${year}`, token).catch(() => []),
      apiGet<ClassCollection[]>('/api/v1/financial/reports/class-collection', token).catch(() => []),
    ]).then(([rev, profitLoss, mon, cls]) => {
      setRevenue(rev);
      setPl(profitLoss);
      // Fill all 12 months
      const byMonth: Record<number, number> = {};
      (mon || []).forEach((r: any) => {
        const m = new Date(r.month).getMonth();
        byMonth[m] = parseFloat(r.total);
      });
      setMonthly(MONTHS.map((name, i) => ({ month: name, total: byMonth[i] ?? 0, count: 0 })));
      setClassData((cls || []).slice(0, 8));
    }).finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-neutral-100 h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  const collectionPct = revenue?.collection_rate ?? 0;
  const netProfit = pl?.net_profit ?? 0;
  const isProfit = netProfit >= 0;

  // Pie for collected vs pending
  const feePie = [
    { name: 'Collected', value: revenue?.total_collected ?? 0, color: '#10b981' },
    { name: 'Pending', value: revenue?.total_pending ?? 0, color: '#f87171' },
  ].filter(d => d.value > 0);

  // Expense breakdown pie (estimated from P&L)
  const plPie = pl ? [
    { name: 'Revenue', value: pl.total_income, color: '#10b981' },
    { name: 'Expenses', value: pl.total_expenses, color: '#f87171' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-3">
      {/* KPI cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Collected',
            value: fmt(revenue?.total_collected ?? 0),
            sub: `${collectionPct}% collection rate`,
            icon: '💰',
            color: 'bg-emerald-50 border-emerald-100',
            textColor: 'text-emerald-700',
          },
          {
            label: 'Pending Fees',
            value: fmt(revenue?.total_pending ?? 0),
            sub: 'outstanding balance',
            icon: '⏳',
            color: 'bg-amber-50 border-amber-100',
            textColor: 'text-amber-700',
          },
          {
            label: 'Total Expenses',
            value: fmt(pl?.total_expenses ?? 0),
            sub: 'this year',
            icon: '📤',
            color: 'bg-red-50 border-red-100',
            textColor: 'text-red-600',
          },
          {
            label: isProfit ? 'Net Profit' : 'Net Loss',
            value: fmt(Math.abs(netProfit)),
            sub: isProfit ? 'estimated profit' : 'estimated loss',
            icon: isProfit ? '📈' : '📉',
            color: isProfit ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100',
            textColor: isProfit ? 'text-blue-700' : 'text-rose-600',
          },
        ].map(card => (
          <div key={card.label} className={`rounded-2xl border p-3.5 ${card.color}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-lg">{card.icon}</span>
              {card.label === 'Total Collected' && (
                <div className="w-12 bg-white/60 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-emerald-500"
                    style={{ width: `${Math.min(collectionPct, 100)}%` }} />
                </div>
              )}
            </div>
            <p className={`text-xl font-black leading-none ${card.textColor}`}>{card.value}</p>
            <p className="text-[10px] font-semibold text-neutral-600 mt-0.5">{card.label}</p>
            <p className="text-[9px] text-neutral-400">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Monthly collection area chart */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">
            Monthly Collection {new Date().getFullYear()}
          </p>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="collGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: any) => [fmt(v), 'Collected']} />
                <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2}
                  fill="url(#collGrad)" dot={{ r: 2, fill: '#10b981' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fee collected vs pending donut */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Fee Status</p>
          <p className="text-[10px] text-neutral-400 mb-2">Collected vs outstanding</p>
          {feePie.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="w-28 h-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={feePie} cx="50%" cy="50%" innerRadius={28} outerRadius={50}
                      dataKey="value" startAngle={90} endAngle={-270}>
                      {feePie.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(v: any) => [fmt(v), '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {feePie.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <div className="flex-1 flex items-center justify-between">
                      <p className="text-[10px] text-neutral-600">{d.name}</p>
                      <p className="text-[10px] font-bold text-neutral-800">{fmt(d.value)}</p>
                    </div>
                  </div>
                ))}
                <div className="mt-1 pt-1 border-t border-neutral-100">
                  <p className="text-[10px] font-bold text-emerald-600">{collectionPct}% collected</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-400 text-center py-6">No fee data yet</p>
          )}
        </div>
      </div>

      {/* Class-wise collection bar */}
      {classData.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">Class-wise Fee Collection</p>
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classData} margin={{ top: 0, right: 4, left: -20, bottom: 0 }} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="class_name" tick={{ fontSize: 9 }}
                  tickFormatter={v => v.length > 6 ? v.slice(0, 6) : v} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: any, name: string) => [fmt(v), name === 'total_collected' ? 'Collected' : 'Pending']} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="total_collected" name="Collected" fill="#10b981" radius={[3,3,0,0]} />
                <Bar dataKey="total_pending" name="Pending" fill="#fbbf24" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* P&L summary */}
      {pl && (
        <div className={`rounded-2xl border p-4 ${isProfit ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
          <div className="flex items-center gap-2 mb-3">
            {isProfit ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-rose-600" />}
            <p className="text-xs font-bold text-neutral-700 uppercase tracking-widest">Profit & Loss Summary</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Revenue', value: fmt(pl.total_income), color: 'text-emerald-700' },
              { label: 'Total Expenses', value: fmt(pl.total_expenses), color: 'text-red-600' },
              { label: isProfit ? 'Net Profit' : 'Net Loss', value: fmt(Math.abs(netProfit)), color: isProfit ? 'text-blue-700' : 'text-rose-700' },
            ].map(item => (
              <div key={item.label} className="bg-white/70 rounded-xl p-2.5 text-center">
                <p className={`text-base font-black ${item.color}`}>{item.value}</p>
                <p className="text-[9px] text-neutral-500 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

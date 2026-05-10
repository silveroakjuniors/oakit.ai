'use client';
import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';
import { apiGet } from '@/lib/api';
import Link from 'next/link';

interface RevenueData { total_collected: number; total_pending: number; collection_rate: number; }
interface ProfitLoss  { total_income: number; total_expenses: number; net_profit: number; }
interface MonthlyRow  { month: string; total: string; count: string; }
interface ClassRow    { class_name: string; total_collected: string; total_pending: string; }

function fmt(n: number) {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}L`;
  if (n >= 1_000)     return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface Props { token: string; }

export default function FinanceSnapshot({ token }: Props) {
  const [revenue, setRevenue]     = useState<RevenueData | null>(null);
  const [pl, setPl]               = useState<ProfitLoss | null>(null);
  const [monthly, setMonthly]     = useState<MonthlyRow[]>([]);
  const [classes, setClasses]     = useState<ClassRow[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const year = new Date().getFullYear();
    Promise.all([
      apiGet<RevenueData>('/api/v1/financial/reports/revenue', token).catch(() => null),
      apiGet<ProfitLoss>(`/api/v1/financial/reports/profit-loss?from=${year}-01-01`, token).catch(() => null),
      apiGet<MonthlyRow[]>(`/api/v1/financial/reports/monthly-collection?year=${year}`, token).catch(() => []),
      apiGet<ClassRow[]>('/api/v1/financial/reports/class-collection', token).catch(() => []),
    ]).then(([rev, profitLoss, mon, cls]) => {
      setRevenue(rev);
      setPl(profitLoss);
      // Build 12-month array
      const map: Record<number, number> = {};
      (mon || []).forEach(r => {
        const m = new Date(r.month).getMonth();
        map[m] = parseFloat(r.total as any);
      });
      setMonthly(Array.from({ length: 12 }, (_, i) => ({
        month: MONTH_LABELS[i],
        total: String(map[i] ?? 0),
        count: '0',
      })));
      setClasses((cls || []).slice(0, 6));
    }).finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 animate-pulse h-48" />
    );
  }

  const collected  = parseFloat(String(revenue?.total_collected ?? 0));
  const pending    = parseFloat(String(revenue?.total_pending ?? 0));
  const collRate   = parseFloat(String(revenue?.collection_rate ?? 0));
  const income     = parseFloat(String(pl?.total_income ?? 0));
  const expenses   = parseFloat(String(pl?.total_expenses ?? 0));
  const netProfit  = parseFloat(String(pl?.net_profit ?? 0));
  const totalFee   = collected + pending;

  // Pie: collected vs pending
  const pieFee = [
    { name: 'Collected', value: collected, color: '#10b981' },
    { name: 'Pending',   value: pending,   color: '#f87171' },
  ].filter(d => d.value > 0);

  // Pie: income vs expenses
  const piePL = [
    { name: 'Income',   value: income,    color: '#6366f1' },
    { name: 'Expenses', value: expenses,  color: '#f59e0b' },
  ].filter(d => d.value > 0);

  // Monthly area chart data
  const areaData = monthly.map(m => ({ name: m.month, amount: parseFloat(m.total) }));

  // Class bar data
  const classBar = classes.map(c => ({
    name: c.class_name.length > 6 ? c.class_name.slice(0, 6) : c.class_name,
    collected: parseFloat(c.total_collected as any),
    pending:   parseFloat(c.total_pending as any),
  }));

  const kpis: { label: string; value: string; sub: string; color: string; Icon: React.ElementType; bg: string }[] = [
    { label: 'Total Collected',  value: fmt(collected),  sub: `${collRate.toFixed(0)}% collection rate`, color: '#10b981', Icon: TrendingUp,   bg: 'bg-emerald-50' },
    { label: 'Total Pending',    value: fmt(pending),    sub: `${totalFee > 0 ? ((pending/totalFee)*100).toFixed(0) : 0}% of total fees`, color: '#f87171', Icon: AlertCircle, bg: 'bg-red-50' },
    { label: 'Total Expenses',   value: fmt(expenses),   sub: 'this year',                                color: '#f59e0b', Icon: TrendingDown, bg: 'bg-amber-50' },
    { label: 'Net Profit (YTD)', value: fmt(netProfit),  sub: netProfit >= 0 ? 'surplus' : 'deficit',    color: netProfit >= 0 ? '#6366f1' : '#ef4444', Icon: DollarSign, bg: netProfit >= 0 ? 'bg-indigo-50' : 'bg-red-50' },
  ];

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Finance Overview</p>
        <Link href="/principal/finance" className="text-xs text-[#1B4332] font-semibold hover:underline">
          Full Finance →
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {kpis.map(k => (
          <div key={k.label} className={`${k.bg} rounded-2xl p-3 border border-white`}>
            <div className="flex items-center justify-between mb-1">
              <k.Icon className="w-4 h-4" style={{ color: k.color }} />
              <span className="text-[9px] text-neutral-400 uppercase tracking-wide">{k.label}</span>
            </div>
            <p className="text-lg font-black leading-none" style={{ color: k.color }}>{k.value}</p>
            <p className="text-[9px] text-neutral-500 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row — stack on mobile, side by side on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* Monthly collection area chart */}
        <div className="sm:col-span-2 bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">Monthly Collections {new Date().getFullYear()}</p>
          <div style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: any) => [fmt(v), 'Collected']}
                />
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2}
                  fill="url(#colGrad)" dot={{ r: 2, fill: '#10b981' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fee health pie */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Fee Health</p>
          {pieFee.length > 0 ? (
            <div className="flex items-center gap-4">
              <div style={{ width: 90, height: 90 }} className="shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieFee} cx="50%" cy="50%" innerRadius={24} outerRadius={40}
                      dataKey="value" startAngle={90} endAngle={-270}>
                      {pieFee.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(v: any) => [fmt(v), '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                {pieFee.map(d => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-[10px] text-neutral-600">{d.name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-neutral-800">{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-400 text-center py-6">No fee data yet</p>
          )}
        </div>
      </div>

      {/* Class-wise + P&L row */}
      {(classBar.length > 0 || piePL.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {classBar.length > 0 && (
            <div className="sm:col-span-2 bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">Class-wise Collection</p>
              <div style={{ height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classBar} margin={{ top: 0, right: 4, left: -28, bottom: 0 }} barSize={10}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(v: any, name: string) => [fmt(v), name === 'collected' ? 'Collected' : 'Pending']} />
                    <Bar dataKey="collected" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="pending"   fill="#f87171" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {piePL.length > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Income vs Expenses</p>
              <div className="flex items-center gap-4">
                <div style={{ width: 90, height: 90 }} className="shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={piePL} cx="50%" cy="50%" innerRadius={24} outerRadius={40}
                        dataKey="value" startAngle={90} endAngle={-270}>
                        {piePL.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        formatter={(v: any) => [fmt(v), '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  {piePL.map(d => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                        <span className="text-[10px] text-neutral-600">{d.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-neutral-800">{fmt(d.value)}</span>
                    </div>
                  ))}
                  <div className="pt-1 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-600">Net</span>
                    <span className={`text-[10px] font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {fmt(Math.abs(netProfit))} {netProfit >= 0 ? '▲' : '▼'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface UsageData {
  balance_inr: string;
  lifetime_used_inr: string;
  lifetime_recharged_inr: string;
  blocked: boolean;
  this_month_calls: number;
  this_month_inr: string;
  low_balance_threshold_inr: string;
  daily_usage: { day: string; calls: number; inr: string }[];
  by_endpoint: { endpoint: string; calls: number; inr: string }[];
  recent_recharges: { amount_inr: string; balance_after_inr: string; description: string; date: string }[];
}

export default function AiUsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const token = getToken();

  useEffect(() => {
    if (!token) return;
    apiGet<UsageData>('/api/v1/admin/ai-usage', token)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="p-6 text-gray-400">Loading Oakie usage...</div>;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Oakie AI Usage</h1>
        <p className="text-sm text-gray-500 mt-1">Credit balance, usage trends and recharge history</p>
      </div>

      {data?.blocked && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <p className="text-sm font-semibold text-red-700">⚠️ AI access is currently blocked due to low balance. Please contact support to recharge.</p>
        </div>
      )}

      {/* Balance cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Current Balance', value: `₹${data?.balance_inr ?? '0.00'}`, color: 'emerald' },
          { label: 'This Month', value: `₹${data?.this_month_inr ?? '0.00'}`, sub: `${data?.this_month_calls ?? 0} calls`, color: 'blue' },
          { label: 'Lifetime Used', value: `₹${data?.lifetime_used_inr ?? '0.00'}`, color: 'amber' },
          { label: 'Lifetime Recharged', value: `₹${data?.lifetime_recharged_inr ?? '0.00'}`, color: 'gray' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className="text-xl font-bold text-gray-900">{c.value}</p>
            {c.sub && <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* By endpoint */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">Usage by Feature (This Month)</p>
          {!data?.by_endpoint.length ? (
            <p className="text-xs text-gray-400">No usage this month</p>
          ) : (
            <div className="space-y-2">
              {data.by_endpoint.map(e => (
                <div key={e.endpoint} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 truncate max-w-[60%] text-xs">{e.endpoint.replace('/api/v1/', '')}</span>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">₹{e.inr}</span>
                    <span className="text-gray-400 text-xs ml-1">({e.calls})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent recharges */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">Recent Recharges</p>
          {!data?.recent_recharges.length ? (
            <p className="text-xs text-gray-400">No recharges yet</p>
          ) : (
            <div className="space-y-2">
              {data.recent_recharges.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-emerald-700">+₹{r.amount_inr}</p>
                    <p className="text-xs text-gray-400">{r.description || 'Recharge'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Balance: ₹{r.balance_after_inr}</p>
                    <p className="text-xs text-gray-400">{new Date(r.date).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily usage last 30 days */}
      {!!data?.daily_usage.length && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mt-4">
          <p className="text-sm font-bold text-gray-700 mb-3">Daily Usage — Last 30 Days</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left py-1.5 font-semibold">Date</th>
                  <th className="text-right py-1.5 font-semibold">Calls</th>
                  <th className="text-right py-1.5 font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.daily_usage.slice().reverse().map(d => (
                  <tr key={d.day} className="border-b border-gray-50">
                    <td className="py-1.5 text-gray-600">{new Date(d.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                    <td className="py-1.5 text-right text-gray-700">{d.calls}</td>
                    <td className="py-1.5 text-right font-semibold text-gray-900">₹{d.inr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

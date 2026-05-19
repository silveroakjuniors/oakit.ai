'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface PlatformStats {
  total_schools: number;
  active_schools: number;
  total_teachers: number;
  total_students: number;
  total_day_plans: number;
}

interface BillingStats {
  total_recharged_paise: number;
  total_used_paise: number;
  total_balance_paise: number;
  blocked_schools: number;
  low_balance_schools: number;
  this_month_calls: number;
  this_month_paise: number;
  top_endpoint: string;
  daily_usage: { day: string; calls: number; total_paise: number; active_schools: number }[];
}

function inr(p: number) { return (p / 100).toFixed(2); }

const DARK = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };

export default function PlatformStatsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [billing, setBilling] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = getToken();

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiGet<PlatformStats>('/api/v1/super-admin/stats', token),
      apiGet<BillingStats>('/api/v1/super-admin/billing/platform-stats', token),
    ]).then(([s, b]) => { setStats(s); setBilling(b); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="p-8 text-white/40 text-sm">Loading analytics...</div>;

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Platform Analytics</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Real-time stats across all schools on Oakit.ai</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-2xl text-sm text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {/* School stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total Schools', value: stats.total_schools, color: 'text-blue-400' },
            { label: 'Active Schools', value: stats.active_schools, color: 'text-emerald-400' },
            { label: 'Teachers', value: stats.total_teachers, color: 'text-purple-400' },
            { label: 'Students', value: stats.total_students, color: 'text-amber-400' },
            { label: 'Day Plans', value: stats.total_day_plans.toLocaleString(), color: 'text-pink-400' },
          ].map(c => (
            <div key={c.label} className="rounded-2xl p-4 text-center" style={DARK}>
              <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* AI billing stats */}
      {billing && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Recharged', value: `₹${inr(billing.total_recharged_paise)}`, color: 'text-emerald-400' },
              { label: 'Total Used', value: `₹${inr(billing.total_used_paise)}`, color: 'text-amber-400' },
              { label: 'This Month Calls', value: billing.this_month_calls.toLocaleString(), color: 'text-blue-400' },
              { label: 'Blocked Schools', value: billing.blocked_schools, color: billing.blocked_schools > 0 ? 'text-red-400' : 'text-white/40' },
            ].map(c => (
              <div key={c.label} className="rounded-2xl p-4 text-center" style={DARK}>
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.label}</p>
              </div>
            ))}
          </div>

          {/* Daily usage table */}
          {billing.daily_usage.length > 0 && (
            <div className="rounded-2xl p-5" style={DARK}>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Daily AI Usage — Last 30 Days</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {['Date', 'Calls', 'Cost', 'Active Schools'].map(h => (
                        <th key={h} className="text-left py-2 px-3 font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {billing.daily_usage.slice().reverse().map(d => (
                      <tr key={d.day} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td className="py-2 px-3 text-white/60">{new Date(d.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                        <td className="py-2 px-3 text-white/80 font-semibold">{d.calls}</td>
                        <td className="py-2 px-3 text-emerald-400">₹{inr(d.total_paise)}</td>
                        <td className="py-2 px-3 text-white/50">{d.active_schools}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {billing.top_endpoint && (
            <div className="mt-3 rounded-2xl px-5 py-3" style={DARK}>
              <p className="text-xs text-white/40">Top endpoint this month: <span className="text-white/70 font-mono">{billing.top_endpoint}</span></p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

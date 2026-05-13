'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface SchoolWallet {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  plan_type: string;
  balance_paise: number;
  lifetime_used_paise: number;
  lifetime_recharged_paise: number;
  blocked: boolean;
  low_balance_alerted: boolean;
  flat_cost_paise: number;
  low_balance_threshold_paise: number;
  this_month_paise: number;
  this_month_calls: number;
  total_students: number;
  total_teachers: number;
}

interface PlatformStats {
  total_recharged_paise: number;
  total_used_paise: number;
  total_balance_paise: number;
  blocked_schools: number;
  low_balance_schools: number;
  this_month_calls: number;
  this_month_paise: number;
  top_endpoint: string;
}

function inr(paise: number) { return (paise / 100).toFixed(2); }

export default function BillingPage() {
  const [schools, setSchools] = useState<SchoolWallet[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SchoolWallet | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeNote, setRechargeNote] = useState('');
  const [recharging, setRecharging] = useState(false);
  const [pricingForm, setPricingForm] = useState({ flat_cost_paise: '', low_balance_threshold_paise: '' });
  const [savingPricing, setSavingPricing] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const token = getToken();

  function load() {
    if (!token) return;
    setLoading(true);
    Promise.all([
      apiGet<SchoolWallet[]>('/api/v1/super-admin/billing/schools', token),
      apiGet<PlatformStats>('/api/v1/super-admin/billing/platform-stats', token),
    ]).then(([s, p]) => { setSchools(s); setStats(p); })
      .catch(console.error).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openSchool(s: SchoolWallet) {
    setSelected(s);
    setPricingForm({
      flat_cost_paise: String(s.flat_cost_paise),
      low_balance_threshold_paise: String(s.low_balance_threshold_paise),
    });
    setMsg(''); setError('');
  }

  async function handleRecharge(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selected || !rechargeAmount) return;
    setRecharging(true); setError(''); setMsg('');
    try {
      await apiPost(`/api/v1/super-admin/billing/schools/${selected.id}/recharge`, {
        amount_inr: Number(rechargeAmount), description: rechargeNote || undefined,
      }, token);
      setMsg(`✓ Recharged ₹${rechargeAmount} to ${selected.name}`);
      setRechargeAmount(''); setRechargeNote(''); load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setRecharging(false); }
  }

  async function handleSavePricing(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selected) return;
    setSavingPricing(true); setError(''); setMsg('');
    try {
      await apiPut(`/api/v1/super-admin/billing/schools/${selected.id}/pricing`, {
        flat_cost_paise: pricingForm.flat_cost_paise ? Number(pricingForm.flat_cost_paise) : undefined,
        low_balance_threshold_paise: pricingForm.low_balance_threshold_paise ? Number(pricingForm.low_balance_threshold_paise) : undefined,
      }, token);
      setMsg('✓ Pricing updated');
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSavingPricing(false); }
  }

  const filtered = schools.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));
  const inp = 'w-full px-3 py-2 rounded-xl border border-white/10 text-sm bg-white/5 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-emerald-400';

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">AI Billing & Credits</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Manage Oakie AI credits across all schools</p>
      </div>

      {/* Platform stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Recharged', value: `₹${inr(stats.total_recharged_paise)}`, color: 'text-emerald-400' },
            { label: 'Total Used', value: `₹${inr(stats.total_used_paise)}`, color: 'text-amber-400' },
            { label: 'This Month Calls', value: stats.this_month_calls.toLocaleString(), color: 'text-blue-400' },
            { label: 'Blocked Schools', value: stats.blocked_schools, color: stats.blocked_schools > 0 ? 'text-red-400' : 'text-white/60' },
          ].map(c => (
            <div key={c.label} className="rounded-2xl p-4 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.label}</p>
            </div>
          ))}
        </div>
      )}

      <input type="text" placeholder="Search schools..." value={search}
        onChange={e => setSearch(e.target.value)}
        className={`mb-4 w-64 ${inp}`} />

      {loading ? <p className="text-white/40 text-sm">Loading...</p> : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <table className="w-full text-sm">
            <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <tr>
                {['School', 'Balance', 'This Month', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{s.name}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.subdomain}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className={`font-bold ${s.blocked ? 'text-red-400' : s.balance_paise < s.low_balance_threshold_paise ? 'text-amber-400' : 'text-emerald-400'}`}>
                      ₹{inr(s.balance_paise)}
                    </p>
                    {s.blocked && <p className="text-xs text-red-400">BLOCKED</p>}
                  </td>
                  <td className="px-4 py-3 text-white/60">
                    <p>₹{inr(s.this_month_paise)}</p>
                    <p className="text-xs text-white/30">{s.this_month_calls} calls</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'active' ? 'text-emerald-400 bg-emerald-900/30' : 'text-red-400 bg-red-900/30'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openSchool(s)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900/30">
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* School management modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
            style={{ background: '#1a2a1f', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="px-6 pt-6 pb-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <h2 className="text-base font-bold text-white">{selected.name}</h2>
                <p className="text-xs text-white/40">Balance: ₹{inr(selected.balance_paise)} · Used: ₹{inr(selected.lifetime_used_paise)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>

            <div className="p-6 space-y-5">
              {(msg || error) && (
                <div className={`px-4 py-2.5 rounded-xl text-sm ${msg ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
                  {msg || error}
                </div>
              )}

              {/* Recharge */}
              <form onSubmit={handleRecharge} className="space-y-3">
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Recharge Credits</p>
                <div className="flex gap-3">
                  <input type="number" placeholder="Amount ₹" min="1" step="0.01" value={rechargeAmount}
                    onChange={e => setRechargeAmount(e.target.value)} className={`flex-1 ${inp}`} />
                  <input type="text" placeholder="Note" value={rechargeNote}
                    onChange={e => setRechargeNote(e.target.value)} className={`flex-1 ${inp}`} />
                </div>
                <button type="submit" disabled={recharging || !rechargeAmount}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
                  {recharging ? 'Recharging...' : 'Recharge'}
                </button>
              </form>

              {/* Pricing */}
              <form onSubmit={handleSavePricing} className="space-y-3">
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Pricing Config</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Cost per call (paise)</label>
                    <input type="number" min="1" value={pricingForm.flat_cost_paise}
                      onChange={e => setPricingForm(p => ({ ...p, flat_cost_paise: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Low balance threshold (paise)</label>
                    <input type="number" min="0" value={pricingForm.low_balance_threshold_paise}
                      onChange={e => setPricingForm(p => ({ ...p, low_balance_threshold_paise: e.target.value }))} className={inp} />
                  </div>
                </div>
                <p className="text-xs text-white/30">100 paise = ₹1. Default: 5 paise/call, threshold: ₹500</p>
                <button type="submit" disabled={savingPricing}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white/80 border border-white/10 hover:bg-white/5 disabled:opacity-40">
                  {savingPricing ? 'Saving...' : 'Save Pricing'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

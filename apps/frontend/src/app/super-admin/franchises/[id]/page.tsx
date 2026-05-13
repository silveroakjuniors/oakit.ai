'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface FranchiseDetail {
  id: string;
  name: string;
  contact: Record<string, string> | null;
  wallet_balance_inr: string;
  lifetime_used_inr: string;
  lifetime_recharged_inr: string;
  schools: { id: string; name: string; status: string; balance_inr: string; blocked: boolean }[];
  admins: { id: string; name: string; email: string; mobile: string; is_active: boolean }[];
}

interface AllSchool { id: string; name: string; subdomain: string; }

type Tab = 'schools' | 'admins' | 'wallet';

export default function FranchiseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<FranchiseDetail | null>(null);
  const [allSchools, setAllSchools] = useState<AllSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('schools');
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeNote, setRechargeNote] = useState('');
  const [recharging, setRecharging] = useState(false);
  const [assignSchoolId, setAssignSchoolId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', mobile: '', password: '' });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const token = getToken();

  function load() {
    if (!token) return;
    setLoading(true);
    Promise.all([
      apiGet<FranchiseDetail>(`/api/v1/super-admin/franchises/${id}`, token),
      apiGet<AllSchool[]>('/api/v1/super-admin/schools', token),
    ]).then(([f, s]) => { setData(f); setAllSchools(s); })
      .catch(console.error).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  async function handleRecharge(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !rechargeAmount) return;
    setRecharging(true); setError(''); setMsg('');
    try {
      await apiPost(`/api/v1/super-admin/franchises/${id}/recharge`, {
        amount_inr: Number(rechargeAmount), description: rechargeNote || undefined,
      }, token);
      setMsg(`✓ Recharged ₹${rechargeAmount} successfully`);
      setRechargeAmount(''); setRechargeNote(''); load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setRecharging(false); }
  }

  async function handleAssignSchool(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !assignSchoolId) return;
    setAssigning(true); setError(''); setMsg('');
    try {
      await apiPost(`/api/v1/super-admin/franchises/${id}/assign-school`, { school_id: assignSchoolId }, token);
      setMsg('✓ School assigned'); setAssignSchoolId(''); load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setAssigning(false); }
  }

  async function handleRemoveSchool(schoolId: string) {
    if (!token || !confirm('Remove this school from the franchise?')) return;
    try {
      await apiDelete(`/api/v1/super-admin/franchises/${id}/assign-school/${schoolId}`, token);
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !adminForm.name) return;
    setCreatingAdmin(true); setError(''); setMsg('');
    try {
      await apiPost(`/api/v1/super-admin/franchises/${id}/admin`, adminForm, token);
      setMsg('✓ Franchise admin created');
      setAdminForm({ name: '', email: '', mobile: '', password: '' }); load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setCreatingAdmin(false); }
  }

  const inp = 'w-full px-3 py-2 rounded-xl border border-white/10 text-sm bg-white/5 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-emerald-400';

  if (loading) return <div className="p-8 text-white/40 text-sm">Loading...</div>;
  if (!data) return <div className="p-8 text-red-400">Franchise not found</div>;

  const unassignedSchools = allSchools.filter(s => !data.schools.find(fs => fs.id === s.id));

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={() => router.back()} className="text-sm mb-4 block" style={{ color: 'rgba(255,255,255,0.4)' }}>← Back</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{data.name}</h1>
          {data.contact?.email && <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{data.contact.email}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-emerald-400">₹{data.wallet_balance_inr}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>wallet balance</p>
        </div>
      </div>

      {(msg || error) && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm ${msg ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40' : 'bg-red-900/40 text-red-300 border border-red-700/40'}`}>
          {msg || error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5 border-b pb-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {([
          { key: 'schools', label: '🏫 Schools' },
          { key: 'admins', label: '👥 Admins' },
          { key: 'wallet', label: '💰 Wallet' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50' : 'text-white/40 hover:text-white/60'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Schools tab */}
      {tab === 'schools' && (
        <div className="space-y-4">
          {/* Assign school */}
          <form onSubmit={handleAssignSchool} className="flex gap-3">
            <select value={assignSchoolId} onChange={e => setAssignSchoolId(e.target.value)}
              className={`flex-1 ${inp} appearance-none`}>
              <option value="">Assign a school to this franchise...</option>
              {unassignedSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="submit" disabled={!assignSchoolId || assigning}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
              {assigning ? '...' : 'Assign'}
            </button>
          </form>

          {!data.schools.length ? (
            <p className="text-white/30 text-sm py-6 text-center">No schools assigned yet</p>
          ) : data.schools.map(s => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <p className="font-semibold text-white text-sm">{s.name}</p>
                <div className="flex gap-3 text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <span className={s.status === 'active' ? 'text-emerald-400' : 'text-red-400'}>{s.status}</span>
                  <span>₹{s.balance_inr} balance</span>
                  {s.blocked && <span className="text-red-400">⚠️ blocked</span>}
                </div>
              </div>
              <button onClick={() => handleRemoveSchool(s.id)}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-900/20">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Admins tab */}
      {tab === 'admins' && (
        <div className="space-y-4">
          <form onSubmit={handleCreateAdmin} className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-sm font-bold text-white/60 uppercase tracking-widest text-xs">Create Franchise Admin</p>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Full name *" value={adminForm.name}
                onChange={e => setAdminForm(p => ({ ...p, name: e.target.value }))} className={inp} />
              <input type="email" placeholder="Email" value={adminForm.email}
                onChange={e => setAdminForm(p => ({ ...p, email: e.target.value }))} className={inp} />
              <input type="tel" placeholder="Mobile" value={adminForm.mobile}
                onChange={e => setAdminForm(p => ({ ...p, mobile: e.target.value }))} className={inp} />
              <input type="password" placeholder="Password" value={adminForm.password}
                onChange={e => setAdminForm(p => ({ ...p, password: e.target.value }))} className={inp} />
            </div>
            <button type="submit" disabled={creatingAdmin || !adminForm.name}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
              {creatingAdmin ? 'Creating...' : 'Create Admin'}
            </button>
          </form>

          {!data.admins.length ? (
            <p className="text-white/30 text-sm py-4 text-center">No admins yet</p>
          ) : data.admins.map(a => (
            <div key={a.id} className="flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <p className="font-semibold text-white text-sm">{a.name}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{a.email || a.mobile}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${a.is_active ? 'text-emerald-400 bg-emerald-900/30' : 'text-red-400 bg-red-900/30'}`}>
                {a.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Wallet tab */}
      {tab === 'wallet' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Balance', value: `₹${data.wallet_balance_inr}`, color: 'text-emerald-400' },
              { label: 'Lifetime Used', value: `₹${data.lifetime_used_inr}`, color: 'text-amber-400' },
              { label: 'Lifetime Recharged', value: `₹${data.lifetime_recharged_inr}`, color: 'text-blue-400' },
            ].map(c => (
              <div key={c.label} className="rounded-2xl p-4 text-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.label}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleRecharge} className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Recharge Wallet</p>
            <div className="flex gap-3">
              <input type="number" placeholder="Amount (₹)" min="1" step="0.01" value={rechargeAmount}
                onChange={e => setRechargeAmount(e.target.value)} className={`flex-1 ${inp}`} />
              <input type="text" placeholder="Note (optional)" value={rechargeNote}
                onChange={e => setRechargeNote(e.target.value)} className={`flex-1 ${inp}`} />
            </div>
            <button type="submit" disabled={recharging || !rechargeAmount}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
              {recharging ? 'Recharging...' : 'Recharge'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

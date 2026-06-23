'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface Franchise {
  id: string;
  name: string;
  contact: Record<string, string> | null;
  total_schools: number;
  active_schools: number;
  wallet_balance_inr: string;
  lifetime_recharged_inr: string;
  blocked_schools: number;
  admin_count: number;
  created_at: string;
}

const EMPTY = { name: '', contact_email: '', contact_phone: '' };

export default function FranchisesPage() {
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const token = getToken();

  function load() {
    if (!token) return;
    setLoading(true);
    apiGet<Franchise[]>('/api/v1/super-admin/franchises', token)
      .then(setFranchises).catch(console.error).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!token) return;
    setCreating(true); setError('');
    try {
      const contact: Record<string, string> = {};
      if (form.contact_email) contact.email = form.contact_email;
      if (form.contact_phone) contact.phone = form.contact_phone;
      await apiPost('/api/v1/super-admin/franchises', {
        name: form.name.trim(),
        contact: Object.keys(contact).length ? contact : undefined,
      }, token);
      setShowCreate(false); setForm(EMPTY); load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally { setCreating(false); }
  }

  const inp = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 bg-white';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Franchises</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Manage franchise groups and their schools</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
          + New Franchise
        </button>
      </div>

      {loading ? <p className="text-white/40 text-sm">Loading...</p> : (
        <div className="space-y-3">
          {!franchises.length ? (
            <div className="rounded-2xl p-10 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-white/30 text-sm">No franchises yet. Create one to get started.</p>
            </div>
          ) : franchises.map(f => (
            <Link key={f.id} href={`/super-admin/franchises/${f.id}`}
              className="block rounded-2xl p-5 transition-all hover:scale-[1.005]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-white text-base">{f.name}</p>
                  {f.contact?.email && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{f.contact.email}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-emerald-400 font-bold text-sm">₹{f.wallet_balance_inr}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>wallet balance</p>
                </div>
              </div>
              <div className="flex gap-4 mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <span>🏫 {f.total_schools} schools ({f.active_schools} active)</span>
                <span>👥 {f.admin_count} admins</span>
                {f.blocked_schools > 0 && <span className="text-red-400">⚠️ {f.blocked_schools} blocked</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Create Franchise</h2>
              <button onClick={() => { setShowCreate(false); setError(''); setForm(EMPTY); }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Franchise Name <span className="text-red-400">*</span></label>
                <input type="text" placeholder="e.g. Silver Oak Group" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contact Email</label>
                <input type="email" placeholder="owner@franchise.com" value={form.contact_email}
                  onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contact Phone</label>
                <input type="tel" placeholder="+91 9999999999" value={form.contact_phone}
                  onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} className={inp} />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setError(''); setForm(EMPTY); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

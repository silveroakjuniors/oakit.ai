'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { apiGet, apiPost } from '@/lib/api';
import Badge from '@/components/ui/Badge';

interface School {
  id: string;
  name: string;
  subdomain: string;
  school_code: string;
  status: 'active' | 'inactive';
  plan_type: string;
  created_at: string;
}

interface CreateForm {
  name: string;
  school_type: string;
  plan_type: string;
  contact_email: string;
  contact_phone: string;
}

const SCHOOL_TYPES = [
  { value: 'preschool', label: 'Preschool / Playschool' },
  { value: 'primary', label: 'Primary School (K-5)' },
  { value: 'elementary', label: 'Elementary School' },
  { value: 'middle', label: 'Middle School' },
  { value: 'high', label: 'High School' },
  { value: 'k12', label: 'K-12 School' },
  { value: 'college', label: 'College / Junior College' },
  { value: 'university', label: 'University' },
  { value: 'coaching', label: 'Coaching / Tuition Centre' },
  { value: 'other', label: 'Other' },
];

const EMPTY_FORM: CreateForm = { name: '', school_type: 'preschool', plan_type: 'premium', contact_email: '', contact_phone: '' };

export default function SchoolListPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  function loadSchools() {
    const token = getToken();
    if (!token) return;
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    setLoading(true);
    apiGet<School[]>(`/api/v1/super-admin/schools?${params}`, token)
      .then(setSchools)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadSchools(); }, [status, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setCreateError('School name is required'); return; }
    const token = getToken();
    if (!token) return;
    setCreating(true);
    setCreateError('');
    try {
      const contact: Record<string, string> = {};
      if (form.contact_email) contact.email = form.contact_email;
      if (form.contact_phone) contact.phone = form.contact_phone;
      await apiPost('/api/v1/super-admin/schools', {
        name: form.name.trim(),
        school_type: form.school_type,
        plan_type: form.plan_type,
        contact: Object.keys(contact).length ? contact : undefined,
      }, token);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      loadSchools();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create school');
    } finally {
      setCreating(false);
    }
  }

  const inp = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 bg-white';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Schools</h1>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
          + New School
        </button>
      </div>

      <div className="flex gap-3 mb-6">
        <input type="text" placeholder="Search by name..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-white/10 rounded-xl px-3 py-2 text-sm w-64 bg-white/5 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20" />
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="border border-white/10 rounded-xl px-3 py-2 text-sm bg-white/5 text-white focus:outline-none">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <p className="text-white/40 text-sm">Loading...</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <table className="w-full text-sm">
            <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <tr>
                {['Name', 'Status', 'Plan', 'Created'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schools.map(school => (
                <tr key={school.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td className="px-4 py-3">
                    <Link href={`/super-admin/schools/${school.id}`} className="font-semibold text-emerald-400 hover:text-emerald-300">
                      {school.name}
                    </Link>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{school.subdomain}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={school.status} variant={school.status === 'active' ? 'success' : 'danger'} />
                  </td>
                  <td className="px-4 py-3 capitalize" style={{ color: 'rgba(255,255,255,0.6)' }}>{school.plan_type}</td>
                  <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.4)' }}>{new Date(school.created_at).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>No schools found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create School Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Create New School</h2>
              <button onClick={() => { setShowCreate(false); setCreateError(''); setForm(EMPTY_FORM); }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">School Name <span className="text-red-400">*</span></label>
                <input type="text" placeholder="e.g. Silver Oak Juniors" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">School Type <span className="text-red-400">*</span></label>
                <select value={form.school_type} onChange={e => setForm(p => ({ ...p, school_type: e.target.value }))}
                  className={`${inp} appearance-none`}>
                  {SCHOOL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Plan Type</label>
                <select value={form.plan_type} onChange={e => setForm(p => ({ ...p, plan_type: e.target.value }))}
                  className={`${inp} appearance-none`}>
                  <option value="premium">Premium</option>
                  <option value="basic">Basic</option>
                  <option value="trial">Trial</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contact Email</label>
                <input type="email" placeholder="admin@school.edu" value={form.contact_email}
                  onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contact Phone</label>
                <input type="tel" placeholder="+91 9999999999" value={form.contact_phone}
                  onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} className={inp} />
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                  <p className="text-sm text-red-600">{createError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setCreateError(''); setForm(EMPTY_FORM); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
                  {creating ? 'Creating...' : 'Create School'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

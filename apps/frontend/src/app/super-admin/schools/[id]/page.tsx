'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getToken, setToken, setRole } from '@/lib/auth';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

interface SchoolDetail {
  id: string;
  name: string;
  subdomain: string;
  school_code: string;
  status: 'active' | 'inactive';
  plan_type: string;
  billing_status: string;
  plan_updated_at: string | null;
  created_at: string;
  translation_enabled: boolean;
  contact: Record<string, string> | null;
}

interface SchoolUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

type Tab = 'overview' | 'users' | 'features' | 'danger';

const DARK = { bg: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };
const inp = 'w-full px-3 py-2 rounded-xl border border-white/10 text-sm bg-white/5 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-emerald-400';
const sel = 'w-full px-3 py-2 rounded-xl border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 appearance-none' as const;
const selStyle = { background: '#1a2a1f' } as const;

// ── Danger Tab ────────────────────────────────────────────────────────────────
function DangerTab({
  school,
  onMsg,
  onError,
  onReload,
}: {
  school: SchoolDetail;
  onMsg: (m: string) => void;
  onError: (m: string) => void;
  onReload: () => void;
}) {
  const token = getToken();
  const [actionLoading, setActionLoading] = useState(false);

  // Demo reset state
  const [showReset, setShowReset]         = useState(false);
  const [resetConfirm, setResetConfirm]   = useState('');
  const [resetting, setResetting]         = useState(false);
  const [resetResult, setResetResult]     = useState<{
    deleted: Record<string, number>;
    message: string;
  } | null>(null);

  async function handleResetSalaryPin() {
    if (!token || !confirm('This will clear the salary PIN for this school. The principal will need to set a new one. Continue?')) return;
    try {
      await apiDelete(`/api/v1/super-admin/schools/${school.id}/salary-pin`, token);
      onMsg('✓ Salary PIN cleared');
    } catch (e: any) { onError(e.message); }
  }

  async function handleActivate() {
    if (!token) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/v1/super-admin/schools/${school.id}/activate`, {}, token);
      onMsg('✓ School activated');
      onReload();
    } catch (e: any) { onError(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleDeactivate() {
    if (!token || !confirm('Deactivate this school? All users will lose access.')) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/v1/super-admin/schools/${school.id}/deactivate`, {}, token);
      onMsg('✓ School deactivated');
      onReload();
    } catch (e: any) { onError(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleDemoReset() {
    if (!token) return;
    setResetting(true);
    try {
      const data = await apiPost<{ deleted: Record<string, number>; message: string }>(
        `/api/v1/super-admin/schools/${school.id}/demo-reset`,
        { confirm_name: resetConfirm },
        token,
      );
      setResetResult(data);
      setResetConfirm('');
    } catch (e: any) { onError(e.message); }
    finally { setResetting(false); }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl p-5 space-y-1" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-4">Danger Zone</p>

        {/* Reset Salary PIN */}
        <div className="flex items-center justify-between py-3 border-b border-red-900/30">
          <div>
            <p className="text-sm font-semibold text-white">Reset Salary PIN</p>
            <p className="text-xs text-white/40 mt-0.5">Clears the principal's salary PIN. They'll be prompted to set a new one.</p>
          </div>
          <button onClick={handleResetSalaryPin}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-red-300 border border-red-700/50 hover:bg-red-900/30">
            Reset PIN
          </button>
        </div>

        {/* Activate / Deactivate */}
        <div className="flex items-center justify-between py-3 border-b border-red-900/30">
          <div>
            <p className="text-sm font-semibold text-white">{school.status === 'active' ? 'Deactivate School' : 'Activate School'}</p>
            <p className="text-xs text-white/40 mt-0.5">
              {school.status === 'active' ? 'All users will lose access immediately.' : 'Restore access for all users.'}
            </p>
          </div>
          {school.status === 'active' ? (
            <button onClick={handleDeactivate} disabled={actionLoading}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-red-300 border border-red-700/50 hover:bg-red-900/30 disabled:opacity-40">
              Deactivate
            </button>
          ) : (
            <button onClick={handleActivate} disabled={actionLoading}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900/30 disabled:opacity-40">
              Activate
            </button>
          )}
        </div>

        {/* Demo Reset */}
        <div className="py-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-white">🔄 Demo Reset</p>
              <p className="text-xs text-white/40 mt-0.5 max-w-sm leading-relaxed">
                Wipes all teacher activity (attendance, completions, homework, observations, feed, quizzes) while keeping setup — curriculum, plans, students, calendar, and fee structure are preserved.
              </p>
            </div>
            {!showReset && (
              <button onClick={() => setShowReset(true)}
                className="ml-4 shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-orange-300 border border-orange-700/50 hover:bg-orange-900/30">
                Reset Demo
              </button>
            )}
          </div>

          {showReset && !resetResult && (
            <div className="mt-4 rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <p className="text-xs text-red-300 font-semibold">⚠️ This cannot be undone. All teacher activity data will be permanently deleted.</p>
              <p className="text-xs text-white/50">What will be wiped:</p>
              <ul className="text-xs text-white/40 space-y-0.5 list-disc list-inside">
                <li>Attendance records</li>
                <li>Daily completions &amp; teacher streaks</li>
                <li>Homework sent &amp; submissions</li>
                <li>Observations &amp; milestones</li>
                <li>Messages, feed posts, announcements</li>
                <li>Quiz attempts</li>
                <li>Time machine (reset to real date)</li>
              </ul>
              <p className="text-xs text-white/50">What will be kept:</p>
              <ul className="text-xs text-emerald-400/70 space-y-0.5 list-disc list-inside">
                <li>School setup, users, classes, sections</li>
                <li>Curriculum &amp; day plans</li>
                <li>Students &amp; parent accounts</li>
                <li>Calendar, holidays, special days</li>
                <li>Fee structures &amp; payment history</li>
              </ul>
              <div>
                <label className="text-xs text-white/50 block mb-1">
                  Type <strong className="text-white">{school.name}</strong> to confirm
                </label>
                <input
                  value={resetConfirm}
                  onChange={e => setResetConfirm(e.target.value)}
                  placeholder={school.name}
                  className="w-full px-3 py-2 rounded-xl border border-red-700/50 text-sm bg-black/30 text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowReset(false); setResetConfirm(''); }}
                  className="flex-1 py-2 rounded-xl text-sm border border-white/10 text-white/50 hover:bg-white/5">
                  Cancel
                </button>
                <button
                  onClick={handleDemoReset}
                  disabled={resetting || resetConfirm.trim().toLowerCase() !== school.name.trim().toLowerCase()}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-red-700 hover:bg-red-600 disabled:opacity-40 transition-colors"
                >
                  {resetting ? 'Resetting…' : 'Confirm Reset'}
                </button>
              </div>
            </div>
          )}

          {resetResult && (
            <div className="mt-4 rounded-xl p-4 space-y-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <p className="text-sm font-semibold text-emerald-300">✅ Demo reset complete</p>
              <p className="text-xs text-white/50">{resetResult.message}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(resetResult.deleted)
                  .filter(([, count]) => count > 0)
                  .map(([table, count]) => (
                    <div key={table} className="flex justify-between text-xs px-2 py-1 rounded-lg bg-white/5">
                      <span className="text-white/40">{table.replace(/_/g, ' ')}</span>
                      <span className="text-white/70 font-semibold">{count}</span>
                    </div>
                  ))}
              </div>
              <button onClick={() => { setResetResult(null); setShowReset(false); }}
                className="w-full py-2 rounded-xl text-sm border border-white/10 text-white/50 hover:bg-white/5">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [users, setUsers] = useState<SchoolUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Plan edit
  const [editPlan, setEditPlan] = useState(false);
  const [planForm, setPlanForm] = useState({ name: '', plan_type: '', billing_status: '', school_code: '' });

  // User creation
  const [userForm, setUserForm] = useState({ name: '', mobile: '', email: '', role: 'admin' });
  const [creatingUser, setCreatingUser] = useState(false);

  const isImpersonating = typeof window !== 'undefined' && !!localStorage.getItem('oakit_impersonation_token');
  const token = getToken();

  function flash(m: string, isError = false) {
    if (isError) { setError(m); setMsg(''); } else { setMsg(m); setError(''); }
    setTimeout(() => { setMsg(''); setError(''); }, 4000);
  }

  function loadSchool() {
    if (!token) return;
    apiGet<SchoolDetail>(`/api/v1/super-admin/schools/${id}`, token)
      .then(s => { setSchool(s); setPlanForm({ name: s.name, plan_type: s.plan_type, billing_status: s.billing_status, school_code: s.school_code || s.subdomain }); })
      .catch(() => flash('Failed to load school', true))
      .finally(() => setLoading(false));
  }

  function loadUsers() {
    if (!token) return;
    setUsersLoading(true);
    apiGet<SchoolUser[]>(`/api/v1/super-admin/schools/${id}/users`, token)
      .then(setUsers).catch(console.error).finally(() => setUsersLoading(false));
  }

  useEffect(() => { loadSchool(); }, [id]);
  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab]);

  async function handleActivate() {
    if (!token || !school) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/v1/super-admin/schools/${id}/activate`, {}, token);
      setSchool({ ...school, status: 'active' });
      flash('✓ School activated');
    } catch (e: any) { flash(e.message, true); }
    finally { setActionLoading(false); }
  }

  async function handleDeactivate() {
    if (!token || !school || !confirm('Deactivate this school? All users will lose access.')) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/v1/super-admin/schools/${id}/deactivate`, {}, token);
      setSchool({ ...school, status: 'inactive' });
      flash('✓ School deactivated');
    } catch (e: any) { flash(e.message, true); }
    finally { setActionLoading(false); }
  }

  async function handleImpersonate() {
    if (!token) return;
    setActionLoading(true);
    try {
      const { token: scopedToken } = await apiPost<{ token: string }>(
        `/api/v1/super-admin/impersonate/${id}`, {}, token
      );
      localStorage.setItem('oakit_impersonation_token', token);
      setToken(scopedToken);
      setRole('admin');
      router.push('/admin');
    } catch (e: any) { flash(e.message, true); }
    finally { setActionLoading(false); }
  }

  async function handleExitImpersonation() {
    const originalToken = localStorage.getItem('oakit_impersonation_token');
    const currentToken = getToken();
    if (!currentToken) return;
    try { await apiPost('/api/v1/super-admin/impersonate/exit', {}, currentToken); } catch { }
    if (originalToken) {
      setToken(originalToken);
      setRole('super_admin');
      localStorage.removeItem('oakit_impersonation_token');
    }
    router.push('/super-admin');
  }

  async function handleToggleTranslation() {
    if (!token || !school) return;
    const next = !school.translation_enabled;
    try {
      await apiPatch(`/api/v1/super-admin/schools/${id}/features`, { translation_enabled: next }, token);
      setSchool({ ...school, translation_enabled: next });
      flash(`✓ Translation ${next ? 'enabled' : 'disabled'}`);
    } catch (e: any) { flash(e.message, true); }
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      await apiPatch(`/api/v1/super-admin/schools/${id}`, planForm, token);
      setSchool(s => s ? { ...s, ...planForm } as SchoolDetail : s);
      setEditPlan(false);
      flash('✓ Plan updated');
    } catch (e: any) { flash(e.message, true); }
  }

  async function handleResetSalaryPin() {
    if (!token || !confirm('This will clear the salary PIN for this school. The principal will need to set a new one. Continue?')) return;
    try {
      await apiDelete(`/api/v1/super-admin/schools/${id}/salary-pin`, token);
      flash('✓ Salary PIN cleared');
    } catch (e: any) { flash(e.message, true); }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !userForm.name || !userForm.mobile) return;
    setCreatingUser(true);
    try {
      const result = await apiPost<{ initial_password: string; role: string }>(
        `/api/v1/super-admin/schools/${id}/users`,
        { name: userForm.name, mobile: userForm.mobile, email: userForm.email || undefined, role: userForm.role },
        token
      );
      flash(`✓ ${result.role} user created. Initial password: ${result.initial_password}`);
      setUserForm({ name: '', mobile: '', email: '', role: 'admin' });
      loadUsers();
    } catch (e: any) { flash(e.message, true); }
    finally { setCreatingUser(false); }
  }

  if (loading) return <div className="p-8 text-white/40 text-sm">Loading...</div>;
  if (!school) return <div className="p-8 text-red-400">{error || 'School not found'}</div>;

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => router.back()} className="text-sm mb-4 block" style={{ color: 'rgba(255,255,255,0.4)' }}>← Back to Schools</button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{school.name}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{school.subdomain} · Created {new Date(school.created_at).toLocaleDateString('en-IN')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${school.status === 'active' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50' : 'bg-red-900/50 text-red-300 border border-red-700/50'}`}>
            {school.status}
          </span>
        </div>
      </div>

      {/* Flash messages */}
      {(msg || error) && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm ${msg ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40' : 'bg-red-900/40 text-red-300 border border-red-700/40'}`}>
          {msg || error}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        {isImpersonating ? (
          <button onClick={handleExitImpersonation}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-amber-300 border border-amber-700/50 hover:bg-amber-900/30">
            Exit Impersonation
          </button>
        ) : (
          <button onClick={handleImpersonate} disabled={actionLoading || school.status !== 'active'}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            🔑 Impersonate as Admin
          </button>
        )}
        {school.status === 'active' ? (
          <button onClick={handleDeactivate} disabled={actionLoading}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-red-300 border border-red-700/50 hover:bg-red-900/30 disabled:opacity-40">
            Deactivate
          </button>
        ) : (
          <button onClick={handleActivate} disabled={actionLoading}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900/30 disabled:opacity-40">
            Activate
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 border-b pb-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {([
          { key: 'overview', label: '📋 Overview' },
          { key: 'users', label: '👥 Users' },
          { key: 'features', label: '🔧 Features' },
          { key: 'danger', label: '⚠️ Danger Zone' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="rounded-2xl p-5 space-y-3" style={DARK}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Plan & Billing</p>
              <button onClick={() => setEditPlan(!editPlan)} className="text-xs text-emerald-400 hover:text-emerald-300">
                {editPlan ? 'Cancel' : 'Edit'}
              </button>
            </div>
            {editPlan ? (
              <form onSubmit={handleSavePlan} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-white/40 mb-1 block">School Name</label>
                    <input type="text" value={planForm.name}
                      onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))}
                      className={inp} placeholder="School name" />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">School Code (login code)</label>
                    <input type="text" value={planForm.school_code}
                      onChange={e => setPlanForm(p => ({ ...p, school_code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                      className={inp} placeholder="e.g. sojs" />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Plan Type</label>
                    <select value={planForm.plan_type} onChange={e => setPlanForm(p => ({ ...p, plan_type: e.target.value }))}
                      className={sel} style={selStyle}>
                      <option value="premium">Premium</option>
                      <option value="basic">Basic</option>
                      <option value="trial">Trial</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Billing Status</label>
                    <select value={planForm.billing_status} onChange={e => setPlanForm(p => ({ ...p, billing_status: e.target.value }))}
                      className={sel} style={selStyle}>
                      <option value="active">Active</option>
                      <option value="trial">Trial</option>
                      <option value="overdue">Overdue</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
                  Save Changes
                </button>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'School Name', value: school.name },
                  { label: 'School Code', value: school.school_code || school.subdomain },
                  { label: 'Plan', value: school.plan_type },
                  { label: 'Billing', value: school.billing_status },
                  { label: 'Contact', value: school.contact?.email || school.contact?.phone || '—' },
                  { label: 'Plan Updated', value: school.plan_updated_at ? new Date(school.plan_updated_at).toLocaleDateString('en-IN') : 'Never' },
                ].map(r => (
                  <div key={r.label}>
                    <p className="text-xs text-white/30">{r.label}</p>
                    <p className="text-sm font-semibold text-white capitalize mt-0.5">{r.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          {/* Create admin user */}
          <form onSubmit={handleCreateUser} className="rounded-2xl p-4 space-y-3" style={DARK}>
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Create User</p>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Full name *" value={userForm.name}
                onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} className={inp} />
              <input type="tel" placeholder="Mobile number *" value={userForm.mobile}
                onChange={e => setUserForm(p => ({ ...p, mobile: e.target.value }))} className={inp} />
              <input type="email" placeholder="Email (optional)" value={userForm.email}
                onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} className={inp} />
              <select value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}
                className={`${inp} appearance-none`}>
                <option value="admin">Admin</option>
                <option value="principal">Principal</option>
                <option value="teacher">Teacher</option>
                <option value="staff">Staff</option>
                <option value="accountant">Accountant</option>
              </select>
            </div>
            <p className="text-xs text-white/30">Initial password = mobile number. User will be prompted to change on first login.</p>
            <button type="submit" disabled={creatingUser || !userForm.name || !userForm.mobile}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
              {creatingUser ? 'Creating...' : `Create ${userForm.role.charAt(0).toUpperCase() + userForm.role.slice(1)}`}
            </button>
          </form>

          {/* Users list */}
          {usersLoading ? <p className="text-white/40 text-sm">Loading users...</p> : (
            <div className="rounded-2xl overflow-hidden" style={DARK}>
              <table className="w-full text-sm">
                <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <tr>
                    {['Name', 'Mobile', 'Role', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!users.length ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-white/30 text-sm">No users found</td></tr>
                  ) : users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">{u.name}</p>
                        {u.email && <p className="text-xs text-white/30">{u.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-white/60">{u.mobile || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70 capitalize">{u.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'text-emerald-400 bg-emerald-900/30' : 'text-red-400 bg-red-900/30'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Features tab */}
      {tab === 'features' && (
        <div className="rounded-2xl p-5 space-y-4" style={DARK}>
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Feature Flags</p>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-semibold text-white">🌐 Multilingual Translation</p>
              <p className="text-xs text-white/40 mt-0.5">Allow parents to use language settings in the parent portal</p>
            </div>
            <button onClick={handleToggleTranslation}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${school.translation_enabled ? 'bg-indigo-600' : 'bg-white/20'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${school.translation_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      )}

      {/* Danger zone tab */}
      {tab === 'danger' && (
        <DangerTab school={school} onMsg={setMsg} onError={setError} onReload={() => loadSchool()} />
      )}
    </div>
  );
}

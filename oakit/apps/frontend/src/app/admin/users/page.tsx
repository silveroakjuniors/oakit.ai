'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Badge, Input } from '@/components/ui';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface Section { section_id: string; section_label: string; class_name: string; }
interface User { id: string; name: string; mobile?: string; role: string; is_active: boolean; sections: Section[]; class_teacher_section?: { label: string; class_name: string } | null; }
interface Role { id: string; name: string; permissions: string[]; portal_access: string | null; }

// Grouped permissions for clarity
const PERMISSION_GROUPS: { label: string; perms: { key: string; desc: string }[] }[] = [
  {
    label: 'Admin — Full Access',
    perms: [
      { key: 'read:all',          desc: 'View all data' },
      { key: 'write:all',         desc: 'Edit all data' },
    ],
  },
  {
    label: 'Admin — Manage',
    perms: [
      { key: 'manage:users',      desc: 'Create / edit / deactivate staff' },
      { key: 'manage:classes',    desc: 'Create classes & sections, assign teachers' },
      { key: 'manage:curriculum', desc: 'Upload & manage curriculum documents' },
      { key: 'manage:calendar',   desc: 'Set holidays, special days & academic year' },
      { key: 'manage:students',   desc: 'Add / edit / import students' },
      { key: 'manage:plans',      desc: 'Generate & edit day plans' },
      { key: 'manage:activities', desc: 'Create supplementary activity pools' },
      { key: 'manage:settings',   desc: 'Change school settings & branding' },
      { key: 'manage:announcements', desc: 'Post school-wide announcements' },
    ],
  },
  {
    label: 'Reports & Dashboard',
    perms: [
      { key: 'read:dashboard',    desc: 'View admin dashboard & stats' },
      { key: 'read:reports',      desc: 'View coverage & attendance reports' },
      { key: 'read:students',     desc: 'View student list & profiles' },
    ],
  },
  {
    label: 'Teacher',
    perms: [
      { key: 'read:own_plan',     desc: 'View own daily plan' },
      { key: 'write:coverage_log',desc: 'Mark topics as covered' },
      { key: 'mark:attendance',   desc: 'Submit class attendance' },
      { key: 'query:ai',          desc: 'Use Oakie AI assistant' },
      { key: 'write:notes',       desc: 'Post homework & notes for parents' },
      { key: 'write:observations',desc: 'Record student observations' },
      { key: 'write:milestones',  desc: 'Log student milestones' },
      { key: 'write:messages',    desc: 'Message parents' },
    ],
  },
  {
    label: 'Principal / Management',
    perms: [
      { key: 'read:all_sections',     desc: 'View all sections & attendance' },
      { key: 'read:coverage',         desc: 'View curriculum coverage across school' },
      { key: 'read:teacher_activity', desc: 'View teacher engagement & streaks' },
      { key: 'read:audit',            desc: 'View audit log — uploads & communications' },
    ],
  },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.key));

// Preset role templates for common school roles
const ROLE_PRESETS: { label: string; name: string; portal_access: string; permissions: string[] }[] = [
  {
    label: 'Accountant',
    name: 'Accountant',
    portal_access: 'admin',
    permissions: ['read:dashboard', 'read:reports', 'read:students', 'read:all'],
  },
  {
    label: 'Center Head',
    name: 'Center Head',
    portal_access: 'principal',
    permissions: ['read:all', 'read:dashboard', 'read:reports', 'read:all_sections', 'read:coverage', 'read:teacher_activity', 'read:audit', 'query:ai'],
  },
  {
    label: 'Coordinator',
    name: 'Coordinator',
    portal_access: 'admin',
    permissions: ['read:all', 'read:dashboard', 'read:reports', 'manage:plans', 'manage:calendar', 'manage:curriculum', 'manage:students', 'manage:announcements'],
  },
  {
    label: 'Vice Principal',
    name: 'Vice Principal',
    portal_access: 'principal',
    permissions: ['read:all', 'read:dashboard', 'read:reports', 'read:all_sections', 'read:coverage', 'read:teacher_activity', 'read:audit', 'manage:announcements', 'query:ai'],
  },
];

function RoleModal({ role, onClose, onSaved, token }: {
  role: Role | null; onClose: () => void; onSaved: () => void; token: string;
}) {
  const [name, setName] = useState(role?.name || '');
  const [perms, setPerms] = useState<string[]>(role?.permissions || []);
  const [portalAccess, setPortalAccess] = useState<string>(role?.portal_access || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function togglePerm(p: string) {
    setPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  function applyPreset(preset: typeof ROLE_PRESETS[0]) {
    setName(preset.name);
    setPortalAccess(preset.portal_access);
    setPerms(preset.permissions);
  }

  async function save() {
    if (!name.trim()) { setError('Role name is required'); return; }
    setLoading(true); setError('');
    try {
      const body = { name, permissions: perms, portal_access: portalAccess || null };
      if (role) {
        await fetch(`${API_BASE}/api/v1/admin/users/roles/${role.id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await apiPost('/api/v1/admin/users/roles', body, token);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{role ? 'Edit Role' : 'Create Role'}</h2>
        <div className="flex flex-col gap-4">

          {/* Quick presets — only when creating */}
          {!role && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Quick presets</p>
              <div className="flex flex-wrap gap-2">
                {ROLE_PRESETS.map(p => (
                  <button key={p.label} type="button" onClick={() => applyPreset(p)}
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Input label="Role Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Center Head, Accountant" />

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Portal Access</label>
            <select
              value={portalAccess}
              onChange={e => setPortalAccess(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Use role name (default)</option>
              <option value="admin">Admin Portal</option>
              <option value="principal">Principal Portal</option>
              <option value="teacher">Teacher Portal</option>
              <option value="parent">Parent Portal</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Set this if the role name doesn't match a portal. E.g. "Center Head" → Principal Portal, "Accountant" → Admin Portal.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Permissions</p>
            <div className="flex flex-col gap-4">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{group.label}</p>
                  <div className="grid grid-cols-1 gap-1">
                    {group.perms.map(p => (
                      <label key={p.key} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        perms.includes(p.key) ? 'bg-primary/5 border border-primary/20' : 'hover:bg-gray-50 border border-transparent'
                      }`}>
                        <input type="checkbox" checked={perms.includes(p.key)} onChange={() => togglePerm(p.key)}
                          className="rounded border-gray-300 text-primary focus:ring-primary shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-gray-700 font-mono">{p.key}</span>
                          <span className="text-xs text-gray-400 ml-2">{p.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button loading={loading} onClick={save} className="flex-1">{role ? 'Save' : 'Create'}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AddUserModal({ roles, onClose, onSaved, token }: {
  roles: Role[]; onClose: () => void; onSaved: () => void; token: string;
}) {
  const [form, setForm] = useState({ name: '', mobile: '', role_name: roles[0]?.name || '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function save() {
    if (!form.name || !form.mobile || !form.role_name) { setError('All fields required'); return; }
    if (!/^\d{10}$/.test(form.mobile)) { setError('Mobile must be 10 digits'); return; }
    setLoading(true); setError('');
    try {
      const res = await apiPost<{ message: string }>('/api/v1/admin/users', form, token);
      setSuccess(res.message || 'User created. Initial password is their mobile number.');
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <Card className="w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Add User</h2>
        {success ? (
          <div className="flex flex-col gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">{success}</div>
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Input label="Full Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" />
            <Input label="Mobile Number" type="tel" value={form.mobile}
              onChange={e => setForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
              placeholder="10-digit mobile" inputMode="numeric" />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Role</label>
              <select className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.role_name} onChange={e => setForm(f => ({ ...f, role_name: e.target.value }))}>
                {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </div>
            <p className="text-xs text-gray-400">Initial password will be the mobile number. User must change it on first login.</p>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2 mt-1">
              <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
              <Button loading={loading} onClick={save} className="flex-1">Create User</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [showAddUser, setShowAddUser] = useState(false);
  const [editRole, setEditRole] = useState<Role | null | 'new'>(null);
  const [changingRole, setChangingRole] = useState<{ userId: string; current: string } | null>(null);
  const token = getToken() || '';

  async function load() {
    try {
      const [u, r] = await Promise.all([
        apiGet<User[]>('/api/v1/admin/users', token),
        apiGet<Role[]>('/api/v1/admin/users/roles', token),
      ]);
      setUsers(u);
      setRoles(r);
    } catch (err) { console.error(err); }
  }

  useEffect(() => { load(); }, []);

  async function resetPassword(id: string, name: string) {
    if (!confirm(`Reset password for ${name} to their mobile number?`)) return;
    const res = await fetch(`${API_BASE}/api/v1/admin/users/${id}/reset-password`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    alert(d.message || d.error);
  }

  async function deactivate(id: string) {
    if (!confirm('Deactivate this user?')) return;
    await fetch(`${API_BASE}/api/v1/admin/users/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  }

  async function changeRole(userId: string, role_name: string) {
    await fetch(`${API_BASE}/api/v1/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_name }),
    });
    setChangingRole(null);
    await load();
  }

  async function deleteRole(id: string) {
    if (!confirm('Delete this role?')) return;
    const res = await fetch(`${API_BASE}/api/v1/admin/users/roles/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    await load();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-primary">Users & Roles</h1>
        <div className="flex gap-2">
          {tab === 'users' && <Button onClick={() => setShowAddUser(true)} size="sm">+ Add User</Button>}
          {tab === 'roles' && <Button onClick={() => setEditRole('new')} size="sm">+ Create Role</Button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(['users', 'roles'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>{t}</button>
        ))}
      </div>

      {tab === 'users' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="pb-3 pr-4 font-medium">Name</th>
                  <th className="pb-3 pr-4 font-medium">Mobile</th>
                  <th className="pb-3 pr-4 font-medium">Role</th>
                  <th className="pb-3 pr-4 font-medium">Class Teacher Of</th>
                  <th className="pb-3 pr-4 font-medium">Supporting In</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 pr-4 font-medium text-gray-800">{u.name}</td>
                    <td className="py-3 pr-4 text-gray-500">{u.mobile || '—'}</td>
                    <td className="py-3 pr-4">
                      {changingRole?.userId === u.id ? (
                        <select className="text-xs border border-gray-300 rounded px-2 py-1"
                          defaultValue={u.role}
                          onChange={e => changeRole(u.id, e.target.value)}
                          onBlur={() => setChangingRole(null)}>
                          {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                        </select>
                      ) : (
                        <button onClick={() => setChangingRole({ userId: u.id, current: u.role })}
                          className="group flex items-center gap-1">
                          <Badge label={u.role} variant={u.role === 'admin' ? 'info' : u.role === 'principal' ? 'warning' : 'neutral'} />
                          <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100">✏️</span>
                        </button>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs text-gray-600">
                      {u.class_teacher_section
                        ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{u.class_teacher_section.class_name} – {u.class_teacher_section.label}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-gray-500 text-xs">
                      {u.sections.length > 0
                        ? u.sections.map(s => `${s.class_name}-${s.section_label}`).join(', ')
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3">
                      <Badge label={u.is_active ? 'Active' : 'Inactive'} variant={u.is_active ? 'success' : 'danger'} />
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        {u.mobile && (
                          <Button variant="ghost" size="sm" onClick={() => resetPassword(u.id, u.name)}>Reset Password</Button>
                        )}
                        {u.is_active && (
                          <Button variant="danger" size="sm" onClick={() => deactivate(u.id)}>Deactivate</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">No users yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'roles' && (
        <div className="flex flex-col gap-3">
          {roles.map(role => (
            <Card key={role.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-800 capitalize">{role.name}</p>
                    {role.portal_access && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        → {role.portal_access} portal
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(role.permissions || []).map(p => (
                      <span key={p} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p}</span>
                    ))}
                    {(!role.permissions || role.permissions.length === 0) && (
                      <span className="text-xs text-gray-400">No permissions</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 ml-4">
                  <Button size="sm" variant="ghost" onClick={() => setEditRole(role)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => deleteRole(role.id)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
          {roles.length === 0 && (
            <Card className="text-center py-8 text-gray-400">No roles yet</Card>
          )}
        </div>
      )}

      {showAddUser && (
        <AddUserModal roles={roles} token={token} onClose={() => setShowAddUser(false)} onSaved={load} />
      )}
      {editRole && (
        <RoleModal
          role={editRole === 'new' ? null : editRole}
          token={token}
          onClose={() => setEditRole(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { API_BASE } from '@/lib/api';

interface StaffUser {
  id: string;
  name: string;
  role: string;
  financial_permissions: Record<string, boolean> | null;
}

// All assignable permissions with labels and grouping
const PERMISSION_GROUPS = [
  {
    label: 'Fee Management',
    perms: [
      { key: 'VIEW_FEES',            label: 'View Fees & Invoices' },
      { key: 'COLLECT_PAYMENT',      label: 'Collect Payments' },
      { key: 'MANAGE_FEE_STRUCTURE', label: 'Create / Edit Fee Structures' },
      { key: 'SEND_REMINDER',        label: 'Send Payment Reminders' },
    ],
  },
  {
    label: 'Concessions',
    perms: [
      { key: 'MANAGE_CONCESSION',  label: 'Create Concessions' },
      { key: 'APPROVE_CONCESSION', label: 'Approve / Reject Concessions' },
    ],
  },
  {
    label: 'Expenses',
    perms: [
      { key: 'VIEW_EXPENSE', label: 'View Expenses' },
      { key: 'ADD_EXPENSE',  label: 'Add / Edit Expenses' },
    ],
  },
  {
    label: 'Reconciliation',
    perms: [
      { key: 'VIEW_RECONCILIATION',    label: 'View Reconciliation' },
      { key: 'PERFORM_RECONCILIATION', label: 'Perform Reconciliation' },
    ],
  },
  {
    label: 'Salary (PIN-protected)',
    perms: [
      { key: 'VIEW_SALARY',  label: 'View Salary Records' },
      { key: 'EDIT_SALARY',  label: 'Edit Salary Configurations' },
      { key: 'PUSH_PAYSLIP', label: 'Release Payslips to Staff' },
    ],
  },
  {
    label: 'Reports',
    perms: [
      { key: 'VIEW_REPORTS', label: 'View Financial Reports' },
      { key: 'VIEW_PROFIT',  label: 'View Profit & Loss' },
    ],
  },
];

// Default permissions per role (mirrors backend DEFAULT_ROLE_PERMISSIONS)
const ROLE_DEFAULTS: Record<string, string[]> = {
  admin: ['VIEW_FEES', 'COLLECT_PAYMENT', 'MANAGE_FEE_STRUCTURE', 'MANAGE_CONCESSION', 'VIEW_REPORTS', 'SEND_REMINDER'],
  finance_manager: ['VIEW_FEES', 'COLLECT_PAYMENT', 'MANAGE_FEE_STRUCTURE', 'VIEW_EXPENSE', 'ADD_EXPENSE', 'MANAGE_CONCESSION', 'APPROVE_CONCESSION', 'VIEW_RECONCILIATION', 'PERFORM_RECONCILIATION', 'VIEW_REPORTS', 'SEND_REMINDER'],
  teacher: [],
};

function getEffectivePerms(user: StaffUser): Set<string> {
  const defaults = new Set(ROLE_DEFAULTS[user.role] || []);
  const overrides = user.financial_permissions || {};
  // Apply overrides
  Object.entries(overrides).forEach(([perm, granted]) => {
    if (granted) defaults.add(perm);
    else defaults.delete(perm);
  });
  return defaults;
}

export default function FinancePermissionsPage() {
  const token = getToken() || '';
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [editPerms, setEditPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    apiGet<StaffUser[]>('/api/v1/financial/staff', token)
      .then(data => setStaff(Array.isArray(data) ? data : []))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  }, []);

  function openEdit(user: StaffUser) {
    setSelectedUser(user);
    setEditPerms(getEffectivePerms(user));
    setSaveMsg('');
  }

  function togglePerm(key: string) {
    setEditPerms(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    if (!selectedUser) return;
    setSaving(true);
    setSaveMsg('');
    try {
      // Build override map: compare against role defaults
      const defaults = new Set(ROLE_DEFAULTS[selectedUser.role] || []);
      const allPerms = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.key));
      const overrides: Record<string, boolean> = {};
      allPerms.forEach(key => {
        const inDefaults = defaults.has(key);
        const inEdit = editPerms.has(key);
        if (inEdit !== inDefaults) overrides[key] = inEdit;
      });

      const res = await fetch(`${API_BASE}/api/v1/financial/permissions/${selectedUser.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: overrides }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update local state
      setStaff(prev => prev.map(u =>
        u.id === selectedUser.id
          ? { ...u, financial_permissions: overrides }
          : u
      ));
      setSaveMsg('✓ Permissions saved');
      setSelectedUser(prev => prev ? { ...prev, financial_permissions: overrides } : null);
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    if (!selectedUser) return;
    setEditPerms(new Set(ROLE_DEFAULTS[selectedUser.role] || []));
    setSaveMsg('');
  }

  const roleLabel: Record<string, string> = {
    admin: 'Admin',
    finance_manager: 'Accountant',
    teacher: 'Teacher',
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-800">Finance Permissions</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Assign financial access to staff. Only you (Principal) can change these.
        </p>
      </div>

      {/* Info box */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6 text-xs text-amber-800 leading-relaxed">
        <p className="font-semibold mb-1">Default access by role:</p>
        <ul className="space-y-0.5 list-disc pl-4">
          <li><strong>Admin</strong> — fee collection, fee structures, create concessions, reports</li>
          <li><strong>Accountant</strong> — all of admin + expenses, approve concessions, reconciliation</li>
          <li><strong>Salary</strong> — no one by default; you must explicitly grant it</li>
        </ul>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400 py-8 text-center">Loading staff…</p>
      ) : (
        <div className="space-y-2">
          {staff.map(user => {
            const effective = getEffectivePerms(user);
            const hasOverrides = user.financial_permissions && Object.keys(user.financial_permissions).length > 0;
            return (
              <div
                key={user.id}
                className="bg-white rounded-2xl border border-neutral-100 shadow-sm px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-neutral-800">{user.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                      {roleLabel[user.role] || user.role}
                    </span>
                    {hasOverrides && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    {effective.size} permission{effective.size !== 1 ? 's' : ''} active
                    {effective.has('VIEW_SALARY') && <span className="ml-2 text-amber-600 font-medium">· Salary access</span>}
                  </p>
                </div>
                <button
                  onClick={() => openEdit(user)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium shrink-0"
                >
                  Edit
                </button>
              </div>
            );
          })}
          {staff.length === 0 && (
            <p className="text-sm text-neutral-400 py-8 text-center">No staff found</p>
          )}
        </div>
      )}

      {/* Edit modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-y-auto max-h-[90vh] shadow-2xl">
            <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-neutral-800">{selectedUser.name}</h2>
                <p className="text-xs text-neutral-400">{roleLabel[selectedUser.role] || selectedUser.role}</p>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-neutral-400 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100">✕</button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {PERMISSION_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">{group.label}</p>
                  <div className="space-y-1.5">
                    {group.perms.map(perm => (
                      <label
                        key={perm.key}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100 cursor-pointer hover:bg-neutral-100 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={editPerms.has(perm.key)}
                          onChange={() => togglePerm(perm.key)}
                          className="rounded accent-emerald-600"
                        />
                        <span className="text-sm text-neutral-700">{perm.label}</span>
                        {perm.key.includes('SALARY') && (
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">PIN</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {saveMsg && (
                <p className={`text-xs px-3 py-2 rounded-xl ${saveMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {saveMsg}
                </p>
              )}

              <div className="flex gap-2 pb-2">
                <button
                  onClick={resetToDefaults}
                  className="flex-1 py-2.5 rounded-xl text-sm border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                >
                  Reset to defaults
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

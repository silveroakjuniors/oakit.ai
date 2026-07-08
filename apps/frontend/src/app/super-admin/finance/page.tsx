'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPut } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface SchoolFinanceSummary {
  school_id: string;
  school_name: string;
  is_enabled: boolean;
  expense_module_enabled: boolean;
}

interface School {
  id: string;
  name: string;
}

export default function SuperAdminFinancePage() {
  const token = getToken() || '';
  const [schools, setSchools] = useState<SchoolFinanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadSchools();
  }, []);

  async function loadSchools() {
    setLoading(true);
    try {
      const data = await apiGet<School[]>('/api/v1/super-admin/schools', token);
      // For each school, fetch financial settings
      const summaries = await Promise.all(
        (Array.isArray(data) ? data : []).map(async (school) => {
          try {
            // We call the settings endpoint impersonating the school context
            // The super_admin bypasses the financial module guard
            const settings = await apiGet<{ is_enabled: boolean; expense_module_enabled: boolean }>(
              `/api/v1/financial/settings`,
              token
            );
            return {
              school_id: school.id,
              school_name: school.name,
              is_enabled: settings.is_enabled ?? true,
              expense_module_enabled: settings.expense_module_enabled ?? true,
            };
          } catch {
            return {
              school_id: school.id,
              school_name: school.name,
              is_enabled: true,
              expense_module_enabled: true,
            };
          }
        })
      );
      setSchools(summaries);
    } catch {
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleModule(schoolId: string, field: 'is_enabled' | 'expense_module_enabled', value: boolean) {
    setSaving(schoolId + field);
    setMsg('');
    try {
      await apiPut('/api/v1/financial/settings', {
        school_id: schoolId,
        [field]: value,
      }, token);
      setSchools(prev => prev.map(s =>
        s.school_id === schoolId ? { ...s, [field]: value } : s
      ));
      setMsg('✓ Updated');
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-800">Financial Module Control</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Enable or disable the financial module and expense sub-module per school.
        </p>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-xl text-sm ${msg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-400 py-12 text-center">Loading schools…</p>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wide">School</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Financial Module</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Expense Module</th>
              </tr>
            </thead>
            <tbody>
              {schools.map(school => (
                <tr key={school.school_id} className="border-b border-neutral-50 hover:bg-neutral-50">
                  <td className="py-3 px-4 font-medium text-neutral-800">{school.school_name}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => toggleModule(school.school_id, 'is_enabled', !school.is_enabled)}
                      disabled={saving === school.school_id + 'is_enabled'}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        school.is_enabled ? 'bg-emerald-500' : 'bg-neutral-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        school.is_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                    <span className={`ml-2 text-xs font-medium ${school.is_enabled ? 'text-emerald-600' : 'text-neutral-400'}`}>
                      {school.is_enabled ? 'On' : 'Off'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => toggleModule(school.school_id, 'expense_module_enabled', !school.expense_module_enabled)}
                      disabled={!school.is_enabled || saving === school.school_id + 'expense_module_enabled'}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 ${
                        school.expense_module_enabled && school.is_enabled ? 'bg-emerald-500' : 'bg-neutral-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        school.expense_module_enabled && school.is_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                    <span className={`ml-2 text-xs font-medium ${school.expense_module_enabled && school.is_enabled ? 'text-emerald-600' : 'text-neutral-400'}`}>
                      {school.expense_module_enabled && school.is_enabled ? 'On' : 'Off'}
                    </span>
                  </td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-neutral-400">No schools found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
        <p className="font-semibold mb-1">Access rules:</p>
        <ul className="space-y-0.5 list-disc pl-4">
          <li>Disabling the Financial Module blocks all financial routes for that school</li>
          <li>Disabling the Expense Module hides expenses from all roles in that school</li>
          <li>Super Admin and Franchise Admin bypass the module guard</li>
          <li>Individual school data (transactions, salaries) is not accessible from here</li>
        </ul>
      </div>
    </div>
  );
}

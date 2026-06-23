'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPut } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface PortalConfig {
  class_id: string;
  class_name: string;
  enabled: boolean;
  enabled_at: string | null;
  updated_at: string | null;
}

export default function StudentPortalPage() {
  const [configs, setConfigs] = useState<PortalConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const token = getToken();

  useEffect(() => {
    if (!token) return;
    apiGet<PortalConfig[]>('/api/v1/admin/student-portal/config', token)
      .then(setConfigs).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  async function toggle(classId: string, enabled: boolean) {
    if (!token) return;
    setSaving(classId);
    try {
      await apiPut(`/api/v1/admin/student-portal/config/${classId}`, { enabled }, token);
      setConfigs(prev => prev.map(c => c.class_id === classId ? { ...c, enabled, enabled_at: enabled ? new Date().toISOString() : c.enabled_at } : c));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(null);
    }
  }

  const enabledCount = configs.filter(c => c.enabled).length;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Student Portal</h1>
        <p className="text-sm text-gray-500 mt-1">Enable or disable the student portal for each class</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-5">
        <p className="text-xs text-blue-800">
          ℹ️ When enabled, students in that class can log in to view their feed, quizzes, and homework. 
          Disable to restrict access for a class.
        </p>
      </div>

      {!loading && (
        <div className="flex gap-3 mb-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-center flex-1">
            <p className="text-2xl font-bold text-emerald-700">{enabledCount}</p>
            <p className="text-xs text-gray-500">Classes Enabled</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-center flex-1">
            <p className="text-2xl font-bold text-gray-700">{configs.length - enabledCount}</p>
            <p className="text-xs text-gray-500">Classes Disabled</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : !configs.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">No classes found</div>
      ) : (
        <div className="space-y-2">
          {configs.map(c => (
            <div key={c.class_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{c.class_name}</p>
                {c.enabled && c.enabled_at && (
                  <p className="text-xs text-gray-400">
                    Enabled {new Date(c.enabled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
                {!c.enabled && <p className="text-xs text-gray-400">Portal disabled</p>}
              </div>
              <button
                onClick={() => toggle(c.class_id, !c.enabled)}
                disabled={saving === c.class_id}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                  c.enabled ? 'bg-emerald-500' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  c.enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

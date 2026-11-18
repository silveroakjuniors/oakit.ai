'use client';

import { useState, useEffect } from 'react';
import { apiGet, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Loader2, Share2 } from 'lucide-react';

interface School { id: string; name: string; social_media_enabled?: boolean; }

export default function SuperAdminSocialMediaPage() {
  const token = getToken() || '';
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet<School[]>('/api/v1/super-admin/schools', token);
      setSchools(Array.isArray(data) ? data : []);
    } catch { setSchools([]); }
    finally { setLoading(false); }
  }

  async function toggle(schoolId: string, current: boolean) {
    setSaving(schoolId); setMsg('');
    try {
      await fetch(`${API_BASE}/api/v1/super-admin/schools/${schoolId}/features`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ social_media_enabled: !current }),
      });
      setSchools(prev => prev.map(s => s.id === schoolId ? { ...s, social_media_enabled: !current } : s));
      setMsg('Updated');
    } catch { setMsg('Failed'); }
    finally { setSaving(null); }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Share2 className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Social Media Publisher</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Enable the paid Social Media Publisher module per school.</p>
        </div>
      </div>

      {msg && <div className={`mb-4 px-4 py-2 rounded-xl text-sm ${msg === 'Updated' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wide">School</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Social Media Module</th>
              </tr>
            </thead>
            <tbody>
              {schools.map(school => {
                const enabled = school.social_media_enabled ?? false;
                return (
                  <tr key={school.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                    <td className="py-3 px-4 font-medium text-neutral-800">{school.name}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => toggle(school.id, enabled)}
                        disabled={saving === school.id}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${enabled ? 'bg-emerald-500' : 'bg-neutral-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <span className={`ml-2 text-xs font-medium ${enabled ? 'text-emerald-600' : 'text-neutral-400'}`}>
                        {enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {schools.length === 0 && (
                <tr><td colSpan={2} className="py-12 text-center text-neutral-400">No schools found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

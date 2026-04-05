'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPut } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { applyBrandColor, saveTagline } from '@/lib/branding';

interface Settings {
  school_name: string;
  subdomain: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  notes_expiry_days: number;
  logo_url: string | null;
  primary_color: string;
  tagline: string;
}

export default function SettingsPage() {
  const token = getToken() || '';
  const [settings, setSettings] = useState<Settings>({
    school_name: '', subdomain: '', contact_email: '',
    contact_phone: '', contact_address: '', notes_expiry_days: 14,
    logo_url: null, primary_color: '#1A3C2E', tagline: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    apiGet<Settings>('/api/v1/admin/settings', token)
      .then(s => { setSettings(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function save() {
    setError(''); setSaving(true);
    try {
      const updated = await apiPut<Settings>('/api/v1/admin/settings', settings, token);
      setSettings(updated);
      if (updated.primary_color) applyBrandColor(updated.primary_color);
      if (updated.tagline !== undefined) saveTagline(updated.tagline || '');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setError(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  }

  async function uploadLogo(file: File) {
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be under 2 MB'); return; }
    setUploadingLogo(true); setError('');
    try {
      const fd = new FormData(); fd.append('logo', file);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/settings/logo`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettings(s => ({ ...s, logo_url: data.logo_url }));
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { setError(e.message || 'Logo upload failed'); }
    finally { setUploadingLogo(false); }
  }

  const field = (label: string, key: keyof Settings, type = 'text', placeholder = '', hint?: string) => (
    <div>
      <label className="text-xs font-medium text-neutral-600 mb-1 block">{label}</label>
      <input
        type={type}
        value={String(settings[key])}
        placeholder={placeholder}
        onChange={e => setSettings(s => ({ ...s, [key]: type === 'number' ? parseInt(e.target.value) || 0 : e.target.value }))}
        className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-primary-400 transition-colors"
      />
      {hint && <p className="text-xs text-neutral-400 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="p-5 lg:p-7 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Manage your school profile and configuration</p>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading...</p>
      ) : (
        <div className="space-y-5">
          {/* School Profile */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
              <p className="text-sm font-semibold text-neutral-800">🏫 School Profile</p>
              <p className="text-xs text-neutral-500 mt-0.5">This information appears on reports and parent communications</p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('School Name', 'school_name', 'text', 'e.g. Silveroak Juniors')}
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">School Code (subdomain)</label>
                <input value={settings.subdomain} disabled
                  className="w-full px-3 py-2.5 border border-neutral-100 rounded-xl text-sm bg-neutral-50 text-neutral-400 cursor-not-allowed" />
                <p className="text-xs text-neutral-400 mt-1">Cannot be changed after setup</p>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
              <p className="text-sm font-semibold text-neutral-800">📞 Contact Details</p>
              <p className="text-xs text-neutral-500 mt-0.5">Used in reports and parent-facing communications</p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('Contact Email', 'contact_email', 'email', 'admin@school.edu')}
              {field('Contact Phone', 'contact_phone', 'tel', '+91 98765 43210')}
              <div className="sm:col-span-2">
                {field('School Address', 'contact_address', 'text', '123 School Road, City, State - 560001')}
              </div>
            </div>
          </div>

          {/* Branding */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
              <p className="text-sm font-semibold text-neutral-800">🎨 Branding</p>
              <p className="text-xs text-neutral-500 mt-0.5">School logo and visual identity used in reports and communications</p>
            </div>
            <div className="p-5 space-y-4">
              {/* Logo upload */}
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-2 block">School Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-neutral-200 flex items-center justify-center bg-neutral-50 overflow-hidden shrink-0">
                    {settings.logo_url ? (
                      <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${settings.logo_url}`}
                        alt="School logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="text-2xl">🏫</span>
                    )}
                  </div>
                  <div>
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-neutral-200 rounded-xl text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
                      {uploadingLogo ? '⏳ Uploading...' : '📷 Upload Logo'}
                      <input type="file" accept="image/jpeg,image/png,image/svg+xml,image/webp" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
                    </label>
                    <p className="text-xs text-neutral-400 mt-1.5">JPEG, PNG, SVG or WebP · Max 2 MB</p>
                    <p className="text-xs text-neutral-400">Recommended: 200×200px square</p>
                  </div>
                </div>
              </div>

              {/* Tagline */}
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">School Tagline</label>
                <input value={settings.tagline} onChange={e => setSettings(s => ({ ...s, tagline: e.target.value }))}
                  placeholder="e.g. Nurturing Young Minds Since 2010"
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-primary-400" />
                <p className="text-xs text-neutral-400 mt-1">Appears on reports and login page</p>
              </div>

              {/* Primary color */}
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-2 block">Brand Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={settings.primary_color}
                    onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))}
                    className="w-12 h-10 rounded-xl border border-neutral-200 cursor-pointer p-0.5" />
                  <input value={settings.primary_color} onChange={e => setSettings(s => ({ ...s, primary_color: e.target.value }))}
                    placeholder="#1A3C2E" maxLength={7}
                    className="w-32 px-3 py-2.5 border border-neutral-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                  <div className="flex gap-2">
                    {['#1A3C2E', '#1e40af', '#7c3aed', '#b45309', '#dc2626'].map(c => (
                      <button key={c} onClick={() => setSettings(s => ({ ...s, primary_color: c }))}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${settings.primary_color === c ? 'border-neutral-800 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }} title={c} />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-neutral-400 mt-1">Used for headers and accents across all portals</p>
              </div>
            </div>
          </div>

          {/* App Settings */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
              <p className="text-sm font-semibold text-neutral-800">⚙️ App Settings</p>
            </div>
            <div className="p-5">
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">
                  Teacher Notes Expiry
                  <span className="text-neutral-400 font-normal ml-1">(days)</span>
                </label>
                <p className="text-xs text-neutral-400 mb-2">How long teacher notes and file attachments are kept before auto-deletion. Parents are warned when notes are close to expiry.</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number" min={1} max={365}
                    value={settings.notes_expiry_days}
                    onChange={e => setSettings(s => ({ ...s, notes_expiry_days: parseInt(e.target.value) || 14 }))}
                    className="w-24 px-3 py-2.5 border border-neutral-200 rounded-xl text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <span className="text-sm text-neutral-500">days</span>
                  <div className="flex gap-2 ml-2">
                    {[7, 14, 30, 60].map(d => (
                      <button key={d} onClick={() => setSettings(s => ({ ...s, notes_expiry_days: d }))}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          settings.notes_expiry_days === d
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'border-neutral-200 text-neutral-600 hover:border-primary-300'
                        }`}>
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center justify-between">
            <div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {saved && <p className="text-sm text-green-600 font-medium">✓ Settings saved successfully</p>}
            </div>
            <button onClick={save} disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors min-h-[44px]">
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

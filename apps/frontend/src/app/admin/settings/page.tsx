'use client';

import { useState, useEffect } from 'react';
import { API_BASE, apiGet, apiPut, apiPost } from '@/lib/api';
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

interface PortalClass {
  class_id: string;
  class_name: string;
  enabled: boolean;
  enabled_at: string | null;
}

interface StudentAccount {
  student_id: string;
  student_name: string;
  username: string | null;
  has_account: boolean;
  force_password_reset: boolean;
}

function StudentPortalSection({ token }: { token: string }) {
  const [classes, setClasses] = useState<PortalClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    apiGet<PortalClass[]>('/api/v1/admin/student-portal/config', token)
      .then(d => { setClasses(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function toggle(classId: string, current: boolean) {
    setToggling(classId); setMsg('');
    try {
      await apiPut(`/api/v1/admin/student-portal/config/${classId}`, { enabled: !current }, token);
      setClasses(prev => prev.map(c => c.class_id === classId ? { ...c, enabled: !current } : c));
      setMsg(!current ? '✓ Student portal enabled' : '✓ Student portal disabled');
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) { setMsg(e.message || 'Failed'); }
    finally { setToggling(null); }
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100 bg-emerald-50/50">
        <p className="text-sm font-semibold text-neutral-800">🎓 Student Portal</p>
        <p className="text-xs text-neutral-500 mt-0.5">
          Enable the student portal for specific classes. Students in enabled classes can log in at <strong>/student/login</strong>.
        </p>
      </div>
      <div className="p-5">
        {loading ? (
          <p className="text-sm text-neutral-400">Loading classes...</p>
        ) : classes.length === 0 ? (
          <p className="text-sm text-neutral-400">No classes found. Add classes first.</p>
        ) : (
          <div className="space-y-2">
            {classes.map(c => (
              <div key={c.class_id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-100 bg-neutral-50/50">
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{c.class_name}</p>
                  {c.enabled && c.enabled_at && (
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Enabled since {new Date(c.enabled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => toggle(c.class_id, c.enabled)}
                  disabled={toggling === c.class_id}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${c.enabled ? 'bg-emerald-500' : 'bg-neutral-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${c.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
        )}
        {msg && <p className={`text-xs mt-3 ${msg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</p>}
      </div>
    </div>
  );
}

function StudentCredentialsSection({ token }: { token: string }) {
  const [sections, setSections] = useState<{ section_id: string; section_label: string; class_name: string }[]>([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [students, setStudents] = useState<StudentAccount[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [results, setResults] = useState<{ student_id: string; username: string; password: string; is_new: boolean }[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    apiGet<any[]>('/api/v1/teacher/sections', token)
      .then(d => setSections(d))
      .catch(() => {});
  }, []);

  async function loadStudents(sectionId: string) {
    setLoadingStudents(true); setStudents([]); setResults([]);
    try {
      const data = await apiGet<StudentAccount[]>(`/api/v1/teacher/students/credentials/${sectionId}`, token);
      setStudents(data);
    } catch (e: any) { setMsg(e.message || 'Failed to load students'); }
    finally { setLoadingStudents(false); }
  }

  async function generateOne(studentId: string) {
    setGenerating(studentId); setMsg('');
    try {
      const res = await apiPost<any>('/api/v1/teacher/students/credentials/generate', { student_id: studentId }, token);
      setResults(prev => [...prev.filter(r => r.student_id !== studentId), { student_id: studentId, ...res }]);
      setStudents(prev => prev.map(s => s.student_id === studentId ? { ...s, has_account: true, username: res.username, force_password_reset: true } : s));
    } catch (e: any) { setMsg(e.message || 'Failed'); }
    finally { setGenerating(null); }
  }

  async function resetOne(studentId: string) {
    setGenerating(studentId); setMsg('');
    try {
      const res = await apiPost<any>(`/api/v1/teacher/students/credentials/reset/${studentId}`, {}, token);
      setResults(prev => [...prev.filter(r => r.student_id !== studentId), { student_id: studentId, ...res, is_new: false }]);
      setMsg('✓ Password reset to 123456');
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) { setMsg(e.message || 'Failed'); }
    finally { setGenerating(null); }
  }

  async function bulkGenerate() {
    if (!selectedSection) return;
    setBulkGenerating(true); setMsg('');
    try {
      const res = await apiPost<any[]>('/api/v1/teacher/students/credentials/generate', { section_id: selectedSection }, token);
      const successful = res.filter((r: any) => !r.error);
      setResults(successful);
      setMsg(`✓ Generated credentials for ${successful.length} students`);
      loadStudents(selectedSection);
    } catch (e: any) { setMsg(e.message || 'Failed'); }
    finally { setBulkGenerating(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100 bg-blue-50/50">
        <p className="text-sm font-semibold text-neutral-800">🔑 Student Login Credentials</p>
        <p className="text-xs text-neutral-500 mt-0.5">Generate usernames and passwords for students. Default password is <strong>123456</strong>.</p>
      </div>
      <div className="p-5 space-y-4">
        {/* Section picker */}
        <div className="flex gap-3">
          <select
            value={selectedSection}
            onChange={e => { setSelectedSection(e.target.value); if (e.target.value) loadStudents(e.target.value); }}
            className="flex-1 px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <option value="">Select a section...</option>
            {sections.map(s => (
              <option key={s.section_id} value={s.section_id}>{s.class_name} – Section {s.section_label}</option>
            ))}
          </select>
          {selectedSection && (
            <button onClick={bulkGenerate} disabled={bulkGenerating}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors whitespace-nowrap">
              {bulkGenerating ? 'Generating...' : '⚡ Generate All'}
            </button>
          )}
        </div>

        {/* Student list */}
        {loadingStudents && <p className="text-sm text-neutral-400">Loading students...</p>}
        {students.length > 0 && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {students.map(s => (
              <div key={s.student_id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-100 bg-neutral-50/30">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-800 truncate">{s.student_name}</p>
                  {s.has_account && s.username ? (
                    <p className="text-xs text-emerald-600 font-mono mt-0.5">{s.username}</p>
                  ) : (
                    <p className="text-xs text-neutral-400 mt-0.5">No account yet</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  {!s.has_account ? (
                    <button onClick={() => generateOne(s.student_id)} disabled={generating === s.student_id}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors">
                      {generating === s.student_id ? '...' : 'Create'}
                    </button>
                  ) : (
                    <button onClick={() => resetOne(s.student_id)} disabled={generating === s.student_id}
                      className="px-3 py-1.5 border border-neutral-200 text-neutral-600 hover:bg-neutral-100 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors">
                      {generating === s.student_id ? '...' : 'Reset'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Generated credentials display */}
        {results.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs font-bold text-emerald-800 mb-2">✓ Credentials ready — share with students:</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-3 text-xs font-mono bg-white rounded-lg px-3 py-2 border border-emerald-100">
                  <span className="text-neutral-600 flex-1 truncate">{r.username}</span>
                  <span className="text-neutral-400">·</span>
                  <span className="text-emerald-700 font-bold">{r.password}</span>
                  {r.is_new && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">new</span>}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-emerald-600 mt-2">Students must change their password on first login.</p>
          </div>
        )}

        {msg && <p className={`text-xs ${msg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</p>}
      </div>
    </div>
  );
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
      const res = await fetch(`${API_BASE}/api/v1/admin/settings/logo`, {
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
                      <img src={`${API_BASE}${settings.logo_url}`}
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

          {/* Student Portal Config */}
          <StudentPortalSection token={token} />

          {/* Student Credentials */}
          <StudentCredentialsSection token={token} />
        </div>
      )}
    </div>
  );
}

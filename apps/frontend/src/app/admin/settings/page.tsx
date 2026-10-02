'use client';

import { useState, useEffect } from 'react';
import { API_BASE, apiGet, apiPut, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { applyBrandColor, saveTagline } from '@/lib/branding';
import { FileText, X } from 'lucide-react';

interface Settings {
  school_name: string;
  subdomain: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  notes_expiry_days: number;
  ai_plan_mode: string;
  voice_enabled: boolean;
  logo_url: string | null;
  primary_color: string;
  tagline: string;
  instagram_handle: string;
  google_drive_enabled: boolean;
  google_drive_folder_id: string | null;
  google_drive_class_folder: string;
  google_drive_auth?: string | null;
}

interface PortalClass {
  class_id: string;
  class_name: string;
  enabled: boolean;
  enabled_at: string | null;
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
  const [enabledClassIds, setEnabledClassIds] = useState<Set<string>>(new Set());
  const [selectedSection, setSelectedSection] = useState('');
  const [students, setStudents] = useState<{ student_id: string; student_name: string; username: string | null; has_account: boolean }[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [results, setResults] = useState<{ student_id: string; username: string; password: string }[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([
      apiGet<{ id: string; name: string; sections: { id: string; label: string }[] }[]>('/api/v1/admin/classes', token),
      apiGet<{ class_id: string; enabled: boolean }[]>('/api/v1/admin/student-portal/config', token),
    ]).then(([classes, config]) => {
      const enabledIds = new Set(config.filter(c => c.enabled).map(c => c.class_id));
      setEnabledClassIds(enabledIds);
      // Flatten classes → sections, only for portal-enabled classes
      const flat = classes
        .filter(c => enabledIds.has(c.id))
        .flatMap(c => c.sections.map(s => ({
          section_id: s.id,
          section_label: s.label,
          class_name: c.name,
        })));
      setSections(flat);
    }).catch(() => {});
  }, []);

  async function loadStudents(sectionId: string) {
    setLoadingStudents(true); setStudents([]); setResults([]);
    try {
      const data = await apiGet<any[]>(`/api/v1/teacher/students/credentials/${sectionId}`, token);
      setStudents(data);
    } catch (e: any) { setMsg(e.message || 'Failed to load students'); }
    finally { setLoadingStudents(false); }
  }

  async function bulkGenerate() {
    if (!selectedSection) return;
    setBulkGenerating(true); setMsg('');
    try {
      const res = await apiPost<any[]>('/api/v1/teacher/students/credentials/generate', { section_id: selectedSection }, token);
      const successful = (res || []).filter((r: any) => !r.error);
      setResults(successful);
      setMsg(`✓ Generated credentials for ${successful.length} student${successful.length !== 1 ? 's' : ''}`);
      loadStudents(selectedSection);
    } catch (e: any) { setMsg(e.message || 'Failed'); }
    finally { setBulkGenerating(false); }
  }

  // Only show sections whose class has portal enabled
  const enabledSections = sections; // filter happens via class_id check below
  const withoutAccount = students.filter(s => !s.has_account);
  const allHaveAccounts = students.length > 0 && withoutAccount.length === 0;

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100 bg-blue-50/50">
        <p className="text-sm font-semibold text-neutral-800">🔑 Bulk Generate Student Logins</p>
        <p className="text-xs text-neutral-500 mt-0.5">
          Generate logins for all students in a section at once. Only students without an account are created.
          For individual students, use the Students tab.
        </p>
      </div>
      <div className="p-5 space-y-4">
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
            <button onClick={bulkGenerate}
              disabled={bulkGenerating || allHaveAccounts || withoutAccount.length === 0}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors whitespace-nowrap">
              {bulkGenerating ? 'Generating...' : allHaveAccounts ? '✓ All done' : `⚡ Generate ${withoutAccount.length > 0 ? `(${withoutAccount.length})` : ''}`}
            </button>
          )}
        </div>

        {loadingStudents && <p className="text-sm text-neutral-400">Loading students...</p>}

        {/* Show only students WITHOUT accounts */}
        {!loadingStudents && withoutAccount.length > 0 && (
          <div>
            <p className="text-xs font-medium text-neutral-500 mb-2">{withoutAccount.length} student{withoutAccount.length !== 1 ? 's' : ''} without login:</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {withoutAccount.map(s => (
                <div key={s.student_id} className="flex items-center px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-100">
                  <span className="text-sm text-neutral-700">{s.student_name}</span>
                  <span className="ml-auto text-xs text-neutral-400">No account</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loadingStudents && allHaveAccounts && students.length > 0 && (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-xl px-4 py-3">
            <span className="text-sm font-medium">✓ All {students.length} students have login accounts</span>
          </div>
        )}

        {/* Generated credentials */}
        {results.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs font-bold text-emerald-800 mb-2">✓ New credentials — share with students:</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {results.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-xs font-mono bg-white rounded-lg px-3 py-2 border border-emerald-100">
                  <span className="text-neutral-600 flex-1 truncate">{r.username}</span>
                  <span className="text-neutral-300">·</span>
                  <span className="text-emerald-700 font-bold">{r.password}</span>
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

function AiPlanModeSection({ token }: { token: string }) {
  const [classes, setClasses] = useState<{ class_id: string; class_name: string; ai_plan_mode: string }[]>([]);
  const [schoolDefault, setSchoolDefault] = useState('standard');
  const [toggling, setToggling] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    apiGet<{ school_default: string; classes: any[] }>('/api/v1/admin/settings/ai-plan-mode', token)
      .then(d => { setClasses(d.classes); setSchoolDefault(d.school_default); })
      .catch(() => {});
  }, [token]);

  async function toggle(classId: string | null, current: string) {
    const next = current === 'ai_enhanced' ? 'standard' : 'ai_enhanced';
    setToggling(classId || 'school');
    try {
      await apiPut('/api/v1/admin/settings/ai-plan-mode', { class_id: classId, ai_plan_mode: next }, token);
      if (classId) {
        setClasses(prev => prev.map(c => c.class_id === classId ? { ...c, ai_plan_mode: next } : c));
      } else {
        setSchoolDefault(next);
      }
      setMsg(`✓ Updated`);
      setTimeout(() => setMsg(''), 2000);
    } catch (e: any) { setMsg(e.message || 'Failed'); }
    finally { setToggling(null); }
  }

  const Toggle = ({ enabled, loading, onClick }: { enabled: boolean; loading: boolean; onClick: () => void }) => (
    <button onClick={onClick} disabled={loading}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${enabled ? 'bg-emerald-500' : 'bg-neutral-200'}`}>
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  return (
    <div className="space-y-2">
      {/* School default */}
      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
        <div>
          <p className="text-xs font-semibold text-neutral-700">All classes (default)</p>
          <p className="text-[10px] text-neutral-400">Applied to any class without a specific setting</p>
        </div>
        <Toggle enabled={schoolDefault === 'ai_enhanced'} loading={toggling === 'school'} onClick={() => toggle(null, schoolDefault)} />
      </div>

      {/* Per-class */}
      {classes.map(c => (
        <div key={c.class_id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-neutral-100 hover:bg-neutral-50/50">
          <div>
            <p className="text-xs font-medium text-neutral-700">{c.class_name}</p>
            <p className="text-[10px] text-neutral-400">
              {c.ai_plan_mode === 'ai_enhanced' ? '🤖 AI-enhanced' : '📋 Standard'}
            </p>
          </div>
          <Toggle enabled={c.ai_plan_mode === 'ai_enhanced'} loading={toggling === c.class_id} onClick={() => toggle(c.class_id, c.ai_plan_mode)} />
        </div>
      ))}

      {msg && <p className={`text-xs ${msg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const token = getToken() || '';
  const [settings, setSettings] = useState<Settings>({
    school_name: '', subdomain: '', contact_email: '',
    contact_phone: '', contact_address: '', notes_expiry_days: 14,
    ai_plan_mode: 'standard', voice_enabled: false, logo_url: null, primary_color: '#1A3C2E', tagline: '', instagram_handle: '',
    google_drive_enabled: false, google_drive_folder_id: null, google_drive_class_folder: 'SOJS2627',
    google_drive_auth: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showGoogleDriveConfig, setShowGoogleDriveConfig] = useState(false);
  const [googleDriveSaving, setGoogleDriveSaving] = useState(false);

  useEffect(() => {
    apiGet<Settings>('/api/v1/admin/settings', token)
      .then(s => { 
        // Merge with defaults to ensure all fields exist
        setSettings(prev => ({ ...prev, ...s })); 
        setLoading(false); 
      })
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

  async function handleTestConnection() {
    if (!settings.google_drive_enabled) {
      setError('Google Drive is not enabled');
      return;
    }
    if (!settings.google_drive_folder_id) {
      setError('Google Drive folder ID is required for testing');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const res = await apiPost<{ success: boolean; message?: string; error?: string }>(
        '/api/v1/admin/google-drive/test', {}, token
      );
      if (res.success) {
        setError(`✓ ${res.message}`);
        setTimeout(() => setError(''), 5000);
      } else {
        setError(`Test failed: ${res.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      const errData = e.message || 'Failed to test connection';
      setError(`Test failed: ${errData}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveGoogleDriveConfig() {
    setGoogleDriveSaving(true); setError('');
    try {
      // Validate JSON if provided
      if (settings.google_drive_auth) {
        try { JSON.parse(settings.google_drive_auth); }
        catch { setError('Service Account JSON is invalid. Please paste the full JSON key file content.'); setGoogleDriveSaving(false); return; }
      }
      const res = await apiPut<{ 
        success: boolean; 
        google_drive_enabled: boolean; 
        google_drive_folder_id: string | null 
      }>('/api/v1/admin/google-drive/config', {
        enabled: settings.google_drive_enabled,
        folder_id: settings.google_drive_folder_id,
        class_folder: settings.google_drive_class_folder,
        auth: settings.google_drive_auth || null,
      }, token);
      
      if (res.success) {
        setSettings(s => ({
          ...s,
          google_drive_enabled: res.google_drive_enabled,
          google_drive_folder_id: res.google_drive_folder_id,
        }));
        setError('✓ Google Drive configuration saved successfully');
        setTimeout(() => { setError(''); setShowGoogleDriveConfig(false); }, 2000);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to save Google Drive configuration');
    } finally {
      setGoogleDriveSaving(false);
    }
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

              {/* Instagram handle */}
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">
                  Instagram Handle
                  <span className="ml-1.5 text-[10px] font-normal text-neutral-400">for social sharing</span>
                </label>
                <div className="flex items-center border border-neutral-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-primary-400">
                  <span className="px-3 py-2.5 text-sm text-neutral-400 bg-neutral-50 border-r border-neutral-200 select-none">@</span>
                  <input
                    value={settings.instagram_handle}
                    onChange={e => setSettings(s => ({ ...s, instagram_handle: e.target.value.replace(/^@/, '').replace(/\s/g, '') }))}
                    placeholder="silveroakjuniors_seegehalli"
                    className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white"
                  />
                </div>
                <p className="text-xs text-neutral-400 mt-1">When parents share class feed photos, this account will be auto-tagged on Instagram and Facebook</p>
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

              {/* AI Plan Mode — per class */}
              <div className="mt-5 pt-5 border-t border-neutral-100">
                <p className="text-xs font-medium text-neutral-700 mb-0.5">🤖 AI-Enhanced Daily Plans</p>
                <p className="text-xs text-neutral-400 mb-3">
                  When enabled for a class, teachers in that class get a rich AI-generated daily plan with objectives, activities, and offline support instead of raw curriculum chunks.
                </p>
                <div className="flex items-start gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                  <p className="text-xs text-amber-700">
                    <strong>High AI credit usage.</strong> Each plan view calls the AI API. Enable only for classes where you want the rich format.
                  </p>
                </div>
                <AiPlanModeSection token={token} />
              </div>

              {/* Voice Input */}
              <div className="mt-5 pt-5 border-t border-neutral-100">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-neutral-700">🎤 Voice Input for Oakie</p>
                  <button
                    onClick={async () => {
                      const newVal = !settings.voice_enabled;
                      setSettings(s => ({ ...s, voice_enabled: newVal }));
                      try {
                        const updated = await apiPut<any>('/api/v1/admin/settings', { voice_enabled: newVal }, token);
                        // Sync from server response to confirm save
                        if (typeof updated?.voice_enabled === 'boolean') {
                          setSettings(s => ({ ...s, voice_enabled: updated.voice_enabled }));
                        }
                      } catch (e: any) {
                        setSettings(s => ({ ...s, voice_enabled: !newVal })); // revert on error
                        alert('Failed to save voice setting: ' + (e?.message || 'Unknown error'));
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.voice_enabled ? 'bg-emerald-600' : 'bg-neutral-200'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.voice_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                <p className="text-xs text-neutral-400 mb-2">
                  When enabled, a microphone button appears in Oakie chat for teachers and parents. Audio is transcribed using Google Gemini AI — works in all browsers and will work in the mobile app.
                </p>
                {settings.voice_enabled && (
                  <div className="flex items-start gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="text-emerald-500 text-sm mt-0.5">✅</span>
                    <p className="text-xs text-emerald-700">
                      Voice input is <strong>active</strong>. Teachers and parents will see a 🎤 mic button in Oakie chat. Each voice query uses Gemini transcription credits.
                    </p>
                  </div>
                )}
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

          {/* Google Drive Configuration */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 bg-emerald-50/50">
              <p className="text-sm font-semibold text-neutral-800">Google Drive Upload</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Configure Google Drive for teachers to upload photos and videos
              </p>
            </div>
            <div className="p-5">
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${settings.google_drive_enabled ? 'bg-emerald-100' : 'bg-neutral-100'}`}>
                  <FileText className={`w-6 h-6 ${settings.google_drive_enabled ? 'text-emerald-600' : 'text-neutral-400'}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-neutral-800 mb-1">
                    {settings.google_drive_enabled ? 'Google Drive is enabled' : 'Google Drive is not configured'}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {settings.google_drive_enabled 
                      ? `Media uploaded by teachers will be stored in folder: ${settings.google_drive_folder_id || '(not set)'}` 
                      : 'Admin needs to configure Google Drive (OAuth + folder ID) for this feature to work'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowGoogleDriveConfig(true)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors">
                {settings.google_drive_enabled ? 'Manage Configuration' : 'Configure Google Drive'}
              </button>
            </div>
          </div>

          {/* Student Credentials */}
          <StudentCredentialsSection token={token} />
        </div>
      )}

      {/* Google Drive Configuration Modal */}
      {showGoogleDriveConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-8">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 pt-5 pb-3 border-b border-neutral-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <p className="text-base font-bold text-neutral-900">Google Drive Configuration</p>
              </div>
              <button onClick={() => setShowGoogleDriveConfig(false)} className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center shrink-0">
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[calc(90vh-10rem)]">
              <p className="text-sm text-neutral-600 mb-4">
                Configure Google Drive for teachers to upload photos and videos. Each class will have its own folder organized by date.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">Enable Google Drive Uploads</p>
                    <p className="text-xs text-neutral-500">Allow teachers to upload media directly to Google Drive</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, google_drive_enabled: !s.google_drive_enabled }))}
                    disabled={saving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.google_drive_enabled ? 'bg-emerald-500' : 'bg-neutral-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings.google_drive_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {settings.google_drive_enabled && (
                  <div className="space-y-5">

                    {/* Step-by-step Setup Guide */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-blue-900 mb-3 flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center font-bold shrink-0">i</span>
                        One-time Setup Guide — Personal Google Drive (OAuth)
                      </p>
                      <div className="space-y-3 text-[11px] text-blue-900">

                        <div className="flex gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center font-bold shrink-0 mt-0.5">1</span>
                          <div>
                            <p className="font-semibold">Go to Google Cloud Console</p>
                            <p className="text-blue-700 mt-0.5">Open <span className="font-mono bg-blue-100 px-1 rounded">console.cloud.google.com</span> and open your project (or create one)</p>
                          </div>
                        </div>

                        <div className="flex gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center font-bold shrink-0 mt-0.5">2</span>
                          <div>
                            <p className="font-semibold">Enable Google Drive API</p>
                            <p className="text-blue-700 mt-0.5">APIs &amp; Services → Library → search "Google Drive API" → Enable</p>
                          </div>
                        </div>

                        <div className="flex gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center font-bold shrink-0 mt-0.5">3</span>
                          <div>
                            <p className="font-semibold">Create OAuth 2.0 Credentials</p>
                            <p className="text-blue-700 mt-0.5">APIs &amp; Services → Credentials → Create Credentials → OAuth client ID → Web application</p>
                            <p className="text-blue-700 mt-0.5">Add redirect URI: <span className="font-mono bg-blue-100 px-1 rounded">https://developers.google.com/oauthplayground</span></p>
                            <p className="text-blue-700 mt-1 font-medium">Download the JSON — note Client ID and Client Secret</p>
                          </div>
                        </div>

                        <div className="flex gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center font-bold shrink-0 mt-0.5">4</span>
                          <div>
                            <p className="font-semibold">Set up OAuth Consent Screen</p>
                            <p className="text-blue-700 mt-0.5">Google Auth Platform → Audience → Make External → add your Gmail as a Test User → Save</p>
                          </div>
                        </div>

                        <div className="flex gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center font-bold shrink-0 mt-0.5">5</span>
                          <div>
                            <p className="font-semibold">Get Refresh Token from OAuth Playground</p>
                            <p className="text-blue-700 mt-0.5">Go to <span className="font-mono bg-blue-100 px-1 rounded">developers.google.com/oauthplayground</span></p>
                            <p className="text-blue-700 mt-0.5">Click gear icon → check "Use your own OAuth credentials" → enter your Client ID &amp; Secret</p>
                            <p className="text-blue-700 mt-0.5">Left panel → Drive API v3 → select <span className="font-mono bg-blue-100 px-1 rounded">https://www.googleapis.com/auth/drive.file</span></p>
                            <p className="text-blue-700 mt-0.5">Authorize APIs → sign in with your Gmail → Exchange authorization code for tokens</p>
                            <p className="text-blue-700 mt-1 font-medium">Copy the <span className="font-mono bg-blue-100 px-1 rounded">refresh_token</span> (starts with 1//)</p>
                          </div>
                        </div>

                        <div className="flex gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center font-bold shrink-0 mt-0.5">6</span>
                          <div>
                            <p className="font-semibold">Create Google Drive Folder</p>
                            <p className="text-blue-700 mt-0.5">In your personal Google Drive, create a folder (e.g. "SOJS Class Photos")</p>
                            <p className="text-blue-700 mt-0.5">Right-click → Get link → copy the ID from the URL (the part after /folders/)</p>
                          </div>
                        </div>

                        <div className="flex gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold shrink-0 mt-0.5">7</span>
                          <div>
                            <p className="font-semibold">Store credentials in database (one-time SQL)</p>
                            <p className="text-blue-700 mt-0.5">Run this in Supabase SQL editor:</p>
                            <div className="bg-white border border-blue-200 rounded-lg p-2 mt-1.5 font-mono text-[10px] text-neutral-800 leading-relaxed whitespace-pre-wrap break-all">
{`UPDATE school_settings
SET google_drive_auth = '{
  "type": "oauth",
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "refresh_token": "1//YOUR_REFRESH_TOKEN"
}'::jsonb
WHERE school_id = (SELECT id FROM schools LIMIT 1);`}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Folder ID input */}
                    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-neutral-800">Drive Folder Settings</p>
                      <div>
                        <label className="text-xs font-semibold text-neutral-700 mb-1.5 block">Google Drive Folder ID</label>
                        <input
                          value={settings.google_drive_folder_id || ''}
                          onChange={e => setSettings(s => ({ ...s, google_drive_folder_id: e.target.value.trim() }))}
                          placeholder="e.g., 1GgIKBU3yw1TFK-vuQ1v_mdP2vGmO_H9o"
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                        />
                        <p className="text-[10px] text-neutral-400 mt-1.5">
                          From the folder URL: drive.google.com/drive/folders/<span className="font-mono font-bold text-neutral-600">THIS_PART</span>
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-neutral-700 mb-1.5 block">Class Folder Name</label>
                        <input
                          value={settings.google_drive_class_folder || ''}
                          onChange={e => setSettings(s => ({ ...s, google_drive_class_folder: e.target.value.trim() }))}
                          placeholder="e.g., SOJS2627"
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                        />
                        <p className="text-[10px] text-neutral-400 mt-1">
                          Photos will be organized as: <span className="font-mono text-neutral-600">SOJS2627 / 2026-07-30 / EventName</span>
                        </p>
                      </div>
                    </div>

                    {/* Test Connection */}
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                      <div>
                        <p className="text-xs font-semibold text-emerald-800">Test Connection</p>
                        <p className="text-[10px] text-emerald-700 mt-0.5">
                          Uploads a test file to verify everything is working
                        </p>
                      </div>
                      <button
                        onClick={handleTestConnection}
                        disabled={googleDriveSaving || saving}
                        className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Test Upload
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-between bg-neutral-50/50 shrink-0">
              <p className="text-[10px] text-neutral-400">
                Note: Service account JSON with private key is used to generate access tokens automatically.
              </p>
              <div className="flex items-center gap-2">
                <button onClick={handleSaveGoogleDriveConfig}
                  disabled={saving || (settings.google_drive_enabled && !settings.google_drive_folder_id)}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

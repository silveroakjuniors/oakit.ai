'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, Card, Badge } from '@/components/ui';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface Parent { id: string; name: string | null; mobile: string; is_active: boolean; force_password_reset: boolean; }
interface Student {
  id: string; name: string;
  father_name?: string; mother_name?: string;
  parent_contact?: string; mother_contact?: string;
  photo_url?: string | null; class_name: string; section_label: string; is_active: boolean;
}
interface Class { id: string; name: string; sections: { id: string; label: string }[]; }

/** Resolve photo URL — handles both Supabase full URLs and legacy /uploads/ paths */
function resolvePhoto(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;                    // Supabase full URL
  if (url.startsWith('/uploads')) return `${API_BASE}${url}`; // legacy local
  return null;
}

// ── Photo Preview Modal ───────────────────────────────────────────────────────
function PhotoPreview({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/70 hover:text-white text-2xl">✕</button>
        <img src={url} alt={name} className="w-full rounded-2xl object-cover shadow-2xl" />
        <p className="text-white text-center text-sm mt-3 font-medium">{name}</p>
      </div>
    </div>
  );
}

// ── Student Avatar ────────────────────────────────────────────────────────────
function StudentAvatar({ student, uploading, onUpload }: {
  student: Student; uploading: boolean; onUpload: (f: File) => void;
}) {
  const [preview, setPreview] = useState(false);
  const photoUrl = resolvePhoto(student.photo_url);

  return (
    <>
      <div className="relative w-12 h-12 shrink-0">
        <div
          className="w-12 h-12 rounded-full bg-primary-50 border-2 border-primary-100 overflow-hidden flex items-center justify-center cursor-pointer"
          onClick={() => photoUrl && setPreview(true)}
        >
          {photoUrl
            ? <img src={photoUrl} alt={student.name} className="w-full h-full object-cover" />
            : <span className="text-primary-600 font-bold text-lg">{student.name[0]}</span>}
        </div>
        {/* Upload button overlay */}
        <label className="absolute -bottom-1 -right-1 w-5 h-5 bg-white border border-gray-200 rounded-full flex items-center justify-center cursor-pointer shadow-sm hover:bg-gray-50">
          {uploading ? <span className="text-[8px]">⏳</span> : <span className="text-[10px]">📷</span>}
          <input type="file" accept="image/jpeg,image/png" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
        </label>
      </div>
      {preview && photoUrl && <PhotoPreview url={photoUrl} name={student.name} onClose={() => setPreview(false)} />}
    </>
  );
}

// ── Add Student Modal ─────────────────────────────────────────────────────────
function AddStudentModal({ classes, token, onClose, onAdded }: {
  classes: Class[]; token: string; onClose: () => void; onAdded: () => void;
}) {
  const [form, setForm] = useState({
    name: '', class_id: '', section_id: '',
    father_name: '', mother_name: '',
    parent_contact: '', mother_contact: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selectedClass = classes.find(c => c.id === form.class_id);

  async function submit() {
    if (!form.name.trim() || !form.class_id || !form.section_id) {
      setError('Name, class and section are required'); return;
    }
    if (form.parent_contact && form.mother_contact && form.parent_contact === form.mother_contact) {
      setError('Father and mother cannot have the same mobile number'); return;
    }
    if (form.parent_contact && !/^\d{10}$/.test(form.parent_contact)) {
      setError('Father mobile must be 10 digits'); return;
    }
    if (form.mother_contact && !/^\d{10}$/.test(form.mother_contact)) {
      setError('Mother mobile must be 10 digits'); return;
    }
    setSaving(true); setError('');
    try {
      await apiPost('/api/v1/admin/students', form, token);
      onAdded(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  }

  const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input type={type} value={form[key]} placeholder={placeholder}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary/40 bg-white" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-y-auto max-h-[90vh]">
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Add Student</h2>
          <button onClick={onClose} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">✕</button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          {field('Student Name *', 'name', 'text', 'Full name')}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Class *</label>
            <select value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value, section_id: '' }))}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary/40">
              <option value="">Select class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {selectedClass && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Section *</label>
              <select value={form.section_id} onChange={e => setForm(f => ({ ...f, section_id: e.target.value }))}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary/40">
                <option value="">Select section</option>
                {selectedClass.sections.map(s => <option key={s.id} value={s.id}>Section {s.label}</option>)}
              </select>
            </div>
          )}
          <div className="border-t border-gray-100 pt-3 mt-1">
            <p className="text-xs font-semibold text-gray-500 mb-3">Parent / Guardian Details</p>
            <div className="grid grid-cols-2 gap-3">
              {field('Father Name', 'father_name', 'text', 'Optional')}
              {field('Father Mobile', 'parent_contact', 'tel', '10 digits')}
              {field('Mother Name', 'mother_name', 'text', 'Optional')}
              {field('Mother Mobile', 'mother_contact', 'tel', '10 digits')}
            </div>
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
          <div className="flex gap-2 pt-1 pb-2">
            <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={submit} loading={saving} className="flex-1">Add Student</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit Student Modal ────────────────────────────────────────────────────────
function EditStudentModal({ student, token, onClose, onSaved }: {
  student: Student; token: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    father_name: student.father_name || '',
    mother_name: student.mother_name || '',
    parent_contact: student.parent_contact || '',
    mother_contact: student.mother_contact || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (form.parent_contact && form.mother_contact && form.parent_contact === form.mother_contact) {
      setError('Father and mother cannot have the same mobile number'); return;
    }
    if (form.parent_contact && !/^\d{10}$/.test(form.parent_contact)) {
      setError('Father mobile must be 10 digits'); return;
    }
    if (form.mother_contact && !/^\d{10}$/.test(form.mother_contact)) {
      setError('Mother mobile must be 10 digits'); return;
    }
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/students/${student.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  }

  const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input type={type} value={form[key]} placeholder={placeholder}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary/40 bg-white" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-y-auto max-h-[90vh]">
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Edit — {student.name}</h2>
          <button onClick={onClose} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">✕</button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            {field('Father Name', 'father_name', 'text', 'Optional')}
            {field('Father Mobile', 'parent_contact', 'tel', '10 digits')}
            {field('Mother Name', 'mother_name', 'text', 'Optional')}
            {field('Mother Mobile', 'mother_contact', 'tel', '10 digits')}
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
          <div className="flex gap-2 pt-1 pb-2">
            <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={submit} loading={saving} className="flex-1">Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Parent Management Panel ───────────────────────────────────────────────────
function ParentPanel({ student, token, onRefresh }: { student: Student; token: string; onRefresh: () => void }) {
  const [parents, setParents] = useState<Parent[]>([]);
  const [activating, setActivating] = useState<'father' | 'mother' | 'custom' | null>(null);
  const [customMobile, setCustomMobile] = useState('');
  const [customName, setCustomName] = useState('');
  const [resetting, setResetting] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/admin/students/${student.id}/parents`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(setParents).catch(() => {});
  }, [student.id]);

  async function activate(mobile: string, name: string, relation: string) {
    if (!mobile || !/^\d{10}$/.test(mobile)) { setMsg('Enter a valid 10-digit mobile number'); return; }
    setLoading(true); setMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/students/${student.id}/activate-parent`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, name, relation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(`✓ Account activated. Password = ${mobile}`);
      setActivating(null); setCustomMobile(''); setCustomName('');
      const r2 = await fetch(`${API_BASE}/api/v1/admin/students/${student.id}/parents`, { headers: { Authorization: `Bearer ${token}` } });
      setParents(await r2.json());
      onRefresh();
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }

  async function resetLogin(parentId: string) {
    setResetting(parentId); setMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/students/${student.id}/reset-parent-login`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: parentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg('✓ Password reset to mobile number');
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : 'Failed'); }
    finally { setResetting(null); }
  }

  const contacts = [
    { relation: 'father' as const, name: student.father_name, mobile: student.parent_contact, label: 'Father' },
    { relation: 'mother' as const, name: student.mother_name, mobile: student.mother_contact, label: 'Mother' },
  ].filter(c => c.mobile);

  return (
    <div className="flex flex-col gap-3 pt-1">
      {msg && <p className={`text-xs px-3 py-2 rounded-xl ${msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg}</p>}

      {parents.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Linked Accounts</p>
          {parents.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-800">{p.name || p.mobile}</p>
                <p className="text-xs text-gray-400">
                  {p.mobile} · {p.is_active
                    ? p.force_password_reset ? <span className="text-amber-600">⚠ Must change password</span> : <span className="text-emerald-600">✓ Active</span>
                    : 'Inactive'}
                </p>
              </div>
              <button onClick={() => resetLogin(p.id)} disabled={resetting === p.id}
                className="text-xs text-amber-600 font-medium px-2.5 py-1.5 rounded-lg hover:bg-amber-50 disabled:opacity-50 min-h-[32px]">
                {resetting === p.id ? '...' : 'Reset'}
              </button>
            </div>
          ))}
        </div>
      )}

      {contacts.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Activate Account</p>
          {contacts.map(c => {
            const linkedByMobile = parents.some(p => p.mobile === c.mobile);
            // Check if a linked account exists but with a DIFFERENT mobile
            const linkedAccount = parents.find(p => p.mobile !== c.mobile);
            const hasAnyLinked = parents.length > 0;

            return (
              <div key={c.relation}>
                {activating === c.relation ? (
                  <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 flex flex-col gap-2">
                    <p className="text-xs text-primary-700 font-medium">{c.label}: {c.mobile}</p>
                    <p className="text-xs text-primary-600">Password = <strong>{c.mobile}</strong> · Must change on first login</p>
                    <div className="flex gap-2">
                      <button onClick={() => setActivating(null)} className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-600">Cancel</button>
                      <button onClick={() => activate(c.mobile!, c.name || '', c.relation)} disabled={loading}
                        className="flex-1 py-2 text-xs bg-primary-600 text-white rounded-lg font-medium disabled:opacity-50">
                        {loading ? '...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-700">{c.label}: {c.name || '—'}</p>
                        <p className="text-xs text-gray-400">{c.mobile}</p>
                      </div>
                      {linkedByMobile ? (
                        <span className="text-xs text-emerald-600 font-medium">✓ Linked</span>
                      ) : !hasAnyLinked ? (
                        <button onClick={() => setActivating(c.relation)}
                          className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg font-medium min-h-[32px]">
                          Activate
                        </button>
                      ) : (
                        <button onClick={() => setActivating(c.relation)}
                          className="text-xs border border-primary-300 text-primary-700 px-3 py-1.5 rounded-lg font-medium min-h-[32px] hover:bg-primary-50">
                          Add Account
                        </button>
                      )}
                    </div>
                    {/* Show info when a linked account exists but mobile doesn't match */}
                    {!linkedByMobile && hasAnyLinked && linkedAccount && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                        ⚠ A parent account already exists for this student with mobile <strong>{linkedAccount.mobile}</strong> ({linkedAccount.name || 'Unknown'}).
                        The {c.label.toLowerCase()}'s number <strong>{c.mobile}</strong> is different.
                        <br />
                        <span className="text-amber-700 mt-1 block">
                          You can either: update the student's {c.label.toLowerCase()} mobile to match the existing account, or click "Add Account" to create a separate login for this number.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Add Another Parent / Guardian</p>
        <p className="text-xs text-gray-400 bg-blue-50 px-3 py-2 rounded-xl">
          💡 To link siblings: activate a parent with the same mobile on both students — they'll see both children in the parent portal.
        </p>
        {activating === 'custom' ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
            <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Name (optional)"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none" />
            <input value={customMobile} onChange={e => setCustomMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="Mobile number (10 digits)" inputMode="numeric"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={() => { setActivating(null); setCustomMobile(''); setCustomName(''); }}
                className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-gray-600">Cancel</button>
              <button onClick={() => activate(customMobile, customName, 'guardian')} disabled={loading}
                className="flex-1 py-2 text-xs bg-primary-600 text-white rounded-lg font-medium disabled:opacity-50">
                {loading ? '...' : 'Activate'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setActivating('custom')}
            className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-primary/40 hover:text-primary">
            <span className="text-lg">+</span> Add guardian / link sibling's parent
          </button>
        )}
      </div>

      {contacts.length === 0 && parents.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-2">No contacts on file. Edit the student to add parent details.</p>
      )}
    </div>
  );
}

// ── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({ token, onClose, onImported }: { token: string; onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: any[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function downloadTemplate() {
    const res = await fetch(`${API_BASE}/api/v1/admin/students/import/template`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'student_import_template.xlsx'; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/students/import`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data); onImported();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Import failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Import Students</h2>
        {!result ? (
          <>
            <p className="text-xs text-gray-500 mb-1">Columns: student name, father name, mother name, section, class, parent contact, mother contact</p>
            <button onClick={downloadTemplate} className="text-xs text-primary hover:underline mb-4 block">↓ Download template</button>
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-5 text-center cursor-pointer mb-4" onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              <p className="text-sm text-gray-500">{file ? file.name : '📄 Tap to select .xlsx'}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
              <Button onClick={handleImport} loading={loading} disabled={!file} className="flex-1">Import</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-emerald-700 mb-2">✓ {result.created} students imported</p>
            {result.skipped.length > 0 && <ul className="text-xs text-gray-500 list-disc pl-4 max-h-28 overflow-y-auto mb-3">{result.skipped.map((s: any, i: number) => <li key={i}>{s.reason}</li>)}</ul>}
            <Button onClick={onClose} className="w-full">Done</Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const token = getToken() || '';

  async function load() {
    try {
      const params = new URLSearchParams();
      if (filterClass) params.set('class_id', filterClass);
      if (filterSection) params.set('section_id', filterSection);
      if (showInactive) params.set('include_inactive', 'true');
      const [studs, cls] = await Promise.all([
        apiGet<Student[]>(`/api/v1/admin/students?${params}`, token),
        apiGet<Class[]>('/api/v1/admin/classes', token),
      ]);
      setStudents(studs); setClasses(cls);
    } catch (err) { console.error(err); }
  }

  useEffect(() => { load(); }, [filterClass, filterSection, showInactive]);

  async function uploadPhoto(studentId: string, file: File) {
    setUploadingPhoto(studentId);
    const fd = new FormData(); fd.append('photo', file);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/students/${studentId}/photo`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploadingPhoto(null); }
  }

  async function toggleActive(student: Student) {
    if (!confirm(student.is_active
      ? `Terminate ${student.name}? They will no longer appear in active lists.`
      : `Reactivate ${student.name}?`)) return;
    setTogglingId(student.id);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/students/${student.id}/${student.is_active ? 'terminate' : 'reactivate'}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setTogglingId(null); }
  }

  const selectedClass = classes.find(c => c.id === filterClass);
  const filtered = students.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.father_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.mother_name?.toLowerCase().includes(search.toLowerCase())
  );
  const active = filtered.filter(s => s.is_active);
  const inactive = filtered.filter(s => !s.is_active);

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-primary">
          Students <span className="text-sm font-normal text-gray-400">({active.length} active{inactive.length > 0 ? `, ${inactive.length} terminated` : ''})</span>
        </h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>Import</Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>+ Add</Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-2 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by name..."
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary/40" />
        <div className="flex gap-2 flex-wrap">
          <select className="flex-1 min-w-[120px] px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none"
            value={filterClass} onChange={e => { setFilterClass(e.target.value); setFilterSection(''); }}>
            <option value="">All classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {selectedClass && (
            <select className="flex-1 min-w-[120px] px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none"
              value={filterSection} onChange={e => setFilterSection(e.target.value)}>
              <option value="">All sections</option>
              {selectedClass.sections.map(s => <option key={s.id} value={s.id}>Section {s.label}</option>)}
            </select>
          )}
          <label className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
            <span className="text-gray-600">Show terminated</span>
          </label>
        </div>
      </div>

      {/* Student list */}
      <div className="flex flex-col gap-2">
        {filtered.map(student => (
          <div key={student.id} className={`bg-white border rounded-2xl overflow-hidden shadow-sm ${!student.is_active ? 'border-red-100 opacity-70' : 'border-gray-100'}`}>
            <div className="flex items-start gap-3 p-4">
              <StudentAvatar
                student={student}
                uploading={uploadingPhoto === student.id}
                onUpload={f => uploadPhoto(student.id, f)}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{student.name}</p>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{student.class_name} · {student.section_label}</span>
                  {!student.is_active && <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Terminated</span>}
                </div>

                {/* Parent info */}
                <div className="mt-1.5 flex flex-col gap-0.5">
                  {(student.father_name || student.parent_contact) && (
                    <p className="text-xs text-gray-500">
                      👨 <span className="font-medium">{student.father_name || '—'}</span>
                      {student.parent_contact && <span className="text-gray-400 ml-1">· {student.parent_contact}</span>}
                    </p>
                  )}
                  {(student.mother_name || student.mother_contact) && (
                    <p className="text-xs text-gray-500">
                      👩 <span className="font-medium">{student.mother_name || '—'}</span>
                      {student.mother_contact && <span className="text-gray-400 ml-1">· {student.mother_contact}</span>}
                    </p>
                  )}
                  {!student.father_name && !student.mother_name && !student.parent_contact && !student.mother_contact && (
                    <p className="text-xs text-gray-400 italic">No parent details</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <button onClick={() => setEditingStudent(student)}
                    className="text-xs text-gray-500 font-medium px-2.5 py-1.5 rounded-lg hover:bg-gray-100 min-h-[28px]">
                    ✏️ Edit
                  </button>
                  <button onClick={() => setExpandedStudent(expandedStudent === student.id ? null : student.id)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg min-h-[28px] transition-colors ${expandedStudent === student.id ? 'bg-primary-600 text-white' : 'bg-primary-50 text-primary-700'}`}>
                    👨‍👩‍👧 Parents {expandedStudent === student.id ? '▲' : '▼'}
                  </button>
                  <button
                    onClick={() => toggleActive(student)}
                    disabled={togglingId === student.id}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-lg min-h-[28px] disabled:opacity-50 ${
                      student.is_active
                        ? 'text-red-500 hover:bg-red-50'
                        : 'text-emerald-600 hover:bg-emerald-50'
                    }`}>
                    {togglingId === student.id ? '...' : student.is_active ? '🚫 Terminate' : '✓ Reactivate'}
                  </button>
                </div>
              </div>
            </div>

            {expandedStudent === student.id && (
              <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50/50">
                <ParentPanel student={student} token={token} onRefresh={load} />
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🎒</p>
            <p className="text-sm">{search ? 'No students match your search' : 'No students found'}</p>
          </div>
        )}
      </div>

      {showAdd && <AddStudentModal classes={classes} token={token} onClose={() => setShowAdd(false)} onAdded={load} />}
      {showImport && <ImportModal token={token} onClose={() => setShowImport(false)} onImported={load} />}
      {editingStudent && <EditStudentModal student={editingStudent} token={token} onClose={() => setEditingStudent(null)} onSaved={load} />}
    </div>
  );
}

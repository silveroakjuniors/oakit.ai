'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Resource {
  id: string; title: string; description: string | null; subject_tag: string | null;
  class_level: string | null; file_name: string | null; file_size_bytes: number | null;
  uploader_name: string; created_at: string; is_saved: boolean;
}

const CLASS_LEVELS = ['All', 'Play Group', 'Nursery', 'LKG', 'UKG'];
const SUBJECTS = ['English', 'Maths', 'Science', 'EVS', 'Art', 'Music', 'Physical Education', 'Other'];

export default function ResourcesPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [resources, setResources] = useState<Resource[]>([]);
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', subject_tag: '', class_level: 'All' });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    load();
  }, [filterSubject, filterLevel]);

  async function load() {
    const params = new URLSearchParams();
    if (filterSubject) params.set('subject', filterSubject);
    if (filterLevel) params.set('class_level', filterLevel);
    try { setResources(await apiGet<Resource[]>(`/api/v1/teacher/resources?${params}`, token)); } catch {}
  }

  async function upload() {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (file && file.size > 5 * 1024 * 1024) { setError('File too large. Maximum size is 5 MB.'); return; }
    setSaving(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('file', file);
      const res = await fetch(`${API_BASE}/api/v1/teacher/resources`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowUpload(false); setForm({ title: '', description: '', subject_tag: '', class_level: 'All' }); setFile(null);
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function save(id: string) {
    await apiPost(`/api/v1/teacher/resources/${id}/save`, {}, token).catch(() => {});
    setResources(prev => prev.map(r => r.id === id ? { ...r, is_saved: true } : r));
  }

  async function deleteResource(id: string) {
    await fetch(`${API_BASE}/api/v1/teacher/resources/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await load();
  }

  const displayed = tab === 'mine' ? resources.filter(r => r.is_saved) : resources;

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-neutral-900">Resource Library</h1>
          <p className="text-xs text-neutral-500">Teaching materials shared by your school</p>
        </div>
        <button onClick={() => setShowUpload(!showUpload)}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors">
          + Upload
        </button>
      </header>

      <div className="p-4 max-w-2xl mx-auto">
        {showUpload && (
          <div className="bg-white border border-neutral-200 rounded-2xl p-4 mb-4 shadow-sm">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">Upload Resource</h2>
            <div className="flex flex-col gap-3">
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value.slice(0, 100) }))}
                placeholder="Title (required)" className="px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-primary-400" />
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value.slice(0, 300) }))}
                rows={2} placeholder="Description (optional)"
                className="px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.subject_tag} onChange={e => setForm(f => ({ ...f, subject_tag: e.target.value }))}
                  className="px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none">
                  <option value="">Subject (optional)</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={form.class_level} onChange={e => setForm(f => ({ ...f, class_level: e.target.value }))}
                  className="px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none">
                  {CLASS_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-neutral-300 rounded-xl cursor-pointer hover:border-primary-400 transition-colors">
                <span className="text-lg">📎</span>
                <span className="text-sm text-neutral-500">{file ? file.name : 'Attach PDF or image (max 5 MB)'}</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              </label>
              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setShowUpload(false)} className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm text-neutral-600">Cancel</button>
                <button onClick={upload} disabled={saving} className="flex-1 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
                  {saving ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <div className="flex bg-white border border-neutral-200 rounded-xl overflow-hidden shrink-0">
            {(['all', 'mine'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${tab === t ? 'bg-primary-600 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}>
                {t === 'all' ? 'All Resources' : 'My Saved'}
              </button>
            ))}
          </div>
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
            className="px-3 py-2 border border-neutral-200 rounded-xl text-xs bg-white focus:outline-none shrink-0">
            <option value="">All subjects</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
            className="px-3 py-2 border border-neutral-200 rounded-xl text-xs bg-white focus:outline-none shrink-0">
            <option value="">All levels</option>
            {CLASS_LEVELS.filter(l => l !== 'All').map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-3">
          {displayed.length === 0 && <p className="text-sm text-neutral-400 text-center py-8">No resources found</p>}
          {displayed.map(r => (
            <div key={r.id} className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-800">{r.title}</p>
                  {r.description && <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{r.description}</p>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {r.subject_tag && <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{r.subject_tag}</span>}
                    {r.class_level && <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{r.class_level}</span>}
                    {r.file_name && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">📎 {r.file_name}</span>}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1.5">By {r.uploader_name} · {r.created_at.split('T')[0]}</p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {!r.is_saved && (
                    <button onClick={() => save(r.id)} className="text-xs text-primary-600 font-medium px-2.5 py-1.5 rounded-lg hover:bg-primary-50 transition-colors">
                      Save
                    </button>
                  )}
                  {r.is_saved && <span className="text-xs text-green-600 font-medium px-2.5 py-1.5">✓ Saved</span>}
                  <button onClick={() => deleteResource(r.id)} className="text-xs text-red-500 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

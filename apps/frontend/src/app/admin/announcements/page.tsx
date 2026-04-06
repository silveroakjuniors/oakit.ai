'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge, EmptyState } from '@/components/ui';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface Announcement {
  id: string; title: string; body: string; target_audience: string;
  expires_at: string | null; created_at: string; author_name: string;
}
interface Class { id: string; name: string; }

const audienceVariant: Record<string, 'success' | 'info' | 'amber' | 'neutral'> = {
  all: 'success', teachers: 'info', parents: 'amber', class: 'neutral',
};

export default function AnnouncementsPage() {
  const token = getToken() || '';
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', target_audience: 'all', target_class_id: '', expires_at: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    load();
    apiGet<Class[]>('/api/v1/admin/classes', token).then(setClasses).catch(() => {});
  }, []);

  async function load() {
    try { setAnnouncements(await apiGet<Announcement[]>('/api/v1/admin/announcements', token)); } catch {}
  }

  async function submit() {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.body.trim()) { setError('Message is required'); return; }
    setError(''); setSaving(true);
    try {
      await apiPost('/api/v1/admin/announcements', {
        ...form,
        target_class_id: form.target_audience === 'class' ? form.target_class_id : undefined,
        expires_at: form.expires_at || undefined,
      }, token);
      setForm({ title: '', body: '', target_audience: 'all', target_class_id: '', expires_at: '' });
      setShowForm(false);
      setSuccess('Announcement published successfully');
      setTimeout(() => setSuccess(''), 4000);
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function deleteAnn(id: string) {
    await fetch(`${API_BASE}/api/v1/admin/announcements/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await load();
  }

  const isExpired = (a: Announcement) => !!a.expires_at && new Date(a.expires_at) < new Date();

  return (
    <div className="p-5 lg:p-7 max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Announcements</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Broadcast messages to teachers and parents</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">+ New</Button>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium animate-fade-in">
          ✓ {success}
        </div>
      )}

      {showForm && (
        <Card padding="md" className="animate-fade-slide-up">
          <h2 className="text-sm font-semibold text-neutral-800 mb-4">New Announcement</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1 block">Title <span className="text-neutral-400">({form.title.length}/100)</span></label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value.slice(0, 100) }))}
                placeholder="e.g. School closed on Friday"
                className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors ${error && !form.title ? 'border-red-400 bg-red-50/30' : 'border-neutral-200 focus:border-primary-400'}`} />
              {error && !form.title && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1 block">Message <span className="text-neutral-400">({form.body.length}/1000)</span></label>
              <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value.slice(0, 1000) }))}
                rows={4} placeholder="Write your announcement here..."
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-primary-400 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">Audience</label>
                <select value={form.target_audience} onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
                  <option value="all">Everyone</option>
                  <option value="teachers">Teachers only</option>
                  <option value="parents">Parents only</option>
                  <option value="class">Specific class</option>
                </select>
              </div>
              {form.target_audience === 'class' && (
                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Class</label>
                  <select value={form.target_class_id} onChange={e => setForm(f => ({ ...f, target_class_id: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none">
                    <option value="">Select class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">Expires (optional)</label>
                <input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
              </div>
            </div>
            {error && form.title && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
              <Button onClick={submit} loading={saving} disabled={!form.title || !form.body} className="flex-1">Publish</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {announcements.length === 0 && (
          <EmptyState emoji="📢" heading="No announcements yet"
            description="Create your first announcement to communicate with teachers and parents."
            action={{ label: '+ New Announcement', onClick: () => setShowForm(true) }} />
        )}
        {announcements.map(a => (
          <Card key={a.id} padding="sm" className={`border-l-4 ${isExpired(a) ? 'opacity-60 border-neutral-300' : 'border-primary-400'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-semibold text-neutral-800">{a.title}</p>
                  <Badge label={a.target_audience} variant={audienceVariant[a.target_audience] ?? 'neutral'} size="sm" />
                  {isExpired(a) && <Badge label="Expired" variant="danger" size="sm" />}
                </div>
                <p className="text-sm text-neutral-600 line-clamp-2">{a.body}</p>
                <p className="text-xs text-neutral-400 mt-1.5">
                  By {a.author_name} · {a.created_at.split('T')[0]}
                  {a.expires_at && ` · Expires ${a.expires_at.split('T')[0]}`}
                </p>
              </div>
              <button onClick={() => deleteAnn(a.id)}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors shrink-0 min-h-[32px]">
                Delete
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

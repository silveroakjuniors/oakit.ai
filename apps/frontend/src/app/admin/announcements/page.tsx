'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge, EmptyState } from '@/components/ui';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { X, Megaphone, ChevronDown, ChevronUp } from 'lucide-react';

interface Announcement {
  id: string; title: string; body: string; target_audience: string;
  target_class_id?: string | null;
  expires_at: string | null; created_at: string; author_name: string;
}
interface Class { id: string; name: string; }

const audienceVariant: Record<string, 'success' | 'info' | 'amber' | 'neutral'> = {
  all: 'success', teachers: 'info', parents: 'amber', class: 'neutral',
};
const audienceLabel: Record<string, string> = {
  all: 'Everyone', teachers: 'Teachers', parents: 'Parents', class: 'Class',
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
  const [expanded, setExpanded] = useState<string | null>(null);

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
    if (form.target_audience === 'class' && !form.target_class_id) { setError('Please select a class'); return; }
    setError(''); setSaving(true);
    try {
      await apiPost('/api/v1/admin/announcements', {
        title: form.title.trim(),
        body: form.body.trim(),
        target_audience: form.target_audience,
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
    if (!confirm('Delete this announcement?')) return;
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
        <Button onClick={() => { setShowForm(!showForm); setError(''); }} size="sm">
          {showForm ? 'Cancel' : '+ New'}
        </Button>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium">
          {success}
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
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-primary-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1 block">Message <span className="text-neutral-400">({form.body.length}/1000)</span></label>
              <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value.slice(0, 1000) }))}
                rows={4} placeholder="Write your announcement here..."
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-primary-400 resize-none" />
            </div>

            {/* Audience — full width */}
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1 block">Audience</label>
              <select value={form.target_audience} onChange={e => setForm(f => ({ ...f, target_audience: e.target.value, target_class_id: '' }))}
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
                <option value="all">Everyone (teachers + parents)</option>
                <option value="teachers">Teachers only</option>
                <option value="parents">Parents only</option>
                <option value="class">Specific class (parents of that class)</option>
              </select>
            </div>

            {/* Class selector — only when class is selected */}
            {form.target_audience === 'class' && (
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">Select Class</label>
                <select value={form.target_class_id} onChange={e => setForm(f => ({ ...f, target_class_id: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
                  <option value="">-- Select a class --</option>
                  {classes.length === 0 && <option disabled>Loading classes...</option>}
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* Expiry — always shown */}
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1 block">Expires on (optional)</label>
              <input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" onClick={() => { setShowForm(false); setError(''); }} className="flex-1">Cancel</Button>
              <Button onClick={submit} loading={saving} disabled={!form.title.trim() || !form.body.trim()} className="flex-1">Publish</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {announcements.length === 0 && (
          <EmptyState
            title="No announcements yet"
            description="Create your first announcement to communicate with teachers and parents."
            action={{ label: '+ New Announcement', onClick: () => setShowForm(true) }} />
        )}
        {announcements.map(a => {
          const exp = isExpired(a);
          const isOpen = expanded === a.id;
          const classLabel = a.target_audience === 'class'
            ? (classes.find(c => c.id === a.target_class_id)?.name ?? 'Class')
            : null;
          return (
            <Card key={a.id} padding="sm" className={`border-l-4 ${exp ? 'opacity-60 border-neutral-300' : 'border-primary-400'}`}>
              {/* Clickable header row */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(isOpen ? null : a.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(isOpen ? null : a.id); }}
                className="flex items-start justify-between gap-3 cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-neutral-800">{a.title}</p>
                    <Badge label={classLabel ?? (audienceLabel[a.target_audience] ?? a.target_audience)} variant={audienceVariant[a.target_audience] ?? 'neutral'} size="sm" />
                    {exp && <Badge label="Expired" variant="danger" size="sm" />}
                  </div>
                  <p className={`text-sm text-neutral-600 ${isOpen ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>{a.body}</p>
                  {isOpen && (
                    <p className="text-xs text-neutral-400 mt-2">
                      By {a.author_name} &middot; {new Date(a.created_at.split('T')[0] + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {a.expires_at && ` · Expires ${a.expires_at.split('T')[0]}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isOpen ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
                  <button
                    onClick={e => { e.stopPropagation(); deleteAnn(a.id); }}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors ml-1 min-h-[32px]">
                    Delete
                  </button>
                </div>
              </div>
              {!isOpen && (
                <p className="text-xs text-neutral-400 mt-1.5">
                  By {a.author_name} &middot; {a.created_at.split('T')[0]}
                  {a.expires_at && ` · Expires ${a.expires_at.split('T')[0]}`}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface AuditLog { id: string; actor_name: string; actor_role: string; action: string; metadata: Record<string, any>; expires_at: string | null; created_at: string; }
interface AuditResp { logs: AuditLog[]; total: number; page: number; pages: number; }
interface Message { id: string; sender_role: string; body: string; sent_at: string; read_at: string | null; teacher_name: string; parent_name: string; parent_mobile: string; student_name: string; class_name: string; section_label: string; }
interface MsgResp { messages: Message[]; total: number; page: number; pages: number; }
interface AiQuery { id: string; actor_name: string; actor_mobile: string | null; actor_role: string; metadata: { query: string; outcome: string }; created_at: string; }
interface AiQueryResp { queries: AiQuery[]; total: number; page: number; pages: number; }

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  upload_note:     { label: 'Note Uploaded',     color: 'bg-blue-100 text-blue-700',     icon: '📎' },
  upload_photo:    { label: 'Photo Uploaded',    color: 'bg-purple-100 text-purple-700', icon: '🖼️' },
  upload_logo:     { label: 'Logo Uploaded',     color: 'bg-amber-100 text-amber-700',   icon: '🏫' },
  upload_resource: { label: 'Resource Uploaded', color: 'bg-green-100 text-green-700',   icon: '📄' },
  file_deleted:    { label: 'File Deleted',      color: 'bg-red-100 text-red-600',       icon: '🗑️' },
  message_sent:    { label: 'Message Sent',      color: 'bg-neutral-100 text-neutral-600', icon: '💬' },
};

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  allowed:               { label: 'Allowed',          color: 'bg-emerald-100 text-emerald-700' },
  blocked_offtopic:      { label: 'Off-topic',         color: 'bg-amber-100 text-amber-700' },
  blocked_inappropriate: { label: '⚠ Inappropriate',  color: 'bg-red-100 text-red-700' },
  blocked_limit:         { label: 'Limit reached',     color: 'bg-neutral-100 text-neutral-500' },
};

function fmt(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AuditPage() {
  const token = getToken() || '';
  const [tab, setTab] = useState<'ai' | 'uploads' | 'messages'>('ai');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [aiQueries, setAiQueries] = useState<AiQuery[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [outcomeFilter, setOutcomeFilter] = useState('');

  const loadLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const data = await apiGet<AuditResp>(`/api/v1/admin/audit?type=uploads&page=${p}&limit=50`, token);
      setLogs(data.logs); setTotal(data.total); setPage(data.page); setPages(data.pages);
    } catch { } finally { setLoading(false); }
  }, [token]);

  const loadMsgs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const data = await apiGet<MsgResp>(`/api/v1/admin/audit/messages?page=${p}&limit=50`, token);
      setMsgs(data.messages); setTotal(data.total); setPage(data.page); setPages(data.pages);
    } catch { } finally { setLoading(false); }
  }, [token]);

  const loadAi = useCallback(async (p = 1, outcome = outcomeFilter) => {
    setLoading(true); setSelectedIds(new Set());
    try {
      const q = outcome ? `&outcome=${encodeURIComponent(outcome)}` : '';
      const data = await apiGet<AiQueryResp>(`/api/v1/admin/audit/ai-queries?page=${p}&limit=50${q}`, token);
      setAiQueries(data.queries); setTotal(data.total); setPage(data.page); setPages(data.pages);
    } catch { } finally { setLoading(false); }
  }, [token, outcomeFilter]);

  useEffect(() => {
    if (tab === 'uploads') loadLogs(1);
    else if (tab === 'messages') loadMsgs(1);
    else loadAi(1);
  }, [tab]);

  async function runCleanup() {
    setCleaning(true); setStatusMsg('');
    try {
      const r = await apiPost<any>('/api/v1/admin/audit/cleanup', {}, token);
      setStatusMsg(`✓ Cleanup done — ${r.deleted} file(s) deleted`);
      loadLogs(1);
    } catch (e: any) { setStatusMsg(e.message || 'Cleanup failed'); }
    finally { setCleaning(false); }
  }

  async function deleteSelected() {
    if (selectedIds.size === 0 || !confirm(`Delete ${selectedIds.size} log(s)?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/audit/ai-queries`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatusMsg(`✓ ${data.message}`);
      loadAi(1);
    } catch (e: any) { setStatusMsg(e.message || 'Delete failed'); }
    finally { setDeleting(false); }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const paginate = (p: number) => tab === 'uploads' ? loadLogs(p) : tab === 'messages' ? loadMsgs(p) : loadAi(p);

  return (
    <div className="p-5 lg:p-7 max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Audit Log</h1>
          <p className="text-sm text-neutral-500 mt-0.5">AI queries, uploads, and communications</p>
        </div>
        <div className="flex gap-2">
          {tab === 'uploads' && (
            <button onClick={runCleanup} disabled={cleaning}
              className="text-xs px-4 py-2 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
              {cleaning ? '⏳ Cleaning...' : '🗑️ Run Cleanup'}
            </button>
          )}
          {tab === 'ai' && selectedIds.size > 0 && (
            <button onClick={deleteSelected} disabled={deleting}
              className="text-xs px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
              {deleting ? '⏳...' : `🗑️ Delete ${selectedIds.size}`}
            </button>
          )}
        </div>
      </div>

      {statusMsg && <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm text-emerald-700">{statusMsg}</div>}

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 w-fit">
        {([['ai', '🤖 AI Queries'], ['uploads', '📁 Uploads'], ['messages', '💬 Messages']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-sm text-neutral-400 py-8 text-center">Loading...</div> : (
        <>
          {/* ── AI Queries ── */}
          {tab === 'ai' && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-neutral-400">{total} total</span>
                <select value={outcomeFilter} onChange={e => { setOutcomeFilter(e.target.value); loadAi(1, e.target.value); }}
                  className="text-xs px-3 py-1.5 border border-neutral-200 rounded-lg bg-white focus:outline-none">
                  <option value="">All outcomes</option>
                  <option value="blocked_inappropriate">⚠ Inappropriate only</option>
                  <option value="blocked_offtopic">Off-topic only</option>
                  <option value="allowed">Allowed only</option>
                  <option value="blocked_limit">Limit reached</option>
                </select>
                {selectedIds.size > 0 && <span className="text-xs text-neutral-500">{selectedIds.size} selected</span>}
              </div>
              <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-xs text-neutral-500">
                      <th className="px-4 py-3 w-8">
                        <input type="checkbox" checked={selectedIds.size === aiQueries.length && aiQueries.length > 0}
                          onChange={() => setSelectedIds(selectedIds.size === aiQueries.length ? new Set() : new Set(aiQueries.map(q => q.id)))}
                          className="rounded" />
                      </th>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Query</th>
                      <th className="px-4 py-3 font-medium">Outcome</th>
                      <th className="px-4 py-3 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiQueries.map(q => {
                      const out = OUTCOME_LABELS[q.metadata?.outcome] || { label: q.metadata?.outcome, color: 'bg-neutral-100 text-neutral-600' };
                      const bad = q.metadata?.outcome === 'blocked_inappropriate';
                      return (
                        <tr key={q.id} className={`border-b border-neutral-50 ${bad ? 'bg-red-50/30' : selectedIds.has(q.id) ? 'bg-blue-50/30' : 'hover:bg-neutral-50/50'}`}>
                          <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(q.id)} onChange={() => toggleSelect(q.id)} className="rounded" /></td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-neutral-800">{q.actor_name || '—'}</p>
                            {q.actor_mobile && <p className="text-xs text-neutral-400">{q.actor_mobile}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-neutral-500 capitalize">{q.actor_role}</td>
                          <td className="px-4 py-3 text-xs max-w-xs">
                            <span className={`line-clamp-2 ${bad ? 'text-red-700 font-medium' : 'text-neutral-700'}`}>
                              {bad ? '⚠ ' : ''}{q.metadata?.query || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${out.color}`}>{out.label}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-neutral-400 whitespace-nowrap">{fmt(q.created_at)}</td>
                        </tr>
                      );
                    })}
                    {aiQueries.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-neutral-400 text-sm">No AI queries logged yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Uploads ── */}
          {tab === 'uploads' && (
            <>
              <div className="text-xs text-neutral-400">{total} total entries</div>
              <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-xs text-neutral-500">
                      <th className="px-4 py-3 font-medium">Action</th>
                      <th className="px-4 py-3 font-medium">By</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Details</th>
                      <th className="px-4 py-3 font-medium">Expires</th>
                      <th className="px-4 py-3 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => {
                      const a = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-neutral-100 text-neutral-600', icon: '•' };
                      return (
                        <tr key={log.id} className="border-b border-neutral-50 hover:bg-neutral-50/50">
                          <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${a.color}`}>{a.icon} {a.label}</span></td>
                          <td className="px-4 py-3 text-neutral-700 font-medium text-xs">{log.actor_name || '—'}</td>
                          <td className="px-4 py-3 text-neutral-500 capitalize text-xs">{log.actor_role || '—'}</td>
                          <td className="px-4 py-3 text-neutral-500 text-xs max-w-xs">
                            {log.metadata?.file_name && <span className="block truncate">📎 {log.metadata.file_name}</span>}
                            {log.metadata?.auto_deleted && <span className="text-red-500">Auto-deleted</span>}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {log.expires_at ? <span className={new Date(log.expires_at) < new Date() ? 'text-red-500' : 'text-neutral-400'}>{fmt(log.expires_at)}</span> : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-neutral-400 whitespace-nowrap">{fmt(log.created_at)}</td>
                        </tr>
                      );
                    })}
                    {logs.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-neutral-400 text-sm">No upload activity yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Messages ── */}
          {tab === 'messages' && (
            <>
              <div className="text-xs text-neutral-400">{total} total messages</div>
              <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-xs text-neutral-500">
                      <th className="px-4 py-3 font-medium">From</th>
                      <th className="px-4 py-3 font-medium">Teacher</th>
                      <th className="px-4 py-3 font-medium">Parent</th>
                      <th className="px-4 py-3 font-medium">Student</th>
                      <th className="px-4 py-3 font-medium">Message</th>
                      <th className="px-4 py-3 font-medium">Read</th>
                      <th className="px-4 py-3 font-medium">Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {msgs.map(msg => (
                      <tr key={msg.id} className="border-b border-neutral-50 hover:bg-neutral-50/50">
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${msg.sender_role === 'teacher' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {msg.sender_role === 'teacher' ? '👩‍🏫 Teacher' : '👨‍👩‍👧 Parent'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-700 text-xs">{msg.teacher_name}</td>
                        <td className="px-4 py-3 text-neutral-700 text-xs"><span className="block">{msg.parent_name || '—'}</span><span className="text-neutral-400">{msg.parent_mobile}</span></td>
                        <td className="px-4 py-3 text-neutral-600 text-xs"><span className="block">{msg.student_name}</span><span className="text-neutral-400">{msg.class_name} {msg.section_label}</span></td>
                        <td className="px-4 py-3 text-neutral-600 text-xs max-w-xs"><span className="line-clamp-2">{msg.body}</span></td>
                        <td className="px-4 py-3 text-xs">{msg.read_at ? <span className="text-emerald-600">✓ Read</span> : <span className="text-amber-500">Unread</span>}</td>
                        <td className="px-4 py-3 text-xs text-neutral-400 whitespace-nowrap">{fmt(msg.sent_at)}</td>
                      </tr>
                    ))}
                    {msgs.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-neutral-400 text-sm">No messages yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => paginate(page - 1)} className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200 disabled:opacity-40 hover:bg-neutral-50">← Prev</button>
          <span className="text-xs text-neutral-500">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => paginate(page + 1)} className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200 disabled:opacity-40 hover:bg-neutral-50">Next →</button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import OakitLogo from '@/components/OakitLogo';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Thread {
  parent_id: string; student_id: string; parent_name: string; parent_mobile: string;
  student_name: string; last_message: string; last_sent_at: string; last_sender: string;
  unread_count: number;
}
interface Msg {
  id: string; sender_role: string; body: string; sent_at: string;
  parent_name: string; teacher_name: string; read_at: string | null;
}

export default function TeacherMessagesPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<Thread | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    loadThreads();
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function loadThreads() {
    try { setThreads(await apiGet<Thread[]>('/api/v1/teacher/messages', token)); } catch {}
  }

  async function openThread(t: Thread) {
    setActive(t);
    try {
      setMsgs(await apiGet<Msg[]>(`/api/v1/teacher/messages/${t.parent_id}/${t.student_id}`, token));
      await loadThreads(); // refresh unread counts
    } catch {}
  }

  async function send() {
    if (!body.trim() || !active || sending) return;
    if (body.length > 1000) { setError('Message too long (max 1000 characters)'); return; }
    setSending(true); setError('');
    try {
      await apiPost(`/api/v1/teacher/messages/${active.parent_id}/${active.student_id}`, { body: body.trim() }, token);
      setBody('');
      setMsgs(await apiGet<Msg[]>(`/api/v1/teacher/messages/${active.parent_id}/${active.student_id}`, token));
    } catch (e: any) { setError(e.message || 'Failed to send'); }
    finally { setSending(false); }
  }

  const totalUnread = threads.reduce((s, t) => s + Number(t.unread_count), 0);

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="text-white px-4 py-3 flex items-center justify-between shrink-0"
        style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/60 hover:text-white text-lg">←</button>
          <OakitLogo size="xs" variant="light" />
          <span className="text-sm text-white/80 font-medium">Messages</span>
          {totalUnread > 0 && <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{totalUnread}</span>}
        </div>
        <button onClick={() => { clearToken(); router.push('/login'); }} className="text-white/50 text-xs">Sign out</button>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Thread list */}
        <div className={`${active ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 border-r border-neutral-200 bg-white overflow-y-auto`}>
          {threads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-sm text-neutral-500">No messages yet</p>
              <p className="text-xs text-neutral-400 mt-1">Start a conversation from the Students page</p>
            </div>
          )}
          {threads.map(t => (
            <button key={`${t.parent_id}-${t.student_id}`} onClick={() => openThread(t)}
              className={`flex items-start gap-3 px-4 py-3.5 border-b border-neutral-100 text-left hover:bg-neutral-50 transition-colors ${active?.parent_id === t.parent_id && active?.student_id === t.student_id ? 'bg-primary-50' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 shrink-0">
                {t.parent_name?.[0] ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-neutral-800 truncate">{t.parent_name || t.parent_mobile}</p>
                  <p className="text-xs text-neutral-400 shrink-0 ml-2">{t.last_sent_at?.split('T')[0]}</p>
                </div>
                <p className="text-xs text-neutral-500 truncate">{t.student_name}</p>
                <p className="text-xs text-neutral-400 truncate mt-0.5">{t.last_message}</p>
              </div>
              {Number(t.unread_count) > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">{t.unread_count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Conversation */}
        {active ? (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Conversation header */}
            <div className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center gap-3 shrink-0">
              <button onClick={() => setActive(null)} className="lg:hidden text-neutral-500 text-lg">←</button>
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 shrink-0">
                {active.parent_name?.[0] ?? '?'}
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-800">{active.parent_name || active.parent_mobile}</p>
                <p className="text-xs text-neutral-500">{active.student_name}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {msgs.map(m => (
                <div key={m.id} className={`flex ${m.sender_role === 'teacher' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${m.sender_role === 'teacher' ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-white text-neutral-800 shadow-sm border border-neutral-100 rounded-bl-sm'}`}>
                    <p>{m.body}</p>
                    <p className={`text-[10px] mt-1 ${m.sender_role === 'teacher' ? 'text-white/60' : 'text-neutral-400'}`}>
                      {new Date(m.sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      {m.sender_role === 'teacher' && m.read_at && ' · Read'}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t border-neutral-200 px-4 py-3 shrink-0">
              {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
              <div className="flex gap-2">
                <textarea value={body} onChange={e => setBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type a message..." rows={1} maxLength={1000}
                  className="flex-1 resize-none px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
                  style={{ maxHeight: 100 }} />
                <button onClick={send} disabled={!body.trim() || sending}
                  className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors shrink-0">
                  {sending ? '...' : 'Send'}
                </button>
              </div>
              {body.length > 900 && <p className="text-xs text-neutral-400 mt-1 text-right">{body.length}/1000</p>}
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center text-neutral-400">
            <div className="text-center">
              <p className="text-4xl mb-2">💬</p>
              <p className="text-sm">Select a conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

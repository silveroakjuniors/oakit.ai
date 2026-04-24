'use client';
import { useState, useEffect, useRef } from 'react';
import { ChevronRight, Loader2, Send, MessageCircle, Plus } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import type { ParentMessage } from '../types';

const P = {
  brand: '#1F7A5A', brandDark: '#166A4D', brandSoft: '#E8F3EF', brandBorder: '#A7D4C0',
  bg: '#F8FAFC', card: '#F8FAFC', border: '#E4E4E7',
  text: '#18181B', textSub: '#3F3F46', textMuted: '#71717A',
};

const cardStyle: React.CSSProperties = {
  background: P.card, border: `1px solid ${P.border}`,
  borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden',
};

export default function MessagesTab({ threads, token, onRefresh }: {
  threads: ParentMessage[]; token: string; onRefresh: () => void;
}) {
  const [active, setActive]           = useState<ParentMessage | null>(null);
  const [msgs, setMsgs]               = useState<any[]>([]);
  const [reply, setReply]             = useState('');
  const [sending, setSending]         = useState(false);
  const [showNewMsg, setShowNewMsg]   = useState(false);
  const [newMsgBody, setNewMsgBody]   = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [sendingNew, setSendingNew]   = useState(false);
  const [teachers, setTeachers]       = useState<any[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<any[]>('/api/v1/parent/message-teachers', token).then(setTeachers).catch(() => {});
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function openThread(thread: ParentMessage) {
    setActive(thread);
    try {
      const data = await apiGet<any[]>(`/api/v1/parent/messages/${thread.teacher_id}/${thread.student_id}`, token);
      setMsgs(data || []);
    } catch { setMsgs([]); }
  }

  async function sendReply() {
    if (!reply.trim() || !active || sending) return;
    setSending(true);
    try {
      await apiPost(`/api/v1/parent/messages/${active.teacher_id}/${active.student_id}/reply`, { body: reply.trim() }, token);
      setReply('');
      const data = await apiGet<any[]>(`/api/v1/parent/messages/${active.teacher_id}/${active.student_id}`, token);
      setMsgs(data || []);
    } catch {} finally { setSending(false); }
  }

  async function sendNewMessage() {
    if (!newMsgBody.trim() || !selectedTeacher || !selectedStudent || sendingNew) return;
    setSendingNew(true);
    try {
      await apiPost(`/api/v1/parent/messages/${selectedTeacher}/${selectedStudent}/reply`, { body: newMsgBody.trim() }, token);
      setShowNewMsg(false); setNewMsgBody(''); setSelectedTeacher(''); setSelectedStudent('');
      onRefresh();
      const th = teachers.find(t => t.teacher_id === selectedTeacher && t.student_id === selectedStudent);
      if (th) {
        const thread: ParentMessage = { teacher_id: th.teacher_id, student_id: th.student_id, teacher_name: th.teacher_name, student_name: th.student_name, last_message: newMsgBody, last_sent_at: new Date().toISOString(), last_sender: 'parent', unread_count: 0 };
        await openThread(thread);
      }
    } catch {} finally { setSendingNew(false); }
  }

  // ── Thread view ──────────────────────────────────────────────────────────────
  if (active) {
    return (
      <div className="flex flex-col overflow-hidden"
        style={{ ...cardStyle, height: 'calc(100vh - 280px)', minHeight: 480 }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ background: P.brandSoft, borderBottom: `1px solid ${P.brandBorder}` }}>
          <button onClick={() => setActive(null)}
            className="hover:bg-white/60 rounded-lg p-1 transition-colors"
            style={{ color: P.brandDark }}>
            <ChevronRight size={20} className="rotate-180" />
          </button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0"
            style={{ background: P.brand }}>
            {active.teacher_name?.[0] ?? 'T'}
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: P.brandDark }}>{active.teacher_name}</p>
            <p className="text-xs" style={{ color: P.brand }}>{active.student_name}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: P.bg }}>
          {msgs.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: P.textMuted }}>
              No messages yet. Send the first message below.
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.sender_role === 'parent' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%] px-4 py-2.5 text-sm"
                style={m.sender_role === 'parent'
                  ? { background: P.brand, color: '#fff', borderRadius: '16px 16px 4px 16px' }
                  : { background: P.card, color: P.text, borderRadius: '16px 16px 16px 4px', border: `1px solid ${P.border}`, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <p>{m.body}</p>
                <p className="text-[10px] mt-1" style={{ color: m.sender_role === 'parent' ? 'rgba(255,255,255,0.6)' : P.textMuted }}>
                  {new Date(m.sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 flex gap-2 flex-shrink-0"
          style={{ background: P.card, borderTop: `1px solid ${P.border}` }}>
          <input value={reply} onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendReply(); }}
            placeholder="Type a message…" maxLength={1000}
            className="flex-1 px-3 py-2.5 text-sm rounded-xl outline-none"
            style={{ background: P.bg, border: `1.5px solid ${P.border}`, color: P.text }} />
          <button onClick={sendReply} disabled={!reply.trim() || sending}
            className="px-4 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-40 flex items-center gap-1.5 min-w-[52px] justify-center text-white"
            style={{ background: P.brand }}>
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    );
  }

  // ── Thread list ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: P.text }}>Messages</p>
        <button onClick={() => setShowNewMsg(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-xl text-white transition-opacity hover:opacity-90"
          style={{ background: P.brand }}>
          <Plus size={14} strokeWidth={2} /> New Message
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
        style={{ background: P.brandSoft, border: `1px solid ${P.brandBorder}` }}>
        <MessageCircle size={14} strokeWidth={1.75} className="shrink-0 mt-0.5" style={{ color: P.brand }} />
        <p className="text-xs leading-relaxed" style={{ color: P.brandDark }}>
          All communication with teachers happens here. You'll get a notification when a teacher replies.
        </p>
      </div>

      {/* New message form */}
      {showNewMsg && (
        <div className="p-4 space-y-3" style={cardStyle}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: P.text }}>Message a Teacher</p>
            <button onClick={() => setShowNewMsg(false)} style={{ color: P.textMuted }}>✕</button>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: P.textMuted }}>Select Teacher &amp; Child</label>
            <select value={`${selectedTeacher}|${selectedStudent}`}
              onChange={e => { const [tid, sid] = e.target.value.split('|'); setSelectedTeacher(tid); setSelectedStudent(sid); }}
              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
              style={{ background: P.bg, border: `1.5px solid ${P.border}`, color: P.text }}>
              <option value="|">Select teacher…</option>
              {teachers.map(t => (
                <option key={`${t.teacher_id}|${t.student_id}`} value={`${t.teacher_id}|${t.student_id}`}>
                  {t.teacher_name} — {t.student_name} ({t.class_name})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: P.textMuted }}>Message</label>
            <textarea value={newMsgBody} onChange={e => setNewMsgBody(e.target.value.slice(0, 1000))}
              rows={3} placeholder="Write your message to the teacher…"
              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none resize-none"
              style={{ background: P.bg, border: `1.5px solid ${P.border}`, color: P.text }} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowNewMsg(false)}
              className="flex-1 py-2.5 text-sm rounded-xl"
              style={{ background: P.bg, color: P.textSub, border: `1px solid ${P.border}` }}>Cancel</button>
            <button onClick={sendNewMessage} disabled={!newMsgBody.trim() || !selectedTeacher || sendingNew}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 text-white"
              style={{ background: P.brand }}>
              {sendingNew ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {threads.length === 0 && !showNewMsg && (
        <div className="p-12 text-center" style={cardStyle}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: P.brandSoft }}>
            <MessageCircle size={28} strokeWidth={1.5} style={{ color: P.brand }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: P.text }}>No messages yet</p>
          <p className="text-sm mt-1 mb-5" style={{ color: P.textMuted }}>Start a conversation with your child's teacher</p>
          <button onClick={() => setShowNewMsg(true)}
            className="px-5 py-2.5 text-sm font-semibold rounded-xl text-white"
            style={{ background: P.brand }}>
            Send First Message
          </button>
        </div>
      )}

      {/* Thread list */}
      {threads.map(th => (
        <button key={`${th.teacher_id}-${th.student_id}`} onClick={() => openThread(th)}
          className="w-full p-4 text-left flex items-start gap-3 transition-colors hover:bg-neutral-50"
          style={{ ...cardStyle, display: 'flex' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0"
            style={{ background: Number(th.unread_count) > 0 ? P.brand : P.textMuted }}>
            {th.teacher_name?.[0] ?? 'T'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm" style={{ color: P.text }}>{th.teacher_name}</p>
              <p className="text-xs" style={{ color: P.textMuted }}>{(th.last_sent_at || '').split('T')[0]}</p>
            </div>
            <p className="text-xs" style={{ color: P.textMuted }}>{th.student_name}</p>
            <p className="text-xs truncate mt-0.5" style={{ color: P.textSub }}>{th.last_message}</p>
          </div>
          {Number(th.unread_count) > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
              style={{ background: '#EF4444' }}>{th.unread_count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

'use client';
import { useState, useEffect, useRef } from 'react';
import { ChevronRight, Loader2, MessageSquare, Send } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import type { ParentMessage } from '../types';

export default function MessagesTab({ threads, token, onRefresh }: {
  threads: ParentMessage[]; token: string; onRefresh: () => void;
}) {
  const [active, setActive] = useState<ParentMessage | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [newMsgBody, setNewMsgBody] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [sendingNew, setSendingNew] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);
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
    } catch {}
    finally { setSending(false); }
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
    } catch {}
    finally { setSendingNew(false); }
  }

  if (active) {
    return (
      <div className="flex flex-col h-[calc(100vh-280px)] lg:h-[600px] bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-[#0f2417] text-white">
          <button onClick={() => setActive(null)} className="text-white/60 hover:text-white">
            <ChevronRight size={20} className="rotate-180" />
          </button>
          <div>
            <p className="font-bold text-sm">{active.teacher_name}</p>
            <p className="text-xs text-white/50">{active.student_name}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50/50">
          {msgs.length === 0 && <div className="text-center py-8 text-neutral-400 text-sm">No messages yet. Send the first message below.</div>}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.sender_role === 'parent' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.sender_role === 'parent' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white text-neutral-800 shadow-sm border border-neutral-100 rounded-bl-sm'}`}>
                <p>{m.body}</p>
                <p className={`text-[10px] mt-1 ${m.sender_role === 'parent' ? 'text-white/60' : 'text-neutral-400'}`}>
                  {new Date(m.sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="px-4 py-3 bg-white border-t border-neutral-100 flex gap-2">
          <input value={reply} onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendReply(); }}
            placeholder="Type a message..." maxLength={1000}
            className="flex-1 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          <button onClick={sendReply} disabled={!reply.trim() || sending}
            className="px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center gap-1.5 min-w-[52px] justify-center">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-neutral-800">Messages</h2>
        <button onClick={() => setShowNewMsg(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors">
          <MessageSquare size={16} /> New Message
        </button>
      </div>

      {showNewMsg && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-800">Message a Teacher</p>
            <button onClick={() => setShowNewMsg(false)} className="text-neutral-400 hover:text-neutral-600">✕</button>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600 mb-1 block">Select Teacher &amp; Child</label>
            <select value={`${selectedTeacher}|${selectedStudent}`}
              onChange={e => { const [tid, sid] = e.target.value.split('|'); setSelectedTeacher(tid); setSelectedStudent(sid); }}
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
              <option value="|">Select teacher...</option>
              {teachers.map(t => (
                <option key={`${t.teacher_id}|${t.student_id}`} value={`${t.teacher_id}|${t.student_id}`}>
                  {t.teacher_name} — {t.student_name} ({t.class_name})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600 mb-1 block">Message</label>
            <textarea value={newMsgBody} onChange={e => setNewMsgBody(e.target.value.slice(0, 1000))}
              rows={3} placeholder="Write your message to the teacher..."
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowNewMsg(false)} className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
            <button onClick={sendNewMessage} disabled={!newMsgBody.trim() || !selectedTeacher || sendingNew}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
              {sendingNew ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send
            </button>
          </div>
        </div>
      )}

      {threads.length === 0 && !showNewMsg ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-neutral-100 shadow-sm">
          <MessageSquare size={40} className="text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500 font-medium">No messages yet</p>
          <p className="text-xs text-neutral-400 mt-1 mb-4">Start a conversation with your child&apos;s teacher</p>
          <button onClick={() => setShowNewMsg(true)}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors">
            Send First Message
          </button>
        </div>
      ) : threads.map(th => (
        <button key={`${th.teacher_id}-${th.student_id}`} onClick={() => openThread(th)}
          className="w-full bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm text-left flex items-start gap-3 hover:shadow-md transition-all">
          <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 shrink-0">{th.teacher_name?.[0] ?? 'T'}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="font-bold text-neutral-800 text-sm">{th.teacher_name}</p>
              <p className="text-xs text-neutral-400">{th.last_sent_at?.split('T')[0]}</p>
            </div>
            <p className="text-xs text-neutral-500">{th.student_name}</p>
            <p className="text-xs text-neutral-400 truncate mt-0.5">{th.last_message}</p>
          </div>
          {Number(th.unread_count) > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">{th.unread_count}</span>}
        </button>
      ))}
    </div>
  );
}

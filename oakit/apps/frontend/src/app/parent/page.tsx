'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Calendar, TrendingUp, Sparkles, MessageSquare, Bell,
  LogOut, BookOpen, Clock, CheckCircle2, AlertCircle, User,
  ChevronRight, Send, Loader2, RefreshCw
} from 'lucide-react';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import OakitLogo from '@/components/OakitLogo';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Child { id: string; name: string; class_name: string; section_label: string; section_id: string; class_id: string; photo_url?: string; }
interface NoteItem { id: string; note_text: string | null; file_name: string | null; file_size: number | null; expires_at: string; created_at: string; }
interface ChildFeed {
  student_id: string; name: string; class_name: string; section_label: string;
  attendance: { status: string; is_late: boolean; arrived_at: string | null } | null;
  topics: string[]; plan_status: string | null; special_label: string | null;
  homework: { formatted_text: string; raw_text: string } | null;
  notes: NoteItem[];
}
interface AttendanceData {
  records: { attend_date: string; status: string; is_late: boolean }[];
  attendance_pct: number; punctuality_pct: number;
  stats: { total: number; present: number; absent: number; late: number; on_time: number };
}
interface ProgressData { student_id: string; coverage_pct: number; has_curriculum: boolean; total_chunks?: number; covered?: number; }
interface Notification { id: string; section_name: string; completion_date: string; chunks_covered: number; created_at: string; }
interface Announcement { id: string; title: string; body: string; created_at: string; author_name: string; }
interface ParentMessage { teacher_id: string; student_id: string; teacher_name: string; student_name: string; last_message: string; last_sent_at: string; last_sender: string; unread_count: number; }
interface HomeworkRecord { homework_date: string; status: string; teacher_note: string | null; homework_text: string | null; }
interface ChatMsg { role: 'user' | 'ai'; text: string; ts: number; }
interface ChildCache { feed: ChildFeed | null; attendance: AttendanceData | null; progress: ProgressData | null; }

type Tab = 'home' | 'attendance' | 'progress' | 'chat' | 'messages' | 'notifications';

const TABS: { id: Tab; Icon: React.ElementType; label: string }[] = [
  { id: 'home',          Icon: Home,           label: 'Home' },
  { id: 'attendance',    Icon: Calendar,       label: 'Attendance' },
  { id: 'progress',      Icon: TrendingUp,     label: 'Progress' },
  { id: 'chat',          Icon: Sparkles,       label: 'Oakie' },
  { id: 'messages',      Icon: MessageSquare,  label: 'Messages' },
  { id: 'notifications', Icon: Bell,           label: 'Updates' },
];

function defaultChat(name?: string): ChatMsg[] {
  return [{ role: 'ai', text: `Hi! I'm Oakie 🌳 Ask me anything about ${name ? name.split(' ')[0] : 'your child'} — what they studied today, attendance, or progress.`, ts: 0 }];
}

function ChildAvatar({ child, size = 'md', token, onUploaded }: {
  child: Child; size?: 'sm' | 'md' | 'lg';
  token?: string; onUploaded?: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const sz = size === 'sm' ? 'w-8 h-8 text-sm' : size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-10 h-10 text-base';
  // photo_url is already a full URL (Supabase) or a /uploads/ path — resolve correctly
  const photoUrl = child.photo_url
    ? (child.photo_url.startsWith('http') ? child.photo_url : `${API_BASE}${child.photo_url}`)
    : null;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch(`${API_BASE}/api/v1/parent/child/${child.id}/photo`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUploaded?.(data.photo_url);
    } catch (err) { console.error('Photo upload failed', err); }
    finally { setUploading(false); }
  }

  return (
    <>
      {/* Photo preview modal */}
      {preview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="relative max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <img src={preview} alt={child.name} className="w-full rounded-2xl object-contain max-h-[70vh]" />
            <button onClick={() => setPreview(null)}
              className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70">✕</button>
            <p className="text-white text-center mt-3 font-semibold">{child.name}</p>
          </div>
        </div>
      )}

      <label className={`relative ${sz} rounded-full shrink-0 cursor-pointer group`} title="Tap to change photo">
        {photoUrl ? (
          <>
            <img src={photoUrl} alt={child.name}
              className={`${sz} rounded-full object-contain bg-white border-2 border-white/20`}
              onClick={e => { e.preventDefault(); setPreview(photoUrl); }} />
          </>
        ) : (
          <div className={`${sz} rounded-full bg-white/20 flex items-center justify-center font-bold text-white`}>
            {uploading ? <span className="text-xs animate-spin">⏳</span> : child.name[0]}
          </div>
        )}
        {/* Camera overlay on hover */}
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
          <span className="text-white text-xs">📷</span>
        </div>
        {token && <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} />}
      </label>
    </>
  );
}

export default function ParentPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [tab, setTab] = useState<Tab>('home');
  const [children, setChildren] = useState<Child[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, ChildCache>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [messageThreads, setMessageThreads] = useState<ParentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [childLoading, setChildLoading] = useState(false);
  const [chatMap, setChatMap] = useState<Record<string, ChatMsg[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [noteModal, setNoteModal] = useState<NoteItem | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeChild = children.find(c => c.id === activeChildId) ?? null;
  const activeCache = activeChildId ? cache[activeChildId] : null;
  const chatMsgs = activeChildId ? (chatMap[activeChildId] ?? defaultChat(activeChild?.name)) : [];
  const unreadMessages = messageThreads.reduce((s, t) => s + Number(t.unread_count), 0);
  const unreadNotifs = notifications.length;

  useEffect(() => { if (!token) { router.push('/login'); return; } init(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMsgs]);

  async function init() {
    setLoading(true);
    try {
      const [kidsResult, notifsResult] = await Promise.allSettled([
        apiGet<Child[]>('/api/v1/parent/children', token),
        apiGet<Notification[]>('/api/v1/parent/notifications', token),
      ]);

      // Handle force_password_reset — redirect to change-password
      if (kidsResult.status === 'rejected') {
        const msg = kidsResult.reason?.message || '';
        if (msg.includes('Password change required') || msg.includes('force_password_reset')) {
          router.push('/auth/change-password');
          return;
        }
        if (msg.includes('Invalid or expired token') || msg.includes('Missing authorization')) {
          clearToken();
          router.push('/login');
          return;
        }
        setInitError(msg || 'Failed to load data');
        console.error('[parent init] children failed:', msg);
      }

      const kids = kidsResult.status === 'fulfilled' ? kidsResult.value : [];
      const notifs = notifsResult.status === 'fulfilled' ? notifsResult.value : [];
      setChildren(kids);
      setNotifications(notifs);
      apiGet<Announcement[]>('/api/v1/parent/announcements', token).then(setAnnouncements).catch(() => {});
      apiGet<ParentMessage[]>('/api/v1/parent/messages', token).then(setMessageThreads).catch(() => {});
      if (kids.length > 0) { setActiveChildId(kids[0].id); await fetchChildData(kids[0].id); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  const fetchChildData = useCallback(async (childId: string) => {
    if (cache[childId]?.feed) return;
    setChildLoading(true);
    try {
      const [feedRes, attRes, progRes] = await Promise.allSettled([
        apiGet<ChildFeed>(`/api/v1/parent/child/${childId}/feed`, token),
        apiGet<AttendanceData>(`/api/v1/parent/child/${childId}/attendance`, token),
        apiGet<ProgressData[]>('/api/v1/parent/progress', token),
      ]);
      const feed = feedRes.status === 'fulfilled' ? feedRes.value : null;
      const att = attRes.status === 'fulfilled' ? attRes.value : null;
      const prog = progRes.status === 'fulfilled' ? (progRes.value.find(p => p.student_id === childId) ?? null) : null;
      setCache(prev => ({ ...prev, [childId]: { feed, attendance: att, progress: prog } }));
    } finally { setChildLoading(false); }
  }, [cache, token]);

  async function switchChild(childId: string) { setActiveChildId(childId); await fetchChildData(childId); }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatLoading || !activeChildId || text.length > 300) return;
    setChatInput('');
    setChatMap(prev => ({ ...prev, [activeChildId]: [...(prev[activeChildId] ?? defaultChat(activeChild?.name)), { role: 'user' as const, text, ts: Date.now() }] }));
    setChatLoading(true);
    try {
      const resp = await apiPost<{ response: string }>('/api/v1/ai/parent-query', { text, student_id: activeChildId }, token);
      setChatMap(prev => ({ ...prev, [activeChildId]: [...(prev[activeChildId] ?? []), { role: 'ai' as const, text: resp.response, ts: Date.now() }] }));
    } catch {
      setChatMap(prev => ({ ...prev, [activeChildId]: [...(prev[activeChildId] ?? []), { role: 'ai' as const, text: 'Sorry, Oakie is unavailable right now.', ts: Date.now() }] }));
    } finally { setChatLoading(false); }
  }

  async function markNotifRead(id: string) {
    await apiPost(`/api/v1/parent/notifications/${id}/read`, {}, token).catch(() => {});
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}>
        <div className="text-center">
          <img src="/oakie.png" alt="Oakie" className="w-16 h-auto mx-auto mb-4 opacity-80" style={{ mixBlendMode: 'multiply' }} />
          <Loader2 className="w-8 h-8 text-white/40 animate-spin mx-auto mb-3" />
          <p className="text-white/60 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-neutral-700 font-semibold mb-2">Something went wrong</p>
          <p className="text-sm text-neutral-500 mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{initError}</p>
          <button onClick={() => { setInitError(null); setLoading(true); init(); }}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium">
            Try again
          </button>
          <button onClick={() => { clearToken(); router.push('/login'); }}
            className="ml-3 px-4 py-2 border border-neutral-200 rounded-xl text-sm text-neutral-600">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {noteModal && <NoteModal note={noteModal} token={token} onClose={() => setNoteModal(null)} />}
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 flex-col z-40"
          style={{ background: 'linear-gradient(180deg, #0f2417 0%, #1a3c2e 100%)' }}>
          <div className="px-6 py-5 border-b border-white/10">
            <OakitLogo size="sm" variant="light" />
            <p className="text-white/40 text-xs mt-1">Parent Portal</p>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {TABS.map(({ id, Icon, label }) => {
              const badge = id === 'messages' ? unreadMessages : id === 'notifications' ? unreadNotifs : 0;
              return (
                <button key={id} onClick={() => setTab(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                    tab === id ? 'bg-white/15 text-white' : 'text-white/55 hover:bg-white/8 hover:text-white/85'
                  }`}>
                  <Icon size={18} className="shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  {badge > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
                  {tab === id && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </nav>
          {/* Child switcher in sidebar */}
          {children.length > 0 && (
            <div className="px-3 py-4 border-t border-white/10">
              <p className="text-white/40 text-xs font-medium mb-2 px-1">YOUR CHILDREN</p>
              <div className="space-y-1">
                {children.map(child => (
                  <button key={child.id} onClick={() => switchChild(child.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${activeChildId === child.id ? 'bg-white/15' : 'hover:bg-white/8'}`}>
                    <ChildAvatar child={child} size="sm" token={token} onUploaded={(url) => setChildren(prev => prev.map(c => c.id === child.id ? { ...c, photo_url: url } : c))} />
                    <div className="text-left min-w-0">
                      <p className="text-white text-xs font-semibold truncate">{child.name.split(' ')[0]}</p>
                      <p className="text-white/40 text-[10px]">{child.class_name} {child.section_label}</p>
                    </div>
                    {activeChildId === child.id && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 ml-auto" />}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="px-3 py-3 border-t border-white/10">
            <button onClick={() => { clearToken(); router.push('/login'); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors text-sm">
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="lg:pl-64 flex flex-col min-h-screen">
          {/* Mobile header */}
          <header className="lg:hidden text-white px-4 pt-8 pb-5 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 60%, var(--brand-primary-light) 100%)' }}>
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
            <img src="/oakie.png" alt="" aria-hidden="true"
              className="absolute right-3 bottom-0 w-20 h-auto object-contain pointer-events-none"
              style={{ mixBlendMode: 'multiply', opacity: 0.6 }} />
            <div className="relative z-10 flex items-center justify-between mb-4">
              <OakitLogo size="sm" variant="light" />
              <button onClick={() => { clearToken(); router.push('/login'); }} className="text-white/50 hover:text-white/80 text-xs transition-colors">
                Sign out
              </button>
            </div>
            {/* Mobile child switcher */}
            {children.length > 0 && (
              <div className="relative z-10 pr-20">
                {children.length === 1 ? (
                  <div className="flex items-center gap-3 bg-white/12 rounded-2xl px-4 py-3 border border-white/10">
                    <ChildAvatar child={children[0]} size="lg" token={token} onUploaded={(url) => setChildren(prev => prev.map(c => c.id === children[0].id ? { ...c, photo_url: url } : c))} />
                    <div>
                      <p className="text-white/55 text-xs">{children[0].class_name} · Section {children[0].section_label}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {children.map(child => (
                      <button key={child.id} onClick={() => switchChild(child.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap shrink-0 border transition-all ${activeChildId === child.id ? 'bg-white text-neutral-900 border-white shadow-md' : 'bg-white/10 text-white/80 border-white/15'}`}>
                        <ChildAvatar child={child} size="sm" token={token} onUploaded={(url) => setChildren(prev => prev.map(c => c.id === child.id ? { ...c, photo_url: url } : c))} />
                        <div className="text-left">
                          <p className={`text-xs font-semibold ${activeChildId === child.id ? 'text-neutral-900' : 'text-white'}`}>{child.name.split(' ')[0]}</p>
                          <p className={`text-[10px] ${activeChildId === child.id ? 'text-neutral-500' : 'text-white/50'}`}>{child.class_name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </header>

          {/* Tab content */}
          <main className="flex-1 overflow-y-auto pb-24 lg:pb-8">
            {childLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-neutral-300 animate-spin" />
              </div>
            ) : (
              <div className="p-4 lg:p-6 max-w-5xl mx-auto">
                {tab === 'home' && <HomeTab feed={activeCache?.feed ?? null} progress={activeCache?.progress ?? null} activeChild={activeChild} announcements={announcements} onNoteClick={setNoteModal} onTabChange={setTab} token={token} onChildUpdate={(url) => setChildren(prev => prev.map(c => c.id === activeChildId ? { ...c, photo_url: url } : c))} />}
                {tab === 'attendance' && <AttendanceTab data={activeCache?.attendance ?? null} />}
                {tab === 'progress' && <ProgressTab data={activeCache?.progress ?? null} activeChild={activeChild} token={token} />}
                {tab === 'chat' && <ChatTab msgs={chatMsgs} input={chatInput} loading={chatLoading} onInput={setChatInput} onSend={sendChat} endRef={chatEndRef} childName={activeChild?.name.split(' ')[0] ?? 'your child'} />}
                {tab === 'messages' && <MessagesTab threads={messageThreads} token={token} onRefresh={() => apiGet<ParentMessage[]>('/api/v1/parent/messages', token).then(setMessageThreads).catch(() => {})} />}
                {tab === 'notifications' && <NotificationsTab notifications={notifications} announcements={announcements} onRead={markNotifRead} />}
              </div>
            )}
          </main>

          {/* Mobile bottom nav */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50 flex items-center justify-around px-1"
            style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))', paddingTop: '8px', boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}>
            {TABS.map(({ id, Icon, label }) => {
              const badge = id === 'messages' ? unreadMessages : id === 'notifications' ? unreadNotifs : 0;
              const isActive = tab === id;
              return (
                <button key={id} onClick={() => setTab(id)}
                  className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[48px] min-h-[44px] transition-colors ${isActive ? 'text-emerald-600' : 'text-neutral-400'}`}>
                  <Icon size={20} className={isActive ? 'scale-110 transition-transform' : ''} />
                  <span className={`text-[9px] font-semibold ${isActive ? 'text-emerald-600' : 'text-neutral-400'}`}>{label}</span>
                  {badge > 0 && <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{badge}</span>}
                  {isActive && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}

// ─── Note Modal ───────────────────────────────────────────────────────────────
function NoteModal({ note, token, onClose }: { note: NoteItem; token: string; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const daysLeft = Math.ceil((new Date(note.expires_at).getTime() - Date.now()) / 86400000);

  async function download() {
    if (downloading || !note.file_name) return;
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/parent/notes/${note.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert('File not available or expired.'); return; }
      // If server redirected to Supabase, open in new tab
      if (res.url && res.url.startsWith('https://') && !res.url.includes('localhost')) {
        window.open(res.url, '_blank');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = note.file_name!; a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative z-10 bg-white w-full lg:w-[520px] rounded-t-3xl lg:rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="lg:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-neutral-200" /></div>
        <div className="px-5 pb-6 pt-3 lg:pt-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-base font-semibold text-neutral-800">📋 Teacher Note</p>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500">✕</button>
          </div>
          {note.note_text && <div className="bg-neutral-50 rounded-xl p-4 mb-4"><p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{note.note_text}</p></div>}
          {note.file_name && (
            <div className="border border-neutral-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-xl">📎</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-800 truncate">{note.file_name}</p>
                  {note.file_size && <p className="text-xs text-neutral-400">{Math.round(note.file_size / 1024)} KB</p>}
                </div>
              </div>
              <button onClick={download} disabled={downloading}
                className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {downloading ? <Loader2 size={16} className="animate-spin" /> : '↓'} Download File
              </button>
            </div>
          )}
          <div className={`rounded-xl px-4 py-3 text-xs ${daysLeft <= 3 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
            {daysLeft <= 0 ? '⚠ Expires today — download now.' : `⚠ Auto-deleted on ${note.expires_at.split('T')[0]} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left). Save a local copy.`}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Home Tab — Bento Grid ────────────────────────────────────────────────────
function HomeTab({ feed, progress, activeChild, announcements, onNoteClick, onTabChange, token, onChildUpdate }: {
  feed: ChildFeed | null; progress: ProgressData | null; activeChild: Child | null;
  announcements: Announcement[]; onNoteClick: (n: NoteItem) => void; onTabChange: (t: Tab) => void;
  token: string; onChildUpdate: (url: string) => void;
}) {
  if (!activeChild) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <User size={48} className="text-neutral-300 mb-3" />
      <p className="text-neutral-500 font-medium">No child selected</p>
    </div>
  );

  const att = feed?.attendance;
  const attColor = !att ? 'text-neutral-500' : att.status === 'present' && !att.is_late ? 'text-emerald-700' : att.status === 'present' ? 'text-amber-700' : 'text-red-600';
  const attBg = !att ? 'bg-neutral-50' : att.status === 'present' && !att.is_late ? 'bg-emerald-50' : att.status === 'present' ? 'bg-amber-50' : 'bg-red-50';
  const attLabel = !att ? 'Not marked' : att.status === 'present' && att.is_late ? '⏰ Late' : att.status === 'present' ? '✓ Present' : '✗ Absent';
  const pct = progress?.coverage_pct ?? 0;

  return (
    <div className="space-y-4">
      {/* Child profile card — prominent at top */}
      <div className="bg-gradient-to-r from-[#0f2417] to-[#1e5c3a] rounded-2xl p-5 flex items-center gap-4">
        {/* Large avatar with upload */}
        <div className="shrink-0">
          <ChildAvatar child={activeChild} size="lg" token={token} onUploaded={onChildUpdate} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-lg leading-tight truncate">{activeChild.name}</p>
          <p className="text-white/60 text-sm mt-0.5">{activeChild.class_name} · Section {activeChild.section_label}</p>
          <p className="text-white/40 text-xs mt-2">Tap photo to preview or change</p>
        </div>
        {/* Today's status badge */}
        <div className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold ${
          !att ? 'bg-white/10 text-white/60' :
          att.status === 'present' && !att.is_late ? 'bg-emerald-500/20 text-emerald-300' :
          att.status === 'present' ? 'bg-amber-500/20 text-amber-300' :
          'bg-red-500/20 text-red-300'
        }`}>
          {attLabel}
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-2 lg:grid-cols-12 gap-3">
        {/* Attendance card */}
        <div className={`${attBg} rounded-2xl p-4 border border-neutral-100 col-span-1 lg:col-span-3`}>
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-neutral-400" />
            <p className="text-xs font-medium text-neutral-500">Attendance</p>
          </div>
          <p className={`text-xl font-bold ${attColor}`}>{attLabel}</p>
          {att?.arrived_at && <p className="text-xs text-neutral-400 mt-1">Arrived {att.arrived_at.slice(0, 5)}</p>}
          {!att && <p className="text-xs text-neutral-400 mt-1">Not yet marked</p>}
        </div>

        {/* Progress card */}
        <div className="bg-[#0f2417] rounded-2xl p-4 col-span-1 lg:col-span-3 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <TrendingUp size={80} className="text-white" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-emerald-400" />
              <p className="text-xs font-medium text-white/60">Progress</p>
            </div>
            <p className="text-3xl font-black text-white">{pct}%</p>
            <p className="text-xs text-white/50 mt-0.5">syllabus covered</p>
            <div className="w-full bg-white/10 h-1.5 rounded-full mt-2">
              <div className="bg-emerald-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Homework card */}
        <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm col-span-2 lg:col-span-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-amber-500" />
              <p className="text-sm font-semibold text-neutral-800">Homework</p>
            </div>
            <button onClick={() => onTabChange('progress')}
              className="text-xs text-primary-600 font-medium hover:underline">History →</button>
          </div>
          {feed?.homework ? (
            <p className="text-sm text-neutral-700 leading-relaxed line-clamp-3 italic border-l-4 border-amber-200 pl-3">
              "{feed.homework.formatted_text || feed.homework.raw_text}"
            </p>
          ) : (
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={16} />
              <p className="text-sm font-medium">No pending homework — great job!</p>
            </div>
          )}
        </div>

        {/* Today's learning */}
        <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm col-span-2 lg:col-span-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-primary-600" />
            <p className="text-sm font-semibold text-neutral-800">Today&apos;s Learning</p>
          </div>
          {feed?.special_label ? (
            <div className="bg-blue-50 rounded-xl px-3 py-2.5"><p className="text-sm text-blue-700 font-medium">{feed.special_label}</p></div>
          ) : feed?.topics && feed.topics.length > 0 ? (
            <div className="space-y-2">
              {feed.topics.map((t, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-sm text-neutral-700">{t}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">No topics recorded yet for today</p>
          )}
        </div>

        {/* Need help CTA */}
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 col-span-2 lg:col-span-4 flex flex-col justify-between">
          <div>
            <p className="font-bold text-emerald-900 text-sm mb-1">Need Help?</p>
            <p className="text-xs text-emerald-700/80 leading-snug">Ask Oakie AI or message {activeChild.name.split(' ')[0]}&apos;s teacher directly.</p>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => onTabChange('chat')} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-colors">
              <Sparkles size={14} /> Oakie
            </button>
            <button onClick={() => onTabChange('messages')} className="flex-1 bg-white text-emerald-800 py-2.5 rounded-xl text-xs font-bold border border-emerald-200 flex items-center justify-center gap-1.5 hover:bg-emerald-50 transition-colors">
              <MessageSquare size={14} /> Teacher
            </button>
          </div>
        </div>
      </div>

      {/* Child Journey */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-primary-500" />
            <p className="text-sm font-semibold text-neutral-800">{activeChild.name.split(' ')[0]}'s Journey</p>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mb-3 leading-relaxed">
          Daily highlights and special moments recorded by {activeChild.name.split(' ')[0]}'s teacher.
        </p>
        <a href={`/parent/journey?student_id=${activeChild.id}`}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-colors">
          <BookOpen size={14} /> View {activeChild.name.split(' ')[0]}'s Journey
        </a>
      </div>

      {/* Teacher notes */}
      {feed?.notes && feed.notes.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
          <p className="text-sm font-semibold text-neutral-800 mb-3">📋 Teacher Notes</p>
          <div className="space-y-2">
            {feed.notes.map(note => {
              const dl = Math.ceil((new Date(note.expires_at).getTime() - Date.now()) / 86400000);
              return (
                <button key={note.id} onClick={() => onNoteClick(note)}
                  className="w-full text-left bg-neutral-50 hover:bg-neutral-100 rounded-xl px-3 py-3 transition-colors border border-neutral-100">
                  {note.note_text && <p className="text-sm text-neutral-700 line-clamp-2 mb-1">{note.note_text}</p>}
                  {note.file_name && <div className="flex items-center gap-2"><span>📎</span><p className="text-xs font-medium text-neutral-700 truncate flex-1">{note.file_name}</p><span className="text-xs text-primary-600 font-medium">Download ↓</span></div>}
                  <p className={`text-xs mt-1 ${dl <= 3 ? 'text-red-500 font-medium' : 'text-neutral-400'}`}>{dl <= 0 ? 'Expires today' : `Expires in ${dl} day${dl === 1 ? '' : 's'}`}</p>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-amber-600 mt-3">⚠ Notes auto-delete after expiry. Download attachments you need to keep.</p>
        </div>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
          <p className="text-sm font-semibold text-neutral-800 mb-3">📢 School Announcements</p>
          <div className="space-y-3">
            {announcements.slice(0, 3).map(a => (
              <div key={a.id} className="border-l-4 border-primary-400 pl-3">
                <p className="text-sm font-medium text-neutral-800">{a.title}</p>
                <p className="text-xs text-neutral-600 mt-0.5 line-clamp-2">{a.body}</p>
                <p className="text-xs text-neutral-400 mt-1">By {a.author_name} · {a.created_at.split('T')[0]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────
function AttendanceTab({ data }: { data: AttendanceData | null }) {
  if (!data) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Calendar size={48} className="text-neutral-300 mb-3" />
      <p className="text-neutral-500 font-medium">No attendance data yet</p>
    </div>
  );
  const { stats, attendance_pct, punctuality_pct, records } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className={`${attendance_pct >= 75 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} border rounded-2xl p-4`}>
          <p className="text-xs text-neutral-500 mb-1">Attendance</p>
          <p className={`text-3xl font-black ${attendance_pct >= 75 ? 'text-emerald-700' : 'text-red-600'}`}>{attendance_pct}%</p>
          <p className="text-xs text-neutral-400 mt-1">{stats.present} present · {stats.absent} absent</p>
        </div>
        <div className={`${punctuality_pct >= 80 ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'} border rounded-2xl p-4`}>
          <p className="text-xs text-neutral-500 mb-1">Punctuality</p>
          <p className={`text-3xl font-black ${punctuality_pct >= 80 ? 'text-blue-700' : 'text-amber-700'}`}>{punctuality_pct}%</p>
          <p className="text-xs text-neutral-400 mt-1">{stats.on_time} on time · {stats.late} late</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Last 60 Days</p>
        <div className="flex flex-wrap gap-1.5">
          {records.map((r, i) => {
            const day = parseInt(r.attend_date.split('T')[0].split('-')[2]);
            return (
              <div key={i} title={r.attend_date.split('T')[0]}
                className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center font-medium ${r.status === 'present' && r.is_late ? 'bg-amber-100 text-amber-700' : r.status === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                <span className="text-[10px] leading-none">{day}</span>
                <span className="text-[8px] leading-none mt-0.5">{r.status === 'present' && r.is_late ? '⏰' : r.status === 'present' ? '✓' : '✗'}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 inline-block" />Present</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 inline-block" />Late</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 inline-block" />Absent</span>
        </div>
      </div>
    </div>
  );
}

// ─── Progress Tab ─────────────────────────────────────────────────────────────
function ProgressTab({ data, activeChild, token }: { data: ProgressData | null; activeChild: Child | null; token: string }) {
  const [milestoneData, setMilestoneData] = useState<{ completion_pct: number; achieved: number; total: number; class_level: string } | null>(null);
  const [hwHistory, setHwHistory] = useState<HomeworkRecord[]>([]);
  const [hwLoading, setHwLoading] = useState(false);

  useEffect(() => {
    if (!activeChild?.id || !token) return;
    apiGet<any>(`/api/v1/teacher/milestones/${activeChild.id}`, token)
      .then(d => setMilestoneData({ completion_pct: d.completion_pct, achieved: d.achieved, total: d.total, class_level: d.class_level }))
      .catch(() => {});
    // Load homework history
    setHwLoading(true);
    apiGet<HomeworkRecord[]>(`/api/v1/parent/homework/history?student_id=${activeChild.id}`, token)
      .then(d => setHwHistory(d || []))
      .catch(() => {})
      .finally(() => setHwLoading(false));
  }, [activeChild?.id]);

  if (!data) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <TrendingUp size={48} className="text-neutral-300 mb-3" />
      <p className="text-neutral-500 font-medium">No progress data yet</p>
    </div>
  );
  const pct = data.coverage_pct;
  const strokeColor = pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const r = 50; const circ = 2 * Math.PI * r;

  const missedCount = hwHistory.filter(h => h.status !== 'completed').length;
  const completedCount = hwHistory.filter(h => h.status === 'completed').length;

  return (
    <div className="space-y-4">
      <div className="bg-[#0f2417] rounded-2xl p-6 flex flex-col items-center">
        <div className="relative w-36 h-36 mb-4">
          <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
            <circle cx="60" cy="60" r={r} fill="none" stroke={strokeColor} strokeWidth="12"
              strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-white">{pct}%</span>
            <span className="text-xs text-white/50">covered</span>
          </div>
        </div>
        {data.has_curriculum ? (
          <>
            <p className="font-bold text-white mb-1">{activeChild?.name.split(' ')[0]}&apos;s Curriculum</p>
            <p className="text-xs text-white/50">{data.covered} of {data.total_chunks} topics completed</p>
          </>
        ) : <p className="text-white/50 text-sm">No curriculum assigned yet</p>}
      </div>
      {milestoneData && (
        <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-neutral-800">🏆 Milestones</p>
            <span className="text-emerald-600 font-bold text-sm">{milestoneData.completion_pct}%</span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-2.5 mb-2">
            <div className="h-2.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${milestoneData.completion_pct}%` }} />
          </div>
          <p className="text-xs text-neutral-400">{milestoneData.achieved} of {milestoneData.total} {milestoneData.class_level} milestones achieved</p>
        </div>
      )}

      {/* Homework History */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-neutral-800">📚 Homework History</p>
          {hwHistory.length > 0 && (
            <div className="flex gap-2 text-xs">
              <span className="text-emerald-600 font-medium">{completedCount} done</span>
              {missedCount > 0 && <span className="text-red-500 font-medium">{missedCount} missed</span>}
            </div>
          )}
        </div>
        {hwLoading ? (
          <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-neutral-300" /></div>
        ) : hwHistory.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-600 py-2">
            <CheckCircle2 size={16} />
            <p className="text-sm font-medium">No homework records yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hwHistory.map((hw, i) => {
              const rawDate = (hw.homework_date || '').toString().split('T')[0];
              const dateStr = rawDate
                ? new Date(rawDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
                : '—';
              const statusConfig = {
                completed: { label: '✓ Done', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                partial: { label: '½ Partial', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
                not_submitted: { label: '✗ Not submitted', cls: 'bg-red-50 text-red-600 border-red-100' },
              }[hw.status] || { label: hw.status, cls: 'bg-neutral-50 text-neutral-600 border-neutral-100' };
              return (
                <details key={i} className={`rounded-xl border ${statusConfig.cls} group`}>
                  <summary className="flex items-center justify-between px-3 py-2.5 cursor-pointer list-none select-none">
                    <div className="flex items-center gap-2">
                      <ChevronRight size={14} className="shrink-0 transition-transform group-open:rotate-90" />
                      <span className="text-xs font-medium">{dateStr}</span>
                    </div>
                    <span className="text-xs font-bold">{statusConfig.label}</span>
                  </summary>
                  <div className="px-3 pb-3 pt-1 border-t border-current/10">
                    {hw.homework_text ? (
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{hw.homework_text}</p>
                    ) : (
                      <p className="text-xs opacity-50 italic">No homework text recorded for this date.</p>
                    )}
                    {hw.teacher_note && (
                      <p className="text-xs mt-2 italic opacity-70 border-t border-current/10 pt-2">
                        Teacher note: {hw.teacher_note}
                      </p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat Tab ─────────────────────────────────────────────────────────────────
function ChatTab({ msgs, input, loading, onInput, onSend, endRef, childName }: {
  msgs: ChatMsg[]; input: string; loading: boolean;
  onInput: (v: string) => void; onSend: () => void;
  endRef: React.RefObject<HTMLDivElement>; childName: string;
}) {
  function handleKey(e: React.KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }
  return (
    <div className="flex flex-col h-[calc(100vh-280px)] lg:h-[600px] bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
      <div className="bg-[#0f2417] px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-xl">🌳</div>
        <div>
          <p className="text-white font-bold text-sm">Oakie AI</p>
          <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> Active
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50/50">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'ai' && <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-sm shrink-0 mr-2 mt-0.5">🌳</div>}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white text-neutral-800 shadow-sm border border-neutral-100 rounded-bl-sm'}`}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-sm shrink-0 mr-2">🌳</div>
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-neutral-100">
              <div className="flex gap-1 items-center h-4">
                {[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {msgs.length <= 1 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {[`What did ${childName} study today?`, `How is ${childName}'s attendance?`, `Any homework today?`].map(q => (
            <button key={q} onClick={() => onInput(q)} className="shrink-0 text-xs bg-white border border-neutral-200 text-neutral-600 px-3 py-2 rounded-full hover:bg-neutral-50 transition-colors whitespace-nowrap">{q}</button>
          ))}
        </div>
      )}
      <div className="px-4 py-3 bg-white border-t border-neutral-100">
        <div className="flex gap-2 bg-neutral-50 rounded-2xl border border-neutral-200 p-2">
          <textarea value={input} onChange={e => onInput(e.target.value)} onKeyDown={handleKey}
            placeholder={`Ask about ${childName}...`} maxLength={300} rows={1}
            className="flex-1 resize-none text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none px-2 py-1.5 bg-transparent leading-snug" style={{ maxHeight: 80 }} />
          <button onClick={onSend} disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center text-white transition-all active:scale-95 shrink-0 self-end">
            <Send size={16} />
          </button>
        </div>
        {input.length > 250 && <p className="text-xs text-neutral-400 mt-1 text-right">{input.length}/300</p>}
      </div>
    </div>
  );
}

// ─── Messages Tab ─────────────────────────────────────────────────────────────
function MessagesTab({ threads, token, onRefresh }: { threads: ParentMessage[]; token: string; onRefresh: () => void }) {
  const [active, setActive] = useState<ParentMessage | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [teachers, setTeachers] = useState<{ teacher_id: string; teacher_name: string; student_id: string; student_name: string; class_name: string }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [newMsgBody, setNewMsgBody] = useState('');
  const [sendingNew, setSendingNew] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  useEffect(() => {
    if (showNewMsg && teachers.length === 0) {
      apiGet<any[]>('/api/v1/parent/teachers', token).then(setTeachers).catch(() => {});
    }
  }, [showNewMsg]);

  async function openThread(t: ParentMessage) {
    setActive(t);
    try { const data = await apiGet<any[]>(`/api/v1/parent/messages/${t.teacher_id}/${t.student_id}`, token); setMsgs(data); onRefresh(); } catch {}
  }

  async function sendReply() {
    if (!reply.trim() || !active || sending) return;
    setSending(true);
    try {
      await apiPost(`/api/v1/parent/messages/${active.teacher_id}/${active.student_id}/reply`, { body: reply.trim() }, token);
      setReply('');
      const data = await apiGet<any[]>(`/api/v1/parent/messages/${active.teacher_id}/${active.student_id}`, token);
      setMsgs(data);
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
      // Open the thread
      const t = teachers.find(t => t.teacher_id === selectedTeacher && t.student_id === selectedStudent);
      if (t) {
        const thread: ParentMessage = { teacher_id: t.teacher_id, student_id: t.student_id, teacher_name: t.teacher_name, student_name: t.student_name, last_message: newMsgBody, last_sent_at: new Date().toISOString(), last_sender: 'parent', unread_count: 0 };
        await openThread(thread);
      }
    } catch {}
    finally { setSendingNew(false); }
  }

  if (active) {
    return (
      <div className="flex flex-col h-[calc(100vh-280px)] lg:h-[600px] bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-[#0f2417] text-white">
          <button onClick={() => setActive(null)} className="text-white/60 hover:text-white"><ChevronRight size={20} className="rotate-180" /></button>
          <div><p className="font-bold text-sm">{active.teacher_name}</p><p className="text-xs text-white/50">{active.student_name}</p></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50/50">
          {msgs.length === 0 && (
            <div className="text-center py-8 text-neutral-400 text-sm">No messages yet. Send the first message below.</div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.sender_role === 'parent' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.sender_role === 'parent' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white text-neutral-800 shadow-sm border border-neutral-100 rounded-bl-sm'}`}>
                <p>{m.body}</p>
                <p className={`text-[10px] mt-1 ${m.sender_role === 'parent' ? 'text-white/60' : 'text-neutral-400'}`}>{new Date(m.sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="px-4 py-3 bg-white border-t border-neutral-100 flex gap-2">
          <input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendReply(); }}
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

      {/* New message form */}
      {showNewMsg && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-800">Message a Teacher</p>
            <button onClick={() => setShowNewMsg(false)} className="text-neutral-400 hover:text-neutral-600">✕</button>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600 mb-1 block">Select Teacher & Child</label>
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
      ) : threads.map(t => (
        <button key={`${t.teacher_id}-${t.student_id}`} onClick={() => openThread(t)}
          className="w-full bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm text-left flex items-start gap-3 hover:shadow-md transition-all">
          <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 shrink-0">{t.teacher_name?.[0] ?? 'T'}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between"><p className="font-bold text-neutral-800 text-sm">{t.teacher_name}</p><p className="text-xs text-neutral-400">{t.last_sent_at?.split('T')[0]}</p></div>
            <p className="text-xs text-neutral-500">{t.student_name}</p>
            <p className="text-xs text-neutral-400 truncate mt-0.5">{t.last_message}</p>
          </div>
          {Number(t.unread_count) > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">{t.unread_count}</span>}
        </button>
      ))}
    </div>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────
function NotificationsTab({ notifications, announcements, onRead }: { notifications: Notification[]; announcements: Announcement[]; onRead: (id: string) => void }) {
  return (
    <div className="space-y-5">
      {announcements.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-neutral-800 mb-3">📢 Announcements</h2>
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="bg-white rounded-2xl p-4 border-l-4 border-primary-400 shadow-sm">
                <p className="font-bold text-neutral-800 text-sm">{a.title}</p>
                <p className="text-sm text-neutral-600 mt-1">{a.body}</p>
                <p className="text-xs text-neutral-400 mt-2">By {a.author_name} · {a.created_at.split('T')[0]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <h2 className="text-lg font-bold text-neutral-800 mb-3">🔔 Updates</h2>
        {notifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-neutral-100 shadow-sm">
            <Bell size={40} className="text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 font-medium">You&apos;re all caught up!</p>
          </div>
        ) : notifications.map(n => (
          <div key={n.id} className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm mb-3">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-bold text-neutral-800 text-sm">{n.section_name}</p><p className="text-xs text-neutral-500 mt-0.5">{n.completion_date.split('T')[0]} · {n.chunks_covered} topics covered</p></div>
              <button onClick={() => onRead(n.id)} className="text-xs text-emerald-600 font-bold px-3 py-1.5 rounded-xl hover:bg-emerald-50 transition-colors min-h-[32px]">Dismiss</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

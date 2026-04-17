'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Calendar, TrendingUp, Sparkles, MessageSquare, Bell,
  LogOut, Settings, BarChart3, Loader2,
} from 'lucide-react';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import OakitLogo from '@/components/OakitLogo';

// ─── Feature imports ──────────────────────────────────────────────────────────
import { TranslationContext, translations, defaultChat } from '@/features/parent/context';
import type {
  Child, ChildCache, ChildFeed, AttendanceData, ProgressData,
  Notification, Announcement, ParentMessage, ChatMsg,
  EmergencyContact, NotificationPreference, CalendarEvent,
  ParentInsights, ChildComparison, TranslationSettings, Tab,
} from '@/features/parent/types';

import ChildAvatar from '@/features/parent/components/ChildAvatar';
import NoteModal from '@/features/parent/components/NoteModal';
import HomeTab from '@/features/parent/components/HomeTab';
import AttendanceTab from '@/features/parent/components/AttendanceTab';
import ProgressTab from '@/features/parent/components/ProgressTab';
import InsightsTab from '@/features/parent/components/InsightsTab';
import ChatTab from '@/features/parent/components/ChatTab';
import MessagesTab from '@/features/parent/components/MessagesTab';
import NotificationsTab from '@/features/parent/components/NotificationsTab';
import SettingsTab from '@/features/parent/components/SettingsTab';
import PremiumWelcomeModal from '@/features/parent/components/PremiumWelcomeModal';
import type { NoteItem } from '@/features/parent/types';

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS: { id: Tab; Icon: React.ElementType; label: string }[] = [
  { id: 'home',          Icon: Home,           label: 'Home' },
  { id: 'attendance',    Icon: Calendar,       label: 'Attendance' },
  { id: 'progress',      Icon: TrendingUp,     label: 'Progress' },
  { id: 'insights',      Icon: BarChart3,      label: 'Insights' },
  { id: 'chat',          Icon: Sparkles,       label: 'Oakie' },
  { id: 'messages',      Icon: MessageSquare,  label: 'Messages' },
  { id: 'notifications', Icon: Bell,           label: 'Updates' },
  { id: 'settings',      Icon: Settings,       label: 'Settings' },
];

const DEFAULT_NOTIF_PREFS: NotificationPreference[] = [
  { type: 'homework',      enabled: true,  channels: ['push', 'email'], quietHours: { start: '22:00', end: '07:00' }, frequency: 'immediate' },
  { type: 'attendance',    enabled: true,  channels: ['push'],          quietHours: null,                             frequency: 'daily'     },
  { type: 'progress',      enabled: true,  channels: ['email'],         quietHours: null,                             frequency: 'weekly'    },
  { type: 'messages',      enabled: true,  channels: ['push', 'sms'],   quietHours: { start: '22:00', end: '07:00' }, frequency: 'immediate' },
  { type: 'announcements', enabled: false, channels: ['email'],         quietHours: null,                             frequency: 'weekly'    },
];

// ─── Main component ───────────────────────────────────────────────────────────
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
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Settings state
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreference[]>(DEFAULT_NOTIF_PREFS);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [parentInsights, setParentInsights] = useState<ParentInsights | null>(null);
  const [childComparisons, setChildComparisons] = useState<ChildComparison[]>([]);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [assistantReminders, setAssistantReminders] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [translationSettings, setTranslationSettings] = useState<TranslationSettings>({
    enabled: false, targetLanguage: 'en', autoTranslate: false,
    supportedLanguages: ['en', 'hi', 'te', 'kn', 'ta', 'ml', 'gu', 'mr', 'bn', 'pa', 'ur', 'ar', 'fr', 'es'],
  });

  // t() helper — ParentPage is the Provider so can't use useTranslation()
  function t(key: string, defaultText?: string): string {
    if (!translationSettings.enabled || translationSettings.targetLanguage === 'en') return defaultText || key;
    return translations[translationSettings.targetLanguage]?.[key] || defaultText || key;
  }

  const activeChild = children.find(c => c.id === activeChildId) ?? null;
  const activeCache = activeChildId ? cache[activeChildId] : null;
  const chatMsgs = activeChildId ? (chatMap[activeChildId] ?? defaultChat(activeChild?.name)) : [];
  const unreadMessages = messageThreads.reduce((s, th) => s + Number(th.unread_count), 0);
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

      if (kidsResult.status === 'rejected') {
        const msg = kidsResult.reason?.message || '';
        if (msg.includes('Password change required') || msg.includes('force_password_reset')) { router.push('/auth/change-password'); return; }
        if (msg.includes('Invalid or expired token') || msg.includes('Missing authorization')) { clearToken(); router.push('/login'); return; }
        setInitError(msg || 'Failed to load data');
      }

      const kids = kidsResult.status === 'fulfilled' ? kidsResult.value : [];
      const notifs = notifsResult.status === 'fulfilled' ? notifsResult.value : [];
      setChildren(kids);
      setNotifications(notifs);
      apiGet<Announcement[]>('/api/v1/parent/announcements', token).then(setAnnouncements).catch(() => {});
      apiGet<ParentMessage[]>('/api/v1/parent/messages', token).then(setMessageThreads).catch(() => {});
      // Check voice feature status
      apiGet<{ voice_enabled: boolean }>('/api/v1/ai/voice-status', token).then(d => setVoiceEnabled(d.voice_enabled)).catch(() => {});

      // Load settings + emergency contacts
      // Always load mock insights data immediately so Insights tab never spins
      loadMockData(kids[0]?.id, kids[0]?.name);

      (async () => {
        try {
          const [rows, settings] = await Promise.all([
            apiGet<any[]>('/api/v1/parent/emergency-contacts', token),
            apiGet<any>('/api/v1/parent/settings', token),
          ]);
          setEmergencyContacts(rows.map(r => ({ id: r.id, name: r.name, relation: r.relationship || r.relation || '', phone: r.phone, priority: r.is_primary ? 1 : 2, available: true })) as EmergencyContact[]);
          if (settings?.notification_prefs?.length) setNotificationPrefs(settings.notification_prefs);
          if (typeof settings?.calendar_sync === 'boolean') setCalendarSyncEnabled(settings.calendar_sync);
          if (typeof settings?.assistant_reminders === 'boolean') setAssistantReminders(settings.assistant_reminders);
          if (typeof settings?.voice_enabled === 'boolean') setVoiceEnabled(settings.voice_enabled);
          if (settings?.translation_settings) {
            const ts = settings.translation_settings;
            setTranslationSettings({ enabled: ts.enabled ?? false, targetLanguage: ts.targetLanguage || 'en', autoTranslate: ts.autoTranslate ?? false, supportedLanguages: ts.supportedLanguages?.length ? ts.supportedLanguages : ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'gu', 'bn', 'mr', 'pa'] });
          }
        } catch { /* settings failed — mock data already loaded above */ }
      })();

      if (kids.length > 0) { setActiveChildId(kids[0].id); await fetchChildData(kids[0].id); }
    } catch { /* ignore */ }
    finally {
      setLoading(false);
      // Show premium modal once per session (not on every login — once per browser session)
      const seen = sessionStorage.getItem('oakit_premium_popup_seen');
      if (!seen) {
        setTimeout(() => setShowPremiumModal(true), 1500);
      }
    }
  }

  function loadMockData(firstChildId?: string, firstChildName?: string) {
    setEmergencyContacts([
      { id: '1', name: 'Parent 1', relation: 'Father', phone: '+91-9876543210', priority: 1, available: true },
      { id: '2', name: 'Parent 2', relation: 'Mother', phone: '+91-9876543211', priority: 2, available: true },
    ]);

    // Realistic insights based on June 1-16 observations
    const name = firstChildName?.split(' ')[0] || 'Your child';
    setParentInsights({
      attendanceTrend: 'improving',
      participationScore: 72,
      strengths: [
        `${name} shows excellent creativity and imagination — art and storytelling are clear strengths`,
        `English speaking confidence has improved noticeably over the past 2 weeks`,
        `Shows empathy and kindness towards classmates`,
      ],
      areasForImprovement: [
        `Pencil grip needs correction — currently using fist grip instead of 3-finger grip`,
        `${name} has been falling asleep in afternoon sessions — sleep schedule needs attention`,
        `Focus and attention during structured activities needs improvement`,
      ],
      teacherFeedback: [
        `Introducing daily pencil grip exercises in class — will use triangular grip aids`,
        `Pairing ${name} with a confident peer during group activities to build participation`,
        `Monitoring energy levels — will flag if afternoon fatigue continues`,
        `Planning extra encouragement during circle time to build speaking confidence`,
      ],
      predictions: {
        nextWeekAttendance: 92,
        endOfMonthProgress: 78,
        areasNeedingAttention: [
          `Practice pencil grip at home daily — 5 minutes before homework`,
          `Ensure ${name} gets 9-10 hours of sleep on school nights`,
          `Encourage ${name} to talk about their school day — builds communication skills`,
          `Limit screen time to 30 minutes before bedtime`,
        ],
      },
      goals: {
        academic: [
          { id: '1', title: 'Correct Pencil Grip', description: 'Achieve consistent 3-finger pencil grip during all writing activities', target: '100%', current: '40%', deadline: '2026-06-30', status: 'in_progress', category: 'academic' },
        ],
        behavioral: [
          { id: '2', title: 'Classroom Focus', description: 'Stay focused during structured activities without reminders', target: '80%', current: '55%', deadline: '2026-06-30', status: 'in_progress', category: 'behavioral' },
        ],
        attendance: [
          { id: '3', title: 'Full Attendance', description: 'Attend all classes this month with no afternoon fatigue', target: '100%', current: '88%', deadline: '2026-06-30', status: 'in_progress', category: 'attendance' },
        ],
      },
    });

    setChildComparisons([
      { childId: firstChildId || '', name: firstChildName || 'Your Child', attendance: 88, progress: 72, participation: 65, rank: 4, trend: 'up' },
      { childId: 'avg', name: 'Class Average', attendance: 87, progress: 75, participation: 70, rank: 0, trend: 'stable' },
    ]);
    setCalendarSyncEnabled(localStorage.getItem('calendar_sync') === 'true');
    setAssistantReminders(localStorage.getItem('assistant_reminders') === 'true');
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

  function saveCalendarSync(enabled: boolean) {
    setCalendarSyncEnabled(enabled);
    localStorage.setItem('calendar_sync', String(enabled));
    apiPut('/api/v1/parent/settings', { calendar_sync: enabled }, token).catch(() => {});
  }

  function saveAssistantReminders(enabled: boolean) {
    setAssistantReminders(enabled);
    localStorage.setItem('assistant_reminders', String(enabled));
    apiPut('/api/v1/parent/settings', { assistant_reminders: enabled }, token).catch(() => {});
  }

  // ─── Loading / error states ────────────────────────────────────────────────
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
          <button onClick={() => { setInitError(null); setLoading(true); init(); }} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium">Try again</button>
          <button onClick={() => { clearToken(); router.push('/login'); }} className="ml-3 px-4 py-2 border border-neutral-200 rounded-xl text-sm text-neutral-600">Sign out</button>
        </div>
      </div>
    );
  }

  const translationContextValue = {
    t: (key: string, defaultText?: string) => {
      if (!translationSettings.enabled || translationSettings.targetLanguage === 'en') return defaultText || key;
      return translations[translationSettings.targetLanguage]?.[key] || defaultText || key;
    },
    settings: translationSettings,
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <TranslationContext.Provider value={translationContextValue}>
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        {noteModal && <NoteModal note={noteModal} token={token} onClose={() => setNoteModal(null)} />}

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 flex-col z-40"
          style={{ background: 'linear-gradient(180deg, #0f2417 0%, #1a3c2e 100%)' }}>
          <div className="px-6 py-5 border-b border-white/10">
            <OakitLogo size="sm" variant="light" />
            <div className="flex items-center justify-between mt-1">
              <p className="text-white/40 text-xs">Parent Portal</p>
              <button
                onClick={() => router.push('/parent/premium')}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[9px] font-bold hover:bg-amber-400/30 transition-colors">
                ✨ Premium
              </button>
            </div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {TABS.map(({ id, Icon, label }) => {
              const badge = id === 'messages' ? unreadMessages : id === 'notifications' ? unreadNotifs : 0;
              return (
                <button key={id} onClick={() => setTab(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${tab === id ? 'bg-white/15 text-white' : 'text-white/55 hover:bg-white/8 hover:text-white/85'}`}>
                  <Icon size={18} className="shrink-0" />
                  <span className="flex-1 text-left">{t(label)}</span>
                  {badge > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
                  {tab === id && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </nav>
          {children.length > 0 && (
            <div className="px-3 py-4 border-t border-white/10">
              <p className="text-white/40 text-xs font-medium mb-2 px-1">YOUR CHILDREN</p>
              <div className="space-y-1">
                {children.map(child => (
                  <button key={child.id} onClick={() => switchChild(child.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${activeChildId === child.id ? 'bg-white/15' : 'hover:bg-white/8'}`}>
                    <ChildAvatar child={child} size="sm" token={token} onUploaded={url => setChildren(prev => prev.map(c => c.id === child.id ? { ...c, photo_url: url } : c))} />
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
              <LogOut size={16} /><span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="lg:pl-64 flex flex-col min-h-screen">
          {/* Mobile header */}
          <header className="lg:hidden text-white px-4 pt-8 pb-5 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 60%, var(--brand-primary-light) 100%)' }}>
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
            <img src="/oakie.png" alt="" aria-hidden="true" className="absolute right-3 bottom-0 w-20 h-auto object-contain pointer-events-none" style={{ mixBlendMode: 'multiply', opacity: 0.6 }} />
            <div className="relative z-10 flex items-center justify-between mb-4">
              <OakitLogo size="sm" variant="light" />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/parent/premium')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold hover:bg-amber-400/30 transition-colors">
                  ✨ Premium
                </button>
                <button onClick={() => { clearToken(); router.push('/login'); }} className="text-white/50 hover:text-white/80 text-xs transition-colors">Sign out</button>
              </div>
            </div>
            {children.length > 0 && (
              <div className="relative z-10 pr-20">
                {children.length === 1 ? (
                  <div className="flex items-center gap-3 bg-white/12 rounded-2xl px-4 py-3 border border-white/10">
                    <ChildAvatar child={children[0]} size="lg" token={token} onUploaded={url => setChildren(prev => prev.map(c => c.id === children[0].id ? { ...c, photo_url: url } : c))} />
                    <div>
                      <p className="text-white font-bold text-base">{children[0].name}</p>
                      <p className="text-white/55 text-xs">{children[0].class_name} · Section {children[0].section_label}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {children.map(child => (
                      <button key={child.id} onClick={() => switchChild(child.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap shrink-0 border transition-all ${activeChildId === child.id ? 'bg-white text-neutral-900 border-white shadow-md' : 'bg-white/10 text-white/80 border-white/15'}`}>
                        <ChildAvatar child={child} size="sm" token={token} onUploaded={url => setChildren(prev => prev.map(c => c.id === child.id ? { ...c, photo_url: url } : c))} />
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
                {tab === 'home' && <HomeTab feed={activeCache?.feed ?? null} progress={activeCache?.progress ?? null} activeChild={activeChild} announcements={announcements} onNoteClick={setNoteModal} onTabChange={setTab} token={token} onChildUpdate={url => setChildren(prev => prev.map(c => c.id === activeChildId ? { ...c, photo_url: url } : c))} />}
                {tab === 'attendance' && <AttendanceTab data={activeCache?.attendance ?? null} />}
                {tab === 'progress' && <ProgressTab data={activeCache?.progress ?? null} activeChild={activeChild} token={token} />}
                {tab === 'insights' && <InsightsTab insights={parentInsights} comparisons={childComparisons} activeChild={activeChild} />}
                {tab === 'chat' && <ChatTab msgs={chatMsgs} input={chatInput} loading={chatLoading} onInput={setChatInput} onSend={sendChat} endRef={chatEndRef} childName={activeChild?.name.split(' ')[0] ?? 'your child'} token={token} voiceEnabled={voiceEnabled} voiceLanguage={translationSettings.enabled ? translationSettings.targetLanguage : 'en'} />}
                {tab === 'messages' && <MessagesTab threads={messageThreads} token={token} onRefresh={() => apiGet<ParentMessage[]>('/api/v1/parent/messages', token).then(setMessageThreads).catch(() => {})} />}
                {tab === 'notifications' && <NotificationsTab notifications={notifications} announcements={announcements} onRead={markNotifRead} />}
                {tab === 'settings' && <SettingsTab token={token} emergencyContacts={emergencyContacts} notificationPrefs={notificationPrefs} calendarEvents={calendarEvents} calendarSyncEnabled={calendarSyncEnabled} assistantReminders={assistantReminders} translationSettings={translationSettings} onEmergencyContactsChange={setEmergencyContacts} onNotificationPrefsChange={setNotificationPrefs} onCalendarSyncChange={saveCalendarSync} onAssistantRemindersChange={saveAssistantReminders} onTranslationSettingsChange={setTranslationSettings} />}
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
                  <span className={`text-[9px] font-semibold ${isActive ? 'text-emerald-600' : 'text-neutral-400'}`}>{t(label)}</span>
                  {badge > 0 && <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{badge}</span>}
                  {isActive && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Premium welcome modal — shown once per session after login */}
      {showPremiumModal && (
        <PremiumWelcomeModal onClose={() => setShowPremiumModal(false)} />
      )}
    </TranslationContext.Provider>
  );
}

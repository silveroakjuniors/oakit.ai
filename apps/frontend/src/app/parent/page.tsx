'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Calendar, TrendingUp, Sparkles, MessageSquare, Bell,
  LogOut, BookOpen, Clock, CheckCircle2, AlertCircle, User,
  ChevronRight, Send, Loader2, RefreshCw, Phone, Shield, Settings,
  BarChart3, Target, Zap, CalendarDays, Apple, Smartphone
} from 'lucide-react';
import { API_BASE, apiGet, apiPost, apiDelete, apiPut } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import OakitLogo from '@/components/OakitLogo';

// ─── Translation Settings Interface (must be BEFORE TranslationContext) ───────
interface TranslationSettings {
  enabled: boolean;
  targetLanguage: string;
  autoTranslate: boolean;
  supportedLanguages: string[];
}

// ─── Translation Context ──────────────────────────────────────────────────────
const TranslationContext = React.createContext<{
  t: (key: string, defaultText?: string) => string;
  settings: TranslationSettings;
}>({
  t: (key, defaultText) => defaultText || key,
  settings: { enabled: false, targetLanguage: 'en', autoTranslate: false, supportedLanguages: [] }
});

// Simple translation dictionary
const translations: Record<string, Record<string, string>> = {
  hi: {
    'Home': 'होम', 'Attendance': 'उपस्थिति', 'Progress': 'प्रगति', 'Insights': 'अंतर्दृष्टि',
    'Oakie': 'ओकी', 'Messages': 'संदेश', 'Updates': 'अपडेट', 'Settings': 'सेटिंग्स',
    'Emergency Contacts': 'आपातकालीन संपर्क', 'Notification Preferences': 'सूचना प्राथमिकताएं',
    'Calendar Integration': 'कैलेंडर एकीकरण', 'Translation Settings': 'अनुवाद सेटिंग्स',
    'Progress Predictions': 'प्रगति भविष्यवाणी', 'Goal Setting': 'लक्ष्य निर्धारण',
    'Performance Comparison': 'प्रदर्शन तुलना', 'Next Week Attendance': 'अगले सप्ताह की उपस्थिति',
    'End of Month Progress': 'माह के अंत में प्रगति', 'Areas Needing Attention': 'ध्यान देने योग्य क्षेत्र',
    'Academic Goals': 'शैक्षणिक लक्ष्य', 'Behavioral Goals': 'व्यवहारिक लक्ष्य',
    'Attendance Goals': 'उपस्थिति लक्ष्य', 'Enable Translation': 'अनुवाद सक्षम करें',
    'Target Language': 'लक्ष्य भाषा', 'Auto Translation': 'स्वत: अनुवाद',
    'Predicted attendance rate': 'भविष्यवाणी उपस्थिति दर', 'Expected academic progress': 'अपेक्षित शैक्षणिक प्रगति',
    'Notifications': 'सूचनाएं',
  },
  te: {
    'Home': 'హోమ్', 'Attendance': 'హాజరు', 'Progress': 'ప్రోగ్రెస్', 'Insights': 'ఇన్సైట్స్',
    'Oakie': 'ఓకీ', 'Messages': 'సందేశాలు', 'Updates': 'నవీకరణలు', 'Settings': 'సెట్టింగులు',
    'Emergency Contacts': 'అత్యవసర సంప్రదింపులు', 'Notification Preferences': 'నోటిఫికేషన్ ప్రాధాన్యతలు',
    'Calendar Integration': 'క్యాలెండర్ ఇంటిగ్రేషన్', 'Translation Settings': 'అనువాద సెట్టింగులు',
    'Progress Predictions': 'ప్రోగ్రెస్ అంచనాలు', 'Goal Setting': 'లక్ష్య సెట్టింగ్',
    'Performance Comparison': 'పనితీరు పోలిక', 'Next Week Attendance': 'తదుపరి వారం హాజరు',
    'End of Month Progress': 'నెల ముగింపు ప్రోగ్రెస్', 'Areas Needing Attention': 'దృష్టి అవసరమైన ప్రాంతాలు',
    'Academic Goals': 'విద్యా లక్ష్యాలు', 'Behavioral Goals': 'వ్యవహార లక్ష్యాలు',
    'Attendance Goals': 'హాజరు లక్ష్యాలు', 'Enable Translation': 'అనువాదాన్ని ప్రారంభించు',
    'Target Language': 'లక్ష్య భాష', 'Auto Translation': 'స్వయంచాలక అనువాదం',
    'Predicted attendance rate': 'అంచనా హాజరు రేటు', 'Expected academic progress': 'అంచనా విద్యా ప్రోగ్రెస్',
    'Notifications': 'నోటిఫికేషన్లు',
  }
};

function useTranslation() {
  return React.useContext(TranslationContext);
}

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

interface EmergencyContact {
  id: string; name: string; relation: string; phone: string;
  priority: 1 | 2 | 3; available: boolean;
}
interface NotificationPreference {
  type: 'homework' | 'attendance' | 'progress' | 'messages' | 'announcements';
  enabled: boolean; channels: ('push' | 'sms' | 'email')[];
  quietHours: { start: string; end: string } | null;
  frequency: 'immediate' | 'daily' | 'weekly';
}
interface CalendarEvent {
  id: string; title: string; description: string; start: string; end: string;
  type: 'homework' | 'exam' | 'holiday' | 'event' | 'meeting'; childId: string;
}
interface Goal {
  id: string; title: string; description: string; target: string; current: string;
  deadline: string; status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
  category: 'academic' | 'behavioral' | 'attendance';
}
interface ParentInsights {
  attendanceTrend: 'improving' | 'declining' | 'stable';
  participationScore: number; strengths: string[]; areasForImprovement: string[];
  teacherFeedback: string[];
  predictions: { nextWeekAttendance: number; endOfMonthProgress: number; areasNeedingAttention: string[]; };
  goals?: { academic: Goal[]; behavioral: Goal[]; attendance: Goal[]; };
}
interface ChildComparison {
  childId: string; name: string; attendance: number; progress: number;
  participation: number; rank: number; trend: 'up' | 'down' | 'stable';
}

type Tab = 'home' | 'attendance' | 'progress' | 'chat' | 'messages' | 'notifications' | 'insights' | 'settings';

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

function defaultChat(name?: string): ChatMsg[] {
  return [{ role: 'ai', text: `Hi! I'm Oakie 🌳 Ask me anything about ${name ? name.split(' ')[0] : 'your child'} — what they studied today, attendance, or progress.`, ts: 0 }];
}

// ─── ChildAvatar ──────────────────────────────────────────────────────────────
function ChildAvatar({ child, size = 'md', token, onUploaded }: {
  child: Child; size?: 'sm' | 'md' | 'lg';
  token?: string; onUploaded?: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const sz = size === 'sm' ? 'w-8 h-8 text-sm' : size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-10 h-10 text-base';
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
          <img src={photoUrl} alt={child.name}
            className={`${sz} rounded-full object-contain bg-white border-2 border-white/20`}
            onClick={e => { e.preventDefault(); setPreview(photoUrl); }} />
        ) : (
          <div className={`${sz} rounded-full bg-white/20 flex items-center justify-center font-bold text-white`}>
            {uploading ? <span className="text-xs animate-spin">⏳</span> : child.name[0]}
          </div>
        )}
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
          <span className="text-white text-xs">📷</span>
        </div>
        {token && <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} />}
      </label>
    </>
  );
}

// ─── ParentPage (main default export) ────────────────────────────────────────
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

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreference[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [parentInsights, setParentInsights] = useState<ParentInsights | null>(null);
  const [childComparisons, setChildComparisons] = useState<ChildComparison[]>([]);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [assistantReminders, setAssistantReminders] = useState(false);
  const [translationSettings, setTranslationSettings] = useState<TranslationSettings>({
    enabled: false,
    targetLanguage: 'en',
    autoTranslate: false,
    supportedLanguages: ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'gu', 'bn', 'mr', 'pa']
  });

  // ParentPage defines its own t() helper — does NOT call useTranslation()
  function t(key: string, defaultText?: string): string {
    if (!translationSettings.enabled || translationSettings.targetLanguage === 'en') {
      return defaultText || key;
    }
    return translations[translationSettings.targetLanguage]?.[key] || defaultText || key;
  }

  async function saveCalendarSync(enabled: boolean) {
    try {
      await apiPut('/api/v1/parent/settings', { calendar_sync: enabled }, token);
      setCalendarSyncEnabled(enabled);
      localStorage.setItem('calendar_sync', String(enabled));
    } catch (e) {
      console.error('Failed to save calendar sync', e);
      alert('Failed to save calendar sync setting');
    }
  }

  async function saveAssistantReminders(enabled: boolean) {
    try {
      await apiPut('/api/v1/parent/settings', { assistant_reminders: enabled }, token);
      setAssistantReminders(enabled);
      localStorage.setItem('assistant_reminders', String(enabled));
    } catch (e) {
      console.error('Failed to save assistant reminders', e);
      alert('Failed to save assistant reminders setting');
    }
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
        if (msg.includes('Password change required') || msg.includes('force_password_reset')) {
          router.push('/auth/change-password'); return;
        }
        if (msg.includes('Invalid or expired token') || msg.includes('Missing authorization')) {
          clearToken(); router.push('/login'); return;
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

      (async () => {
        try {
          const [rows, settings] = await Promise.all([
            apiGet<any[]>('/api/v1/parent/emergency-contacts', token),
            apiGet<any>('/api/v1/parent/settings', token),
          ]);
          const mapped = rows.map(r => ({ id: r.id, name: r.name, relation: r.relationship || r.relation || '', phone: r.phone, priority: r.is_primary ? 1 : 2, available: true }));
          setEmergencyContacts(mapped as EmergencyContact[]);
          if (settings) {
            if (settings.notification_prefs) setNotificationPrefs(settings.notification_prefs);
            if (typeof settings.calendar_sync === 'boolean') setCalendarSyncEnabled(settings.calendar_sync);
            if (typeof settings.assistant_reminders === 'boolean') setAssistantReminders(settings.assistant_reminders);
            if (settings.translation_settings) setTranslationSettings(settings.translation_settings);
          }
        } catch {
          loadMockFeaturesData(true);
        }
      })();

      if (kids.length > 0) { setActiveChildId(kids[0].id); await fetchChildData(kids[0].id); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  function loadMockFeaturesData(includeEmergency = true) {
    if (includeEmergency) {
      setEmergencyContacts([
        { id: '1', name: 'John Doe', relation: 'Father', phone: '+91-9876543210', priority: 1, available: true },
        { id: '2', name: 'Jane Doe', relation: 'Mother', phone: '+91-9876543211', priority: 2, available: false },
        { id: '3', name: 'Grandma', relation: 'Grandmother', phone: '+91-9876543212', priority: 3, available: true },
      ]);
    }
    setNotificationPrefs([
      { type: 'homework', enabled: true, channels: ['push', 'email'], quietHours: { start: '22:00', end: '07:00' }, frequency: 'immediate' },
      { type: 'attendance', enabled: true, channels: ['push'], quietHours: null, frequency: 'daily' },
      { type: 'progress', enabled: true, channels: ['email'], quietHours: null, frequency: 'weekly' },
      { type: 'messages', enabled: true, channels: ['push', 'sms'], quietHours: { start: '22:00', end: '07:00' }, frequency: 'immediate' },
      { type: 'announcements', enabled: false, channels: ['email'], quietHours: null, frequency: 'weekly' },
    ]);
    setCalendarEvents([
      { id: '1', title: 'Math Homework Due', description: 'Complete exercises 1-10 from chapter 5', start: '2026-04-20T18:00:00', end: '2026-04-20T18:00:00', type: 'homework', childId: activeChildId || '' },
      { id: '2', title: 'Parent-Teacher Meeting', description: "Discuss progress this term", start: '2026-04-25T10:00:00', end: '2026-04-25T11:00:00', type: 'meeting', childId: activeChildId || '' },
      { id: '3', title: 'Science Exam', description: 'Chapter 3-5 assessment', start: '2026-04-22T09:00:00', end: '2026-04-22T10:30:00', type: 'exam', childId: activeChildId || '' },
    ]);
    setParentInsights({
      attendanceTrend: 'improving', participationScore: 85,
      strengths: ['Mathematics', 'Reading Comprehension', 'Class Participation'],
      areasForImprovement: ['Handwriting', 'Physical Education'],
      teacherFeedback: ['Excellent progress in math this month', 'Shows great enthusiasm for learning'],
      predictions: { nextWeekAttendance: 95, endOfMonthProgress: 88, areasNeedingAttention: ['Practice handwriting daily'] },
      goals: {
        academic: [
          { id: '1', title: 'Improve Math Grade', description: 'Achieve 90% or higher in mathematics', target: '90%', current: '85%', deadline: '2026-06-30', status: 'in_progress', category: 'academic' },
          { id: '2', title: 'Complete Reading Program', description: 'Finish all assigned reading comprehension exercises', target: '100%', current: '75%', deadline: '2026-05-15', status: 'in_progress', category: 'academic' },
        ],
        behavioral: [
          { id: '3', title: 'Class Participation', description: 'Actively participate in 80% of class activities', target: '80%', current: '65%', deadline: '2026-04-30', status: 'in_progress', category: 'behavioral' },
        ],
        attendance: [
          { id: '4', title: 'Perfect Attendance Month', description: 'Attend all classes for the entire month', target: '100%', current: '92%', deadline: '2026-04-30', status: 'in_progress', category: 'attendance' },
        ]
      }
    });
    setChildComparisons([
      { childId: activeChildId || '', name: activeChild?.name || 'Your Child', attendance: 92, progress: 88, participation: 85, rank: 3, trend: 'up' },
      { childId: 'comp1', name: 'Class Average', attendance: 87, progress: 82, participation: 78, rank: 0, trend: 'stable' },
      { childId: 'comp2', name: 'Top Performer', attendance: 98, progress: 95, participation: 92, rank: 1, trend: 'up' },
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
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium">Try again</button>
          <button onClick={() => { clearToken(); router.push('/login'); }}
            className="ml-3 px-4 py-2 border border-neutral-200 rounded-xl text-sm text-neutral-600">Sign out</button>
        </div>
      </div>
    );
  }

  const translationContextValue = {
    t: (key: string, defaultText?: string) => {
      if (!translationSettings.enabled || translationSettings.targetLanguage === 'en') {
        return defaultText || key;
      }
      return translations[translationSettings.targetLanguage]?.[key] || defaultText || key;
    },
    settings: translationSettings
  };

  return (
    <TranslationContext.Provider value={translationContextValue}>
      <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
        {/* Note Modal inside Provider */}
        {noteModal && <NoteModal note={noteModal} token={token} onClose={() => setNoteModal(null)} />}

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
            {children.length > 0 && (
              <div className="relative z-10 pr-20">
                {children.length === 1 ? (
                  <div className="flex items-center gap-3 bg-white/12 rounded-2xl px-4 py-3 border border-white/10">
                    <ChildAvatar child={children[0]} size="lg" token={token} onUploaded={(url) => setChildren(prev => prev.map(c => c.id === children[0].id ? { ...c, photo_url: url } : c))} />
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
                {tab === 'insights' && <InsightsTab insights={parentInsights} comparisons={childComparisons} activeChild={activeChild} />}
                {tab === 'chat' && <ChatTab msgs={chatMsgs} input={chatInput} loading={chatLoading} onInput={setChatInput} onSend={sendChat} endRef={chatEndRef} childName={activeChild?.name.split(' ')[0] ?? 'your child'} />}
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
    </TranslationContext.Provider>
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
      if (res.url && res.url.startsWith('https://') && !res.url.includes('localhost')) {
        window.open(res.url, '_blank'); return;
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

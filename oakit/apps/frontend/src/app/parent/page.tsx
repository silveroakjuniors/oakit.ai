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

// ─── Translation Context ──────────────────────────────────────────────────────
const TranslationContext = React.createContext<{
  t: (key: string, defaultText?: string) => string;
  settings: TranslationSettings;
}>({
  t: (key, defaultText) => defaultText || key,
  settings: { enabled: false, targetLanguage: 'en', autoTranslate: false, supportedLanguages: [] }
});

// Simple translation dictionary (in a real app, this would come from an API)
const translations: Record<string, Record<string, string>> = {
  hi: {
    'Home': 'होम',
    'Attendance': 'उपस्थिति',
    'Progress': 'प्रगति',
    'Insights': 'अंतर्दृष्टि',
    'Oakie': 'ओकी',
    'Messages': 'संदेश',
    'Updates': 'अपडेट',
    'Settings': 'सेटिंग्स',
    'Emergency Contacts': 'आपातकालीन संपर्क',
    'Notification Preferences': 'सूचना प्राथमिकताएं',
    'Calendar Integration': 'कैलेंडर एकीकरण',
    'Translation Settings': 'अनुवाद सेटिंग्स',
    'Progress Predictions': 'प्रगति भविष्यवाणी',
    'Goal Setting': 'लक्ष्य निर्धारण',
    'Performance Comparison': 'प्रदर्शन तुलना',
    'Next Week Attendance': 'अगले सप्ताह की उपस्थिति',
    'End of Month Progress': 'माह के अंत में प्रगति',
    'Areas Needing Attention': 'ध्यान देने योग्य क्षेत्र',
    'Academic Goals': 'शैक्षणिक लक्ष्य',
    'Behavioral Goals': 'व्यवहारिक लक्ष्य',
    'Attendance Goals': 'उपस्थिति लक्ष्य',
    'Enable Translation': 'अनुवाद सक्षम करें',
    'Target Language': 'लक्ष्य भाषा',
    'Auto Translation': 'स्वत: अनुवाद',
    'Predicted attendance rate': 'भविष्यवाणी उपस्थिति दर',
    'Expected academic progress': 'अपेक्षित शैक्षणिक प्रगति'
  },
  te: {
    'Home': 'హోమ్',
    'Attendance': 'హాజరు',
    'Progress': 'ప్రోగ్రెస్',
    'Insights': 'ఇన్సైట్స్',
    'Oakie': 'ఓకీ',
    'Messages': 'సందేశాలు',
    'Updates': 'నవీకరణలు',
    'Settings': 'సెట్టింగులు',
    'Emergency Contacts': 'అత్యవసర సంప్రదింపులు',
    'Notification Preferences': 'నోటిఫికేషన్ ప్రాధాన్యతలు',
    'Calendar Integration': 'క్యాలెండర్ ఇంటిగ్రేషన్',
    'Translation Settings': 'అనువాద సెట్టింగులు',
    'Progress Predictions': 'ప్రోగ్రెస్ అంచనాలు',
    'Goal Setting': 'లక్ష్య సెట్టింగ్',
    'Performance Comparison': 'పనితీరు పోలిక',
    'Next Week Attendance': 'తదుపరి వారం హాజరు',
    'End of Month Progress': 'నెల ముగింపు ప్రోగ్రెస్',
    'Areas Needing Attention': 'దృష్టి అవసరమైన ప్రాంతాలు',
    'Academic Goals': 'విద్యా లక్ష్యాలు',
    'Behavioral Goals': 'వ్యవహార లక్ష్యాలు',
    'Attendance Goals': 'హాజరు లక్ష్యాలు',
    'Enable Translation': 'అనువాదాన్ని ప్రారంభించు',
    'Target Language': 'లక్ష్య భాష',
    'Auto Translation': 'స్వయంచాలక అనువాదం',
    'Predicted attendance rate': 'అంచనా హాజరు రేటు',
    'Expected academic progress': 'అంచనా విద్యా ప్రోగ్రెస్'
  }
};

function useTranslation() {
  const context = React.useContext(TranslationContext);
  return context;
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

// ─── New Feature Types ────────────────────────────────────────────────────────
interface EmergencyContact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  priority: 1 | 2 | 3;
  available: boolean;
}

interface NotificationPreference {
  type: 'homework' | 'attendance' | 'progress' | 'messages' | 'announcements';
  enabled: boolean;
  channels: ('push' | 'sms' | 'email')[];
  quietHours: { start: string; end: string } | null;
  frequency: 'immediate' | 'daily' | 'weekly';
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  type: 'homework' | 'exam' | 'holiday' | 'event' | 'meeting';
  childId: string;
}

interface ParentInsights {
  attendanceTrend: 'improving' | 'declining' | 'stable';
  participationScore: number;
  strengths: string[];
  areasForImprovement: string[];
  teacherFeedback: string[];
  predictions: {
    nextWeekAttendance: number;
    endOfMonthProgress: number;
    areasNeedingAttention: string[];
  };
  goals?: {
    academic: Goal[];
    behavioral: Goal[];
    attendance: Goal[];
  };
}

interface Goal {
  id: string;
  title: string;
  description: string;
  target: string;
  current: string;
  deadline: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
  category: 'academic' | 'behavioral' | 'attendance';
}

interface TranslationSettings {
  enabled: boolean;
  targetLanguage: string;
  autoTranslate: boolean;
  supportedLanguages: string[];
}

interface ChildComparison {
  childId: string;
  name: string;
  attendance: number;
  progress: number;
  participation: number;
  rank: number;
  trend: 'up' | 'down' | 'stable';
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

  // ─── New Feature State ──────────────────────────────────────────────────────
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

  const { t } = useTranslation();

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
      
      // Load emergency contacts and settings from API (fallback to mock data)
      (async () => {
        try {
          const [rows, settings] = await Promise.all([
            apiGet<any[]>('/api/v1/parent/emergency-contacts', token),
            apiGet<any>('/api/v1/parent/settings', token),
          ]);
          const mapped = rows.map(r => ({ id: r.id, name: r.name, relation: r.relationship || r.relation || '', phone: r.phone, priority: r.is_primary ? 1 : 2, available: true }));
          setEmergencyContacts(mapped);
          if (settings) {
            if (settings.notification_prefs) setNotificationPrefs(settings.notification_prefs);
            if (typeof settings.calendar_sync === 'boolean') setCalendarSyncEnabled(settings.calendar_sync);
            if (typeof settings.assistant_reminders === 'boolean') setAssistantReminders(settings.assistant_reminders);
            if (settings.translation_settings) setTranslationSettings(settings.translation_settings);
          }
        } catch (e) {
          // fallback to mock data for other features
          loadMockFeaturesData(true);
        }
      })();
      
      if (kids.length > 0) { setActiveChildId(kids[0].id); await fetchChildData(kids[0].id); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  // ─── Mock Data for New Features ─────────────────────────────────────────────
  function loadMockFeaturesData(includeEmergency = true) {
    // Emergency Contacts
    if (includeEmergency) {
      setEmergencyContacts([
        { id: '1', name: 'John Doe', relation: 'Father', phone: '+91-9876543210', priority: 1, available: true },
        { id: '2', name: 'Jane Doe', relation: 'Mother', phone: '+91-9876543211', priority: 2, available: false },
        { id: '3', name: 'Grandma', relation: 'Grandmother', phone: '+91-9876543212', priority: 3, available: true },
      ]);
    }

    // Notification Preferences
    setNotificationPrefs([
      { type: 'homework', enabled: true, channels: ['push', 'email'], quietHours: { start: '22:00', end: '07:00' }, frequency: 'immediate' },
      { type: 'attendance', enabled: true, channels: ['push'], quietHours: null, frequency: 'daily' },
      { type: 'progress', enabled: true, channels: ['email'], quietHours: null, frequency: 'weekly' },
      { type: 'messages', enabled: true, channels: ['push', 'sms'], quietHours: { start: '22:00', end: '07:00' }, frequency: 'immediate' },
      { type: 'announcements', enabled: false, channels: ['email'], quietHours: null, frequency: 'weekly' },
    ]);

    // Calendar Events
    setCalendarEvents([
      { id: '1', title: 'Math Homework Due', description: 'Complete exercises 1-10 from chapter 5', start: '2026-04-20T18:00:00', end: '2026-04-20T18:00:00', type: 'homework', childId: activeChildId || '' },
      { id: '2', title: 'Parent-Teacher Meeting', description: 'Discuss Aarav\'s progress this term', start: '2026-04-25T10:00:00', end: '2026-04-25T11:00:00', type: 'meeting', childId: activeChildId || '' },
      { id: '3', title: 'Science Exam', description: 'Chapter 3-5 assessment', start: '2026-04-22T09:00:00', end: '2026-04-22T10:30:00', type: 'exam', childId: activeChildId || '' },
    ]);

    // Parent Insights
    setParentInsights({
      attendanceTrend: 'improving',
      participationScore: 85,
      strengths: ['Mathematics', 'Reading Comprehension', 'Class Participation'],
      areasForImprovement: ['Handwriting', 'Physical Education'],
      teacherFeedback: ['Excellent progress in math this month', 'Shows great enthusiasm for learning'],
      predictions: {
        nextWeekAttendance: 95,
        endOfMonthProgress: 88,
        areasNeedingAttention: ['Practice handwriting daily']
      },
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

    // Child Comparisons
    setChildComparisons([
      { childId: activeChildId || '', name: activeChild?.name || 'Your Child', attendance: 92, progress: 88, participation: 85, rank: 3, trend: 'up' },
      { childId: 'comp1', name: 'Class Average', attendance: 87, progress: 82, participation: 78, rank: 0, trend: 'stable' },
      { childId: 'comp2', name: 'Top Performer', attendance: 98, progress: 95, participation: 92, rank: 1, trend: 'up' },
    ]);

    // Integration Settings
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
      </div>
    </div>
  );
}

function InsightsTab({ insights, comparisons, activeChild }: { insights: ParentInsights | null; comparisons: ChildComparison[]; activeChild: Child | null }) {
  const { t } = useTranslation();
  if (!insights || !activeChild) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-neutral-300 animate-spin" />
      </div>
    );
  }

  const getStatusColor = (status: Goal['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'overdue': return 'text-red-600 bg-red-50';
      default: return 'text-neutral-600 bg-neutral-50';
    }
  };

  const getStatusIcon = (status: Goal['status']) => {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '🔄';
      case 'overdue': return '⚠️';
      default: return '⏳';
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Predictions */}
      <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-6 h-6 text-emerald-600" />
          <h2 className="text-xl font-bold text-neutral-800">{t('Progress Predictions')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-emerald-800">{t('Next Week Attendance')}</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-700">{insights.predictions.nextWeekAttendance}%</div>
            <div className="text-xs text-emerald-600 mt-1">Predicted attendance rate</div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-800">End of Month Progress</span>
              <BarChart3 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-700">{insights.predictions.endOfMonthProgress}%</div>
            <div className="text-xs text-blue-600 mt-1">Expected academic progress</div>
          </div>
        </div>

        {insights.predictions.areasNeedingAttention.length > 0 && (
          <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 mb-2">Areas Needing Attention</h3>
                <ul className="text-sm text-amber-700 space-y-1">
                  {insights.predictions.areasNeedingAttention.map((area, idx) => (
                    <li key={idx}>• {area}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Goal Setting */}
      <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-bold text-neutral-800">Goal Setting</h2>
        </div>

        {insights.goals && (
          <div className="space-y-4">
            {Object.entries(insights.goals).map(([category, goals]) => (
              <div key={category}>
                <h3 className="font-semibold text-neutral-700 mb-3 capitalize flex items-center gap-2">
                  {category === 'academic' && <BookOpen className="w-4 h-4" />}
                  {category === 'behavioral' && <User className="w-4 h-4" />}
                  {category === 'attendance' && <Calendar className="w-4 h-4" />}
                  {category} Goals
                </h3>
                <div className="space-y-3">
                  {goals.map(goal => (
                    <div key={goal.id} className="border border-neutral-200 rounded-xl p-4 hover:bg-neutral-50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-neutral-800">{goal.title}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(goal.status)}`}>
                              {getStatusIcon(goal.status)} {goal.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-neutral-600 mb-2">{goal.description}</p>
                          <div className="flex items-center gap-4 text-xs text-neutral-500">
                            <span>Target: {goal.target}</span>
                            <span>Current: {goal.current}</span>
                            <span>Due: {new Date(goal.deadline).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-neutral-600 mb-1">
                          <span>Progress</span>
                          <span>{goal.current} / {goal.target}</span>
                        </div>
                        <div className="w-full bg-neutral-200 rounded-full h-2">
                          <div
                            className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (parseFloat(goal.current) / parseFloat(goal.target.replace('%', ''))) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Child Comparison */}
      <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-neutral-800">Performance Comparison</h2>
        </div>

        <div className="space-y-3">
          {comparisons.map(comp => (
            <div key={comp.childId} className={`border rounded-xl p-4 ${comp.childId === activeChild.id ? 'border-emerald-300 bg-emerald-50' : 'border-neutral-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-neutral-800">{comp.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-600">Rank #{comp.rank}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${comp.trend === 'up' ? 'text-green-600 bg-green-50' : comp.trend === 'down' ? 'text-red-600 bg-red-50' : 'text-neutral-600 bg-neutral-50'}`}>
                    {comp.trend === 'up' ? '↗️' : comp.trend === 'down' ? '↘️' : '→'} {comp.trend}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-neutral-500">Attendance</div>
                  <div className="font-semibold text-neutral-800">{comp.attendance}%</div>
                </div>
                <div>
                  <div className="text-neutral-500">Progress</div>
                  <div className="font-semibold text-neutral-800">{comp.progress}%</div>
                </div>
                <div>
                  <div className="text-neutral-500">Participation</div>
                  <div className="font-semibold text-neutral-800">{comp.participation}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ token, emergencyContacts, notificationPrefs, calendarEvents, calendarSyncEnabled, assistantReminders, translationSettings, onEmergencyContactsChange, onNotificationPrefsChange, onCalendarSyncChange, onAssistantRemindersChange, onTranslationSettingsChange }: {
  emergencyContacts: EmergencyContact[];
  notificationPrefs: NotificationPreference[];
  calendarEvents: CalendarEvent[];
  calendarSyncEnabled: boolean;
  assistantReminders: boolean;
  translationSettings: TranslationSettings;
  onEmergencyContactsChange: (contacts: EmergencyContact[]) => void;
  onNotificationPrefsChange: (prefs: NotificationPreference[]) => void;
  onCalendarSyncChange: (enabled: boolean) => void;
  onAssistantRemindersChange: (enabled: boolean) => void;
  onTranslationSettingsChange: (settings: TranslationSettings) => void;
  token: string;
}) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<'emergency' | 'notifications' | 'calendar' | 'translation'>('emergency');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPriority, setNewPriority] = useState<number>(2);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRelation, setEditRelation] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPriority, setEditPriority] = useState<number>(2);
  const [editSaving, setEditSaving] = useState(false);

  const [localPrefs, setLocalPrefs] = useState<NotificationPreference[]>(notificationPrefs);
  useEffect(() => setLocalPrefs(notificationPrefs), [notificationPrefs]);

  const languageNames: Record<string, string> = {
    en: 'English',
    hi: 'हिंदी (Hindi)',
    te: 'తెలుగు (Telugu)',
    ta: 'தமிழ் (Tamil)',
    kn: 'ಕನ್ನಡ (Kannada)',
    ml: 'മലയാളം (Malayalam)',
    gu: 'ગુજરાતી (Gujarati)',
    bn: 'বাংলা (Bengali)',
    mr: 'मराठी (Marathi)',
    pa: 'ਪੰਜਾਬੀ (Punjabi)'
  };

  return (
    <div className="space-y-6">
      {/* Settings Navigation */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'emergency', label: t('Emergency Contacts'), icon: Shield },
            { id: 'notifications', label: t('Notifications'), icon: Bell },
            { id: 'calendar', label: t('Calendar Integration'), icon: CalendarDays },
            { id: 'translation', label: t('Translation Settings'), icon: Zap }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeSection === id ? 'bg-emerald-100 text-emerald-700' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Emergency Contacts Section */}
      {activeSection === 'emergency' && (
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-bold text-neutral-800">Emergency Contacts</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-neutral-600">Manage who the school should contact in an emergency.</p>
              <button onClick={() => setShowAddForm(s => !s)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-sm">{showAddForm ? 'Close' : 'Add contact'}</button>
            </div>
            {showAddForm && (
              <div className="p-4 border border-neutral-200 rounded-xl space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" className="col-span-1 p-2 border rounded-md" />
                  <input value={newRelation} onChange={e => setNewRelation(e.target.value)} placeholder="Relation" className="col-span-1 p-2 border rounded-md" />
                  <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone" className="col-span-1 p-2 border rounded-md" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-neutral-600">Priority</label>
                  <select value={String(newPriority)} onChange={e => setNewPriority(Number(e.target.value))} className="p-2 border rounded-md text-sm">
                    <option value="1">1 — Primary</option>
                    <option value="2">2 — Secondary</option>
                    <option value="3">3 — Other</option>
                  </select>
                  <div className="flex-1" />
                  <button onClick={async () => {
                    if (!newName.trim() || !newPhone.trim()) return;
                    setCreating(true);
                    try {
                      const payload = { name: newName.trim(), relationship: newRelation.trim() || null, phone: newPhone.trim(), phone_type: null, is_primary: newPriority === 1 };
                      const created = await apiPost<any>('/api/v1/parent/emergency-contacts', payload, token);
                      const mapped = { id: created.id, name: created.name, relation: created.relationship || created.relation || '', phone: created.phone, priority: created.is_primary ? 1 : 2, available: true };
                      onEmergencyContactsChange([...emergencyContacts, mapped]);
                      setNewName(''); setNewRelation(''); setNewPhone(''); setNewPriority(2); setShowAddForm(false);
                    } catch (err) { console.error(err); alert('Failed to add contact'); }
                    finally { setCreating(false); }
                  }} className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-sm" disabled={creating}>{creating ? 'Adding…' : 'Add'}</button>
                </div>
              </div>
            )}

            {emergencyContacts.map(contact => (
              <div key={contact.id} className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl">
                {editingId === contact.id ? (
                  <div className="flex-1">
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <input value={editName} onChange={e => setEditName(e.target.value)} className="p-2 border rounded-md" />
                      <input value={editRelation} onChange={e => setEditRelation(e.target.value)} className="p-2 border rounded-md" />
                      <input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="p-2 border rounded-md" />
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={String(editPriority)} onChange={e => setEditPriority(Number(e.target.value))} className="p-2 border rounded-md text-sm">
                        <option value="1">1 — Primary</option>
                        <option value="2">2 — Secondary</option>
                        <option value="3">3 — Other</option>
                      </select>
                      <div className="flex-1" />
                      <button onClick={async () => {
                        setEditSaving(true);
                        try {
                          const payload = { name: editName.trim(), relationship: editRelation.trim() || null, phone: editPhone.trim(), phone_type: null, is_primary: editPriority === 1 };
                          const updated = await apiPut<any>(`/api/v1/parent/emergency-contacts/${contact.id}`, payload, token);
                          const mapped = { id: updated.id, name: updated.name, relation: updated.relationship || updated.relation || '', phone: updated.phone, priority: updated.is_primary ? 1 : 2, available: true };
                          onEmergencyContactsChange(emergencyContacts.map(c => c.id === contact.id ? mapped : c));
                          setEditingId(null);
                        } catch (err) { console.error(err); alert('Failed to update contact'); }
                        finally { setEditSaving(false); }
                      }} className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-sm mr-2" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save'}</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-neutral-100 rounded-xl text-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${contact.available ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="font-semibold text-neutral-800">{contact.name}</div>
                        <div className="text-sm text-neutral-600">{contact.relation} • {contact.phone}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        contact.priority === 1 ? 'bg-red-100 text-red-700' :
                        contact.priority === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-neutral-100 text-neutral-700'
                      }`}>
                        Priority {contact.priority}
                      </span>
                      <button onClick={() => {
                        setEditingId(contact.id); setEditName(contact.name); setEditRelation(contact.relation); setEditPhone(contact.phone); setEditPriority(contact.priority || 2);
                      }} className="ml-2 text-sm text-emerald-700 px-3 py-1 rounded-md border border-emerald-100">Edit</button>
                      <button onClick={async () => {
                        if (!confirm('Delete this contact?')) return;
                        try {
                          await apiDelete(`/api/v1/parent/emergency-contacts/${contact.id}`, token);
                          onEmergencyContactsChange(emergencyContacts.filter(c => c.id !== contact.id));
                        } catch (err) { console.error(err); alert('Failed to delete'); }
                      }} className="ml-2 text-sm text-red-600 px-3 py-1 rounded-md border border-red-100">Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications Section Editor */}
      {activeSection === 'notifications' && (
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-neutral-800">Notification Preferences</h2>
          </div>

          <div className="space-y-4">
            {localPrefs.map((pref, idx) => (
              <div key={pref.type} className="p-4 border border-neutral-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold text-neutral-800 capitalize">{pref.type}</div>
                    <div className="text-sm text-neutral-600">Channels: {pref.channels.join(', ')}</div>
                  </div>
                  <label className="inline-flex items-center">
                    <input type="checkbox" checked={pref.enabled} onChange={e => { const updated = [...localPrefs]; updated[idx] = { ...pref, enabled: e.target.checked }; setLocalPrefs(updated); }} />
                    <span className="ml-2 text-sm">Enabled</span>
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  {(['push','sms','email'] as const).map(ch => (
                    <label key={ch} className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={pref.channels.includes(ch)} onChange={e => {
                        const updated = [...localPrefs];
                        const channels = new Set(pref.channels);
                        if (e.target.checked) channels.add(ch); else channels.delete(ch);
                        updated[idx] = { ...pref, channels: Array.from(channels) };
                        setLocalPrefs(updated);
                      }} />
                      <span className="capitalize">{ch}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-end">
              <button onClick={async () => {
                try {
                  await apiPut('/api/v1/parent/settings', { notification_prefs: localPrefs }, token);
                  onNotificationPrefsChange(localPrefs);
                  alert('Notification preferences saved');
                } catch (e) { console.error(e); alert('Failed to save preferences'); }
              }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl">Save Preferences</button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Section */}
      {activeSection === 'notifications' && (
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-neutral-800">Notification Preferences</h2>
          </div>

          <div className="space-y-4">
            {notificationPrefs.map(pref => (
              <div key={pref.type} className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl">
                <div className="flex-1">
                  <div className="font-semibold text-neutral-800 capitalize">{pref.type}</div>
                  <div className="text-sm text-neutral-600">
                    Channels: {pref.channels.join(', ')}
                    {pref.quietHours && ` • Quiet: ${pref.quietHours.start}-${pref.quietHours.end}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    pref.enabled ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'
                  }`}>
                    {pref.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar Section */}
      {activeSection === 'calendar' && (
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <CalendarDays className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-neutral-800">Calendar Integration</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl">
              <div>
                <div className="font-semibold text-neutral-800">Google Calendar Sync</div>
                <div className="text-sm text-neutral-600">Automatically sync homework and events</div>
              </div>
              <button
                onClick={() => onCalendarSyncChange(!calendarSyncEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  calendarSyncEnabled ? 'bg-emerald-600' : 'bg-neutral-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  calendarSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl">
              <div>
                <div className="font-semibold text-neutral-800">AI Assistant Reminders</div>
                <div className="text-sm text-neutral-600">Smart reminders for important dates</div>
              </div>
              <button
                onClick={() => onAssistantRemindersChange(!assistantReminders)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  assistantReminders ? 'bg-emerald-600' : 'bg-neutral-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  assistantReminders ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Translation Section */}
      {activeSection === 'translation' && (
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-neutral-800">Translation Settings</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl">
              <div>
                <div className="font-semibold text-neutral-800">Enable Translation</div>
                <div className="text-sm text-neutral-600">Translate app content to your preferred language</div>
              </div>
              <button
                onClick={() => onTranslationSettingsChange({ ...translationSettings, enabled: !translationSettings.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  translationSettings.enabled ? 'bg-emerald-600' : 'bg-neutral-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  translationSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {translationSettings.enabled && (
              <>
                <div className="p-4 border border-neutral-200 rounded-xl">
                  <label className="block text-sm font-semibold text-neutral-800 mb-2">Target Language</label>
                  <select
                    value={translationSettings.targetLanguage}
                    onChange={(e) => onTranslationSettingsChange({ ...translationSettings, targetLanguage: e.target.value })}
                    className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {translationSettings.supportedLanguages.map(lang => (
                      <option key={lang} value={lang}>{languageNames[lang]}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl">
                  <div>
                    <div className="font-semibold text-neutral-800">Auto Translation</div>
                    <div className="text-sm text-neutral-600">Automatically translate new content</div>
                  </div>
                  <button
                    onClick={() => onTranslationSettingsChange({ ...translationSettings, autoTranslate: !translationSettings.autoTranslate })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      translationSettings.autoTranslate ? 'bg-emerald-600' : 'bg-neutral-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      translationSettings.autoTranslate ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
    </TranslationContext.Provider>
  );

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Calendar, TrendingUp, Sparkles, MessageSquare, Bell,
  LogOut, BookOpen, Clock, CheckCircle2, AlertCircle, User,
  ChevronRight, Send, Loader2, RefreshCw, Phone, Shield, Settings,
  BarChart3, Target, Zap, CalendarDays, Apple, Smartphone,
  ClipboardList, CreditCard, FileBarChart, Star, ArrowRight, Heart, Download,
  X, Paperclip, Sun, Hand, Moon, Camera, Image as ImageIcon, Globe,
  Umbrella, Pencil, Activity, Megaphone, PartyPopper, FileText, GraduationCap
} from 'lucide-react';
import { API_BASE, apiGet, apiPost, apiDelete, apiPut } from '@/lib/api';
import { getToken, clearToken, signOut } from '@/lib/auth';
import OakitLogo from '@/components/OakitLogo';
import ReportCardGenerator from '@/components/ReportCardGenerator';
import { useSessionManager } from '@/hooks/useSessionManager';

// --- Translation Settings type (needed by TranslationContext) -----------------
interface TranslationSettings {
  enabled: boolean;
  targetLanguage: string;
  autoTranslate: boolean;
  supportedLanguages: string[];
}

// --- Translation Context ------------------------------------------------------
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
    'Home': '???',
    'Attendance': '????????',
    'Progress': '??????',
    'Insights': '???????????',
    'Oakie': '???',
    'Messages': '?????',
    'Updates': '?????',
    'Settings': '????????',
    'Emergency Contacts': '????????? ??????',
    'Notification Preferences': '????? ????????????',
    'Calendar Integration': '??????? ??????',
    'Translation Settings': '?????? ????????',
    'Progress Predictions': '?????? ??????????',
    'Goal Setting': '?????? ????????',
    'Performance Comparison': '???????? ?????',
    'Next Week Attendance': '???? ?????? ?? ????????',
    'End of Month Progress': '??? ?? ??? ??? ??????',
    'Areas Needing Attention': '????? ???? ????? ???????',
    'Academic Goals': '???????? ??????',
    'Behavioral Goals': '????????? ??????',
    'Attendance Goals': '???????? ??????',
    'Enable Translation': '?????? ????? ????',
    'Target Language': '?????? ????',
    'Auto Translation': '????: ??????',
    'Predicted attendance rate': '?????????? ???????? ??',
    'Expected academic progress': '???????? ???????? ??????'
  },
  te: {
    'Home': '????',
    'Attendance': '?????',
    'Progress': '??????????',
    'Insights': '?????????',
    'Oakie': '???',
    'Messages': '????????',
    'Updates': '????????',
    'Settings': '???????????',
    'Emergency Contacts': '??????? ????????????',
    'Notification Preferences': '??????????? ????????????',
    'Calendar Integration': '?????????? ???????????',
    'Translation Settings': '?????? ???????????',
    'Progress Predictions': '?????????? ???????',
    'Goal Setting': '?????? ?????????',
    'Performance Comparison': '??????? ?????',
    'Next Week Attendance': '?????? ???? ?????',
    'End of Month Progress': '??? ??????? ??????????',
    'Areas Needing Attention': '?????? ??????? ?????????',
    'Academic Goals': '?????? ?????????',
    'Behavioral Goals': '??????? ?????????',
    'Attendance Goals': '????? ?????????',
    'Enable Translation': '??????????? ???????????',
    'Target Language': '?????? ???',
    'Auto Translation': '????????? ???????',
    'Predicted attendance rate': '????? ????? ????',
    'Expected academic progress': '????? ?????? ??????????'
  }
};

function useTranslation() {
  const context = React.useContext(TranslationContext);
  return context;
}

// --- Types --------------------------------------------------------------------
interface Child { id: string; name: string; class_name: string; section_label: string; section_id: string; class_id: string; photo_url?: string; father_name?: string | null; mother_name?: string | null; parent_contact?: string | null; mother_contact?: string | null; date_of_birth?: string | null; }
interface NoteItem { id: string; note_text: string | null; file_name: string | null; file_size: number | null; expires_at: string; created_at: string; }
interface ChildFeed {
  student_id: string; name: string; class_name: string; section_label: string;
  feed_date: string; // YYYY-MM-DD � from time machine or real today
  attendance: { status: string; is_late: boolean; arrived_at: string | null } | null;
  completion: { covered_chunk_ids: string[]; submitted_at: string; teacher_name: string } | null;
  topics: string[];
  topic_chunks: { topic: string; snippet: string }[];
  plan_status: string | null; special_label: string | null;
  homework: { formatted_text: string; raw_text: string } | null;
  notes: NoteItem[];
}
interface StudentProfile {
  id: string; name: string; class_name: string; section_label: string;
  father_name: string | null; mother_name: string | null;
  parent_contact: string | null; mother_contact: string | null;
  date_of_birth: string | null; photo_url?: string;
}
interface Observation {
  id: string; obs_text: string; categories: string[]; obs_date: string; teacher_name: string;
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

// --- New Feature Types --------------------------------------------------------
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

interface ChildComparison {
  label: string;
  isChild: boolean;
  attendance: number;
  progress: number;
  participation: number;
  trend: 'up' | 'down' | 'stable';
}

type Tab = 'home' | 'calendar' | 'progress' | 'assignments' | 'messages' | 'notifications' | 'fees' | 'reports' | 'settings' | 'chat' | 'insights';

const TABS: { id: Tab; Icon: React.ElementType; label: string }[] = [
  { id: 'home',          Icon: Home,           label: 'Home' },
  { id: 'calendar',      Icon: Calendar,       label: 'Calendar' },
  { id: 'progress',      Icon: TrendingUp,     label: 'Progress' },
  { id: 'insights',      Icon: BarChart3,      label: 'Insights' },
  { id: 'assignments',   Icon: ClipboardList,  label: 'Assignments' },
  { id: 'messages',      Icon: MessageSquare,  label: 'Messages' },
  { id: 'notifications', Icon: Bell,           label: 'Updates' },
  { id: 'fees',          Icon: CreditCard,     label: 'Fees' },
  { id: 'reports',       Icon: FileBarChart,   label: 'Reports' },
  { id: 'settings',      Icon: Settings,       label: 'Settings' },
];

function defaultChat(name?: string): ChatMsg[] {
  return [{ role: 'ai', text: `Hi! I'm Oakie ?? Ask me anything about ${name ? name.split(' ')[0] : 'your child'} � what they studied today, attendance, or progress.`, ts: 0 }];
}

function ChildAvatar({ child, size = 'md', token, onUploaded }: {
  child: Child; size?: 'sm' | 'md' | 'lg';
  token?: string; onUploaded?: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const sz = size === 'sm' ? 'w-8 h-8 text-sm' : size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-10 h-10 text-base';
  // photo_url is already a full URL (Supabase) or a /uploads/ path � resolve correctly
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
              className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"><X size={14} /></button>
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
            {uploading ? <Loader2 size={12} className="animate-spin text-white" /> : child.name[0]}
          </div>
        )}
        {/* Camera overlay on hover */}
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
          <Camera size={16} className="text-white" />
        </div>
        {token && <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} />}
      </label>
    </>
  );
}

export default function ParentPage() {
  const router = useRouter();
  const token = getToken() || '';
  useSessionManager(); // idle timeout, cross-tab sync, session replacement detection
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
  const [classFeed, setClassFeed] = useState<any[]>([]);
  const [schoolInstagram, setSchoolInstagram] = useState<string>('');
  const [schoolTranslationEnabled, setSchoolTranslationEnabled] = useState<boolean>(true);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [parentProfile, setParentProfile] = useState<{ name: string; mobile: string; mobile_can_update?: boolean } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // --- New Feature State ------------------------------------------------------
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

  // t() helper used directly in ParentPage (can't use useTranslation here � we ARE the provider)
  const t = (key: string, defaultText?: string) => {
    if (!translationSettings.enabled || translationSettings.targetLanguage === 'en') return defaultText || key;
    return translations[translationSettings.targetLanguage]?.[key] || defaultText || key;
  };

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
  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function init() {
    setLoading(true);
    try {
      const [kidsResult, notifsResult, profileResult] = await Promise.allSettled([
        apiGet<Child[]>('/api/v1/parent/children', token),
        apiGet<Notification[]>('/api/v1/parent/notifications', token),
        apiGet<{ name: string; mobile: string }>('/api/v1/parent/profile', token),
      ]);

      // Handle force_password_reset � redirect to change-password
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
      if (profileResult.status === 'fulfilled') {
        const p = profileResult.value;
        // If name is empty/null, use a formatted version of mobile as display name
        if (!p.name?.trim() && p.mobile) {
          p.name = `Parent (${p.mobile.slice(-4)})`;
        }
        setParentProfile(p);
      }

      setChildren(kids);
      setNotifications(notifs);
      apiGet<Announcement[]>('/api/v1/parent/announcements', token).then(setAnnouncements).catch(() => {});
      apiGet<ParentMessage[]>('/api/v1/parent/messages', token).then(setMessageThreads).catch(() => {});
      // Fetch school instagram handle (public settings endpoint)
      apiGet<{ instagram_handle?: string }>('/api/v1/public/school-info', token)
        .then(info => { if (info?.instagram_handle) setSchoolInstagram(info.instagram_handle); })
        .catch(() => {});
      // Fetch parent profile with await so name is ready before loading clears
      try {
        const profile = await apiGet<{ name: string; mobile: string }>('/api/v1/parent/profile', token);
        setParentProfile(profile);
      } catch { /* non-critical */ }      
      // Load emergency contacts and settings from API (fallback to mock data)
      (async () => {
        try {
          const [rows, settings] = await Promise.all([
            apiGet<any[]>('/api/v1/parent/emergency-contacts', token),
            apiGet<any>('/api/v1/parent/settings', token),
          ]);
          const mapped = rows.map(r => ({ id: r.id, name: r.name, relation: r.relationship || r.relation || '', phone: r.phone, priority: (r.is_primary ? 1 : 2) as 1 | 2 | 3, available: true }));
          setEmergencyContacts(mapped);
          if (settings) {
            if (settings.notification_prefs) setNotificationPrefs(Array.isArray(settings.notification_prefs) ? settings.notification_prefs : []);
            if (typeof settings.calendar_sync === 'boolean') setCalendarSyncEnabled(settings.calendar_sync);
            if (typeof settings.assistant_reminders === 'boolean') setAssistantReminders(settings.assistant_reminders);
            if (settings.translation_settings) setTranslationSettings(settings.translation_settings);
          }
        } catch (e) {
          // fallback to mock data for other features
          loadMockFeaturesData(true);
        }
      })();
      
      if (kids.length > 0) { setActiveChildId(kids[0].id); await fetchChildData(kids[0].id, kids); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  // --- Mock Data for New Features ---------------------------------------------
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

    // Calendar Events � now loaded from real API in CalendarTab, no mock needed

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

    // Integration Settings
    setCalendarSyncEnabled(localStorage.getItem('calendar_sync') === 'true');
    setAssistantReminders(localStorage.getItem('assistant_reminders') === 'true');
  }

  const fetchChildData = useCallback(async (childId: string, childList?: Child[]) => {
    const resolvedChildren = childList ?? children;
    const child = resolvedChildren.find(c => c.id === childId);
    const skipFeed = !!cache[childId]?.feed;

    setChildLoading(true);
    try {
      const [feed, att, progList] = await Promise.all([
        skipFeed
          ? Promise.resolve(cache[childId]?.feed ?? null)
          : apiGet<ChildFeed>(`/api/v1/parent/child/${childId}/feed`, token).catch(() => null),
        apiGet<AttendanceData>(`/api/v1/parent/child/${childId}/attendance`, token).catch(() => null),
        apiGet<ProgressData[]>('/api/v1/parent/progress', token).catch(() => [] as ProgressData[]),
      ]);
      const prog = Array.isArray(progList) ? (progList.find((p: any) => p.student_id === childId) ?? null) : null;
      setCache(prev => ({ ...prev, [childId]: { feed: (feed ?? prev[childId]?.feed ?? null) as ChildFeed | null, attendance: att, progress: prog } }));
      if (feed && (feed as any).instagram_handle) setSchoolInstagram((feed as any).instagram_handle);
      if (feed && typeof (feed as any).translation_enabled === 'boolean') setSchoolTranslationEnabled((feed as any).translation_enabled);
      if (child?.section_id) {
        apiGet<any>(`/api/v1/feed?section_id=${child.section_id}`, token)
          .then(d => { const posts = Array.isArray(d) ? d : (d?.posts ?? []); setClassFeed(posts.slice(0, 8)); })
          .catch(() => {});
      }
      apiGet<any>(`/api/v1/parent/fees/invoice/${childId}`, token)
        .then(setInvoice).catch(() => {});
    } finally { setChildLoading(false); }
  }, [cache, token, children]);

  async function switchChild(childId: string) { setActiveChildId(childId); setClassFeed([]); await fetchChildData(childId); }

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
          <AlertCircle size={32} className="text-amber-500 mx-auto mb-3" />
          <p className="text-neutral-700 font-semibold mb-2">Something went wrong</p>
          <p className="text-sm text-neutral-500 mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{initError}</p>
          <button onClick={() => { setInitError(null); setLoading(true); init(); }}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium">
            Try again
          </button>
          <button onClick={() => { signOut().then(() => router.push('/login')); }}
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
      {noteModal && <NoteModal note={noteModal} token={token} onClose={() => setNoteModal(null)} />}

      {/* -- Full-page wrapper -- */}
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col" style={{ fontFamily: "'Inter',-apple-system,sans-serif" }}>

        {/* -- TOP HEADER BAR (desktop) -- */}
        <header className="hidden lg:flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100 sticky top-0 z-50" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {/* Left: Logo + badge + greeting */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xl text-gray-900">Oakit</span>
              <span className="font-black text-xl text-amber-500">.ai</span>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">Parent Portal</span>
            {/* Divider */}
            <span className="w-px h-5 bg-gray-200" />
            {/* Time-based greeting + parent name � always visible */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-gray-500">
                {(() => { const h = new Date().getHours(); return h < 12 ? 'Good Morning,' : h < 17 ? 'Good Afternoon,' : 'Good Evening,'; })()}
              </span>
              <span className="text-sm font-semibold text-gray-800">
                {parentProfile?.name?.trim() ? parentProfile.name.split(' ')[0] : (activeChild?.father_name?.split(' ')[0] ?? activeChild?.mother_name?.split(' ')[0] ?? 'Parent')}
              </span>
            </div>
          </div>
          {/* Right side */}
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1.5 text-amber-500 font-semibold text-sm hover:text-amber-600 transition-colors">
              <Star size={15} className="fill-amber-400 text-amber-400" /> Premium
            </button>
            <button onClick={() => setTab('notifications')} className="relative w-9 h-9 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
              <Bell size={17} className="text-gray-600" />
              {unreadNotifs > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unreadNotifs}</span>}
            </button>
            {/* Parent profile � click to show name + contact */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen(v => !v)}
                className="flex items-center gap-2.5 hover:bg-gray-50 rounded-xl px-2 py-1.5 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-700 font-bold text-sm">
                    {parentProfile?.name?.[0]?.toUpperCase() ?? 'P'}
                  </span>
                </div>
                <div className="hidden xl:block text-left">
                  <p className="text-sm font-semibold text-gray-800 leading-tight">
                    {parentProfile?.name?.trim() || activeChild?.father_name || activeChild?.mother_name || 'Parent'}
                  </p>
                  <p className="text-xs text-gray-400">Parent</p>
                </div>
                <ChevronRight size={14} className={`text-gray-400 transition-transform ${profileOpen ? '-rotate-90' : 'rotate-90'}`} />
              </button>

              {/* Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-lg border border-gray-100 z-50 overflow-hidden"
                  style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                  {/* Header */}
                  <div className="bg-emerald-50 px-4 py-4 border-b border-emerald-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-800 font-black text-lg">
                          {parentProfile?.name?.[0]?.toUpperCase() ?? 'P'}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm leading-tight">
                          {parentProfile?.name?.trim() || activeChild?.father_name || activeChild?.mother_name || 'Parent'}
                        </p>
                        <p className="text-xs text-emerald-600 font-medium mt-0.5">Parent Account</p>
                      </div>
                    </div>
                  </div>
                  {/* Contact info */}
                  <div className="px-4 py-3 space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Phone size={14} className="text-gray-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Mobile</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {(() => {
                            const m = parentProfile?.mobile || activeChild?.parent_contact || '';
                            return m ? `+91 ${m.slice(0,5)} ${m.slice(5)}` : '�';
                          })()}
                        </p>
                      </div>
                    </div>
                    {activeChild && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <User size={14} className="text-gray-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Child</p>
                          <p className="text-sm font-semibold text-gray-800">{activeChild.name}</p>
                          <p className="text-xs text-gray-400">{activeChild.class_name} � {activeChild.section_label}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Footer actions */}
                  <div className="px-4 pb-3 pt-1 border-t border-gray-100 flex gap-2">
                    <button
                      onClick={() => { setProfileOpen(false); setTab('settings'); }}
                      className="flex-1 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
                    >
                      Edit Profile
                    </button>
                    <button
                      onClick={() => { signOut().then(() => router.push('/login')); }}
                      className="flex-1 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* -- BODY: sidebar + main + right panel -- */}
        <div className="flex flex-1 overflow-hidden">

          {/* -- LEFT SIDEBAR -- */}
          <aside className="hidden lg:flex flex-col w-44 flex-shrink-0 bg-white border-r border-gray-100 overflow-y-auto" style={{ minHeight: 'calc(100vh - 57px)' }}>
            {/* Nav */}
            <nav className="flex-1 px-2 py-3 space-y-0.5">
              {TABS.map(({ id, Icon, label }) => {
                const badge = id === 'messages' ? unreadMessages : id === 'notifications' ? unreadNotifs : 0;
                const active = tab === id;
                return (
                  <button key={id} onClick={() => setTab(id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                      active ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 hover:translate-x-0.5 hover:shadow-sm'
                    }`}>
                    <Icon size={17} className={active ? 'text-emerald-600' : 'text-gray-400'} />
                    <span className="flex-1">{label}</span>
                    {badge > 0 && <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{badge}</span>}
                  </button>
                );
              })}
            </nav>

            {/* Child switcher at bottom */}
            {children.length > 0 && (
              <div className="px-2 pb-3 pt-2 border-t border-gray-100 space-y-1">
                {children.length > 1 && (
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-1.5">My Children</p>
                )}
                {children.map(child => {
                  const isActive = child.id === activeChildId;
                  const photoUrl = child.photo_url
                    ? (child.photo_url.startsWith('http') ? child.photo_url : `${API_BASE}${child.photo_url}`)
                    : null;
                  return (
                    <button
                      key={child.id}
                      onClick={() => switchChild(child.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all text-left ${
                        isActive ? 'bg-emerald-50 border border-emerald-100' : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
                        style={{ background: isActive ? '#d1fae5' : '#f3f4f6' }}>
                        {photoUrl ? (
                          <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className={`font-bold text-xs ${isActive ? 'text-emerald-700' : 'text-gray-500'}`}>{child.name[0]}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold truncate ${isActive ? 'text-emerald-800' : 'text-gray-700'}`}>{child.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{child.class_name} � {child.section_label}</p>
                      </div>
                      {isActive && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sign out */}
            <div className="px-2 pb-4">
              <button onClick={() => { signOut().then(() => router.push('/login')); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all">
                <LogOut size={15} />
                <span>Log out</span>
              </button>
            </div>
          </aside>

          {/* -- MAIN CONTENT -- */}
          <main className="flex-1 overflow-hidden flex flex-col">
            {/* Mobile header */}
            <header className="lg:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
              <div className="flex items-center gap-2">
                <span className="font-black text-lg text-gray-900">Oakit<span className="text-amber-500">.ai</span></span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Parent</span>
              </div>
              <div className="flex items-center gap-2">
                {unreadNotifs > 0 && (
                  <button onClick={() => setTab('notifications')} className="relative w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                    <Bell size={16} className="text-gray-600" />
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unreadNotifs}</span>
                  </button>
                )}
                {activeChild && (
                  children.length > 1 ? (
                    <div className="flex items-center gap-1">
                      {children.map(child => {
                        const isActive = child.id === activeChildId;
                        const photoUrl = child.photo_url
                          ? (child.photo_url.startsWith('http') ? child.photo_url : `${API_BASE}${child.photo_url}`)
                          : null;
                        return (
                          <button key={child.id} onClick={() => switchChild(child.id)}
                            className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center transition-all ${isActive ? 'ring-2 ring-emerald-500 ring-offset-1' : 'opacity-50'}`}
                            style={{ background: '#d1fae5' }}
                            title={child.name}>
                            {photoUrl ? (
                              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-emerald-700 font-bold text-sm">{child.name[0]}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-emerald-100 overflow-hidden flex items-center justify-center">
                      {activeChild.photo_url ? (
                        <img src={activeChild.photo_url.startsWith('http') ? activeChild.photo_url : `${API_BASE}${activeChild.photo_url}`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-emerald-700 font-bold text-sm">{activeChild.name[0]}</span>
                      )}
                    </div>
                  )
                )}
              </div>
            </header>

            <div className="p-4 lg:p-5 pb-4 lg:pb-5 h-full overflow-hidden">
              {childLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
                </div>
              ) : (
                <div className="h-full overflow-y-auto">
                  {tab === 'home' && (
                    <HomeTab
                      feed={activeCache?.feed ?? null}
                      progress={activeCache?.progress ?? null}
                      attendance={activeCache?.attendance ?? null}
                      activeChild={activeChild}
                      announcements={announcements}
                      onNoteClick={setNoteModal}
                      onTabChange={setTab}
                      token={token}
                      onChildUpdate={(url) => setChildren(prev => prev.map(c => c.id === activeChildId ? { ...c, photo_url: url } : c))}
                      unreadMessages={unreadMessages}
                      unreadNotifs={unreadNotifs}
                      invoice={invoice}
                      parentProfile={parentProfile}
                      classFeed={classFeed}
                      schoolInstagram={schoolInstagram}
                    />
                  )}
                  {tab === 'calendar' && <CalendarTab token={token} activeChild={activeChild} />}
                  {tab === 'progress' && <ProgressTab data={activeCache?.progress ?? null} activeChild={activeChild} token={token} />}
                  {tab === 'assignments' && <AssignmentsTab activeChild={activeChild} token={token} />}
                  {tab === 'messages' && <MessagesTab threads={messageThreads} token={token} onRefresh={() => apiGet<ParentMessage[]>('/api/v1/parent/messages', token).then(setMessageThreads).catch(() => {})} />}
                  {tab === 'notifications' && <NotificationsTab notifications={notifications} announcements={announcements} onRead={markNotifRead} />}
                  {tab === 'fees' && <FeesTab invoice={invoice} activeChild={activeChild} token={token} />}
                  {tab === 'reports' && <ReportsTab attendance={activeCache?.attendance ?? null} progress={activeCache?.progress ?? null} activeChild={activeChild} token={token} />}
                  {tab === 'settings' && <SettingsTab token={token} emergencyContacts={emergencyContacts} notificationPrefs={notificationPrefs} calendarEvents={calendarEvents} calendarSyncEnabled={calendarSyncEnabled} assistantReminders={assistantReminders} translationSettings={translationSettings} onEmergencyContactsChange={setEmergencyContacts} onNotificationPrefsChange={setNotificationPrefs} onCalendarSyncChange={saveCalendarSync} onAssistantRemindersChange={saveAssistantReminders} onTranslationSettingsChange={setTranslationSettings} translationEnabled={schoolTranslationEnabled} />}
                  {tab === 'chat' && <ChatTab msgs={chatMsgs} input={chatInput} loading={chatLoading} onInput={setChatInput} onSend={sendChat} endRef={chatEndRef} childName={activeChild?.name.split(' ')[0] ?? 'your child'} />}
                  {tab === 'insights' && <InsightsTab insights={parentInsights} comparisons={childComparisons} activeChild={activeChild} token={token} />}
                </div>
              )}
            </div>
          </main>

          {/* -- CLASS FEED COLUMN (desktop only) -- */}
          <aside className="hidden xl:flex flex-col w-64 flex-shrink-0 border-l border-gray-100 bg-white overflow-y-auto" style={{ minHeight: 'calc(100vh - 57px)' }}>
            <ClassFeedColumn classFeed={classFeed} schoolInstagram={schoolInstagram} token={token} />
          </aside>

          {/* -- WEEKLY SCHEDULE COLUMN (desktop only) -- */}
          <aside className="hidden xl:flex flex-col w-56 flex-shrink-0 border-l border-gray-100 bg-white overflow-y-auto" style={{ minHeight: 'calc(100vh - 57px)' }}>
            <SchedulePanel
              progress={activeCache?.progress ?? null}
              activeChild={activeChild}
              invoice={invoice}
              onFeesClick={() => setTab('fees')}
              token={token}
              notifications={notifications}
              announcements={announcements}
            />
          </aside>
        </div>

        {/* -- MOBILE BOTTOM NAV -- */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 flex"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -2px 12px rgba(0,0,0,0.06)' }}>
          {TABS.slice(0, 6).map(({ id, Icon, label }) => {
            const active = tab === id;
            const badge = id === 'messages' ? unreadMessages : id === 'notifications' ? unreadNotifs : 0;
            return (
              <button key={id} onClick={() => setTab(id)}
                className="flex-1 flex flex-col items-center py-2 gap-0.5 relative transition-transform hover:-translate-y-0.5 active:scale-95">
                <span className={`text-lg leading-none ${active ? 'scale-110' : ''} transition-transform`}>
                  <Icon size={20} className={active ? 'text-emerald-600' : 'text-gray-400'} />
                </span>
                <span className={`text-[9px] font-semibold ${active ? 'text-emerald-600' : 'text-gray-400'}`}>{label}</span>
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-emerald-500" />}
                {badge > 0 && <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">{badge}</span>}
              </button>
            );
          })}
        </nav>
      </div>
    </TranslationContext.Provider>
  );
}

// --- Note Modal ---------------------------------------------------------------
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
            <p className="text-base font-semibold text-neutral-800 flex items-center gap-2">
              <ClipboardList size={16} className="text-gray-500" /> Teacher Note
            </p>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500">
              <X size={14} />
            </button>
          </div>
          {note.note_text && <div className="bg-neutral-50 rounded-xl p-4 mb-4"><p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{note.note_text}</p></div>}
          {note.file_name && (
            <div className="border border-neutral-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                <Paperclip size={18} className="text-primary-600" />
              </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-800 truncate">{note.file_name}</p>
                  {note.file_size && <p className="text-xs text-neutral-400">{Math.round(note.file_size / 1024)} KB</p>}
                </div>
              </div>
              <button onClick={download} disabled={downloading}
                className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download File
              </button>
            </div>
          )}
          <div className={`rounded-xl px-4 py-3 text-xs flex items-start gap-2 ${daysLeft <= 3 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
            <span>{daysLeft <= 0 ? 'Expires today � download now.' : `Auto-deleted on ${note.expires_at.split('T')[0]} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left). Save a local copy.`}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Student Profile Modal ----------------------------------------------------
function StudentProfileModal({ child, token, onClose }: { child: Child; token: string; onClose: () => void }) {
  function formatDob(dob: string | null | undefined) {
    if (!dob) return '�';
    const d = new Date(dob.split('T')[0] + 'T12:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function calcAge(dob: string | null | undefined) {
    if (!dob) return '';
    const d = new Date(dob.split('T')[0] + 'T12:00:00');
    const now = new Date();
    const months = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth() + (now.getDate() < d.getDate() ? -1 : 0);
    const y = Math.floor(months / 12), m = months % 12;
    return y > 0 ? `${y}y ${m}m` : `${m} months`;
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative z-10 bg-white w-full lg:w-[480px] rounded-t-3xl lg:rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="lg:hidden flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-neutral-200" /></div>
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-5 rounded-t-3xl lg:rounded-t-2xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-bold text-base">Student Profile</p>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30"><X size={14} /></button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 overflow-hidden flex items-center justify-center border-2 border-white/30 flex-shrink-0">
              {child.photo_url ? (
                <img src={child.photo_url.startsWith('http') ? child.photo_url : `${API_BASE}${child.photo_url}`} alt={child.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-black text-2xl">{child.name[0]}</span>
              )}
            </div>
            <div>
              <p className="text-white font-black text-xl leading-tight">{child.name}</p>
              <p className="text-white/80 text-sm mt-0.5">{child.class_name} � Section {child.section_label}</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* DOB */}
          {child.date_of_birth && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <span className="text-base">??</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Date of Birth</p>
                <p className="text-sm font-semibold text-gray-800">{formatDob(child.date_of_birth)}</p>
                <p className="text-xs text-gray-500">{calcAge(child.date_of_birth)} old</p>
              </div>
            </div>
          )}

          {/* Parents */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Parent / Guardian</p>
            <div className="space-y-2">
              {(child.father_name || child.parent_contact) && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Father</p>
                    <p className="text-sm font-semibold text-gray-800">{child.father_name || '�'}</p>
                    {child.parent_contact && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone size={10} /> {child.parent_contact}</p>}
                  </div>
                </div>
              )}
              {(child.mother_name || child.mother_contact) && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-pink-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Mother</p>
                    <p className="text-sm font-semibold text-gray-800">{child.mother_name || '�'}</p>
                    {child.mother_contact && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone size={10} /> {child.mother_contact}</p>}
                  </div>
                </div>
              )}
              {!child.father_name && !child.mother_name && !child.parent_contact && !child.mother_contact && (
                <p className="text-sm text-gray-400 text-center py-2">No parent contact info on file</p>
              )}
            </div>
          </div>

          {/* Class info */}
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <BookOpen size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Class</p>
              <p className="text-sm font-semibold text-gray-800">{child.class_name} � Section {child.section_label}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Home Tab ----------------------------------------------------------------
function HomeTab({ feed, progress, attendance, activeChild, announcements, onNoteClick, onTabChange, token, onChildUpdate, unreadMessages, unreadNotifs, invoice, parentProfile, classFeed, schoolInstagram }: {
  feed: ChildFeed | null; progress: ProgressData | null; attendance: AttendanceData | null; activeChild: Child | null;
  announcements: Announcement[]; onNoteClick: (n: NoteItem) => void; onTabChange: (t: Tab) => void;
  token: string; onChildUpdate: (url: string) => void;
  unreadMessages: number; unreadNotifs: number; invoice: any;
  parentProfile: { name: string; mobile: string; mobile_can_update?: boolean } | null;
  classFeed: any[];
  schoolInstagram: string;
}) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Use feed_date from API (respects time machine) � fall back to real today
  const feedDateStr = feed?.feed_date ?? new Date().toISOString().split('T')[0];
  const feedDate = new Date(feedDateStr + 'T12:00:00');

  // Fetch AI summary for today's topics � cached once per day per child
  useEffect(() => {
    if (!feed?.topics?.length || !activeChild?.id || !token) return;
    const cacheKey = `feed-summary:${activeChild.id}:${feedDateStr}`;
    const cached = localStorage.getItem(cacheKey);
    // Bust stale cache if it contains "Week X Day Y"
    if (cached && /week\s*\d+\s*day\s*\d+/i.test(cached)) {
      localStorage.removeItem(cacheKey);
    } else if (cached) {
      setAiSummary(cached);
      return;
    }

    setSummaryLoading(true);
    const completed = !!feed.completion;
    apiPost<{ summary: string }>('/api/v1/ai/topic-summary', {
      topics: feed.topics,
      chunks: feed.topic_chunks ?? [],
      class_name: activeChild.class_name ?? 'Nursery',
      child_name: activeChild.name.split(' ')[0],
      completed,
      feed_date: feedDateStr,
    }, token)
      .then(d => { if (d.summary) { setAiSummary(d.summary); localStorage.setItem(cacheKey, d.summary); } })
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, [feed?.topics?.join(','), activeChild?.id]);

  if (!activeChild) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <User size={48} className="text-gray-300 mb-3" />
      <p className="text-gray-500 font-medium">No child selected</p>
    </div>
  );

  const att = feed?.attendance;
  const attPct = attendance?.attendance_pct ?? 0;
  const attLabel = !att ? 'Not marked' : att.status === 'present' && att.is_late ? 'Late' : att.status === 'present' ? 'Present' : 'Absent';

  // Week calendar � anchored to feed_date (time machine aware)
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const feedDow = feedDate.getDay(); // 0=Sun
  const weekStartDate = new Date(feedDate);
  weekStartDate.setDate(feedDate.getDate() - ((feedDow + 6) % 7));
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartDate); d.setDate(weekStartDate.getDate() + i); return d;
  });
  const attRecords = attendance?.records ?? [];

  return (
    <div className="space-y-5">
      {/* Student profile modal */}
      {profileOpen && <StudentProfileModal child={activeChild} token={token} onClose={() => setProfileOpen(false)} />}

      {/* Child profile card */}
      <div className="parent-card bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
        {/* Editable child photo */}
        <label className="relative w-14 h-14 rounded-full overflow-hidden bg-emerald-100 flex-shrink-0 flex items-center justify-center border-2 border-gray-100 cursor-pointer group">
          {activeChild.photo_url ? (
            <img src={activeChild.photo_url.startsWith('http') ? activeChild.photo_url : `${API_BASE}${activeChild.photo_url}`}
              alt={activeChild.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-emerald-700 font-bold text-xl">{activeChild.name[0]}</span>
          )}
          {/* Camera overlay on hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
            <Camera size={18} className="text-white" />
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !token) return;
              const fd = new FormData();
              fd.append('photo', file);
              try {
                const res = await fetch(`${API_BASE}/api/v1/parent/child/${activeChild.id}/photo`, {
                  method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
                });
                const data = await res.json();
                if (res.ok) onChildUpdate(data.photo_url);
              } catch {}
            }}
          />
        </label>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-base">{activeChild.name}</p>
          <p className="text-sm text-gray-500">{activeChild.class_name} � Section {activeChild.section_label}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-emerald-600 font-medium">Active</span>
          </div>
        </div>
        <button onClick={() => setProfileOpen(true)} className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium hover:text-emerald-700 flex-shrink-0">
          View Profile <ChevronRight size={14} />
        </button>
      </div>

      {/* Stat cards row � 4 colored cards with mini donut graphs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Attendance */}
        <div className="stat-pill rounded-2xl p-4 flex items-center gap-3 cursor-default" style={{ background: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', border: '1px solid #6ee7b7' }}>
          <div className="relative flex-shrink-0 w-12 h-12">
            <svg width="48" height="48" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="5" />
              <circle cx="24" cy="24" r="18" fill="none" stroke="#059669" strokeWidth="5"
                strokeDasharray={`${(attPct / 100) * 113} 113`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <CalendarDays size={14} className="text-emerald-700" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-900 leading-none">{attPct}%</p>
            <p className="text-xs font-semibold text-emerald-700 mt-0.5">Attendance</p>
            <p className="text-[10px] text-emerald-600">{attPct >= 90 ? 'Excellent' : 'This Month'}</p>
          </div>
        </div>

        {/* Progress */}
        <div className="stat-pill rounded-2xl p-4 flex items-center gap-3 cursor-default" style={{ background: 'linear-gradient(135deg,#dbeafe,#bfdbfe)', border: '1px solid #93c5fd' }}>
          <div className="relative flex-shrink-0 w-12 h-12">
            <svg width="48" height="48" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="5" />
              <circle cx="24" cy="24" r="18" fill="none" stroke="#2563eb" strokeWidth="5"
                strokeDasharray={`${((progress?.coverage_pct ?? 0) / 100) * 113} 113`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <TrendingUp size={14} className="text-blue-700" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-blue-900 leading-none">{(progress?.coverage_pct ?? 0).toFixed(1)}%</p>
            <p className="text-xs font-semibold text-blue-700 mt-0.5">Progress</p>
            <p className="text-[10px] text-blue-600">This Term</p>
          </div>
        </div>

        {/* Messages */}
        <div className="stat-pill rounded-2xl p-4 flex items-center gap-3 cursor-default" style={{ background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)', border: '1px solid #c4b5fd' }}>
          <div className="relative flex-shrink-0 w-12 h-12">
            <svg width="48" height="48" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="5" />
              <circle cx="24" cy="24" r="18" fill="none" stroke="#7c3aed" strokeWidth="5"
                strokeDasharray={`${Math.min(unreadMessages * 20, 113)} 113`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <MessageSquare size={14} className="text-purple-700" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-purple-900 leading-none">{unreadMessages}</p>
            <p className="text-xs font-semibold text-purple-700 mt-0.5">Messages</p>
            <p className="text-[10px] text-purple-600">Unread</p>
          </div>
        </div>

        {/* Updates */}
        <div className="stat-pill rounded-2xl p-4 flex items-center gap-3 cursor-default" style={{ background: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '1px solid #fcd34d' }}>
          <div className="relative flex-shrink-0 w-12 h-12">
            <svg width="48" height="48" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="5" />
              <circle cx="24" cy="24" r="18" fill="none" stroke="#d97706" strokeWidth="5"
                strokeDasharray={`${Math.min(unreadNotifs * 20, 113)} 113`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Bell size={14} className="text-amber-700" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-amber-900 leading-none">{unreadNotifs}</p>
            <p className="text-xs font-semibold text-amber-700 mt-0.5">Updates</p>
            <p className="text-[10px] text-amber-600">New</p>
          </div>
        </div>
      </div>

      {/* Today's Feed + This Week + Curriculum Progress + Quick Actions � all in one row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today's Feed � AI summary + teacher notes */}
        <div className="parent-card bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
              <ClipboardList size={13} className="text-gray-400" /> Today&apos;s Feed
            </p>
            <span className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
              {feedDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          {/* AI-generated summary */}
          {feed?.special_label ? (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
              <p className="text-sm font-semibold text-amber-800">{feed.special_label}</p>
            </div>
          ) : feed?.topics && feed.topics.length > 0 ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
              {summaryLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin text-emerald-500" />
                  <p className="text-xs text-emerald-600">Generating summary�</p>
                </div>
              ) : (
                <p className="text-sm text-emerald-800 leading-relaxed">
                  {aiSummary || (feed.completion
                    ? `On ${feedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}, ${activeChild.name.split(' ')[0]} learned about ${feed.topics.map(t => t.replace(/week\s*\d+\s*day\s*\d+\s*[-�:,.\s]*/gi, '').trim()).filter(Boolean).slice(0, 2).join(' and ') || 'various subjects'}.`
                    : `On ${feedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}, ${activeChild.name.split(' ')[0]} will learn about ${feed.topics.map(t => t.replace(/week\s*\d+\s*day\s*\d+\s*[-�:,.\s]*/gi, '').trim()).filter(Boolean).slice(0, 2).join(' and ') || 'various subjects'}.`)}
                </p>
              )}
              {/* Replace raw "Week X Day Y" topic pills with a status badge */}
              <div className="flex flex-wrap gap-1 mt-2">
                {feed.topics.map((topic, i) => {
                  const stripped = topic.replace(/week\s*\d+\s*day\s*\d+\s*[-�:,.\s]*/gi, '').trim();
                  // If nothing left after stripping, this is a "Week X Day Y" label � show status instead
                  if (!stripped) return null;
                  return (
                    <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white text-emerald-700 border border-emerald-200">{stripped}</span>
                  );
                })}
                {/* Show status pill: Completed or In Progress */}
                {feed.completion ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">? Completed</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">? In Progress</span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-2 text-center">No feed data yet for today</p>
          )}

          {/* Homework */}
          {feed?.homework && (
            <div className="border-t border-gray-100 pt-2.5">
              <p className="text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1.5">
                <BookOpen size={12} className="text-gray-400" /> Homework
              </p>
              <div className="space-y-1">
                {(feed.homework.formatted_text || feed.homework.raw_text).split('\n').filter(Boolean).slice(0, 2).map((line, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-gray-300 text-xs mt-0.5 flex-shrink-0 font-bold">{i + 1}.</span>
                    <p className="text-xs text-gray-600 leading-relaxed">{line.replace(/^\d+\.\s*/, '')}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => onTabChange('assignments')} className="mt-1.5 text-xs text-emerald-600 font-medium flex items-center gap-1 hover:text-emerald-700">
                View All <ChevronRight size={11} />
              </button>
            </div>
          )}

          {/* Teacher Notes inline */}
          {feed?.notes && feed.notes.length > 0 && (
            <div className="border-t border-gray-100 pt-2.5">
              <p className="text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1.5">
                <ClipboardList size={12} className="text-gray-400" /> Teacher Notes
              </p>
              {feed.notes.slice(0, 1).map(note => {
                const dl = Math.ceil((new Date(note.expires_at).getTime() - Date.now()) / 86400000);
                return (
                  <button key={note.id} onClick={() => onNoteClick(note)}
                    className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2 transition-colors border border-gray-100">
                    {note.note_text && <p className="text-xs text-gray-700 line-clamp-1">{note.note_text}</p>}
                    {note.file_name && (
                      <div className="flex items-center gap-1.5">
                        <Paperclip size={11} className="text-gray-400" />
                        <p className="text-xs text-gray-500 truncate flex-1">{note.file_name}</p>
                        <Download size={11} className="text-emerald-500" />
                      </div>
                    )}
                    <p className={`text-[10px] mt-0.5 ${dl <= 3 ? 'text-red-500' : 'text-gray-400'}`}>Expires in {dl}d</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* This Week */}
        <div className="parent-card bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
            <CalendarDays size={13} className="text-gray-400" /> This Week
          </p>
          <div className="flex justify-between">
            {weekDays.map((d, i) => {
              const dateObj = weekDates[i];
              const isToday = dateObj.toISOString().split('T')[0] === feedDateStr;
              const dateStr = dateObj.toISOString().split('T')[0];
              const rec = attRecords.find(r => r.attend_date.split('T')[0] === dateStr);
              const dotColor = !rec ? 'bg-gray-200' : rec.status === 'present' && !rec.is_late ? 'bg-emerald-500' : rec.status === 'present' ? 'bg-amber-500' : 'bg-red-500';
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-gray-400">{d}</span>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isToday ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 bg-gray-50'
                  }`}>
                    {dateObj.getDate()}
                  </div>
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                </div>
              );
            })}
          </div>
          <button onClick={() => onTabChange('calendar')} className="w-full text-xs text-emerald-600 font-medium flex items-center justify-center gap-1 hover:text-emerald-700 py-1">
            View Full Calendar <ChevronRight size={11} />
          </button>
        </div>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Bell size={15} className="text-gray-500" /> School Announcements
          </p>
          <div className="space-y-3">
            {announcements.slice(0, 3).map(a => (
              <div key={a.id} className="border-l-4 border-emerald-400 pl-3">
                <p className="text-sm font-medium text-gray-800">{a.title}</p>
                <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{a.body}</p>
                <p className="text-xs text-gray-400 mt-1">By {a.author_name} � {a.created_at.split('T')[0]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ask Oakie � quick access button */}
      <button
        onClick={() => onTabChange('chat')}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 hover:-translate-y-0.5 hover:shadow-md transition-all shadow-sm"
      >
        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
          <Sparkles size={16} className="text-white" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-emerald-800">Ask Oakie</p>
          <p className="text-xs text-emerald-600">Ask anything about {activeChild.name.split(' ')[0]}</p>
        </div>
        <ChevronRight size={16} className="text-emerald-400 flex-shrink-0" />
      </button>

      {/* Class Feed � mobile only (desktop shows in right column) */}
      <div className="xl:hidden">
        <ClassFeedColumn classFeed={classFeed} schoolInstagram={schoolInstagram} token={token} />
      </div>
    </div>
  );
}

// --- Class Feed Column --------------------------------------------------------
function ClassFeedColumn({ classFeed, schoolInstagram, token }: { classFeed: any[]; schoolInstagram?: string; token: string }) {
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number; caption?: string } | null>(null);
  // local like state: postId ? { count, likedByMe }
  const [likes, setLikes] = useState<Record<string, { count: number; likedByMe: boolean }>>(() =>
    Object.fromEntries(classFeed.map(p => [p.id, { count: p.like_count ?? 0, likedByMe: p.liked_by_me ?? false }]))
  );

  async function toggleLike(postId: string) {
    // Optimistic update
    setLikes(prev => {
      const cur = prev[postId] ?? { count: 0, likedByMe: false };
      return { ...prev, [postId]: { count: cur.likedByMe ? cur.count - 1 : cur.count + 1, likedByMe: !cur.likedByMe } };
    });
    try {
      const res = await apiPost<{ like_count: number; liked_by_me: boolean }>(`/api/v1/feed/posts/${postId}/like`, {}, token);
      setLikes(prev => ({ ...prev, [postId]: { count: res.like_count, likedByMe: res.liked_by_me } }));
    } catch {
      // Revert on failure
      setLikes(prev => {
        const cur = prev[postId] ?? { count: 0, likedByMe: false };
        return { ...prev, [postId]: { count: cur.likedByMe ? cur.count + 1 : cur.count - 1, likedByMe: !cur.likedByMe } };
      });
    }
  }

  function openLightbox(images: string[], index: number, caption?: string) {
    setLightbox({ images, index, caption });
  }
  function closeLightbox() { setLightbox(null); }
  function prevPhoto() { setLightbox(lb => lb && lb.index > 0 ? { ...lb, index: lb.index - 1 } : lb); }
  function nextPhoto() { setLightbox(lb => lb && lb.index < lb.images.length - 1 ? { ...lb, index: lb.index + 1 } : lb); }

  function shareToInstagram(post: any) {
    const tag = schoolInstagram ? `@${schoolInstagram}` : '';
    const caption = [post.caption, tag].filter(Boolean).join(' ');
    // Copy caption to clipboard so user can paste it into Instagram
    if (caption) navigator.clipboard?.writeText(caption).catch(() => {});

    // Use Web Share API if available (mobile browsers, PWA)
    if (navigator.share && post.images?.[0]) {
      navigator.share({
        title: post.caption || 'School moment',
        text: caption,
        url: post.images[0],
      }).catch(() => {
        // Fallback: open Instagram app
        window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
      });
      return;
    }
    // Desktop fallback: open Instagram and show toast that caption was copied
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    if (caption) alert(`Caption copied to clipboard:\n\n${caption}\n\nPaste it when creating your Instagram post.`);
  }

  function shareToFacebook(post: any) {
    const img = post.images?.[0];
    const tag = schoolInstagram ? `@${schoolInstagram}` : '';
    const caption = [post.caption, tag].filter(Boolean).join(' ');
    // Facebook sharer � works on web; on mobile opens FB app
    const shareUrl = img || window.location.href;
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(caption)}`;
    window.open(fbUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
  }

  return (
    <>
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div>
          <p className="text-sm font-bold text-gray-800">Class Feed</p>
          <p className="text-xs text-gray-400">Photos from school</p>
        </div>
        <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-emerald-500 text-white">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />Live
        </span>
      </div>

      {/* Feed items */}
      <div className="flex-1 overflow-y-auto">
        {classFeed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <ImageIcon size={32} className="text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-400">No photos yet</p>
            <p className="text-xs text-gray-300 mt-1">Photos shared by teachers will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {classFeed.map((post: any) => {
              const img = post.images?.[0];
              const timeAgo = (() => {
                const diff = Date.now() - new Date(post.created_at).getTime();
                const mins = Math.floor(diff / 60000);
                if (mins < 60) return `${mins}m ago`;
                const hrs = Math.floor(mins / 60);
                if (hrs < 24) return `${hrs}h ago`;
                return `${Math.floor(hrs / 24)}d ago`;
              })();
              return (
                <div key={post.id} className="p-3">
                  {img ? (
                    <img src={img} alt={post.caption ?? ''} onClick={() => openLightbox(post.images, 0, post.caption)}
                      className="w-full rounded-xl object-cover mb-2.5 cursor-zoom-in hover:opacity-95 transition-opacity" style={{ height: 150 }} />
                  ) : (
                    <div className="w-full rounded-xl flex items-center justify-center bg-emerald-50 mb-2.5" style={{ height: 100 }}>
                      <ImageIcon size={28} className="text-emerald-300" />
                    </div>
                  )}
                  {/* Extra images row */}
                  {post.images?.length > 1 && (
                    <div className="flex gap-1.5 mb-2">
                      {post.images.slice(1, 4).map((img2: string, i: number) => (
                        <img key={i} src={img2} alt="" onClick={() => openLightbox(post.images, i + 1, post.caption)}
                          className="w-14 h-14 rounded-lg object-cover flex-shrink-0 cursor-zoom-in hover:opacity-90 transition-opacity" />
                      ))}
                      {post.images.length > 4 && (
                        <div onClick={() => openLightbox(post.images, 4, post.caption)}
                          className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0 cursor-pointer hover:bg-gray-200 transition-colors">
                          +{post.images.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                  {post.caption && <p className="text-xs text-gray-700 line-clamp-2 mb-2 leading-relaxed">{post.caption}</p>}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-gray-600">by {post.poster_name}</p>
                      <p className="text-[10px] text-gray-400">{timeAgo}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleLike(post.id)}
                        className="flex items-center gap-1 text-xs font-semibold transition-transform active:scale-90"
                        style={{ color: likes[post.id]?.likedByMe ? '#ec4899' : '#9ca3af' }}
                      >
                        <Heart
                          size={14}
                          className="transition-all"
                          style={{
                            fill: likes[post.id]?.likedByMe ? '#ec4899' : 'none',
                            color: likes[post.id]?.likedByMe ? '#ec4899' : '#9ca3af',
                            transform: likes[post.id]?.likedByMe ? 'scale(1.2)' : 'scale(1)',
                            transition: 'transform 0.15s ease, fill 0.15s ease',
                          }}
                        />
                        <span>{likes[post.id]?.count ?? 0}</span>
                      </button>
                      {/* Share buttons */}
                      <button
                        onClick={() => shareToInstagram(post)}
                        title={schoolInstagram ? `Share & tag @${schoolInstagram}` : 'Share to Instagram'}
                        className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white hover:opacity-90 active:scale-95 transition-all"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => shareToFacebook(post)}
                        title={schoolInstagram ? `Share & tag @${schoolInstagram}` : 'Share to Facebook'}
                        className="flex items-center justify-center w-7 h-7 rounded-full bg-[#1877F2] text-white hover:opacity-90 active:scale-95 transition-all"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {/* -- Lightbox -- */}
    {lightbox && (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
        onClick={closeLightbox}
      >
        {/* Close */}
        <button
          onClick={closeLightbox}
          className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white text-xl font-bold z-10"
          style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
        >?</button>

        {/* Prev */}
        {lightbox.index > 0 && (
          <button
            onClick={e => { e.stopPropagation(); prevPhoto(); }}
            className="absolute left-4 w-10 h-10 rounded-full flex items-center justify-center text-white text-xl font-bold z-10"
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
          >�</button>
        )}

        {/* Image */}
        <div className="flex flex-col items-center gap-3 px-16 max-w-3xl w-full" onClick={e => e.stopPropagation()}>
          <img
            src={lightbox.images[lightbox.index]}
            alt={lightbox.caption ?? ''}
            className="rounded-2xl object-contain shadow-2xl"
            style={{ maxHeight: '75vh', maxWidth: '100%', animation: 'scaleIn 0.2s cubic-bezier(0.16,1,0.3,1)' }}
          />
          {lightbox.caption && (
            <p className="text-white/80 text-sm text-center leading-relaxed">{lightbox.caption}</p>
          )}
          {lightbox.images.length > 1 && (
            <div className="flex gap-2 mt-1">
              {lightbox.images.map((_, i) => (
                <button key={i} onClick={() => setLightbox(lb => lb ? { ...lb, index: i } : lb)}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{ background: i === lightbox.index ? '#fff' : 'rgba(255,255,255,0.35)', transform: i === lightbox.index ? 'scale(1.3)' : 'scale(1)' }} />
              ))}
            </div>
          )}
        </div>

        {/* Next */}
        {lightbox.index < lightbox.images.length - 1 && (
          <button
            onClick={e => { e.stopPropagation(); nextPhoto(); }}
            className="absolute right-4 w-10 h-10 rounded-full flex items-center justify-center text-white text-xl font-bold z-10"
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
          >�</button>
        )}
      </div>
    )}
    </>
  );
}

// --- Schedule Panel -----------------------------------------------------------
function SchedulePanel({ progress, activeChild, invoice, onFeesClick, token, notifications, announcements }: {
  progress: ProgressData | null; activeChild: Child | null;
  invoice: any; onFeesClick: () => void; token: string;
  notifications: Notification[]; announcements: Announcement[];
}) {
  const pct = progress?.coverage_pct ?? 0;
  const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

  const [weekSchedule, setWeekSchedule] = useState<Record<string, { topics: string[]; chunks: { topic: string; snippet: string; subjects?: string[] }[]; completed: boolean }>>({});
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [todayFromApi, setTodayFromApi] = useState<string | null>(null);
  const [drawerDay, setDrawerDay] = useState<{ date: string; label: string; topics: string[]; chunks: { topic: string; snippet: string; subjects?: string[] }[]; completed: boolean; isToday: boolean; todayStr: string } | null>(null);

  useEffect(() => {
    if (!activeChild?.id || !token) return;
    apiGet<{ week_start: string; today: string; days: Record<string, { topics: string[]; chunks: { topic: string; snippet: string }[]; completed: boolean }> }>(
      `/api/v1/parent/child/${activeChild.id}/week-schedule`, token
    ).then(d => { setWeekSchedule(d.days ?? {}); setWeekStart(d.week_start ?? null); setTodayFromApi(d.today ?? null); }).catch(() => {});
  }, [activeChild?.id]);

  // Derive week dates from API week_start (time machine aware)
  const weekDates = (() => {
    const base = weekStart ?? new Date().toISOString().split('T')[0];
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(base + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + i);
      return d;
    });
  })();

  // "Today" = from API (time machine aware)
  const todayStr = todayFromApi ?? weekStart ?? new Date().toISOString().split('T')[0];

  function openDay(d: Date, i: number) {
    const dateStr = d.toISOString().split('T')[0];
    const dayData = weekSchedule[dateStr];
    const topics = dayData?.topics ?? [];
    const chunks = dayData?.chunks ?? [];
    const completed = dayData?.completed ?? false;
    const isToday = dateStr === todayStr;
    const label = `${weekDays[i]} ${d.getUTCDate()} ${d.toLocaleDateString('en-IN', { month: 'short' })}`;
    setDrawerDay({ date: dateStr, label, topics, chunks, completed, isToday, todayStr });
  }

  return (
    <>
      {drawerDay && (
        <DayPlanDrawer day={drawerDay} activeChild={activeChild} token={token} onClose={() => setDrawerDay(null)} />
      )}
      <div className="p-4 space-y-4">

        {/* Weekly Schedule */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={15} className="text-gray-500" />
            <p className="text-sm font-bold text-gray-800">Weekly Schedule</p>
          </div>
          <div className="space-y-1">
            {weekDates.map((d, i) => {
              const isToday = d.toISOString().split('T')[0] === todayStr;
              const dateStr = d.toISOString().split('T')[0];
              const dayData = weekSchedule[dateStr];
              const topics = dayData?.topics ?? [];
              const completed = dayData?.completed ?? false;
              // Treat any past day as covered (time-machine aware)
              const isPastDay = dateStr < todayStr;
              const isCoveredDay = completed || isPastDay;
              const hasTopics = topics.length > 0;
              // Clean topic label for display
              const firstTopicRaw = topics[0] ?? '';
              const firstTopicClean = firstTopicRaw.replace(/week\s*\d+\s*day\s*\d+\s*[-�:,.\s]*/gi, '').trim() || firstTopicRaw;
              return (
                <button key={i} onClick={() => openDay(d, i)}
                  className={`w-full flex items-center justify-between py-2 px-2.5 rounded-xl transition-all text-left group ${isToday ? 'bg-emerald-50 border border-emerald-100' : 'hover:bg-gray-50'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-gray-400">{weekDays[i]}</p>
                    <p className={`text-sm font-semibold ${isToday ? 'text-emerald-700' : 'text-gray-700'}`}>
                      {d.getUTCDate()} {d.toLocaleDateString('en-IN', { month: 'short' })}
                    </p>
                    {hasTopics && (
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                        {isCoveredDay ? '? ' : ''}{firstTopicClean}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                    {hasTopics && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${isCoveredDay ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-amber-600 bg-amber-50 border-amber-100'}`}>
                        {topics.length}
                      </span>
                    )}
                    <ChevronRight size={12} className={`text-gray-300 group-hover:text-gray-500 ${isToday ? 'text-emerald-400' : ''}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-gray-500" />
            <p className="text-sm font-bold text-gray-800">Progress</p>
          </div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-gray-500">Curriculum</p>
            <p className="text-xs font-bold text-emerald-600">{pct.toFixed(1)}%</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Premium Features */}
        <a href="/parent/premium" className="w-full flex items-center justify-between px-3 py-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-100 transition-all shadow-sm">
          <div className="flex items-center gap-2">
            <Star size={15} className="text-amber-500 fill-amber-400" />
            <span className="text-sm font-semibold text-amber-700">Premium Features</span>
          </div>
          <ArrowRight size={13} className="text-amber-400" />
        </a>

        {/* Fee Detail */}
        {invoice && invoice.net_payable > 0 ? (() => {
          const dueDate = invoice.accounts?.[0]?.due_date ? new Date(invoice.accounts[0].due_date) : null;
          const today = new Date(); today.setHours(0,0,0,0);
          const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
          const isUrgent = daysLeft !== null && daysLeft <= 5 && daysLeft >= 0;
          const isOverdue = daysLeft !== null && daysLeft < 0;
          const urgentBg = isOverdue ? 'bg-red-50 border-red-200 hover:bg-red-100' : isUrgent ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' : 'bg-orange-50 border-orange-100 hover:bg-orange-100';
          const iconColor = isOverdue ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-orange-500';
          const textColor = isOverdue ? 'text-red-800' : isUrgent ? 'text-amber-800' : 'text-orange-800';
          const subColor = isOverdue ? 'text-red-500' : isUrgent ? 'text-amber-600' : 'text-orange-500';
          const arrowColor = isOverdue ? 'text-red-400' : isUrgent ? 'text-amber-400' : 'text-orange-400';
          return (
            <button onClick={() => onFeesClick()}
              className={`w-full flex items-center justify-between px-3 py-3 border rounded-2xl transition-colors shadow-sm ${urgentBg}`}>
              <div className="flex items-center gap-2 min-w-0">
                {(isUrgent || isOverdue) ? <AlertCircle size={13} className={`${iconColor} shrink-0`} /> : <CreditCard size={13} className={`${iconColor} shrink-0`} />}
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${textColor}`}>Fee pending: ?{invoice.net_payable.toLocaleString('en-IN')}</p>
                  {dueDate && (
                    <p className={`text-[11px] ${subColor}`}>
                      {isOverdue ? `Overdue by ${Math.abs(daysLeft!)} day${Math.abs(daysLeft!) !== 1 ? 's' : ''}` : isUrgent ? `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} � pay now` : `Due ${dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </p>
                  )}
                </div>
              </div>
              <ArrowRight size={12} className={`${arrowColor} shrink-0`} />
            </button>
          );
        })() : invoice === null ? (
          <button onClick={() => onFeesClick()}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-2xl hover:bg-blue-100 transition-colors shadow-sm">
            <div className="flex items-center gap-2">
              <CreditCard size={13} className="text-blue-400 shrink-0" />
              <span className="text-xs text-blue-500">Fee structure not set up yet � contact admin</span>
            </div>
            <ArrowRight size={12} className="text-blue-300" />
          </button>
        ) : null}

        {/* Fees Due */}
        {invoice && invoice.net_payable > 0 && (
          <div className="bg-orange-50 rounded-2xl border border-orange-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard size={15} className="text-orange-500" />
              <p className="text-sm font-bold text-orange-800">Fees Due</p>
            </div>
            <p className="text-2xl font-black text-orange-700 mb-1">?{invoice.net_payable.toLocaleString('en-IN')}</p>
            {invoice.accounts?.[0]?.due_date && (
              <p className="text-xs text-orange-600 mb-3">
                Due on {new Date(invoice.accounts[0].due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
            <button onClick={onFeesClick}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
              Pay Now <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// --- Day Plan Drawer ----------------------------------------------------------
function DayPlanDrawer({ day, activeChild, token, onClose }: {
  day: { date: string; label: string; topics: string[]; chunks: { topic: string; snippet: string; subjects?: string[] }[]; completed: boolean; isToday: boolean; todayStr: string };
  activeChild: Child | null;
  token: string;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Use todayStr from API (time-machine aware) � not real browser date
  const todayRef = day.todayStr || new Date().toISOString().split('T')[0];
  // A day is "past" if its date is strictly before today (time-machine aware)
  const isPast = day.date < todayRef;
  // A day is "covered" if teacher marked it completed OR if it's a past day
  // (past days happened regardless of whether the completed flag was set)
  const isCovered = day.completed || isPast;

  useEffect(() => {
    if (day.topics.length === 0) return;
    // Clear any stale 'plan' cache for past days � they should now use 'done'
    const staleCacheKey = `topic-summary:${activeChild?.id}:${day.date}:plan`;
    if (isCovered && localStorage.getItem(staleCacheKey)) {
      localStorage.removeItem(staleCacheKey);
    }
    const cacheKey = `topic-summary:${activeChild?.id}:${day.date}:${isCovered ? 'done' : 'plan'}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { ts, text } = JSON.parse(cached);
        // Bust stale cache if it contains "Week X Day Y"
        if (/week\s*\d+\s*day\s*\d+/i.test(text)) {
          localStorage.removeItem(cacheKey);
        } else if (ts === todayRef) {
          setSummary(text);
          return;
        }
      } catch {}
    }
    setLoading(true);
    apiPost<{ summary: string }>('/api/v1/ai/topic-summary', {
      topics: day.topics,
      chunks: day.chunks,
      class_name: activeChild?.class_name ?? 'Nursery',
      child_name: activeChild?.name?.split(' ')[0] ?? 'your child',
      completed: isCovered,
      feed_date: day.date,
    }, token)
      .then(d => {
        if (d.summary) {
          setSummary(d.summary);
          localStorage.setItem(cacheKey, JSON.stringify({ ts: todayRef, text: d.summary }));
        }
      })
      .catch(() => setSummary(day.topics.join(' � ')))
      .finally(() => setLoading(false));
  }, [day.date]);

  return (
    <div className="fixed inset-0 z-[100] flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative z-10 bg-white ml-auto w-full xl:w-80 h-full overflow-y-auto shadow-2xl border-l border-gray-100" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-5 py-4 border-b border-gray-100 flex items-center justify-between ${day.isToday ? 'bg-emerald-50' : isCovered ? 'bg-blue-50' : 'bg-gray-50'}`}>
          <div>
            <div className="flex items-center gap-2">
              <p className={`text-xs font-bold uppercase tracking-widest ${day.isToday ? 'text-emerald-600' : isCovered ? 'text-blue-600' : 'text-gray-400'}`}>
                {day.isToday ? 'Today' : isCovered ? (day.completed ? 'Completed' : 'Past') : 'Upcoming'}
              </p>
              {day.completed && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">? Covered</span>}
              {isPast && !day.completed && !day.isToday && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Past</span>}
            </div>
            <p className="text-base font-bold text-gray-900 mt-0.5">{day.label}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50">
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {day.topics.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No plan scheduled for this day</p>
            </div>
          ) : (
            <>
              {/* AI Summary card */}
              <div className={`rounded-2xl p-4 ${day.isToday ? 'bg-emerald-50 border border-emerald-100' : isCovered ? 'bg-blue-50 border border-blue-100' : 'bg-amber-50 border border-amber-100'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className={day.isToday ? 'text-emerald-600' : isCovered ? 'text-blue-600' : 'text-amber-600'} />
                  <p className={`text-xs font-bold uppercase tracking-wide ${day.isToday ? 'text-emerald-700' : isCovered ? 'text-blue-700' : 'text-amber-700'}`}>
                    {isCovered
                      ? (day.isToday ? 'What was covered today' : 'What was covered')
                      : (day.isToday ? 'What will be covered today' : 'What will be covered')}
                  </p>
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 py-1">
                    <Loader2 size={14} className="animate-spin text-gray-400" />
                    <p className="text-xs text-gray-400">Generating summary�</p>
                  </div>
                ) : (
                  <p className={`text-sm leading-relaxed ${day.isToday ? 'text-emerald-800' : isCovered ? 'text-blue-800' : 'text-amber-800'}`}>
                    {summary}
                  </p>
                )}
              </div>

              {/* Topic list */}
              <div>
                {(() => {
                  // Build display items � expand "Week X Day Y" chunks into their subjects
                  const displayItems: { label: string; snippet: string }[] = [];

                  for (const topic of day.topics) {
                    const stripped = topic.replace(/week\s*\d+\s*day\s*\d+\s*[-�:,.\s]*/gi, '').trim();
                    const chunk = day.chunks.find(c => c.topic === topic);
                    const isWeekDayLabel = !stripped;

                    if (isWeekDayLabel) {
                      // Use server-extracted subjects if available
                      if (chunk?.subjects && chunk.subjects.length > 0) {
                        chunk.subjects.forEach(s => displayItems.push({ label: s, snippet: '' }));
                      } else if (chunk?.snippet) {
                        // Fallback: parse snippet client-side
                        const lines = chunk.snippet.split('\n').map((l: string) => l.trim()).filter((l: string) => {
                          if (!l) return false;
                          if (/^week\s*\d+\s*day\s*\d+/i.test(l)) return false;
                          if (/^\d+$/.test(l)) return false;
                          return true;
                        });
                        if (lines.length > 0) {
                          lines.slice(0, 8).forEach((l: string) => displayItems.push({ label: l.replace(/:$/, '').trim(), snippet: '' }));
                        } else {
                          displayItems.push({ label: topic, snippet: chunk.snippet });
                        }
                      } else {
                        displayItems.push({ label: topic, snippet: '' });
                      }
                    } else {
                      displayItems.push({ label: stripped, snippet: chunk?.snippet || '' });
                    }
                  }

                  return (
                    <>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                        {displayItems.length} Subject{displayItems.length !== 1 ? 's' : ''}
                      </p>
                      <div className="space-y-2">
                        {displayItems.map((item, i) => (
                          <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              {isCovered
                                ? <CheckCircle2 size={14} className="text-emerald-500" />
                                : <span className="text-[10px] font-bold text-gray-400 bg-gray-200 w-5 h-5 rounded-full flex items-center justify-center">{i + 1}</span>
                              }
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm text-gray-700 leading-snug font-medium">{item.label}</p>
                              {item.snippet && (
                                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{item.snippet}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function CalendarTab({ token, activeChild }: { token: string; activeChild: Child | null }) {
  const [data, setData] = useState<{
    today: string;
    holidays: { id: string; date: string; title: string }[];
    special_days: { id: string; date: string; title: string; type: string; day_type: string }[];
    announcements: { id: string; title: string; body: string; date: string; author: string }[];
    calendar_start: string;
    calendar_end: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiGet<any>('/api/v1/parent/calendar', token)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // Use school's today from API (time-machine aware), fall back to browser date
  const today = data?.today ?? new Date().toISOString().split('T')[0];

  // Merge all events into a unified list
  const allEvents = data ? [
    ...data.holidays.map(h => ({ id: h.id, date: h.date, title: h.title, subtitle: 'School Holiday', type: 'holiday' as const })),
    ...data.special_days.map(s => ({
      id: s.id, date: s.date, title: s.title,
      subtitle: s.day_type
        ? s.day_type.charAt(0).toUpperCase() + s.day_type.slice(1).replace(/_/g, ' ')
        : 'Special Day',
      type: s.type as any,
    })),
    ...data.announcements.map(a => ({ id: a.id, date: a.date, title: a.title, subtitle: a.body?.slice(0, 80) || '', type: 'announcement' as const })),
  ].sort((a, b) => a.date.localeCompare(b.date)) : [];

  // Split using school's today (time-machine aware)
  const upcoming = allEvents.filter(e => e.date >= today);
  const past     = allEvents.filter(e => e.date < today).reverse(); // most recent first
  const displayed = view === 'upcoming' ? upcoming : past;

  function typeConfig(type: string) {
    switch (type) {
      case 'holiday':      return { bg: 'bg-red-50',    border: 'border-red-100',    icon: '???', label: 'Holiday',      labelCls: 'bg-red-100 text-red-700' };
      case 'settling':     return { bg: 'bg-amber-50',  border: 'border-amber-100',  icon: '??', label: 'Settling Day',  labelCls: 'bg-amber-100 text-amber-700' };
      case 'half_day':     return { bg: 'bg-yellow-50', border: 'border-yellow-100', icon: '?', label: 'Half Day',      labelCls: 'bg-yellow-100 text-yellow-700' };
      case 'exam':         return { bg: 'bg-purple-50', border: 'border-purple-100', icon: '??', label: 'Exam',          labelCls: 'bg-purple-100 text-purple-700' };
      case 'activity':     return { bg: 'bg-blue-50',   border: 'border-blue-100',   icon: '??', label: 'Activity',      labelCls: 'bg-blue-100 text-blue-700' };
      case 'announcement': return { bg: 'bg-emerald-50',border: 'border-emerald-100',icon: '??', label: 'Announcement',  labelCls: 'bg-emerald-100 text-emerald-700' };
      default:             return { bg: 'bg-gray-50',   border: 'border-gray-100',   icon: '??', label: 'Event',         labelCls: 'bg-gray-100 text-gray-600' };
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">School Calendar</h2>
        {(data as any)?.academic_year && (
          <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-full">{(data as any).academic_year}</span>
        )}
      </div>

      {/* Toggle � Upcoming / Past */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        <button onClick={() => setView('upcoming')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${view === 'upcoming' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
          Upcoming ({upcoming.length})
        </button>
        <button onClick={() => setView('past')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${view === 'past' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
          Completed ({past.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm">
          <Calendar size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {view === 'upcoming' ? 'No upcoming events' : 'No past events'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(e => {
            const cfg = typeConfig(e.type);
            const dateObj = new Date(e.date + 'T12:00:00');
            const isCompleted = e.date < today;
            return (
              <div key={`${e.type}-${e.id}`}
                className={`rounded-2xl p-4 border ${cfg.bg} ${cfg.border}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white border border-white/80 shadow-sm">
                    {cfg.icon === 'holiday'      && <Umbrella className="w-5 h-5 text-red-500" />}
                    {cfg.icon === 'settling'     && <Clock className="w-5 h-5 text-amber-500" />}
                    {cfg.icon === 'half_day'     && <Sun className="w-5 h-5 text-yellow-500" />}
                    {cfg.icon === 'exam'         && <Pencil className="w-5 h-5 text-purple-500" />}
                    {cfg.icon === 'activity'     && <Activity className="w-5 h-5 text-blue-500" />}
                    {cfg.icon === 'announcement' && <Megaphone className="w-5 h-5 text-emerald-500" />}
                    {cfg.icon === 'event'        && <PartyPopper className="w-5 h-5 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-semibold text-gray-800 text-sm">{e.title}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.labelCls}`}>{cfg.label}</span>
                      {isCompleted && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Done</span>
                      )}
                    </div>
                    {e.subtitle && <p className="text-xs text-gray-500 line-clamp-2">{e.subtitle}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Assignments Tab ----------------------------------------------------------
function AssignmentsTab({ activeChild, token }: { activeChild: Child | null; token: string }) {
  const [hwHistory, setHwHistory] = useState<HomeworkRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeChild?.id || !token) return;
    setLoading(true);
    apiGet<HomeworkRecord[]>(`/api/v1/parent/homework/history?student_id=${activeChild.id}`, token)
      .then(d => setHwHistory(d || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeChild?.id]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Assignments</h2>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
      ) : hwHistory.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm">
          <ClipboardList size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No assignments yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {hwHistory.map((hw, i) => {
            const rawDate = (hw.homework_date || '').toString().split('T')[0];
            const dateStr = rawDate ? new Date(rawDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '�';
            const statusConfig = {
              completed: { label: '? Done', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
              partial: { label: '� Partial', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
              not_submitted: { label: '? Not submitted', cls: 'bg-red-50 text-red-600 border-red-100' },
            }[hw.status] || { label: hw.status, cls: 'bg-gray-50 text-gray-600 border-gray-100' };
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
                  {hw.homework_text ? <p className="text-xs leading-relaxed whitespace-pre-wrap">{hw.homework_text}</p> : <p className="text-xs opacity-50 italic">No homework text recorded.</p>}
                  {hw.teacher_note && <p className="text-xs mt-2 italic opacity-70 border-t border-current/10 pt-2">Teacher note: {hw.teacher_note}</p>}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Fees Tab -----------------------------------------------------------------
function FeesTab({ invoice, activeChild, token }: { invoice: any; activeChild: Child | null; token: string }) {
  const [txnId, setTxnId] = useState('');
  const [txnFile, setTxnFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [txnMsg, setTxnMsg] = useState('');

  async function submitPayment() {
    if (!txnId.trim() && !txnFile) return;
    setSubmitting(true); setTxnMsg('');
    try {
      const fd = new FormData();
      if (txnId.trim()) fd.append('transaction_id', txnId.trim());
      if (txnFile) fd.append('receipt', txnFile);
      if (activeChild?.id) fd.append('student_id', activeChild.id);
      const res = await fetch(`${API_BASE}/api/v1/parent/fees/payment-proof`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setTxnMsg('? Payment details submitted. Admin will verify and update your fee status.');
      setTxnId(''); setTxnFile(null);
    } catch (e: any) { setTxnMsg(e.message || 'Failed to submit'); }
    finally { setSubmitting(false); }
  }

  if (!invoice) return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Fees</h2>
      <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
        <CreditCard size={40} className="text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 font-semibold mb-1">Fee structure not set up yet</p>
        <p className="text-sm text-gray-400">Your school admin hasn't configured fees yet. Please check back later or contact the school office.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Fees</h2>

      {/* Summary card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Total Due</p>
            <p className={`text-3xl font-black ${invoice.net_payable > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              ?{(invoice.net_payable ?? 0).toLocaleString('en-IN')}
            </p>
            {invoice.net_payable === 0 && <p className="text-xs text-emerald-600 font-medium mt-0.5">? All fees paid</p>}
          </div>
          {invoice.credit_balance > 0 && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Credit Balance</p>
              <p className="text-lg font-bold text-emerald-600">?{invoice.credit_balance.toLocaleString('en-IN')}</p>
            </div>
          )}
        </div>

        {/* Fee breakdown */}
        {invoice.accounts?.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fee Structure</p>
            {invoice.accounts.map((acc: any) => (
              <div key={acc.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{acc.fee_head_name}</p>
                  {acc.due_date && <p className="text-xs text-gray-400">Due {new Date(acc.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">?{(acc.outstanding_balance ?? 0).toLocaleString('en-IN')}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${acc.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : acc.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                    {acc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Download receipt button */}
        {invoice.receipt_url && (
          <a href={invoice.receipt_url} target="_blank" rel="noopener noreferrer"
            className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-sm font-semibold transition-colors">
            <Download size={14} /> Download Receipt
          </a>
        )}
      </div>

      {/* Submit payment proof */}
      {invoice.net_payable > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-bold text-gray-800 mb-1">Already paid?</p>
          <p className="text-xs text-gray-500 mb-4">Enter your transaction ID or upload a payment screenshot. Admin will verify and update your status.</p>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Transaction / UTR ID</label>
              <input
                type="text"
                value={txnId}
                onChange={e => setTxnId(e.target.value)}
                placeholder="e.g. UTR123456789012"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Upload Screenshot (optional)</label>
              <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <Paperclip size={14} className="text-gray-400" />
                <span className="text-sm text-gray-500">{txnFile ? txnFile.name : 'Choose image�'}</span>
                <input type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={e => setTxnFile(e.target.files?.[0] || null)} />
              </label>
            </div>

            {txnMsg && (
              <p className={`text-xs px-3 py-2 rounded-xl ${txnMsg.startsWith('?') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {txnMsg}
              </p>
            )}

            <button
              onClick={submitPayment}
              disabled={submitting || (!txnId.trim() && !txnFile)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm"
            >
              {submitting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting�</> : <>Submit Payment Details</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Reports Tab --------------------------------------------------------------
function ReportsTab({ attendance, progress, activeChild, token }: { attendance: AttendanceData | null; progress: ProgressData | null; activeChild: Child | null; token: string }) {
  const attPct = attendance?.attendance_pct ?? 0;
  const pct = progress?.coverage_pct ?? 0;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Reports</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className={`${attPct >= 75 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} border rounded-2xl p-4`}>
          <p className="text-xs text-gray-500 mb-1">Attendance</p>
          <p className={`text-3xl font-black ${attPct >= 75 ? 'text-emerald-700' : 'text-red-600'}`}>{attPct}%</p>
          <p className="text-xs text-gray-400 mt-1">{attendance?.stats.present ?? 0} present � {attendance?.stats.absent ?? 0} absent</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Curriculum</p>
          <p className="text-3xl font-black text-blue-700">{pct.toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">{progress?.covered ?? 0} of {progress?.total_chunks ?? 0} topics</p>
        </div>
      </div>
      {activeChild && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-bold text-gray-800">Full Report Card</p>
          </div>
          <p className="text-xs text-gray-500 mb-4">Complete descriptive report based on all teacher observations, journal entries, and curriculum covered.</p>
          <ReportCardGenerator token={token} role="parent" fixedStudentId={activeChild.id} fixedStudentName={activeChild.name} />
        </div>
      )}
    </div>
  );
}

// --- Attendance Tab -----------------------------------------------------------
function AttendanceTab({ data }: { data: AttendanceData | null }) {
  if (!data) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Calendar size={48} className="text-gray-300 mb-3" />
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
          <p className="text-xs text-neutral-400 mt-1">{stats.present} present � {stats.absent} absent</p>
        </div>
        <div className={`${punctuality_pct >= 80 ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'} border rounded-2xl p-4`}>
          <p className="text-xs text-neutral-500 mb-1">Punctuality</p>
          <p className={`text-3xl font-black ${punctuality_pct >= 80 ? 'text-blue-700' : 'text-amber-700'}`}>{punctuality_pct}%</p>
          <p className="text-xs text-neutral-400 mt-1">{stats.on_time} on time � {stats.late} late</p>
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
                <span className="text-[8px] leading-none mt-0.5">{r.status === 'present' && r.is_late ? '?' : r.status === 'present' ? '?' : '?'}</span>
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

// --- Progress Tab -------------------------------------------------------------
// --- Progress Tab � Learning Summary -----------------------------------------
function ProgressTab({ data, activeChild, token }: { data: ProgressData | null; activeChild: Child | null; token: string }) {
  const [milestoneData, setMilestoneData] = useState<{ completion_pct: number; achieved: number; total: number; class_level: string } | null>(null);
  const [termData, setTermData] = useState<{
    student_name: string; class_name: string;
    total_curriculum_chunks: number; covered_chunks: number;
    chunks: { id: string; topic_label: string; snippet: string }[];
    settling_notes: { date: string; note: string }[];
    completion_days: number;
  } | null>(null);
  const [termLoading, setTermLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (!activeChild?.id || !token) return;
    apiGet<any>(`/api/v1/teacher/milestones/${activeChild.id}`, token)
      .then(d => setMilestoneData({ completion_pct: d.completion_pct, achieved: d.achieved, total: d.total, class_level: d.class_level }))
      .catch(() => {});
    setTermLoading(true);
    apiGet<any>(`/api/v1/parent/child/${activeChild.id}/term-summary`, token)
      .then(d => {
        setTermData(d);
        if (d.chunks?.length > 0) {
          const cacheKey = `term-summary-v2:${activeChild.id}:${d.covered_chunks}`;
          const cached = localStorage.getItem(cacheKey);
          // Bust stale cache if it contains "Week X Day Y"
          if (cached && /week\s*\d+\s*day\s*\d+/i.test(cached)) {
            localStorage.removeItem(cacheKey);
          } else if (cached) {
            setAiSummary(cached);
            return;
          }
          setSummaryLoading(true);

          // Build a clean topic list � expand "Week X Day Y" chunks using subjects/snippet
          const meaningfulTopics: string[] = [];
          const meaningfulChunks: { topic: string; snippet: string }[] = [];
          for (const c of d.chunks.slice(0, 40)) {
            const label: string = c.topic_label || '';
            const isWeekDay = /^week\s*\d+\s*day\s*\d+\s*$/i.test(label.trim());
            if (isWeekDay) {
              // Use server-extracted subjects if available
              if (c.subjects?.length) {
                c.subjects.forEach((s: string) => {
                  if (!meaningfulTopics.includes(s)) meaningfulTopics.push(s);
                });
              }
              // Add snippet for context
              if (c.snippet) meaningfulChunks.push({ topic: label, snippet: c.snippet });
            } else {
              const clean = label.replace(/week\s*\d+\s*day\s*\d+\s*[-�:,.\s]*/gi, '').trim();
              if (clean && !meaningfulTopics.includes(clean)) meaningfulTopics.push(clean);
              if (c.snippet) meaningfulChunks.push({ topic: clean || label, snippet: c.snippet });
            }
          }

          // Deduplicate and limit to avoid token overflow (max ~50 topics, 15 chunks)
          const topicsToSend = [...new Set(meaningfulTopics)].slice(0, 50);
          const chunksToSend = meaningfulChunks.slice(0, 15);

          apiPost<{ summary: string }>('/api/v1/ai/term-summary', {
            subjects: topicsToSend.length > 0 ? topicsToSend : ['various subjects'],
            chunks: chunksToSend,
            class_name: activeChild.class_name ?? 'Nursery',
            child_name: activeChild.name.split(' ')[0],
            completion_days: d.completion_days ?? 0,
            covered_chunks: d.covered_chunks ?? 0,
          }, token)
            .then(r => {
              if (r.summary) {
                setAiSummary(r.summary);
                localStorage.setItem(cacheKey, r.summary);
              }
            })
            .catch(() => {})
            .finally(() => setSummaryLoading(false));
        }
      })
      .catch(() => {})
      .finally(() => setTermLoading(false));
  }, [activeChild?.id]);

  const pct = data?.coverage_pct ?? 0;
  const strokeColor = pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const r = 50; const circ = 2 * Math.PI * r;

  // Categorise topics by keyword
  function categorise(topics: string[]) {
    const cats: Record<string, string[]> = {
      'English & Language': [], 'Math & Numbers': [], 'Art & Craft': [],
      'Science & Nature': [], 'Circle Time & GK': [], 'Fine Motor & Writing': [],
      'Special Days & Events': [], 'Other Activities': [],
    };
    for (const t of topics) {
      const tl = t.toLowerCase();
      if (/english|letter|phonics|reading|story|language|alphabet|speaking|rhyme|listening/.test(tl)) cats['English & Language'].push(t);
      else if (/math|maths|number|count|shape|pattern|addition|subtraction|numeracy/.test(tl)) cats['Math & Numbers'].push(t);
      else if (/art|craft|draw|paint|colour|color|collage|clay|creative/.test(tl)) cats['Art & Craft'].push(t);
      else if (/science|nature|plant|animal|weather|earth|experiment|evs|environment/.test(tl)) cats['Science & Nature'].push(t);
      else if (/circle|gk|general|knowledge|quiz|question|social|emotional/.test(tl)) cats['Circle Time & GK'].push(t);
      else if (/motor|writing|pencil|grip|trace|cut|fold|bead|scribbl|handwriting/.test(tl)) cats['Fine Motor & Writing'].push(t);
      else if (/holiday|festival|special|event|celebration|birthday|diwali|christmas|eid|holi|settling|sensory|play|exploration/.test(tl)) cats['Special Days & Events'].push(t);
      else cats['Other Activities'].push(t);
    }
    return Object.entries(cats).filter(([, v]) => v.length > 0);
  }

  const catIcons: Record<string, string> = {
    'English & Language': 'EN', 'Math & Numbers': 'MA', 'Art & Craft': 'AR',
    'Science & Nature': 'SC', 'Circle Time & GK': 'GK', 'Fine Motor & Writing': 'FM',
    'Special Days & Events': '??', 'Other Activities': '?',
  };

  // Clean raw "Week X Day Y" labels
  function cleanLabel(label: string) {
    const cleaned = label.replace(/week\s*\d+\s*day\s*\d+/gi, '').trim().replace(/^[-�:,.\s]+|[-�:,.\s]+$/g, '');
    return cleaned || label;
  }

  // Build clean topic list from chunks � expand "Week X Day Y" using server subjects
  const allTopics: string[] = [];
  for (const c of (termData?.chunks ?? [])) {
    const label: string = c.topic_label || '';
    const isWeekDay = /^week\s*\d+\s*day\s*\d+\s*$/i.test(label.trim());
    if (isWeekDay) {
      // Use server-extracted subjects
      if ((c as any).subjects?.length) {
        for (const s of (c as any).subjects) {
          if (!allTopics.includes(s)) allTopics.push(s);
        }
      }
      // else skip � don't show "Week X Day Y" at all
    } else {
      const clean = cleanLabel(label);
      if (clean && !/^week\s*\d+\s*day\s*\d+/i.test(clean) && !allTopics.includes(clean)) {
        allTopics.push(clean);
      }
    }
  }
  const uniqueTopics = [...new Set(allTopics)];
  const categorised = categorise(uniqueTopics);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Learning Summary</h2>

      {/* Curriculum coverage ring */}
      {data && (
        <div className="bg-[#0f2417] rounded-2xl p-5 flex items-center gap-5">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
              <circle cx="60" cy="60" r={r} fill="none" stroke={strokeColor} strokeWidth="12"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white">{pct}%</span>
              <span className="text-[10px] text-white/50">covered</span>
            </div>
          </div>
          <div>
            <p className="font-bold text-white text-base">{activeChild?.name.split(' ')[0]}&apos;s Curriculum</p>
            {data.has_curriculum ? (
              <p className="text-sm text-white/60 mt-0.5">{data.covered} of {data.total_chunks} topics completed this term</p>
            ) : <p className="text-white/50 text-sm">No curriculum assigned yet</p>}
            {milestoneData && (
              <p className="text-xs text-white/50 mt-1">?? {milestoneData.achieved}/{milestoneData.total} milestones � {milestoneData.completion_pct}%</p>
            )}
            {termData && (
              <div className="mt-1 space-y-0.5">
                {(termData as any).settling_days > 0 && (
                  <p className="text-xs text-white/50">?? {(termData as any).settling_days} settling day{(termData as any).settling_days !== 1 ? 's' : ''} completed</p>
                )}
                {(termData as any).curriculum_days > 0 && (
                  <p className="text-xs text-white/40">?? {(termData as any).curriculum_days} curriculum day{(termData as any).curriculum_days !== 1 ? 's' : ''} � {termData.completion_days} total school days</p>
                )}
                {(termData as any).curriculum_days === 0 && termData.completion_days > 0 && (
                  <p className="text-xs text-white/40">?? {termData.completion_days} school day{termData.completion_days !== 1 ? 's' : ''} completed</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI summary of everything learned */}
      {(aiSummary || summaryLoading) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Sparkles size={12} className="text-emerald-500" /> What {activeChild?.name.split(' ')[0]} Has Learned So Far
          </p>
          {summaryLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 size={14} className="animate-spin text-emerald-500" />
              <p className="text-xs text-gray-400">Generating summary�</p>
            </div>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed">{aiSummary}</p>
          )}
        </div>
      )}

      {/* Settling period notes */}
      {termData?.settling_notes && termData.settling_notes.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">
            ?? Settling Period � {(termData as any).settling_days ?? termData.settling_notes.length} days
          </p>
          <div className="space-y-2">
            {termData.settling_notes.map((n, i) => (
              <div key={i} className="text-sm text-amber-800 leading-relaxed">
                <span className="text-[10px] text-amber-500 font-semibold">{n.date} � </span>{n.note}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Show settling days count even if no notes */}
      {(termData as any)?.settling_days > 0 && (!termData?.settling_notes || termData.settling_notes.length === 0) && (
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1">?? Settling Period</p>
          <p className="text-sm text-amber-800">{(termData as any).settling_days} settling day{(termData as any).settling_days !== 1 ? 's' : ''} completed � {activeChild?.name.split(' ')[0]} is getting comfortable in the classroom.</p>
        </div>
      )}

      {/* Skills & topics by category */}
      {termLoading ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
      ) : categorised.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Topics Covered This Term</p>
          {categorised.map(([cat, topics]) => (
            <div key={cat} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                <span>{catIcons[cat] ?? ''}</span> {cat}
                <span className="ml-auto text-[10px] font-semibold text-gray-400">{topics.length} topic{topics.length > 1 ? 's' : ''}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {topics.map((t, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
          <BookOpen size={36} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No topics covered yet this term</p>
        </div>
      )}

      {/* Journey link */}
      {activeChild && (
        <a href={`/parent/journey?student_id=${activeChild.id}`}
          className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors">
          <BookOpen size={14} /> View Full Child Journey
        </a>
      )}
    </div>
  );
}

// --- Chat Tab -----------------------------------------------------------------
function ChatTab({ msgs, input, loading, onInput, onSend, endRef, childName }: {
  msgs: ChatMsg[]; input: string; loading: boolean;
  onInput: (v: string) => void; onSend: () => void;
  endRef: React.RefObject<HTMLDivElement>; childName: string;
}) {
  function handleKey(e: React.KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }
  return (
    <div className="flex flex-col h-[calc(100vh-280px)] lg:h-[600px] bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
      <div className="bg-[#0f2417] px-5 py-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-xl flex-shrink-0 transition-all ${loading ? 'ring-2 ring-emerald-300 ring-offset-1 ring-offset-[#0f2417]' : ''}`}
          style={{ animation: loading ? 'oakieWobble 0.7s ease-in-out infinite alternate' : 'none' }}>??</div>
        <div>
          <p className="text-white font-bold text-sm">Oakie AI</p>
          <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
            {loading ? 'Thinking�' : 'Active'}
          </div>
        </div>
        <style>{`
          @keyframes oakieWobble {
            from { transform: rotate(-8deg) scale(1.05); }
            to   { transform: rotate(8deg) scale(1.1); }
          }
        `}</style>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50/50">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            style={{ animation: 'fadeslideup 0.25s ease both' }}>
            {m.role === 'ai' && <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-sm shrink-0 mr-2 mt-0.5">??</div>}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white text-neutral-800 shadow-sm border border-neutral-100 rounded-bl-sm'}`}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start" style={{ animation: 'fadeslideup 0.2s ease both' }}>
            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-sm shrink-0 mr-2"
              style={{ animation: 'oakieWobble 0.7s ease-in-out infinite alternate' }}>??</div>
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-neutral-100">
              <div className="flex gap-1.5 items-center h-4">
                {[0, 150, 300].map(d => <div key={d} className="w-2 h-2 rounded-full bg-emerald-400" style={{ animation: `bouncedot 1.2s ease-in-out ${d}ms infinite` }} />)}
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

// --- Messages Tab -------------------------------------------------------------
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
            <button onClick={() => setShowNewMsg(false)} className="text-neutral-400 hover:text-neutral-600">?</button>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600 mb-1 block">Select Teacher & Child</label>
            <select value={`${selectedTeacher}|${selectedStudent}`}
              onChange={e => { const [tid, sid] = e.target.value.split('|'); setSelectedTeacher(tid); setSelectedStudent(sid); }}
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
              <option value="|">Select teacher...</option>
              {teachers.map(t => (
                <option key={`${t.teacher_id}|${t.student_id}`} value={`${t.teacher_id}|${t.student_id}`}>
                  {t.teacher_name} � {t.student_name} ({t.class_name})
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

// --- Notifications Tab --------------------------------------------------------
function NotificationsTab({ notifications, announcements, onRead }: { notifications: Notification[]; announcements: Announcement[]; onRead: (id: string) => void }) {
  return (
    <div className="space-y-5">
      {announcements.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-neutral-800 mb-3">?? Announcements</h2>
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="bg-white rounded-2xl p-4 border-l-4 border-primary-400 shadow-sm">
                <p className="font-bold text-neutral-800 text-sm">{a.title}</p>
                <p className="text-sm text-neutral-600 mt-1">{a.body}</p>
                <p className="text-xs text-neutral-400 mt-2">By {a.author_name} � {a.created_at.split('T')[0]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <h2 className="text-lg font-bold text-neutral-800 mb-3">Updates</h2>
        {notifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-neutral-100 shadow-sm">
            <Bell size={40} className="text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 font-medium">You&apos;re all caught up!</p>
          </div>
        ) : notifications.map(n => (
          <div key={n.id} className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm mb-3">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-bold text-neutral-800 text-sm">{n.section_name}</p><p className="text-xs text-neutral-500 mt-0.5">{n.completion_date.split('T')[0]} � {n.chunks_covered} topics covered</p></div>
              <button onClick={() => onRead(n.id)} className="text-xs text-emerald-600 font-bold px-3 py-1.5 rounded-xl hover:bg-emerald-50 transition-colors min-h-[32px]">Dismiss</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightsTab({ insights, comparisons, activeChild, token }: { insights: ParentInsights | null; comparisons: ChildComparison[]; activeChild: Child | null; token: string }) {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loadingObs, setLoadingObs] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [realComparisons, setRealComparisons] = useState<ChildComparison[]>([]);
  const [compLoading, setCompLoading] = useState(false);

  useEffect(() => {
    if (!activeChild?.id || !token) return;
    setLoadingObs(true);

    // Fetch real class comparison data
    setCompLoading(true);
    apiGet<ChildComparison[]>(`/api/v1/parent/class-comparison/${activeChild.id}`, token)
      .then(setRealComparisons)
      .catch(() => {})
      .finally(() => setCompLoading(false));

    Promise.allSettled([
      apiGet<Observation[]>(`/api/v1/parent/observations/${activeChild.id}`, token),
      apiGet<AttendanceData>(`/api/v1/parent/child/${activeChild.id}/attendance`, token),
      apiGet<ProgressData[]>('/api/v1/parent/progress', token),
    ]).then(([obsRes, attRes, progRes]) => {
      const obs = obsRes.status === 'fulfilled' ? obsRes.value || [] : [];
      setObservations(obs);
      if (attRes.status === 'fulfilled') setAttendance(attRes.value);
      if (progRes.status === 'fulfilled') {
        const p = progRes.value.find((x: any) => x.student_id === activeChild.id);
        if (p) setProgress(p);
      }

      // Generate AI insights from observations + progress
      if (obs.length > 0 || attRes.status === 'fulfilled') {
        const cacheKey = `ai-insights:${activeChild.id}:${obs.length}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) { setAiInsights(cached); return; }

        setInsightsLoading(true);
        const obsText = obs.slice(0, 5).map((o: Observation) => `${o.teacher_name}: ${o.obs_text} [${(o.categories ?? []).join(', ')}]`).join('\n');
        const attData = attRes.status === 'fulfilled' ? attRes.value : null;
        const progData = progRes.status === 'fulfilled' ? progRes.value.find((x: any) => x.student_id === activeChild.id) : null;

        apiPost<{ summary: string }>('/api/v1/ai/topic-summary', {
          topics: [`Attendance: ${attData?.attendance_pct ?? 0}%`, `Curriculum: ${progData?.coverage_pct ?? 0}% covered`, ...obs.slice(0, 3).map((o: Observation) => o.obs_text?.slice(0, 80) ?? '')].filter(Boolean),
          chunks: obs.slice(0, 5).map((o: Observation) => ({ topic: o.teacher_name, snippet: o.obs_text?.slice(0, 200) ?? '' })),
          class_name: activeChild.class_name ?? 'Nursery',
          child_name: activeChild.name.split(' ')[0],
          completed: true,
        }, token)
          .then(r => { if (r.summary) { setAiInsights(r.summary); localStorage.setItem(cacheKey, r.summary); } })
          .catch(() => {})
          .finally(() => setInsightsLoading(false));
      }
    }).finally(() => setLoadingObs(false));
  }, [activeChild?.id]);

  if (!activeChild) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-neutral-300 animate-spin" />
      </div>
    );
  }

  // Derive strengths and areas from observation categories
  const allCategories = observations.flatMap(o => o.categories ?? []);
  const catCounts: Record<string, number> = {};
  for (const c of allCategories) catCounts[c] = (catCounts[c] ?? 0) + 1;
  const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  const strengths = sortedCats.slice(0, 4).map(([c]) => c);
  const recentObs = observations.slice(0, 5);
  const attPct = attendance?.attendance_pct ?? 0;
  const pct = progress?.coverage_pct ?? 0;

  // Goals for parent + teacher based on observations
  const parentGoals = [
    attPct < 90 ? `Help ${activeChild.name.split(' ')[0]} maintain regular attendance � aim for 90%+` : null,
    pct < 50 ? `Review covered topics at home to reinforce learning` : null,
    observations.some(o => (o.categories ?? []).some(c => /motor|writing|pencil|grip/.test(c.toLowerCase()))) ? `Practice pencil grip and fine motor activities at home (5 min daily)` : null,
    observations.some(o => (o.categories ?? []).some(c => /focus|attention|concentration/.test(c.toLowerCase()))) ? `Create a quiet reading/activity time at home to build focus` : null,
    `Discuss what ${activeChild.name.split(' ')[0]} learned today � ask open-ended questions`,
    `Read together for 10 minutes daily to build language skills`,
  ].filter(Boolean).slice(0, 4) as string[];

  const teacherGoals = [
    observations.some(o => (o.categories ?? []).some(c => /creative|art|craft/.test(c.toLowerCase()))) ? `Channel creativity through structured art and storytelling activities` : null,
    pct > 0 ? `Continue building on ${pct.toFixed(0)}% curriculum coverage with hands-on activities` : null,
    `Share weekly observations with parents to align home and school support`,
    `Provide differentiated activities based on ${activeChild.name.split(' ')[0]}'s learning pace`,
  ].filter(Boolean).slice(0, 3) as string[];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Insights</h2>

      {/* AI-generated overview */}
      {(aiInsights || insightsLoading) && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-4">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Sparkles size={12} /> AI Overview
          </p>
          {insightsLoading ? (
            <div className="flex items-center gap-2"><Loader2 size={14} className="animate-spin text-emerald-500" /><p className="text-xs text-emerald-600">Generating insights�</p></div>
          ) : (
            <p className="text-sm text-emerald-800 leading-relaxed">{aiInsights}</p>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-2xl p-4 border ${attPct >= 90 ? 'bg-emerald-50 border-emerald-100' : attPct >= 75 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-xs font-semibold text-gray-500 mb-1">Attendance</p>
          <p className={`text-3xl font-black ${attPct >= 90 ? 'text-emerald-700' : attPct >= 75 ? 'text-amber-700' : 'text-red-600'}`}>{attPct}%</p>
          <p className="text-xs text-gray-400 mt-0.5">{attendance?.stats.present ?? 0} present � {attendance?.stats.absent ?? 0} absent</p>
        </div>
        <div className="rounded-2xl p-4 bg-blue-50 border border-blue-100">
          <p className="text-xs font-semibold text-gray-500 mb-1">Curriculum</p>
          <p className="text-3xl font-black text-blue-700">{pct.toFixed(0)}%</p>
          <p className="text-xs text-gray-400 mt-0.5">{progress?.covered ?? 0} of {progress?.total_chunks ?? 0} topics</p>
        </div>
      </div>

      {/* Teacher Observations */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Sparkles size={15} className="text-emerald-500" /> Teacher Observations
        </p>
        {loadingObs ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
        ) : observations.length === 0 ? (
          <div className="text-center py-4">
            <BarChart3 size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No observations shared yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentObs.map(obs => (
              <div key={obs.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-600">{obs.teacher_name}</p>
                  <p className="text-[10px] text-gray-400">{obs.obs_date?.split('T')[0] ?? ''}</p>
                </div>
                {obs.obs_text && <p className="text-sm text-gray-700 leading-relaxed">{obs.obs_text}</p>}
                {obs.categories?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {obs.categories.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">{c}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {observations.length > 5 && <p className="text-xs text-gray-400 text-center">+{observations.length - 5} more</p>}
          </div>
        )}
      </div>

      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Star size={15} className="text-amber-500 fill-amber-400" /> Observed Strengths
          </p>
          <div className="flex flex-wrap gap-2">
            {strengths.map((s, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Goals for parents */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Target size={15} className="text-purple-500" /> How You Can Help at Home
        </p>
        <div className="space-y-2">
          {parentGoals.map((g, i) => (
            <div key={i} className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
              <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold text-purple-600">{i + 1}</span>
              <p className="text-sm text-gray-700 leading-snug">{g}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Goals for teachers */}
      {teacherGoals.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <BookOpen size={15} className="text-blue-500" /> Teacher Focus Areas
          </p>
          <div className="space-y-2">
            {teacherGoals.map((g, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
                <CheckCircle2 size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 leading-snug">{g}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Class comparison */}
      {(compLoading || realComparisons.length > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <BarChart3 size={15} className="text-indigo-500" /> Class Comparison
          </p>
          {compLoading ? (
            <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
          ) : (
            <div className="space-y-3">
              {realComparisons.map((comp, i) => (
                <div key={i} className={`rounded-xl p-3 border ${comp.isChild ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${comp.isChild ? 'text-emerald-800' : 'text-gray-700'}`}>{comp.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${comp.trend === 'up' ? 'bg-emerald-100 text-emerald-700' : comp.trend === 'down' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                      {comp.trend === 'up' ? '? up' : comp.trend === 'down' ? '? down' : '? stable'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><p className="text-gray-400">Attendance</p><p className="font-bold text-gray-800">{comp.attendance}%</p></div>
                    <div><p className="text-gray-400">Progress</p><p className="font-bold text-gray-800">{comp.progress}%</p></div>
                    <div><p className="text-gray-400">Participation</p><p className="font-bold text-gray-800">{comp.participation}%</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Journey link */}
      <a href={`/parent/journey?student_id=${activeChild.id}`}
        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors">
        <BookOpen size={14} /> View Full Child Journey
      </a>
    </div>
  );
}

function SettingsTab({ token, emergencyContacts, notificationPrefs, calendarEvents, calendarSyncEnabled, assistantReminders, translationSettings, onEmergencyContactsChange, onNotificationPrefsChange, onCalendarSyncChange, onAssistantRemindersChange, onTranslationSettingsChange, translationEnabled }: {
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
  translationEnabled: boolean;
  token: string;
}) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<'profile' | 'emergency' | 'notifications' | 'calendar' | 'translation'>('profile');

  // ── Profile edit state ──
  const [profileName, setProfileName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [currentMobile, setCurrentMobile] = useState('');

  useEffect(() => {
    apiGet<{ name: string; mobile: string; mobile_can_update?: boolean }>('/api/v1/parent/profile', token)
      .then(p => { setProfileName(p.name || ''); setCurrentMobile(p.mobile || ''); })
      .catch(() => {});
  }, [token]);

  async function saveProfile() {
    if (!profileName.trim()) return;
    setProfileSaving(true); setProfileMsg('');
    try {
      await apiPut('/api/v1/parent/profile', { name: profileName.trim() }, token);
      setProfileMsg('✓ Name updated successfully');
    } catch (e: any) {
      setProfileMsg(e.message || 'Failed to update');
    } finally { setProfileSaving(false); }
  }

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

  const [localPrefs, setLocalPrefs] = useState<NotificationPreference[]>(Array.isArray(notificationPrefs) ? notificationPrefs : []);
  useEffect(() => setLocalPrefs(Array.isArray(notificationPrefs) ? notificationPrefs : []), [notificationPrefs]);

  const languageNames: Record<string, string> = {
    en: 'English',
    hi: '????? (Hindi)',
    te: '?????? (Telugu)',
    ta: '????? (Tamil)',
    kn: '????? (Kannada)',
    ml: '?????? (Malayalam)',
    gu: '??????? (Gujarati)',
    bn: '????? (Bengali)',
    mr: '????? (Marathi)',
    pa: '?????? (Punjabi)'
  };

  return (
    <div className="space-y-6">
      {/* Settings Navigation */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'profile', label: 'My Profile', icon: User },
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

      {/* Profile Section */}
      {activeSection === 'profile' && (
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-6 h-6 text-emerald-600" />
            <h2 className="text-xl font-bold text-neutral-800">My Profile</h2>
          </div>
          <div className="space-y-4 max-w-sm">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Mobile Number</label>
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">
                +91 {currentMobile.slice(0,5)} {currentMobile.slice(5)} <span className="text-xs text-gray-400 ml-1">(login credential — contact admin to change)</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Display Name</label>
              <input
                type="text"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30 bg-white"
              />
            </div>
            {profileMsg && (
              <p className={`text-xs font-medium px-3 py-2 rounded-xl ${profileMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {profileMsg}
              </p>
            )}
            <button
              onClick={saveProfile}
              disabled={profileSaving || !profileName.trim()}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
            >
              {profileSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

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
                    <option value="1">1 � Primary</option>
                    <option value="2">2 � Secondary</option>
                    <option value="3">3 � Other</option>
                  </select>
                  <div className="flex-1" />
                  <button onClick={async () => {
                    if (!newName.trim() || !newPhone.trim()) return;
                    setCreating(true);
                    try {
                      const payload = { name: newName.trim(), relationship: newRelation.trim() || null, phone: newPhone.trim(), phone_type: null, is_primary: newPriority === 1 };
                      const created = await apiPost<any>('/api/v1/parent/emergency-contacts', payload, token);
                      const mapped = { id: created.id, name: created.name, relation: created.relationship || created.relation || '', phone: created.phone, priority: (created.is_primary ? 1 : 2) as 1 | 2 | 3, available: true };
                      onEmergencyContactsChange([...emergencyContacts, mapped]);
                      setNewName(''); setNewRelation(''); setNewPhone(''); setNewPriority(2); setShowAddForm(false);
                    } catch (err) { console.error(err); alert('Failed to add contact'); }
                    finally { setCreating(false); }
                  }} className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-sm" disabled={creating}>{creating ? 'Adding�' : 'Add'}</button>
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
                        <option value="1">1 � Primary</option>
                        <option value="2">2 � Secondary</option>
                        <option value="3">3 � Other</option>
                      </select>
                      <div className="flex-1" />
                      <button onClick={async () => {
                        setEditSaving(true);
                        try {
                          const payload = { name: editName.trim(), relationship: editRelation.trim() || null, phone: editPhone.trim(), phone_type: null, is_primary: editPriority === 1 };
                          const updated = await apiPut<any>(`/api/v1/parent/emergency-contacts/${contact.id}`, payload, token);
                          const mapped = { id: updated.id, name: updated.name, relation: updated.relationship || updated.relation || '', phone: updated.phone, priority: (updated.is_primary ? 1 : 2) as 1 | 2 | 3, available: true };
                          onEmergencyContactsChange(emergencyContacts.map(c => c.id === contact.id ? mapped : c));
                          setEditingId(null);
                        } catch (err) { console.error(err); alert('Failed to update contact'); }
                        finally { setEditSaving(false); }
                      }} className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-sm mr-2" disabled={editSaving}>{editSaving ? 'Saving�' : 'Save'}</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-neutral-100 rounded-xl text-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${contact.available ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="font-semibold text-neutral-800">{contact.name}</div>
                        <div className="text-sm text-neutral-600">{contact.relation} � {contact.phone}</div>
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

      {/* Calendar Section � Paid Feature */}
      {activeSection === 'calendar' && (
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <CalendarDays className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-neutral-800">Calendar Integration</h2>
            <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Premium</span>
          </div>
          <p className="text-sm text-neutral-500 mb-6">Sync school events, homework deadlines and reminders directly to your calendar.</p>

          <div className="rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/50 p-6 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center text-3xl">??</div>
            <p className="font-bold text-neutral-800 text-base">Smart Calendar Sync</p>
            <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">
              Automatically add homework due dates, school events and parent-teacher meetings to Google Calendar or Apple Calendar.
            </p>

            {/* Feature list */}
            <div className="w-full space-y-2 my-1">
              {[
                { icon: '??', label: 'Google Calendar & Apple Calendar sync' },
                { icon: '??', label: 'Oakie AI reminders � smart nudges before deadlines' },
                { icon: '??', label: 'Never miss a homework due date or school event' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3 bg-white border border-purple-100 rounded-xl px-4 py-2.5 text-left">
                  <span className="text-lg shrink-0">{f.icon}</span>
                  <span className="text-sm text-neutral-700">{f.label}</span>
                </div>
              ))}
            </div>

            <div className="w-full bg-white border border-purple-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-neutral-600 mb-1">Coming soon � Subscription required</p>
              <p className="text-xs text-neutral-400">Payment integration is being set up. You'll be notified when this feature is available for purchase.</p>
            </div>
            <button disabled className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm opacity-50 cursor-not-allowed flex items-center justify-center gap-2">
              <CalendarDays size={16} /> Unlock Calendar Sync � Coming Soon
            </button>
          </div>
        </div>
      )}

      {/* Translation Section */}
      {activeSection === 'translation' && (
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-neutral-800">Language & Translation</h2>
          </div>
          <p className="text-sm text-neutral-500 mb-6">Choose your preferred language for the parent portal.</p>

          {!translationEnabled ? (
            /* School has disabled translation */
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center">
              <Globe className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-neutral-600 mb-1">Translation not available</p>
              <p className="text-xs text-neutral-400">Your school has not enabled multilingual support. Contact your school admin for more information.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Enable toggle */}
              <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 rounded-xl border border-neutral-100">
                <div>
                  <p className="text-sm font-semibold text-neutral-800">Enable Translation</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Translate portal content to your language</p>
                </div>
                <button
                  onClick={async () => {
                    const next = { ...translationSettings, enabled: !translationSettings.enabled };
                    onTranslationSettingsChange(next);
                    await apiPut('/api/v1/parent/settings', { translation_settings: next }, token).catch(() => {});
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${translationSettings.enabled ? 'bg-indigo-600' : 'bg-neutral-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${translationSettings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Language picker � only shown when enabled */}
              {translationSettings.enabled && (
                <div>
                  <p className="text-xs font-semibold text-neutral-600 mb-3">Select Language</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { code: 'en', label: 'English', native: 'English' },
                      { code: 'hi', label: 'Hindi', native: '?????' },
                      { code: 'te', label: 'Telugu', native: '??????' },
                      { code: 'ta', label: 'Tamil', native: '?????' },
                      { code: 'kn', label: 'Kannada', native: '?????' },
                      { code: 'ml', label: 'Malayalam', native: '??????' },
                      { code: 'gu', label: 'Gujarati', native: '???????' },
                      { code: 'bn', label: 'Bengali', native: '?????' },
                      { code: 'mr', label: 'Marathi', native: '?????' },
                      { code: 'pa', label: 'Punjabi', native: '??????' },
                    ].map(lang => {
                      const selected = translationSettings.targetLanguage === lang.code;
                      return (
                        <button
                          key={lang.code}
                          onClick={async () => {
                            const next = { ...translationSettings, targetLanguage: lang.code };
                            onTranslationSettingsChange(next);
                            await apiPut('/api/v1/parent/settings', { translation_settings: next }, token).catch(() => {});
                          }}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                            selected
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                              : 'bg-white border-neutral-200 text-neutral-700 hover:border-indigo-200'
                          }`}
                        >
                          <span className="text-lg leading-none">{lang.native}</span>
                          <div>
                            <p className={`text-xs font-semibold ${selected ? 'text-indigo-700' : 'text-neutral-700'}`}>{lang.label}</p>
                            {selected && <p className="text-[10px] text-indigo-500">Active</p>}
                          </div>
                          {selected && <span className="ml-auto text-indigo-500 text-sm">?</span>}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-neutral-400 mt-3">
                    Note: Translation applies to UI labels. Homework and teacher notes are shown in the original language.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}





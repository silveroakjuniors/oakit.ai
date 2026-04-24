'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Calendar, TrendingUp, Sparkles, MessageSquare, Bell,
  LogOut, BookOpen, Clock, CheckCircle2, AlertCircle, User,
  ChevronRight, Send, Loader2, RefreshCw, Phone, Shield, Settings,
  BarChart3, Target, Zap, CalendarDays, Apple, Smartphone,
  ClipboardList, CreditCard, FileBarChart, Star, ArrowRight, Heart, Download,
  X, Paperclip, Sun, Hand, Moon, Camera, Image as ImageIcon
} from 'lucide-react';
import { API_BASE, apiGet, apiPost, apiDelete, apiPut } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import OakitLogo from '@/components/OakitLogo';

// ─── Translation Settings type (needed by TranslationContext) ─────────────────
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

interface ChildComparison {
  childId: string;
  name: string;
  attendance: number;
  progress: number;
  participation: number;
  rank: number;
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
  const [invoice, setInvoice] = useState<any | null>(null);
  const [parentProfile, setParentProfile] = useState<{ name: string; mobile: string } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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

  // t() helper used directly in ParentPage (can't use useTranslation here — we ARE the provider)
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
      if (profileResult.status === 'fulfilled') setParentProfile(profileResult.value);

      setChildren(kids);
      setNotifications(notifs);
      apiGet<Announcement[]>('/api/v1/parent/announcements', token).then(setAnnouncements).catch(() => {});
      apiGet<ParentMessage[]>('/api/v1/parent/messages', token).then(setMessageThreads).catch(() => {});
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
      // Always load insights mock data (no real API yet)
      loadMockFeaturesData(false);
      
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
      // Load class feed and invoice in background
      const child = children.find(c => c.id === childId);
      if (child?.section_id) {
        apiGet<any>(`/api/v1/feed?section_id=${child.section_id}`, token)
          .then(d => { const posts = Array.isArray(d) ? d : (d?.posts ?? []); setClassFeed(posts.slice(0, 8)); })
          .catch(() => {});
      }
      apiGet<any>(`/api/v1/parent/fees/invoice/${childId}`, token)
        .then(setInvoice).catch(() => {});
    } finally { setChildLoading(false); }
  }, [cache, token, children]);

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
          <AlertCircle size={32} className="text-amber-500 mx-auto mb-3" />
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
      {noteModal && <NoteModal note={noteModal} token={token} onClose={() => setNoteModal(null)} />}

      {/* ── Full-page wrapper ── */}
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col" style={{ fontFamily: "'Inter',-apple-system,sans-serif" }}>

        {/* ── TOP HEADER BAR (desktop) ── */}
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
            {/* Time-based greeting + parent name — always visible */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-gray-500">
                {(() => { const h = new Date().getHours(); return h < 12 ? 'Good Morning,' : h < 17 ? 'Good Afternoon,' : 'Good Evening,'; })()}
              </span>
              <span className="text-sm font-semibold text-gray-800">
                {parentProfile?.name ? parentProfile.name.split(' ')[0] : activeChild?.name?.split(' ')[0] ?? 'there'}
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
            {/* Parent profile — click to show name + contact */}
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
                    {parentProfile?.name ?? activeChild?.name?.split(' ')[0] ?? 'Parent'}
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
                          {parentProfile?.name ?? 'Parent'}
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
                          {parentProfile?.mobile ?? '—'}
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
                          <p className="text-xs text-gray-400">{activeChild.class_name} · {activeChild.section_label}</p>
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
                      onClick={() => { clearToken(); router.push('/login'); }}
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

        {/* ── BODY: sidebar + main + right panel ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── LEFT SIDEBAR ── */}
          <aside className="hidden lg:flex flex-col w-44 flex-shrink-0 bg-white border-r border-gray-100 overflow-y-auto" style={{ minHeight: 'calc(100vh - 57px)' }}>
            {/* Nav */}
            <nav className="flex-1 px-2 py-3 space-y-0.5">
              {TABS.map(({ id, Icon, label }) => {
                const badge = id === 'messages' ? unreadMessages : id === 'notifications' ? unreadNotifs : 0;
                const active = tab === id;
                return (
                  <button key={id} onClick={() => setTab(id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                      active ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                    }`}>
                    <Icon size={17} className={active ? 'text-emerald-600' : 'text-gray-400'} />
                    <span className="flex-1">{label}</span>
                    {badge > 0 && <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{badge}</span>}
                  </button>
                );
              })}
            </nav>

            {/* Child card at bottom */}
            {activeChild && (
              <div className="px-2 pb-3 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {activeChild.photo_url ? (
                      <img src={activeChild.photo_url.startsWith('http') ? activeChild.photo_url : `${API_BASE}${activeChild.photo_url}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-emerald-700 font-bold text-xs">{activeChild.name[0]}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 truncate">{activeChild.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{activeChild.class_name} · {activeChild.section_label}</p>
                  </div>
                  {children.length > 1 && (
                    <button onClick={() => { const idx = children.findIndex(c => c.id === activeChildId); switchChild(children[(idx + 1) % children.length].id); }}
                      className="text-gray-400 hover:text-gray-600 text-xs">↕</button>
                  )}
                </div>
              </div>
            )}

            {/* Sign out */}
            <div className="px-2 pb-4">
              <button onClick={() => { clearToken(); router.push('/login'); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all">
                <LogOut size={15} />
                <span>Log out</span>
              </button>
            </div>
          </aside>

          {/* ── MAIN CONTENT ── */}
          <main className="flex-1 overflow-y-auto">
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
                  <div className="w-8 h-8 rounded-full bg-emerald-100 overflow-hidden flex items-center justify-center">
                    {activeChild.photo_url ? (
                      <img src={activeChild.photo_url.startsWith('http') ? activeChild.photo_url : `${API_BASE}${activeChild.photo_url}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-emerald-700 font-bold text-sm">{activeChild.name[0]}</span>
                    )}
                  </div>
                )}
              </div>
            </header>

            <div className="p-4 lg:p-6 pb-24 lg:pb-8">
              {childLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
                </div>
              ) : (
                <>
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
                    />
                  )}
                  {tab === 'calendar' && <CalendarTab events={calendarEvents} />}
                  {tab === 'progress' && <ProgressTab data={activeCache?.progress ?? null} activeChild={activeChild} token={token} />}
                  {tab === 'assignments' && <AssignmentsTab activeChild={activeChild} token={token} />}
                  {tab === 'messages' && <MessagesTab threads={messageThreads} token={token} onRefresh={() => apiGet<ParentMessage[]>('/api/v1/parent/messages', token).then(setMessageThreads).catch(() => {})} />}
                  {tab === 'notifications' && <NotificationsTab notifications={notifications} announcements={announcements} onRead={markNotifRead} />}
                  {tab === 'fees' && <FeesTab invoice={invoice} activeChild={activeChild} token={token} />}
                  {tab === 'reports' && <ReportsTab attendance={activeCache?.attendance ?? null} progress={activeCache?.progress ?? null} activeChild={activeChild} />}
                  {tab === 'settings' && <SettingsTab token={token} emergencyContacts={emergencyContacts} notificationPrefs={notificationPrefs} calendarEvents={calendarEvents} calendarSyncEnabled={calendarSyncEnabled} assistantReminders={assistantReminders} translationSettings={translationSettings} onEmergencyContactsChange={setEmergencyContacts} onNotificationPrefsChange={setNotificationPrefs} onCalendarSyncChange={saveCalendarSync} onAssistantRemindersChange={saveAssistantReminders} onTranslationSettingsChange={setTranslationSettings} />}
                  {tab === 'chat' && <ChatTab msgs={chatMsgs} input={chatInput} loading={chatLoading} onInput={setChatInput} onSend={sendChat} endRef={chatEndRef} childName={activeChild?.name.split(' ')[0] ?? 'your child'} />}
                  {tab === 'insights' && <InsightsTab insights={parentInsights} comparisons={childComparisons} activeChild={activeChild} />}
                </>
              )}
            </div>
          </main>

          {/* ── CLASS FEED COLUMN (desktop only) ── */}
          <aside className="hidden xl:flex flex-col w-64 flex-shrink-0 border-l border-gray-100 bg-white overflow-y-auto" style={{ minHeight: 'calc(100vh - 57px)' }}>
            <ClassFeedColumn classFeed={classFeed} />
          </aside>

          {/* ── WEEKLY SCHEDULE COLUMN (desktop only) ── */}
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

        {/* ── MOBILE BOTTOM NAV ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 flex"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -2px 12px rgba(0,0,0,0.06)' }}>
          {TABS.slice(0, 6).map(({ id, Icon, label }) => {
            const active = tab === id;
            const badge = id === 'messages' ? unreadMessages : id === 'notifications' ? unreadNotifs : 0;
            return (
              <button key={id} onClick={() => setTab(id)}
                className="flex-1 flex flex-col items-center py-2 gap-0.5 relative">
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
            <span>{daysLeft <= 0 ? 'Expires today — download now.' : `Auto-deleted on ${note.expires_at.split('T')[0]} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left). Save a local copy.`}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Home Tab ────────────────────────────────────────────────────────────────
function HomeTab({ feed, progress, attendance, activeChild, announcements, onNoteClick, onTabChange, token, onChildUpdate, unreadMessages, unreadNotifs, invoice, parentProfile, classFeed }: {
  feed: ChildFeed | null; progress: ProgressData | null; attendance: AttendanceData | null; activeChild: Child | null;
  announcements: Announcement[]; onNoteClick: (n: NoteItem) => void; onTabChange: (t: Tab) => void;
  token: string; onChildUpdate: (url: string) => void;
  unreadMessages: number; unreadNotifs: number; invoice: any;
  parentProfile: { name: string; mobile: string } | null;
  classFeed: any[];
}) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Fetch AI summary for today's topics — cached once per day per child
  useEffect(() => {
    if (!feed?.topics?.length || !activeChild?.id || !token) return;
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `feed-summary:${activeChild.id}:${today}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { setAiSummary(cached); return; }

    setSummaryLoading(true);
    const completed = !!feed.attendance; // if attendance marked, topics were covered today
    const params = new URLSearchParams({
      topics: feed.topics.join(','),
      class_name: activeChild.class_name ?? 'Nursery',
      child_name: activeChild.name.split(' ')[0],
      completed: String(completed),
    });
    apiGet<{ summary: string }>(`/api/v1/ai/topic-summary?${params}`, token)
      .then(d => { setAiSummary(d.summary); localStorage.setItem(cacheKey, d.summary); })
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
  const pct = progress?.coverage_pct ?? 0;

  // Week calendar
  const today = new Date();
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const todayDow = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((todayDow + 6) % 7));
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  });
  const attRecords = attendance?.records ?? [];

  return (
    <div className="space-y-5">
      {/* Child profile card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
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
          <p className="text-sm text-gray-500">{activeChild.class_name} · Section {activeChild.section_label}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-emerald-600 font-medium">Active</span>
          </div>
        </div>
        <button onClick={() => onTabChange('progress')} className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium hover:text-emerald-700 flex-shrink-0">
          View Profile <ChevronRight size={14} />
        </button>
      </div>

      {/* Stat cards row — 4 colored cards with mini donut graphs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Attendance */}
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', border: '1px solid #6ee7b7' }}>
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
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,#dbeafe,#bfdbfe)', border: '1px solid #93c5fd' }}>
          <div className="relative flex-shrink-0 w-12 h-12">
            <svg width="48" height="48" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="5" />
              <circle cx="24" cy="24" r="18" fill="none" stroke="#2563eb" strokeWidth="5"
                strokeDasharray={`${(pct / 100) * 113} 113`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <TrendingUp size={14} className="text-blue-700" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-blue-900 leading-none">{pct.toFixed(1)}%</p>
            <p className="text-xs font-semibold text-blue-700 mt-0.5">Progress</p>
            <p className="text-[10px] text-blue-600">This Term</p>
          </div>
        </div>

        {/* Messages */}
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)', border: '1px solid #c4b5fd' }}>
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
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '1px solid #fcd34d' }}>
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

      {/* Today's Feed + This Week */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today's Feed — AI summary + teacher notes */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
            <ClipboardList size={13} className="text-gray-400" /> Today&apos;s Feed
          </p>

          {/* AI-generated summary */}
          {feed?.special_label ? (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-sm font-semibold text-amber-800">{feed.special_label}</p>
            </div>
          ) : feed?.topics && feed.topics.length > 0 ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
              {summaryLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin text-emerald-500" />
                  <p className="text-xs text-emerald-600">Generating summary…</p>
                </div>
              ) : aiSummary ? (
                <p className="text-sm text-emerald-800 leading-relaxed">{aiSummary}</p>
              ) : (
                <p className="text-sm text-emerald-800 leading-relaxed">
                  {feed.attendance
                    ? `Today, ${activeChild.name.split(' ')[0]} learned about ${feed.topics.slice(0, 2).join(' and ')}.`
                    : `Today, ${activeChild.name.split(' ')[0]} will learn about ${feed.topics.slice(0, 2).join(' and ')}.`}
                </p>
              )}
              {/* Topic chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {feed.topics.map((topic, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white text-emerald-700 border border-emerald-200">{topic}</span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-2 text-center">No feed data yet for today</p>
          )}

          {/* Homework */}
          {feed?.homework && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                <BookOpen size={12} className="text-gray-400" /> Homework
              </p>
              <div className="space-y-1.5">
                {(feed.homework.formatted_text || feed.homework.raw_text).split('\n').filter(Boolean).slice(0, 3).map((line, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-gray-300 text-xs mt-0.5 flex-shrink-0 font-bold">{i + 1}.</span>
                    <p className="text-sm text-gray-600 leading-relaxed">{line.replace(/^\d+\.\s*/, '')}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => onTabChange('assignments')} className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1 hover:text-emerald-700">
                View All <ChevronRight size={11} />
              </button>
            </div>
          )}

          {/* Teacher Notes inline */}
          {feed?.notes && feed.notes.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                <ClipboardList size={12} className="text-gray-400" /> Teacher Notes
              </p>
              <div className="space-y-2">
                {feed.notes.slice(0, 2).map(note => {
                  const dl = Math.ceil((new Date(note.expires_at).getTime() - Date.now()) / 86400000);
                  return (
                    <button key={note.id} onClick={() => onNoteClick(note)}
                      className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2.5 transition-colors border border-gray-100">
                      {note.note_text && <p className="text-xs text-gray-700 line-clamp-2">{note.note_text}</p>}
                      {note.file_name && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Paperclip size={11} className="text-gray-400" />
                          <p className="text-xs text-gray-500 truncate flex-1">{note.file_name}</p>
                          <Download size={11} className="text-emerald-500" />
                        </div>
                      )}
                      <p className={`text-[10px] mt-1 ${dl <= 3 ? 'text-red-500' : 'text-gray-400'}`}>
                        Expires in {dl} day{dl === 1 ? '' : 's'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Class Feed preview — 2 photos */}
          {classFeed.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                <ImageIcon size={12} className="text-gray-400" /> Class Photos
              </p>
              <div className="grid grid-cols-2 gap-2">
                {classFeed.slice(0, 2).map((post: any) => {
                  const img = post.images?.[0];
                  return img ? (
                    <div key={post.id} className="rounded-xl overflow-hidden border border-gray-100 relative">
                      <img src={img} alt={post.caption ?? ''} className="w-full object-cover" style={{ height: 80 }} />
                      <div className="absolute bottom-1 right-1 flex items-center gap-0.5 bg-black/50 rounded-full px-1.5 py-0.5">
                        <Heart size={9} className="text-pink-300 fill-pink-300" />
                        <span className="text-[9px] text-white font-bold">{post.like_count ?? 0}</span>
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>

        {/* This Week */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">
            <CalendarDays size={13} className="text-gray-400" /> This Week
          </p>
          <div className="flex justify-between mb-3">
            {weekDays.map((d, i) => {
              const dateObj = weekDates[i];
              const isToday = dateObj.toDateString() === today.toDateString();
              const dateStr = dateObj.toISOString().split('T')[0];
              const rec = attRecords.find(r => r.attend_date.split('T')[0] === dateStr);
              const dotColor = !rec ? 'bg-gray-200' : rec.status === 'present' && !rec.is_late ? 'bg-emerald-500' : rec.status === 'present' ? 'bg-amber-500' : 'bg-red-500';
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-gray-400">{d}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isToday ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 bg-gray-50'
                  }`}>
                    {dateObj.getDate()}
                  </div>
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                </div>
              );
            })}
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-center">
            <p className="text-xs text-gray-400">No events scheduled for today</p>
          </div>
          <button onClick={() => onTabChange('calendar')} className="w-full mt-3 text-xs text-emerald-600 font-medium flex items-center justify-center gap-1 hover:text-emerald-700">
            View Full Calendar <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Curriculum Progress + Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Curriculum Progress */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-1.5">
            <TrendingUp size={13} className="text-gray-400" /> Curriculum Progress
          </p>
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
              <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="32" fill="none" stroke="#F3F4F6" strokeWidth="8" />
                <circle cx="40" cy="40" r="32" fill="none" stroke="#10B981" strokeWidth="8"
                  strokeDasharray={`${(pct / 100) * 201} 201`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-lg font-black text-gray-900 leading-none">{pct.toFixed(1)}%</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 leading-relaxed">
                <span className="font-semibold text-gray-800">{pct.toFixed(1)}%</span> of curriculum covered this term
              </p>
              <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-1.5">
            <Zap size={13} className="text-gray-400" /> Quick Actions
          </p>
          <div className="grid grid-cols-4 gap-2">
            {([
              { Icon: BarChart3,     label: 'Report Card', action: () => onTabChange('reports'),       bg: 'bg-blue-50',   iconColor: 'text-blue-500' },
              { Icon: ImageIcon,     label: 'Gallery',     action: () => onTabChange('notifications'), bg: 'bg-purple-50', iconColor: 'text-purple-500' },
              { Icon: MessageSquare, label: 'Messages',    action: () => onTabChange('messages'),      bg: 'bg-emerald-50',iconColor: 'text-emerald-500' },
              { Icon: CreditCard,    label: 'Fee Details', action: () => onTabChange('fees'),          bg: 'bg-orange-50', iconColor: 'text-orange-500' },
            ] as const).map(a => (
              <button key={a.label} onClick={a.action}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-emerald-50 border border-gray-100 hover:border-emerald-200 transition-all">
                <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center`}>
                  <a.Icon size={18} className={a.iconColor} />
                </div>
                <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight">{a.label}</span>
              </button>
            ))}
          </div>
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
                <p className="text-xs text-gray-400 mt-1">By {a.author_name} · {a.created_at.split('T')[0]}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Class Feed Column ────────────────────────────────────────────────────────
function ClassFeedColumn({ classFeed }: { classFeed: any[] }) {
  return (
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
                    <img src={img} alt={post.caption ?? ''} className="w-full rounded-xl object-cover mb-2.5" style={{ height: 150 }} />
                  ) : (
                    <div className="w-full rounded-xl flex items-center justify-center bg-emerald-50 mb-2.5" style={{ height: 100 }}>
                      <ImageIcon size={28} className="text-emerald-300" />
                    </div>
                  )}
                  {/* Extra images row */}
                  {post.images?.length > 1 && (
                    <div className="flex gap-1.5 mb-2">
                      {post.images.slice(1, 4).map((img2: string, i: number) => (
                        <img key={i} src={img2} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      ))}
                      {post.images.length > 4 && (
                        <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
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
                    <div className="flex items-center gap-1 text-xs text-pink-500 font-semibold">
                      <Heart size={12} className="fill-pink-400 text-pink-400" />
                      <span>{post.like_count ?? 0}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Schedule Panel ───────────────────────────────────────────────────────────
function SchedulePanel({ progress, activeChild, invoice, onFeesClick, token, notifications, announcements }: {
  progress: ProgressData | null; activeChild: Child | null;
  invoice: any; onFeesClick: () => void; token: string;
  notifications: Notification[]; announcements: Announcement[];
}) {
  const pct = progress?.coverage_pct ?? 0;
  const today = new Date();
  const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const todayDow = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((todayDow + 6) % 7));
  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  });

  const [weekSchedule, setWeekSchedule] = useState<Record<string, string[]>>({});
  const [drawerDay, setDrawerDay] = useState<{ date: string; label: string; topics: string[]; isToday: boolean } | null>(null);

  useEffect(() => {
    if (!activeChild?.id || !token) return;
    apiGet<{ week_start: string; days: Record<string, string[]> }>(
      `/api/v1/parent/child/${activeChild.id}/week-schedule`, token
    ).then(d => setWeekSchedule(d.days ?? {})).catch(() => {});
  }, [activeChild?.id]);

  function openDay(d: Date, i: number) {
    const dateStr = d.toISOString().split('T')[0];
    const topics = weekSchedule[dateStr] ?? [];
    const isToday = d.toDateString() === today.toDateString();
    const label = `${weekDays[i]} ${d.getDate()} ${d.toLocaleDateString('en-IN', { month: 'short' })}`;
    setDrawerDay({ date: dateStr, label, topics, isToday });
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
              const isToday = d.toDateString() === today.toDateString();
              const dateStr = d.toISOString().split('T')[0];
              const topics = weekSchedule[dateStr] ?? [];
              const hasTopics = topics.length > 0;
              return (
                <button key={i} onClick={() => openDay(d, i)}
                  className={`w-full flex items-center justify-between py-2 px-2.5 rounded-xl transition-all text-left group ${isToday ? 'bg-emerald-50 border border-emerald-100' : 'hover:bg-gray-50'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-gray-400">{weekDays[i]}</p>
                    <p className={`text-sm font-semibold ${isToday ? 'text-emerald-700' : 'text-gray-700'}`}>
                      {d.getDate()} {d.toLocaleDateString('en-IN', { month: 'short' })}
                    </p>
                    {hasTopics && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{topics[0]}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                    {hasTopics && (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
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
        <button className="w-full flex items-center justify-between px-3 py-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-100 transition-all shadow-sm">
          <div className="flex items-center gap-2">
            <Star size={15} className="text-amber-500 fill-amber-400" />
            <span className="text-sm font-semibold text-amber-700">Premium Features</span>
          </div>
          <ArrowRight size={13} className="text-amber-400" />
        </button>

        {/* Weekly Updates */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={15} className="text-gray-500" />
            <p className="text-sm font-bold text-gray-800">Weekly Updates</p>
          </div>
          {announcements.length === 0 && notifications.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No updates this week</p>
          ) : (
            <div className="space-y-2.5">
              {announcements.slice(0, 2).map(a => (
                <div key={a.id} className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{a.title}</p>
                    <p className="text-[11px] text-gray-500 line-clamp-2">{a.body}</p>
                  </div>
                </div>
              ))}
              {notifications.slice(0, 2).map(n => (
                <div key={n.id} className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{n.section_name}</p>
                    <p className="text-[11px] text-gray-500">{n.chunks_covered} topics · {n.completion_date.split('T')[0]}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fees Due */}
        {invoice && invoice.net_payable > 0 && (
          <div className="bg-orange-50 rounded-2xl border border-orange-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard size={15} className="text-orange-500" />
              <p className="text-sm font-bold text-orange-800">Fees Due</p>
            </div>
            <p className="text-2xl font-black text-orange-700 mb-1">₹{invoice.net_payable.toLocaleString('en-IN')}</p>
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

// ─── Day Plan Drawer ──────────────────────────────────────────────────────────
function DayPlanDrawer({ day, activeChild, token, onClose }: {
  day: { date: string; label: string; topics: string[]; isToday: boolean };
  activeChild: Child | null;
  token: string;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const isPast = day.date < today;

  useEffect(() => {
    if (day.topics.length === 0) return;
    const cacheKey = `topic-summary:${activeChild?.id}:${day.date}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { ts, text } = JSON.parse(cached);
        if (ts === today) { setSummary(text); return; }
      } catch {}
    }
    setLoading(true);
    const params = new URLSearchParams({
      topics: day.topics.join(','),
      class_name: activeChild?.class_name ?? 'Nursery',
      child_name: activeChild?.name?.split(' ')[0] ?? 'your child',
      completed: String(isPast),
    });
    apiGet<{ summary: string }>(`/api/v1/ai/topic-summary?${params}`, token)
      .then(d => {
        setSummary(d.summary);
        localStorage.setItem(cacheKey, JSON.stringify({ ts: today, text: d.summary }));
      })
      .catch(() => setSummary(day.topics.join(' · ')))
      .finally(() => setLoading(false));
  }, [day.date]);

  return (
    <div className="fixed inset-0 z-[100] flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative z-10 bg-white ml-auto w-full xl:w-80 h-full overflow-y-auto shadow-2xl border-l border-gray-100" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-5 py-4 border-b border-gray-100 flex items-center justify-between ${day.isToday ? 'bg-emerald-50' : 'bg-gray-50'}`}>
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest ${day.isToday ? 'text-emerald-600' : 'text-gray-400'}`}>
              {day.isToday ? 'Today' : isPast ? 'Past' : 'Upcoming'}
            </p>
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
              <div className={`rounded-2xl p-4 ${day.isToday ? 'bg-emerald-50 border border-emerald-100' : isPast ? 'bg-blue-50 border border-blue-100' : 'bg-amber-50 border border-amber-100'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className={day.isToday ? 'text-emerald-600' : isPast ? 'text-blue-600' : 'text-amber-600'} />
                  <p className={`text-xs font-bold uppercase tracking-wide ${day.isToday ? 'text-emerald-700' : isPast ? 'text-blue-700' : 'text-amber-700'}`}>
                    {isPast ? 'What was covered' : 'What will be covered'}
                  </p>
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 py-1">
                    <Loader2 size={14} className="animate-spin text-gray-400" />
                    <p className="text-xs text-gray-400">Generating summary…</p>
                  </div>
                ) : (
                  <p className={`text-sm leading-relaxed ${day.isToday ? 'text-emerald-800' : isPast ? 'text-blue-800' : 'text-amber-800'}`}>
                    {summary}
                  </p>
                )}
              </div>

              {/* Topic list */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                  {day.topics.length} Topic{day.topics.length > 1 ? 's' : ''}
                </p>
                <div className="space-y-2">
                  {day.topics.map((topic, i) => (
                    <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        {isPast
                          ? <CheckCircle2 size={14} className="text-emerald-500" />
                          : <span className="text-[10px] font-bold text-gray-400 bg-gray-200 w-5 h-5 rounded-full flex items-center justify-center">{i + 1}</span>
                        }
                      </span>
                      <p className="text-sm text-gray-700 leading-snug">{topic}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function CalendarTab({ events }: { events: CalendarEvent[] }) {
  const today = new Date();
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Calendar</h2>
      {events.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm">
          <Calendar size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No upcoming events</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(e => (
            <div key={e.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                  e.type === 'exam' ? 'bg-red-50' : e.type === 'homework' ? 'bg-amber-50' : e.type === 'meeting' ? 'bg-blue-50' : 'bg-emerald-50'
                }`}>
                  {e.type === 'exam' ? <ClipboardList size={18} className="text-red-500" /> : e.type === 'homework' ? <BookOpen size={18} className="text-amber-500" /> : e.type === 'meeting' ? <User size={18} className="text-blue-500" /> : <CalendarDays size={18} className="text-emerald-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">{e.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{e.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(e.start).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Assignments Tab ──────────────────────────────────────────────────────────
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
            const dateStr = rawDate ? new Date(rawDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
            const statusConfig = {
              completed: { label: '✓ Done', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
              partial: { label: '½ Partial', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
              not_submitted: { label: '✗ Not submitted', cls: 'bg-red-50 text-red-600 border-red-100' },
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

// ─── Fees Tab ─────────────────────────────────────────────────────────────────
function FeesTab({ invoice, activeChild, token }: { invoice: any; activeChild: Child | null; token: string }) {
  if (!invoice) return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Fees</h2>
      <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm">
        <CreditCard size={40} className="text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No fee information available</p>
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Fees</h2>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500">Total Due</p>
            <p className="text-3xl font-black text-gray-900">₹{invoice.net_payable?.toLocaleString('en-IN') ?? 0}</p>
          </div>
          {invoice.credit_balance > 0 && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Credit Balance</p>
              <p className="text-lg font-bold text-emerald-600">₹{invoice.credit_balance.toLocaleString('en-IN')}</p>
            </div>
          )}
        </div>
        {invoice.accounts?.length > 0 && (
          <div className="space-y-2">
            {invoice.accounts.map((acc: any) => (
              <div key={acc.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{acc.fee_head_name}</p>
                  {acc.due_date && <p className="text-xs text-gray-400">Due {new Date(acc.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">₹{acc.outstanding_balance?.toLocaleString('en-IN')}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${acc.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{acc.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {invoice.net_payable > 0 && (
          <button className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
            Pay Now <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
function ReportsTab({ attendance, progress, activeChild }: { attendance: AttendanceData | null; progress: ProgressData | null; activeChild: Child | null }) {
  const attPct = attendance?.attendance_pct ?? 0;
  const pct = progress?.coverage_pct ?? 0;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Reports</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className={`${attPct >= 75 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} border rounded-2xl p-4`}>
          <p className="text-xs text-gray-500 mb-1">Attendance</p>
          <p className={`text-3xl font-black ${attPct >= 75 ? 'text-emerald-700' : 'text-red-600'}`}>{attPct}%</p>
          <p className="text-xs text-gray-400 mt-1">{attendance?.stats.present ?? 0} present · {attendance?.stats.absent ?? 0} absent</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">Curriculum</p>
          <p className="text-3xl font-black text-blue-700">{pct.toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">{progress?.covered ?? 0} of {progress?.total_chunks ?? 0} topics</p>
        </div>
      </div>
      {activeChild && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3">📊 Full Report Card</p>
          <a href={`/parent/journey?student_id=${activeChild.id}`}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors">
            <BookOpen size={14} /> View Child&apos;s Journey
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────
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
      case 'completed': return <CheckCircle2 size={12} className="text-green-600" />;
      case 'in_progress': return <RefreshCw size={12} className="text-blue-600" />;
      case 'overdue': return <AlertCircle size={12} className="text-red-600" />;
      default: return <Clock size={12} className="text-neutral-400" />;
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
                      const mapped = { id: created.id, name: created.name, relation: created.relationship || created.relation || '', phone: created.phone, priority: (created.is_primary ? 1 : 2) as 1 | 2 | 3, available: true };
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
                          const mapped = { id: updated.id, name: updated.name, relation: updated.relationship || updated.relation || '', phone: updated.phone, priority: (updated.is_primary ? 1 : 2) as 1 | 2 | 3, available: true };
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

      {/* Calendar Section — Paid Feature */}
      {activeSection === 'calendar' && (
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <CalendarDays className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-neutral-800">Calendar Integration</h2>
            <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">✨ Premium</span>
          </div>
          <p className="text-sm text-neutral-500 mb-6">Sync school events, homework deadlines and reminders directly to your calendar.</p>

          <div className="rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/50 p-6 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center text-3xl">📅</div>
            <p className="font-bold text-neutral-800 text-base">Smart Calendar Sync</p>
            <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">
              Automatically add homework due dates, school events and parent-teacher meetings to Google Calendar or Apple Calendar.
            </p>

            {/* Feature list */}
            <div className="w-full space-y-2 my-1">
              {[
                { icon: '📆', label: 'Google Calendar & Apple Calendar sync' },
                { icon: '🤖', label: 'Oakie AI reminders — smart nudges before deadlines' },
                { icon: '🔔', label: 'Never miss a homework due date or school event' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3 bg-white border border-purple-100 rounded-xl px-4 py-2.5 text-left">
                  <span className="text-lg shrink-0">{f.icon}</span>
                  <span className="text-sm text-neutral-700">{f.label}</span>
                </div>
              ))}
            </div>

            <div className="w-full bg-white border border-purple-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-neutral-600 mb-1">Coming soon — Subscription required</p>
              <p className="text-xs text-neutral-400">Payment integration is being set up. You'll be notified when this feature is available for purchase.</p>
            </div>
            <button disabled className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm opacity-50 cursor-not-allowed flex items-center justify-center gap-2">
              <CalendarDays size={16} /> Unlock Calendar Sync — Coming Soon
            </button>
          </div>
        </div>
      )}

      {/* Translation Section — Paid Feature */}
      {activeSection === 'translation' && (
        <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-neutral-800">Translation</h2>
            <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">✨ Premium</span>
          </div>
          <p className="text-sm text-neutral-500 mb-6">Translate the parent portal into your local language — Hindi, Telugu, Tamil, Kannada and more.</p>

          {/* Paid feature gate */}
          <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-6 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-3xl">🌐</div>
            <p className="font-bold text-neutral-800 text-base">Multilingual Support</p>
            <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">
              Read homework, updates, and announcements in your preferred language. Supports 10 Indian languages.
            </p>
            <div className="flex flex-wrap justify-center gap-2 my-1">
              {['हिंदी', 'తెలుగు', 'தமிழ்', 'ಕನ್ನಡ', 'മലയാളം', 'ગુજરાતી', 'বাংলা', 'मराठी'].map(lang => (
                <span key={lang} className="text-xs px-2.5 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700 font-medium">{lang}</span>
              ))}
            </div>
            <div className="w-full bg-white border border-indigo-200 rounded-xl p-4 mt-1">
              <p className="text-xs font-semibold text-neutral-600 mb-1">Coming soon — Subscription required</p>
              <p className="text-xs text-neutral-400">Payment integration is being set up. You'll be notified when this feature is available for purchase.</p>
            </div>
            <button disabled className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm opacity-50 cursor-not-allowed flex items-center justify-center gap-2">
              <Zap size={16} /> Unlock Translation — Coming Soon
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

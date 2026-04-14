'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Card, Badge } from '@/UIComponents';
import { OakieMessageText } from '@/UIComponents/teacher/OakieMessage';
import { RawPlanModal } from '@/UIComponents/teacher/RawPlanModal';
import { TopicsChecklist } from '@/UIComponents/teacher/TopicsChecklist';
import PendingWorkList from '@/components/ui/PendingWorkList';
import OakitLogo from '@/components/OakitLogo';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import {
  CalendarDays, MessageCircle, HelpCircle, Flame, CheckCircle2,
  ChevronDown, ChevronUp, Send, Paperclip, BookOpen, Sparkles,
  LogOut, Clock, AlertCircle, ArrowRight, FileText, Users
} from 'lucide-react';

interface Chunk { id: string; topic_label: string; content: string; activity_ids: string[]; page_start: number; }
interface SupplementaryActivity { plan_id: string; pool_name: string; activity_title: string; activity_description: string; status: string; }
interface DayPlan { plan_date: string; status: string; chunks: Chunk[]; special_label?: string; admin_note?: string; chunk_label_overrides?: Record<string, string>; supplementary_activities?: SupplementaryActivity[]; }
interface Message {
  role: 'user' | 'assistant';
  text: string;
  chunk_ids?: string[];
  covered_chunk_ids?: string[];
  activity_ids?: string[];
  completion_date?: string;
  settling_gate?: boolean;
  gate_date?: string;
  is_settling?: boolean;
  settling_day?: number;
  settling_total?: number;
  already_completed?: boolean;
  question_limit_reached?: boolean;
}
interface PendingDay { plan_date: string; chunks: { id: string; topic_label: string }[]; }

type Tab = 'plan' | 'chat' | 'help';

interface SubjectCheckbox {
  actId: string;
  chunkId: string;
  label: string;
  alreadyDone: boolean;
  checked: boolean;
  onToggle: () => void;
}

// AiMessageText is the local version that supports inline subject checkboxes.
// For simple rendering without checkboxes, OakieMessageText from UIComponents is used.
function AiMessageText({ text, subjectCheckboxes }: { text: string; subjectCheckboxes?: SubjectCheckbox[] }) {
  // If no checkboxes needed, delegate to the UIComponents version
  if (!subjectCheckboxes || subjectCheckboxes.length === 0) {
    return <OakieMessageText text={text} />;
  }
  const lines = text.split('\n');
  return (
    <div className="flex flex-col gap-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        // Section heading: emoji at start + text (but not 💡 tip lines)
        const emojiHeadingMatch = trimmed.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*(.+)/u);
        const isHeading = emojiHeadingMatch && !trimmed.startsWith('💡') && !trimmed.startsWith('☕') && !trimmed.startsWith('⚠') && !trimmed.startsWith('🚨');

        if (isHeading) {
          const emoji = emojiHeadingMatch[1];
          const subjectName = emojiHeadingMatch[2].trim();
          const checkbox = subjectCheckboxes?.find(s =>
            s.label.toLowerCase() === subjectName.toLowerCase() ||
            subjectName.toLowerCase().includes(s.label.toLowerCase()) ||
            s.label.toLowerCase().includes(subjectName.toLowerCase())
          );
          return (
            <div key={i} className={`flex items-center justify-between gap-2 mt-3 first:mt-0 rounded-xl px-3 py-2.5 ${
              checkbox?.alreadyDone ? 'bg-emerald-50 border border-emerald-200' :
              checkbox?.checked ? 'bg-primary-50 border border-primary-200' :
              'bg-primary-50/60 border border-primary-100'
            }`}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-base shrink-0">{emoji}</span>
                <span className="font-semibold text-primary-700 text-sm truncate">{subjectName}</span>
                {checkbox?.alreadyDone && <span className="text-emerald-500 text-xs shrink-0 font-medium">✓ Done</span>}
              </div>
              {checkbox && !checkbox.alreadyDone && (
                <input type="checkbox" checked={checkbox.checked} onChange={checkbox.onToggle}
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary shrink-0 cursor-pointer" />
              )}
              {checkbox?.alreadyDone && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
            </div>
          );
        }

        if (trimmed.startsWith('💡')) {
          return (
            <div key={i} className="flex items-start gap-2 mt-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <span className="text-base shrink-0">💡</span>
              <span className="text-xs text-amber-800">{trimmed.replace(/^💡\s*/, '')}</span>
            </div>
          );
        }
        if (trimmed.startsWith('☕')) {
          return (
            <div key={i} className="flex items-center gap-2 my-1">
              <div className="flex-1 h-px bg-neutral-100" />
              <span className="text-xs text-neutral-400">☕ Break</span>
              <div className="flex-1 h-px bg-neutral-100" />
            </div>
          );
        }
        if (trimmed.startsWith('⚠️') || trimmed.startsWith('🚨')) {
          return (
            <div key={i} className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span className="text-xs text-red-700 font-medium">{trimmed.replace(/^[⚠️🚨]\s*/u, '')}</span>
            </div>
          );
        }
        const labelMatch = trimmed.match(/^(What to do|Ask children|Tip|Objective|Materials|Note|✅ Offline Support|Resources):\s*(.*)/i);
        if (labelMatch) {
          return (
            <div key={i} className="flex items-start gap-1.5 pl-3">
              <span className="text-xs font-semibold text-neutral-500 shrink-0 mt-0.5 min-w-[90px]">{labelMatch[1]}:</span>
              <span className="text-xs text-neutral-700">{labelMatch[2]}</span>
            </div>
          );
        }
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={i} className="flex items-start gap-2 pl-3">
              <span className="text-xs font-bold text-primary-400 shrink-0 w-4 mt-0.5">{numMatch[1]}.</span>
              <span className="text-xs text-neutral-700">{numMatch[2]}</span>
            </div>
          );
        }
        if (trimmed.startsWith('·') || trimmed.startsWith('•') || trimmed.startsWith('- ')) {
          return (
            <div key={i} className="flex items-start gap-2 pl-3">
              <span className="text-primary-300 shrink-0 mt-0.5 text-xs">•</span>
              <span className="text-xs text-neutral-700">{trimmed.replace(/^[·•\-]\s*/, '')}</span>
            </div>
          );
        }
        if (trimmed.startsWith('---')) return <hr key={i} className="border-neutral-100 my-1" />;
        const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
        if (parts.some(p => p.startsWith('**'))) {
          return (
            <p key={i} className="text-xs text-neutral-700">
              {parts.map((p, j) => p.startsWith('**') && p.endsWith('**')
                ? <strong key={j} className="font-semibold text-neutral-800">{p.slice(2, -2)}</strong>
                : <span key={j}>{p}</span>)}
            </p>
          );
        }
        return <p key={i} className="text-xs text-neutral-700">{trimmed}</p>;
      })}
    </div>
  );
}

function extractSubjects(chunks: Chunk[]): string[] {
  const subjects = new Set<string>();
  const pat = /^(English Speaking|English|Math(?:ematics)?|GK|General Knowledge|Writing|Art|Music|PE|Science|EVS|Hindi|Regional Language|Additional activities|Circle time|Morning meet)/im;
  for (const chunk of chunks) {
    for (const line of chunk.content.split('\n')) { const m = line.match(pat); if (m) subjects.add(m[1].trim()); }
    if (chunk.topic_label) { const m = chunk.topic_label.match(pat); if (m) subjects.add(m[1].trim()); }
  }
  return Array.from(subjects).slice(0, 6);
}

function getHelpButtons(subjects: string[]) {
  const iconMap: Record<string, string> = {
    'english speaking': '🗣️', 'english': '📖', 'math': '🔢', 'mathematics': '🔢',
    'gk': '🌍', 'general knowledge': '🌍', 'writing': '✏️', 'art': '🎨',
    'circle time': '⭕', 'morning meet': '⭕', 'regional language': '🗺️',
    'additional activities': '🎯', 'science': '🔬', 'evs': '🌿',
  };
  return subjects.map(s => ({ label: s, icon: iconMap[s.toLowerCase()] || '📌', question: `how do I conduct ${s.toLowerCase()} today` }));
}

export default function TeacherPlanner() {
  const router = useRouter();
  const token = getToken() || '';
  const [today, setToday] = useState(new Date().toISOString().split('T')[0]);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [sectionId, setSectionId] = useState('');
  const [pendingWork, setPendingWork] = useState<PendingDay[]>([]);
  const [selectedChunks, setSelectedChunks] = useState<string[]>([]);
  const [submittingCompletion, setSubmittingCompletion] = useState(false);
  const [completionMsg, setCompletionMsg] = useState('');
  const [attendancePrompt, setAttendancePrompt] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [tomorrowPlan, setTomorrowPlan] = useState<DayPlan | null>(null);
  const [completedSettlingDates, setCompletedSettlingDates] = useState<Set<string>>(new Set());
  const [inlineChecked, setInlineChecked] = useState<Record<string, Set<string>>>({});
  const [inlineSubmitting, setInlineSubmitting] = useState<string | null>(null);
  const [inlineMsg, setInlineMsg] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  // Homework & notes state
  const [homeworkText, setHomeworkText] = useState('');
  const [savingHomework, setSavingHomework] = useState(false);
  const [homeworkMsg, setHomeworkMsg] = useState('');
  const [existingHomework, setExistingHomework] = useState<{ raw_text: string; formatted_text: string } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [noteMsg, setNoteMsg] = useState('');
  const [notes, setNotes] = useState<{ id: string; note_text?: string; file_name?: string; file_size?: number; expires_at: string }[]>([]);
  const [showHomeworkPanel, setShowHomeworkPanel] = useState(false);
  const [showTopicsPanel, setShowTopicsPanel] = useState(false);
  const [showCompletionNotice, setShowCompletionNotice] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [planViewMode, setPlanViewMode] = useState<'raw' | 'detailed'>('raw');
  const [detailedPlanText, setDetailedPlanText] = useState<string | null>(null);
  const [fetchingDetailedPlan, setFetchingDetailedPlan] = useState(false);
  const [showRawPlanModal, setShowRawPlanModal] = useState(false);
  const [oakiePlanText, setOakiePlanText] = useState<string | null>(null);
  // Homework submission tracking state
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [hwSubmissions, setHwSubmissions] = useState<Record<string, 'completed' | 'partial' | 'not_submitted'>>({});
  const [savingHwSubmissions, setSavingHwSubmissions] = useState(false);
  const [hwSubmissionsMsg, setHwSubmissionsMsg] = useState('');
  const [existingHwSubmissions, setExistingHwSubmissions] = useState<{ student_id: string; student_name: string; status: string }[]>([]);
  const [streak, setStreak] = useState<{ current_streak: number; best_streak: number; badge: string | null } | null>(null);
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);
  const [showStreakInfo, setShowStreakInfo] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);
  const todayCompletedRef = useRef(false);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadAll();
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadAll() {
    const effectiveToday = await loadContext();
    await Promise.all([loadPlan(effectiveToday), loadPending(), loadHomeworkAndNotes(), loadStreak()]);
    if (!todayCompletedRef.current) await autoShowDailyPlan(effectiveToday);
  }

  async function loadStreak() {
    try {
      const data = await apiGet<any>('/api/v1/teacher/streaks/me', token);
      setStreak(data);
    } catch { /* non-critical */ }
  }

  async function autoShowDailyPlan(effectiveToday: string) {
    try {
      setAiLoading(true);
      const res = await apiPost<any>('/api/v1/ai/query', { text: "what is my plan for today" }, token);
      // Capture the plan text for PDF export (only the plan response, not chat messages)
      if (res.response && res.chunk_ids?.length > 0) {
        setOakiePlanText(res.response);
      }
      setMessages(prev => [...prev, {
        role: 'assistant', text: res.response,
        chunk_ids: res.chunk_ids, covered_chunk_ids: res.covered_chunk_ids,
        activity_ids: res.activity_ids, completion_date: res.plan_date || effectiveToday,
        settling_gate: res.settling_gate, gate_date: res.gate_date,
        is_settling: res.is_settling, settling_day: res.settling_day,
        settling_total: res.settling_total, already_completed: res.already_completed,
      }]);
    } catch { /* ignore */ } finally { setAiLoading(false); }
  }

  async function loadContext(): Promise<string> {
    try {
      const data = await apiGet<any>('/api/v1/teacher/context', token);
      setAttendancePrompt(data.attendance_prompt);
      setGreeting(data.greeting);
      setTodayCompleted(data.today_completed || false);
      todayCompletedRef.current = data.today_completed || false;
      setTomorrowPlan(data.tomorrow_plan || null);
      const effectiveToday = data.today || new Date().toISOString().split('T')[0];
      setToday(effectiveToday);
      setMessages([{ role: 'assistant', text: `💡 ${data.thought_for_day}` }]);
      return effectiveToday;
    } catch {
      setMessages([{ role: 'assistant', text: "Hi! Ask me about today's plan or any classroom situation." }]);
      return new Date().toISOString().split('T')[0];
    }
  }

  async function loadPlan(effectiveToday?: string) {
    try {
      const data = await apiGet<DayPlan & { section_id?: string }>('/api/v1/teacher/plan/today', token);
      setPlan(data);
      if (data.section_id) setSectionId(data.section_id);
    } catch { /* ignore */ }
  }

  async function loadPending() {
    try { setPendingWork(await apiGet<PendingDay[]>('/api/v1/teacher/completion/pending', token)); } catch { /* ignore */ }
  }

  async function loadHomeworkAndNotes() {
    try {
      const [hw, ns] = await Promise.all([
        apiGet<any>(`/api/v1/teacher/notes/homework`, token).catch(() => null),
        apiGet<any[]>(`/api/v1/teacher/notes`, token).catch(() => []),
      ]);
      if (hw) { setExistingHomework(hw); setHomeworkText(hw.raw_text || ''); }
      setNotes(ns || []);
    } catch { /* ignore */ }
  }

  async function loadStudents() {
    try {
      if (!sectionId) return;
      const data = await apiGet<{ id: string; name: string }[]>(`/api/v1/teacher/sections/${sectionId}/students`, token);
      setStudents(data || []);
    } catch { /* ignore */ }
  }

  async function loadHwSubmissions(date?: string) {
    try {
      const d = date || today;
      const data = await apiGet<{ student_id: string; student_name: string; status: string }[]>(
        `/api/v1/teacher/notes/homework/submissions?date=${d}`, token
      );
      setExistingHwSubmissions(data || []);
      // Pre-fill the submission state
      const map: Record<string, 'completed' | 'partial' | 'not_submitted'> = {};
      (data || []).forEach(s => { map[s.student_id] = s.status as any; });
      setHwSubmissions(map);
    } catch { /* ignore */ }
  }

  function toggleChunk(chunkId: string) {
    setSelectedChunks(prev => prev.includes(chunkId) ? prev.filter(id => id !== chunkId) : [...prev, chunkId]);
  }

  async function submitCompletion() {
    if (selectedChunks.length === 0) return;
    setSubmittingCompletion(true);
    try {
      await apiPost('/api/v1/teacher/completion', { covered_chunk_ids: selectedChunks, ...(sectionId ? { section_id: sectionId } : {}) }, token);
      setCompletionMsg(`✅ ${selectedChunks.length} topic${selectedChunks.length > 1 ? 's' : ''} marked as covered.`);
      setSelectedChunks([]);
      await loadPending();
    } catch (err: unknown) { setCompletionMsg(err instanceof Error ? err.message : 'Failed'); }
    finally { setSubmittingCompletion(false); }
  }

  async function askSuggested(question: string) {
    if (aiLoading) return;
    setActiveTab('chat');
    setMessages(m => [...m, { role: 'user', text: question }]);
    setAiLoading(true);
    try {
      const res = await apiPost<any>('/api/v1/ai/query', { text: question }, token);
      setMessages(m => [...m, {
        role: 'assistant', text: res.response,
        chunk_ids: res.chunk_ids, covered_chunk_ids: res.covered_chunk_ids,
        activity_ids: res.activity_ids, completion_date: res.plan_date || today,
        settling_gate: res.settling_gate, gate_date: res.gate_date,
        is_settling: res.is_settling, settling_day: res.settling_day,
        settling_total: res.settling_total, already_completed: res.already_completed,
        question_limit_reached: res.question_limit_reached,
      }]);
      // Sync completion to DB if Oakie confirmed it
      if (res.already_completed || (res.covered_chunk_ids && res.covered_chunk_ids.length > 0 && plan?.chunks)) {
        const allChunkIds = plan?.chunks?.map((c: any) => c.id) || [];
        const coveredIds: string[] = res.covered_chunk_ids || [];
        const allCovered = allChunkIds.length > 0 && allChunkIds.every((id: string) => coveredIds.includes(id));
        if ((allCovered || res.already_completed) && !res.already_completed && allChunkIds.length > 0) {
          try {
            await apiPost('/api/v1/teacher/completion', {
              covered_chunk_ids: allChunkIds,
              completion_date: res.plan_date || today,
              ...(sectionId ? { section_id: sectionId } : {}),
            }, token);
            try { await apiPost('/api/v1/ai/reset-limit', {}, token); } catch { /* ignore */ }
          } catch { /* ignore */ }
          const allSubjectKeys: string[] = [];
          (plan?.chunks || []).forEach((chunk: any) => {
            const subjects = extractSubjects([chunk]);
            if (subjects.length > 0) subjects.forEach(s => allSubjectKeys.push(`${chunk.id}:${s}`));
            else allSubjectKeys.push(chunk.id);
          });
          setSelectedChunks(allSubjectKeys);
          setTodayCompleted(true); todayCompletedRef.current = true;
          try { const ctx = await apiGet<any>('/api/v1/teacher/context', token); setTomorrowPlan(ctx.tomorrow_plan || null); } catch { /* ignore */ }
          await loadPending();
        }
      }
    } catch (e: unknown) {
      setMessages(m => [...m, { role: 'assistant', text: e instanceof Error ? e.message : 'Sorry, try again.' }]);
    } finally { setAiLoading(false); }
  }

  async function markSettlingComplete(date: string) {
    try {
      await apiPost('/api/v1/teacher/completion', {
        covered_chunk_ids: [], completion_date: date,
        settling_day_note: 'Settling day activities completed',
        ...(sectionId ? { section_id: sectionId } : {}),
      }, token);
      setTodayCompleted(true); todayCompletedRef.current = true;
      setCompletedSettlingDates(prev => new Set([...prev, date]));
      setMessages(m => [...m, { role: 'assistant', text: '✅ Today marked as completed\n\nParents have been notified. Well done! 💚', completion_date: date }]);
      try { await apiPost('/api/v1/ai/reset-limit', {}, token); } catch { /* ignore */ }
      await loadPending();
      try { const ctx = await apiGet<any>('/api/v1/teacher/context', token); setTomorrowPlan(ctx.tomorrow_plan || null); } catch { /* ignore */ }
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed to mark as completed'); }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || aiLoading) return;
    const userMsg = input.trim();
    if (userMsg.length > 200) return; // blocked by UI already
    setInput('');
    setMessages(m => [...m, { role: 'user', text: userMsg }]);
    setAiLoading(true);
    // No history — every question is independent
    try {
      const res = await apiPost<any>('/api/v1/ai/query', { text: userMsg }, token);
      setMessages(m => [...m, {
        role: 'assistant', text: res.response,
        chunk_ids: res.chunk_ids, covered_chunk_ids: res.covered_chunk_ids,
        activity_ids: res.activity_ids, completion_date: res.plan_date || today,
        question_limit_reached: res.question_limit_reached,
      }]);
      // If Oakie confirmed completion, sync the left panel AND persist to DB
      if (res.already_completed || (res.covered_chunk_ids && res.covered_chunk_ids.length > 0 && plan?.chunks)) {
        const allChunkIds = plan?.chunks?.map((c: any) => c.id) || [];
        const coveredIds: string[] = res.covered_chunk_ids || [];
        const allCovered = allChunkIds.length > 0 && allChunkIds.every((id: string) => coveredIds.includes(id));

        if (allCovered || res.already_completed) {
          // All done — persist to DB if not already saved
          if (!res.already_completed && allChunkIds.length > 0) {
            try {
              await apiPost('/api/v1/teacher/completion', {
                covered_chunk_ids: allChunkIds,
                completion_date: res.plan_date || today,
                ...(sectionId ? { section_id: sectionId } : {}),
              }, token);
              try { await apiPost('/api/v1/ai/reset-limit', {}, token); } catch { /* ignore */ }
            } catch { /* ignore — may already be saved */ }
          }
          // Tick everything in left panel
          const allSubjectKeys: string[] = [];
          (plan?.chunks || []).forEach((chunk: any) => {
            const subjects = extractSubjects([chunk]);
            if (subjects.length > 0) subjects.forEach(s => allSubjectKeys.push(`${chunk.id}:${s}`));
            else allSubjectKeys.push(chunk.id);
          });
          setSelectedChunks(allSubjectKeys);
          setTodayCompleted(true); todayCompletedRef.current = true;
          try { const ctx = await apiGet<any>('/api/v1/teacher/context', token); setTomorrowPlan(ctx.tomorrow_plan || null); } catch { /* ignore */ }
        } else if (coveredIds.length > 0) {
          // Partial — persist covered ones to DB
          try {
            await apiPost('/api/v1/teacher/completion', {
              covered_chunk_ids: coveredIds,
              completion_date: res.plan_date || today,
              ...(sectionId ? { section_id: sectionId } : {}),
            }, token);
          } catch { /* ignore */ }
          // Tick covered ones in left panel
          const coveredSubjectKeys: string[] = [];
          (plan?.chunks || []).forEach((chunk: any) => {
            if (coveredIds.includes(chunk.id)) {
              const subjects = extractSubjects([chunk]);
              if (subjects.length > 0) subjects.forEach(s => coveredSubjectKeys.push(`${chunk.id}:${s}`));
              else coveredSubjectKeys.push(chunk.id);
            }
          });
          setSelectedChunks(prev => [...new Set([...prev, ...coveredSubjectKeys])]);
        }
        await loadPending();
      }
    } catch (e: unknown) {
      setMessages(m => [...m, { role: 'assistant', text: e instanceof Error ? e.message : 'Sorry, try again.' }]);
    } finally { setAiLoading(false); }
  }

  function toggleInlineChunk(msgIdx: number, actId: string) {
    const key = String(msgIdx);
    setInlineChecked(prev => {
      const set = new Set(prev[key] || []);
      set.has(actId) ? set.delete(actId) : set.add(actId);
      return { ...prev, [key]: set };
    });
  }

  async function submitInlineCompletion(msgIdx: number, msg: Message) {
    const key = String(msgIdx);
    const checked = Array.from(inlineChecked[key] || []);
    if (checked.length === 0) return;
    const checkedChunkIds = [...new Set(checked.map(id => id.split(':')[0]))];
    const chunkSubjects: Record<string, string[]> = {};
    (msg.activity_ids || []).forEach(actId => {
      const cid = actId.split(':')[0];
      if (!chunkSubjects[cid]) chunkSubjects[cid] = [];
      chunkSubjects[cid].push(actId);
    });
    const fullyCovered = checkedChunkIds.filter(cid => (chunkSubjects[cid] || [cid]).every(a => checked.includes(a)));
    const coverageIds = Object.keys(chunkSubjects).length > 0 ? fullyCovered : checkedChunkIds;
    setInlineSubmitting(key);
    try {
      await apiPost('/api/v1/teacher/completion', {
        covered_chunk_ids: coverageIds, completion_date: msg.completion_date,
        ...(sectionId ? { section_id: sectionId } : {}),
      }, token);
      const pending = (msg.chunk_ids?.length || 0) - coverageIds.length;
      setInlineMsg(prev => ({ ...prev, [key]: pending > 0
        ? `✅ ${checked.length} done. ${pending} topic${pending > 1 ? 's' : ''} carry forward.`
        : '✅ All done! Parents notified.' }));
      setInlineChecked(prev => ({ ...prev, [key]: new Set() }));
      try { await apiPost('/api/v1/ai/reset-limit', {}, token); } catch { /* ignore */ }
      await loadPending();
      if (pending === 0) {
        // Mark all topics as done in the left panel too
        setTodayCompleted(true); todayCompletedRef.current = true;
        // Select all chunks in the left panel to show them as done
        if (plan?.chunks) {
          const allSubjectKeys: string[] = [];
          plan.chunks.forEach((chunk: any) => {
            const subjects = extractSubjects([chunk]);
            if (subjects.length > 0) {
              subjects.forEach(s => allSubjectKeys.push(`${chunk.id}:${s}`));
            } else {
              allSubjectKeys.push(chunk.id);
            }
          });
          setSelectedChunks(allSubjectKeys);
        }
        try { const ctx = await apiGet<any>('/api/v1/teacher/context', token); setTomorrowPlan(ctx.tomorrow_plan || null); } catch { /* ignore */ }
      } else if (coverageIds.length > 0 && plan?.chunks) {
        // Partial completion — tick the covered ones in the left panel
        const coveredSubjectKeys: string[] = [];
        plan.chunks.forEach((chunk: any) => {
          if (coverageIds.includes(chunk.id)) {
            const subjects = extractSubjects([chunk]);
            if (subjects.length > 0) {
              subjects.forEach(s => coveredSubjectKeys.push(`${chunk.id}:${s}`));
            } else {
              coveredSubjectKeys.push(chunk.id);
            }
          }
        });
        setSelectedChunks(prev => [...new Set([...prev, ...coveredSubjectKeys])]);
      }
    } catch (err: unknown) {
      setInlineMsg(prev => ({ ...prev, [key]: err instanceof Error ? err.message : 'Failed. Try again.' }));
    } finally { setInlineSubmitting(null); }
  }

  async function exportPdf(date: string, settlingText?: string) {
    setExporting(true);
    try {
      const params = new URLSearchParams({ date });
      if (settlingText) params.set('settling_text', settlingText);
      const res = await fetch(`${API_BASE}/api/v1/teacher/export/pdf?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `day-plan-${date}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Export failed'); }
    finally { setExporting(false); }
  }

  const limitReached = (() => {
    // Only block if the most recent assistant message is a limit-reached response
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    return !!(lastAssistant?.question_limit_reached);
  })();
  const dateLabel = new Date(today + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  // ── Plan Tab ──────────────────────────────────────────────────────────
  const planTabContent = (
      <div className="p-4 flex flex-col gap-3" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        {/* Attendance */}
        {attendancePrompt && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-amber-800">📋 Attendance not marked</p>
            <Button size="sm" onClick={() => router.push('/teacher/attendance')}>Mark</Button>
          </div>
        )}

        {/* Today completed */}
        {todayCompleted ? (
          <>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-800 mb-1">✅ Today's plan is done!</p>
              <p className="text-xs text-green-700 mb-3">Great work. Parents have been notified.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push('/teacher/homework')}
                  className="flex-1 py-2 text-xs bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  📝 Send Homework & Notes
                </button>
                <button
                  onClick={() => router.push('/teacher/journey')}
                  className="flex-1 py-2 text-xs border border-green-300 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-colors"
                >
                  📖 Child Journey
                </button>
              </div>
            </div>
            {tomorrowPlan && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-800 mb-2">🔮 Prepare for tomorrow</p>
                {tomorrowPlan.chunks?.length > 0 ? (
                  <>
                    {tomorrowPlan.chunks.slice(0, 4).map((c: any, i: number) => (
                      <p key={i} className="text-xs text-blue-700 mb-1">• {c.topic_label || `Topic ${i + 1}`}</p>
                    ))}
                    {tomorrowPlan.chunks.length > 4 && <p className="text-xs text-blue-500">+{tomorrowPlan.chunks.length - 4} more</p>}
                  </>
                ) : (
                  <p className="text-xs text-blue-700">
                    {tomorrowPlan.status === 'settling' ? `🌱 ${tomorrowPlan.special_label || 'Settling Day'}` :
                     tomorrowPlan.status === 'revision' ? `📚 Revision Day` :
                     tomorrowPlan.status === 'exam' ? `📝 Exam Day` :
                     `📅 ${tomorrowPlan.special_label || tomorrowPlan.status}`}
                  </p>
                )}
                <button onClick={() => askSuggested("what is my plan for tomorrow")}
                  className="mt-2 text-xs text-blue-700 font-medium flex items-center gap-1">
                  → Ask Oakie about tomorrow
                </button>
              </div>
            )}
          </>
        ) : plan?.chunks?.length ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-primary-500" />
                  Today's Plan
                </h2>
                {plan.status === 'carried_forward' && <span className="text-[10px] text-amber-600 font-medium">Topics carried forward</span>}
              </div>
            </div>

            {/* Admin note if present */}
            {plan.admin_note && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 flex items-start gap-2">
                <FileText className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">{plan.admin_note}</p>
              </div>
            )}

            {/* Today's Topics — UIComponents TopicsChecklist */}
            {(() => {
              const activities: { chunkId: string; label: string; subjectKey: string }[] = [];
              plan.chunks.forEach((chunk: any) => {
                const subjects = extractSubjects([chunk]);
                if (subjects.length > 0) {
                  subjects.forEach(s => activities.push({ chunkId: chunk.id, label: s, subjectKey: `${chunk.id}:${s}` }));
                } else {
                  activities.push({ chunkId: chunk.id, label: chunk.topic_label || 'Activity', subjectKey: chunk.id });
                }
              });
              const allKeys = activities.map(a => a.subjectKey);
              const allChecked = allKeys.length > 0 && allKeys.every(k => selectedChunks.includes(k));

              const handleSubmit = () => {
                const coveredChunkIds = [...new Set(allKeys.filter(k => selectedChunks.includes(k)).map(k => k.split(':')[0]))];
                const checkedCount = coveredChunkIds.length;
                const uncheckedCount = allKeys.length - checkedCount;
                setSubmittingCompletion(true);
                apiPost('/api/v1/teacher/completion', { covered_chunk_ids: coveredChunkIds, ...(sectionId ? { section_id: sectionId } : {}) }, token)
                  .then(() => {
                    setCompletionMsg(allChecked ? '✅ All done! Parents notified.' : `✅ ${checkedCount} done. ${uncheckedCount} topic${uncheckedCount > 1 ? 's' : ''} carried forward.`);
                    setSelectedChunks([]);
                    if (allChecked) {
                      setTodayCompleted(true); todayCompletedRef.current = true;
                      apiPost('/api/v1/ai/reset-limit', {}, token).catch(() => {});
                      apiGet<any>('/api/v1/teacher/context', token).then(ctx => setTomorrowPlan(ctx.tomorrow_plan || null)).catch(() => {});
                    }
                    loadPending();
                  })
                  .catch((e: unknown) => setCompletionMsg(e instanceof Error ? e.message : 'Failed'))
                  .finally(() => setSubmittingCompletion(false));
              };

              return (
                <TopicsChecklist
                  activities={activities}
                  selectedChunks={selectedChunks}
                  onToggle={toggleChunk}
                  onSelectAll={() => allChecked ? setSelectedChunks([]) : setSelectedChunks(allKeys)}
                  onSubmit={handleSubmit}
                  onAsk={label => { setActiveTab('chat'); askSuggested(`How do I conduct ${label} today?`); }}
                  onExportPdf={() => exportPdf(today)}
                  submitting={submittingCompletion}
                  exporting={exporting}
                  completionMsg={completionMsg}
                  open={showTopicsPanel}
                  onToggleOpen={() => setShowTopicsPanel(p => !p)}
                  chunkLabelOverrides={plan.chunk_label_overrides}
                  completed={todayCompleted}
                />
              );
            })()}

            {/* Quick help chips */}
            <div className="flex flex-col gap-1.5">
              {[
                { q: "a child is crying what do I do", label: "😢 Child is upset" },
                { q: "children are not listening", label: "🙋 Not listening" },
                { q: "am I on track with the curriculum", label: "📊 My progress" },
              ].map((item, i) => (
                <button key={i} onClick={() => { setActiveTab('chat'); askSuggested(item.q); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 active:bg-gray-50 text-left">
                  {item.label}
                </button>
              ))}
            </div>
          </>
        ) : plan?.status && !['no_plan', 'scheduled', 'carried_forward'].includes(plan.status) ? (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800 mb-3">
                {plan.status === 'settling' ? `🌱 ${plan.special_label || 'Settling Day'}` :
                 plan.status === 'revision' ? `📚 ${plan.special_label || 'Revision Day'}` :
                 plan.status === 'exam' ? `📝 ${plan.special_label || 'Exam Day'}` :
                 plan.status === 'event' ? `🎪 ${plan.special_label || 'Special Event'}` :
                 plan.status === 'holiday' ? `🎉 ${plan.special_label || 'Holiday'}` :
                 `📅 ${plan.special_label || plan.status}`}
              </p>
              <div className="flex flex-col gap-2">
                {[
                  { q: "how do I prepare children for today", label: "How to prepare?" },
                  { q: "what activities should I do today", label: "Activity ideas" },
                  { q: "a child is crying what do I do", label: "😢 Child is upset" },
                  { q: "children are not listening", label: "🙋 Not listening" },
                ].map((item, i) => (
                  <button key={i} onClick={() => askSuggested(item.q)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-blue-200 bg-white text-sm text-blue-700 active:bg-blue-50 transition-colors text-left">
                    → {item.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">No plan for today</p>
        )}

        {/* Homework & Notes — dedicated page link */}
        <button
          onClick={() => router.push('/teacher/homework')}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-neutral-200 rounded-2xl hover:bg-neutral-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-primary-500" />
            <div className="text-left">
              <p className="text-sm font-semibold text-neutral-800">Homework & Notes</p>
              <p className="text-xs text-neutral-400">Send homework, track completion, class notes</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-neutral-300" />
        </button>

        {false && (
          <div>

              {/* Completion notice — shown if today's activities not yet marked done */}
              {!todayCompleted && plan?.chunks?.length && showCompletionNotice && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1">⚠ Activities not yet marked as done</p>
                  <p className="text-xs text-amber-700 mb-3">Please mark today's activities as completed before sending homework or notes to parents. Partial completion is also fine.</p>
                  <div className="flex gap-2">
                <button onClick={() => setShowCompletionNotice(false)}
                  className="flex-1 py-2 text-xs border border-amber-300 rounded-lg text-amber-700 hover:bg-amber-100">
                  I'll complete later
                </button>
                <button onClick={() => { setShowHomeworkPanel(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="flex-1 py-2 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium">
                  Mark activities first
                </button>
                  </div>
                </div>
              )}
              {/* Homework */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1.5">📚 Today's Homework</p>
                <p className="text-xs text-gray-400 mb-2">Type the homework — Oakie will format it nicely for parents.</p>
                {existingHomework?.formatted_text && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-2">
                <p className="text-xs font-medium text-emerald-700 mb-1">✓ Sent to parents:</p>
                <p className="text-xs text-emerald-600 whitespace-pre-wrap">{existingHomework.formatted_text}</p>
                  </div>
                )}
                <textarea
                  value={homeworkText}
                  onChange={e => setHomeworkText(e.target.value)}
                  rows={3}
                  placeholder="e.g. Practice writing A-E, count objects at home up to 10, bring a leaf tomorrow"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/40 resize-none bg-white"
                />
                {homeworkMsg && <p className={`text-xs mt-1 ${homeworkMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{homeworkMsg}</p>}
                <Button size="sm" className="w-full mt-2" loading={savingHomework} disabled={!homeworkText.trim()}
                  onClick={async () => {
                setSavingHomework(true); setHomeworkMsg('');
                try {
                  const res = await apiPost<any>('/api/v1/teacher/notes/homework', {
                    raw_text: homeworkText, ...(sectionId ? { section_id: sectionId } : {}),
                  }, token);
                  setExistingHomework(res);
                  setHomeworkMsg('✓ Homework sent to parents');
                  // Load students for tracking if not loaded
                  if (students.length === 0) await loadStudents();
                  await loadHwSubmissions();
                } catch (e: unknown) { setHomeworkMsg(e instanceof Error ? e.message : 'Failed'); }
                finally { setSavingHomework(false); }
                  }}>
                  Send Homework to Parents
                </Button>
              </div>

              {/* Homework Completion Tracking */}
              {existingHomework && students.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-xs font-semibold text-gray-700 mb-1">✅ Homework Completion Tracking</p>
                  <p className="text-xs text-gray-400 mb-3">Mark each student's homework status. Parents can see this in their portal.</p>
                  <div className="flex flex-col gap-1.5">
                {students.map(student => {
                  const status = hwSubmissions[student.id] || 'not_submitted';
                  return (
                    <div key={student.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                      <span className="text-sm text-gray-700 truncate flex-1 mr-2">{student.name}</span>
                      <div className="flex gap-1 shrink-0">
                        {(['completed', 'partial', 'not_submitted'] as const).map(s => (
                          <button key={s} onClick={() => setHwSubmissions(prev => ({ ...prev, [student.id]: s }))}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                          status === s
                            ? s === 'completed' ? 'bg-emerald-500 text-white'
                              : s === 'partial' ? 'bg-amber-500 text-white'
                              : 'bg-red-400 text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {s === 'completed' ? '✓' : s === 'partial' ? '½' : '✗'}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Done</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Partial</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Not submitted</span>
                  </div>
                  {hwSubmissionsMsg && <p className={`text-xs mt-2 ${hwSubmissionsMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{hwSubmissionsMsg}</p>}
                  <Button size="sm" className="w-full mt-3" loading={savingHwSubmissions}
                disabled={Object.keys(hwSubmissions).length === 0}
                onClick={async () => {
                  setSavingHwSubmissions(true); setHwSubmissionsMsg('');
                  try {
                    const submissions = Object.entries(hwSubmissions).map(([student_id, status]) => ({ student_id, status }));
                    await apiPost('/api/v1/teacher/notes/homework/submissions', {
                      submissions, ...(sectionId ? { section_id: sectionId } : {}),
                    }, token);
                    setHwSubmissionsMsg('✓ Homework status saved');
                  } catch (e: unknown) { setHwSubmissionsMsg(e instanceof Error ? e.message : 'Failed'); }
                  finally { setSavingHwSubmissions(false); }
                }}>
                Save Homework Status
                  </Button>
                </div>
              )}

              {/* Notes */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-semibold text-gray-700 mb-1.5">📎 Class Notes</p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
                  <p className="text-xs text-amber-700">⚠ Notes are deleted after <strong>14 days</strong>. Please keep a local copy — parents will be notified to download before expiry.</p>
                </div>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  rows={2}
                  placeholder="Type a note for parents..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/40 resize-none bg-white mb-2"
                />
                <div className="flex items-center gap-2 mb-2">
                  <label className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl bg-white text-xs text-gray-600 cursor-pointer hover:bg-gray-50 flex-1">
                <span>📄 {noteFile ? noteFile.name : 'Attach PDF or Word file'}</span>
                <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
                  onChange={e => setNoteFile(e.target.files?.[0] || null)} />
                  </label>
                  {noteFile && <button onClick={() => setNoteFile(null)} className="text-xs text-red-400 hover:text-red-600">✕</button>}
                </div>
                {noteMsg && <p className={`text-xs mb-2 ${noteMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{noteMsg}</p>}
                <Button size="sm" className="w-full" loading={savingNote} disabled={!noteText.trim() && !noteFile}
                  onClick={async () => {
                setSavingNote(true); setNoteMsg('');
                try {
                  if (noteFile) {
                    const fd = new FormData();
                    fd.append('file', noteFile);
                    if (sectionId) fd.append('section_id', sectionId);
                    const res = await fetch(`${API_BASE}/api/v1/teacher/notes/upload`, {
                      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
                    });
                    if (!res.ok) throw new Error((await res.json()).error);
                  } else {
                    await apiPost('/api/v1/teacher/notes', { note_text: noteText, ...(sectionId ? { section_id: sectionId } : {}) }, token);
                  }
                  setNoteMsg('✓ Note sent to parents (expires in 14 days)');
                  setNoteText(''); setNoteFile(null);
                  loadHomeworkAndNotes();
                } catch (e: unknown) { setNoteMsg(e instanceof Error ? e.message : 'Failed'); }
                finally { setSavingNote(false); }
                  }}>
                  Send Note to Parents
                </Button>

                {/* Existing notes */}
                {notes.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5">
                <p className="text-xs font-medium text-gray-500">Sent notes:</p>
                {notes.map(n => {
                  const expiresIn = Math.ceil((new Date(n.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={n.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 truncate">{n.file_name || (n.note_text?.slice(0, 50) + (n.note_text && n.note_text.length > 50 ? '...' : ''))}</p>
                        <p className={`text-2xs ${expiresIn <= 3 ? 'text-red-500' : 'text-gray-400'}`}>Expires in {expiresIn} day{expiresIn !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  );
                })}
                  </div>
                )}
              </div>
          </div>
        )}

        {/* Child Journey quick link */}
        <button
          onClick={() => router.push('/teacher/journey')}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-neutral-200 rounded-2xl hover:bg-neutral-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-primary-500" />
            <div className="text-left">
              <p className="text-sm font-semibold text-neutral-800">Child Journey</p>
              <p className="text-xs text-neutral-400">Record daily highlights for students</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-neutral-300" />
        </button>

        {/* Pending work */}
        {pendingWork.length > 0 && (
          <div className="mt-2">
            <h2 className="text-sm font-semibold text-gray-800 mb-2">⏳ Pending from previous days</h2>
            <PendingWorkList items={pendingWork} selectedChunks={selectedChunks} onToggleChunk={toggleChunk} />
            {selectedChunks.length > 0 && (
              <div className="mt-2">
                {completionMsg && <p className="text-xs text-green-600 mb-2">{completionMsg}</p>}
                <Button size="sm" onClick={submitCompletion} loading={submittingCompletion} className="w-full">
                  Mark {selectedChunks.length} as Covered
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
  );

  // ── Chat Tab (Right Panel) ────────────────────────────────────────────
  const chatTabContent = (
      <>
        {/* Header bar with export buttons */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-white border-b border-neutral-100 gap-2">
          <span className="text-xs font-semibold text-neutral-600 truncate">{dateLabel}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Raw Plan popup */}
            <button
              onClick={() => setShowRawPlanModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Raw Plan
            </button>
            {/* Export Oakie's plan — appears after Oakie has responded with the plan */}
            {oakiePlanText && (
              <button
                onClick={() => exportPdf(today, oakiePlanText)}
                disabled={exporting}
                className="flex items-center gap-1 px-2.5 py-1.5 border border-primary-200 bg-primary-50 rounded-lg text-xs text-primary-700 hover:bg-primary-100 transition-colors disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5" />
                {exporting ? '…' : "↓ Oakie's Plan PDF"}
              </button>
            )}
          </div>
        </div>

        {/* Raw Plan Modal — from UIComponents */}
        <RawPlanModal
          open={showRawPlanModal}
          onClose={() => setShowRawPlanModal(false)}
          dateLabel={dateLabel}
          chunks={plan?.chunks || []}
          supplementaryActivities={plan?.supplementary_activities}
          exporting={exporting}
          onExportPdf={() => {
            const rawText = [
              ...(plan?.chunks || []).map((c: any) => `${c.topic_label || 'Topic'}\n${c.content || ''}`),
              ...(plan?.supplementary_activities || []).map((sa: any) => `🎵 ${sa.pool_name}: ${sa.activity_title}${sa.activity_description ? '\n' + sa.activity_description : ''}`),
            ].join('\n\n');
            exportPdf(today, rawText);
            setShowRawPlanModal(false);
          }}
        />

        {/* Oakie chat — normal chat, no toggle */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3 bg-neutral-50/50" style={{ paddingBottom: '8px' }}>
            <div className="flex-1" />
            {messages.map((msg, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mr-2 mt-1 self-start border border-primary-200/50">
                  <Sparkles className="w-3.5 h-3.5 text-primary-600" />
                </div>
              )}
              <div className={`max-w-[88%] rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-br-sm px-4 py-2.5 shadow-md shadow-primary-600/20'
                  : 'bg-white border border-neutral-200/60 text-neutral-800 rounded-bl-sm overflow-hidden shadow-sm'
              }`}>
                {msg.role === 'user' ? (
                  <span className="whitespace-pre-wrap text-sm">{msg.text}</span>
                ) : (
                  <div>
                    {/* "Oakie says" label with PDF download on the right */}
                    <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-primary-400" />
                        <span className="text-[10px] font-semibold text-primary-500 uppercase tracking-wide">Oakie says</span>
                      </div>
                      <button
                        onClick={() => exportPdf(today, msg.text)}
                        disabled={exporting}
                        className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-primary-600 transition-colors disabled:opacity-50"
                      >
                        <FileText className="w-3 h-3" />
                        PDF
                      </button>
                    </div>
                    {msg.is_settling && msg.settling_day && (
                      <div className="px-4 pt-3 pb-1">
                        <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                          🌱 Settling Day {msg.settling_day} of {msg.settling_total}
                        </span>
                      </div>
                    )}
                    <div className="px-4 py-3">
                      {(() => {
                        // Build subject checkboxes for inline rendering
                        const msgKey = String(i);
                        const isCompletable = !todayCompleted && !msg.is_settling && !msg.already_completed &&
                          msg.chunk_ids && msg.chunk_ids.length > 0 &&
                          msg.completion_date && msg.completion_date <= today;

                        if (!isCompletable) return <AiMessageText text={msg.text} />;

                        const subjectMap: SubjectCheckbox[] = [];
                        const seen = new Set<string>();
                        (msg.activity_ids || []).forEach(actId => {
                          if (seen.has(actId)) return; seen.add(actId);
                          const ci = actId.indexOf(':');
                          const chunkId = ci > -1 ? actId.slice(0, ci) : actId;
                          const rawLabel = ci > -1 ? actId.slice(ci + 1).trim() : '';
                          subjectMap.push({
                            actId, chunkId,
                            label: rawLabel || 'Activity',
                            alreadyDone: !!(msg.covered_chunk_ids?.includes(chunkId)),
                            checked: inlineChecked[msgKey]?.has(actId) || false,
                            onToggle: () => toggleInlineChunk(i, actId),
                          });
                        });
                        if (subjectMap.length === 0 || subjectMap.every(s => s.label === 'Activity')) {
                          subjectMap.length = 0;
                          msg.chunk_ids!.forEach((chunkId, ci) => {
                            if (seen.has(chunkId)) return; seen.add(chunkId);
                            subjectMap.push({
                              actId: chunkId, chunkId, label: `Topic ${ci + 1}`,
                              alreadyDone: !!(msg.covered_chunk_ids?.includes(chunkId)),
                              checked: inlineChecked[msgKey]?.has(chunkId) || false,
                              onToggle: () => toggleInlineChunk(i, chunkId),
                            });
                          });
                        }
                        return <AiMessageText text={msg.text} subjectCheckboxes={subjectMap} />;
                      })()}
                    </div>
                    {/* Settling gate */}
                    {msg.settling_gate && msg.gate_date && (
                      <div className="border-t border-amber-100 px-4 py-3 bg-amber-50">
                        <p className="text-xs text-amber-700 font-medium mb-2">
                          Mark {new Date(msg.gate_date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} as completed first
                        </p>
                        <Button size="sm" onClick={() => markSettlingComplete(msg.gate_date!)} className="w-full bg-amber-500 hover:bg-amber-600 text-white border-0">
                          ✓ Mark Previous Day as Completed
                        </Button>
                      </div>
                    )}
                    {/* Settling complete button — only for today or past */}
                    {msg.is_settling && !msg.settling_gate && !msg.already_completed &&
                     !completedSettlingDates.has(msg.completion_date || '') &&
                     msg.completion_date && msg.completion_date <= today && (
                      <div className="border-t border-green-100 px-4 py-3 bg-green-50/60">
                        <p className="text-xs text-green-700 mb-2">When you're done with today's settling activities:</p>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => markSettlingComplete(msg.completion_date || today)} className="flex-1 bg-green-600 hover:bg-green-700 text-white border-0">
                            ✓ Mark Today as Completed
                          </Button>
                          <button onClick={() => exportPdf(msg.completion_date || today, msg.text)} disabled={exporting}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 active:bg-gray-50 disabled:opacity-50">
                            ↓ PDF
                          </button>
                        </div>
                        {inlineMsg[String(i)] && <p className="text-xs text-green-600 mt-2">{inlineMsg[String(i)]}</p>}
                      </div>
                    )}
                    {/* Submit + export — removed from chat, completion is in Plan tab */}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {aiLoading && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mr-2 border border-primary-200/50">
                <Sparkles className="w-3.5 h-3.5 text-primary-600" />
              </div>
              <div className="bg-white border border-neutral-200/60 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2 shadow-sm">
                <span className="text-xs text-neutral-400 font-medium">Oakie is thinking</span>
                <span className="inline-flex gap-1">
                  {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 bg-primary-300 rounded-full animate-bounce-dot" style={{ animationDelay: `${d}ms` }} />)}
                </span>
              </div>
            </motion.div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input — always shown */}
        <div className="border-t border-neutral-100 bg-white px-3 pt-2" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
          {limitReached && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 font-medium">Mark activities as completed so Oakie can help more.</p>
            </div>
          )}
          {/* Subject chips — horizontal scroll */}
          {plan?.chunks?.length && !limitReached ? (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
              {getHelpButtons(extractSubjects(plan.chunks)).map((btn, i) => (
                <button key={i} type="button" onClick={() => setInput(`How do I conduct ${btn.label} today?`)}
                  className="flex items-center gap-1 px-3 py-2 rounded-full border border-primary/30 bg-white text-xs text-primary whitespace-nowrap shrink-0 active:bg-primary/5 min-h-[36px]">
                  {btn.icon} {btn.label}
                </button>
              ))}
              {[{ icon: '😢', label: 'Child crying' }, { icon: '🙋', label: 'Not listening' }].map((c, i) => (
                <button key={i} type="button" onClick={() => setInput(`What do I do if a child is ${c.label.toLowerCase()}?`)}
                  className="flex items-center gap-1 px-3 py-2 rounded-full border border-gray-200 bg-white text-xs text-gray-600 whitespace-nowrap shrink-0 active:bg-gray-50 min-h-[36px]">
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          ) : null}
          <form onSubmit={sendMessage} className="flex gap-2 items-center pb-2">
            <div className="flex-1 relative">
              <input
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:bg-gray-50 disabled:text-gray-400 bg-gray-50"
                placeholder={limitReached ? "Mark activities first so Oakie can help more…" : "Ask Oakie…"}
                value={input}
                onChange={e => {
                  if (e.target.value.length <= 200) setInput(e.target.value);
                }}
                disabled={limitReached}
                maxLength={200}
              />
              {input.length > 150 && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-2xs ${input.length >= 200 ? 'text-red-400' : 'text-gray-400'}`}>
                  {200 - input.length}
                </span>
              )}
            </div>
            <motion.button type="submit" disabled={limitReached || aiLoading || !input.trim()}
              whileTap={{ scale: 0.92 }}
              className="w-11 h-11 rounded-full bg-primary-600 text-white flex items-center justify-center shrink-0 disabled:opacity-40 transition-all shadow-md shadow-primary-600/30 hover:bg-primary-700">
              {aiLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </motion.button>
          </form>
        </div>
      </>
  );

  // ── Help Tab ──────────────────────────────────────────────────────────
  const helpTabContent = (
      <div className="p-4 flex flex-col gap-4" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>

        {/* How Oakie works */}
        <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-600" />
            </div>
            <p className="text-sm font-semibold text-primary-800">How Oakie works</p>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { icon: '📅', title: 'Oakie plans your day on login', desc: 'Every morning when you log in, Oakie automatically loads your day\'s plan from the curriculum.' },
              { icon: '📋', title: 'Raw Plan button', desc: 'Tap "Raw Plan" in the chat header to see today\'s topics from the curriculum database and download as PDF.' },
              { icon: '💬', title: 'Ask Oakie anything', desc: 'Type any question about your class — how to teach a subject, handle a situation, or get activity ideas.' },
              { icon: '✅', title: 'Mark topics done in Plan tab', desc: 'Go to the Plan tab (left panel) to tick off topics as you complete them. Parents are notified automatically.' },
              { icon: '⏳', title: 'Oakie carries topics forward', desc: "Unticked topics automatically move to tomorrow's plan. You'll see them in Pending." },
              { icon: '📄', title: 'Download any response as PDF', desc: 'Every Oakie response has a PDF button in the top-right corner of the message. Tap it to download.' },
              { icon: '📝', title: 'Homework & Notes', desc: 'Tap "Homework & Notes" in the Plan tab to open the dedicated page — send homework, track each student\'s completion, and send class notes to parents.' },
              { icon: '🔥', title: 'Teaching streak', desc: 'Your streak badge in the header shows how many consecutive days you\'ve submitted completion.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-xl shrink-0">{item.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{item.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ask Oakie examples */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-neutral-800 mb-3">💬 Try asking Oakie</p>
          <div className="flex flex-col gap-3">
            {[
              { category: '📋 Your plan', questions: ['What is my plan for today?', 'What topics are pending?', 'Am I on track with the curriculum?', 'What is my plan for tomorrow?'] },
              { category: '🏫 Classroom situations', questions: ['A child is crying, what do I do?', 'Children are not listening', 'What if a child finishes early?', 'How do I handle a shy child?'] },
              { category: '📚 Teaching help', questions: ['How do I conduct Circle Time today?', 'How do I teach Math today?', 'What questions should I ask during English?', 'Give me a story for story time'] },
              { category: '📊 Progress', questions: ['Am I on track with the curriculum?', 'What did I cover last week?', 'What topics are still pending?'] },
            ].map((section, i) => (
              <div key={i}>
                <p className="text-xs font-semibold text-neutral-500 mb-1.5">{section.category}</p>
                <div className="flex flex-col gap-1">
                  {section.questions.map((q, j) => (
                    <button key={j} onClick={() => { setActiveTab('chat'); askSuggested(q); }}
                      className="text-left text-xs text-primary-600 px-3 py-2 rounded-lg bg-primary-50 border border-primary-100 hover:bg-primary-100 transition-colors flex items-center gap-1.5">
                      <ArrowRight className="w-3 h-3 shrink-0" /> {q}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Oakie's limits */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ Good to know</p>
          <ul className="text-xs text-amber-700 flex flex-col gap-1.5">
            <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span> Oakie answers based on your curriculum only — not general knowledge</li>
            <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span> Oakie can answer up to 5 activity questions per day — resets when you mark completion</li>
            <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span> Classroom situation questions (crying child, not listening) are always unlimited</li>
            <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span> Tomorrow's plan is only shown after today is marked as done</li>
            <li className="flex items-start gap-1.5"><span className="shrink-0 mt-0.5">•</span> Oakie won't provide external links or YouTube URLs</li>
          </ul>
        </div>

        <div className="text-center py-2">
          <button onClick={() => { clearToken(); router.push('/login'); }}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 mx-auto transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>
    );


  // ── Main render ───────────────────────────────────────────────────────
  return (
    <div className="bg-neutral-50 flex flex-col" style={{ height: '100dvh' }}>
      {/* ── Premium Header ── */}
      <header className="shrink-0 px-4 py-3 flex items-center justify-between relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}>
        <div className="relative flex items-center gap-3">
          <OakitLogo size="xs" variant="light" />
          {greeting && (
            <span className="text-sm text-white/90 font-medium truncate max-w-[160px] lg:max-w-xs animate-fade-in">
              {greeting}
            </span>
          )}
        </div>
        <div className="relative flex items-center gap-2">
          {streak && streak.current_streak > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowStreakInfo(s => !s)}
                className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white px-2.5 py-1.5 rounded-full border border-white/20 hover:bg-white/20 transition-colors active:scale-95">
                <Flame className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-xs font-bold">{streak.current_streak}</span>
              </button>
              {showStreakInfo && (
                <div className="absolute right-0 top-10 z-50 bg-white rounded-2xl shadow-xl border border-neutral-100 p-4 w-64 animate-scale-in"
                  onClick={() => setShowStreakInfo(false)}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                      <Flame className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">Teaching Streak</p>
                      <p className="text-xs text-neutral-500">{streak.current_streak} day{streak.current_streak > 1 ? 's' : ''} in a row</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs bg-neutral-50 rounded-xl px-3 py-2 mb-2">
                    <span className="text-neutral-500">Best streak</span>
                    <span className="font-bold text-neutral-700">{streak.best_streak} days</span>
                  </div>
                  {streak.badge && <div className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 font-medium">{streak.badge}</div>}
                  <p className="text-[10px] text-neutral-400 mt-2 text-center">Tap to close</p>
                </div>
              )}
            </div>
          )}
          {todayCompleted && (
            <span className="flex items-center gap-1 text-xs bg-emerald-500/90 text-white px-2.5 py-1.5 rounded-full font-semibold animate-scale-in">
              <CheckCircle2 className="w-3 h-3" /> Done
            </span>
          )}
          <span className="text-xs text-white/50 hidden sm:block">{dateLabel}</span>
          <button
            onClick={() => { clearToken(); router.push('/login'); }}
            className="hidden lg:flex items-center gap-1 text-xs text-white/50 hover:text-white/80 transition-colors ml-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden xl:block">Sign out</span>
          </button>
        </div>
      </header>

      {/* Desktop: two-column layout | Tablet/Mobile: tab-based */}
      <div className="flex-1 min-h-0 overflow-hidden flex">

        {/* ── Desktop sidebar ── */}
        <div className="hidden lg:flex flex-col w-80 xl:w-96 border-r border-neutral-100 bg-white overflow-y-auto shrink-0">
          <div className="flex border-b border-neutral-100 shrink-0 px-3 pt-3 gap-1">
            {(['plan', 'help'] as Tab[]).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`relative flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === t ? 'text-primary-600 bg-primary-50' : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'
                }`}>
                <span className="flex items-center justify-center gap-1.5">
                  {t === 'plan' ? <CalendarDays className="w-3.5 h-3.5" /> : <HelpCircle className="w-3.5 h-3.5" />}
                  {t === 'plan' ? 'Plan' : 'Help'}
                </span>
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeTab !== 'chat' ? (
              activeTab === 'plan' ? planTabContent : helpTabContent
            ) : planTabContent}
          </div>
        </div>

        {/* ── Main content area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tablet top tabs */}
          <div className="hidden md:flex lg:hidden border-b border-neutral-100 bg-white shrink-0 px-3 pt-2 gap-1">
            {([
              { id: 'plan', label: 'Plan', Icon: CalendarDays },
              { id: 'chat', label: 'Oakie', Icon: MessageCircle },
              { id: 'help', label: 'Help', Icon: HelpCircle },
            ] as { id: Tab; label: string; Icon: any }[]).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`relative flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === tab.id ? 'text-primary-600 bg-primary-50' : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'
                }`}>
                <span className="flex items-center justify-center gap-1.5">
                  <tab.Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </span>
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="hidden lg:flex flex-col flex-1 overflow-hidden">{chatTabContent}</div>
            <div className="flex-1 min-h-0 overflow-y-auto lg:hidden">
              {activeTab === 'plan' && planTabContent}
              {activeTab === 'help' && helpTabContent}
            </div>
            <div className={`flex-1 min-h-0 flex flex-col overflow-hidden lg:hidden ${activeTab === 'chat' ? 'flex' : 'hidden'}`}>
              {chatTabContent}
            </div>
          </div>
        </div>
      </div>

      {/* ── Premium Bottom Nav — mobile only ── */}
      <nav className="md:hidden bg-white/95 backdrop-blur-xl border-t border-neutral-100 flex shrink-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {([
          { id: 'plan', Icon: CalendarDays, label: 'Plan' },
          { id: 'chat', Icon: MessageCircle, label: 'Oakie' },
          { id: 'help', Icon: HelpCircle, label: 'Help' },
        ] as { id: Tab; Icon: any; label: string }[]).map(tab => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex flex-col items-center py-2.5 gap-0.5 relative transition-all active:scale-95">
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-600 rounded-full" />
              )}
              <tab.Icon className={`w-5 h-5 transition-colors ${active ? 'text-primary-600' : 'text-neutral-400'}`} />
              <span className={`text-[10px] font-semibold tracking-wide transition-colors ${active ? 'text-primary-600' : 'text-neutral-400'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { Button, Card, Badge } from '@/components/ui';
import PendingWorkList from '@/components/ui/PendingWorkList';
import OakitLogo from '@/components/OakitLogo';
import { apiGet, apiPost } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Chunk { id: string; topic_label: string; content: string; activity_ids: string[]; page_start: number; }
interface DayPlan { plan_date: string; status: string; chunks: Chunk[]; special_label?: string; }
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

function AiMessageText({ text, subjectCheckboxes }: { text: string; subjectCheckboxes?: SubjectCheckbox[] }) {
  const lines = text.split('\n');
  return (
    <div className="flex flex-col gap-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        if (/^[📌📅✅⏳🎯💡☕🌱📚📝🎪🎉🔢📖✏️🌍🎨⭕🗺️🔬🌿🗣️📋⚠️🚨]/.test(trimmed) && !trimmed.startsWith('💡')) {
          const subjectName = trimmed.replace(/^(\p{Emoji}\s*)/u, '').trim();
          // Find matching checkbox for this subject header
          const checkbox = subjectCheckboxes?.find(s =>
            s.label.toLowerCase() === subjectName.toLowerCase() ||
            subjectName.toLowerCase().includes(s.label.toLowerCase()) ||
            s.label.toLowerCase().includes(subjectName.toLowerCase())
          );
          return (
            <div key={i} className={`flex items-center justify-between gap-2 mt-3 first:mt-0 rounded-xl px-3 py-2.5 ${
              checkbox?.alreadyDone ? 'bg-green-50 border border-green-200' :
              checkbox?.checked ? 'bg-primary/5 border border-primary/20' :
              'bg-primary/5'
            }`}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-base shrink-0">{trimmed.match(/^(\p{Emoji})/u)?.[1]}</span>
                <span className="font-semibold text-primary text-sm truncate">{subjectName}</span>
                {checkbox?.alreadyDone && <span className="text-green-500 text-xs shrink-0">✓ Done</span>}
              </div>
              {checkbox && !checkbox.alreadyDone && (
                <input
                  type="checkbox"
                  checked={checkbox.checked}
                  onChange={checkbox.onToggle}
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary shrink-0 cursor-pointer"
                />
              )}
              {checkbox?.alreadyDone && (
                <span className="w-5 h-5 flex items-center justify-center text-green-500 shrink-0">✓</span>
              )}
            </div>
          );
        }
        if (trimmed.startsWith('💡')) {
          return (
            <div key={i} className="flex items-start gap-2 mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <span className="text-base shrink-0">💡</span>
              <span className="text-xs text-amber-800">{trimmed.replace(/^💡\s*/, '')}</span>
            </div>
          );
        }
        if (trimmed.startsWith('☕')) {
          return (
            <div key={i} className="flex items-center gap-2 my-1">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">☕ Break</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          );
        }
        if (trimmed.startsWith('⚠️') || trimmed.startsWith('🚨')) {
          return (
            <div key={i} className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <span className="text-base shrink-0">{trimmed[0]}</span>
              <span className="text-xs text-red-700 font-medium">{trimmed.replace(/^[⚠️🚨]\s*/u, '')}</span>
            </div>
          );
        }
        const labelMatch = trimmed.match(/^(What to do|Ask children|Tip|Objective|Materials|Note):\s*(.*)/i);
        if (labelMatch) {
          return (
            <div key={i} className="flex items-start gap-1.5 pl-3">
              <span className="text-xs font-semibold text-gray-500 shrink-0 mt-0.5 min-w-[80px]">{labelMatch[1]}:</span>
              <span className="text-xs text-gray-700">{labelMatch[2]}</span>
            </div>
          );
        }
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={i} className="flex items-start gap-2 pl-3">
              <span className="text-xs font-bold text-primary/60 shrink-0 w-4 mt-0.5">{numMatch[1]}.</span>
              <span className="text-xs text-gray-700">{numMatch[2]}</span>
            </div>
          );
        }
        if (trimmed.startsWith('•') || trimmed.startsWith('- ')) {
          return (
            <div key={i} className="flex items-start gap-2 pl-3">
              <span className="text-primary/40 shrink-0 mt-0.5 text-xs">•</span>
              <span className="text-xs text-gray-700">{trimmed.replace(/^[•\-]\s*/, '')}</span>
            </div>
          );
        }
        if (trimmed.startsWith('---')) return <hr key={i} className="border-gray-100 my-1" />;
        const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
        if (parts.some(p => p.startsWith('**'))) {
          return (
            <p key={i} className="text-xs text-gray-700">
              {parts.map((p, j) => p.startsWith('**') && p.endsWith('**')
                ? <strong key={j} className="font-semibold text-gray-800">{p.slice(2, -2)}</strong>
                : <span key={j}>{p}</span>)}
            </p>
          );
        }
        return <p key={i} className="text-xs text-gray-700">{trimmed}</p>;
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
    await Promise.all([loadPlan(effectiveToday), loadPending()]);
    if (!todayCompletedRef.current) await autoShowDailyPlan(effectiveToday);
  }

  async function autoShowDailyPlan(effectiveToday: string) {
    try {
      setAiLoading(true);
      const res = await apiPost<any>('/api/v1/ai/query', { text: "what is my plan for today" }, token);
      setMessages(prev => [...prev, {
        role: 'assistant', text: res.response,
        chunk_ids: res.chunk_ids, covered_chunk_ids: res.covered_chunk_ids,
        activity_ids: res.activity_ids, completion_date: effectiveToday,
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
    // Build history from last 3 messages (excluding the one we're about to add)
    const history = messages.slice(-3).map(m => ({ role: m.role, text: m.text }));
    try {
      const res = await apiPost<any>('/api/v1/ai/query', { text: question, history }, token);
      setMessages(m => [...m, {
        role: 'assistant', text: res.response,
        chunk_ids: res.chunk_ids, covered_chunk_ids: res.covered_chunk_ids,
        activity_ids: res.activity_ids, completion_date: today,
        settling_gate: res.settling_gate, gate_date: res.gate_date,
        is_settling: res.is_settling, settling_day: res.settling_day,
        settling_total: res.settling_total, already_completed: res.already_completed,
        question_limit_reached: res.question_limit_reached,
      }]);
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
    const userMsg = input.trim(); setInput('');
    setMessages(m => [...m, { role: 'user', text: userMsg }]);
    setAiLoading(true);
    const history = messages.slice(-3).map(m => ({ role: m.role, text: m.text }));
    try {
      const res = await apiPost<any>('/api/v1/ai/query', { text: userMsg, history }, token);
      setMessages(m => [...m, {
        role: 'assistant', text: res.response,
        chunk_ids: res.chunk_ids, covered_chunk_ids: res.covered_chunk_ids,
        activity_ids: res.activity_ids, completion_date: today,
        question_limit_reached: res.question_limit_reached,
      }]);
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
        setTodayCompleted(true); todayCompletedRef.current = true;
        try { const ctx = await apiGet<any>('/api/v1/teacher/context', token); setTomorrowPlan(ctx.tomorrow_plan || null); } catch { /* ignore */ }
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
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 pb-20 md:pb-4">
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
              <p className="text-xs text-green-700">Great work. Parents have been notified.</p>
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
              <h2 className="text-sm font-semibold text-gray-800">📅 Today's Plan</h2>
              {plan.status === 'carried_forward' && <Badge label="Topics carried forward" variant="warning" />}
            </div>
            {plan.chunks.map((chunk, i) => (
              <Card key={chunk.id} padding="sm">
                <p className="text-xs font-semibold text-gray-800 mb-1">{chunk.topic_label || `Topic ${i + 1}`}</p>
                <p className="text-xs text-gray-600 line-clamp-3">{chunk.content}</p>
                {chunk.activity_ids?.length > 0 && <p className="text-xs text-accent mt-1">📎 {chunk.activity_ids.join(', ')}</p>}
              </Card>
            ))}
            {/* Subject help chips */}
            <div>
              <p className="text-xs text-gray-500 mb-2">💡 Get help for today's activities:</p>
              <div className="flex flex-col gap-2">
                {getHelpButtons(extractSubjects(plan.chunks)).map((btn, i) => (
                  <button key={i} onClick={() => askSuggested(btn.question)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-primary/30 bg-white text-sm text-primary active:bg-primary/10 transition-colors text-left">
                    <span>{btn.icon}</span>
                    <span>How to conduct <strong>{btn.label}</strong>?</span>
                  </button>
                ))}
                {[
                  { q: "a child is crying what do I do", label: "😢 Child is upset" },
                  { q: "children are not listening", label: "🙋 Not listening" },
                  { q: "what if a child finishes early", label: "⚡ Finished early" },
                  { q: "am I on track with the curriculum", label: "📊 My progress" },
                ].map((item, i) => (
                  <button key={i} onClick={() => askSuggested(item.q)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 active:bg-gray-50 transition-colors text-left">
                    {item.label}
                  </button>
                ))}
              </div>
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

  // ── Chat Tab ──────────────────────────────────────────────────────────
  const chatTabContent = (
      <>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 pb-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-sm px-4 py-2.5'
                  : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm overflow-hidden shadow-sm'
              }`}>
                {msg.role === 'user' ? (
                  <span className="whitespace-pre-wrap text-sm">{msg.text}</span>
                ) : (
                  <div>
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
                        const isCompletable = !msg.is_settling && !msg.already_completed &&
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
                    {/* Submit + export — shown when checkboxes are ticked */}
                    {!msg.is_settling && !msg.already_completed && msg.chunk_ids && msg.chunk_ids.length > 0 &&
                     msg.completion_date && msg.completion_date <= today && (() => {
                      const msgKey = String(i);
                      const checkedCount = inlineChecked[msgKey]?.size || 0;
                      // Build all tickable actIds for "check all"
                      const allActIds: string[] = [];
                      const seenAll = new Set<string>();
                      (msg.activity_ids || []).forEach(actId => {
                        if (seenAll.has(actId)) return; seenAll.add(actId);
                        const chunkId = actId.split(':')[0];
                        if (!msg.covered_chunk_ids?.includes(chunkId)) allActIds.push(actId);
                      });
                      if (allActIds.length === 0) msg.chunk_ids!.forEach(cid => {
                        if (!msg.covered_chunk_ids?.includes(cid)) allActIds.push(cid);
                      });
                      const allChecked = allActIds.length > 0 && allActIds.every(a => inlineChecked[msgKey]?.has(a));

                      function toggleAll() {
                        setInlineChecked(prev => {
                          const set = new Set(prev[msgKey] || []);
                          if (allChecked) { allActIds.forEach(a => set.delete(a)); }
                          else { allActIds.forEach(a => set.add(a)); }
                          return { ...prev, [msgKey]: set };
                        });
                      }

                      return (
                        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/60">
                          {/* Check all row */}
                          {allActIds.length > 0 && !inlineMsg[msgKey] && (
                            <label className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border mb-2 cursor-pointer transition-colors ${
                              allChecked ? 'bg-primary/5 border-primary/30' : 'bg-white border-gray-200'
                            }`}>
                              <span className="text-sm font-semibold text-gray-700">
                                {allChecked ? 'All activities selected' : 'Mark all as done'}
                              </span>
                              <input type="checkbox" checked={allChecked} onChange={toggleAll}
                                className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary shrink-0 cursor-pointer" />
                            </label>
                          )}
                          {inlineMsg[msgKey] && <p className="text-xs text-green-600 mb-2">{inlineMsg[msgKey]}</p>}
                          {checkedCount > 0 && (
                            <Button size="sm" loading={inlineSubmitting === msgKey}
                              onClick={() => submitInlineCompletion(i, msg)} className="w-full mb-2">
                              ✓ Mark {checkedCount} as Done
                            </Button>
                          )}
                          <button onClick={() => exportPdf(msg.completion_date || today)} disabled={exporting}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-500 active:bg-gray-50 disabled:opacity-50">
                            ↓ Export Today's Plan as PDF
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          ))}
          {aiLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm text-gray-400 flex items-center gap-2 shadow-sm">
                <span className="inline-flex gap-1">
                  {[0, 150, 300].map(d => <span key={d} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </span>
                <span className="text-xs">Oakie is thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div className="border-t border-gray-200 bg-white px-3 pt-2 pb-safe">
          {limitReached && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2 flex items-center gap-2">
              <span className="text-amber-600">🔒</span>
              <p className="text-xs text-amber-700 font-medium">Mark activities as completed to ask more questions.</p>
            </div>
          )}
          {/* Subject chips */}
          {plan?.chunks?.length && !limitReached ? (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {getHelpButtons(extractSubjects(plan.chunks)).map((btn, i) => (
                <button key={i} type="button" onClick={() => setInput(`How do I conduct ${btn.label} today?`)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-primary/30 bg-white text-xs text-primary whitespace-nowrap shrink-0 active:bg-primary/5">
                  {btn.icon} {btn.label}
                </button>
              ))}
              {[{ icon: '😢', label: 'Child crying' }, { icon: '🙋', label: 'Not listening' }, { icon: '⚡', label: 'Done early' }].map((c, i) => (
                <button key={i} type="button" onClick={() => setInput(`What do I do if a child is ${c.label.toLowerCase()}?`)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs text-gray-600 whitespace-nowrap shrink-0 active:bg-gray-50">
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          ) : null}
          <form onSubmit={sendMessage} className="flex gap-2 items-center pb-2">
            <input
              className="flex-1 px-4 py-2.5 rounded-full border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-gray-50 disabled:text-gray-400"
              placeholder={limitReached ? "Mark activities first..." : "Ask Oakie anything..."}
              value={input} onChange={e => setInput(e.target.value)} disabled={limitReached}
            />
            <Button type="submit" loading={aiLoading} size="sm" disabled={limitReached}
              className="rounded-full px-4 shrink-0">Send</Button>
          </form>
        </div>
      </>
  );

  // ── Help Tab ──────────────────────────────────────────────────────────
  const helpTabContent = (
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-20 md:pb-4">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <p className="text-sm font-semibold text-primary mb-3">👋 How to use Oakie</p>
          <div className="flex flex-col gap-3">
            {[
              { icon: '📅', title: 'Your plan loads automatically', desc: 'Every morning, Oakie shows your day\'s plan. Tap the Plan tab to see it.' },
              { icon: '💬', title: 'Ask about any activity', desc: 'Tap a subject button or type your question. Oakie answers based on your plan only.' },
              { icon: '✅', title: 'Mark activities as done', desc: 'Use the checkboxes in the chat to tick off each activity. Parents are notified automatically.' },
              { icon: '⏳', title: 'Pending topics carry forward', desc: 'If you don\'t complete a topic, it appears in tomorrow\'s plan automatically.' },
              { icon: '🔒', title: 'Question limit', desc: 'You can ask up to 5 activity questions per day. Classroom situations (crying child, not listening) are always allowed.' },
              { icon: '📄', title: 'Export your plan', desc: 'Download today\'s plan as a PDF using the export button in the chat.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-xl shrink-0">{item.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3">💬 What you can ask Oakie</p>
          <div className="flex flex-col gap-3">
            {[
              { category: '📋 About your plan', questions: ['What is my plan for today?', 'What topics are pending?', 'Am I on track with the curriculum?', 'What is my plan for tomorrow?'] },
              { category: '🏫 Classroom situations', questions: ['A child is crying, what do I do?', 'Children are not listening', 'What if a child finishes early?', 'How do I handle a shy child?'] },
              { category: '📚 Activity guidance', questions: ['How do I conduct Circle Time today?', 'How do I teach Math today?', 'What questions should I ask during English?', 'Give me a story for story time'] },
            ].map((section, i) => (
              <div key={i}>
                <p className="text-xs font-semibold text-gray-600 mb-1.5">{section.category}</p>
                <div className="flex flex-col gap-1">
                  {section.questions.map((q, j) => (
                    <button key={j} onClick={() => askSuggested(q)}
                      className="text-left text-xs text-primary px-3 py-2 rounded-lg bg-white border border-gray-100 active:bg-primary/5 transition-colors">
                      → {q}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ What Oakie cannot do</p>
          <ul className="text-xs text-amber-700 flex flex-col gap-1">
            <li>• Answer questions outside today's plan</li>
            <li>• Provide YouTube links or external URLs</li>
            <li>• Answer more than 5 activity questions before you mark completion</li>
            <li>• Show tomorrow's plan before today is marked as done</li>
          </ul>
        </div>

        <div className="text-center py-2">
          <button onClick={() => { clearToken(); router.push('/login'); }}
            className="text-xs text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </div>
    );

  // ── Main render ───────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header — full width always */}
      <header className="bg-primary text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <OakitLogo size="sm" variant="light" />
          {greeting && <span className="text-sm text-white/90 font-medium truncate max-w-[200px] lg:max-w-none">{greeting}</span>}
        </div>
        <div className="flex items-center gap-2">
          {todayCompleted && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-medium">✓ Done</span>}
          <span className="text-sm text-white/70">{dateLabel}</span>
          {/* Desktop sign out */}
          <button onClick={() => { clearToken(); router.push('/login'); }}
            className="hidden lg:block text-xs text-white/60 hover:text-white ml-2">Sign out</button>
        </div>
      </header>

      {/* Desktop: two-column layout | Tablet/Mobile: tab-based */}
      <div className="flex-1 overflow-hidden flex">

        {/* ── Desktop sidebar (Plan + Help) — visible lg+ ── */}
        <div className="hidden lg:flex flex-col w-80 xl:w-96 border-r border-gray-200 bg-white overflow-y-auto shrink-0">
          {/* Desktop tab switcher inside sidebar */}
          <div className="flex border-b border-gray-100 shrink-0">
            {(['plan', 'help'] as Tab[]).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === t ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600'
                }`}>
                {t === 'plan' ? '📅 Plan' : '❓ Help'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeTab !== 'chat' ? (
              activeTab === 'plan' ? planTabContent : helpTabContent
            ) : (
              planTabContent
            )}
          </div>
        </div>

        {/* ── Main content area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Tablet: top tab bar (md only) */}
          <div className="hidden md:flex lg:hidden border-b border-gray-200 bg-white shrink-0">
            {([
              { id: 'plan', label: '📅 Plan' },
              { id: 'chat', label: '💬 Oakie' },
              { id: 'help', label: '❓ Help' },
            ] as { id: Tab; label: string }[]).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content — on desktop always show chat, on mobile/tablet show active tab */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Desktop: always show chat in main area */}
            <div className="hidden lg:flex flex-col flex-1 overflow-hidden">
              {chatTabContent}
            </div>
            {/* Mobile/Tablet: show active tab */}
            <div className="flex flex-col flex-1 overflow-hidden lg:hidden">
              {activeTab === 'plan' && planTabContent}
              {activeTab === 'chat' && chatTabContent}
              {activeTab === 'help' && helpTabContent}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom tab bar — mobile only */}
      <nav className="md:hidden bg-white border-t border-gray-200 flex shrink-0">
        {([
          { id: 'plan', icon: '📅', label: 'Plan' },
          { id: 'chat', icon: '💬', label: 'Oakie' },
          { id: 'help', icon: '❓', label: 'Help' },
        ] as { id: Tab; icon: string; label: string }[]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
              activeTab === tab.id ? 'text-primary' : 'text-gray-400'
            }`}>
            <span className="text-xl">{tab.icon}</span>
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

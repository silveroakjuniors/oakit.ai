'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  ChevronLeft, Send, BookOpen, ClipboardList, CheckCircle2, AlertCircle,
  X, Loader2, Sparkles, Users, Wand2,
} from 'lucide-react';

interface Student { id: string; name: string; }
interface JourneyEntry {
  id: string; entry_date: string; entry_type: 'daily' | 'weekly' | 'highlight';
  raw_text: string; beautified_text: string; student_name: string;
}
interface ObsRecord { student_id: string; categories: string[]; }

const REPORT_CATEGORIES = [
  { key: 'cognitive',     label: 'Cognitive Skills',         icon: '🧠', hint: 'How the child thinks, solves problems, remembers things' },
  { key: 'language',      label: 'Language & Communication', icon: '🗣️', hint: 'Speaking, listening, vocabulary, storytelling' },
  { key: 'social',        label: 'Social Interaction',       icon: '🤝', hint: 'How the child plays and works with peers' },
  { key: 'emotional',     label: 'Emotional Development',    icon: '💛', hint: 'Self-regulation, confidence, empathy' },
  { key: 'gross_motor',   label: 'Gross Motor Skills',       icon: '🏃', hint: 'Running, jumping, balance, coordination' },
  { key: 'fine_motor',    label: 'Fine Motor Skills',        icon: '✏️', hint: 'Pencil grip, cutting, drawing, writing' },
  { key: 'creativity',    label: 'Creativity & Expression',  icon: '🎨', hint: 'Art, music, imaginative play, storytelling' },
  { key: 'participation', label: 'Classroom Participation',  icon: '🙋', hint: 'Engagement, attention, following instructions' },
  { key: 'peer',          label: 'Peer Interaction',         icon: '👫', hint: 'Sharing, taking turns, kindness to classmates' },
  { key: 'behaviour',     label: 'Behavioral Observations',  icon: '⭐', hint: 'Overall behaviour, discipline, positive traits' },
];

const ENTRY_EXAMPLES = {
  daily: [
    'Aarav was very focused during circle time today. He raised his hand to answer questions and helped a friend with their activity.',
    'She struggled a bit with the writing exercise but kept trying. Showed great patience.',
    'Very energetic today — led the group during rhyme time and made everyone laugh.',
  ],
  weekly: [
    "This week Aarav showed great improvement in English speaking. He's more confident and participates without being prompted.",
    'Had a wonderful week — completed all activities, helped peers, and showed curiosity during GK.',
  ],
  highlight: [
    'Today Aarav surprised everyone by reciting the full poem from memory — completely unprompted!',
    'She comforted a crying classmate today with a hug and kind words. A beautiful moment of empathy.',
  ],
};

const AI_SUGGESTIONS: Record<string, string[]> = {
  cognitive:     ['Shows strong problem-solving ability', 'Needs support with memory and recall', 'Excellent pattern recognition', 'Curious and asks thoughtful questions'],
  language:      ['Communicates clearly and confidently', 'Vocabulary is expanding well', 'Needs encouragement to speak up', 'Excellent listening and comprehension'],
  social:        ['Works well in group activities', 'Needs support sharing with peers', 'Shows leadership qualities', 'Kind and inclusive with classmates'],
  emotional:     ['Manages emotions well', 'Gets frustrated easily, needs calming strategies', 'Shows empathy towards classmates', 'Building confidence gradually'],
  gross_motor:   ['Active and energetic, good coordination', 'Needs support with balance activities', 'Excellent at outdoor play and sports', 'Developing gross motor skills steadily'],
  fine_motor:    ['Fine motor skills are developing well', 'Needs support with pencil grip', 'Excellent at cutting and pasting', 'Struggles with writing, needs practice'],
  creativity:    ['Shows great imagination in art', 'Loves storytelling and role play', 'Excellent musical sense and rhythm', 'Needs encouragement to try new activities'],
  participation: ['Actively participates in all activities', 'Needs reminders to stay focused', 'Excellent attention span for age', 'Engages well when given individual attention'],
  peer:          ['Shares and takes turns well', 'Working on conflict resolution skills', 'A natural peacemaker in the group', 'Prefers one-on-one over group play'],
  behaviour:     ['Follows classroom rules consistently', 'Needs reminders about expectations', 'Positive attitude and enthusiasm', 'Showing steady improvement in behaviour'],
};

const CATEGORY_DB_MAP: Record<string, string> = {
  cognitive: 'Academic Progress', language: 'Language', social: 'Social Skills',
  emotional: 'Behavior', gross_motor: 'Motor Skills', fine_motor: 'Motor Skills',
  creativity: 'Other', participation: 'Academic Progress', peer: 'Social Skills', behaviour: 'Behavior',
};

/** Safely parse a date string from Postgres (ISO or date-only) and format as dd MMM */
function formatEntryDate(raw: string): string {
  const dateStr = (raw || '').split('T')[0];
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function ChildJourneyPage() {
  const router = useRouter();
  const token = getToken() || '';

  const [students, setStudents] = useState<Student[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [recentEntries, setRecentEntries] = useState<JourneyEntry[]>([]);
  const [obsMap, setObsMap] = useState<Record<string, string[]>>({});
  const [activeTab, setActiveTab] = useState<'entry' | 'readiness'>('entry');

  // ── Journal Entry tab state ──
  const [selectedStudent, setSelectedStudent] = useState('');
  const [entryType, setEntryType] = useState<'daily' | 'weekly' | 'highlight'>('daily');
  const [rawText, setRawText] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [formattingMain, setFormattingMain] = useState(false);
  const [mainFormatted, setMainFormatted] = useState(false);

  // ── Bulk entry state ──
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkTexts, setBulkTexts] = useState<Record<string, string>>({});
  const [bulkFormatting, setBulkFormatting] = useState<Record<string, boolean>>({});
  const [bulkFormatted, setBulkFormatted] = useState<Record<string, boolean>>({});
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');

  // ── Generic class note state ──
  const [classNoteText, setClassNoteText] = useState('');
  const [savingClassNote, setSavingClassNote] = useState(false);
  const [classNoteMsg, setClassNoteMsg] = useState('');
  const [classNoteFormatting, setClassNoteFormatting] = useState(false);

  // ── Report Readiness tab state ──
  const [obsCategory, setObsCategory] = useState('');
  const [obsText, setObsText] = useState('');
  const [savingObs, setSavingObs] = useState(false);
  const [obsMsg, setObsMsg] = useState('');
  const [obsFormatting, setObsFormatting] = useState(false);
  // ── Observation modal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStudent, setModalStudent] = useState<Student | null>(null);
  const [modalCategory, setModalCategory] = useState<typeof REPORT_CATEGORIES[0] | null>(null);
  const [modalText, setModalText] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const [modalFormatting, setModalFormatting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    loadStudents();
  }, []);

  async function loadStudents() {
    try {
      const ctx = await apiGet<any>('/api/v1/teacher/context', token);
      if (ctx.section_id) {
        setSectionId(ctx.section_id);
        const data = await apiGet<Student[]>(`/api/v1/teacher/sections/${ctx.section_id}/students`, token);
        setStudents(data || []);
        loadRecentEntries(ctx.section_id);
        loadObsMap(ctx.section_id);
      }
    } catch { /* ignore */ }
  }

  async function loadRecentEntries(sid: string) {
    try {
      const data = await apiGet<JourneyEntry[]>(`/api/v1/teacher/child-journey?section_id=${sid}`, token);
      setRecentEntries((data || []).slice(0, 10));
    } catch { /* ignore */ }
  }

  async function loadObsMap(sid: string) {
    try {
      const data = await apiGet<ObsRecord[]>(`/api/v1/teacher/observations?section_id=${sid}`, token);
      const map: Record<string, string[]> = {};
      for (const r of data || []) {
        if (!map[r.student_id]) map[r.student_id] = [];
        for (const cat of r.categories || []) map[r.student_id].push(cat);
      }
      setObsMap(map);
    } catch { /* ignore */ }
  }

  /** Ask Oakie to reformat a raw observation. Passes student name + category for context. */
  async function askOakieFormat(text: string, studentName?: string, category?: string): Promise<string> {
    const res = await apiPost<{ formatted?: string }>(
      '/api/v1/ai/format-observation',
      { text, student_name: studentName, category, class_name: '' },
      token,
    );
    return res.formatted || text;
  }

  /** Format the single-student textarea with Oakie */
  async function formatMainWithOakie() {
    if (!rawText.trim()) return;
    setFormattingMain(true);
    try {
      const formatted = await askOakieFormat(rawText);
      setRawText(formatted);
      setMainFormatted(true);
    } catch { /* silently fail */ }
    finally { setFormattingMain(false); }
  }

  /** Format a specific bulk student's textarea with Oakie */
  async function formatBulkWithOakie(studentId: string) {
    const text = bulkTexts[studentId] || '';
    if (!text.trim()) return;
    const studentName = students.find(s => s.id === studentId)?.name || '';
    setBulkFormatting(prev => ({ ...prev, [studentId]: true }));
    try {
      const formatted = await askOakieFormat(text, studentName);
      setBulkTexts(prev => ({ ...prev, [studentId]: formatted }));
      setBulkFormatted(prev => ({ ...prev, [studentId]: true }));
    } catch { /* silently fail */ }
    finally { setBulkFormatting(prev => ({ ...prev, [studentId]: false })); }
  }

  /** Save single-student journal entry */
  async function save() {
    if (!selectedStudent || !rawText.trim()) return;
    setSaving(true); setMsg('');
    try {
      await apiPost('/api/v1/teacher/child-journey', {
        student_id: selectedStudent,
        entry_type: entryType,
        raw_text: rawText.trim(),
        send_to_parent: false,
      }, token);
      setMsg('✓ Journey entry saved');
      setRawText('');
      setMainFormatted(false);
      if (sectionId) loadRecentEntries(sectionId);
    } catch (e: any) { setMsg(e.message || 'Failed'); }
    finally { setSaving(false); }
  }

  /** Save all bulk entries for selected students that have notes */
  async function saveBulk() {
    const toSave = Array.from(selectedStudents).filter(id => (bulkTexts[id] || '').trim());
    if (!toSave.length) return;
    setSavingBulk(true); setBulkMsg('');
    try {
      await Promise.all(toSave.map(studentId =>
        apiPost('/api/v1/teacher/child-journey', {
          student_id: studentId,
          entry_type: entryType,
          raw_text: bulkTexts[studentId].trim(),
          send_to_parent: false,
        }, token),
      ));
      setBulkMsg(`✓ Saved entries for ${toSave.length} student${toSave.length > 1 ? 's' : ''}`);
      setBulkTexts({});
      setBulkFormatted({});
      setSelectedStudents(new Set());
      if (sectionId) loadRecentEntries(sectionId);
    } catch (e: any) { setBulkMsg(e.message || 'Failed to save'); }
    finally { setSavingBulk(false); }
  }

  /** Format class note with Oakie */
  async function formatClassNoteWithOakie() {
    if (!classNoteText.trim()) return;
    setClassNoteFormatting(true);
    try {
      const formatted = await askOakieFormat(classNoteText);
      setClassNoteText(formatted);
    } catch { /* silently fail */ }
    finally { setClassNoteFormatting(false); }
  }

  /** Save a generic class note for all students */
  async function saveClassNote() {
    if (!classNoteText.trim() || students.length === 0) return;
    setSavingClassNote(true); setClassNoteMsg('');
    try {
      await Promise.all(students.map(student =>
        apiPost('/api/v1/teacher/child-journey', {
          student_id: student.id,
          entry_type: entryType,
          raw_text: classNoteText.trim(),
          send_to_parent: false,
        }, token)
      ));
      setClassNoteMsg(`✓ Note saved for all ${students.length} students`);
      setClassNoteText('');
      if (sectionId) loadRecentEntries(sectionId);
    } catch (e: any) { setClassNoteMsg(e.message || 'Failed to save'); }
    finally { setSavingClassNote(false); }
  }

  async function saveObservation() {
    if (!selectedStudent || !obsText.trim() || !obsCategory) return;
    setSavingObs(true); setObsMsg('');
    try {
      await apiPost('/api/v1/teacher/observations', {
        student_id: selectedStudent,
        obs_text: obsText.trim(),
        categories: [CATEGORY_DB_MAP[obsCategory] || 'Other'],
        share_with_parent: false,
      }, token);
      setObsMsg('✓ Observation saved for report');
      setObsText('');
      setObsMap(prev => ({
        ...prev,
        [selectedStudent]: [...(prev[selectedStudent] || []), obsCategory],
      }));
    } catch (e: any) { setObsMsg(e.message || 'Failed'); }
    finally { setSavingObs(false); }
  }

  function getMissingCategories(studentId: string): string[] {
    const covered = new Set((obsMap[studentId] || []).map(c => c.toLowerCase()));
    return REPORT_CATEGORIES.filter(cat => !covered.has(cat.key) && !covered.has(cat.label.toLowerCase())).map(c => c.key);
  }

  function openModal(student: Student, cat: typeof REPORT_CATEGORIES[0]) {
    setModalStudent(student);
    setModalCategory(cat);
    setModalText('');
    setModalError('');
    setModalOpen(true);
  }

  async function saveModalObservation() {
    if (!modalStudent || !modalCategory || !modalText.trim()) {
      setModalError('Please write an observation.');
      return;
    }
    setModalSaving(true); setModalError('');
    try {
      await apiPost('/api/v1/teacher/observations', {
        student_id: modalStudent.id,
        obs_text: modalText.trim(),
        categories: [CATEGORY_DB_MAP[modalCategory.key] || 'Other'],
        share_with_parent: false,
      }, token);
      setObsMap(prev => ({
        ...prev,
        [modalStudent.id]: [...(prev[modalStudent.id] || []), modalCategory.key],
      }));
      setModalOpen(false);
    } catch (e: any) { setModalError(e.message || 'Failed to save'); }
    finally { setModalSaving(false); }
  }

  function toggleStudentSelection(id: string) {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const isBulkMode = selectedStudents.size > 0;
  const examples = ENTRY_EXAMPLES[entryType];
  const selectedStudentName = students.find(s => s.id === selectedStudent)?.name || '';
  const missingForSelected = selectedStudent ? getMissingCategories(selectedStudent) : [];

  // Check if any student has 0 observations (for readiness banner)
  const studentsWithNoObs = students.filter(s => !obsMap[s.id] || obsMap[s.id].length === 0);

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">

      {/* ── Observation Popup Modal ── */}
      {modalOpen && modalStudent && modalCategory && (
        <div
          className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative w-full lg:w-[480px] bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-primary-50 border-b border-primary-100">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{modalCategory.icon}</span>
                <div>
                  <p className="text-sm font-bold text-neutral-800">{modalCategory.label}</p>
                  <p className="text-xs text-neutral-500">{modalStudent.name} · {modalCategory.hint}</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-neutral-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* AI Suggestions */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles size={13} className="text-primary-500" />
                  <p className="text-xs font-semibold text-neutral-600">Oakie suggestions — tap to use</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(AI_SUGGESTIONS[modalCategory.key] || []).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setModalText(s)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all text-left ${
                        modalText === s
                          ? 'bg-primary-50 border-primary-300 text-primary-700 font-semibold'
                          : 'border-neutral-200 text-neutral-600 hover:border-primary-300 hover:bg-primary-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-neutral-600">Your observation</p>
                  <button
                    onClick={async () => {
                      if (!modalText.trim()) return;
                      setModalFormatting(true);
                      try {
                        const formatted = await askOakieFormat(modalText, modalStudent.name, modalCategory.label);
                        setModalText(formatted);
                      } catch { /* silently fail */ }
                      finally { setModalFormatting(false); }
                    }}
                    disabled={modalFormatting || !modalText.trim()}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-lg font-medium transition-colors disabled:opacity-40"
                  >
                    {modalFormatting ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                    Ask Oakie
                  </button>
                </div>
                <textarea
                  value={modalText}
                  onChange={e => setModalText(e.target.value)}
                  placeholder={`Describe what you observed about ${modalStudent.name.split(' ')[0]}…`}
                  rows={4}
                  autoFocus
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 resize-none"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-neutral-400">{modalText.length} chars</span>
                  {modalText.length > 0 && (
                    <button onClick={() => setModalText('')} className="text-xs text-neutral-400 hover:text-neutral-600">Clear</button>
                  )}
                </div>
              </div>

              {/* Note about sharing */}
              <p className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-100 rounded-xl px-3 py-2">
                💡 Observations will be shared with parents when you complete the full report.
              </p>

              {modalError && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{modalError}</p>
              )}
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveModalObservation}
                disabled={modalSaving || !modalText.trim()}
                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                {modalSaving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {modalSaving ? 'Saving…' : 'Save Observation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-neutral-400 hover:text-neutral-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-neutral-900">Child Journey</h1>
          <p className="text-xs text-neutral-500">Record moments &amp; observations for reports</p>
        </div>
      </header>

      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">

        {/* Tab switcher */}
        <div className="flex gap-1 bg-neutral-100 rounded-2xl p-1">
          {[
            { id: 'entry' as const, label: '📝 Journal Entry' },
            { id: 'readiness' as const, label: '📋 Report Readiness' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === t.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            JOURNAL ENTRY TAB
        ══════════════════════════════════════════ */}
        {activeTab === 'entry' && (
          <>
            {/* Entry type */}
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Type of entry</label>
              <div className="flex gap-2">
                {(['daily', 'weekly', 'highlight'] as const).map(t => (
                  <button key={t} onClick={() => setEntryType(t)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                      entryType === t ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                    }`}>
                    {t === 'daily' ? '📅 Daily' : t === 'weekly' ? '📆 Weekly' : '⭐ Highlight'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Per-student inline entries ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                  <Users size={13} /> Individual notes
                </label>
                <span className="text-[10px] text-neutral-400">Ask Oakie to format</span>
              </div>
              <div className="flex flex-col gap-2">
                {students.map(student => (
                  <div key={student.id} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50 border-b border-neutral-100">
                      <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                        {student.name[0]}
                      </div>
                      <span className="text-sm font-semibold text-neutral-800 flex-1 truncate">{student.name}</span>
                      {bulkFormatted[student.id] && (
                        <span className="text-[10px] bg-primary-50 text-primary-600 border border-primary-200 px-2 py-0.5 rounded-full font-medium shrink-0">
                          ✨ Formatted
                        </span>
                      )}
                      <button
                        onClick={() => formatBulkWithOakie(student.id)}
                        disabled={bulkFormatting[student.id] || !(bulkTexts[student.id] || '').trim()}
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-lg font-medium transition-colors disabled:opacity-40 shrink-0"
                      >
                        {bulkFormatting[student.id] ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                        Ask Oakie
                      </button>
                    </div>
                    <div className="px-3 py-2">
                      <textarea
                        value={bulkTexts[student.id] || ''}
                        rows={2}
                        onChange={e => {
                          setBulkTexts(prev => ({ ...prev, [student.id]: e.target.value }));
                          if (bulkFormatted[student.id]) setBulkFormatted(prev => ({ ...prev, [student.id]: false }));
                        }}
                        placeholder={`Note for ${student.name.split(' ')[0]}…`}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 bg-white resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {bulkMsg && (
                <p className={`text-sm px-3 py-2 rounded-xl mt-2 ${bulkMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {bulkMsg}
                </p>
              )}

              <button
                onClick={saveBulk}
                disabled={savingBulk || !students.some(s => (bulkTexts[s.id] || '').trim())}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 mt-3"
              >
                {savingBulk
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                  : <><CheckCircle2 className="w-4 h-4" />Save All Entries</>}
              </button>
            </div>

            {/* ── Generic class note ── */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-neutral-800">📢 Generic class note</p>
                <span className="text-[10px] text-neutral-400">Sent to all {students.length} students</span>
              </div>
              <p className="text-xs text-neutral-500 mb-3">Write one note that applies to the whole class — it will be saved for each student individually.</p>
              <div className="flex gap-2 items-start">
                <textarea
                  value={classNoteText}
                  onChange={e => setClassNoteText(e.target.value)}
                  rows={3}
                  placeholder="e.g. Great participation in circle time today!"
                  className="flex-1 px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 bg-white resize-none"
                />
                <button
                  onClick={formatClassNoteWithOakie}
                  disabled={classNoteFormatting || !classNoteText.trim()}
                  className="flex items-center gap-1 text-xs px-3 py-2.5 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-xl font-medium transition-colors disabled:opacity-40 shrink-0"
                >
                  {classNoteFormatting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  Oakie
                </button>
              </div>
              <div className="flex justify-end mt-1 mb-3">
                <span className="text-[10px] text-neutral-300">{classNoteText.length} chars</span>
              </div>
              {classNoteMsg && (
                <p className={`text-xs font-medium mb-2 ${classNoteMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>
                  {classNoteMsg}
                </p>
              )}
              <button
                onClick={saveClassNote}
                disabled={savingClassNote || !classNoteText.trim() || students.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-neutral-800 hover:bg-neutral-900 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {savingClassNote
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                  : <><Send className="w-4 h-4" />Send to All Students</>}
              </button>
            </div>

            {/* Recent entries */}
            {recentEntries.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-neutral-400" />
                  <p className="text-xs font-semibold text-neutral-600">Recent entries</p>
                </div>
                <div className="flex flex-col gap-2">
                  {recentEntries.map(entry => (
                    <div key={entry.id} className="bg-white border border-neutral-100 rounded-xl px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-neutral-800">{entry.student_name}</p>
                        <span className="text-[10px] text-neutral-400">
                          {formatEntryDate(entry.entry_date)} · {entry.entry_type}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-600 leading-relaxed">{entry.beautified_text || entry.raw_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════
            REPORT READINESS TAB
        ══════════════════════════════════════════ */}
        {activeTab === 'readiness' && (
          <>
            {/* Missing observations banner */}
            {studentsWithNoObs.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  ⚠️ You have students with no observations recorded. Please add observations for all students to generate complete term reports.
                </p>
              </div>
            )}

            <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <ClipboardList className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-primary-800 mb-1">Term Report Observations</p>
                  <p className="text-xs text-primary-700 leading-relaxed">
                    To generate a complete term report for each student, please add at least one observation for each category below. These observations are used by Oakie to write meaningful, personalised report sections.
                  </p>
                </div>
              </div>
            </div>

            {/* Per-student readiness grid */}
            <div className="flex flex-col gap-3">
              {students.map(student => {
                const missing = getMissingCategories(student.id);
                const covered = REPORT_CATEGORIES.length - missing.length;
                const pct = Math.round((covered / REPORT_CATEGORIES.length) * 100);
                return (
                  <div key={student.id} className="bg-white border border-neutral-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-700 shrink-0">
                          {student.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-neutral-800">{student.name}</p>
                          <p className="text-xs text-neutral-400">{covered}/{REPORT_CATEGORIES.length} categories covered</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        pct === 100 ? 'bg-emerald-100 text-emerald-700' : pct >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="px-4 pb-3">
                      <div className="w-full bg-neutral-100 rounded-full h-1.5 mb-3 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: pct === 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444',
                          }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {REPORT_CATEGORIES.map(cat => {
                          const isCovered = !missing.includes(cat.key);
                          return (
                            <button
                              key={cat.key}
                              onClick={() => openModal(student, cat)}
                              className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full border transition-colors ${
                                isCovered
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:border-primary-300 hover:text-primary-600'
                              }`}
                            >
                              {isCovered
                                ? <CheckCircle2 className="w-3 h-3" />
                                : <span className="w-3 h-3 rounded-full border border-current inline-block" />}
                              {cat.icon} {cat.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add observation form */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-neutral-800 mb-3">Add Observation</p>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Student</label>
                  <select
                    value={selectedStudent}
                    onChange={e => setSelectedStudent(e.target.value)}
                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30"
                  >
                    <option value="">Select student…</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Category</label>
                  <select
                    value={obsCategory}
                    onChange={e => setObsCategory(e.target.value)}
                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30"
                  >
                    <option value="">Select category…</option>
                    {REPORT_CATEGORIES.map(cat => (
                      <option key={cat.key} value={cat.key}>{cat.icon} {cat.label}</option>
                    ))}
                  </select>
                  {obsCategory && (
                    <p className="text-xs text-neutral-400 mt-1">
                      💡 {REPORT_CATEGORIES.find(c => c.key === obsCategory)?.hint}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-neutral-600">Observation</label>
                    <button
                      onClick={async () => {
                        if (!obsText.trim()) return;
                        setObsFormatting(true);
                        try {
                          const formatted = await askOakieFormat(obsText, selectedStudentName, obsCategory);
                          setObsText(formatted);
                        } catch { /* silently fail */ }
                        finally { setObsFormatting(false); }
                      }}
                      disabled={obsFormatting || !obsText.trim()}
                      className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-lg font-medium transition-colors disabled:opacity-40"
                    >
                      {obsFormatting ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                      Ask Oakie
                    </button>
                  </div>
                  <textarea
                    value={obsText}
                    onChange={e => setObsText(e.target.value)}
                    rows={3}
                    placeholder={obsCategory ? `e.g. ${REPORT_CATEGORIES.find(c => c.key === obsCategory)?.hint}` : 'Describe what you observed…'}
                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none bg-white"
                  />
                </div>

                {obsMsg && (
                  <p className={`text-xs font-medium ${obsMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>
                    {obsMsg}
                  </p>
                )}

                <button
                  onClick={saveObservation}
                  disabled={savingObs || !selectedStudent || !obsCategory || !obsText.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {savingObs
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <CheckCircle2 className="w-4 h-4" />}
                  Save Observation
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

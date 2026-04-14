'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { ChevronLeft, Send, BookOpen, ClipboardList, CheckCircle2, AlertCircle } from 'lucide-react';

interface Student { id: string; name: string; }
interface JourneyEntry {
  id: string; entry_date: string; entry_type: 'daily' | 'weekly' | 'highlight';
  raw_text: string; beautified_text: string; student_name: string;
}
interface ObsRecord { student_id: string; categories: string[]; }

// These are the categories needed for a complete term report
const REPORT_CATEGORIES = [
  { key: 'cognitive',      label: 'Cognitive Skills',          icon: '🧠', hint: 'How the child thinks, solves problems, remembers things' },
  { key: 'language',       label: 'Language & Communication',  icon: '🗣️', hint: 'Speaking, listening, vocabulary, storytelling' },
  { key: 'social',         label: 'Social Interaction',        icon: '🤝', hint: 'How the child plays and works with peers' },
  { key: 'emotional',      label: 'Emotional Development',     icon: '💛', hint: 'Self-regulation, confidence, empathy' },
  { key: 'gross_motor',    label: 'Gross Motor Skills',        icon: '🏃', hint: 'Running, jumping, balance, coordination' },
  { key: 'fine_motor',     label: 'Fine Motor Skills',         icon: '✏️', hint: 'Pencil grip, cutting, drawing, writing' },
  { key: 'creativity',     label: 'Creativity & Expression',   icon: '🎨', hint: 'Art, music, imaginative play, storytelling' },
  { key: 'participation',  label: 'Classroom Participation',   icon: '🙋', hint: 'Engagement, attention, following instructions' },
  { key: 'peer',           label: 'Peer Interaction',          icon: '👫', hint: 'Sharing, taking turns, kindness to classmates' },
  { key: 'behaviour',      label: 'Behavioral Observations',   icon: '⭐', hint: 'Overall behaviour, discipline, positive traits' },
];

const ENTRY_EXAMPLES = {
  daily: [
    "Aarav was very focused during circle time today. He raised his hand to answer questions and helped a friend with their activity.",
    "She struggled a bit with the writing exercise but kept trying. Showed great patience.",
    "Very energetic today — led the group during rhyme time and made everyone laugh.",
  ],
  weekly: [
    "This week Aarav showed great improvement in English speaking. He's more confident and participates without being prompted.",
    "Had a wonderful week — completed all activities, helped peers, and showed curiosity during GK.",
  ],
  highlight: [
    "Today Aarav surprised everyone by reciting the full poem from memory — completely unprompted!",
    "She comforted a crying classmate today with a hug and kind words. A beautiful moment of empathy.",
  ],
};

export default function ChildJourneyPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [entryType, setEntryType] = useState<'daily' | 'weekly' | 'highlight'>('daily');
  const [rawText, setRawText] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [recentEntries, setRecentEntries] = useState<JourneyEntry[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [obsMap, setObsMap] = useState<Record<string, string[]>>({});
  const [activeTab, setActiveTab] = useState<'entry' | 'readiness'>('entry');

  // Observation category for structured entry
  const [obsCategory, setObsCategory] = useState('');
  const [obsText, setObsText] = useState('');
  const [savingObs, setSavingObs] = useState(false);
  const [obsMsg, setObsMsg] = useState('');

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

  async function save() {
    if (!selectedStudent || !rawText.trim()) return;
    setSaving(true); setMsg('');
    try {
      await apiPost('/api/v1/teacher/child-journey', {
        student_id: selectedStudent, entry_type: entryType,
        raw_text: rawText.trim(), send_to_parent: true,
      }, token);
      setMsg('✓ Journey entry saved and sent to parents');
      setRawText('');
      if (sectionId) loadRecentEntries(sectionId);
    } catch (e: any) { setMsg(e.message || 'Failed'); }
    finally { setSaving(false); }
  }

  async function saveObservation() {
    if (!selectedStudent || !obsText.trim() || !obsCategory) return;
    setSavingObs(true); setObsMsg('');
    try {
      await apiPost('/api/v1/teacher/observations', {
        student_id: selectedStudent,
        obs_text: obsText.trim(),
        categories: [obsCategory],
        share_with_parent: false,
      }, token);
      setObsMsg('✓ Observation saved for report');
      setObsText('');
      // Update local obs map
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

  const examples = ENTRY_EXAMPLES[entryType];
  const selectedStudentName = students.find(s => s.id === selectedStudent)?.name || '';
  const missingForSelected = selectedStudent ? getMissingCategories(selectedStudent) : [];

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-neutral-400 hover:text-neutral-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-neutral-900">Child Journey</h1>
          <p className="text-xs text-neutral-500">Record moments & observations for reports</p>
        </div>
      </header>

      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">

        {/* Tab switcher */}
        <div className="flex gap-1 bg-neutral-100 rounded-2xl p-1">
          {[
            { id: 'entry' as const, label: '📝 Journal Entry' },
            { id: 'readiness' as const, label: '📋 Report Readiness' },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === t.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── JOURNAL ENTRY TAB ── */}
        {activeTab === 'entry' && (
          <>
            {/* Student selector */}
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Which student?</label>
              <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                <option value="">Select a student…</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Missing categories nudge */}
            {selectedStudent && missingForSelected.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800 mb-1">
                      {missingForSelected.length} observation{missingForSelected.length > 1 ? 's' : ''} needed for {selectedStudentName}'s term report
                    </p>
                    <p className="text-xs text-amber-700 mb-2">
                      Switch to "Report Readiness" tab to add structured observations for: {missingForSelected.slice(0, 3).map(k => REPORT_CATEGORIES.find(c => c.key === k)?.label).join(', ')}{missingForSelected.length > 3 ? ` +${missingForSelected.length - 3} more` : ''}
                    </p>
                    <button onClick={() => setActiveTab('readiness')}
                      className="text-xs text-amber-700 font-semibold underline underline-offset-2">
                      Add observations →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Entry type */}
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Type of entry</label>
              <div className="flex gap-2">
                {(['daily', 'weekly', 'highlight'] as const).map(t => (
                  <button key={t} onClick={() => setEntryType(t)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${entryType === t ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'}`}>
                    {t === 'daily' ? '📅 Daily' : t === 'weekly' ? '📆 Weekly' : '⭐ Highlight'}
                  </button>
                ))}
              </div>
            </div>

            {/* Text input */}
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Your notes</label>
              <textarea value={rawText} onChange={e => setRawText(e.target.value)} rows={4}
                placeholder={`e.g. "${examples[0]}"`}
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none bg-white" />
              <p className="text-xs text-neutral-400 mt-1">{rawText.length} chars</p>
            </div>

            {/* Examples */}
            <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-3">
              <p className="text-xs font-medium text-neutral-500 mb-2">💡 Examples:</p>
              <div className="flex flex-col gap-1.5">
                {examples.map((ex, i) => (
                  <button key={i} onClick={() => setRawText(ex)}
                    className="text-left text-xs text-neutral-600 px-2.5 py-2 bg-white rounded-lg border border-neutral-100 hover:border-primary-200 hover:text-primary-700 transition-colors">
                    "{ex}"
                  </button>
                ))}
              </div>
            </div>

            {msg && <p className={`text-sm px-3 py-2 rounded-xl ${msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg}</p>}
            <button onClick={save} disabled={saving || !selectedStudent || !rawText.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
              {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : <><Send className="w-4 h-4" />Save & Send to Parents</>}
            </button>

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
                          {new Date(entry.entry_date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {entry.entry_type}
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

        {/* ── REPORT READINESS TAB ── */}
        {activeTab === 'readiness' && (
          <>
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

            {/* Per-student readiness */}
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
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct === 100 ? 'bg-emerald-100 text-emerald-700' : pct >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="px-4 pb-3">
                      <div className="w-full bg-neutral-100 rounded-full h-1.5 mb-3 overflow-hidden">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {REPORT_CATEGORIES.map(cat => {
                          const covered = !missing.includes(cat.key);
                          return (
                            <button key={cat.key}
                              onClick={() => { setSelectedStudent(student.id); setObsCategory(cat.key); setActiveTab('readiness'); }}
                              className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full border transition-colors ${
                                covered
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:border-primary-300 hover:text-primary-600'
                              }`}>
                              {covered ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current inline-block" />}
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
                  <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                    <option value="">Select student…</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Category</label>
                  <select value={obsCategory} onChange={e => setObsCategory(e.target.value)}
                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30">
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
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Observation</label>
                  <textarea value={obsText} onChange={e => setObsText(e.target.value)} rows={3}
                    placeholder={obsCategory ? `e.g. ${REPORT_CATEGORIES.find(c => c.key === obsCategory)?.hint}` : 'Describe what you observed…'}
                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none bg-white" />
                </div>

                {obsMsg && <p className={`text-xs font-medium ${obsMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{obsMsg}</p>}

                <button onClick={saveObservation} disabled={savingObs || !selectedStudent || !obsCategory || !obsText.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                  {savingObs ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
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

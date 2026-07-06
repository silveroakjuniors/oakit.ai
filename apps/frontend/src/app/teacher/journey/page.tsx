'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, apiGet, apiPost, apiPut } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  ChevronLeft, Send, BookOpen, ClipboardList, CheckCircle2, AlertCircle,
  X, Loader2, Sparkles, Users, Wand2, Pencil, Trash2, Calendar,
  ChevronDown, ChevronUp, Eye, EyeOff, Check, CheckCheck,
} from 'lucide-react';
import InlineMicButton from '@/components/InlineMicButton';

interface Student { id: string; name: string; }
interface JourneyEntry {
  id: string; entry_date: string; entry_type: 'daily' | 'weekly' | 'highlight';
  raw_text: string; beautified_text: string; student_name: string;
  student_id: string; is_sent_to_parent: boolean; sent_at: string | null;
  read_at: string | null;
}
interface ObsRecord { student_id: string; categories: string[]; }
interface Observation {
  id: string; student_id: string; obs_text: string; categories: string[];
  share_with_parent: boolean; created_at: string;
}

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
  cognitive: 'cognitive', language: 'language', social: 'social',
  emotional: 'emotional', gross_motor: 'gross_motor', fine_motor: 'fine_motor',
  creativity: 'creativity', participation: 'participation', peer: 'peer', behaviour: 'behaviour',
};

function formatEntryDate(raw: string): string {
  const dateStr = (raw || '').split('T')[0];
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByDate(entries: JourneyEntry[]): Record<string, JourneyEntry[]> {
  const groups: Record<string, JourneyEntry[]> = {};
  for (const e of entries) {
    const key = (e.entry_date || '').split('T')[0];
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }
  return groups;
}

export default function ChildJourneyPage() {
  const router = useRouter();
  const [token, setToken] = useState('');

  const [students, setStudents] = useState<Student[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [allEntries, setAllEntries] = useState<JourneyEntry[]>([]);
  const [obsMap, setObsMap] = useState<Record<string, string[]>>({});
  const [studentObservations, setStudentObservations] = useState<Record<string, Observation[]>>({});
  const [activeTab, setActiveTab] = useState<'entry' | 'history' | 'readiness'>('entry');

  // ── Journal Entry tab state ──
  const [entryType, setEntryType] = useState<'daily' | 'weekly' | 'highlight'>('daily');
  const [bulkTexts, setBulkTexts] = useState<Record<string, string>>({});
  const [bulkFormatting, setBulkFormatting] = useState<Record<string, boolean>>({});
  const [bulkFormatted, setBulkFormatted] = useState<Record<string, boolean>>({});
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkMsg, setBulkMsg] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set()); // track which students got saved this session

  // ── Class note state ──
  const [classNoteText, setClassNoteText] = useState('');
  const [savingClassNote, setSavingClassNote] = useState(false);
  const [classNoteMsg, setClassNoteMsg] = useState('');
  const [classNoteFormatting, setClassNoteFormatting] = useState(false);

  // ── History tab state ──
  const [historyDate, setHistoryDate] = useState('');
  const [historyStudent, setHistoryStudent] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  // Edit entry state
  const [editingEntry, setEditingEntry] = useState<JourneyEntry | null>(null);
  const [editText, setEditText] = useState('');
  const [editFormatting, setEditFormatting] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState('');
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  // ── Report Readiness tab state ──
  const [obsCategory, setObsCategory] = useState('');
  const [obsText, setObsText] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [savingObs, setSavingObs] = useState(false);
  const [obsMsg, setObsMsg] = useState('');
  const [obsFormatting, setObsFormatting] = useState(false);
  const [expandedObsStudent, setExpandedObsStudent] = useState<string | null>(null);
  // Edit observation state
  const [editingObs, setEditingObs] = useState<Observation | null>(null);
  const [editObsText, setEditObsText] = useState('');
  const [editObsSaving, setEditObsSaving] = useState(false);
  const [editObsFormatting, setEditObsFormatting] = useState(false);
  const [deletingObsId, setDeletingObsId] = useState<string | null>(null);

  // ── Observation modal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStudent, setModalStudent] = useState<Student | null>(null);
  const [modalCategory, setModalCategory] = useState<typeof REPORT_CATEGORIES[0] | null>(null);
  const [modalText, setModalText] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const [modalFormatting, setModalFormatting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    const t = getToken() || '';
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadStudents();
  }, [token]);

  async function loadStudents() {
    try {
      const ctx = await apiGet<any>('/api/v1/teacher/context', token);
      if (ctx.section_id) {
        setSectionId(ctx.section_id);
        const data = await apiGet<Student[]>(`/api/v1/teacher/sections/${ctx.section_id}/students`, token);
        setStudents(data || []);
        loadAllEntries(ctx.section_id);
        loadObsMap(ctx.section_id);
      }
    } catch { /* ignore */ }
  }

  async function loadAllEntries(sid: string) {
    try {
      const data = await apiGet<JourneyEntry[]>(`/api/v1/teacher/child-journey?section_id=${sid}`, token);
      setAllEntries(data || []);
      // Auto-expand the most recent date
      if (data && data.length > 0) {
        const firstDate = (data[0].entry_date || '').split('T')[0];
        setExpandedDates(new Set([firstDate]));
      }
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

  async function loadStudentObservations(studentId: string) {
    try {
      const data = await apiGet<Observation[]>(`/api/v1/teacher/observations/${studentId}`, token);
      setStudentObservations(prev => ({ ...prev, [studentId]: data || [] }));
    } catch { /* ignore */ }
  }

  const filteredEntries = useCallback(() => {
    let entries = [...allEntries];
    if (historyDate) entries = entries.filter(e => (e.entry_date || '').startsWith(historyDate));
    if (historyStudent) entries = entries.filter(e => e.student_id === historyStudent);
    return entries;
  }, [allEntries, historyDate, historyStudent]);

  async function askOakieFormat(text: string, studentName?: string, category?: string): Promise<string> {
    const res = await apiPost<{ formatted?: string }>(
      '/api/v1/ai/format-observation',
      { text, student_name: studentName, category, class_name: '' },
      token,
    );
    return res.formatted || text;
  }

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

  async function saveBulk(sendToParent = false) {
    const toSave = students.filter(s => (bulkTexts[s.id] || '').trim());
    if (!toSave.length) return;
    setSavingBulk(true); setBulkMsg('');
    try {
      const results = await Promise.allSettled(toSave.map(student =>
        apiPost('/api/v1/teacher/child-journey', {
          student_id: student.id,
          entry_type: entryType,
          raw_text: bulkTexts[student.id].trim(),
          send_to_parent: sendToParent,
        }, token),
      ));
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      if (succeeded > 0) {
        const newSaved = new Set(savedIds);
        toSave.forEach(s => newSaved.add(s.id));
        setSavedIds(newSaved);
        setBulkTexts({});
        setBulkFormatted({});
      }
      if (failed === 0) {
        const action = sendToParent ? 'Saved & sent to parents' : 'Saved';
        setBulkMsg(`✓ ${action} for ${toSave.length} student${toSave.length > 1 ? 's' : ''}${sendToParent ? '' : ' — visible in History tab'}`);
      } else if (succeeded > 0) {
        setBulkMsg(`✓ Saved for ${succeeded} students, ${failed} failed`);
      } else {
        const firstErr = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
        setBulkMsg(firstErr?.reason?.message || 'Failed to save');
      }
      // Clear history filters and reload
      setHistoryDate('');
      setHistoryStudent('');
      if (sectionId) loadAllEntries(sectionId);
    } catch (e: any) { setBulkMsg(e.message || 'Failed to save'); }
    finally { setSavingBulk(false); }
  }

  async function formatClassNoteWithOakie() {
    if (!classNoteText.trim()) return;
    setClassNoteFormatting(true);
    try { const f = await askOakieFormat(classNoteText); setClassNoteText(f); }
    catch { /* silently fail */ }
    finally { setClassNoteFormatting(false); }
  }

  async function saveClassNote(sendToParent = false) {
    if (!classNoteText.trim() || students.length === 0) return;
    setSavingClassNote(true); setClassNoteMsg('');
    try {
      const results = await Promise.allSettled(students.map(student =>
        apiPost('/api/v1/teacher/child-journey', {
          student_id: student.id, entry_type: entryType,
          raw_text: classNoteText.trim(), send_to_parent: sendToParent,
        }, token)
      ));
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed === 0) {
        const action = sendToParent ? 'Saved & sent to parents' : 'Note saved';
        setClassNoteMsg(`✓ ${action} for all ${students.length} students${sendToParent ? '' : ' — visible in History tab'}`);
        setClassNoteText('');
      } else if (succeeded > 0) {
        setClassNoteMsg(`✓ Saved for ${succeeded} students, ${failed} failed. Check History tab.`);
        setClassNoteText('');
      } else {
        const firstErr = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
        setClassNoteMsg(firstErr?.reason?.message || 'Failed to save');
      }
      // Clear history filters and reload so new entries are visible
      setHistoryDate('');
      setHistoryStudent('');
      if (sectionId) loadAllEntries(sectionId);
    } catch (e: any) { setClassNoteMsg(e.message || 'Failed to save'); }
    finally { setSavingClassNote(false); }
  }

  // ── Edit entry ──
  function startEditEntry(entry: JourneyEntry) {
    setEditingEntry(entry);
    setEditText(entry.raw_text || entry.beautified_text || '');
    setEditMsg('');
  }

  async function saveEditEntry() {
    if (!editingEntry || !editText.trim()) return;
    setEditSaving(true); setEditMsg('');
    try {
      const updated = await fetch(`${API_BASE}/api/v1/teacher/child-journey/${editingEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ raw_text: editText.trim() }),
      }).then(r => r.json());
      if (updated.error) throw new Error(updated.error);
      setAllEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...e, ...updated } : e));
      setEditMsg('✓ Entry updated');
      setTimeout(() => { setEditingEntry(null); setEditMsg(''); }, 1200);
    } catch (e: any) { setEditMsg(e.message || 'Failed to update'); }
    finally { setEditSaving(false); }
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this journal entry? This cannot be undone.')) return;
    setDeletingEntryId(id);
    try {
      const r = await fetch(`${API_BASE}/api/v1/teacher/child-journey/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      setAllEntries(prev => prev.filter(e => e.id !== id));
    } catch (e: any) { alert(e.message || 'Failed to delete'); }
    finally { setDeletingEntryId(null); }
  }

  async function sendToParent(entry: JourneyEntry) {
    try {
      const r = await apiPut<any>(`/api/v1/teacher/child-journey/${entry.id}`, { raw_text: entry.raw_text, send_to_parent: true }, token!);
      setAllEntries(prev => prev.map(e => e.id === entry.id ? { ...e, is_sent_to_parent: true, sent_at: new Date().toISOString() } : e));
    } catch (e: any) { alert(e.message || 'Failed to send'); }
  }

  async function sendAllForDate(date: string) {
    const entries = allEntries.filter(e => (e.entry_date || '').startsWith(date) && !e.is_sent_to_parent);
    if (entries.length === 0) return;
    if (!confirm(`Send ${entries.length} entries to parents?`)) return;
    try {
      await Promise.all(entries.map(entry =>
        apiPut<any>(`/api/v1/teacher/child-journey/${entry.id}`, { raw_text: entry.raw_text, send_to_parent: true }, token!)
      ));
      setAllEntries(prev => prev.map(e =>
        (e.entry_date || '').startsWith(date) ? { ...e, is_sent_to_parent: true, sent_at: new Date().toISOString() } : e
      ));
    } catch (e: any) { alert(e.message || 'Failed to send'); }
  }

  // ── Observations ──
  async function saveObservation() {
    if (!selectedStudent || !obsText.trim() || !obsCategory) return;
    setSavingObs(true); setObsMsg('');
    try {
      const result = await apiPost<Observation>('/api/v1/teacher/observations', {
        student_id: selectedStudent,
        obs_text: obsText.trim(),
        categories: [CATEGORY_DB_MAP[obsCategory] || 'Other'],
        share_with_parent: false,
      }, token);
      setObsMsg('✓ Observation saved — it will be included in the term report');
      setObsText('');
      setObsMap(prev => ({
        ...prev,
        [selectedStudent]: [...(prev[selectedStudent] || []), obsCategory],
      }));
      // Refresh the expanded student's obs list
      if (expandedObsStudent === selectedStudent) loadStudentObservations(selectedStudent);
    } catch (e: any) { setObsMsg(e.message || 'Failed'); }
    finally { setSavingObs(false); }
  }

  async function saveModalObservation() {
    if (!modalStudent || !modalCategory || !modalText.trim()) {
      setModalError('Please write an observation.'); return;
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
      if (expandedObsStudent === modalStudent.id) loadStudentObservations(modalStudent.id);
      setModalOpen(false);
    } catch (e: any) { setModalError(e.message || 'Failed to save'); }
    finally { setModalSaving(false); }
  }

  function startEditObs(obs: Observation) {
    setEditingObs(obs);
    setEditObsText(obs.obs_text || '');
  }

  async function saveEditObs() {
    if (!editingObs || !editObsText.trim()) return;
    setEditObsSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/v1/teacher/observations/${editingObs.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ obs_text: editObsText.trim() }),
      }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      setStudentObservations(prev => ({
        ...prev,
        [editingObs.student_id]: (prev[editingObs.student_id] || []).map(o =>
          o.id === editingObs.id ? { ...o, obs_text: editObsText.trim() } : o
        ),
      }));
      setEditingObs(null);
    } catch (e: any) { alert(e.message || 'Failed to update'); }
    finally { setEditObsSaving(false); }
  }

  async function deleteObs(obs: Observation) {
    if (!confirm('Delete this observation?')) return;
    setDeletingObsId(obs.id);
    try {
      const r = await fetch(`${API_BASE}/api/v1/teacher/observations/${obs.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      setStudentObservations(prev => ({
        ...prev,
        [obs.student_id]: (prev[obs.student_id] || []).filter(o => o.id !== obs.id),
      }));
      // Refresh obsMap
      if (sectionId) loadObsMap(sectionId);
    } catch (e: any) { alert(e.message || 'Failed to delete'); }
    finally { setDeletingObsId(null); }
  }

  async function toggleShareObs(obs: Observation) {
    try {
      const r = await fetch(`${API_BASE}/api/v1/teacher/observations/${obs.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ share_with_parent: !obs.share_with_parent }),
      }).then(r => r.json());
      if (r.error) throw new Error(r.error);
      setStudentObservations(prev => ({
        ...prev,
        [obs.student_id]: (prev[obs.student_id] || []).map(o =>
          o.id === obs.id ? { ...o, share_with_parent: !obs.share_with_parent } : o
        ),
      }));
    } catch { /* silently fail */ }
  }

  function getMissingCategories(studentId: string): string[] {
    const rawCats = obsMap[studentId] || [];
    const covered = new Set(rawCats.map(c => c.toLowerCase()));
    return REPORT_CATEGORIES.filter(cat => !covered.has(cat.key)).map(c => c.key);
  }

  function openModal(student: Student, cat: typeof REPORT_CATEGORIES[0]) {
    setModalStudent(student); setModalCategory(cat);
    setModalText(''); setModalError(''); setModalOpen(true);
  }

  const studentsWithNoObs = students.filter(s => !obsMap[s.id] || obsMap[s.id].length === 0);
  const selectedStudentName = students.find(s => s.id === selectedStudent)?.name || '';
  const grouped = groupByDate(filteredEntries());
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">

      {/* ── Edit Entry Modal ── */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setEditingEntry(null)}>
          <div className="relative w-full lg:w-[480px] bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 bg-primary-50 border-b border-primary-100">
              <div>
                <p className="text-sm font-bold text-neutral-800">Edit Journal Entry</p>
                <p className="text-xs text-neutral-500">{editingEntry.student_name} · {formatEntryDate(editingEntry.entry_date)} · {editingEntry.entry_type}</p>
              </div>
              <button onClick={() => setEditingEntry(null)} className="w-8 h-8 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-neutral-500">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-neutral-600">Entry text</p>
                <button
                  onClick={async () => {
                    if (!editText.trim()) return;
                    setEditFormatting(true);
                    try { const f = await askOakieFormat(editText, editingEntry.student_name); setEditText(f); }
                    catch { /* silently fail */ }
                    finally { setEditFormatting(false); }
                  }}
                  disabled={editFormatting || !editText.trim()}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-lg font-medium disabled:opacity-40"
                >
                  {editFormatting ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                  Ask Oakie
                </button>
              </div>
              <div className="flex gap-2 items-start">
                <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={5} autoFocus
                  className="flex-1 px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none" />
                <InlineMicButton token={token} onTranscript={t => setEditText(prev => prev ? prev + ' ' + t : t)} />
              </div>
              {editMsg && (
                <p className={`text-xs px-3 py-2 rounded-xl ${editMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{editMsg}</p>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setEditingEntry(null)} className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
              <button onClick={saveEditEntry} disabled={editSaving || !editText.trim()}
                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                {editSaving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Observation Modal ── */}
      {editingObs && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setEditingObs(null)}>
          <div className="relative w-full lg:w-[480px] bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 bg-primary-50 border-b border-primary-100">
              <p className="text-sm font-bold text-neutral-800">Edit Observation</p>
              <button onClick={() => setEditingObs(null)} className="w-8 h-8 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-neutral-500"><X size={16} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-neutral-600">Observation text</p>
                <button
                  onClick={async () => {
                    if (!editObsText.trim()) return;
                    setEditObsFormatting(true);
                    try { const f = await askOakieFormat(editObsText); setEditObsText(f); }
                    catch { /* silently fail */ }
                    finally { setEditObsFormatting(false); }
                  }}
                  disabled={editObsFormatting || !editObsText.trim()}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-lg font-medium disabled:opacity-40"
                >
                  {editObsFormatting ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                  Ask Oakie
                </button>
              </div>
              <div className="flex gap-2 items-start">
                <textarea value={editObsText} onChange={e => setEditObsText(e.target.value)} rows={4} autoFocus
                  className="flex-1 px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none" />
                <InlineMicButton token={token} onTranscript={t => setEditObsText(prev => prev ? prev + ' ' + t : t)} />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setEditingObs(null)} className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
              <button onClick={saveEditObs} disabled={editObsSaving || !editObsText.trim()}
                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                {editObsSaving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {editObsSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Observation Popup Modal ── */}
      {modalOpen && modalStudent && modalCategory && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}>
          <div className="relative w-full lg:w-[480px] bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 bg-primary-50 border-b border-primary-100">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{modalCategory.icon}</span>
                <div>
                  <p className="text-sm font-bold text-neutral-800">{modalCategory.label}</p>
                  <p className="text-xs text-neutral-500">{modalStudent.name} · {modalCategory.hint}</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-8 h-8 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-neutral-500"><X size={16} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles size={13} className="text-primary-500" />
                  <p className="text-xs font-semibold text-neutral-600">Oakie suggestions — tap to use</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(AI_SUGGESTIONS[modalCategory.key] || []).map((s, i) => (
                    <button key={i} onClick={() => setModalText(s)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all text-left ${
                        modalText === s ? 'bg-primary-50 border-primary-300 text-primary-700 font-semibold' : 'border-neutral-200 text-neutral-600 hover:border-primary-300 hover:bg-primary-50'
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-neutral-600">Your observation</p>
                  <button
                    onClick={async () => {
                      if (!modalText.trim()) return;
                      setModalFormatting(true);
                      try { const f = await askOakieFormat(modalText, modalStudent.name, modalCategory.label); setModalText(f); }
                      catch { /* silently fail */ }
                      finally { setModalFormatting(false); }
                    }}
                    disabled={modalFormatting || !modalText.trim()}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-lg font-medium disabled:opacity-40"
                  >
                    {modalFormatting ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                    Ask Oakie
                  </button>
                </div>
                <div className="flex gap-2 items-start">
                  <textarea value={modalText} onChange={e => setModalText(e.target.value)}
                    placeholder={`Describe what you observed about ${modalStudent.name.split(' ')[0]}…`}
                    rows={4} autoFocus
                    className="flex-1 px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none" />
                  <InlineMicButton token={token} onTranscript={t => setModalText(prev => prev ? prev + ' ' + t : t)} />
                </div>
              </div>
              <p className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-100 rounded-xl px-3 py-2">
                💡 Observations are saved for the term report. Parents see them when you share the report.
              </p>
              {modalError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{modalError}</p>}
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm text-neutral-600 hover:bg-neutral-50">Cancel</button>
              <button onClick={saveModalObservation} disabled={modalSaving || !modalText.trim()}
                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
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
        {allEntries.length > 0 && (
          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
            {allEntries.length} entries saved
          </span>
        )}
      </header>

      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">

        {/* Tab switcher */}
        <div className="flex gap-1 bg-neutral-100 rounded-2xl p-1">
          {[
            { id: 'entry' as const, label: '📝 Write' },
            { id: 'history' as const, label: `📅 History${allEntries.length > 0 ? ` (${allEntries.length})` : ''}` },
            { id: 'readiness' as const, label: '📋 Readiness' },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === t.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            JOURNAL ENTRY TAB
        ══════════════════════════════════════════ */}
        {activeTab === 'entry' && (
          <>
            {/* Saved confirmation banner */}
            {savedIds.size > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <p className="text-xs text-emerald-800 font-medium">
                  Entries saved successfully. Switch to the <strong>History</strong> tab to view, edit, or delete them.
                </p>
              </div>
            )}

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

            {/* Per-student inline entries */}
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
                      {savedIds.has(student.id) && !(bulkTexts[student.id] || '').trim() && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-medium shrink-0">✓ Saved</span>
                      )}
                      {bulkFormatted[student.id] && (
                        <span className="text-[10px] bg-primary-50 text-primary-600 border border-primary-200 px-2 py-0.5 rounded-full font-medium shrink-0">✨ Formatted</span>
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
                      <div className="flex gap-2 items-start">
                        <textarea
                          value={bulkTexts[student.id] || ''}
                          rows={2}
                          onChange={e => {
                            setBulkTexts(prev => ({ ...prev, [student.id]: e.target.value }));
                            if (bulkFormatted[student.id]) setBulkFormatted(prev => ({ ...prev, [student.id]: false }));
                          }}
                          placeholder={`Note for ${student.name.split(' ')[0]}…`}
                          className="flex-1 px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 bg-white resize-none"
                        />
                        <InlineMicButton token={token} onTranscript={t => {
                          setBulkTexts(prev => ({ ...prev, [student.id]: (prev[student.id] ? prev[student.id] + ' ' : '') + t }));
                          if (bulkFormatted[student.id]) setBulkFormatted(prev => ({ ...prev, [student.id]: false }));
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {bulkMsg && (
                <p className={`text-sm px-3 py-2 rounded-xl mt-2 ${bulkMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {bulkMsg}
                </p>
              )}

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => saveBulk(false)}
                  disabled={savingBulk || !students.some(s => (bulkTexts[s.id] || '').trim())}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-neutral-800 hover:bg-neutral-900 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {savingBulk
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                    : <><CheckCircle2 className="w-4 h-4" />Save Only</>}
                </button>
                <button
                  onClick={() => saveBulk(true)}
                  disabled={savingBulk || !students.some(s => (bulkTexts[s.id] || '').trim())}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {savingBulk
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</>
                    : <><Send className="w-4 h-4" />Save & Send Now</>}
                </button>
              </div>
            </div>

            {/* Generic class note */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-neutral-800">📢 Generic class note</p>
                <span className="text-[10px] text-neutral-400">Saved for all {students.length} students</span>
              </div>
              <p className="text-xs text-neutral-500 mb-3">Write one note that applies to the whole class — saved for each student individually.</p>
              <div className="flex gap-2 items-start">
                <textarea value={classNoteText} onChange={e => setClassNoteText(e.target.value)} rows={3}
                  placeholder="e.g. Great participation in circle time today!"
                  className="flex-1 px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 bg-white resize-none" />
                <div className="flex flex-col gap-2">
                  <InlineMicButton token={token} onTranscript={t => setClassNoteText(prev => prev ? prev + ' ' + t : t)} />
                  <button onClick={formatClassNoteWithOakie} disabled={classNoteFormatting || !classNoteText.trim()}
                    className="flex items-center gap-1 text-xs px-3 py-2.5 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-xl font-medium disabled:opacity-40">
                    {classNoteFormatting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                    Oakie
                  </button>
                </div>
              </div>
              {classNoteMsg && (
                <p className={`text-xs font-medium mt-2 ${classNoteMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{classNoteMsg}</p>
              )}
              <div className="flex gap-2 mt-3">
                <button onClick={() => saveClassNote(false)} disabled={savingClassNote || !classNoteText.trim() || students.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-neutral-800 hover:bg-neutral-900 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                  {savingClassNote
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                    : <><CheckCircle2 className="w-4 h-4" />Save for All</>}
                </button>
                <button onClick={() => saveClassNote(true)} disabled={savingClassNote || !classNoteText.trim() || students.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                  {savingClassNote
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</>
                    : <><Send className="w-4 h-4" />Save & Send All</>}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            HISTORY TAB — date-wise view with edit/delete
        ══════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <>
            {/* Filters */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-neutral-500 mb-1 block uppercase tracking-wide">Filter by date</label>
                <input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-neutral-500 mb-1 block uppercase tracking-wide">Filter by student</label>
                <select value={historyStudent} onChange={e => setHistoryStudent(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                  <option value="">All students</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            {(historyDate || historyStudent) && (
              <button onClick={() => { setHistoryDate(''); setHistoryStudent(''); }}
                className="text-xs text-primary-600 hover:underline self-start">Clear filters</button>
            )}

            {sortedDates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-3xl mb-2">📓</p>
                <p className="text-sm font-semibold text-neutral-600">No entries yet</p>
                <p className="text-xs text-neutral-400 mt-1">Switch to the Write tab to add journal entries</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sortedDates.map(date => {
                  const dayEntries = grouped[date];
                  const isExpanded = expandedDates.has(date);
                  return (
                    <div key={date} className="bg-white border border-neutral-100 rounded-2xl overflow-hidden shadow-sm">
                      {/* Date header */}
                      <button
                        onClick={() => setExpandedDates(prev => {
                          const next = new Set(prev);
                          if (next.has(date)) next.delete(date); else next.add(date);
                          return next;
                        })}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary-500" />
                          <span className="text-sm font-semibold text-neutral-800">{formatEntryDate(date)}</span>
                          <span className="text-[10px] bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">
                            {dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                      </button>

                      {/* Entries for this date */}
                      {isExpanded && (
                        <div className="border-t border-neutral-100">
                          {/* Send All button for unsent entries */}
                          {dayEntries.some(e => !e.is_sent_to_parent) && (
                            <div className="px-4 py-2 bg-primary-50/50 border-b border-neutral-100 flex items-center justify-between">
                              <span className="text-[10px] text-primary-700 font-medium">
                                {dayEntries.filter(e => !e.is_sent_to_parent).length} unsent {dayEntries.filter(e => !e.is_sent_to_parent).length === 1 ? 'entry' : 'entries'}
                              </span>
                              <button onClick={() => sendAllForDate(date)}
                                className="flex items-center gap-1 text-[11px] px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors">
                                <Send size={11} /> Send All to Parents
                              </button>
                            </div>
                          )}
                          <div className="divide-y divide-neutral-50">
                          {dayEntries.map(entry => (
                            <div key={entry.id} className="px-4 py-3">
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                                    {entry.student_name?.[0] || '?'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-neutral-800 truncate">{entry.student_name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] text-neutral-400 capitalize">{entry.entry_type}</span>
                                      {entry.is_sent_to_parent ? (
                                        entry.read_at ? (
                                          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                                            <CheckCheck size={9} /> Read by parent
                                          </span>
                                        ) : (
                                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                                            <Check size={9} /> Sent to parent
                                          </span>
                                        )
                                      ) : (
                                        <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded-full font-medium">
                                          Saved · not sent yet
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {!entry.is_sent_to_parent && (
                                    <button onClick={() => sendToParent(entry)}
                                      className="w-7 h-7 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-600 flex items-center justify-center transition-colors"
                                      title="Send to parent">
                                      <Send size={12} />
                                    </button>
                                  )}
                                  <button onClick={() => startEditEntry(entry)}
                                    className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-primary-50 hover:text-primary-600 flex items-center justify-center text-neutral-500 transition-colors"
                                    title="Edit entry">
                                    <Pencil size={13} />
                                  </button>
                                  <button onClick={() => deleteEntry(entry.id)}
                                    disabled={deletingEntryId === entry.id}
                                    className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-neutral-500 transition-colors disabled:opacity-40"
                                    title="Delete entry">
                                    {deletingEntryId === entry.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-neutral-600 leading-relaxed pl-8">
                                {entry.beautified_text || entry.raw_text}
                              </p>
                            </div>
                          ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════
            REPORT READINESS TAB
        ══════════════════════════════════════════ */}
        {activeTab === 'readiness' && (
          <>
            {studentsWithNoObs.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  {studentsWithNoObs.length} student{studentsWithNoObs.length > 1 ? 's have' : ' has'} no observations yet. Add observations for all students to generate complete term reports.
                </p>
              </div>
            )}

            <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <ClipboardList className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-primary-800 mb-1">Term Report Observations</p>
                  <p className="text-xs text-primary-700 leading-relaxed">
                    Add at least one observation per category for each student. Tap a category badge to add one quickly. Observations are saved here — parents see them only when you share the final report.
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
                const isExpanded = expandedObsStudent === student.id;
                const obsForStudent = studentObservations[student.id] || [];
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
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          pct === 100 ? 'bg-emerald-100 text-emerald-700' : pct >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                        }`}>{pct}%</span>
                        <button
                          onClick={() => {
                            const next = isExpanded ? null : student.id;
                            setExpandedObsStudent(next);
                            if (next && !studentObservations[student.id]) loadStudentObservations(student.id);
                          }}
                          className="text-[10px] text-primary-600 hover:underline font-medium"
                        >
                          {isExpanded ? 'Hide' : 'View'} entries
                        </button>
                      </div>
                    </div>

                    <div className="px-4 pb-3">
                      <div className="w-full bg-neutral-100 rounded-full h-1.5 mb-3 overflow-hidden">
                        <div className="h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {REPORT_CATEGORIES.map(cat => {
                          const isCovered = !missing.includes(cat.key);
                          return (
                            <button key={cat.key} onClick={() => openModal(student, cat)}
                              className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full border transition-colors ${
                                isCovered
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:border-primary-300 hover:text-primary-600'
                              }`}>
                              {isCovered ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current inline-block" />}
                              {cat.icon} {cat.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Expanded observations list */}
                    {isExpanded && (
                      <div className="border-t border-neutral-100 px-4 py-3">
                        {obsForStudent.length === 0 ? (
                          <p className="text-xs text-neutral-400 text-center py-2">No observations saved yet — tap a category above to add one</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {obsForStudent.map(obs => (
                              <div key={obs.id} className="bg-neutral-50 border border-neutral-100 rounded-xl px-3 py-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                      {obs.categories.map(c => {
                                        const cat = REPORT_CATEGORIES.find(rc => rc.key === c || rc.label === c);
                                        return (
                                          <span key={c} className="text-[10px] bg-primary-50 text-primary-700 border border-primary-100 px-1.5 py-0.5 rounded-full">{cat?.label || c}</span>
                                        );
                                      })}
                                      {obs.share_with_parent ? (
                                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                          <Eye size={9} /> Shared with parent
                                        </span>
                                      ) : (
                                        <span className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                          <EyeOff size={9} /> Not shared yet
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-neutral-700 leading-relaxed">{obs.obs_text}</p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => toggleShareObs(obs)}
                                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${obs.share_with_parent ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-neutral-100 text-neutral-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
                                      title={obs.share_with_parent ? 'Unshare from parent' : 'Share with parent'}>
                                      {obs.share_with_parent ? <Eye size={11} /> : <EyeOff size={11} />}
                                    </button>
                                    <button onClick={() => startEditObs(obs)}
                                      className="w-6 h-6 rounded-lg bg-neutral-100 hover:bg-primary-50 hover:text-primary-600 flex items-center justify-center text-neutral-400 transition-colors"
                                      title="Edit observation">
                                      <Pencil size={11} />
                                    </button>
                                    <button onClick={() => deleteObs(obs)}
                                      disabled={deletingObsId === obs.id}
                                      className="w-6 h-6 rounded-lg bg-neutral-100 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-neutral-400 transition-colors disabled:opacity-40"
                                      title="Delete observation">
                                      {deletingObsId === obs.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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
                    {REPORT_CATEGORIES.map(cat => <option key={cat.key} value={cat.key}>{cat.icon} {cat.label}</option>)}
                  </select>
                  {obsCategory && <p className="text-xs text-neutral-400 mt-1">💡 {REPORT_CATEGORIES.find(c => c.key === obsCategory)?.hint}</p>}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-neutral-600">Observation</label>
                    <button
                      onClick={async () => {
                        if (!obsText.trim()) return;
                        setObsFormatting(true);
                        try { const f = await askOakieFormat(obsText, selectedStudentName, obsCategory); setObsText(f); }
                        catch { /* silently fail */ }
                        finally { setObsFormatting(false); }
                      }}
                      disabled={obsFormatting || !obsText.trim()}
                      className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-lg font-medium disabled:opacity-40"
                    >
                      {obsFormatting ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                      Ask Oakie
                    </button>
                  </div>
                  <div className="flex gap-2 items-start">
                    <textarea value={obsText} onChange={e => setObsText(e.target.value)} rows={3}
                      placeholder={obsCategory ? `e.g. ${REPORT_CATEGORIES.find(c => c.key === obsCategory)?.hint}` : 'Describe what you observed…'}
                      className="flex-1 px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none bg-white" />
                    <InlineMicButton token={token} onTranscript={t => setObsText(prev => prev ? prev + ' ' + t : t)} />
                  </div>
                </div>
                {obsMsg && (
                  <p className={`text-xs font-medium px-3 py-2 rounded-xl ${obsMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-500'}`}>{obsMsg}</p>
                )}
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

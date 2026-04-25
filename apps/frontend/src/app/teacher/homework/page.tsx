'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  ChevronLeft, BookOpen, Paperclip, Send, CheckCircle2,
  Clock, AlertCircle, HelpCircle, X, FileText, Calendar, Wand2, Loader2
} from 'lucide-react';
import { Button } from '@/UIComponents';
import InlineMicButton from '@/components/InlineMicButton';

interface Student { id: string; name: string; }
interface HomeworkRecord { raw_text: string; formatted_text: string; }
interface NoteItem {
  id: string; note_text?: string; file_name?: string; file_size?: number;
  expires_at: string; subject?: string; note_date?: string;
}

type HwStatus = 'completed' | 'partial' | 'not_submitted';

const FALLBACK_SUBJECTS = ['English Speaking', 'English', 'Math', 'GK', 'Writing', 'Art', 'Science', 'EVS', 'Hindi', 'Circle Time', 'Morning Meet', 'Other'];

export default function HomeworkNotesPage() {
  const router = useRouter();
  const token = getToken() || '';

  const [sectionId, setSectionId] = useState('');
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [today, setToday] = useState(new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [existingHomework, setExistingHomework] = useState<HomeworkRecord | null>(null);
  const [homeworkText, setHomeworkText] = useState('');
  const [savingHomework, setSavingHomework] = useState(false);
  const [homeworkMsg, setHomeworkMsg] = useState('');
  const [formattingHw, setFormattingHw] = useState(false);
  const [hwSubmissions, setHwSubmissions] = useState<Record<string, HwStatus>>({});
  const [savingHwSubmissions, setSavingHwSubmissions] = useState(false);
  const [hwSubmissionsMsg, setHwSubmissionsMsg] = useState('');
  // Notes — subject + date specific
  const [noteText, setNoteText] = useState('');
  const [noteSubject, setNoteSubject] = useState('');
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [noteMsg, setNoteMsg] = useState('');
  const [formattingNote, setFormattingNote] = useState(false);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [activeSection, setActiveSection] = useState<'homework' | 'tracking' | 'notes'>('homework');
  // Subjects derived from today's plan chunks
  const [subjects, setSubjects] = useState<string[]>(FALLBACK_SUBJECTS);
  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    init();
  }, []);

  async function init() {
    setLoading(true);
    try {
      const ctx = await apiGet<any>('/api/v1/teacher/context', token);
      setTodayCompleted(ctx.today_completed || false);
      const effectiveToday = ctx.today || new Date().toISOString().split('T')[0];
      setToday(effectiveToday);
      setNoteDate(effectiveToday);

      let sid = ctx.section_id || '';
      if (!sid) {
        const secs = await apiGet<{ section_id: string }[]>('/api/v1/teacher/sections', token).catch(() => []);
        sid = secs?.[0]?.section_id || '';
      }
      setSectionId(sid);

      const [hw, ns] = await Promise.all([
        apiGet<HomeworkRecord>('/api/v1/teacher/notes/homework', token).catch(() => null),
        apiGet<NoteItem[]>('/api/v1/teacher/notes', token).catch(() => []),
      ]);
      if (hw) { setExistingHomework(hw); setHomeworkText(hw.raw_text || ''); }
      setNotes(ns || []);

      // Load today's plan to extract subjects from chunks
      apiGet<{ chunks?: { topic_label: string; content: string }[] }>('/api/v1/teacher/plan/today', token)
        .then(plan => {
          if (!plan?.chunks?.length) return;
          const subjectPat = /^(English Speaking|English|Math(?:ematics)?|GK|General Knowledge|Writing|Art|Music|PE|Science|EVS|Hindi|Circle Time|Morning Meet|Regional Language|Additional activities)/im;
          const found = new Set<string>();
          for (const chunk of plan.chunks) {
            for (const line of (chunk.content || '').split('\n')) {
              const m = line.match(subjectPat);
              if (m) found.add(m[1].trim());
            }
            if (chunk.topic_label) {
              const m = chunk.topic_label.match(subjectPat);
              if (m) found.add(m[1].trim());
            }
          }
          if (found.size > 0) setSubjects([...found, 'Other']);
        })
        .catch(() => {});

      if (sid) {
        const [studs, subs] = await Promise.all([
          apiGet<Student[]>(`/api/v1/teacher/sections/${sid}/students`, token).catch(() => []),
          apiGet<{ student_id: string; status: string }[]>(
            `/api/v1/teacher/notes/homework/submissions?date=${effectiveToday}`, token
          ).catch(() => []),
        ]);
        setStudents(studs || []);
        const map: Record<string, HwStatus> = {};
        (subs || []).forEach(s => { map[s.student_id] = s.status as HwStatus; });
        setHwSubmissions(map);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function formatWithOakie(text: string, setter: (t: string) => void, loadingSetter: (b: boolean) => void) {
    if (!text.trim()) return;
    loadingSetter(true);
    try {
      const res = await apiPost<{ formatted?: string; response?: string }>(
        '/api/v1/ai/format-observation',
        { text, category: 'class note', student_name: '' },
        token
      );
      setter(res.formatted || res.response || text);
    } catch { /* silently fail */ }
    finally { loadingSetter(false); }
  }

  async function sendHomework() {
    if (!homeworkText.trim()) return;
    setSavingHomework(true); setHomeworkMsg('');
    try {
      const res = await apiPost<HomeworkRecord>('/api/v1/teacher/notes/homework', {
        raw_text: homeworkText, ...(sectionId ? { section_id: sectionId } : {}),
      }, token);
      setExistingHomework(res);
      setHomeworkMsg('✓ Homework sent to parents');
    } catch (e: unknown) { setHomeworkMsg(e instanceof Error ? e.message : 'Failed'); }
    finally { setSavingHomework(false); }
  }

  async function saveSubmissions() {
    setSavingHwSubmissions(true); setHwSubmissionsMsg('');
    try {
      const submissions = Object.entries(hwSubmissions).map(([student_id, status]) => ({ student_id, status }));
      await apiPost('/api/v1/teacher/notes/homework/submissions', {
        submissions, ...(sectionId ? { section_id: sectionId } : {}),
      }, token);
      setHwSubmissionsMsg('✓ Homework status saved');
    } catch (e: unknown) { setHwSubmissionsMsg(e instanceof Error ? e.message : 'Failed'); }
    finally { setSavingHwSubmissions(false); }
  }

  async function sendNote() {
    setSavingNote(true); setNoteMsg('');
    try {
      if (noteFile) {
        const fd = new FormData();
        fd.append('file', noteFile);
        if (sectionId) fd.append('section_id', sectionId);
        if (noteSubject) fd.append('subject', noteSubject);
        fd.append('note_date', noteDate);
        const res = await fetch(`${API_BASE}/api/v1/teacher/notes/upload`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        await apiPost('/api/v1/teacher/notes', {
          note_text: noteText,
          subject: noteSubject || null,
          note_date: noteDate,
          ...(sectionId ? { section_id: sectionId } : {}),
        }, token);
      }
      setNoteMsg(`✓ Note sent to all parents · expires in 14 days`);
      setNoteText(''); setNoteFile(null); setNoteSubject('');
      const ns = await apiGet<NoteItem[]>('/api/v1/teacher/notes', token).catch(() => []);
      setNotes(ns || []);
    } catch (e: unknown) { setNoteMsg(e instanceof Error ? e.message : 'Failed'); }
    finally { setSavingNote(false); }
  }

  const tabs = [
    { id: 'homework' as const, label: 'Homework' },
    { id: 'tracking' as const, label: 'Tracking' },
    { id: 'notes' as const, label: 'Class Notes' },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-neutral-400 hover:text-neutral-600 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-neutral-900">Homework & Notes</h1>
          <p className="text-xs text-neutral-500">Send updates directly to parents</p>
        </div>
        <button onClick={() => setShowHelp(h => !h)}
          className={`p-2 rounded-xl transition-colors ${showHelp ? 'bg-primary-50 text-primary-600' : 'text-neutral-400 hover:text-neutral-600'}`}>
          <HelpCircle className="w-5 h-5" />
        </button>
      </header>

      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">

        {showHelp && (
          <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-primary-800">How to use Homework & Notes</p>
              <button onClick={() => setShowHelp(false)} className="text-primary-400 hover:text-primary-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { title: 'Send Homework', desc: 'Type today\'s homework. Oakie formats it for parents. Use the mic to dictate.' },
                { title: 'Track Completion', desc: 'Mark each student as Done, Partial, or Not Submitted after homework is sent.' },
                { title: 'Class Notes', desc: 'Add subject-specific notes for today\'s class. Attach session transcripts or PDFs. Parents can download from their portal.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary-200 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">{item.title}</p>
                    <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!todayCompleted && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-800">Today's activities not yet marked done</p>
              <p className="text-xs text-amber-700 mt-0.5">Mark activities first to keep the parent feed accurate.</p>
            </div>
            <button onClick={() => router.back()} className="text-xs text-amber-700 font-medium shrink-0 hover:underline">Go back</button>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 bg-neutral-100 rounded-2xl p-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveSection(tab.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeSection === tab.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── HOMEWORK TAB ── */}
        {activeSection === 'homework' && (
          <div className="flex flex-col gap-3">
            {existingHomework?.formatted_text && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <p className="text-xs font-semibold text-emerald-700">Sent to all parents today</p>
                </div>
                <p className="text-sm text-emerald-800 whitespace-pre-wrap leading-relaxed">{existingHomework.formatted_text}</p>
                <p className="text-xs text-emerald-500 mt-2">Update by typing below and resending.</p>
              </div>
            )}
            <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-neutral-800">Today's Homework</p>
              <div className="flex gap-2 items-start">
                <textarea value={homeworkText} onChange={e => setHomeworkText(e.target.value)}
                  rows={4}
                  placeholder="e.g. Practice writing A-E, count objects at home up to 10, bring a leaf tomorrow"
                  className="flex-1 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none bg-white" />
                <InlineMicButton token={token} onTranscript={t => setHomeworkText(prev => prev ? prev + ' ' + t : t)} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => formatWithOakie(homeworkText, setHomeworkText, setFormattingHw)}
                  disabled={formattingHw || !homeworkText.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-xl text-xs font-medium transition-colors disabled:opacity-40">
                  {formattingHw ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  Ask Oakie to format
                </button>
              </div>
              {homeworkMsg && <p className={`text-xs font-medium ${homeworkMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{homeworkMsg}</p>}
              <Button onClick={sendHomework} loading={savingHomework} disabled={!homeworkText.trim()} fullWidth>
                <Send className="w-4 h-4 mr-1.5" />
                {existingHomework ? 'Update & Resend to Parents' : 'Send Homework to Parents'}
              </Button>
            </div>
          </div>
        )}

        {/* ── TRACKING TAB ── */}
        {activeSection === 'tracking' && (
          <div className="flex flex-col gap-3">
            {!existingHomework ? (
              <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center">
                <BookOpen className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                <p className="text-sm font-semibold text-neutral-700 mb-1">No homework sent yet</p>
                <button onClick={() => setActiveSection('homework')} className="text-xs text-primary-600 font-semibold hover:underline">→ Go to Homework tab</button>
              </div>
            ) : students.length === 0 ? (
              <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center">
                <p className="text-sm text-neutral-400">No students found</p>
              </div>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100">
                  <p className="text-sm font-semibold text-neutral-800">Homework Completion</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{students.length} students</p>
                </div>
                {students.map(student => {
                  const status = hwSubmissions[student.id] || 'not_submitted';
                  return (
                    <div key={student.id} className={`flex items-center gap-3 px-4 py-3 border-b border-neutral-50 last:border-0 ${
                      status === 'completed' ? 'bg-emerald-50/40' : status === 'partial' ? 'bg-amber-50/40' : 'bg-white'
                    }`}>
                      <div className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-neutral-500">{student.name[0]}</span>
                      </div>
                      <span className="text-sm text-neutral-800 flex-1 truncate">{student.name}</span>
                      <div className="flex gap-1 shrink-0">
                        {(['completed', 'partial', 'not_submitted'] as const).map(s => (
                          <button key={s} onClick={() => setHwSubmissions(prev => ({ ...prev, [student.id]: s }))}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              status === s
                                ? s === 'completed' ? 'bg-emerald-500 text-white' : s === 'partial' ? 'bg-amber-500 text-white' : 'bg-red-400 text-white'
                                : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                            }`}>
                            {s === 'completed' ? '✓' : s === 'partial' ? '½' : '✗'}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-100">
                  {hwSubmissionsMsg && <p className={`text-xs font-medium mb-2 ${hwSubmissionsMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{hwSubmissionsMsg}</p>}
                  <Button onClick={saveSubmissions} loading={savingHwSubmissions} disabled={Object.keys(hwSubmissions).length === 0} fullWidth>
                    Save Homework Status
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CLASS NOTES TAB ── */}
        {activeSection === 'notes' && (
          <div className="flex flex-col gap-3">
            <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-800 mb-0.5">Class Notes</p>
                <p className="text-xs text-neutral-400">Subject-specific notes for today's class. Parents can view and download from their portal.</p>
              </div>

              {/* Date + Subject row */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Date</label>
                  <div className="flex items-center gap-1.5 px-3 py-2 border border-neutral-200 rounded-xl bg-neutral-50">
                    <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <input type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)}
                      max={today}
                      className="flex-1 text-sm bg-transparent focus:outline-none text-neutral-700" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Subject</label>
                  <select value={noteSubject} onChange={e => setNoteSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                    <option value="">All subjects</option>
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Note text with mic */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-neutral-600">Note</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => formatWithOakie(noteText, setNoteText, setFormattingNote)}
                      disabled={formattingNote || !noteText.trim()}
                      className="flex items-center gap-1 text-[11px] px-2 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-lg font-medium transition-colors disabled:opacity-40">
                      {formattingNote ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                      Ask Oakie
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                    rows={3}
                    placeholder={noteSubject ? `Notes for ${noteSubject} class today…` : 'e.g. Covered addition up to 10. Students struggled with carrying — will revise tomorrow.'}
                    className="flex-1 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none bg-white" />
                  <InlineMicButton token={token} onTranscript={t => setNoteText(prev => prev ? prev + ' ' + t : t)} />
                </div>
              </div>

              {/* File attach — for session transcripts or PDFs */}
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">
                  Attach file <span className="text-neutral-400 font-normal">(session transcript, PDF, Word — optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-3 py-2.5 border border-neutral-200 rounded-xl bg-neutral-50 text-xs text-neutral-600 cursor-pointer hover:bg-neutral-100 transition-colors flex-1">
                    <Paperclip className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="truncate">{noteFile ? noteFile.name : 'Attach PDF, Word, or text file'}</span>
                    <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
                      onChange={e => setNoteFile(e.target.files?.[0] || null)} />
                  </label>
                  {noteFile && (
                    <button onClick={() => setNoteFile(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-100 transition-colors shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {noteFile && (
                  <p className="text-xs text-neutral-400 mt-1">
                    Session transcript or class document — parents can download this from their portal.
                  </p>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">Notes auto-delete after <strong>14 days</strong>. Remind parents to download attachments.</p>
              </div>

              {noteMsg && <p className={`text-xs font-medium ${noteMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{noteMsg}</p>}

              <Button onClick={sendNote} loading={savingNote} disabled={!noteText.trim() && !noteFile} fullWidth>
                <Send className="w-4 h-4 mr-1.5" />
                Send Note to Parents
              </Button>
            </div>

            {/* Sent notes */}
            {notes.length > 0 && (
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100">
                  <p className="text-sm font-semibold text-neutral-800">Sent Notes</p>
                </div>
                {notes.map(n => {
                  const expiresIn = Math.ceil((new Date(n.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3 border-b border-neutral-50 last:border-0">
                      <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
                        {n.file_name ? <FileText className="w-3.5 h-3.5 text-neutral-400" /> : <BookOpen className="w-3.5 h-3.5 text-neutral-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        {(n as any).subject && <p className="text-[10px] font-semibold text-primary-600 mb-0.5">{(n as any).subject}</p>}
                        <p className="text-sm text-neutral-700 truncate">
                          {n.file_name || (n.note_text?.slice(0, 60) + (n.note_text && n.note_text.length > 60 ? '…' : ''))}
                        </p>
                        <p className={`text-xs mt-0.5 ${expiresIn <= 3 ? 'text-red-500 font-medium' : 'text-neutral-400'}`}>
                          {expiresIn <= 0 ? 'Expires today' : `Expires in ${expiresIn} day${expiresIn !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {notes.length === 0 && (
              <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center">
                <Paperclip className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                <p className="text-sm text-neutral-400">No notes sent yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

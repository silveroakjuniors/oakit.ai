'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { ChevronLeft, Send, BookOpen } from 'lucide-react';

interface Student { id: string; name: string; }
interface JourneyEntry {
  id: string;
  entry_date: string;
  entry_type: 'daily' | 'weekly' | 'highlight';
  raw_text: string;
  beautified_text: string;
  student_name: string;
}

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
      }
    } catch { /* ignore */ }
  }

  async function loadRecentEntries(sid: string) {
    try {
      const data = await apiGet<JourneyEntry[]>(`/api/v1/teacher/child-journey?section_id=${sid}`, token);
      setRecentEntries((data || []).slice(0, 10));
    } catch { /* ignore */ }
  }

  async function save() {
    if (!selectedStudent || !rawText.trim()) return;
    setSaving(true); setMsg('');
    try {
      await apiPost('/api/v1/teacher/child-journey', {
        student_id: selectedStudent,
        entry_type: entryType,
        raw_text: rawText.trim(),
        send_to_parent: true,
      }, token);
      setMsg('✓ Journey entry saved and sent to parents');
      setRawText('');
      if (sectionId) loadRecentEntries(sectionId);
    } catch (e: any) { setMsg(e.message || 'Failed'); }
    finally { setSaving(false); }
  }

  const examples = ENTRY_EXAMPLES[entryType];

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-neutral-400 hover:text-neutral-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-neutral-900">Child Journey</h1>
          <p className="text-xs text-neutral-500">Record moments from your students' day</p>
        </div>
      </header>

      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
        {/* Student selector */}
        <div>
          <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Which student?</label>
          <select
            value={selectedStudent}
            onChange={e => setSelectedStudent(e.target.value)}
            className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30"
          >
            <option value="">Select a student…</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

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

        {/* Text input */}
        <div>
          <label className="text-xs font-medium text-neutral-600 mb-1.5 block">
            Your notes
          </label>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            rows={4}
            placeholder={`e.g. "${examples[0]}"`}
            className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-none bg-white"
          />
          <p className="text-xs text-neutral-400 mt-1">{rawText.length} chars · Keep it short and specific</p>
        </div>

        {/* Example prompts */}
        <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-3">
          <p className="text-xs font-medium text-neutral-500 mb-2">💡 Examples for {entryType} entries:</p>
          <div className="flex flex-col gap-1.5">
            {examples.map((ex, i) => (
              <button key={i} onClick={() => setRawText(ex)}
                className="text-left text-xs text-neutral-600 px-2.5 py-2 bg-white rounded-lg border border-neutral-100 hover:border-primary-200 hover:text-primary-700 transition-colors">
                "{ex}"
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        {msg && <p className={`text-sm px-3 py-2 rounded-xl ${msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg}</p>}
        <button
          onClick={save}
          disabled={saving || !selectedStudent || !rawText.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {saving ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
          ) : (
            <><Send className="w-4 h-4" />Save & Send to Parents</>
          )}
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
                      {new Date(entry.entry_date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {' · '}{entry.entry_type}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed">{entry.beautified_text || entry.raw_text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

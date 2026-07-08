'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface Section { section_id: string; class_name: string; section_label: string; }
interface Chunk { id: string; topic_label: string; }
interface Quiz {
  id: string; subject: string; status: string; is_assigned: boolean;
  due_date: string | null; created_at: string;
  question_count: number; attempts_count: number; avg_pct: number | null;
}
interface Analytics {
  students: { student_id: string; student_name: string; total_quizzes: number; avg_pct: number; subject_breakdown: { subject: string; avg_pct: number; needs_revision: boolean }[] }[];
  class_avg_pct: number;
}

const QUESTION_TYPES = [
  { value: '1_mark', label: '1 Mark' },
  { value: '2_mark', label: '2 Marks' },
  { value: 'mcq', label: 'MCQ' },
  { value: 'true_false', label: 'True/False' },
];

export default function TeacherQuizPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [tab, setTab] = useState<'create' | 'list' | 'analytics'>('list');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const token = getToken();

  const [form, setForm] = useState({
    subject: '', topic_ids: [] as string[],
    question_types: ['1_mark'] as string[],
    time_limit_mins: '', due_date: '',
  });

  function flash(m: string, isErr = false) {
    if (isErr) { setError(m); setMsg(''); } else { setMsg(m); setError(''); }
    setTimeout(() => { setMsg(''); setError(''); }, 4000);
  }

  useEffect(() => {
    if (!token) return;
    apiGet<Section[]>('/api/v1/teacher/sections', token).then(setSections).catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!token || !selectedSection) return;
    apiGet<Chunk[]>(`/api/v1/teacher/coverage?section_id=${selectedSection}`, token)
      .then(data => setChunks(Array.isArray(data) ? data : []))
      .catch(() => setChunks([]));
    apiGet<Quiz[]>(`/api/v1/admin/quizzes`, token)
      .then(data => setQuizzes((data as any[]).filter((q: any) => q.section_id === selectedSection || !q.section_id)))
      .catch(() => setQuizzes([]));
  }, [token, selectedSection]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !selectedSection || !form.topic_ids.length) return;
    setLoading(true);
    try {
      const result = await apiPost<{ quiz_id: string; questions: any[] }>('/api/v1/teacher/quiz/assign', {
        section_id: selectedSection,
        subject: form.subject || 'General',
        topic_ids: form.topic_ids,
        question_types: form.question_types,
        time_limit_mins: form.time_limit_mins ? Number(form.time_limit_mins) : undefined,
        due_date: form.due_date || undefined,
      }, token);
      flash(`✓ Quiz created with ${result.questions.length} questions`);
      setTab('list');
      setForm({ subject: '', topic_ids: [], question_types: ['1_mark'], time_limit_mins: '', due_date: '' });
    } catch (e: any) { flash(e.message, true); }
    finally { setLoading(false); }
  }

  async function activateQuiz(quizId: string) {
    if (!token) return;
    try {
      await apiPost(`/api/v1/teacher/quiz/${quizId}/activate`, {}, token);
      flash('✓ Quiz activated — students can now take it');
      setQuizzes(prev => prev.map(q => q.id === quizId ? { ...q, status: 'active' } : q));
    } catch (e: any) { flash(e.message, true); }
  }

  async function loadAnalytics() {
    if (!token || !selectedSection) return;
    setLoading(true);
    try {
      const data = await apiGet<Analytics>(`/api/v1/teacher/quiz/analytics/${selectedSection}`, token);
      setAnalytics(data);
      setTab('analytics');
    } catch (e: any) { flash(e.message, true); }
    finally { setLoading(false); }
  }

  const inp = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 bg-white';

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quizzes</h1>
        <p className="text-sm text-gray-500 mt-1">Create AI-generated quizzes and track student performance</p>
      </div>

      {/* Section selector */}
      <div className="mb-5">
        <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
          className={`${inp} max-w-xs appearance-none`}>
          <option value="">Select a section...</option>
          {sections.map(s => (
            <option key={s.section_id} value={s.section_id}>{s.class_name} – Section {s.section_label}</option>
          ))}
        </select>
      </div>

      {(msg || error) && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm ${msg ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          {msg || error}
        </div>
      )}

      {selectedSection && (
        <>
          {/* Tabs */}
          <div className="flex gap-2 mb-5 border-b border-gray-100 pb-2">
            {([
              { key: 'list', label: '📋 My Quizzes' },
              { key: 'create', label: '✨ Create Quiz' },
              { key: 'analytics', label: '📊 Analytics' },
            ] as { key: typeof tab; label: string }[]).map(t => (
              <button key={t.key}
                onClick={() => t.key === 'analytics' ? loadAnalytics() : setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  tab === t.key ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'text-gray-500 hover:bg-gray-50'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Quiz list */}
          {tab === 'list' && (
            <div className="space-y-3">
              {!quizzes.length ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
                  No quizzes yet. Create one to get started.
                </div>
              ) : quizzes.map(q => (
                <div key={q.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900 text-sm">{q.subject}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          q.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          q.status === 'draft' ? 'bg-gray-50 text-gray-500 border-gray-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>{q.status}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {q.question_count} questions · {q.attempts_count} attempts
                        {q.avg_pct != null && ` · Avg: ${q.avg_pct}%`}
                        {q.due_date && ` · Due: ${new Date(q.due_date).toLocaleDateString('en-IN')}`}
                      </p>
                    </div>
                    {q.status === 'draft' && (
                      <button onClick={() => activateQuiz(q.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                        Activate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create quiz */}
          {tab === 'create' && (
            <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Subject</label>
                  <input type="text" placeholder="e.g. Mathematics" value={form.subject}
                    onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time Limit (mins)</label>
                  <input type="number" placeholder="e.g. 30" min="5" value={form.time_limit_mins}
                    onChange={e => setForm(p => ({ ...p, time_limit_mins: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Due Date</label>
                  <input type="date" value={form.due_date}
                    onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className={inp} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Question Types</label>
                <div className="flex flex-wrap gap-2">
                  {QUESTION_TYPES.map(qt => (
                    <label key={qt.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.question_types.includes(qt.value)}
                        onChange={e => setForm(p => ({
                          ...p,
                          question_types: e.target.checked
                            ? [...p.question_types, qt.value]
                            : p.question_types.filter(t => t !== qt.value)
                        }))} className="rounded" />
                      {qt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Topics ({form.topic_ids.length} selected)
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1">
                  {!chunks.length ? (
                    <p className="text-xs text-gray-400 p-2">No covered topics found for this section</p>
                  ) : chunks.map(c => (
                    <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded-lg hover:bg-gray-50">
                      <input type="checkbox" checked={form.topic_ids.includes(c.id)}
                        onChange={e => setForm(p => ({
                          ...p,
                          topic_ids: e.target.checked
                            ? [...p.topic_ids, c.id]
                            : p.topic_ids.filter(id => id !== c.id)
                        }))} className="rounded" />
                      <span className="text-gray-700">{c.topic_label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={loading || !form.topic_ids.length || !form.question_types.length}
                className="w-full py-3 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-emerald-600 to-green-500 disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? '✨ Generating quiz...' : '✨ Generate Quiz with Oakie'}
              </button>
            </form>
          )}

          {/* Analytics */}
          {tab === 'analytics' && analytics && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-3xl font-black text-gray-900">{analytics.class_avg_pct}%</p>
                <p className="text-sm text-gray-500 mt-1">Class Average</p>
              </div>
              {analytics.students.map(s => (
                <div key={s.student_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-900 text-sm">{s.student_name}</p>
                    <span className={`text-sm font-bold ${s.avg_pct >= 75 ? 'text-emerald-600' : s.avg_pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {s.avg_pct}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                    <div className={`h-1.5 rounded-full ${s.avg_pct >= 75 ? 'bg-emerald-500' : s.avg_pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${s.avg_pct}%` }} />
                  </div>
                  {s.subject_breakdown.filter(sb => sb.needs_revision).length > 0 && (
                    <p className="text-xs text-red-500">
                      Needs revision: {s.subject_breakdown.filter(sb => sb.needs_revision).map(sb => sb.subject).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

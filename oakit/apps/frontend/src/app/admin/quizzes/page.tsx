'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface Quiz {
  id: string;
  subject: string;
  status: string;
  is_assigned: boolean;
  class_name: string;
  section_label: string;
  teacher_name: string;
  question_count: number;
  attempts_count: number;
  avg_pct: number | null;
  due_date: string | null;
  created_at: string;
}

interface QuizResult {
  attempt_id: string;
  student_name: string;
  total_marks: number;
  scored_marks: number;
  pct: number;
  submitted_at: string;
  status: string;
}

export default function AdminQuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const token = getToken();

  useEffect(() => {
    if (!token) return;
    apiGet<Quiz[]>('/api/v1/admin/quizzes', token)
      .then(setQuizzes).catch(console.error).finally(() => setLoading(false));
  }, [token]);

  async function loadResults(quiz: Quiz) {
    if (!token) return;
    setSelectedQuiz(quiz);
    setResultsLoading(true);
    try {
      const data = await apiGet<QuizResult[]>(`/api/v1/admin/quizzes/${quiz.id}/results`, token);
      setResults(data);
    } catch { setResults([]); }
    finally { setResultsLoading(false); }
  }

  const statusColor = (s: string) =>
    s === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    s === 'draft' ? 'bg-gray-50 text-gray-500 border-gray-200' :
    'bg-blue-50 text-blue-700 border-blue-200';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quizzes</h1>
        <p className="text-sm text-gray-500 mt-1">View all quizzes and student results across the school</p>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : !quizzes.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">No quizzes found</div>
      ) : (
        <div className="space-y-3">
          {quizzes.map(q => (
            <div key={q.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-gray-900 text-sm">{q.subject}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(q.status)}`}>
                      {q.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{q.class_name} – Section {q.section_label} · {q.teacher_name || 'Admin'}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>📝 {q.question_count} questions</span>
                    <span>👥 {q.attempts_count} attempts</span>
                    {q.avg_pct != null && <span>📊 Avg: {q.avg_pct}%</span>}
                    {q.due_date && <span>📅 Due: {new Date(q.due_date).toLocaleDateString('en-IN')}</span>}
                  </div>
                </div>
                {q.attempts_count > 0 && (
                  <button onClick={() => loadResults(q)}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                    View Results
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results modal */}
      {selectedQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">{selectedQuiz.subject} — Results</h2>
                <p className="text-xs text-gray-500">{selectedQuiz.class_name} – Section {selectedQuiz.section_label}</p>
              </div>
              <button onClick={() => setSelectedQuiz(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5">
              {resultsLoading ? (
                <p className="text-gray-400 text-sm">Loading results...</p>
              ) : !results.length ? (
                <p className="text-gray-400 text-sm">No results yet</p>
              ) : (
                <div className="space-y-2">
                  {results.map((r, i) => (
                    <div key={r.attempt_id} className="flex items-center justify-between py-2 border-b border-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                        <p className="text-sm font-medium text-gray-800">{r.student_name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{r.scored_marks}/{r.total_marks}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          r.pct >= 75 ? 'bg-emerald-100 text-emerald-700' :
                          r.pct >= 50 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>{r.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

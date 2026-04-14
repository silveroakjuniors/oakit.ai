'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, Sparkles, CheckCircle2, X, Edit2, Save, Users, ChevronDown, ChevronUp, AlertCircle, Share2, Trash2 } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  fetchAdminClasses,
  fetchAdminStudents,
  fetchProgressReport,
  fetchSavedReports,
  fetchSavedReportById,
  fetchQuizzes,
  fetchQuizResults,
  fetchSchoolReport,
  shareSavedReport,
  deleteSavedReport,
  updateSavedReport,
} from '@/features/admin/api/reports';
import {
  AdminClass,
  AdminStudent,
  AdminProgressReport,
  AdminSchoolReport,
  AdminQuizRow,
  AdminQuizResult,
  AdminSavedReport,
} from '@/features/admin/types';

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2 px-4 py-3 sm:py-4 rounded-lg sm:rounded-xl shadow-xl text-sm font-semibold animate-slide-up ${
      type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      <span className="min-w-0">{message}</span>
      <button onClick={onClose} className="ml-2 shrink-0"><X className="w-4 h-4" /></button>
    </div>
  );
}

export default function AdminReportsPage() {
  const token = getToken() || '';
  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [progressReport, setProgressReport] = useState<AdminProgressReport | null>(null);
  const [schoolReport, setSchoolReport] = useState<AdminSchoolReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'progress' | 'saved' | 'term' | 'school' | 'quizzes'>('progress');
  const [savedReports, setSavedReports] = useState<AdminSavedReport[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [termType, setTermType] = useState<'term' | 'annual'>('term');
  const [termLoading, setTermLoading] = useState(false);
  const [termReport, setTermReport] = useState<AdminProgressReport | null>(null);
  const [termFrom, setTermFrom] = useState(() => {
    const d = new Date(); d.setMonth(5); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [termTo, setTermTo] = useState(new Date().toISOString().split('T')[0]);
  const [quizzes, setQuizzes] = useState<AdminQuizRow[]>([]);
  const [quizResults, setQuizResults] = useState<Record<string, AdminQuizResult[]>>({});
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const cls = classes.find(c => c.id === selectedClass);
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    fetchAdminClasses(token).then(setClasses).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!selectedSection) {
      setStudents([]);
      return;
    }
    fetchAdminStudents(selectedSection, token).then(setStudents).catch(() => {});
  }, [selectedSection, token]);

  useEffect(() => {
    if (activeTab === 'saved') {
      loadSavedReports(selectedStudent || undefined, selectedSection || undefined);
    }
  }, [activeTab, selectedStudent, selectedSection]);

  async function loadSavedReports(studentId?: string, sectionId?: string) {
    setSavedLoading(true);
    try {
      setSavedReports(await fetchSavedReports(studentId, sectionId, token));
    } catch {
      setSavedReports([]);
    } finally {
      setSavedLoading(false);
    }
  }

  async function generateProgressReport() {
    if (!selectedStudent) return;
    setLoading(true);
    setProgressReport(null);
    try {
      const data = await fetchProgressReport(selectedStudent, fromDate, toDate, token, 'progress');
      setProgressReport(data);
      await loadSavedReports(selectedStudent);
    } catch (error: any) {
      showToast(error?.message || 'Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function bulkGenerate() {
    if (!selectedSection || students.length === 0) return;
    setBulkProgress({ done: 0, total: students.length, current: 'Starting…' });
    let succeeded = 0;

    for (let i = 0; i < students.length; i += 1) {
      const student = students[i];
      setBulkProgress({ done: i, total: students.length, current: student.name });
      try {
        await fetchProgressReport(student.id, fromDate, toDate, token, 'progress');
        succeeded += 1;
      } catch {
        // ignore
      }
    }

    setBulkProgress(null);
    await loadSavedReports(undefined, selectedSection);
    setActiveTab('saved');
    showToast(`${succeeded}/${students.length} reports generated`);
  }

  async function saveEdit(reportId: string | undefined) {
    if (!reportId) return;
    setSavingEdit(true);
    try {
      await updateSavedReport(reportId, editText, token);
      setSavedReports(prev => prev.map(r => (r.id === reportId ? { ...r } : r)));
      setEditingReportId(null);
      showToast('Report updated successfully');
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setSavingEdit(false);
    }
  }

  async function generateTermReport() {
    if (!selectedStudent) return;
    setTermLoading(true);
    setTermReport(null);
    try {
      const data = await fetchProgressReport(selectedStudent, termFrom, termTo, token, termType);
      setTermReport(data);
      await loadSavedReports(selectedStudent);
    } catch (error: any) {
      showToast(error?.message || 'Failed to generate', 'error');
    } finally {
      setTermLoading(false);
    }
  }

  async function shareReport(reportId: string | undefined) {
    if (!reportId) return;
    try {
      await shareSavedReport(reportId, token);
      setSavedReports(prev => prev.map(r => (r.id === reportId ? { ...r, shared_with_parent: true } : r)));
      showToast('Report shared with parents');
    } catch {
      showToast('Failed to share', 'error');
    }
  }

  async function deleteReport(reportId: string | undefined) {
    if (!reportId) return;
    if (!confirm('Delete this report permanently?')) return;
    try {
      await deleteSavedReport(reportId, token);
      setSavedReports(prev => prev.filter(r => r.id !== reportId));
      if (progressReport?.report_id === reportId) setProgressReport(null);
      if (termReport?.report_id === reportId) setTermReport(null);
    } catch {
      showToast('Failed to delete', 'error');
    }
  }

  async function loadQuizzes() {
    setQuizzesLoading(true);
    try {
      setQuizzes(await fetchQuizzes(token));
    } catch {
      setQuizzes([]);
    } finally {
      setQuizzesLoading(false);
    }
  }

  async function loadQuizResults(quizId: string) {
    if (quizResults[quizId]) {
      setExpandedQuiz(expandedQuiz === quizId ? null : quizId);
      return;
    }
    try {
      const results = await fetchQuizResults(quizId, token);
      setQuizResults(prev => ({ ...prev, [quizId]: results }));
      setExpandedQuiz(quizId);
    } catch {
      // ignore
    }
  }

  function downloadReportAsText(report: AdminProgressReport) {
    const clean = (report.ai_report || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
    const lines = [
      report.school_name,
      `PROGRESS REPORT — ${report.student_name}`,
      `Period: ${report.from_date} to ${report.to_date}`,
      '',
      clean,
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Report_${report.student_name}_${report.from_date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-100">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Bulk Progress Modal */}
      {bulkProgress && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xl w-full max-w-sm">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-blue-600 animate-pulse" />
            </div>
            <p className="text-base font-bold text-center text-neutral-900">Generating Reports</p>
            <p className="text-xs text-center text-neutral-500 mt-2">{bulkProgress.current}</p>
            <div className="w-full bg-neutral-200 rounded-full h-2 mt-4 mb-2 overflow-hidden">
              <div className="h-2 bg-blue-600 transition-all" style={{ width: `${Math.round((bulkProgress.done / bulkProgress.total) * 100)}%` }} />
            </div>
            <p className="text-xs text-center text-neutral-500">{bulkProgress.done} of {bulkProgress.total}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-neutral-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Reports</h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">Generate and manage student reports</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-16 sm:top-20 z-30 bg-white border-b border-neutral-200 overflow-x-auto">
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex gap-1 sm:gap-2 py-3">
            {([
              { id: 'progress', label: '🌟 Progress', icon: 'progress' },
              { id: 'saved', label: '📁 Saved', icon: 'saved' },
              { id: 'term', label: '📋 Term', icon: 'term' },
              { id: 'school', label: '🏫 School', icon: 'school' },
              { id: 'quizzes', label: '📝 Quizzes', icon: 'quizzes' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => {
                setActiveTab(t.id);
                if (t.id === 'quizzes' && quizzes.length === 0) loadQuizzes();
                if (t.id === 'saved') loadSavedReports(selectedStudent || undefined, selectedSection || undefined);
              }} className={`px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === t.id
                  ? 'bg-blue-100 text-blue-700 shadow-sm'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl mx-auto space-y-6">
        {/* Student Selector */}
        {(activeTab === 'progress' || activeTab === 'term') && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 sm:p-6">
            <p className="text-sm font-semibold text-neutral-700 mb-4">Select Student</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <select value={selectedClass} onChange={e => {setSelectedClass(e.target.value); setSelectedSection(''); setSelectedStudent('');}} 
                className="px-3 sm:px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {cls && (
                <select value={selectedSection} onChange={e => {setSelectedSection(e.target.value); setSelectedStudent('');}} 
                  className="px-3 sm:px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Section</option>
                  {cls.sections.map(s => <option key={s.id} value={s.id}>Section {s.label}</option>)}
                </select>
              )}
              {students.length > 0 && (
                <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} 
                  className="px-3 sm:px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Student</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </div>

            {/* Date Range */}
            {activeTab === 'progress' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-1.5 block">From</label>
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} 
                    className="w-full px-3 sm:px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-1.5 block">To</label>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} 
                    className="w-full px-3 sm:px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}

            {/* Term Type */}
            {activeTab === 'term' && (
              <div className="flex gap-2 mb-4">
                {(['term', 'annual'] as const).map(t => (
                  <button key={t} onClick={() => setTermType(t)} 
                    className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold border-2 transition-all ${
                      termType === t
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300'
                    }`}>
                    {t === 'term' ? 'Term Report' : 'Annual Report'}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'term' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Start</label>
                  <input type="date" value={termFrom} onChange={e => setTermFrom(e.target.value)} 
                    className="w-full px-3 sm:px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-1.5 block">End</label>
                  <input type="date" value={termTo} onChange={e => setTermTo(e.target.value)} 
                    className="w-full px-3 sm:px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button onClick={activeTab === 'progress' ? generateProgressReport : generateTermReport} 
                disabled={!selectedStudent || loading} 
                className="w-full flex items-center justify-center gap-2 py-3 sm:py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors">
                {loading ? (<><Sparkles className="w-4 h-4 animate-spin" />Generating...</>) : (<><Sparkles className="w-4 h-4" />Generate Report</>)}
              </button>
              {selectedSection && students.length > 1 && (
                <button onClick={bulkGenerate} 
                  className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 border-2 border-blue-200 bg-blue-50 text-blue-700 text-sm font-semibold rounded-lg hover:bg-blue-100 transition-colors">
                  <Users className="w-4 h-4" />Generate for {students.length} Students
                </button>
              )}
            </div>
          </div>
        )}

        {/* Saved Reports */}
        {activeTab === 'saved' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-700">📌 {savedReports.length} report{savedReports.length !== 1 ? 's' : ''} available</p>
              <button onClick={() => loadSavedReports()} className="text-xs text-blue-600 hover:underline font-medium">Refresh</button>
            </div>

            {savedLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-neutral-200 animate-pulse" />)}
              </div>
            ) : savedReports.length === 0 ? (
              <div className="bg-white rounded-lg border border-neutral-200 p-8 text-center">
                <p className="text-3xl mb-2">📁</p>
                <p className="text-neutral-600 text-sm">No saved reports</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedReports.map(r => (
                  <div key={r.id} className="bg-white rounded-lg border border-neutral-200 p-3 sm:p-4 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-800 truncate">{r.student_name}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{r.class_name} · {r.from_date} to {r.to_date}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {r.shared_with_parent && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-medium">✓ Sent</span>}
                        {!r.shared_with_parent && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded">Draft</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => shareReport(r.id)} 
                        className="text-xs px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors font-medium">
                        <Share2 className="w-3 h-3 inline mr-1" />Share
                      </button>
                      <button onClick={() => updateSavedReport(r.id, '')} 
                        className="text-xs px-2.5 py-1.5 bg-neutral-50 text-neutral-700 border border-neutral-200 rounded hover:bg-neutral-100 transition-colors font-medium">
                        <Edit2 className="w-3 h-3 inline mr-1" />Edit
                      </button>
                      <button onClick={() => deleteReport(r.id)} 
                        className="text-xs px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors font-medium">
                        <Trash2 className="w-3 h-3 inline mr-1" />Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* School Report */}
        {activeTab === 'school' && (
          <div className="space-y-4">
            <button onClick={async () => {setLoading(true); fetchSchoolReport(token).then(setSchoolReport).finally(() => setLoading(false));}} 
              disabled={loading} 
              className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {loading ? 'Generating...' : 'Generate School Report'}
            </button>
            {schoolReport && (
              <div className="bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-4 sm:py-5 text-white">
                  <h2 className="text-lg sm:text-xl font-bold">{schoolReport.school_name}</h2>
                  <p className="text-xs sm:text-sm text-blue-100 mt-1">School Summary Report</p>
                </div>
                <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-neutral-50 rounded-lg p-3">
                      <p className="text-2xl font-bold text-neutral-900">{schoolReport.total_students}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Total Students</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3">
                      <p className="text-2xl font-bold text-emerald-700">{schoolReport.overall_attendance_pct}%</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Attendance</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-2xl font-bold text-blue-700">{schoolReport.overall_coverage_pct}%</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Coverage</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-600 uppercase mb-3">Sections</p>
                    <div className="space-y-2">
                      {schoolReport.sections.map((s, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-neutral-600 w-24 truncate">{s.class_name} {s.section_label}</span>
                          <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                            <div className="h-2 rounded-full" style={{width: `${s.coverage_pct}%`, backgroundColor: s.coverage_pct >= 75 ? '#10b981' : s.coverage_pct >= 40 ? '#f59e0b' : '#ef4444'}} />
                          </div>
                          <span className="text-xs font-bold text-neutral-700 w-10 text-right">{s.coverage_pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quizzes */}
        {activeTab === 'quizzes' && (
          <div className="space-y-3">
            {quizzesLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-16 rounded-lg bg-neutral-200 animate-pulse" />)}
              </div>
            ) : quizzes.length === 0 ? (
              <div className="bg-white rounded-lg border border-neutral-200 p-8 text-center">
                <p className="text-3xl mb-2">📝</p>
                <p className="text-neutral-600 text-sm">No quizzes</p>
              </div>
            ) : (
              quizzes.map(q => (
                <div key={q.id} className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                  <button onClick={() => loadQuizResults(q.id)} 
                    className="w-full flex items-start justify-between p-3 sm:p-4 hover:bg-neutral-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-800">{q.subject}</p>
                      <p className="text-xs text-neutral-500 mt-1">{q.class_name} · Section {q.section_label}</p>
                      <p className="text-xs text-neutral-400 mt-1">{q.question_count} questions · {q.attempts_count}  attempts</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${expandedQuiz === q.id ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedQuiz === q.id && quizResults[q.id] && (
                    <div className="border-t border-neutral-100 px-3 sm:px-4 py-2 sm:py-3 bg-neutral-50 max-h-64 overflow-y-auto">
                      {quizResults[q.id].length === 0 ? (
                        <p className="text-xs text-neutral-500">No submissions</p>
                      ) : (
                        <div className="space-y-2">
                          {quizResults[q.id].map((r, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="font-medium text-neutral-700 truncate">{r.student_name}</span>
                              <span className={`font-bold ${r.pct >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>{r.pct}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Download, Sparkles, FileText, CheckCircle2, X, Edit2, Save, Users } from 'lucide-react';
interface Class { id: string; name: string; sections: { id: string; label: string }[]; }
interface Student { id: string; name: string; class_name: string; section_label: string; }
interface StudentReport {
  school_name: string; student_name: string; class_name: string; section_label: string;
  father_name: string; mother_name: string;
  attendance: { present: number; absent: number; total: number; pct: number };
  curriculum: { covered: number; total: number; pct: number };
  milestones: { achieved: number; total: number; pct: number };
  observations: { obs_text: string; categories: string[]; obs_date: string }[];
}
interface ProgressReport {
  school_name: string; student_name: string; age: string;
  class_name: string; section_label: string; teacher_name: string;
  father_name: string; mother_name: string;
  from_date: string; to_date: string;
  attendance: { present: number; absent: number; total: number; pct: number; absent_dates: string[] };
  curriculum: { covered: number; topics?: string[]; subjects?: string[] };
  missed_topics: string[];
  homework: { completed: number; partial: number; not_submitted: number; total: number };
  milestones: { achieved: number; total: number };
  journey_highlights: string[];
  ai_report: string;
  report_id?: string;
  report_type?: string;
  periods_combined?: number;
}
interface SchoolReport {
  school_name: string; total_students: number;
  overall_attendance_pct: number; overall_coverage_pct: number;
  sections: { class_name: string; section_label: string; coverage_pct: number; total_chunks: number; covered_chunks: number }[];
}
interface QuizRow {
  id: string; subject: string; is_assigned: boolean; status: string; created_at: string;
  time_limit_mins: number | null; due_date: string | null;
  section_label: string; class_name: string; teacher_name: string | null;
  created_by_role: string; question_count: number; attempts_count: number; avg_pct: number | null;
}
interface QuizResult {
  attempt_id: string; student_name: string; total_marks: number; scored_marks: number; pct: number; status: string;
}

// ── Student selector widget ───────────────────────────────────
interface SelectorProps {
  classes: Class[]; cls: Class | undefined;
  selectedClass: string; setSelectedClass: (v: string) => void;
  selectedSection: string; setSelectedSection: (v: string) => void;
  selectedStudent: string; setSelectedStudent: (v: string) => void;
  students: Student[];
}
function StudentSelectorWidget({ classes, cls, selectedClass, setSelectedClass, selectedSection, setSelectedSection, selectedStudent, setSelectedStudent, students }: SelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      <div>
        <label className="text-xs font-medium text-neutral-600 mb-1 block">Class</label>
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none">
          <option value="">Select class</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {cls && (
        <div>
          <label className="text-xs font-medium text-neutral-600 mb-1 block">Section</label>
          <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
            className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none">
            <option value="">Select section</option>
            {cls.sections.map(s => <option key={s.id} value={s.id}>Section {s.label}</option>)}
          </select>
        </div>
      )}
      {students.length > 0 && (
        <div>
          <label className="text-xs font-medium text-neutral-600 mb-1 block">Student</label>
          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
            className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none">
            <option value="">Select student</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

// ── Toast notification ────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold animate-slide-up ${
      type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
      {message}
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

export default function ReportsPage() {
  const token = getToken() || '';
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [studentReport, setStudentReport] = useState<StudentReport | null>(null);
  const [progressReport, setProgressReport] = useState<ProgressReport | null>(null);
  const [schoolReport, setSchoolReport] = useState<SchoolReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'progress' | 'saved' | 'term' | 'school' | 'quizzes'>('progress');
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [termType, setTermType] = useState<'term' | 'annual'>('term');
  const [termTitle, setTermTitle] = useState('');
  const [termLoading, setTermLoading] = useState(false);
  const [termReport, setTermReport] = useState<ProgressReport | null>(null);
  // Term date range — defaults to school year start
  const [termFrom, setTermFrom] = useState(() => {
    const d = new Date(); d.setMonth(5); d.setDate(1); return d.toISOString().split('T')[0]; // June 1
  });
  const [termTo, setTermTo] = useState(new Date().toISOString().split('T')[0]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [quizResults, setQuizResults] = useState<Record<string, QuizResult[]>>({});
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const reportRef = useRef<HTMLDivElement>(null);

  // Toast, bulk generate, edit state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => setToast({ message, type }), []);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [sharedWarningId, setSharedWarningId] = useState<string | null>(null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    apiGet<Class[]>('/api/v1/admin/classes', token).then(setClasses).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSection) { setStudents([]); return; }
    apiGet<Student[]>(`/api/v1/admin/students?section_id=${selectedSection}`, token).then(setStudents).catch(() => {});
  }, [selectedSection]);

  async function generateProgressReport() {
    if (!selectedStudent) return;
    setLoading(true); setProgressReport(null);
    try {
      const data = await apiGet<ProgressReport>(
        `/api/v1/admin/reports/progress-report?student_id=${selectedStudent}&from=${fromDate}&to=${toDate}`,
        token
      );
      setProgressReport(data);
      await loadSavedReports(selectedStudent);
    } catch (e: any) { showToast(e.message || 'Failed to generate report', 'error'); }
    finally { setLoading(false); }
  }

  // Bulk generate for all students in section
  async function bulkGenerate() {
    if (!selectedSection || students.length === 0) return;
    setBulkProgress({ done: 0, total: students.length, current: 'Starting…' });
    let succeeded = 0;
    let failed = 0;
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      setBulkProgress({ done: i, total: students.length, current: student.name });
      try {
        await apiGet<ProgressReport>(
          `/api/v1/admin/reports/progress-report?student_id=${student.id}&from=${fromDate}&to=${toDate}`, token
        );
        succeeded++;
      } catch { failed++; }
    }
    setBulkProgress(null);
    // Load all reports for this section
    await loadSavedReports(undefined, selectedSection);
    setActiveTab('saved');
    showToast(
      failed > 0
        ? `${succeeded} reports generated · ${failed} failed. Check Saved Reports.`
        : `All ${succeeded} reports generated! View and share from Saved Reports tab.`
    );
  }

  async function saveEdit(reportId: string) {
    setSavingEdit(true);
    try {
      await fetch(`${API_BASE}/api/v1/admin/reports/saved/${reportId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_report: editText }),
      });
      setSavedReports(prev => prev.map(r => r.id === reportId ? { ...r, ai_report: editText } : r));
      setEditingReportId(null);
      showToast('Report saved successfully');
    } catch { showToast('Failed to save', 'error'); }
    finally { setSavingEdit(false); }
  }

  async function generateStudentReport() {
    if (!selectedStudent) return;
    setLoading(true); setStudentReport(null);
    try { setStudentReport(await apiGet<StudentReport>(`/api/v1/admin/reports/student/${selectedStudent}`, token)); }
    catch {}
    finally { setLoading(false); }
  }

  async function generateSchoolReport() {
    setLoading(true); setSchoolReport(null);
    try { setSchoolReport(await apiGet<SchoolReport>('/api/v1/admin/reports/school', token)); }
    catch {}
    finally { setLoading(false); }
  }

  async function loadSavedReports(sid?: string, sectionId?: string) {
    setSavedLoading(true);
    try {
      let url = '/api/v1/admin/reports/saved';
      if (sid) url += `?student_id=${sid}`;
      else if (sectionId) url += `?section_id=${sectionId}`;
      setSavedReports(await apiGet<any[]>(url, token));
    } catch {} finally { setSavedLoading(false); }
  }

  async function generateTermReport() {
    if (!selectedStudent) return;
    setTermLoading(true); setTermReport(null);
    try {
      // Term/Annual = same progress-report endpoint with wider date range
      const data = await apiGet<ProgressReport>(
        `/api/v1/admin/reports/progress-report?student_id=${selectedStudent}&from=${termFrom}&to=${termTo}&report_type=${termType}`,
        token
      );
      setTermReport(data);
      await loadSavedReports(selectedStudent);
      showToast(`${termType === 'annual' ? 'Annual' : 'Term'} report generated for ${data.student_name}`);
    } catch (e: any) { showToast(e.message || 'Failed to generate', 'error'); }
    finally { setTermLoading(false); }
  }

  async function shareReport(reportId: string) {
    try {
      await apiPost(`/api/v1/admin/reports/saved/${reportId}/share`, {}, token);
      setSavedReports(prev => prev.map(r => r.id === reportId ? { ...r, shared_with_parent: true } : r));
      showToast('Report shared with parents successfully');
    } catch { showToast('Failed to share report', 'error'); }
  }

  async function deleteReport(reportId: string, skipConfirm = false) {
    if (!skipConfirm && !confirm('Delete this report? This cannot be undone.')) return;
    try {
      await fetch(`${API_BASE}/api/v1/admin/reports/saved/${reportId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      setSavedReports(prev => prev.filter(r => r.id !== reportId));
      if (progressReport?.report_id === reportId) setProgressReport(null);
      if (termReport?.report_id === reportId) setTermReport(null);
    } catch { showToast('Failed to delete', 'error'); }
  }

  async function loadQuizzes() {
    setQuizzesLoading(true);
    try { setQuizzes(await apiGet<QuizRow[]>('/api/v1/admin/quizzes', token)); }
    catch {}
    finally { setQuizzesLoading(false); }
  }

  async function loadQuizResults(quizId: string) {
    if (quizResults[quizId]) { setExpandedQuiz(expandedQuiz === quizId ? null : quizId); return; }
    try {
      const data = await apiGet<QuizResult[]>(`/api/v1/admin/quizzes/${quizId}/results`, token);
      setQuizResults(prev => ({ ...prev, [quizId]: data }));
      setExpandedQuiz(quizId);
    } catch {}
  }

  function downloadReport() {
    if (!progressReport?.report_id) return;
    downloadReportById(progressReport.report_id, progressReport.student_name);
  }

  async function downloadReportById(reportId: string, studentName: string) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/reports/saved/${reportId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Progress_Report_${studentName.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { showToast(e.message || 'PDF download failed', 'error'); }
  }

  const cls = classes.find(c => c.id === selectedClass);

  return (
    <div className="p-6 max-w-4xl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Bulk generate progress overlay */}
      {bulkProgress && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl w-80 text-center">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-primary-600 animate-pulse" />
            </div>
            <p className="text-sm font-bold text-neutral-800 mb-1">Generating Reports</p>
            <p className="text-xs text-neutral-500 mb-4">{bulkProgress.current || 'Starting…'}</p>
            <div className="w-full bg-neutral-100 rounded-full h-2 mb-2 overflow-hidden">
              <div className="h-2 rounded-full bg-primary-600 transition-all duration-300"
                style={{ width: `${Math.round((bulkProgress.done / bulkProgress.total) * 100)}%` }} />
            </div>
            <p className="text-xs text-neutral-400">{bulkProgress.done} of {bulkProgress.total} students</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-neutral-900">Reports</h1>
      </div>
      <p className="text-sm text-neutral-500 mb-6">Generate student progress reports, school summaries, and quiz results</p>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 mb-6 w-fit flex-wrap">
        {([
          { id: 'progress', label: '🌟 Progress Report' },
          { id: 'saved',    label: '📁 Saved Reports' },
          { id: 'term',     label: '📋 Term / Annual' },
          { id: 'school',   label: '🏫 School Summary' },
          { id: 'quizzes',  label: '📝 Quizzes' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => {
            setActiveTab(t.id);
            if (t.id === 'quizzes' && quizzes.length === 0) loadQuizzes();
            if (t.id === 'saved') loadSavedReports(selectedStudent || undefined);
          }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PROGRESS REPORT TAB ── */}
      {activeTab === 'progress' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-800">AI-Powered Progress Report</p>
                <p className="text-xs text-neutral-500">Comprehensive report with development overview, attendance, curriculum, and personalised insights</p>
              </div>
            </div>

            <StudentSelectorWidget
              classes={classes} cls={cls}
              selectedClass={selectedClass} setSelectedClass={v => { setSelectedClass(v); setSelectedSection(''); setSelectedStudent(''); }}
              selectedSection={selectedSection} setSelectedSection={v => { setSelectedSection(v); setSelectedStudent(''); }}
              selectedStudent={selectedStudent} setSelectedStudent={setSelectedStudent}
              students={students}
            />

            {/* Date range */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="text-xs font-medium text-neutral-600 mb-1 block">From</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-neutral-600 mb-1 block">To</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none" />
              </div>
            </div>

            <button onClick={generateProgressReport} disabled={!selectedStudent || loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors">
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating with Oakie…</>
              ) : (
                <><Sparkles className="w-4 h-4" />Generate Progress Report</>
              )}
            </button>

            {/* Bulk generate — all students in section */}
            {selectedSection && students.length > 1 && (
              <button onClick={bulkGenerate} disabled={!!bulkProgress}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-primary-200 bg-primary-50 text-primary-700 text-sm font-bold rounded-xl hover:bg-primary-100 transition-colors disabled:opacity-50">
                <Users className="w-4 h-4" />
                Generate for All {students.length} Students in Section
              </button>
            )}
          </div>

          {progressReport && <ProgressReportCard report={progressReport} onDownload={downloadReport}
            onShare={progressReport.report_id ? () => shareReport(progressReport.report_id!) : undefined}
            onDelete={progressReport.report_id ? () => deleteReport(progressReport.report_id!) : undefined}
          />}
        </div>
      )}

      {/* ── SAVED REPORTS TAB ── */}
      {activeTab === 'saved' && (
        <div className="flex flex-col gap-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox"
                  checked={savedReports.length > 0 && savedReports.every(r => selectedReportIds.includes(r.id))}
                  onChange={e => setSelectedReportIds(e.target.checked ? savedReports.map(r => r.id) : [])}
                  className="w-4 h-4 rounded" />
                <span className="text-xs font-medium text-neutral-600">
                  {selectedReportIds.length > 0 ? `${selectedReportIds.length} selected` : 'Select all'}
                </span>
              </label>
              {selectedReportIds.length > 0 && (
                <>
                  <button onClick={async () => {
                    const toShare = savedReports.filter(r => selectedReportIds.includes(r.id) && !r.shared_with_parent);
                    if (toShare.length === 0) { showToast('All selected reports are already shared', 'error'); return; }
                    for (const r of toShare) await shareReport(r.id);
                    showToast(`${toShare.length} report${toShare.length > 1 ? 's' : ''} shared with parents`);
                    setSelectedReportIds([]);
                  }}
                    className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 font-medium transition-colors">
                    📤 Share Selected ({savedReports.filter(r => selectedReportIds.includes(r.id) && !r.shared_with_parent).length} unshared)
                  </button>
                  <button onClick={async () => {
                    const sharedCount = savedReports.filter(r => selectedReportIds.includes(r.id) && r.shared_with_parent).length;
                    const msg = sharedCount > 0
                      ? `Delete ${selectedReportIds.length} report${selectedReportIds.length > 1 ? 's' : ''} (${sharedCount} already sent to parents)?`
                      : `Delete ${selectedReportIds.length} report${selectedReportIds.length > 1 ? 's' : ''}?`;
                    if (!confirm(msg)) return;
                    for (const id of selectedReportIds) await deleteReport(id, true);
                    showToast(`${selectedReportIds.length} report${selectedReportIds.length > 1 ? 's' : ''} deleted`);
                    setSelectedReportIds([]);
                  }}
            
                    className="text-xs px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 font-medium transition-colors">
                    🗑 Delete Selected
                  </button>
                </>
              )}
            </div>
            <button onClick={() => loadSavedReports(selectedStudent || undefined)} className="text-xs text-primary-600 hover:underline">↺ Refresh</button>
          </div>

          {/* Info banner */}
          {savedReports.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className="text-sm">💡</span>
              <p className="text-xs text-amber-700">Reports are saved here. To send to parents, select and click <strong>Share Selected</strong> — parents will see it in their portal.</p>
            </div>
          )}

          {savedLoading && <p className="text-sm text-neutral-400 text-center py-4">Loading…</p>}
          {!savedLoading && savedReports.length === 0 && (
            <div className="bg-white border border-neutral-100 rounded-2xl p-8 text-center">
              <p className="text-3xl mb-2">📁</p>
              <p className="text-sm text-neutral-500">No saved reports yet. Generate a Progress Report first.</p>
            </div>
          )}

          {savedReports.map(r => (
            <div key={r.id} className={`bg-white border rounded-2xl p-4 shadow-sm transition-colors ${selectedReportIds.includes(r.id) ? 'border-primary-300 bg-primary-50/30' : 'border-neutral-100'}`}>
              <div className="flex items-start gap-3">
                {/* Checkbox — warns if report was shared with parents */}
                <div className="shrink-0 mt-1">
                  <input type="checkbox" checked={selectedReportIds.includes(r.id)}
                    onChange={e => {
                      if (e.target.checked && r.shared_with_parent) {
                        // Show inline warning before adding to selection
                        setSharedWarningId(r.id);
                      } else {
                        setSharedWarningId(null);
                        setSelectedReportIds(prev => e.target.checked ? [...prev, r.id] : prev.filter(id => id !== r.id));
                      }
                    }}
                    className="w-4 h-4 rounded cursor-pointer" />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Shared-report selection warning */}
                  {sharedWarningId === r.id && (
                    <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
                      <span className="text-base shrink-0">⚠️</span>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-amber-800 mb-1">
                          This report was already sent to parents
                        </p>
                        <p className="text-xs text-amber-700 mb-2">
                          Selecting it for deletion will remove it permanently. Parents will no longer be able to view it.
                          Are you sure you want to include it?
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            setSelectedReportIds(prev => [...prev, r.id]);
                            setSharedWarningId(null);
                          }}
                            className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors">
                            Yes, include for deletion
                          </button>
                          <button onClick={() => setSharedWarningId(null)}
                            className="text-xs px-3 py-1.5 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold text-neutral-800">{r.student_name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          r.report_type === 'annual' ? 'bg-purple-100 text-purple-700' :
                          r.report_type === 'term' ? 'bg-blue-100 text-blue-700' : 'bg-primary-100 text-primary-700'
                        }`}>{r.report_type}</span>
                        {r.shared_with_parent
                          ? <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">✓ Sent to parents</span>
                          : <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Not sent yet</span>
                        }
                      </div>
                      <p className="text-xs text-neutral-500">{r.class_name} · {r.from_date} → {r.to_date}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{r.created_at?.split('T')[0]}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                      <button onClick={() => downloadReportById(r.id, r.student_name || 'report')}
                        className="text-xs px-2.5 py-1.5 bg-neutral-50 text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition-colors font-medium">
                        ↓ PDF
                      </button>
                      {!r.shared_with_parent && (
                        <button onClick={() => shareReport(r.id)}
                          className="text-xs px-2.5 py-1.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-xl hover:bg-primary-100 transition-colors font-medium">
                          📤 Share
                        </button>
                      )}
                      <button onClick={async () => {
                        const full = await apiGet<ProgressReport>(`/api/v1/admin/reports/saved/${r.id}`, token).catch(() => null);
                        if (full) { setEditingReportId(r.id); setEditText(full.ai_report || ''); }
                      }}
                        className="text-xs px-2.5 py-1.5 bg-neutral-50 text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition-colors font-medium">
                        <Edit2 className="w-3 h-3 inline mr-0.5" />Edit
                      </button>
                      <button onClick={() => deleteReport(r.id)}
                        className="text-xs px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 transition-colors font-medium">
                        🗑
                      </button>
                    </div>
                  </div>

                  {/* Inline edit panel */}
                  {editingReportId === r.id && (
                    <div className="mt-3 border-t border-neutral-100 pt-3">
                      <p className="text-xs font-semibold text-neutral-600 mb-2">Edit Report Content</p>
                      <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={12}
                        className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary-400/30 resize-y bg-neutral-50" />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => saveEdit(r.id)} disabled={savingEdit}
                          className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-xs font-bold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors">
                          <Save className="w-3.5 h-3.5" />{savingEdit ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button onClick={() => setEditingReportId(null)}
                          className="px-4 py-2 border border-neutral-200 text-neutral-600 text-xs rounded-xl hover:bg-neutral-50">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TERM / ANNUAL REPORT TAB ── */}
      {activeTab === 'term' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl">📋</div>
              <div>
                <p className="text-sm font-bold text-neutral-800">Term / Annual Report</p>
                <p className="text-xs text-neutral-500">
                  Select a student and date range — Oakie generates a comprehensive report covering the full period.
                  Term = one term dates. Annual = full school year start to end.
                </p>
              </div>
            </div>

            <StudentSelectorWidget
              classes={classes} cls={cls}
              selectedClass={selectedClass} setSelectedClass={v => { setSelectedClass(v); setSelectedSection(''); setSelectedStudent(''); }}
              selectedSection={selectedSection} setSelectedSection={v => { setSelectedSection(v); setSelectedStudent(''); }}
              selectedStudent={selectedStudent} setSelectedStudent={setSelectedStudent}
              students={students}
            />

            {/* Report type + date range */}
            <div className="mb-4">
              <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Report Type</label>
              <div className="flex gap-2 mb-3">
                {(['term', 'annual'] as const).map(t => (
                  <button key={t} onClick={() => {
                    setTermType(t);
                    if (t === 'annual') {
                      // Default to school year: June 1 to March 31
                      const yr = new Date().getFullYear();
                      setTermFrom(`${yr}-06-01`);
                      setTermTo(`${yr + 1}-03-31`);
                    }
                  }}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${termType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'}`}>
                    {t === 'term' ? '📅 Term Report' : '🎓 Annual Report'}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">
                    {termType === 'annual' ? 'School Year Start' : 'Term Start'}
                  </label>
                  <input type="date" value={termFrom} onChange={e => setTermFrom(e.target.value)}
                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">
                    {termType === 'annual' ? 'School Year End' : 'Term End'}
                  </label>
                  <input type="date" value={termTo} onChange={e => setTermTo(e.target.value)}
                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
                </div>
              </div>
              <p className="text-xs text-neutral-400 mt-1.5">
                {termType === 'annual'
                  ? 'Covers the full school year — all topics, attendance, and observations from start to end'
                  : 'Covers one term — all data between the selected dates'}
              </p>
            </div>

            <button onClick={generateTermReport}
              disabled={!selectedStudent || termLoading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors">
              {termLoading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating {termType} report…</>
              ) : (
                <>📋 Generate {termType === 'annual' ? 'Annual' : 'Term'} Report</>
              )}
            </button>
            {!selectedStudent && (
              <p className="text-xs text-amber-600 mt-2 text-center">Select a student above to generate the report</p>
            )}

            {/* Bulk term generate for all students in section */}
            {selectedSection && students.length > 1 && (
              <button onClick={async () => {
                setBulkProgress({ done: 0, total: students.length, current: 'Starting…' });
                let succeeded = 0; let failed = 0;
                for (let i = 0; i < students.length; i++) {
                  const student = students[i];
                  setBulkProgress({ done: i, total: students.length, current: student.name });
                  try {
                    await apiGet<ProgressReport>(
                      `/api/v1/admin/reports/progress-report?student_id=${student.id}&from=${termFrom}&to=${termTo}&report_type=${termType}`, token
                    );
                    succeeded++;
                  } catch { failed++; }
                }
                setBulkProgress(null);
                await loadSavedReports(undefined, selectedSection);
                setActiveTab('saved');
                showToast(
                  failed > 0
                    ? `${succeeded} ${termType} reports generated · ${failed} failed. View in Saved Reports.`
                    : `All ${succeeded} ${termType} reports generated! Go to Saved Reports to review and send to parents.`
                );
              }} disabled={!!bulkProgress}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-blue-200 bg-blue-50 text-blue-700 text-sm font-bold rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50">
                <Users className="w-4 h-4" />
                Generate {termType === 'annual' ? 'Annual' : 'Term'} Report for All {students.length} Students
              </button>
            )}
          </div>

          {termReport && <ProgressReportCard report={termReport} onDownload={() => {
            if (termReport.report_id) downloadReportById(termReport.report_id, termReport.student_name);
          }}
            onShare={termReport.report_id ? () => shareReport(termReport.report_id!) : undefined}
            onDelete={termReport.report_id ? () => deleteReport(termReport.report_id!) : undefined}
          />}
        </div>
      )}

      {/* ── SCHOOL SUMMARY TAB ── */}
      {activeTab === 'school' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
            <p className="text-sm font-semibold text-neutral-800 mb-2">School Summary Report</p>
            <p className="text-xs text-neutral-500 mb-4">Overall attendance, curriculum coverage, and per-section breakdown</p>
            <button onClick={generateSchoolReport} disabled={loading}
              className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
              {loading ? 'Generating...' : 'Generate School Report'}
            </button>
          </div>
          {schoolReport && <SchoolReportCard report={schoolReport} />}
        </div>
      )}

      {/* ── QUIZZES TAB ── */}
      {activeTab === 'quizzes' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">All quizzes and tests</p>
            <button onClick={loadQuizzes} disabled={quizzesLoading} className="text-xs text-primary-600 hover:underline disabled:opacity-50">
              {quizzesLoading ? 'Loading...' : '↺ Refresh'}
            </button>
          </div>
          {quizzesLoading && <p className="text-sm text-neutral-400 py-4 text-center">Loading quizzes...</p>}
          {!quizzesLoading && quizzes.length === 0 && (
            <div className="bg-white rounded-2xl border border-neutral-100 p-8 text-center">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-neutral-500 text-sm">No quizzes yet.</p>
            </div>
          )}
          {quizzes.map(q => (
            <div key={q.id} className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-neutral-800">{q.subject}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${q.is_assigned ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-600'}`}>
                      {q.is_assigned ? '📋 Assigned' : '✏️ Self-test'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">{q.class_name} · Section {q.section_label}{q.teacher_name && ` · ${q.teacher_name}`}</p>
                  <div className="flex gap-4 mt-1 text-xs text-neutral-500">
                    <span>{q.question_count} questions</span>
                    <span>{q.attempts_count} attempts</span>
                    {q.avg_pct != null && <span>Avg: {q.avg_pct}%</span>}
                  </div>
                </div>
                <button onClick={() => loadQuizResults(q.id)} className="text-xs text-primary-600 hover:underline shrink-0 mt-1">
                  {expandedQuiz === q.id ? 'Hide ▲' : 'Results ▼'}
                </button>
              </div>
              {expandedQuiz === q.id && quizResults[q.id] && (
                <div className="border-t border-neutral-100 px-4 py-3 bg-neutral-50/50">
                  {quizResults[q.id].length === 0 ? (
                    <p className="text-xs text-neutral-400">No submissions yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {quizResults[q.id].map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-neutral-700 font-medium">{r.student_name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-neutral-500">{r.scored_marks}/{r.total_marks}</span>
                            <span className={`font-bold ${r.pct >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>{r.pct}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Progress Report Card ──────────────────────────────────────
function ProgressReportCard({ report, onDownload, onShare, onDelete }: {
  report: ProgressReport;
  onDownload: () => void;
  onShare?: () => void;
  onDelete?: () => void;
}) {
  // Strip **bold** markdown and render sub-labels as styled lines
  function renderBody(text: string) {
    // Strip any remaining **bold** or *italic* markdown
    const clean = text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
    const lines = clean.split('\n').filter(l => l.trim());
    return (
      <div className="space-y-2">
        {lines.map((line, i) => {
          const trimmed = line.trim();
          // Sub-label pattern: "Label: content"
          const subLabel = trimmed.match(/^([A-Za-z\s&\/]+?):\s+(.+)/);
          if (subLabel && subLabel[1].length < 40) {
            return (
              <div key={i} className="flex gap-2">
                <span className="text-xs font-semibold text-neutral-500 shrink-0 mt-0.5 min-w-[140px]">{subLabel[1]}:</span>
                <span className="text-sm text-neutral-700 leading-relaxed">{subLabel[2]}</span>
              </div>
            );
          }
          return <p key={i} className="text-sm text-neutral-700 leading-relaxed">{trimmed}</p>;
        })}
      </div>
    );
  }

  const cleanReport = (report.ai_report || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
  const sections = cleanReport.split(/\n##\s+/).filter(Boolean);
  const intro = sections[0] || '';
  const rest = sections.slice(1);

  const SECTION_ICONS: Record<string, string> = {
    'Development Overview': '🌱',
    'Learning & Development': '🧠',
    'Physical Development': '💪',
    'Absence Impact': '📅',
    'Observations & Insights': '📊',
    'Engagement & Experience': '🏫',
    'Teacher Remarks': '👩‍🏫',
    'Parent Support Recommendations': '💡',
    'Oakit.ai Insights': '🚀',
    'Readiness for Next Level': '🚀',
    'Growth Journey': '📈',
    'Year Highlights': '🏆',
    'Term Highlights': '🏆',
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 text-white" style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}>
        <p className="text-xs text-white/60 uppercase tracking-widest mb-1">{report.school_name}</p>
        <h2 className="text-xl font-black tracking-tight">🌟 {report.school_name} Progress Report</h2>
        <p className="text-sm text-white/70 mt-1">{report.from_date} → {report.to_date}</p>
      </div>

      {/* Student profile strip */}
      <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Student</p>
          <p className="text-sm font-bold text-neutral-800">{report.student_name}</p>
          {report.age && <p className="text-xs text-neutral-500">{report.age} old</p>}
        </div>
        <div>
          <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Class</p>
          <p className="text-sm font-semibold text-neutral-700">{report.class_name} · {report.section_label}</p>
          <p className="text-xs text-neutral-500">{report.teacher_name || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Father</p>
          <p className="text-sm text-neutral-700">{report.father_name || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Mother</p>
          <p className="text-sm text-neutral-700">{report.mother_name || '—'}</p>
        </div>
      </div>

      {/* Performance indicators */}
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-neutral-100">
        <div className={`rounded-xl p-3 text-center ${report.attendance.pct >= 90 ? 'bg-emerald-50' : report.attendance.pct >= 75 ? 'bg-amber-50' : 'bg-red-50'}`}>
          <p className={`text-2xl font-black ${report.attendance.pct >= 90 ? 'text-emerald-700' : report.attendance.pct >= 75 ? 'text-amber-700' : 'text-red-600'}`}>{report.attendance.pct}%</p>
          <p className="text-xs text-neutral-500 mt-0.5">Attendance</p>
          <p className="text-[10px] text-neutral-400">{report.attendance.present}/{report.attendance.total} days</p>
        </div>
        <div className="bg-primary-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-primary-700">{report.curriculum.covered}</p>
          <p className="text-xs text-neutral-500 mt-0.5">Topics Covered</p>
          <p className="text-[10px] text-neutral-400">{(report.curriculum.topics || report.curriculum.subjects || []).slice(0, 2).join(', ')}{(report.curriculum.topics || report.curriculum.subjects || []).length > 2 ? '…' : ''}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-black text-amber-700">{report.milestones.achieved}/{report.milestones.total}</p>
          <p className="text-xs text-neutral-500 mt-0.5">Milestones</p>
          <p className="text-[10px] text-neutral-400">achieved</p>
        </div>
        <div className={`rounded-xl p-3 text-center ${report.homework.completed > report.homework.not_submitted ? 'bg-emerald-50' : 'bg-neutral-50'}`}>
          <p className="text-2xl font-black text-neutral-700">{report.homework.completed}/{report.homework.total}</p>
          <p className="text-xs text-neutral-500 mt-0.5">Homework</p>
          <p className="text-[10px] text-neutral-400">completed</p>
        </div>
      </div>

      {/* Missed topics banner */}
      {report.missed_topics?.length > 0 && (
        <div className="mx-6 mt-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <p className="text-xs font-bold text-amber-800 mb-1">📅 Topics missed due to {report.attendance.absent} absent day{report.attendance.absent > 1 ? 's' : ''}</p>
          <p className="text-xs text-amber-700">{(report.missed_topics || []).join(' · ')}</p>
        </div>
      )}

      {/* AI Report sections */}
      <div className="px-6 py-4 space-y-4">
        {intro && (
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
            <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">{intro.trim()}</p>
          </div>
        )}
        {rest.map((section, i) => {
          const firstLine = section.split('\n')[0].trim();
          const body = section.split('\n').slice(1).join('\n').trim();
          const icon = Object.entries(SECTION_ICONS).find(([k]) => firstLine.includes(k))?.[1] || '📌';
          return (
            <div key={i} className="border border-neutral-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-100 flex items-center gap-2">
                <span className="text-base">{icon}</span>
                <p className="text-sm font-bold text-neutral-800">{firstLine.replace(/^[🧠💪🎯📊🏫📝💡🚀📅⭐📈]\s*/u, '')}</p>
              </div>
              <div className="px-4 py-3">
                {renderBody(body)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-neutral-400">Powered by Oakit.ai · Generated {new Date().toLocaleDateString('en-IN')}</p>
        <div className="flex gap-2 flex-wrap">
          {onDelete && (
            <button onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-200 bg-red-50 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 transition-colors">
              🗑 Delete
            </button>
          )}
          {onShare && report.report_id && (
            <button onClick={onShare}
              className="flex items-center gap-1.5 px-3 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-100 transition-colors">
              📤 Share with Parent
            </button>
          )}
          <button onClick={onDownload}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition-colors">
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}



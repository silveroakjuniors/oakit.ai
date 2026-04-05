'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
interface SchoolReport {
  school_name: string; total_students: number;
  overall_attendance_pct: number; overall_coverage_pct: number;
  sections: { class_name: string; section_label: string; coverage_pct: number; total_chunks: number; covered_chunks: number }[];
}

export default function ReportsPage() {
  const token = getToken() || '';
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [studentReport, setStudentReport] = useState<StudentReport | null>(null);
  const [schoolReport, setSchoolReport] = useState<SchoolReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'student' | 'school'>('student');

  useEffect(() => {
    apiGet<Class[]>('/api/v1/admin/classes', token).then(setClasses).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSection) { setStudents([]); return; }
    apiGet<Student[]>(`/api/v1/admin/students?section_id=${selectedSection}`, token).then(setStudents).catch(() => {});
  }, [selectedSection]);

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

  const cls = classes.find(c => c.id === selectedClass);

  return (
    <div className="p-6 max-w-3xl">
        <h1 className="text-xl font-bold text-neutral-900 mb-1">Reports</h1>
        <p className="text-sm text-neutral-500 mb-6">Generate student and school summary reports</p>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 mb-6 w-fit">
          {(['student', 'school'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === t ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
              {t === 'student' ? '👤 Student Report' : '🏫 School Summary'}
            </button>
          ))}
        </div>

        {activeTab === 'student' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
              <p className="text-sm font-semibold text-neutral-800 mb-4">Select Student</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Class</label>
                  <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); setSelectedStudent(''); }}
                    className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none">
                    <option value="">Select class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {cls && (
                  <div>
                    <label className="text-xs font-medium text-neutral-600 mb-1 block">Section</label>
                    <select value={selectedSection} onChange={e => { setSelectedSection(e.target.value); setSelectedStudent(''); }}
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
              <button onClick={generateStudentReport} disabled={!selectedStudent || loading}
                className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
                {loading ? 'Generating...' : 'Generate Report'}
              </button>
            </div>

            {studentReport && <StudentReportCard report={studentReport} />}
          </div>
        )}

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
      </div>
  );
}

function StudentReportCard({ report }: { report: StudentReport }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden" id="student-report">
      <div className="bg-primary-700 text-white px-6 py-4">
        <p className="text-xs text-white/60 uppercase tracking-wide">{report.school_name}</p>
        <h2 className="text-lg font-bold mt-0.5">{report.student_name}</h2>
        <p className="text-sm text-white/70">{report.class_name} · Section {report.section_label}</p>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Attendance', val: `${report.attendance.pct}%`, sub: `${report.attendance.present}/${report.attendance.total} days`, color: report.attendance.pct >= 75 ? 'text-green-700' : 'text-red-600', bg: report.attendance.pct >= 75 ? 'bg-green-50' : 'bg-red-50' },
            { label: 'Curriculum', val: `${report.curriculum.pct}%`, sub: `${report.curriculum.covered}/${report.curriculum.total} topics`, color: 'text-primary-700', bg: 'bg-primary-50' },
            { label: 'Milestones', val: `${report.milestones.pct}%`, sub: `${report.milestones.achieved}/${report.milestones.total} achieved`, color: 'text-amber-700', bg: 'bg-amber-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{s.label}</p>
              <p className="text-xs text-neutral-400">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Teacher Observations</p>
          {report.observations.length === 0 ? (
            <p className="text-xs text-neutral-400 italic">No observations recorded for this term.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {report.observations.map((obs, i) => (
                <div key={i} className="bg-neutral-50 rounded-xl px-3 py-2.5">
                  {obs.obs_text && <p className="text-sm text-neutral-700">{obs.obs_text}</p>}
                  {obs.categories.length > 0 && (
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {obs.categories.map(c => <span key={c} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{c}</span>)}
                    </div>
                  )}
                  <p className="text-xs text-neutral-400 mt-1">{obs.obs_date}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => window.print()}
          className="w-full py-2.5 border border-neutral-200 text-neutral-600 text-sm rounded-xl hover:bg-neutral-50 transition-colors">
          🖨️ Print Report
        </button>
      </div>
    </div>
  );
}

function SchoolReportCard({ report }: { report: SchoolReport }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="bg-primary-700 text-white px-6 py-4">
        <h2 className="text-lg font-bold">{report.school_name}</h2>
        <p className="text-sm text-white/70">School Summary Report</p>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-neutral-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-neutral-800">{report.total_students}</p>
            <p className="text-xs text-neutral-500">Total Students</p>
          </div>
          <div className={`${report.overall_attendance_pct >= 75 ? 'bg-green-50' : 'bg-red-50'} rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-bold ${report.overall_attendance_pct >= 75 ? 'text-green-700' : 'text-red-600'}`}>{report.overall_attendance_pct}%</p>
            <p className="text-xs text-neutral-500">Avg Attendance</p>
          </div>
          <div className="bg-primary-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary-700">{report.overall_coverage_pct}%</p>
            <p className="text-xs text-neutral-500">Avg Coverage</p>
          </div>
        </div>

        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Section Breakdown</p>
        <div className="flex flex-col gap-2">
          {report.sections.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-neutral-600 w-24 shrink-0">{s.class_name} {s.section_label}</span>
              <div className="flex-1 bg-neutral-100 rounded-full h-4 relative overflow-hidden">
                <div className="h-4 rounded-full transition-all"
                  style={{ width: `${Math.max(s.coverage_pct, 2)}%`, backgroundColor: s.coverage_pct >= 75 ? '#22c55e' : s.coverage_pct >= 40 ? '#f59e0b' : '#ef4444' }} />
              </div>
              <span className="text-xs font-bold text-neutral-600 w-10 text-right shrink-0">{s.coverage_pct}%</span>
            </div>
          ))}
        </div>

        <button onClick={() => window.print()} className="w-full mt-4 py-2.5 border border-neutral-200 text-neutral-600 text-sm rounded-xl hover:bg-neutral-50 transition-colors">
          🖨️ Print Report
        </button>
      </div>
    </div>
  );
}

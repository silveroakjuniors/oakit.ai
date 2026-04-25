'use client';
import { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface Student { id: string; name: string; class_name?: string; section_label?: string; }
interface Class { id: string; name: string; }
interface Section { id: string; label: string; class_id: string; class_name?: string; }

interface Props {
  token: string;
  role: 'parent' | 'teacher' | 'admin' | 'principal';
  // For parent: pass fixed child directly
  fixedStudentId?: string;
  fixedStudentName?: string;
}

function renderReport(text: string) {
  const sections = text.split(/\n(?=## )/);
  return sections.map((section, i) => {
    const lines = section.split('\n');
    const heading = lines[0].replace(/^##\s*/, '').trim();
    const body = lines.slice(1).join('\n').trim();
    if (!heading && !body) return null;
    return (
      <div key={i} className="mb-5">
        {heading && <h3 className="text-sm font-bold text-gray-800 mb-2">{heading}</h3>}
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{body}</p>
      </div>
    );
  });
}

export default function ReportCardGenerator({ token, role, fixedStudentId, fixedStudentName }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  // Selection state (teacher/admin/principal)
  const [classes, setClasses] = useState<Class[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(fixedStudentId || '');

  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [reportMeta, setReportMeta] = useState<any>(null);
  const [error, setError] = useState('');

  // Load students for teacher (their class only)
  useEffect(() => {
    if (role !== 'teacher') return;
    apiGet<Student[]>('/api/v1/teacher/report-card/students', token)
      .then(setStudents).catch(() => {});
  }, [role, token]);

  // Load classes for admin/principal
  useEffect(() => {
    if (role !== 'admin' && role !== 'principal') return;
    apiGet<Class[]>('/api/v1/admin/classes', token)
      .then(setClasses).catch(() => {});
  }, [role, token]);

  // Load sections when class selected
  useEffect(() => {
    if (!selectedClass) { setSections([]); setStudents([]); return; }
    apiGet<Section[]>(`/api/v1/admin/classes/${selectedClass}/sections`, token)
      .then(setSections).catch(() => {});
  }, [selectedClass, token]);

  // Load students when section selected
  useEffect(() => {
    if (!selectedSection) { setStudents([]); return; }
    apiGet<Student[]>(`/api/v1/teacher/sections/${selectedSection}/students`, token)
      .then(setStudents).catch(() => {});
  }, [selectedSection, token]);

  async function generate() {
    const sid = fixedStudentId || selectedStudent;
    if (!sid) return;
    setGenerating(true); setError(''); setReport(null);
    try {
      let url = '';
      if (role === 'parent') {
        url = `/api/v1/parent/child/${sid}/report-card?from=${from}&to=${to}`;
      } else if (role === 'teacher') {
        url = `/api/v1/teacher/report-card/generate?student_id=${sid}&from=${from}&to=${to}`;
      } else {
        url = `/api/v1/admin/reports/progress-report?student_id=${sid}&from=${from}&to=${to}`;
      }
      const data = await apiGet<any>(url, token);
      setReport(data.ai_report || '');
      setReportMeta(data);
    } catch (e: any) {
      setError(e.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }

  const canGenerate = !!(fixedStudentId || selectedStudent);

  return (
    <div className="space-y-4">
      {/* Student selection — teacher sees flat list, admin/principal sees class→section→student */}
      {role === 'teacher' && (
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Select Student</label>
          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/30">
            <option value="">Choose a student…</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name} — {s.class_name} {s.section_label}</option>
            ))}
          </select>
        </div>
      )}

      {(role === 'admin' || role === 'principal') && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Class</label>
            <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); setSelectedStudent(''); }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/30">
              <option value="">Select class…</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Section</label>
            <select value={selectedSection} onChange={e => { setSelectedSection(e.target.value); setSelectedStudent(''); }}
              disabled={!selectedClass}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/30 disabled:opacity-50">
              <option value="">Select section…</option>
              {sections.map(s => <option key={s.id} value={s.id}>Section {s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Student</label>
            <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
              disabled={!selectedSection}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/30 disabled:opacity-50">
              <option value="">Select student…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Date range */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30" />
        </div>
      </div>

      <button onClick={generate} disabled={generating || !canGenerate}
        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
        {generating
          ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating report card…</>
          : <><BookOpen size={15} /> Generate Report Card</>}
      </button>

      {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

      {/* Generated report */}
      {report && reportMeta && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-2">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-4">
            <p className="text-white font-black text-base">{reportMeta.student_name}</p>
            <p className="text-white/80 text-xs mt-0.5">{reportMeta.class_name} · Section {reportMeta.section_label} · {reportMeta.school_name}</p>
            <p className="text-white/70 text-xs mt-0.5">Period: {from} to {to} · Teacher: {reportMeta.teacher_name || '—'}</p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            <div className="px-3 py-2.5 text-center">
              <p className="text-xs text-gray-400">Attendance</p>
              <p className="text-sm font-bold text-emerald-600">{reportMeta.attendance?.pct ?? 0}%</p>
              <p className="text-[10px] text-gray-400">{reportMeta.attendance?.present ?? 0}d present</p>
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className="text-xs text-gray-400">Subjects</p>
              <p className="text-sm font-bold text-blue-600">{reportMeta.curriculum?.covered ?? 0}</p>
              <p className="text-[10px] text-gray-400">areas covered</p>
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className="text-xs text-gray-400">Milestones</p>
              <p className="text-sm font-bold text-purple-600">{reportMeta.milestones?.achieved ?? 0}/{reportMeta.milestones?.total ?? 0}</p>
              <p className="text-[10px] text-gray-400">achieved</p>
            </div>
          </div>
          <div className="px-5 py-5">{renderReport(report)}</div>
          {reportMeta.teacher_name && (
            <div className="px-5 pb-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 pt-3">Class Teacher: <span className="font-semibold text-gray-600">{reportMeta.teacher_name}</span></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

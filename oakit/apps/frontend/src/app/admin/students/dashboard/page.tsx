'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SectionCount {
  section_id: string;
  section_label: string;
  count: number | null;
}

interface ClassRow {
  class_id: string;
  class_name: string;
  total_students: number;
  with_father: number;
  with_mother: number;
  with_father_contact: number;
  with_mother_contact: number;
  sections: SectionCount[];
}

interface DashboardData {
  total_students: number;
  by_class: ClassRow[];
}

interface ClassOption {
  id: string;
  name: string;
  sections: { id: string; label: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

function ProgressBar({ value, max, color = '#1B4332' }: { value: number; max: number; color?: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, backgroundColor: color }} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StudentsDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Export filters
  const [exportClassId, setExportClassId] = useState('');
  const [exportSectionId, setExportSectionId] = useState('');
  const [exporting, setExporting] = useState(false);

  const token = getToken() ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, clsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/admin/students/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/v1/admin/classes`,            { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const dashData = await dashRes.json();
      const clsData  = await clsRes.json();
      if (!dashRes.ok) throw new Error(dashData.detail || dashData.error || `Dashboard error ${dashRes.status}`);
      if (!clsRes.ok)  throw new Error(clsData.detail  || clsData.error  || `Classes error ${clsRes.status}`);
      setData(dashData);
      setClasses(clsData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const selectedClass = classes.find(c => c.id === exportClassId);

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (exportClassId)   params.set('class_id',   exportClassId);
      if (exportSectionId) params.set('section_id', exportSectionId);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(`${API_BASE}/api/v1/admin/students/export${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `students_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700 whitespace-pre-wrap">{error}</div>
      </div>
    );
  }

  const totalStudents = data?.total_students ?? 0;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Students Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Enrolment overview by class and section</p>
        </div>
        <a
          href="/admin/students"
          className="text-sm text-[#1B4332] hover:underline font-medium"
        >
          ← All Students
        </a>
      </div>

      {/* ── Total stat card ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1 bg-[#1B4332] text-white rounded-2xl px-5 py-4">
          <p className="text-xs font-medium opacity-70 uppercase tracking-wide">Total Students</p>
          <p className="text-4xl font-bold mt-1">{totalStudents}</p>
          <p className="text-xs opacity-60 mt-1">Active enrolments</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Classes</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{data?.by_class.length ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">With students</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Father Contact</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {data?.by_class.reduce((s, c) => s + c.with_father_contact, 0) ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {pct(data?.by_class.reduce((s, c) => s + c.with_father_contact, 0) ?? 0, totalStudents)}% filled
          </p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mother Contact</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {data?.by_class.reduce((s, c) => s + c.with_mother_contact, 0) ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {pct(data?.by_class.reduce((s, c) => s + c.with_mother_contact, 0) ?? 0, totalStudents)}% filled
          </p>
        </div>
      </div>

      {/* ── Export card ── */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Export Student Details</h2>
        <p className="text-xs text-gray-500 mb-4">
          Downloads an Excel file with: Student Name, Father Name, Mother Name, Father Contact, Mother Contact, Class, Section.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          {/* Class filter */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-medium text-gray-600">Class (optional)</label>
            <select
              value={exportClassId}
              onChange={e => { setExportClassId(e.target.value); setExportSectionId(''); }}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#1B4332]/40"
            >
              <option value="">All classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Section filter — only shown when a class is selected */}
          {selectedClass && (
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-xs font-medium text-gray-600">Section (optional)</label>
              <select
                value={exportSectionId}
                onChange={e => setExportSectionId(e.target.value)}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#1B4332]/40"
              >
                <option value="">All sections</option>
                {selectedClass.sections.map(s => (
                  <option key={s.id} value={s.id}>Section {s.label}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1B4332] text-white text-sm font-medium rounded-xl hover:bg-[#163828] disabled:opacity-50 transition-colors"
          >
            {exporting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <span>⬇</span> Export to Excel
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Per-class breakdown ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Enrolment by Class</h2>

        {(data?.by_class ?? []).map(cls => (
          <div key={cls.class_id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {/* Class header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1B4332]/10 flex items-center justify-center text-[#1B4332] font-bold text-sm">
                  {cls.class_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{cls.class_name}</p>
                  <p className="text-xs text-gray-400">{cls.total_students} student{cls.total_students !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[#1B4332]">{cls.total_students}</p>
                <p className="text-xs text-gray-400">
                  {pct(cls.total_students, totalStudents)}% of school
                </p>
              </div>
            </div>

            {/* Section breakdown */}
            {cls.sections && cls.sections.length > 0 && (
              <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {cls.sections.map(sec => (
                  <div key={sec.section_id} className="bg-gray-50 rounded-xl px-3 py-2.5">
                    <p className="text-xs font-medium text-gray-500">Section {sec.section_label}</p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5">{sec.count ?? 0}</p>
                    <ProgressBar value={sec.count ?? 0} max={cls.total_students} />
                  </div>
                ))}
              </div>
            )}

            {/* Contact completeness */}
            <div className="px-5 pb-4 grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Father contact</span>
                  <span>{cls.with_father_contact}/{cls.total_students}</span>
                </div>
                <ProgressBar value={cls.with_father_contact} max={cls.total_students} color="#E8960C" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Mother contact</span>
                  <span>{cls.with_mother_contact}/{cls.total_students}</span>
                </div>
                <ProgressBar value={cls.with_mother_contact} max={cls.total_students} color="#E8960C" />
              </div>
            </div>
          </div>
        ))}

        {(data?.by_class ?? []).length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No students enrolled yet.
          </div>
        )}
      </div>
    </div>
  );
}

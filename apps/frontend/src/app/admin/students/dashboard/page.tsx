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
  parents_activated: number;
  parents_logged_in: number;
  parents_not_logged_in: number;
  sections: SectionCount[];
}

interface ParentStats {
  activated: number;
  logged_in: number;
  not_logged_in: number;
  not_activated: number;
}

interface DashboardData {
  total_students: number;
  parent_stats: ParentStats;
  by_class: ClassRow[];
}

interface ClassOption {
  id: string;
  name: string;
  sections: { id: string; label: string }[];
}

interface StudentDetail {
  id: string;
  name: string;
  father_name: string;
  mother_name: string;
  parent_contact: string;
  mother_contact: string;
  class_name: string;
  section_label: string;
  last_login?: string;
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

  // Filters
  const [filterClassId, setFilterClassId] = useState('');

  // Detail modal
  const [detailStatus, setDetailStatus] = useState<string | null>(null);
  const [detailStudents, setDetailStudents] = useState<StudentDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activating, setActivating] = useState(false);

  // Section detail panel
  const [selectedSection, setSelectedSection] = useState<any>(null);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [transferring, setTransferring] = useState<string | null>(null);

  async function loadSection(sectionId: string) {
    setSectionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/students/dashboard/section/${sectionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSelectedSection(d);
    } catch { setSelectedSection(null); }
    finally { setSectionLoading(false); }
  }

  async function transferStudent(studentId: string, newSectionId: string) {
    setTransferring(studentId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/students/transfer-section`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, new_section_id: newSectionId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      // Reload section and dashboard
      if (selectedSection) loadSection(selectedSection.section.id);
      load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Transfer failed'); }
    finally { setTransferring(null); }
  }

  // Export
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
        fetch(`${API_BASE}/api/v1/admin/classes`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const dashData = await dashRes.json();
      const clsData = await clsRes.json();
      if (!dashRes.ok) throw new Error(dashData.error || 'Dashboard error');
      if (!clsRes.ok) throw new Error(clsData.error || 'Classes error');
      setData(dashData);
      setClasses(clsData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function loadDetails(status: string) {
    setDetailStatus(status);
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({ status });
      if (filterClassId) params.set('class_id', filterClassId);
      const res = await fetch(`${API_BASE}/api/v1/admin/students/dashboard/details?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setDetailStudents(d);
    } catch { setDetailStudents([]); }
    finally { setDetailLoading(false); }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (exportClassId) params.set('class_id', exportClassId);
      if (exportSectionId) params.set('section_id', exportSectionId);
      const res = await fetch(`${API_BASE}/api/v1/admin/students/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `students_export_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Export failed'); }
    finally { setExporting(false); }
  }

  async function handleActivateAll() {
    if (!detailStudents.length) return;
    const studentIds = detailStudents.map(s => s.id);
    if (!confirm(`Activate parent logins for ${studentIds.length} students?`)) return;
    setActivating(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/students/bulk-activate-parents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_ids: studentIds, relation: 'both' }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Activation failed');
      alert(`Activated: ${d.activated}, Skipped: ${d.skipped}`);
      // Refresh dashboard and detail list
      load();
      setDetailStatus(null);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Activation failed'); }
    finally { setActivating(false); }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1B4332] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  const totalStudents = data?.total_students ?? 0;
  const ps = data?.parent_stats ?? { activated: 0, logged_in: 0, not_logged_in: 0, not_activated: 0 };

  // Filter by class if selected
  const filteredClasses = filterClassId
    ? (data?.by_class ?? []).filter(c => c.class_id === filterClassId)
    : (data?.by_class ?? []);

  // Compute filtered parent stats
  const filteredPS = filterClassId
    ? {
        activated: filteredClasses.reduce((s, c) => s + c.parents_activated, 0),
        logged_in: filteredClasses.reduce((s, c) => s + c.parents_logged_in, 0),
        not_logged_in: filteredClasses.reduce((s, c) => s + c.parents_not_logged_in, 0),
        not_activated: filteredClasses.reduce((s, c) => s + (c.total_students - c.parents_activated), 0),
      }
    : ps;

  const filteredTotal = filterClassId
    ? filteredClasses.reduce((s, c) => s + c.total_students, 0)
    : totalStudents;

  const selectedClass = classes.find(c => c.id === exportClassId);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Students Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Enrolment and parent activation overview</p>
        </div>
        <a href="/admin/students" className="text-sm text-[#1B4332] hover:underline font-medium">
          &larr; All Students
        </a>
      </div>

      {/* Class Filter */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-600">Filter by Class:</label>
        <select
          value={filterClassId}
          onChange={e => setFilterClassId(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#1B4332]/40"
        >
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Parent Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-[#1B4332] text-white rounded-2xl px-4 py-4">
          <p className="text-xs font-medium opacity-70 uppercase tracking-wide">Total Students</p>
          <p className="text-3xl font-bold mt-1">{filteredTotal}</p>
          <p className="text-xs opacity-60 mt-1">Active</p>
        </div>
        <button
          onClick={() => loadDetails('activated')}
          className="bg-white border border-gray-100 rounded-2xl px-4 py-4 shadow-sm text-left hover:border-emerald-300 transition-colors"
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Activated</p>
          <p className="text-3xl font-bold text-emerald-700 mt-1">{filteredPS.activated}</p>
          <p className="text-xs text-gray-400 mt-1">{pct(filteredPS.activated, filteredTotal)}% of students</p>
        </button>
        <button
          onClick={() => loadDetails('logged_in')}
          className="bg-white border border-gray-100 rounded-2xl px-4 py-4 shadow-sm text-left hover:border-blue-300 transition-colors"
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Logged In</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">{filteredPS.logged_in}</p>
          <p className="text-xs text-gray-400 mt-1">{pct(filteredPS.logged_in, filteredTotal)}% of students</p>
        </button>
        <button
          onClick={() => loadDetails('not_logged_in')}
          className="bg-white border border-gray-100 rounded-2xl px-4 py-4 shadow-sm text-left hover:border-amber-300 transition-colors"
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Not Logged In</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{filteredPS.not_logged_in}</p>
          <p className="text-xs text-gray-400 mt-1">Activated but never used</p>
        </button>
        <button
          onClick={() => loadDetails('not_activated')}
          className="bg-white border border-gray-100 rounded-2xl px-4 py-4 shadow-sm text-left hover:border-red-300 transition-colors"
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Not Activated</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{filteredPS.not_activated}</p>
          <p className="text-xs text-gray-400 mt-1">No parent login created</p>
        </button>
      </div>

      {/* Detail Modal */}
      {detailStatus && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 capitalize">
              {detailStatus.replace(/_/g, ' ')} Students ({detailStudents.length})
            </h3>
            <div className="flex items-center gap-3">
              {detailStatus === 'not_activated' && detailStudents.length > 0 && (
                <button
                  onClick={handleActivateAll}
                  disabled={activating}
                  className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {activating ? 'Activating...' : `Activate All (${detailStudents.length})`}
                </button>
              )}
              <button onClick={() => setDetailStatus(null)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
            </div>
          </div>
          {detailLoading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Loading...</p>
          ) : detailStudents.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No students found</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium text-gray-600">Student</th>
                    <th className="text-left px-2 py-1.5 font-medium text-gray-600">Class</th>
                    <th className="text-left px-2 py-1.5 font-medium text-gray-600">Father</th>
                    <th className="text-left px-2 py-1.5 font-medium text-gray-600">Mother</th>
                    {detailStatus === 'logged_in' && <th className="text-left px-2 py-1.5 font-medium text-gray-600">Last Login</th>}
                  </tr>
                </thead>
                <tbody>
                  {detailStudents.map(s => (
                    <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-2 py-1.5 font-medium text-gray-900">{s.name}</td>
                      <td className="px-2 py-1.5 text-gray-500">{s.class_name} {s.section_label}</td>
                      <td className="px-2 py-1.5 text-gray-500">{s.father_name || '-'} <span className="text-gray-400">{s.parent_contact || ''}</span></td>
                      <td className="px-2 py-1.5 text-gray-500">{s.mother_name || '-'} <span className="text-gray-400">{s.mother_contact || ''}</span></td>
                      {detailStatus === 'logged_in' && <td className="px-2 py-1.5 text-gray-400">{s.last_login ? new Date(s.last_login).toLocaleDateString() : '-'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Export Card */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Export Student Details</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-medium text-gray-600">Class</label>
            <select
              value={exportClassId}
              onChange={e => { setExportClassId(e.target.value); setExportSectionId(''); }}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#1B4332]/40"
            >
              <option value="">All classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {selectedClass && (
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-xs font-medium text-gray-600">Section</label>
              <select
                value={exportSectionId}
                onChange={e => setExportSectionId(e.target.value)}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#1B4332]/40"
              >
                <option value="">All sections</option>
                {selectedClass.sections.map(s => <option key={s.id} value={s.id}>Section {s.label}</option>)}
              </select>
            </div>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1B4332] text-white text-sm font-medium rounded-xl hover:bg-[#163828] disabled:opacity-50 transition-colors"
          >
            {exporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>
      </div>

      {/* Per-class breakdown */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Enrolment by Class</h2>

        {filteredClasses.map(cls => (
          <div key={cls.class_id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1B4332]/10 flex items-center justify-center text-[#1B4332] font-bold text-sm">
                  {cls.class_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{cls.class_name}</p>
                  <p className="text-xs text-gray-400">{cls.total_students} students</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[#1B4332]">{cls.total_students}</p>
              </div>
            </div>

            {/* Section breakdown */}
            {cls.sections.length > 0 && (
              <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {cls.sections.map(sec => (
                  <button
                    key={sec.section_id}
                    onClick={() => loadSection(sec.section_id)}
                    className={`bg-gray-50 rounded-xl px-3 py-2.5 text-left hover:bg-emerald-50 hover:border-emerald-200 border transition-colors ${
                      selectedSection?.section?.id === sec.section_id ? 'border-emerald-400 bg-emerald-50' : 'border-transparent'
                    }`}
                  >
                    <p className="text-xs font-medium text-gray-500">Section {sec.section_label}</p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5">{sec.count ?? 0}</p>
                    <ProgressBar value={sec.count ?? 0} max={cls.total_students} />
                  </button>
                ))}
              </div>
            )}

            {/* Parent activation stats for this class */}
            <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Activated</span>
                  <span className="text-emerald-600">{cls.parents_activated}/{cls.total_students}</span>
                </div>
                <ProgressBar value={cls.parents_activated} max={cls.total_students} color="#059669" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Logged In</span>
                  <span className="text-blue-600">{cls.parents_logged_in}/{cls.total_students}</span>
                </div>
                <ProgressBar value={cls.parents_logged_in} max={cls.total_students} color="#2563eb" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Father Contact</span>
                  <span>{cls.with_father_contact}/{cls.total_students}</span>
                </div>
                <ProgressBar value={cls.with_father_contact} max={cls.total_students} color="#E8960C" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Mother Contact</span>
                  <span>{cls.with_mother_contact}/{cls.total_students}</span>
                </div>
                <ProgressBar value={cls.with_mother_contact} max={cls.total_students} color="#E8960C" />
              </div>
            </div>
          </div>
        ))}

        {filteredClasses.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No students enrolled yet.</div>
        )}
      </div>

      {/* Section Detail Panel */}
      {(selectedSection || sectionLoading) && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          {sectionLoading ? (
            <p className="text-sm text-gray-400 py-6 text-center">Loading section details...</p>
          ) : selectedSection && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {selectedSection.class_name} - Section {selectedSection.section.label}
                  </h3>
                  <p className="text-xs text-gray-400">{selectedSection.students.length} students</p>
                </div>
                <button onClick={() => setSelectedSection(null)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
              </div>

              {/* Teachers */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Teachers</p>
                <div className="flex flex-wrap gap-2">
                  {selectedSection.teachers.map((t: any) => (
                    <div key={t.id} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${t.is_class_teacher ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                      {t.name} {t.is_class_teacher && <span className="text-emerald-500 ml-1">(Class Teacher)</span>}
                    </div>
                  ))}
                  {selectedSection.teachers.length === 0 && <p className="text-xs text-gray-400">No teachers assigned</p>}
                </div>
              </div>

              {/* Students table */}
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-600">Student</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-600">Father</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-600">Mother</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-600">Transfer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSection.students.map((s: any) => (
                      <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-2 font-medium text-gray-900">{s.name}</td>
                        <td className="px-2 py-2 text-gray-500">{s.father_name || '-'} <span className="text-gray-300">{s.parent_contact || ''}</span></td>
                        <td className="px-2 py-2 text-gray-500">{s.mother_name || '-'} <span className="text-gray-300">{s.mother_contact || ''}</span></td>
                        <td className="px-2 py-2">
                          <select
                            disabled={transferring === s.id}
                            defaultValue=""
                            onChange={e => { if (e.target.value) transferStudent(s.id, e.target.value); e.target.value = ''; }}
                            className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white disabled:opacity-50"
                          >
                            <option value="">Move to...</option>
                            {selectedSection.all_sections
                              .filter((sec: any) => sec.id !== selectedSection.section.id)
                              .map((sec: any) => (
                                <option key={sec.id} value={sec.id}>Section {sec.label}</option>
                              ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

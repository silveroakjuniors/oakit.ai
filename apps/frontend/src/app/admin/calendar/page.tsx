'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, Card } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Holiday { id: string; holiday_date: string; event_name: string; }
interface SpecialDay { id: string; day_date: string; day_type: string; label: string; }
interface SpecialDayGroup { ids: string[]; from_date: string; to_date: string; day_type: string; label: string; activity_note?: string; start_time?: string; end_time?: string; count: number; duration_type?: 'full_day' | 'half_day'; revision_topics?: string[]; }
interface SavedCalendar { id: string; academic_year: string; working_days: number[]; start_date: string; end_date: string; }

const DAY_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string; defaultLabel: string }> = {
  settling:               { label: 'Settling Period',          color: 'bg-blue-100 text-blue-700',     icon: '🌱',    defaultLabel: 'Settling Period' },
  revision:               { label: 'Revision Day',             color: 'bg-amber-100 text-amber-700',   icon: '📝',    defaultLabel: 'Revision Day' },
  exam:                   { label: 'Exam Day',                 color: 'bg-red-100 text-red-700',       icon: '📋',    defaultLabel: 'Exam Day' },
  event:                  { label: 'School Event',             color: 'bg-purple-100 text-purple-700', icon: '🎉',    defaultLabel: 'School Event' },
  sports_day:             { label: 'Sports Day',               color: 'bg-green-100 text-green-700',   icon: '🏃',    defaultLabel: 'Sports Day' },
  annual_day:             { label: 'Annual Day',               color: 'bg-pink-100 text-pink-700',     icon: '🎭',    defaultLabel: 'Annual Day' },
  cultural_day:           { label: 'Cultural Day',             color: 'bg-orange-100 text-orange-700', icon: '🎨',    defaultLabel: 'Cultural Day' },
  field_trip:             { label: 'Field Trip',               color: 'bg-teal-100 text-teal-700',     icon: '🚌',    defaultLabel: 'Field Trip' },
  culminating_day:        { label: 'Culminating Day',          color: 'bg-indigo-100 text-indigo-700', icon: '🏆',    defaultLabel: 'Culminating Day' },
  parent_teacher_meeting: { label: 'Parent-Teacher Meeting',   color: 'bg-gray-100 text-gray-700',     icon: '👨‍👩‍👧', defaultLabel: 'Parent-Teacher Meeting' },
  custom:                 { label: 'Custom',                   color: 'bg-gray-100 text-gray-600',     icon: '📌',    defaultLabel: '' },
};
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function parseDate(iso: string) {
  const [y, m, d] = (iso || '').split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}
function formatDateShort(iso: string) {
  const d = parseDate(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function dayName(iso: string) {
  return parseDate(iso).toLocaleDateString('en-IN', { weekday: 'short' });
}

function HolidayImportModal({ year, token, onClose, onImported }: { year: string; token: string; onClose: () => void; onImported: () => void; }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: any[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/calendar/${year}/holidays/import`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data); onImported();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Import failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <Card className="w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Import Holidays from Excel</h2>
        {!result ? (
          <>
            <p className="text-sm text-gray-500 mb-4">Upload an .xlsx file with columns: <strong>date</strong>, <strong>event_name</strong></p>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 mb-4" onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              {file ? <p className="text-sm text-gray-700">{file.name}</p> : <p className="text-sm text-gray-400">Click to select .xlsx file</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
              <Button onClick={handleImport} loading={loading} disabled={!file} className="flex-1">Import</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-green-700 mb-2">✓ {result.created} holidays imported</p>
            {result.skipped.length > 0 && <ul className="text-xs text-gray-500 list-disc pl-4 max-h-32 overflow-y-auto mb-4">{result.skipped.map((s: any, i: number) => <li key={i}>Row {s.row}: {s.reason}</li>)}</ul>}
            <Button onClick={onClose} className="w-full">Done</Button>
          </>
        )}
      </Card>
    </div>
  );
}

interface PlanSummary {
  total_chunks: number;
  total_working_days: number;
  net_curriculum_days: number;
  special_day_breakdown: Record<string, { full_day: number; half_day: number }>;
  fit: 'exact' | 'under' | 'over';
  recommendation: string;
}

function PreGenerationModal({ classId, academicYear, month, planYear, token, onProceed, onCancel }: {
  classId: string; academicYear: string; month?: number; planYear?: number; token: string;
  onProceed: () => void; onCancel: () => void;
}) {
  const [summary, setSummary] = useState<PlanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ class_id: classId, academic_year: academicYear });
    if (month != null) params.set('month', String(month));
    if (planYear != null) params.set('plan_year', String(planYear));
    apiGet<PlanSummary>(`/api/v1/admin/calendar/plan-summary?${params}`, token)
      .then(setSummary)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load summary'))
      .finally(() => setLoading(false));
  }, []);

  const fitColor = summary?.fit === 'exact' ? 'text-green-600' : summary?.fit === 'under' ? 'text-amber-600' : 'text-red-600';
  const fitLabel = summary?.fit === 'exact' ? '✓ Exact fit' : summary?.fit === 'under' ? '⚠ Under — chunks will cycle' : '✗ Over — not all curriculum covered';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <Card className="w-full max-w-lg">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Plan Generation Summary</h2>
        {loading && <p className="text-sm text-gray-400 py-6 text-center">Loading summary…</p>}
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        {summary && (
          <div className="flex flex-col gap-3 mb-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Curriculum Chunks</p>
                <p className="text-xl font-bold text-gray-800">{summary.total_chunks}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Working Days</p>
                <p className="text-xl font-bold text-gray-800">{summary.total_working_days}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Net Curriculum Days</p>
                <p className="text-xl font-bold text-gray-800">{summary.net_curriculum_days}</p>
              </div>
            </div>
            {Object.keys(summary.special_day_breakdown).length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Special Day Breakdown</p>
                <div className="flex flex-col gap-1">
                  {Object.entries(summary.special_day_breakdown).map(([type, counts]) => {
                    const cfg = DAY_TYPE_CONFIG[type] ?? { icon: '📌', label: type };
                    return (
                      <div key={type} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                        <span>{cfg.icon} {cfg.label ?? type}</span>
                        <span className="flex gap-3">
                          {counts.full_day > 0 && <span>{counts.full_day} full</span>}
                          {counts.half_day > 0 && <span>{counts.half_day} half</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className={`text-sm font-semibold ${fitColor}`}>{fitLabel}</div>
            <p className="text-sm text-gray-600">{summary.recommendation}</p>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} className="flex-1">Cancel</Button>
          <Button onClick={onProceed} disabled={loading || !!error} className="flex-1">Proceed</Button>
        </div>
      </Card>
    </div>
  );
}

interface CoverageReportData {
  months: Array<{ year: number; month: number; status: 'has_curriculum' | 'special_only' | 'no_working_days' }>;
  cycled_days: Array<{ date: string; chunk_ids: string[] }>;
  unique_chunks_covered: number;
  total_chunks: number;
}

function CoverageReport({ classId, sectionId, academicYear, token, onDismiss }: {
  classId: string; sectionId: string; academicYear: string; token: string; onDismiss: () => void;
}) {
  const [report, setReport] = useState<CoverageReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ class_id: classId, section_id: sectionId, academic_year: academicYear });
    apiGet<CoverageReportData>(`/api/v1/admin/calendar/coverage-report?${params}`, token)
      .then(setReport)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load coverage report'))
      .finally(() => setLoading(false));
  }, []);

  const monthStatusColor = (status: string) => {
    if (status === 'has_curriculum') return 'bg-green-100 text-green-700';
    if (status === 'special_only') return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-500';
  };
  const monthStatusLabel = (status: string) => {
    if (status === 'has_curriculum') return 'Curriculum';
    if (status === 'special_only') return 'Special only';
    return 'No working days';
  };

  const hasCycling = (report?.cycled_days.length ?? 0) > 0;
  const emptyMonths = report?.months.filter(m => m.status === 'no_working_days') ?? [];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Coverage Report</h2>
        {loading && <p className="text-sm text-gray-400 py-6 text-center">Loading report…</p>}
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        {report && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Unique Chunks Covered</p>
                <p className="text-xl font-bold text-gray-800">{report.unique_chunks_covered}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Total Chunks</p>
                <p className="text-xl font-bold text-gray-800">{report.total_chunks}</p>
              </div>
            </div>
            {report.months.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Month-by-Month Status</p>
                <div className="flex flex-wrap gap-2">
                  {report.months.map(m => (
                    <span key={`${m.year}-${m.month}`} className={`text-xs px-2 py-1 rounded-full font-medium ${monthStatusColor(m.status)}`}>
                      {MONTHS_FULL[m.month - 1]} {m.year} — {monthStatusLabel(m.status)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {hasCycling && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Cycled Dates ♻️</p>
                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                  {report.cycled_days.map(d => (
                    <div key={d.date} className="text-xs text-gray-600 bg-amber-50 rounded px-2 py-1">
                      ♻️ {formatDateShort(d.date)} — {d.chunk_ids.length} chunk{d.chunk_ids.length !== 1 ? 's' : ''} repeated
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(hasCycling || emptyMonths.length > 0) && (
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 flex flex-col gap-1">
                {hasCycling && <p>💡 Chunks are cycling — consider uploading more curriculum content to avoid repetition.</p>}
                {emptyMonths.length > 0 && <p>💡 Some months have no curriculum days — review special day assignments for {emptyMonths.map(m => MONTHS_FULL[m.month - 1]).join(', ')}.</p>}
              </div>
            )}
          </div>
        )}
        <div className="mt-5">
          <Button onClick={onDismiss} className="w-full">Dismiss</Button>
        </div>
      </Card>
    </div>
  );
}

export default function CalendarPage() {
  const token = getToken() || '';
  const [savedCalendar, setSavedCalendar] = useState<SavedCalendar | null>(null);
  const [calendarLoaded, setCalendarLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ academic_year: '', working_days: [1,2,3,4,5], start_date: '', end_date: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [workingDayCount, setWorkingDayCount] = useState<number | null>(null);
  const [calSummary, setCalSummary] = useState<{ working_day_count: number; holiday_count: number; special_days: Record<string, number> } | null>(null);
  const academicYear = savedCalendar?.academic_year || '';

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [specialDays, setSpecialDays] = useState<SpecialDayGroup[]>([]);
  const [newHoliday, setNewHoliday] = useState({ holiday_date: '', event_name: '' });
  const [editingHoliday, setEditingHoliday] = useState<{ id: string; holiday_date: string; event_name: string } | null>(null);
  const [newSpecialDay, setNewSpecialDay] = useState({ from_date: '', to_date: '', day_type: 'settling', custom_day_type: '', label: '', activity_note: '', start_time: '', end_time: '', duration_type: 'full_day' as 'full_day' | 'half_day', revision_topics: [] as string[] });
  const [revisionTopicInput, setRevisionTopicInput] = useState('');
  const [showHolidayList, setShowHolidayList] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportingHolidays, setExportingHolidays] = useState(false);
  const [refreshingPlanner, setRefreshingPlanner] = useState(false);
  const [msg, setMsg] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [planForm, setPlanForm] = useState({ class_id: '', mode: 'month' as 'month'|'year', month: new Date().getMonth() + 1, plan_year: new Date().getFullYear() });
  const [planLoading, setPlanLoading] = useState(false);
  const [planConflict, setPlanConflict] = useState<{ message: string; month: number; plan_year: number } | null>(null);
  const [showPlanSummary, setShowPlanSummary] = useState(false);
  const [showCoverageReport, setShowCoverageReport] = useState(false);
  const [coverageReportSectionId, setCoverageReportSectionId] = useState('');

  useEffect(() => {
    apiGet<SavedCalendar[]>('/api/v1/admin/calendar', token).then(rows => {
      if (rows.length > 0) {
        const latest = rows[0];
        setSavedCalendar(latest);
        setForm({ academic_year: latest.academic_year, working_days: latest.working_days, start_date: latest.start_date?.split('T')[0] || '', end_date: latest.end_date?.split('T')[0] || '' });
      } else { setEditing(true); }
      setCalendarLoaded(true);
    }).catch(() => { setEditing(true); setCalendarLoaded(true); });
    apiGet<any>('/api/v1/admin/calendar/summary', token).then(s => { if (s) setCalSummary(s); }).catch(console.error);
    apiGet<any[]>('/api/v1/admin/classes', token).then(setClasses).catch(console.error);
  }, []);

  useEffect(() => { if (academicYear) { loadHolidays(); loadSpecialDays(); } }, [academicYear]);

  async function loadHolidays() { try { setHolidays(await apiGet<Holiday[]>(`/api/v1/admin/calendar/${academicYear}/holidays`, token)); apiGet<any>('/api/v1/admin/calendar/summary', token).then(s => { if (s) setCalSummary(s); }).catch(console.error); } catch { /* ignore */ } }
  async function loadSpecialDays() { try { setSpecialDays(await apiGet<SpecialDayGroup[]>(`/api/v1/admin/calendar/${academicYear}/special-days`, token)); apiGet<any>('/api/v1/admin/calendar/summary', token).then(s => { if (s) setCalSummary(s); }).catch(console.error); } catch { /* ignore */ } }

  async function saveCalendar() {
    setSaving(true); setSaveMsg('');
    try {
      const data = await apiPost<any>('/api/v1/admin/calendar', form, token);
      setWorkingDayCount(data.working_day_count ?? null);
      setSavedCalendar({ id: data.id, academic_year: form.academic_year, working_days: form.working_days, start_date: form.start_date, end_date: form.end_date });
      setEditing(false);
      apiGet<any>('/api/v1/admin/calendar/summary', token).then(s => { if (s) setCalSummary(s); }).catch(console.error);
    } catch (err: unknown) { setSaveMsg(err instanceof Error ? err.message : 'Failed'); }
    finally { setSaving(false); }
  }

  function toggleDay(day: number) { setForm(f => ({ ...f, working_days: f.working_days.includes(day) ? f.working_days.filter(d => d !== day) : [...f.working_days, day].sort() })); }

  async function addHoliday() {
    if (!newHoliday.holiday_date || !newHoliday.event_name) return;
    try { await apiPost<any>(`/api/v1/admin/calendar/${academicYear}/holidays`, newHoliday, token); setNewHoliday({ holiday_date: '', event_name: '' }); await loadHolidays(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  }

  async function saveEditHoliday() {
    if (!editingHoliday) return;
    try {
      await fetch(`${API_BASE}/api/v1/admin/calendar/${academicYear}/holidays/${editingHoliday.id}`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ holiday_date: editingHoliday.holiday_date, event_name: editingHoliday.event_name }),
      });
      setEditingHoliday(null); await loadHolidays();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  }

  async function deleteHoliday(id: string) {
    await fetch(`${API_BASE}/api/v1/admin/calendar/${academicYear}/holidays/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await loadHolidays();
  }

  async function exportHolidayPdf() {
    setExportingHolidays(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/calendar/${academicYear}/holidays/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json()).error);
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `holidays-${academicYear}.pdf`; a.click(); URL.revokeObjectURL(url);
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Export failed'); }
    finally { setExportingHolidays(false); }
  }

  async function addSpecialDay() {
    if (!newSpecialDay.from_date || !newSpecialDay.label) return;
    const resolvedType = newSpecialDay.day_type === 'custom' ? newSpecialDay.custom_day_type.trim() : newSpecialDay.day_type;
    if (!resolvedType) return;
    const body: any = {
      day_type: resolvedType,
      label: newSpecialDay.label,
      activity_note: newSpecialDay.activity_note || undefined,
      start_time: newSpecialDay.start_time || undefined,
      end_time: newSpecialDay.end_time || undefined,
      duration_type: newSpecialDay.duration_type,
    };
    if (newSpecialDay.day_type === 'revision' && newSpecialDay.revision_topics.length > 0) {
      body.revision_topics = newSpecialDay.revision_topics;
    }
    if (newSpecialDay.to_date && newSpecialDay.to_date !== newSpecialDay.from_date) { body.from_date = newSpecialDay.from_date; body.to_date = newSpecialDay.to_date; }
    else body.day_date = newSpecialDay.from_date;
    try {
      const res = await apiPost<any>(`/api/v1/admin/calendar/${academicYear}/special-days`, body, token);
      setNewSpecialDay({ from_date: '', to_date: '', day_type: 'settling', custom_day_type: '', label: '', activity_note: '', start_time: '', end_time: '', duration_type: 'full_day', revision_topics: [] });
      setRevisionTopicInput('');
      await loadSpecialDays();
      if (res.message) setMsg(res.message);
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  }

  async function deleteSpecialDayGroup(ids: string[]) {
    for (const id of ids) {
      await fetch(`${API_BASE}/api/v1/admin/calendar/${academicYear}/special-days/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    }
    await loadSpecialDays();
  }

  async function refreshPlanner() {
    if (!planForm.class_id) { alert('Select a class first'); return; }
    setRefreshingPlanner(true);
    try {
      const res = await apiPost<any>('/api/v1/admin/calendar/refresh-planner', { class_id: planForm.class_id, academic_year: academicYear }, token);
      setMsg(`✓ ${res.message}`);
    } catch (err: unknown) { setMsg(err instanceof Error ? err.message : 'Failed'); }
    finally { setRefreshingPlanner(false); }
  }

  async function generatePlans(force = false) {
    if (!planForm.class_id) return;
    setPlanLoading(true); setMsg(''); setPlanConflict(null);
    try {
      const body: any = { class_id: planForm.class_id, academic_year: academicYear };
      if (planForm.mode === 'month') { body.month = planForm.month; body.plan_year = planForm.plan_year; }
      if (force) body.force = true;
      const res = await fetch(`${API_BASE}/api/v1/admin/calendar/generate-plans`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 409 && data.plans_exist) {
        setPlanConflict({ message: data.message, month: data.month, plan_year: data.plan_year });
        return;
      }
      if (!res.ok) throw new Error(data.error);
      setMsg(`✓ ${data.message}`);
      // Fetch first section for coverage report
      try {
        const sections = await apiGet<any[]>(`/api/v1/admin/classes/${planForm.class_id}/sections`, token);
        if (sections.length > 0) setCoverageReportSectionId(sections[0].id);
      } catch { /* ignore — coverage report button will be hidden if no section */ }
    } catch (err: unknown) { setMsg(err instanceof Error ? err.message : 'Failed'); }
    finally { setPlanLoading(false); }
  }

  if (!calendarLoaded) return <div className="p-6 text-sm text-gray-400">Loading...</div>;

  if (!savedCalendar && editing) return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-primary mb-2">Calendar Setup</h1>
      <p className="text-sm text-gray-500 mb-6">Set up your academic year before adding holidays and generating plans.</p>
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Academic Year</label>
            <input className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="e.g. 2026-27" value={form.academic_year} onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Working Days</label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((d, i) => (
                <button key={i} onClick={() => toggleDay(i + 1)} className={`px-3 py-1 rounded-lg text-sm border transition-colors ${form.working_days.includes(i + 1) ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600 hover:border-primary/50'}`}>{d}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700">Start Date</label><input type="date" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700">End Date</label><input type="date" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
          </div>
          {saveMsg && <p className="text-sm text-red-500">{saveMsg}</p>}
          <Button onClick={saveCalendar} loading={saving} disabled={!form.academic_year || !form.start_date || !form.end_date}>Save Calendar</Button>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-primary mb-6">Calendar &amp; Day Plans</h1>

      {/* Academic Year Summary / Edit */}
      <Card className="mb-6">
        {!editing ? (
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">Academic Year</p>
              <p className="text-lg font-bold text-primary">{savedCalendar?.academic_year}</p>
              <p className="text-xs text-gray-500 mt-2">
                {formatDateShort(savedCalendar?.start_date || '')} → {formatDateShort(savedCalendar?.end_date || '')}
              </p>
              <div className="flex gap-1 mt-2 flex-wrap">
                {DAYS.map((d, i) => (
                  <span key={i} className={`px-2 py-0.5 rounded text-xs font-medium ${savedCalendar?.working_days.includes(i + 1) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>{d}</span>
                ))}
              </div>
              {workingDayCount !== null && <p className="text-xs text-gray-500 mt-2">📅 {workingDayCount} working days</p>}
              {calSummary && (
                <div className="flex gap-4 mt-3 text-sm flex-wrap">
                  <span className="text-gray-600">📅 <strong>{calSummary.working_day_count}</strong> working days</span>
                  <span className="text-red-500">🎉 <strong>{calSummary.holiday_count}</strong> holidays</span>
                  {Object.entries(calSummary.special_days).map(([type, count]) => (
                    <span key={type} className="text-gray-500 capitalize">
                      {DAY_TYPE_CONFIG[type]?.icon ?? '📌'} <strong>{count as number}</strong> {DAY_TYPE_CONFIG[type]?.label ?? type} days
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => { setForm({ academic_year: savedCalendar!.academic_year, working_days: savedCalendar!.working_days, start_date: savedCalendar!.start_date?.split('T')[0] || '', end_date: savedCalendar!.end_date?.split('T')[0] || '' }); setEditing(true); }}>Edit</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-700">Edit Academic Calendar</p>
              {savedCalendar && <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Academic Year</label>
              <input className="px-3 py-2 rounded-lg border border-gray-300 text-sm" value={form.academic_year} onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Working Days</label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i + 1)} className={`px-3 py-1 rounded-lg text-sm border transition-colors ${form.working_days.includes(i + 1) ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600'}`}>{d}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-600">Start Date</label><input type="date" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-600">End Date</label><input type="date" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            {saveMsg && <p className="text-sm text-red-500">{saveMsg}</p>}
            <Button onClick={saveCalendar} loading={saving}>Save Changes</Button>
          </div>
        )}
      </Card>

      {/* Holidays */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-gray-700">Holidays — {academicYear}</h2>
            {holidays.length > 0 && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{holidays.length}</span>}
          </div>
          <div className="flex gap-2">
            {holidays.length > 0 && <Button size="sm" variant="ghost" loading={exportingHolidays} onClick={exportHolidayPdf}>Export PDF</Button>}
            <Button size="sm" variant="ghost" onClick={() => setShowHolidayList(v => !v)}>{showHolidayList ? 'Hide' : 'Show List'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowImportModal(true)}>Import xlsx</Button>
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          <input type="date" className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={newHoliday.holiday_date} onChange={e => setNewHoliday(h => ({ ...h, holiday_date: e.target.value }))} />
          <input type="text" placeholder="Event name" className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={newHoliday.event_name} onChange={e => setNewHoliday(h => ({ ...h, event_name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addHoliday()} />
          <Button size="sm" onClick={addHoliday} disabled={!newHoliday.holiday_date || !newHoliday.event_name}>Add</Button>
        </div>
        {showHolidayList && (
          <div className="flex flex-col gap-1 border-t border-gray-100 pt-3">
            {holidays.map(h => (
              <div key={h.id} className="py-2 border-b border-gray-50 last:border-0">
                {editingHoliday?.id === h.id ? (
                  <div className="flex gap-2 items-center">
                    <input type="date" className="px-2 py-1 rounded border border-gray-300 text-sm" value={editingHoliday.holiday_date} onChange={e => setEditingHoliday(v => v ? { ...v, holiday_date: e.target.value } : v)} />
                    <input type="text" className="flex-1 px-2 py-1 rounded border border-gray-300 text-sm" value={editingHoliday.event_name} onChange={e => setEditingHoliday(v => v ? { ...v, event_name: e.target.value } : v)} />
                    <button onClick={saveEditHoliday} className="text-xs text-green-600 hover:text-green-800 font-medium">Save</button>
                    <button onClick={() => setEditingHoliday(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-primary/70 w-8">{dayName(h.holiday_date)}</span>
                      <span className="text-sm font-medium text-gray-800">{h.event_name}</span>
                      <span className="text-xs text-gray-400">{formatDateShort(h.holiday_date)}</span>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setEditingHoliday({ id: h.id, holiday_date: h.holiday_date.split('T')[0], event_name: h.event_name })} className="text-xs text-blue-400 hover:text-blue-600">Edit</button>
                      <button onClick={() => deleteHoliday(h.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {holidays.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No holidays added yet</p>}
          </div>
        )}
      </Card>

      {/* Special Days */}
      <Card className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-1">Special Days — {academicYear}</h2>
        <p className="text-xs text-gray-400 mb-4">School days where no curriculum is assigned. Plans on these days are automatically shifted forward.</p>
        <div className="flex gap-2 mb-2 flex-wrap">
          <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-600">From Date</label><input type="date" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" value={newSpecialDay.from_date} onChange={e => setNewSpecialDay(s => ({ ...s, from_date: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-600">To Date <span className="text-gray-400">(optional)</span></label><input type="date" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" value={newSpecialDay.to_date} min={newSpecialDay.from_date} onChange={e => setNewSpecialDay(s => ({ ...s, to_date: e.target.value }))} /></div>
          <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-600">Type</label>
            <select className="px-3 py-2 rounded-lg border border-gray-300 text-sm" value={newSpecialDay.day_type} onChange={e => {
              const val = e.target.value;
              const cfg = DAY_TYPE_CONFIG[val];
              setNewSpecialDay(s => ({ ...s, day_type: val, label: cfg?.defaultLabel ?? s.label }));
            }}>
              {Object.entries(DAY_TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>
          {newSpecialDay.day_type === 'custom' && (
            <div className="flex flex-col gap-1"><label className="text-xs font-medium text-gray-600">Custom Type</label>
              <input type="text" placeholder="e.g. orientation_day" className="px-3 py-2 rounded-lg border border-gray-300 text-sm w-40" value={newSpecialDay.custom_day_type} onChange={e => setNewSpecialDay(s => ({ ...s, custom_day_type: e.target.value }))} />
            </div>
          )}
          <div className="flex flex-col gap-1 flex-1 min-w-32"><label className="text-xs font-medium text-gray-600">Label</label><input type="text" placeholder="e.g. Term 1 Exam" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" value={newSpecialDay.label} onChange={e => setNewSpecialDay(s => ({ ...s, label: e.target.value }))} /></div>
          <div className="flex items-end"><Button size="sm" onClick={addSpecialDay} disabled={!newSpecialDay.from_date || !newSpecialDay.label || (newSpecialDay.day_type === 'custom' && !newSpecialDay.custom_day_type.trim())}>Add</Button></div>
        </div>
        {/* Duration Type toggle */}
        <div className="mb-3">
          <label className="text-xs font-medium text-gray-600 block mb-1">Duration</label>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {(['full_day', 'half_day'] as const).map(dt => (
              <button key={dt} onClick={() => setNewSpecialDay(s => ({ ...s, duration_type: dt }))} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${newSpecialDay.duration_type === dt ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}>
                {dt === 'full_day' ? 'Full Day' : 'Half Day'}
              </button>
            ))}
          </div>
        </div>
        {/* Revision Topics */}
        {newSpecialDay.day_type === 'revision' && (
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-600 block mb-1">Revision Topics <span className="text-gray-400">(optional)</span></label>
            <div className="flex flex-wrap gap-1 mb-1">
              {newSpecialDay.revision_topics.map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                  {t}
                  <button onClick={() => setNewSpecialDay(s => ({ ...s, revision_topics: s.revision_topics.filter((_, j) => j !== i) }))} className="hover:text-amber-900 leading-none">×</button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Type a topic and press Enter or comma"
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm w-full"
              value={revisionTopicInput}
              onChange={e => setRevisionTopicInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  const val = revisionTopicInput.trim().replace(/,$/, '');
                  if (val) { setNewSpecialDay(s => ({ ...s, revision_topics: [...s.revision_topics, val] })); setRevisionTopicInput(''); }
                }
              }}
            />
          </div>
        )}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-600">Activity Note <span className="text-gray-400">(optional — what to do on these days)</span></label>
          <input type="text" placeholder="e.g. Fun activities, games, settling exercises" className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" value={newSpecialDay.activity_note} onChange={e => setNewSpecialDay(s => ({ ...s, activity_note: e.target.value }))} />
        </div>
        <div className="flex gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Start Time <span className="text-gray-400">(override)</span></label>
            <input type="time" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" value={newSpecialDay.start_time} onChange={e => setNewSpecialDay(s => ({ ...s, start_time: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">End Time <span className="text-gray-400">(override)</span></label>
            <input type="time" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" value={newSpecialDay.end_time} onChange={e => setNewSpecialDay(s => ({ ...s, end_time: e.target.value }))} />
          </div>
          <div className="flex items-end pb-0.5">
            <p className="text-xs text-gray-400">Leave blank to use class default timings</p>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {specialDays.map((g, i) => {
            const cfg = DAY_TYPE_CONFIG[g.day_type] ?? { label: g.day_type, color: 'bg-gray-100 text-gray-600', icon: '📌', defaultLabel: g.day_type };
            const dateRange = g.from_date === g.to_date
              ? formatDateShort(g.from_date)
              : `${formatDateShort(g.from_date)} – ${formatDateShort(g.to_date)}`;
            return (
              <div key={i} className="py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
                    <div>
                      <span className="text-sm font-medium text-gray-800">{g.label}</span>
                      <span className="text-xs text-gray-400 ml-2">{dateRange}</span>
                      {g.count > 1 && <span className="text-xs text-gray-400 ml-1">· {g.count} days</span>}
                      {g.duration_type === 'half_day' && <span className="text-xs ml-2 px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-600 font-medium">½ day</span>}
                      {g.activity_note && <p className="text-xs text-blue-600 mt-0.5">📌 {g.activity_note}</p>}
                      {(g.start_time || g.end_time) && <p className="text-xs text-gray-500 mt-0.5">🕐 {g.start_time || '—'} – {g.end_time || '—'}</p>}
                      {g.revision_topics && g.revision_topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {g.revision_topics.map((t, ti) => (
                            <span key={ti} className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => deleteSpecialDayGroup(g.ids)} className="text-xs text-red-400 hover:text-red-600 shrink-0 ml-2">Delete</button>
                </div>
              </div>
            );
          })}
          {specialDays.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No special days added yet</p>}
        </div>
      </Card>

      {/* Generate Plans */}
      <Card className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-1">Generate Day Plans</h2>
        <p className="text-xs text-gray-400 mb-4">Monthly is recommended — picks up from where the previous month left off.</p>
        <div className="flex flex-col gap-3">
          <select className="px-3 py-2 rounded-lg border border-gray-300 text-sm" value={planForm.class_id} onChange={e => setPlanForm(f => ({ ...f, class_id: e.target.value }))}>
            <option value="">Select class...</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {(['month','year'] as const).map(m => (
              <button key={m} onClick={() => setPlanForm(f => ({ ...f, mode: m }))} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${planForm.mode === m ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}>{m === 'month' ? 'Monthly' : 'Full Year'}</button>
            ))}
          </div>
          {planForm.mode === 'month' && (
            <div className="flex gap-2">
              <select className="px-3 py-2 rounded-lg border border-gray-300 text-sm" value={planForm.month} onChange={e => setPlanForm(f => ({ ...f, month: parseInt(e.target.value) }))}>
                {MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <input type="number" min={2024} max={2040} className="px-3 py-2 rounded-lg border border-gray-300 text-sm w-24" value={planForm.plan_year} onChange={e => setPlanForm(f => ({ ...f, plan_year: parseInt(e.target.value) }))} />
            </div>
          )}
          {msg && <p className={`text-sm ${msg.startsWith('✓') ? 'text-green-600' : 'text-gray-600'}`}>{msg}</p>}
          {msg.startsWith('✓') && coverageReportSectionId && (
            <Button size="sm" variant="ghost" onClick={() => setShowCoverageReport(true)}>
              📊 View Coverage Report
            </Button>
          )}
          <Button onClick={() => setShowPlanSummary(true)} loading={planLoading} disabled={!planForm.class_id} variant="secondary">
            {planForm.mode === 'month' ? 'Generate Month Plans' : 'Generate Full Year Plans'}
          </Button>
          {planForm.class_id && academicYear && (
            <div className="border-t border-gray-100 pt-3 mt-1">
              <p className="text-xs text-gray-500 mb-2">Already generated plans? If you added special days or holidays after generating, refresh the planner to shift affected days forward.</p>
              <Button size="sm" variant="ghost" onClick={refreshPlanner} loading={refreshingPlanner}>
                🔄 Refresh Planner
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Plan conflict confirmation dialog */}
      {planConflict && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <Card className="w-full max-w-md">
            <h2 className="text-base font-semibold text-gray-800 mb-2">Plans Already Exist</h2>
            <p className="text-sm text-gray-600 mb-4">{planConflict.message}</p>
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 text-xs text-red-700">
              ⚠ Regenerating will permanently delete all completion records and attendance for this month. This cannot be undone.
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPlanConflict(null)} className="flex-1">Cancel</Button>
              <Button variant="danger" onClick={() => { setPlanConflict(null); generatePlans(true); }} className="flex-1">Regenerate &amp; Reset</Button>
            </div>
          </Card>
        </div>
      )}

      {showImportModal && <HolidayImportModal year={academicYear} token={token} onClose={() => setShowImportModal(false)} onImported={loadHolidays} />}

      {showPlanSummary && (
        <PreGenerationModal
          classId={planForm.class_id}
          academicYear={academicYear}
          month={planForm.mode === 'month' ? planForm.month : undefined}
          planYear={planForm.mode === 'month' ? planForm.plan_year : undefined}
          token={token}
          onProceed={() => { setShowPlanSummary(false); generatePlans(); }}
          onCancel={() => setShowPlanSummary(false)}
        />
      )}

      {showCoverageReport && coverageReportSectionId && (
        <CoverageReport
          classId={planForm.class_id}
          sectionId={coverageReportSectionId}
          academicYear={academicYear}
          token={token}
          onDismiss={() => setShowCoverageReport(false)}
        />
      )}
    </div>
  );
}
}

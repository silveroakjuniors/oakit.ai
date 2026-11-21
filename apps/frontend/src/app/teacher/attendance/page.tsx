'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';
import AttendanceRow from '@/components/ui/AttendanceRow';
import { API_BASE, apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { ChevronLeft, ChevronRight, Calendar, X, AlertCircle, Clock } from 'lucide-react';

interface StudentAttendance {
  id: string;
  name: string;
  father_name?: string;
  attendance_status: 'present' | 'absent' | null;
  is_late?: boolean;
  arrived_at?: string | null;
  edited_by_name?: string | null;
}

interface SectionOption {
  section_id: string;
  section_label: string;
  class_name: string;
  role: 'class_teacher' | 'supporting';
}

interface AbsenceRecord {
  date: string;
  is_late?: boolean;
  arrived_at?: string | null;
}

interface AbsenceHistory {
  student: { id: string; name: string; class_name: string; section_label: string };
  school_days: number;
  present_count: number;
  absent_count: number;
  attendance_pct: number | null;
  absences: AbsenceRecord[];
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function prevDay(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
function nextDay(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function AttendancePage() {
  const router = useRouter();
  const token = getToken() || '';

  // State
  const [sections, setSections]           = useState<SectionOption[]>([]);
  const [selectedSectionId, setSection]   = useState<string | null>(null);
  const [viewDate, setViewDate]           = useState('');   // YYYY-MM-DD
  const [todayDate, setTodayDate]         = useState('');
  const [students, setStudents]           = useState<StudentAttendance[]>([]);
  const [attendance, setAttendance]       = useState<Record<string, 'present' | 'absent'>>({});
  const [editable, setEditable]           = useState(false);
  const [submitted, setSubmitted]         = useState(false);
  const [loading, setLoading]             = useState(false);
  const [holidayWarning, setHolidayWarning] = useState<{ holiday_name: string } | null>(null);
  const [lateWarning, setLateWarning]     = useState<string | null>(null);
  const [updatingLate, setUpdatingLate]   = useState<string | null>(null);
  const [absenceModal, setAbsenceModal]   = useState<AbsenceHistory | null>(null);
  const [absenceLoading, setAbsenceLoading] = useState(false);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    loadSections();
  }, []);

  async function loadSections() {
    try {
      const data = await apiGet<SectionOption[]>('/api/v1/teacher/sections', token);
      setSections(data);
      if (data.length >= 1) {
        setSection(data[0].section_id);
        await loadAttendanceForDate(null, data[0].section_id);
      }
    } catch (err) { console.error(err); }
  }

  const loadAttendanceForDate = useCallback(async (date: string | null, sectionId: string | null) => {
    const sid = sectionId ?? selectedSectionId;
    if (!sid) return;
    setLoading(true);
    try {
      const isToday = !date;
      const url = isToday
        ? `/api/v1/teacher/attendance/today?section_id=${sid}`
        : `/api/v1/teacher/attendance/${date}?section_id=${sid}`;
      const data = await apiGet<{
        date: string; students: StudentAttendance[];
        late_marking_warning?: string; editable?: boolean;
      }>(url, token);

      setViewDate(data.date);
      if (isToday) setTodayDate(data.date);
      setStudents(data.students);
      setEditable(isToday ? true : (data.editable ?? false));
      if (data.late_marking_warning) setLateWarning(data.late_marking_warning);

      const existing: Record<string, 'present' | 'absent'> = {};
      data.students.forEach(s => { if (s.attendance_status) existing[s.id] = s.attendance_status; });
      setAttendance(existing);

      const allMarked = data.students.length > 0 && data.students.every(s => s.attendance_status);
      setSubmitted(allMarked && (isToday ? true : !data.editable));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [selectedSectionId, token]);

  function goToDate(date: string) {
    if (date > todayDate) return; // can't go to future
    setSubmitted(false);
    loadAttendanceForDate(date, null);
  }

  async function submit(confirmHoliday = false) {
    setLoading(true);
    setHolidayWarning(null);
    try {
      const records = Object.entries(attendance).map(([student_id, status]) => ({ student_id, status }));
      const body: any = { records };
      if (confirmHoliday) body.confirm_holiday = true;
      const url = `${API_BASE}/api/v1/teacher/attendance/today?section_id=${selectedSectionId}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 409 && data.warning) { setHolidayWarning({ holiday_name: data.holiday_name }); return; }
      if (!res.ok) throw new Error(data.error);
      if (data.late_marking_warning) setLateWarning(data.late_marking_warning);
      setSubmitted(true);
      await loadAttendanceForDate(null, null);
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed to submit'); }
    finally { setLoading(false); }
  }

  async function markLateArrival(studentId: string) {
    setUpdatingLate(studentId);
    try {
      const res = await fetch(`${API_BASE}/api/v1/teacher/attendance/today/${studentId}?section_id=${selectedSectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'present' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadAttendanceForDate(null, null);
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setUpdatingLate(null); }
  }

  async function openAbsenceHistory(studentId: string) {
    setAbsenceLoading(true);
    setAbsenceModal(null);
    try {
      const data = await apiGet<AbsenceHistory>(
        `/api/v1/teacher/attendance/student/${studentId}/absences?section_id=${selectedSectionId}`,
        token,
      );
      setAbsenceModal(data);
    } catch (err) { console.error(err); }
    finally { setAbsenceLoading(false); }
  }

  const isToday = viewDate === todayDate;
  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = Object.values(attendance).filter(s => s === 'absent').length;
  const markedCount = Object.keys(attendance).length;

  // ── Section picker ──────────────────────────────────────────────────────
  if (sections.length > 1 && selectedSectionId === null) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <header className="bg-primary text-white px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/teacher')} className="text-white/70 hover:text-white"><ChevronLeft size={20}/></button>
          <h1 className="font-semibold">Select Section</h1>
        </header>
        <div className="p-4 max-w-lg mx-auto flex flex-col gap-3">
          {sections.map(sec => (
            <button key={sec.section_id} onClick={() => { setSection(sec.section_id); loadAttendanceForDate(null, sec.section_id); }} className="text-left w-full">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{sec.class_name}</p>
                    <p className="text-sm text-gray-500">{sec.section_label}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${sec.role === 'class_teacher' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {sec.role === 'class_teacher' ? 'Class Teacher' : 'Supporting'}
                  </span>
                </div>
              </Card>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Main attendance view ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <header className="bg-primary text-white px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/teacher')} className="text-white/70 hover:text-white shrink-0"><ChevronLeft size={20}/></button>
          <h1 className="font-semibold flex-1 truncate">Attendance</h1>
          <button onClick={() => loadAttendanceForDate(isToday ? null : viewDate, null)} className="text-white/70 hover:text-white text-xs px-2 py-1 rounded border border-white/20">
            Refresh
          </button>
        </div>

        {/* Date navigator */}
        {viewDate && (
          <div className="flex items-center justify-between mt-2 bg-white/10 rounded-xl px-3 py-2">
            <button
              onClick={() => goToDate(prevDay(viewDate))}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
            >
              <ChevronLeft size={18}/>
            </button>

            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-white/70"/>
              <span className="text-sm font-semibold text-white">{fmtDate(viewDate)}</span>
              {isToday && <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold">Today</span>}
              {!isToday && <span className="text-[10px] bg-amber-400/30 text-amber-100 px-2 py-0.5 rounded-full font-semibold">Past</span>}
            </div>

            <button
              onClick={() => goToDate(nextDay(viewDate))}
              disabled={isToday}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronRight size={18}/>
            </button>
          </div>
        )}

        {/* Date picker */}
        <div className="mt-2 flex items-center gap-2">
          <label className="text-xs text-white/60">Jump to:</label>
          <input
            type="date"
            max={todayDate}
            value={viewDate}
            onChange={e => goToDate(e.target.value)}
            className="text-xs bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white focus:outline-none"
          />
          {!isToday && (
            <button onClick={() => goToDate(todayDate)} className="text-xs bg-white/20 text-white px-2 py-1 rounded-lg hover:bg-white/30">
              Today
            </button>
          )}
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto pb-20">

        {lateWarning && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-3 flex gap-2">
            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5"/>
            <p className="text-xs text-amber-700">{lateWarning}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16 text-neutral-400 text-sm">Loading...</div>
        ) : (
          <>
            {/* Summary bar */}
            {markedCount > 0 && (
              <div className="flex gap-2 mb-3">
                <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-center">
                  <div className="text-lg font-bold text-emerald-700">{presentCount}</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">Present</div>
                </div>
                <div className="flex-1 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-center">
                  <div className="text-lg font-bold text-red-600">{absentCount}</div>
                  <div className="text-[10px] text-red-500 font-semibold">Absent</div>
                </div>
                <div className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-center">
                  <div className="text-lg font-bold text-neutral-700">{students.length}</div>
                  <div className="text-[10px] text-neutral-500 font-semibold">Total</div>
                </div>
              </div>
            )}

            {/* Past-day read-only notice */}
            {!isToday && !editable && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
                <AlertCircle size={14} className="text-blue-500 shrink-0"/>
                <p className="text-xs text-blue-700">Viewing past attendance — read only. Tap any student name to see their absence history.</p>
              </div>
            )}

            {/* Mark all present button (today only) */}
            {isToday && !submitted && students.length > 0 && (
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => { const all: Record<string, 'present' | 'absent'> = {}; students.forEach(s => { all[s.id] = 'present'; }); setAttendance(all); }}
                  className="flex-1 text-sm font-semibold py-2 rounded-xl border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                >
                  Mark All Present
                </button>
              </div>
            )}

            {/* Student list */}
            <Card className="mb-4">
              {students.map((s, idx) => (
                <div key={s.id} className={idx < students.length - 1 ? 'border-b border-neutral-50' : ''}>
                  {isToday && !submitted ? (
                    // Today — editable attendance row
                    <AttendanceRow
                      studentId={s.id}
                      name={s.name}
                      fatherName={s.father_name}
                      status={attendance[s.id] || null}
                      onChange={(id, status) => setAttendance(prev => ({ ...prev, [id]: status }))}
                    />
                  ) : (
                    // Past day or submitted — read-only with tap-to-view-history
                    <button
                      onClick={() => openAbsenceHistory(s.id)}
                      className="w-full flex items-center justify-between py-3 px-1 hover:bg-neutral-50 rounded-xl text-left transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-800">{s.name}</p>
                        {s.father_name && <p className="text-xs text-neutral-400">{s.father_name}</p>}
                        {s.is_late && (
                          <span className="text-[10px] text-amber-600 flex items-center gap-0.5 mt-0.5">
                            <Clock size={10}/> Late arrival {s.arrived_at ? `· ${new Date(s.arrived_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {s.attendance_status ? (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            s.attendance_status === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                          }`}>
                            {s.attendance_status === 'present' ? 'Present' : 'Absent'}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">Not marked</span>
                        )}
                        <span className="text-xs text-neutral-300">History</span>
                        <ChevronRight size={14} className="text-neutral-300"/>
                      </div>
                    </button>
                  )}
                </div>
              ))}
            </Card>

            {/* Late arrival section — only on today after submission */}
            {isToday && submitted && (
              <Card className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-1">Late Arrivals</p>
                <p className="text-xs text-gray-400 mb-3">Tap to update an absent student who arrived late.</p>
                {students.filter(s => s.attendance_status === 'absent').map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm text-gray-800">{s.name}</p>
                      <p className="text-xs text-red-500 font-medium">Absent</p>
                    </div>
                    <button
                      onClick={() => markLateArrival(s.id)}
                      disabled={updatingLate === s.id}
                      className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-200 disabled:opacity-50 font-medium"
                    >
                      {updatingLate === s.id ? '...' : 'Late Arrival'}
                    </button>
                  </div>
                ))}
                {students.filter(s => s.is_late).map(s => (
                  <div key={s.id + '_late'} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm text-gray-800">{s.name}</p>
                      <p className="text-xs text-amber-600 flex items-center gap-1"><Clock size={10}/> Late arrival{s.arrived_at ? ` · ${new Date(s.arrived_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
                    </div>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">Late</span>
                  </div>
                ))}
                {students.filter(s => s.attendance_status === 'absent' || s.is_late).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">All students present on time</p>
                )}
              </Card>
            )}

            {/* Submit button — today only, not yet submitted */}
            {isToday && !submitted && (
              <Button onClick={() => submit(false)} loading={loading} className="w-full" disabled={markedCount === 0}>
                Submit Attendance ({markedCount}/{students.length} marked)
              </Button>
            )}

            {isToday && submitted && (
              <div className="text-center py-2">
                <span className="text-sm text-emerald-600 font-semibold">Attendance submitted for today</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Holiday warning dialog */}
      {holidayWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <Card className="w-full max-w-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Holiday Warning</h2>
            <p className="text-sm text-gray-600 mb-4">Today is <strong>{holidayWarning.holiday_name}</strong>. Submit attendance anyway?</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setHolidayWarning(null)} className="flex-1">Cancel</Button>
              <Button onClick={() => submit(true)} loading={loading} className="flex-1">Submit Anyway</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Absence history modal */}
      {(absenceModal || absenceLoading) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-3xl w-full max-w-sm max-h-[85vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <div>
                <p className="text-sm font-bold text-neutral-800">{absenceModal?.student.name ?? '...'}</p>
                {absenceModal && (
                  <p className="text-xs text-neutral-500">{absenceModal.student.class_name} — {absenceModal.student.section_label}</p>
                )}
              </div>
              <button onClick={() => setAbsenceModal(null)} className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200">
                <X size={16} className="text-neutral-600"/>
              </button>
            </div>

            {absenceLoading ? (
              <div className="flex-1 flex items-center justify-center py-12 text-neutral-400 text-sm">Loading...</div>
            ) : absenceModal ? (
              <div className="flex-1 overflow-y-auto p-5">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                  <div className="bg-neutral-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-neutral-800">{absenceModal.school_days}</div>
                    <div className="text-[10px] text-neutral-500 font-semibold">School Days</div>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-emerald-700">{absenceModal.present_count}</div>
                    <div className="text-[10px] text-emerald-600 font-semibold">Present</div>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-red-600">{absenceModal.absent_count}</div>
                    <div className="text-[10px] text-red-500 font-semibold">Absent</div>
                  </div>
                </div>

                {absenceModal.attendance_pct !== null && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-neutral-600">Attendance rate</span>
                      <span className={`text-xs font-bold ${absenceModal.attendance_pct >= 75 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {absenceModal.attendance_pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${absenceModal.attendance_pct >= 75 ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${absenceModal.attendance_pct}%` }}
                      />
                    </div>
                    {absenceModal.attendance_pct < 75 && (
                      <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle size={10}/> Below 75% — attendance is a concern
                      </p>
                    )}
                  </div>
                )}

                {/* Absent dates list */}
                <p className="text-xs font-bold text-neutral-600 uppercase tracking-wider mb-2">
                  Absent Dates ({absenceModal.absent_count})
                </p>
                {absenceModal.absences.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-6">No absences recorded this year</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {absenceModal.absences.map((a, i) => (
                      <div key={i} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                        <span className="text-sm font-medium text-neutral-800">{fmtDate(a.date)}</span>
                        {a.is_late && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                            <Clock size={9}/> Late
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';
import AttendanceRow from '@/components/ui/AttendanceRow';
import { API_BASE, apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';

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

export default function AttendancePage() {
  const router = useRouter();
  const token = getToken() || '';
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [holidayWarning, setHolidayWarning] = useState<{ holiday_name: string } | null>(null);
  const [lateMarkingWarning, setLateMarkingWarning] = useState<string | null>(null);
  const [updatingLate, setUpdatingLate] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    loadSections();
  }, []);

  async function loadSections() {
    try {
      const data = await apiGet<SectionOption[]>('/api/v1/teacher/sections', token);
      if (data.length === 1) {
        setSelectedSectionId(data[0].section_id);
        loadToday(data[0].section_id);
      } else {
        setSections(data);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadToday(sectionId?: string) {
    try {
      const url = sectionId
        ? `/api/v1/teacher/attendance/today?section_id=${sectionId}`
        : '/api/v1/teacher/attendance/today';
      const data = await apiGet<{ date: string; students: StudentAttendance[]; late_marking_warning?: string }>(url, token);
      setDate(data.date);
      setStudents(data.students);
      if (data.late_marking_warning) setLateMarkingWarning(data.late_marking_warning);
      const existing: Record<string, 'present' | 'absent'> = {};
      data.students.forEach(s => {
        if (s.attendance_status) existing[s.id] = s.attendance_status;
      });
      setAttendance(existing);
      // If all students already have attendance, show as submitted
      if (data.students.length > 0 && data.students.every(s => s.attendance_status)) {
        setSubmitted(true);
      }
    } catch (err) { console.error(err); }
  }

  function handleSelectSection(id: string) {
    setSelectedSectionId(id);
    loadToday(id);
  }

  function handleToggle(studentId: string, status: 'present' | 'absent') {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  }

  async function submit(confirmHoliday = false) {
    setLoading(true);
    setHolidayWarning(null);
    try {
      const records = Object.entries(attendance).map(([student_id, status]) => ({ student_id, status }));
      const body: any = { records };
      if (confirmHoliday) body.confirm_holiday = true;

      const baseUrl = `${API_BASE}/api/v1/teacher/attendance/today`;
      const url = selectedSectionId ? `${baseUrl}?section_id=${selectedSectionId}` : baseUrl;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status === 409 && data.warning) {
        setHolidayWarning({ holiday_name: data.holiday_name });
        return;
      }
      if (!res.ok) throw new Error(data.error);

      if (data.late_marking_warning) setLateMarkingWarning(data.late_marking_warning);
      setSubmitted(true);
      await loadToday(selectedSectionId || undefined);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setLoading(false);
    }
  }

  const markedCount = Object.keys(attendance).length;
  const presentCount = Object.values(attendance).filter(s => s === 'present').length;

  async function markLateArrival(studentId: string) {
    setUpdatingLate(studentId);
    try {
      const baseUrl = `${API_BASE}/api/v1/teacher/attendance/today/${studentId}`;
      const url = selectedSectionId ? `${baseUrl}?section_id=${selectedSectionId}` : baseUrl;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'present' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadToday(selectedSectionId || undefined);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally { setUpdatingLate(null); }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg">
        <header className="bg-primary text-white px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/teacher')} className="text-white/70 hover:text-white">←</button>
          <h1 className="font-semibold">Attendance — {date}</h1>
        </header>
        <div className="p-4 max-w-lg mx-auto">
          {lateMarkingWarning && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-4 flex gap-2">
              <span className="text-amber-500">⚠</span>
              <p className="text-xs text-amber-700">{lateMarkingWarning}</p>
            </div>
          )}
          <Card padding="lg" className="text-center mb-4">
            <div className="text-3xl mb-2">✓</div>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Attendance Submitted</h2>
            <p className="text-sm text-gray-500">{presentCount} present · {markedCount - presentCount} absent</p>
          </Card>

          {/* Late arrival section */}
          <Card>
            <p className="text-sm font-semibold text-gray-700 mb-3">Late Arrivals</p>
            <p className="text-xs text-gray-400 mb-3">If a student arrived late, tap "Mark Late Arrival" to update their status.</p>
            <div className="flex flex-col gap-2">
              {students.filter(s => s.attendance_status === 'absent').map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm text-gray-800">{s.name}</p>
                    {s.father_name && <p className="text-xs text-gray-400">{s.father_name}</p>}
                  </div>
                  <button
                    onClick={() => markLateArrival(s.id)}
                    disabled={updatingLate === s.id}
                    className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-200 disabled:opacity-50"
                  >
                    {updatingLate === s.id ? '...' : '⏰ Late Arrival'}
                  </button>
                </div>
              ))}
              {students.filter(s => s.is_late).map(s => (
                <div key={s.id + '_late'} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm text-gray-800">{s.name}</p>
                    <p className="text-xs text-amber-600">
                      ⏰ Late arrival
                      {s.arrived_at ? ` · ${new Date(s.arrived_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </p>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Late</span>
                </div>
              ))}
              {students.filter(s => s.attendance_status === 'absent').length === 0 &&
               students.filter(s => s.is_late).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">All students present on time</p>
              )}
            </div>
          </Card>

          <Button onClick={() => router.push('/teacher')} className="w-full mt-4">Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  // Section picker: show when multiple sections and none selected yet
  if (sections.length > 1 && selectedSectionId === null) {
    return (
      <div className="min-h-screen bg-bg">
        <header className="bg-primary text-white px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/teacher')} className="text-white/70 hover:text-white">←</button>
          <h1 className="font-semibold">Select Section</h1>
        </header>
        <div className="p-4 max-w-lg mx-auto">
          <p className="text-sm text-gray-500 mb-4">You are assigned to multiple sections. Pick one to take attendance.</p>
          <div className="flex flex-col gap-3">
            {sections.map(sec => (
              <button
                key={sec.section_id}
                onClick={() => handleSelectSection(sec.section_id)}
                className="text-left w-full"
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{sec.class_name}</p>
                      <p className="text-sm text-gray-500">{sec.section_label}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      sec.role === 'class_teacher'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {sec.role === 'class_teacher' ? 'Class Teacher' : 'Supporting'}
                    </span>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-primary text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/teacher')} className="text-white/70 hover:text-white">←</button>
        <h1 className="font-semibold">Attendance — {date}</h1>
      </header>

      <div className="p-4 max-w-lg mx-auto">
        {lateMarkingWarning && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-4 flex gap-2">
            <span className="text-amber-500">⚠</span>
            <p className="text-xs text-amber-700">{lateMarkingWarning}</p>
          </div>
        )}
        <Card className="mb-4">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>{students.length} students</span>
            <span>{markedCount} marked · {presentCount} present</span>
          </div>
          <div className="flex gap-2 mb-4">
            <Button size="sm" variant="ghost" onClick={() => {
              const all: Record<string, 'present' | 'absent'> = {};
              students.forEach(s => { all[s.id] = 'present'; });
              setAttendance(all);
            }}>Mark All Present</Button>
          </div>
          {students.map(s => (
            <AttendanceRow
              key={s.id}
              studentId={s.id}
              name={s.name}
              fatherName={s.father_name}
              status={attendance[s.id] || null}
              onChange={handleToggle}
            />
          ))}
        </Card>

        <Button onClick={() => submit(false)} loading={loading} className="w-full" disabled={markedCount === 0}>
          Submit Attendance
        </Button>
      </div>

      {/* Holiday warning dialog */}
      {holidayWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <Card className="w-full max-w-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Holiday Warning</h2>
            <p className="text-sm text-gray-600 mb-4">
              Today is <strong>{holidayWarning.holiday_name}</strong>. Are you sure you want to submit attendance?
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setHolidayWarning(null)} className="flex-1">Cancel</Button>
              <Button onClick={() => submit(true)} loading={loading} className="flex-1">Submit Anyway</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

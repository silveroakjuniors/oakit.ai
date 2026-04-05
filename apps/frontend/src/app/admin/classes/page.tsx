'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Badge } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Teacher { id: string; name: string; }
interface Section { id: string; label: string; teachers: Teacher[]; class_teacher_id?: string; class_teacher_name?: string; }
interface Class { id: string; name: string; day_start_time?: string; day_end_time?: string; sections: Section[]; }

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [newSectionLabel, setNewSectionLabel] = useState<Record<string, string>>({});
  const [classTeacherErrors, setClassTeacherErrors] = useState<Record<string, string>>({});
  const [timings, setTimings] = useState<Record<string, { start: string; end: string }>>({});
  const [timingMsg, setTimingMsg] = useState<Record<string, string>>({});
  const token = getToken() || '';

  async function load() {
    try {
      const [cls, users] = await Promise.all([
        apiGet<Class[]>('/api/v1/admin/classes', token),
        apiGet<{ id: string; name: string; role: string }[]>('/api/v1/admin/users', token),
      ]);
      setClasses(cls);
      setAllTeachers(users.filter(u => u.role === 'teacher'));
      // Init timings state from loaded classes
      const t: Record<string, { start: string; end: string }> = {};
      cls.forEach(c => { t[c.id] = { start: c.day_start_time?.slice(0,5) || '09:30', end: c.day_end_time?.slice(0,5) || '13:30' }; });
      setTimings(t);
    } catch (err) { console.error(err); }
  }

  useEffect(() => { load(); }, []);

  async function addClass() {
    if (!newClassName.trim()) return;
    try {
      await apiPost('/api/v1/admin/classes', { name: newClassName.trim() }, token);
      setNewClassName('');
      await load();
    } catch (err) { console.error(err); }
  }

  async function addSection(classId: string) {
    const label = newSectionLabel[classId]?.trim();
    if (!label) return;
    try {
      await apiPost(`/api/v1/admin/classes/${classId}/sections`, { label }, token);
      setNewSectionLabel(prev => ({ ...prev, [classId]: '' }));
      await load();
    } catch (err) { console.error(err); }
  }

  async function assignTeacher(sectionId: string, teacherId: string) {
    try {
      await apiPost(`/api/v1/admin/classes/sections/${sectionId}/teachers`, { teacher_id: teacherId }, token);
      await load();
    } catch (err) { console.error(err); }
  }

  async function removeTeacher(sectionId: string, teacherId: string) {
    try {
      await fetch(`${API_BASE}/api/v1/admin/classes/sections/${sectionId}/teachers/${teacherId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } catch (err) { console.error(err); }
  }

  async function assignClassTeacher(sectionId: string, teacherId: string) {
    setClassTeacherErrors(prev => ({ ...prev, [sectionId]: '' }));
    try {
      await apiPost(`/api/v1/admin/classes/sections/${sectionId}/class-teacher`, { teacher_id: teacherId }, token);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign class teacher';
      setClassTeacherErrors(prev => ({ ...prev, [sectionId]: msg }));
    }
  }

  async function removeClassTeacher(sectionId: string) {
    setClassTeacherErrors(prev => ({ ...prev, [sectionId]: '' }));
    try {
      await fetch(`${API_BASE}/api/v1/admin/classes/sections/${sectionId}/class-teacher`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } catch { /* ignore */ }
  }

  const assignedClassTeacherIds = new Set(
    classes.flatMap(c => c.sections.map(s => s.class_teacher_id).filter(Boolean))
  );

  async function saveTimings(classId: string) {
    const t = timings[classId];
    if (!t) return;
    try {
      await fetch(`${API_BASE}/api/v1/admin/classes/${classId}/timings`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ day_start_time: t.start, day_end_time: t.end }),
      });
      setTimingMsg(prev => ({ ...prev, [classId]: '✓ Saved' }));
      setTimeout(() => setTimingMsg(prev => ({ ...prev, [classId]: '' })), 2000);
    } catch { setTimingMsg(prev => ({ ...prev, [classId]: 'Failed' })); }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-primary">Classes & Sections</h1>
      </div>

      <Card className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Add New Class</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="e.g. LKG, UKG, Prep1"
            value={newClassName}
            onChange={e => setNewClassName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addClass()}
          />
          <Button onClick={addClass} size="sm">Add Class</Button>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        {classes.map(cls => (
          <Card key={cls.id} padding="sm">
            <button
              className="w-full flex items-center justify-between px-2 py-2 text-left"
              onClick={() => setExpanded(expanded === cls.id ? null : cls.id)}
            >
              <span className="font-semibold text-gray-800">{cls.name}</span>
              <div className="flex items-center gap-2">
                <Badge label={`${cls.sections.length} sections`} variant="neutral" />
                <span className="text-gray-400 text-sm">{expanded === cls.id ? '▲' : '▼'}</span>
              </div>
            </button>

            {expanded === cls.id && (
              <div className="mt-3 px-2 flex flex-col gap-3">
                {/* Class timings */}
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">Class Hours</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">Start</label>
                      <input type="time" className="px-2 py-1 rounded border border-gray-200 text-sm" value={timings[cls.id]?.start || '09:30'} onChange={e => setTimings(prev => ({ ...prev, [cls.id]: { ...prev[cls.id], start: e.target.value } }))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">End</label>
                      <input type="time" className="px-2 py-1 rounded border border-gray-200 text-sm" value={timings[cls.id]?.end || '13:30'} onChange={e => setTimings(prev => ({ ...prev, [cls.id]: { ...prev[cls.id], end: e.target.value } }))} />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button size="sm" onClick={() => saveTimings(cls.id)}>Save</Button>
                      {timingMsg[cls.id] && <span className="text-xs text-green-600">{timingMsg[cls.id]}</span>}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Used by Oakie to generate time-blocked daily plans</p>
                </div>
                {cls.sections.map(sec => (
                  <div key={sec.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-gray-700">Section {sec.label}</span>
                    </div>

                    {/* Class teacher */}
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 mb-1">Class Teacher</p>
                      {sec.class_teacher_id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            {sec.class_teacher_name || allTeachers.find(t => t.id === sec.class_teacher_id)?.name || 'Assigned'}
                          </span>
                          <button onClick={() => removeClassTeacher(sec.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                        </div>
                      ) : (
                        <select
                          className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600"
                          defaultValue=""
                          onChange={e => { if (e.target.value) assignClassTeacher(sec.id, e.target.value); e.target.value = ''; }}
                        >
                          <option value="" disabled>Assign class teacher...</option>
                          {allTeachers
                            .filter(t => !assignedClassTeacherIds.has(t.id) || t.id === sec.class_teacher_id)
                            .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      )}
                      {classTeacherErrors[sec.id] && (
                        <p className="text-xs text-red-500 mt-1">{classTeacherErrors[sec.id]}</p>
                      )}
                    </div>

                    {/* Assigned teachers */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      {sec.teachers.map(t => (
                        <span key={t.id} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                          {t.name}
                          <button onClick={() => removeTeacher(sec.id, t.id)} className="hover:text-red-500 ml-1">×</button>
                        </span>
                      ))}
                      {sec.teachers.length === 0 && <span className="text-xs text-gray-400">No teachers assigned</span>}
                    </div>
                    <select
                      className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600"
                      defaultValue=""
                      onChange={e => { if (e.target.value) assignTeacher(sec.id, e.target.value); e.target.value = ''; }}
                    >
                      <option value="" disabled>+ Assign teacher</option>
                      {allTeachers
                        .filter(t => !sec.teachers.find(st => st.id === t.id))
                        .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                ))}

                <div className="flex gap-2 mt-1">
                  <input
                    className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Section label (e.g. A, B)"
                    value={newSectionLabel[cls.id] || ''}
                    onChange={e => setNewSectionLabel(prev => ({ ...prev, [cls.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addSection(cls.id)}
                  />
                  <Button size="sm" variant="ghost" onClick={() => addSection(cls.id)}>+ Section</Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {classes.length === 0 && (
          <p className="text-center text-gray-400 py-8">No classes yet. Add one above.</p>
        )}
      </div>
    </div>
  );
}

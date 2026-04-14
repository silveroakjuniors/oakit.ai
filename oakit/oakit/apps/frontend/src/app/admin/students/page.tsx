'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, Card, Badge } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Student { id: string; name: string; father_name: string; parent_contact: string; photo_path?: string; photo_url?: string; class_name: string; section_label: string; is_active: boolean; }
interface Class { id: string; name: string; sections: { id: string; label: string }[]; }

function ParentLinkPanel({ studentId, token, apiBase }: { studentId: string; token: string; apiBase: string }) {
  const [mobile, setMobile] = useState('');
  const [msg, setMsg] = useState('');
  async function link() {
    try {
      const res = await fetch(`${apiBase}/api/v1/admin/students/${studentId}/link-parent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json();
      setMsg(res.ok ? 'Parent linked' : data.error || 'Failed');
    } catch { setMsg('Failed'); }
  }
  return (
    <div className="mt-2 flex gap-2 items-center">
      <input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="Parent mobile" className="border rounded px-2 py-1 text-xs w-36" />
      <button onClick={link} className="text-xs bg-primary text-white px-2 py-1 rounded">Link</button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  );
}

function StudentImportModal({ token, onClose, onImported }: { token: string; onClose: () => void; onImported: () => void; }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: any[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/students/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      onImported();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <Card className="w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Import Students</h2>
        {!result ? (
          <>
            <p className="text-sm text-gray-500 mb-2">Upload an .xlsx file with columns: student name, father name, section, class, parent contact number</p>
            <a href={`${API_BASE}/api/v1/admin/students/import/template`} className="text-xs text-primary hover:underline mb-4 block">
              Download template
            </a>
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 mb-4"
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              {file ? <p className="text-sm text-gray-700">{file.name}</p> : <p className="text-sm text-gray-400">Click to select file</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
              <Button onClick={handleImport} loading={loading} disabled={!file} className="flex-1">Import</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-green-700 mb-2">✓ {result.created} students imported</p>
            {result.skipped.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-amber-700 mb-1">{result.skipped.length} rows skipped:</p>
                <ul className="text-xs text-gray-500 list-disc pl-4 max-h-32 overflow-y-auto">
                  {result.skipped.map((s: any, i: number) => (
                    <li key={i}>{s.reason}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button onClick={onClose} className="w-full">Done</Button>
          </>
        )}
      </Card>
    </div>
  );
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [linkingStudent, setLinkingStudent] = useState<string | null>(null);
  const token = getToken() || '';

  async function load() {
    try {
      const params = new URLSearchParams();
      if (filterClass) params.set('class_id', filterClass);
      if (filterSection) params.set('section_id', filterSection);
      const [studs, cls] = await Promise.all([
        apiGet<Student[]>(`/api/v1/admin/students?${params}`, token),
        apiGet<Class[]>('/api/v1/admin/classes', token),
      ]);
      setStudents(studs);
      setClasses(cls);
    } catch (err) { console.error(err); }
  }

  useEffect(() => { load(); }, [filterClass, filterSection]);

  async function uploadPhoto(studentId: string, file: File) {
    setUploadingPhoto(studentId);
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/students/${studentId}/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingPhoto(null);
    }
  }

  const selectedClass = classes.find(c => c.id === filterClass);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-primary">Students</h1>
        <Button onClick={() => setShowImport(true)} size="sm">Import Students</Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex gap-3 flex-wrap">
          <select
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={filterClass}
            onChange={e => { setFilterClass(e.target.value); setFilterSection(''); }}
          >
            <option value="">All classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {selectedClass && (
            <select
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={filterSection}
              onChange={e => setFilterSection(e.target.value)}
            >
              <option value="">All sections</option>
              {selectedClass.sections.map(s => <option key={s.id} value={s.id}>Section {s.label}</option>)}
            </select>
          )}
        </div>
      </Card>

      {/* Student list */}
      <Card>
        <div className="flex flex-col gap-2">
          {students.map(student => (
            <div key={student.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              {/* Photo */}
              <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                {student.photo_url ? (
                  <img src={`${API_BASE}${student.photo_url}`} alt={student.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                    {student.name[0]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{student.name}</p>
                <p className="text-xs text-gray-400">{student.class_name} · Section {student.section_label} · {student.father_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge label={student.is_active ? 'Active' : 'Inactive'} variant={student.is_active ? 'success' : 'neutral'} />
                <label className="cursor-pointer text-xs text-primary hover:underline">
                  {uploadingPhoto === student.id ? 'Uploading...' : student.photo_url ? 'Change photo' : 'Add photo'}
                  <input type="file" accept="image/jpeg,image/png" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(student.id, f); }} />
                </label>
                <button
                  className="text-xs text-accent hover:underline"
                  onClick={() => setLinkingStudent(student.id === linkingStudent ? null : student.id)}
                >
                  Link parent
                </button>
              </div>
              {linkingStudent === student.id && (
                <ParentLinkPanel studentId={student.id} token={token} apiBase={API_BASE} />
              )}
            </div>
          ))}
          {students.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No students found</p>}
        </div>
      </Card>

      {showImport && (
        <StudentImportModal token={token} onClose={() => setShowImport(false)} onImported={load} />
      )}
    </div>
  );
}

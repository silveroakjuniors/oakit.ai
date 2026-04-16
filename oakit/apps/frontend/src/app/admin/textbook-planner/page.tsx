'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button } from '@/components/ui';
import { apiGet, apiPost, apiPatch, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Session {
  id: string;
  class_id: string;
  academic_year: string;
  status: 'draft' | 'generated' | 'confirmed' | 'stale';
  parameters: Record<string, any>;
  test_config: Record<string, any>;
  generation_summary: any;
  subjects: Subject[];
}

interface Subject {
  id: string;
  name: string;
  pdf_path: string | null;
  pdf_page_count: number | null;
  toc_page: number | null;
  weekly_hours: number;
  chapters: Chapter[];
}

interface Chapter {
  id: string;
  chapter_index: number;
  title: string;
  topics: string[];
  page_start: number | null;
  page_end: number | null;
}

interface DraftEntry {
  id: string;
  entry_date: string;
  subject_name: string;
  chapter_name: string;
  topic_name: string;
  duration_minutes: number;
  is_manual_edit: boolean;
}

interface CoverageItem {
  subject_id: string;
  subject_name: string;
  total_chapters: number;
  covered_chapters: number;
  coverage_pct: number;
  elapsed_pct: number;
  pacing_alert: boolean;
}

interface ClassItem { id: string; name: string; }

// ─── Step indicator ──────────────────────────────────────────────────────────
const STEPS = ['Subject Setup', 'School Parameters', 'Subject Allocation', 'Test Config', 'Preview & Confirm'];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center shrink-0">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            i === current ? 'bg-primary text-white' : i < current ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-400'
          }`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
              i === current ? 'bg-white/20' : i < current ? 'bg-emerald-500 text-white' : 'bg-neutral-200 text-neutral-500'
            }`}>
              {i < current ? '✓' : i + 1}
            </span>
            {label}
          </div>
          {i < STEPS.length - 1 && <div className={`w-6 h-0.5 ${i < current ? 'bg-emerald-300' : 'bg-neutral-200'}`} />}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Subject Setup ────────────────────────────────────────────────────
function Step1({
  session, onRefresh,
}: { session: Session; onRefresh: () => void }) {
  const token = getToken() || '';
  const [newSubjectName, setNewSubjectName] = useState('');
  const [adding, setAdding] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [tocStart, setTocStart] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of (session.subjects || [])) init[s.id] = String(s.toc_page || '1');
    return init;
  });
  const [tocEnd, setTocEnd] = useState<Record<string, string>>({});
  const [uploadError, setUploadError] = useState<Record<string, string>>({});
  const [appendTocPage, setAppendTocPage] = useState<Record<string, string>>({});
  const [appendingFor, setAppendingFor] = useState<string | null>(null);
  const [appendMsg, setAppendMsg] = useState<Record<string, string>>({});
  const appendFileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [editChapter, setEditChapter] = useState<{ subjectId: string; chapter: Chapter } | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTopics, setEditTopics] = useState('');
  const [editPageStart, setEditPageStart] = useState<string>('');
  const [editPageEnd, setEditPageEnd] = useState<string>('');
  const [msg, setMsg] = useState('');
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const excelRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function importExcel(subjectId: string, file: File) {
    setUploadError(e => ({ ...e, [subjectId]: '' }));
    setMsg('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/textbook-planner/sessions/${session.id}/subjects/${subjectId}/import-excel`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(`✓ Imported ${data.count} chapters from Excel`);
      onRefresh();
    } catch (e: any) {
      setMsg(`Import failed: ${e.message}`);
    }
  }

  async function appendToc(subjectId: string, file: File) {
    const page = appendTocPage[subjectId];
    if (!page) return;
    setAppendingFor(subjectId);
    setAppendMsg(m => ({ ...m, [subjectId]: '' }));
    const fd = new FormData();
    fd.append('file', file);
    fd.append('toc_page', page);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/textbook-planner/sessions/${session.id}/subjects/${subjectId}/append-toc`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAppendMsg(m => ({ ...m, [subjectId]: `✓ Added ${data.appended} more chapters (${data.total_chapters} total)` }));
      setAppendTocPage(p => ({ ...p, [subjectId]: '' }));
      onRefresh();
    } catch (e: any) {
      setAppendMsg(m => ({ ...m, [subjectId]: `Failed: ${e.message}` }));
    } finally {
      setAppendingFor(null);
    }
  }

  async function addSubject() {
    if (!newSubjectName.trim()) return;
    setAdding(true);
    try {
      await apiPost(`/api/v1/admin/textbook-planner/sessions/${session.id}/subjects`, { name: newSubjectName.trim() }, token);
      setNewSubjectName('');
      onRefresh();
    } catch (e: any) { setMsg(e.message); }
    finally { setAdding(false); }
  }

  async function deleteSubject(subjectId: string) {
    if (!confirm('Delete this subject and all its chapters?')) return;
    try {
      await fetch(`${API_BASE}/api/v1/admin/textbook-planner/sessions/${session.id}/subjects/${subjectId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      onRefresh();
    } catch (e: any) { setMsg(e.message); }
  }

  async function uploadPdf(subjectId: string, file: File) {
    setUploadingFor(subjectId);
    setMsg('');
    setUploadError(e => ({ ...e, [subjectId]: '' }));
    const fd = new FormData();
    fd.append('file', file);
    fd.append('toc_page', tocStart[subjectId] || '1');
    fd.append('toc_end_page', tocEnd[subjectId] || tocStart[subjectId] || '1');
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/textbook-planner/sessions/${session.id}/subjects/${subjectId}/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.failed) throw new Error(data.reason || 'TOC extraction returned no chapters. Try a different page.');
      setMsg(`✓ Extracted ${data.chapters?.length || 0} chapters`);
      onRefresh();
    } catch (e: any) {
      setUploadError(err => ({ ...err, [subjectId]: e.message }));
    }
    finally { setUploadingFor(null); }
  }

  async function deleteChapter(subjectId: string, chapterId: string) {
    try {
      await fetch(`${API_BASE}/api/v1/admin/textbook-planner/sessions/${session.id}/subjects/${subjectId}/chapters/${chapterId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      onRefresh();
    } catch (e: any) { setMsg(e.message); }
  }

  async function saveChapterEdit() {
    if (!editChapter) return;
    try {
      await fetch(`${API_BASE}/api/v1/admin/textbook-planner/sessions/${session.id}/subjects/${editChapter.subjectId}/chapters/${editChapter.chapter.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          topics: editTopics.split('\n').map(t => t.trim()).filter(Boolean),
          page_start: editPageStart ? parseInt(editPageStart) : null,
          page_end: editPageEnd ? parseInt(editPageEnd) : null,
        }),
      });
      setEditChapter(null);
      onRefresh();
    } catch (e: any) { setMsg(e.message); }
  }

  async function addChapter(subjectId: string) {
    const title = prompt('Chapter title:');
    if (!title) return;
    try {
      await apiPost(`/api/v1/admin/textbook-planner/sessions/${session.id}/subjects/${subjectId}/chapters`, { title, topics: [] }, token);
      onRefresh();
    } catch (e: any) { setMsg(e.message); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">Add subjects, upload textbook PDFs, and review extracted chapters.</p>
      {msg && <p className={`text-sm px-3 py-2 rounded-lg ${msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg}</p>}

      {/* Add subject */}
      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
          placeholder="Subject name (e.g. Mathematics)"
          value={newSubjectName}
          onChange={e => setNewSubjectName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addSubject()}
        />
        <Button onClick={addSubject} loading={adding} size="sm">Add Subject</Button>
      </div>

      {/* Subject list */}
      {(session.subjects || []).map(subject => (
        <Card key={subject.id} padding="md">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-neutral-800">{subject.name}</p>
            <button onClick={() => deleteSubject(subject.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Remove</button>
          </div>

          {/* PDF upload */}
          {subject.pdf_path && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="text-emerald-600">📄</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-emerald-700 truncate">{subject.pdf_path}</p>
                <p className="text-[10px] text-emerald-600">
                  {subject.pdf_page_count ? `${subject.pdf_page_count} pages` : ''}{subject.toc_page ? ` · TOC on page ${subject.toc_page}` : ''}
                </p>
              </div>
            </div>
          )}

          {/* Per-subject upload error with inline retry */}
          {uploadError[subject.id] && (
            <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-600 font-medium mb-1">{uploadError[subject.id]}</p>
              {uploadError[subject.id].includes('scanned') || uploadError[subject.id].includes('OCR') ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-neutral-600">The PDF has no readable text. Choose an alternative:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => excelRefs.current[subject.id]?.click()}
                      className="text-xs px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg font-medium"
                    >📊 Import from Excel</button>
                    <button
                      onClick={() => { setUploadError(e => ({ ...e, [subject.id]: '' })); addChapter(subject.id); }}
                      className="text-xs px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg font-medium"
                    >+ Add manually</button>
                    <button onClick={() => setUploadError(e => ({ ...e, [subject.id]: '' }))} className="text-xs text-neutral-400 hover:text-neutral-600">Dismiss</button>
                  </div>
                </div>
              ) : (
                <div className="mt-1.5">
                  <p className="text-xs text-red-500 mb-2">Try a different TOC page number and re-upload the same PDF.</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <label className="text-xs text-red-600 shrink-0">Try page:</label>
                    <input
                      type="number" min="1"
                      max={subject.pdf_page_count || undefined}
                      className="w-16 px-2 py-1 border border-red-300 rounded-lg text-xs"
                      value={tocStart[subject.id] ?? (subject.toc_page || '1')}
                      onChange={e => setTocStart(p => ({ ...p, [subject.id]: e.target.value }))}
                    />
                    <button
                      onClick={() => fileRefs.current[subject.id]?.click()}
                      className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium"
                    >{uploadingFor === subject.id ? 'Uploading…' : 'Re-upload PDF'}</button>
                    <button
                      onClick={() => excelRefs.current[subject.id]?.click()}
                      className="text-xs px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg font-medium"
                    >📊 Import Excel instead</button>
                    <button onClick={() => { setUploadError(e => ({ ...e, [subject.id]: '' })); addChapter(subject.id); }} className="text-xs text-neutral-500 hover:text-neutral-700 underline">or add manually</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hidden Excel file input */}
          <input
            ref={el => { excelRefs.current[subject.id] = el; }}
            type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importExcel(subject.id, f); e.target.value = ''; }}
          />

          <div className="flex gap-2 items-end flex-wrap mb-3">
            {!uploadError[subject.id] && (
              <div className="flex gap-2 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500">TOC Start Page</label>
                  <input
                    type="number" min="1"
                    max={subject.pdf_page_count || undefined}
                    className="w-20 px-2 py-1.5 border border-neutral-200 rounded-lg text-sm"
                    value={tocStart[subject.id] ?? (subject.toc_page || '1')}
                    onChange={e => setTocStart(p => ({ ...p, [subject.id]: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500">End Page <span className="text-neutral-300">(optional)</span></label>
                  <input
                    type="number" min="1"
                    max={subject.pdf_page_count || undefined}
                    className="w-20 px-2 py-1.5 border border-neutral-200 rounded-lg text-sm"
                    placeholder={tocStart[subject.id] || '—'}
                    value={tocEnd[subject.id] || ''}
                    onChange={e => setTocEnd(p => ({ ...p, [subject.id]: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <input
              ref={el => { fileRefs.current[subject.id] = el; }}
              type="file" accept=".pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadPdf(subject.id, f); e.target.value = ''; }}
            />
            {!uploadError[subject.id] && (
              <>
                <Button
                  size="sm" variant="secondary"
                  loading={uploadingFor === subject.id}
                  onClick={() => fileRefs.current[subject.id]?.click()}
                >
                  {subject.pdf_path ? '🔄 Re-upload PDF' : '📤 Upload PDF'}
                </Button>
                <button
                  onClick={() => excelRefs.current[subject.id]?.click()}
                  className="text-xs px-3 py-1.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 text-neutral-600"
                  title="Import chapters from Excel template"
                >📊 Import Excel</button>
              </>
            )}
          </div>

          {/* Chapters */}
          {subject.chapters.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-neutral-500 mb-1">{subject.chapters.length} chapters extracted</p>
              {subject.chapters.map(ch => (
                <div key={ch.id} className="flex items-start gap-2 bg-neutral-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-neutral-400 w-5 shrink-0">{ch.chapter_index}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-700">{ch.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {ch.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {ch.topics.map((t: any, ti: number) => {
                            const name = typeof t === 'string' ? t : (t?.name || t?.title || JSON.stringify(t));
                            const page = typeof t !== 'string' && t?.page_start ? `·${t.page_start}` : '';
                            return (
                              <span key={ti} className="text-xs text-neutral-400">
                                {name}{page ? <span className="text-neutral-300 font-mono ml-0.5">{page}</span> : null}
                                {ti < ch.topics.length - 1 ? <span className="text-neutral-200"> ·</span> : null}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {(ch.page_start || ch.page_end) && (
                        <span className="text-[10px] bg-neutral-200 text-neutral-500 px-1.5 py-0.5 rounded font-mono shrink-0">
                          p.{ch.page_start}{ch.page_end && ch.page_end !== ch.page_start ? `–${ch.page_end}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => { setEditChapter({ subjectId: subject.id, chapter: ch }); setEditTitle(ch.title); setEditTopics(ch.topics.map((t: any) => typeof t === 'string' ? t : (t?.name || '')).join('\n')); setEditPageStart(String(ch.page_start ?? '')); setEditPageEnd(String(ch.page_end ?? '')); }}
                      className="text-xs text-blue-400 hover:text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-50"
                    >Edit</button>
                    <button onClick={() => deleteChapter(subject.id, ch.id)} className="text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50">✕</button>
                  </div>
                </div>
              ))}
              <button onClick={() => addChapter(subject.id)} className="text-xs text-primary hover:underline mt-1">+ Add chapter manually</button>
            </div>
          ) : (
            <p className="text-xs text-neutral-400">No chapters yet. Upload a PDF to extract chapters.</p>
          )}
        </Card>
      ))}

      {/* Edit chapter modal */}
      {editChapter && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <Card className="w-full max-w-md">
            <h3 className="text-base font-semibold mb-3">Edit Chapter</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-600">Title</label>
                <input className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600">Topics (one per line)</label>
                <textarea className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm h-28 resize-none" value={editTopics} onChange={e => setEditTopics(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-medium text-neutral-600">Page Start</label>
                  <input type="number" min="1" className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={editPageStart} onChange={e => setEditPageStart(e.target.value)} placeholder="e.g. 4" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-neutral-600">Page End</label>
                  <input type="number" min="1" className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={editPageEnd} onChange={e => setEditPageEnd(e.target.value)} placeholder="e.g. 11" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditChapter(null)} className="flex-1">Cancel</Button>
                <Button onClick={saveChapterEdit} className="flex-1">Save</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: School Parameters ────────────────────────────────────────────────
function Step2({ session, onRefresh }: { session: Session; onRefresh: () => void }) {
  const token = getToken() || '';
  const p = session.parameters || {};
  const [form, setForm] = useState<{
    school_start: string; school_end: string; lunch_start: string; lunch_end: string;
    snack_start: string; snack_end: string; sports_minutes_per_week: number;
    activities: { name: string; daily_minutes: number }[];
  }>({
    school_start: p.school_start || '08:00',
    school_end: p.school_end || '14:00',
    lunch_start: p.lunch_start || '12:00',
    lunch_end: p.lunch_end || '12:30',
    snack_start: p.snack_start || '',
    snack_end: p.snack_end || '',
    sports_minutes_per_week: p.sports_minutes_per_week || 60,
    activities: (p.activities as { name: string; daily_minutes: number }[]) || [],
  });
  const [saving, setSaving] = useState(false);
  const [availableMinutes, setAvailableMinutes] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  async function save() {
    setSaving(true); setMsg('');
    try {
      const res = await apiPatch<{ available_teaching_minutes: number }>(
        `/api/v1/admin/textbook-planner/sessions/${session.id}/parameters`, form, token
      );
      setAvailableMinutes(res.available_teaching_minutes);
      setMsg('✓ Parameters saved');
      onRefresh();
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  function addActivity() {
    setForm(f => ({ ...f, activities: [...f.activities, { name: '', daily_minutes: 15 }] }));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">Configure school timings and non-teaching activities.</p>
      {msg && <p className={`text-sm px-3 py-2 rounded-lg ${msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg}</p>}

      <Card padding="md">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-neutral-600">School Start</label>
            <input type="time" className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={form.school_start} onChange={e => setForm(f => ({ ...f, school_start: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600">School End</label>
            <input type="time" className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={form.school_end} onChange={e => setForm(f => ({ ...f, school_end: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600">Lunch Start</label>
            <input type="time" className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={form.lunch_start} onChange={e => setForm(f => ({ ...f, lunch_start: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600">Lunch End</label>
            <input type="time" className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={form.lunch_end} onChange={e => setForm(f => ({ ...f, lunch_end: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600">Snack Start (optional)</label>
            <input type="time" className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={form.snack_start} onChange={e => setForm(f => ({ ...f, snack_start: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600">Snack End (optional)</label>
            <input type="time" className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={form.snack_end} onChange={e => setForm(f => ({ ...f, snack_end: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-neutral-600">Sports (minutes/week)</label>
            <input type="number" min="0" className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={form.sports_minutes_per_week} onChange={e => setForm(f => ({ ...f, sports_minutes_per_week: parseInt(e.target.value) || 0 }))} />
          </div>
        </div>

        {/* Activities */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-neutral-600">Daily Activities</p>
            <button onClick={addActivity} className="text-xs text-primary hover:underline">+ Add</button>
          </div>
          {form.activities.map((act, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input className="flex-1 px-2 py-1.5 border border-neutral-200 rounded-lg text-sm" placeholder="Activity name" value={act.name} onChange={e => setForm(f => ({ ...f, activities: f.activities.map((a, j) => j === i ? { ...a, name: e.target.value } : a) }))} />
              <input type="number" min="0" className="w-20 px-2 py-1.5 border border-neutral-200 rounded-lg text-sm" placeholder="min/day" value={act.daily_minutes} onChange={e => setForm(f => ({ ...f, activities: f.activities.map((a, j) => j === i ? { ...a, daily_minutes: parseInt(e.target.value) || 0 } : a) }))} />
              <button onClick={() => setForm(f => ({ ...f, activities: f.activities.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600 px-1">✕</button>
            </div>
          ))}
        </div>

        {availableMinutes !== null && (
          <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <p className="text-sm font-semibold text-emerald-700">Available teaching time: {availableMinutes} min/day</p>
          </div>
        )}

        <Button onClick={save} loading={saving} className="mt-4 w-full">Save Parameters</Button>
      </Card>
    </div>
  );
}

// ─── Step 3: Subject Allocation ───────────────────────────────────────────────
function Step3({ session, onRefresh }: { session: Session; onRefresh: () => void }) {
  const token = getToken() || '';
  const [hours, setHours] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of (session.subjects || [])) init[s.id] = String(s.weekly_hours || 0);
    return init;
  });

  // Sync when session subjects change (e.g. after refresh)
  useEffect(() => {
    setHours(prev => {
      const next = { ...prev };
      for (const s of (session.subjects || [])) {
        if (!(s.id in next)) next[s.id] = String(s.weekly_hours || 0);
      }
      return next;
    });
  }, [session.subjects]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const total = Object.values(hours).reduce((sum, h) => sum + (parseFloat(h) || 0), 0);

  async function save() {
    setSaving(true); setMsg('');
    try {
      const allocations = (session.subjects || []).map(s => ({ subject_id: s.id, weekly_hours: parseFloat(hours[s.id]) || 0 }));
      await apiPatch(`/api/v1/admin/textbook-planner/sessions/${session.id}/allocations`, { allocations }, token);
      setMsg('✓ Allocations saved');
      onRefresh();
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">Set weekly teaching hours per subject.</p>
      {msg && <p className={`text-sm px-3 py-2 rounded-lg ${msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg}</p>}

      <Card padding="md">
        {(session.subjects || []).map(s => (
          <div key={s.id} className="flex items-center gap-3 mb-3">
            <span className="flex-1 text-sm font-medium text-neutral-700">{s.name}</span>
            <input
              type="number" min="0" step="0.5"
              className="w-24 px-2 py-1.5 border border-neutral-200 rounded-lg text-sm text-right"
              value={hours[s.id] || '0'}
              onChange={e => setHours(h => ({ ...h, [s.id]: e.target.value }))}
            />
            <span className="text-xs text-neutral-400 w-12">hrs/wk</span>
          </div>
        ))}

        {/* Utilisation bar */}
        <div className="mt-4 pt-3 border-t border-neutral-100">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-neutral-600">Total weekly hours</p>
            <p className="text-sm font-bold text-neutral-800">{total.toFixed(1)} hrs</p>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all ${total > 40 ? 'bg-red-500' : total < 20 ? 'bg-amber-400' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, (total / 40) * 100)}%` }} />
          </div>
          {total > 40 && <p className="text-xs text-red-500 mt-1">⚠ Over-allocated — consider reducing hours</p>}
          {total < 20 && total > 0 && <p className="text-xs text-amber-500 mt-1">⚠ Under-allocated — consider adding more hours</p>}
        </div>

        <Button onClick={save} loading={saving} className="mt-4 w-full">Save Allocations</Button>
      </Card>
    </div>
  );
}

// ─── Step 4: Test Config ──────────────────────────────────────────────────────
function Step4({ session, onRefresh }: { session: Session; onRefresh: () => void }) {
  const token = getToken() || '';
  const tc = session.test_config || {};
  const [form, setForm] = useState<{
    mode: string; every_n_weeks: number; specific_dates: string;
    duration_periods: number; revision_buffer: boolean;
  }>({
    mode: tc.mode || 'end-of-chapter',
    every_n_weeks: tc.every_n_weeks || 4,
    specific_dates: ((tc.specific_dates as string[]) || []).join('\n'),
    duration_periods: tc.duration_periods || 2,
    revision_buffer: tc.revision_buffer !== false,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setSaving(true); setMsg('');
    try {
      const payload = {
        mode: form.mode,
        every_n_weeks: form.mode === 'every-N-weeks' ? parseInt(String(form.every_n_weeks)) : null,
        specific_dates: form.mode === 'specific-dates' ? form.specific_dates.split('\n').map(d => d.trim()).filter(Boolean) : [],
        duration_periods: parseInt(String(form.duration_periods)),
        revision_buffer: form.revision_buffer,
      };
      await apiPatch(`/api/v1/admin/textbook-planner/sessions/${session.id}/test-config`, payload, token);
      setMsg('✓ Test config saved');
      onRefresh();
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  const modes = [
    { value: 'end-of-chapter', label: 'End of Chapter', desc: 'Test after each chapter completes' },
    { value: 'every-N-weeks', label: 'Every N Weeks', desc: 'Periodic tests at fixed intervals' },
    { value: 'specific-dates', label: 'Specific Dates', desc: 'Manually specify test dates' },
    { value: 'manual', label: 'Manual', desc: 'No automatic test scheduling' },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">Configure how tests and revision days are scheduled.</p>
      {msg && <p className={`text-sm px-3 py-2 rounded-lg ${msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg}</p>}

      <Card padding="md">
        <p className="text-xs font-medium text-neutral-600 mb-2">Test Scheduling Mode</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {modes.map(m => (
            <button
              key={m.value}
              onClick={() => setForm(f => ({ ...f, mode: m.value }))}
              className={`text-left px-3 py-2.5 rounded-xl border transition-colors ${
                form.mode === m.value ? 'border-primary bg-primary/5' : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <p className={`text-sm font-semibold ${form.mode === m.value ? 'text-primary' : 'text-neutral-700'}`}>{m.label}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>

        {form.mode === 'every-N-weeks' && (
          <div className="mb-4">
            <label className="text-xs font-medium text-neutral-600">Every N weeks (1–52)</label>
            <input type="number" min="1" max="52" className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={form.every_n_weeks} onChange={e => setForm(f => ({ ...f, every_n_weeks: parseInt(e.target.value) || 4 }))} />
          </div>
        )}

        {form.mode === 'specific-dates' && (
          <div className="mb-4">
            <label className="text-xs font-medium text-neutral-600">Test dates (one per line, YYYY-MM-DD)</label>
            <textarea className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm h-24 resize-none" value={form.specific_dates} onChange={e => setForm(f => ({ ...f, specific_dates: e.target.value }))} placeholder="2025-09-15&#10;2025-11-20" />
          </div>
        )}

        <div className="mb-4">
          <label className="text-xs font-medium text-neutral-600">Test duration (periods, 1–5)</label>
          <input type="number" min="1" max="5" className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={form.duration_periods} onChange={e => setForm(f => ({ ...f, duration_periods: parseInt(e.target.value) || 2 }))} />
        </div>

        <label className="flex items-center gap-2 cursor-pointer mb-4">
          <input type="checkbox" checked={form.revision_buffer} onChange={e => setForm(f => ({ ...f, revision_buffer: e.target.checked }))} className="rounded" />
          <span className="text-sm text-neutral-700">Add revision day before each test</span>
        </label>

        <Button onClick={save} loading={saving} className="w-full">Save Test Config</Button>
      </Card>
    </div>
  );
}

// ─── Step 5: Preview & Confirm ────────────────────────────────────────────────
function Step5({ session, onRefresh }: { session: Session; onRefresh: () => void }) {
  const token = getToken() || '';
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const [editEntry, setEditEntry] = useState<DraftEntry | null>(null);
  const [editForm, setEditForm] = useState({ subject_name: '', chapter_name: '', topic_name: '', duration_minutes: 45 });
  const [msg, setMsg] = useState('');
  const [currentWeek, setCurrentWeek] = useState(1);

  const loadDraft = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ entries: DraftEntry[] }>(`/api/v1/admin/textbook-planner/sessions/${session.id}/draft`, token);
      setEntries(data.entries);
    } catch (e: any) { setMsg(e.message); }
    finally { setLoading(false); }
  }, [session.id, token]);

  useEffect(() => { loadDraft(); }, [loadDraft]);

  async function generate() {
    setGenerating(true); setMsg('');
    try {
      const res = await apiPost<{ message: string; summary: any }>(`/api/v1/admin/textbook-planner/sessions/${session.id}/generate`, {}, token);
      setMsg(`✓ ${res.message}`);
      await loadDraft();
      onRefresh();
    } catch (e: any) { setMsg(e.message); }
    finally { setGenerating(false); }
  }

  async function revert() {
    if (!window.confirm('Revert to last generated version? Manual edits will be removed.')) return;
    setGenerating(true); setMsg('');
    try {
      const res = await apiPost<{ message: string; needs_regeneration?: boolean }>(
        `/api/v1/admin/textbook-planner/sessions/${session.id}/draft/revert`, {}, token
      );
      setMsg(`✓ ${res.message}`);
      if (res.needs_regeneration) {
        setMsg('Manual edits removed. Click Re-generate to rebuild the planner.');
      } else {
        await loadDraft();
      }
      onRefresh();
    } catch (e: any) { setMsg(e.message); }
    finally { setGenerating(false); }
  }

  async function confirmPlanner() {
    if (!window.confirm('Push this planner to the curriculum pipeline? This will create day plans for all sections.')) return;
    setConfirming(true); setMsg('');
    try {
      const res = await apiPost<any>(`/api/v1/admin/textbook-planner/sessions/${session.id}/confirm`, {}, token);
      setConfirmResult(res);
      setMsg('✓ Planner confirmed and pushed to curriculum pipeline');
      onRefresh();
    } catch (e: any) { setMsg(e.message); }
    finally { setConfirming(false); }
  }

  async function saveEdit() {
    if (!editEntry) return;
    try {
      await fetch(`${API_BASE}/api/v1/admin/textbook-planner/sessions/${session.id}/draft/${editEntry.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      setEditEntry(null);
      await loadDraft();
    } catch (e: any) { setMsg(e.message); }
  }

  // Group entries by week
  const byWeek: Record<number, DraftEntry[]> = {};
  for (const e of entries) {
    const d = new Date(e.entry_date);
    const week = getISOWeekFE(d);
    if (!byWeek[week]) byWeek[week] = [];
    byWeek[week].push(e);
  }
  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);
  const weekEntries = byWeek[weeks[currentWeek - 1]] || [];

  return (
    <div className="space-y-4">
      {/* Stale banner (Task 12) */}
      {session.status === 'stale' && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Calendar changed — planner may be outdated</p>
            <p className="text-xs text-amber-600 mt-0.5">Holidays or special days were updated. Re-generate to reflect the latest calendar.</p>
          </div>
          <Button size="sm" onClick={generate} loading={generating}>Re-generate</Button>
        </div>
      )}

      {msg && <p className={`text-sm px-3 py-2 rounded-lg ${msg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg}</p>}

      {/* Preview banner */}
      {entries.length > 0 && session.generation_summary?.preview_only && session.status !== 'confirmed' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-xl mt-0.5">👁️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800">2-week preview — review before confirming</p>
            <p className="text-xs text-blue-600 mt-0.5">
              This shows the first 2 weeks of your planner. When you click <strong>Confirm & Push</strong>, the full academic year will be generated and pushed to teachers.
            </p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={generate} loading={generating} variant="secondary" size="sm">
          {entries.length === 0 ? '🚀 Generate Preview (2 weeks)' : '🔄 Re-generate Preview'}
        </Button>
        {entries.length > 0 && (
          <Button onClick={revert} loading={generating} variant="ghost" size="sm">🗑️ Clear Draft</Button>
        )}
        {entries.length > 0 && session.status !== 'confirmed' && (
          <Button onClick={confirmPlanner} loading={confirming} size="sm">✅ Confirm & Generate Full Year</Button>
        )}
        {session.status === 'confirmed' && (
          <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">✓ Confirmed</span>
        )}
      </div>

      {/* Confirm result */}
      {confirmResult && (
        <Card padding="md">
          <p className="text-sm font-semibold text-emerald-700 mb-2">✓ Pushed to curriculum pipeline</p>
          <p className="text-xs text-neutral-500">{confirmResult.total_entries} entries · {confirmResult.results?.length} sections processed</p>
          <div className="mt-2 space-y-1">
            {confirmResult.results?.map((r: any) => (
              <div key={r.section_id} className={`text-xs px-2 py-1 rounded ${r.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                Section {r.section_id.slice(0, 8)}… — {r.status === 'success' ? `${r.chunks_created} chunks` : r.error}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Weekly calendar */}
      {loading && <p className="text-sm text-neutral-400">Loading draft…</p>}
      {!loading && entries.length === 0 && (
        <Card padding="md">
          <p className="text-sm text-neutral-400 text-center py-4">No draft yet. Click "Generate Preview" to see the first 2 weeks of your planner.</p>
        </Card>
      )}

      {entries.length > 0 && (
        <Card padding="md">
          {/* Week navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentWeek(w => Math.max(1, w - 1))} disabled={currentWeek === 1} className="text-sm px-3 py-1 rounded-lg border border-neutral-200 disabled:opacity-40">← Prev</button>
            <p className="text-sm font-semibold text-neutral-700">Week {currentWeek} of {weeks.length}</p>
            <button onClick={() => setCurrentWeek(w => Math.min(weeks.length, w + 1))} disabled={currentWeek === weeks.length} className="text-sm px-3 py-1 rounded-lg border border-neutral-200 disabled:opacity-40">Next →</button>
          </div>

          {/* Day entries */}
          {weekEntries.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-4">No entries for this week</p>
          ) : (
            <div className="space-y-2">
              {weekEntries.map(entry => (
                <div key={entry.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border ${entry.is_manual_edit ? 'border-blue-200 bg-blue-50/40' : 'border-neutral-100 bg-neutral-50'}`}>
                  <div className="shrink-0 text-center">
                    <p className="text-xs font-bold text-neutral-500">{new Date(entry.entry_date).toLocaleDateString('en-IN', { weekday: 'short' })}</p>
                    <p className="text-sm font-bold text-neutral-800">{new Date(entry.entry_date).getDate()}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-primary">{entry.subject_name}</p>
                    <p className="text-sm font-medium text-neutral-700">{entry.chapter_name}</p>
                    <p className="text-xs text-neutral-500">{entry.topic_name} · {entry.duration_minutes}min</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {entry.is_manual_edit && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">edited</span>}
                    <button
                      onClick={() => { setEditEntry(entry); setEditForm({ subject_name: entry.subject_name, chapter_name: entry.chapter_name, topic_name: entry.topic_name, duration_minutes: entry.duration_minutes }); }}
                      className="text-xs text-neutral-400 hover:text-neutral-600 px-1.5 py-0.5 rounded hover:bg-neutral-100"
                    >Edit</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Edit entry modal */}
      {editEntry && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <Card className="w-full max-w-md">
            <h3 className="text-base font-semibold mb-3">Edit Entry — {editEntry.entry_date}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-600">Subject</label>
                <input className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={editForm.subject_name} onChange={e => setEditForm(f => ({ ...f, subject_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600">Chapter</label>
                <input className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={editForm.chapter_name} onChange={e => setEditForm(f => ({ ...f, chapter_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600">Topic</label>
                <input className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={editForm.topic_name} onChange={e => setEditForm(f => ({ ...f, topic_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600">Duration (minutes)</label>
                <input type="number" min="1" className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm" value={editForm.duration_minutes} onChange={e => setEditForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 45 }))} />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditEntry(null)} className="flex-1">Cancel</Button>
                <Button onClick={saveEdit} className="flex-1">Save</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function getISOWeekFE(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// ─── Coverage Summary (Task 11) ───────────────────────────────────────────────
function CoverageSummary({ session }: { session: Session }) {
  const token = getToken() || '';
  const [coverage, setCoverage] = useState<CoverageItem[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session.status !== 'confirmed') return;
    setLoading(true);
    apiGet<{ coverage: CoverageItem[]; elapsed_pct: number }>(`/api/v1/admin/textbook-planner/sessions/${session.id}/coverage`, token)
      .then(d => { setCoverage(d.coverage); setElapsed(d.elapsed_pct); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session.id, session.status, token]);

  if (session.status !== 'confirmed') return null;

  return (
    <Card padding="md" className="mt-4">
      <p className="text-sm font-semibold text-neutral-800 mb-3">📊 Coverage Summary</p>
      {loading && <p className="text-xs text-neutral-400">Loading coverage…</p>}
      {coverage.map(item => (
        <div key={item.subject_id} className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-neutral-700">{item.subject_name}</p>
            <span className={`text-xs font-bold ${item.pacing_alert ? 'text-red-600' : 'text-emerald-600'}`}>
              {item.coverage_pct}% {item.pacing_alert ? '⚠' : ''}
            </span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-2 relative">
            <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${item.coverage_pct}%` }} />
            <div className="absolute top-0 h-2 w-0.5 bg-amber-400" style={{ left: `${item.elapsed_pct}%` }} title={`${item.elapsed_pct}% of year elapsed`} />
          </div>
          <div className="flex justify-between text-[10px] text-neutral-400 mt-0.5">
            <span>{item.covered_chapters}/{item.total_chapters} chapters</span>
            <span>{item.elapsed_pct}% year elapsed</span>
          </div>
          {item.pacing_alert && (
            <p className="text-xs text-red-500 mt-0.5">⚠ Pacing alert: {item.elapsed_pct - item.coverage_pct}% behind schedule</p>
          )}
        </div>
      ))}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TextbookPlannerPage() {
  const token = getToken() || '';
  const [step, setStep] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [academicYear, setAcademicYear] = useState('');
  const [form, setForm] = useState({ class_id: '' });
  const [starting, setStarting] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    apiGet<ClassItem[]>('/api/v1/admin/classes', token).then(setClasses).catch(() => {});
    // Auto-load current academic year
    apiGet<{ academic_year: string }>('/api/v1/admin/textbook-planner/academic-year', token)
      .then(d => setAcademicYear(d.academic_year))
      .catch(() => {});
  }, [token]);

  async function startSession() {
    if (!form.class_id) return;
    setStarting(true); setMsg('');
    try {
      const s = await apiPost<Session>('/api/v1/admin/textbook-planner/sessions', { class_id: form.class_id }, token);
      const full = await apiGet<Session>(`/api/v1/admin/textbook-planner/sessions/${s.id}`, token);
      setSession(full);
    } catch (e: any) { setMsg(e.message); }
    finally { setStarting(false); }
  }

  async function refreshSession() {
    if (!session) return;
    try {
      const s = await apiGet<Session>(`/api/v1/admin/textbook-planner/sessions/${session.id}`, token);
      setSession(s);
    } catch { /* ignore */ }
  }

  if (!session) {
    return (
      <div className="p-5 lg:p-7 max-w-2xl">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Textbook Planner</h1>
        <p className="text-sm text-neutral-500 mb-6">Generate an AI-powered academic planner from your textbooks.</p>

        <Card padding="md">
          <p className="text-sm font-semibold text-neutral-700 mb-4">Start or resume a session</p>
          {msg && <p className="text-sm text-red-500 mb-3">{msg}</p>}

          {academicYear && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-blue-500 text-sm">📅</span>
              <p className="text-sm text-blue-700">Academic Year: <span className="font-semibold">{academicYear}</span></p>
              <a href="/admin/calendar" className="ml-auto text-xs text-blue-500 hover:underline">Change</a>
            </div>
          )}
          {!academicYear && (
            <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-700">No academic year configured. <a href="/admin/calendar" className="underline font-medium">Set up the school calendar</a> first.</p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-neutral-600">Class</label>
              <select
                className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none"
                value={form.class_id}
                onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}
              >
                <option value="">Select class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Button onClick={startSession} loading={starting} disabled={!form.class_id || !academicYear} className="w-full">
              Start / Resume Session
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const stepComponents = [
    <Step1 key="s1" session={session} onRefresh={refreshSession} />,
    <Step2 key="s2" session={session} onRefresh={refreshSession} />,
    <Step3 key="s3" session={session} onRefresh={refreshSession} />,
    <Step4 key="s4" session={session} onRefresh={refreshSession} />,
    <Step5 key="s5" session={session} onRefresh={refreshSession} />,
  ];

  return (
    <div className="p-5 lg:p-7 max-w-3xl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Textbook Planner</h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Session: {session.academic_year} ·{' '}
            <span className={`font-semibold ${session.status === 'confirmed' ? 'text-emerald-600' : session.status === 'stale' ? 'text-amber-600' : 'text-neutral-500'}`}>
              {session.status}
            </span>
          </p>
        </div>
        <button onClick={() => setSession(null)} className="text-xs text-neutral-400 hover:text-neutral-600 px-2 py-1 rounded hover:bg-neutral-100">← Back</button>
      </div>

      <StepBar current={step} />

      {stepComponents[step]}

      {/* Coverage summary shown after confirmation */}
      {step === 4 && <CoverageSummary session={session} />}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button variant="ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>← Back</Button>
        <Button onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1}>Next →</Button>
      </div>
    </div>
  );
}

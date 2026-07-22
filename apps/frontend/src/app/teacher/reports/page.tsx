'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, BookOpen, Trash2, Eye, Pencil, Check, X, Sparkles, RefreshCw, Printer, Users, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getToken } from '@/lib/auth';
import { apiGet, apiPost, apiDelete, apiPatch } from '@/lib/api';
import ReportCardV2 from '@/components/ReportCardV2';

interface SavedReport {
  id: string;
  student_name: string;
  class_name: string;
  report_type: string;
  from_date: string;
  to_date: string;
  created_at: string;
}

interface Student { id: string; name: string; class_name?: string; section_label?: string; }
type Tab = 'generate' | 'saved' | 'generate-all';

function fmtDate(d: string) {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; }
}

// ─── Saved Report Viewer (with inline remark edit) ────────────────────────────
function SavedReportViewer({ reportId, token, onClose, onDelete }: {
  reportId: string; token: string; onClose: () => void; onDelete: (id: string) => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [remarkEditing, setRemarkEditing] = useState(false);
  const [remarkInput, setRemarkInput] = useState('');
  const [remarkDraft, setRemarkDraft] = useState('');
  const [remarkGenerating, setRemarkGenerating] = useState(false);
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [remarkMsg, setRemarkMsg] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiGet<any>(`/api/v1/teacher/report-card/saved/${reportId}`, token)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [reportId, token]);

  async function generateRemark() {
    if (!remarkInput.trim() || !data) return;
    setRemarkGenerating(true);
    try {
      const res = await apiPost<{ remark: string }>('/api/v1/teacher/report-card/generate-remark', {
        student_name: data.student_name, teacher_notes: remarkInput,
        class_name: data.class_name, attendance_pct: data.attendance?.pct,
        subjects_covered: (data.curriculum?.subjects || []).slice(0, 5).join(', '),
      }, token);
      setRemarkDraft(res.remark || '');
    } catch { setRemarkDraft(''); }
    finally { setRemarkGenerating(false); }
  }

  async function saveRemark(text: string) {
    setRemarkSaving(true);
    try {
      await apiPatch(`/api/v1/teacher/report-card/saved/${reportId}/remark`, { teacher_remark: text }, token);
      setData((prev: any) => ({ ...prev, structured: { ...(prev?.structured || {}), teacher_remark: text } }));
      setRemarkMsg('Remark saved');
      setRemarkEditing(false); setRemarkDraft(''); setRemarkInput('');
    } catch { setRemarkMsg('Save failed'); }
    finally { setRemarkSaving(false); setTimeout(() => setRemarkMsg(''), 3000); }
  }

  function printReport() {
    const el = printRef.current;
    if (!el) return;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report — ${data?.student_name || ''}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; padding: 20px; background: #f8f7f4; font-family: 'Inter', system-ui, sans-serif; }
@media print { body { padding: 10px; } }</style></head><body>${el.innerHTML}</body></html>`);
      w.document.close(); setTimeout(() => w.print(), 600);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete report for ${data?.student_name}? This cannot be undone.`)) return;
    setDeleting(true);
    try { await apiDelete(`/api/v1/teacher/report-card/saved/${reportId}`, token); onDelete(reportId); }
    catch { setDeleting(false); }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-neutral-300" size={24} /></div>;
  if (!data) return <div className="text-center py-8 text-sm text-neutral-400">Could not load report</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 font-semibold">
          <ChevronLeft size={16} /> Back to saved
        </button>
        <div className="flex gap-2">
          <button onClick={printReport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: '#1B4332' }}>
            <Printer size={12} /> Print PDF
          </button>
          <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50">
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
          </button>
        </div>
      </div>

      <div ref={printRef}><ReportCardV2 meta={data} /></div>

      {/* Remark editor */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-sm font-bold text-neutral-800">Teacher's Remark</p>
          {!remarkEditing && (
            <button onClick={() => { setRemarkEditing(true); setRemarkInput(data?.structured?.teacher_remark || ''); setRemarkDraft(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">
              <Pencil size={12} /> Edit
            </button>
          )}
        </div>
        {!remarkEditing ? (
          <div className="px-4 py-3">
            <p className="text-sm text-neutral-700 leading-relaxed italic">
              {data?.structured?.teacher_remark || 'No remark added yet.'}
            </p>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-3">
            {remarkMsg && <p className="text-xs text-emerald-600 font-semibold">{remarkMsg}</p>}
            <textarea value={remarkInput} onChange={e => setRemarkInput(e.target.value)}
              placeholder="Your notes — Oakie will polish them into a remark"
              rows={3} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30 resize-none" />
            <div className="flex gap-2">
              <button onClick={generateRemark} disabled={!remarkInput.trim() || remarkGenerating}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: '#1B4332' }}>
                {remarkGenerating ? <><RefreshCw size={13} className="animate-spin" /> Writing…</> : <><Sparkles size={13} /> Ask Oakie</>}
              </button>
              <button onClick={() => saveRemark(remarkInput)} disabled={!remarkInput.trim() || remarkSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50">
                {remarkSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save as-is
              </button>
              <button onClick={() => { setRemarkEditing(false); setRemarkDraft(''); setRemarkInput(''); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-neutral-400 hover:text-neutral-600">
                <X size={13} /> Cancel
              </button>
            </div>
            {remarkDraft && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Oakie's suggestion</p>
                <p className="text-sm text-neutral-800 leading-relaxed italic">{remarkDraft}</p>
                <div className="flex gap-2">
                  <button onClick={() => saveRemark(remarkDraft)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
                    <Check size={13} /> Use & Save
                  </button>
                  <button onClick={generateRemark} disabled={remarkGenerating}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 transition-colors disabled:opacity-50">
                    <RefreshCw size={12} className={remarkGenerating ? 'animate-spin' : ''} /> Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Generate All Panel ────────────────────────────────────────────────────────
function GenerateAllPanel({ token }: { token: string }) {
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ student_name: string; report_id: string | null; error?: string }[]>([]);
  const [done, setDone] = useState(false);

  async function runAll() {
    setRunning(true); setDone(false); setResults([]);
    try {
      const res = await apiPost<{ generated: number; results: any[] }>('/api/v1/teacher/report-card/generate-all', { from, to }, token);
      setResults(res.results || []);
      setDone(true);
    } catch (e: any) { setResults([{ student_name: 'Error', report_id: null, error: e.message }]); setDone(true); }
    finally { setRunning(false); }
  }

  const successCount = results.filter(r => r.report_id).length;
  const failCount = results.filter(r => !r.report_id).length;

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-bold text-amber-800 mb-1">Generate for all students</p>
        <p className="text-xs text-amber-700">This will generate and save report cards for every active student in your section(s). Takes 1–3 minutes depending on class size.</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5 block">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30" />
        </div>
      </div>
      <button onClick={runAll} disabled={running}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-colors"
        style={{ background: '#1B4332' }}>
        {running ? <><Loader2 size={15} className="animate-spin" /> Generating reports… please wait</> : <><Users size={15} /> Generate for All Students</>}
      </button>
      {done && (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-3">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <p className="text-sm font-bold text-neutral-800">{successCount} generated · {failCount} failed</p>
          </div>
          <div className="divide-y divide-neutral-50 max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                {r.report_id
                  ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  : <AlertCircle size={14} className="text-red-400 shrink-0" />}
                <p className="text-xs text-neutral-700 flex-1">{r.student_name}</p>
                {r.error && <p className="text-[10px] text-red-400">{r.error.slice(0, 40)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
import ReportCardGenerator from '@/components/ReportCardGenerator';

export default function TeacherReportsPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [tab, setTab] = useState<Tab>('generate');
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  function loadSaved() {
    setSavedLoading(true);
    apiGet<SavedReport[]>('/api/v1/teacher/report-card/saved', token)
      .then(setSaved).catch(() => {}).finally(() => setSavedLoading(false));
  }

  useEffect(() => {
    if (tab === 'saved') loadSaved();
  }, [tab]);

  function handleDelete(id: string) {
    setSaved(prev => prev.filter(r => r.id !== id));
    setViewing(null);
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-neutral-400 hover:text-neutral-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-neutral-900">Report Cards</h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-neutral-100 px-4">
        <div className="flex gap-0 max-w-2xl mx-auto">
          {([
            { key: 'generate', label: 'Generate', icon: BookOpen },
            { key: 'saved',    label: 'Saved',    icon: FileText },
            { key: 'generate-all', label: 'All Students', icon: Users },
          ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setTab(key); setViewing(null); }}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
                tab === key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-neutral-400 hover:text-neutral-600'
              }`}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {tab === 'generate' && <ReportCardGenerator token={token} role="teacher" />}

        {tab === 'saved' && (
          viewing
            ? <SavedReportViewer reportId={viewing} token={token} onClose={() => setViewing(null)} onDelete={handleDelete} />
            : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-neutral-800">{saved.length} saved report{saved.length !== 1 ? 's' : ''}</p>
                  <button onClick={loadSaved} className="text-xs text-neutral-400 hover:text-neutral-600 font-semibold">Refresh</button>
                </div>
                {savedLoading && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-neutral-300" size={22} /></div>}
                {!savedLoading && saved.length === 0 && (
                  <div className="bg-white rounded-2xl border border-neutral-100 p-8 text-center">
                    <FileText size={28} className="text-neutral-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-neutral-500">No saved reports yet</p>
                    <p className="text-xs text-neutral-400 mt-1">Generate a report and save it to see it here</p>
                  </div>
                )}
                {!savedLoading && saved.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <FileText size={14} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-neutral-800 truncate">{r.student_name}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{r.class_name} · {fmtDate(r.from_date)} – {fmtDate(r.to_date)}</p>
                      <p className="text-[10px] text-neutral-300 mt-0.5">Saved {fmtDate(r.created_at)}</p>
                    </div>
                    <button onClick={() => setViewing(r.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors shrink-0">
                      <Eye size={12} /> View
                    </button>
                  </div>
                ))}
              </div>
            )
        )}

        {tab === 'generate-all' && <GenerateAllPanel token={token} />}
      </div>
    </div>
  );
}

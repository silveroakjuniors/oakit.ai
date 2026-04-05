'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, Card, Badge, ProgressBar } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CurriculumDoc {
  id: string; filename: string; status: string;
  ingestion_stage?: string; total_chunks: number;
  uploaded_at: string; class_name: string;
}
interface Class { id: string; name: string; }
interface PreviewDay { week: number; day: number; topic_label: string; subjects: Record<string, string>; }
interface PreviewResult {
  mode: string; total_weeks_detected: number;
  total_days_detected: number; days: PreviewDay[];
  failed_pages: any[];
}

// Step 1: uploading file → 10%
// Step 2: extracting  → 30%
// Step 3: chunking    → 60%
// Step 4: embedding   → 85%
// Step 5: done        → 100%
const STAGE_PERCENT: Record<string, number> = {
  uploading: 10,
  extracting: 30,
  chunking: 60,
  embedding: 85,
  done: 100,
};
const STAGE_LABEL: Record<string, string> = {
  uploading: 'Uploading file...',
  extracting: 'Reading PDF tables...',
  chunking: 'Splitting into day chunks...',
  embedding: 'Generating AI embeddings...',
  done: 'Complete!',
};

export default function CurriculumPage() {
  const [docs, setDocs] = useState<CurriculumDoc[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [startPage, setStartPage] = useState(1);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const token = getToken() || '';

  // Flow state: idle → previewing → preview_ready → uploading → processing → done
  const [flow, setFlow] = useState<'idle' | 'previewing' | 'preview_ready' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [stage, setStage] = useState<string>('');
  const [stagePercent, setStagePercent] = useState(0);
  const [resultMsg, setResultMsg] = useState('');
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState<{ existing: { id: string; filename: string } } | null>(null);

  async function load() {
    try {
      const [docsData, classesData] = await Promise.all([
        apiGet<CurriculumDoc[]>('/api/v1/admin/curriculum', token),
        apiGet<Class[]>('/api/v1/admin/classes', token),
      ]);
      setDocs(docsData);
      setClasses(classesData);
    } catch (err) { console.error(err); }
  }

  useEffect(() => { load(); }, []);

  // Poll ingestion status
  useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(async () => {
      try {
        const data = await apiGet<{ status: string; stage?: string; total_chunks: number }>(
          `/api/v1/admin/curriculum/${pollingId}/status`, token
        );
        const s = data.stage || 'extracting';
        setStage(s);
        setStagePercent(STAGE_PERCENT[s] ?? 30);

        if (data.status === 'ready') {
          clearInterval(interval);
          setStage('done');
          setStagePercent(100);
          setFlow('done');
          setResultMsg(`✓ ${data.total_chunks} day chunks created and ready.`);
          setPollingId(null);
          await load();
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setFlow('error');
          setResultMsg(`Ingestion failed at stage: ${s}. Please try re-uploading.`);
          setPollingId(null);
          await load();
        }
      } catch {
        clearInterval(interval);
        setPollingId(null);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [pollingId]);

  async function handlePreview() {
    if (!pendingFile || !selectedClass) return;
    setFlow('previewing');
    setPreview(null);

    const formData = new FormData();
    formData.append('file', pendingFile);
    formData.append('start_page', String(startPage));

    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/curriculum/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data);
      setFlow('preview_ready');
    } catch (err: unknown) {
      setResultMsg(err instanceof Error ? err.message : 'Preview failed');
      setFlow('error');
    }
  }

  async function handleUpload(force = false) {
    if (!pendingFile || !selectedClass) return;
    setFlow('uploading');
    setStage('uploading');
    setStagePercent(10);
    setConfirmReplace(null);

    const formData = new FormData();
    formData.append('file', pendingFile);
    formData.append('class_id', selectedClass);
    formData.append('start_page', String(startPage));
    if (force) formData.append('force', 'true');

    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/curriculum/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (res.status === 409 && data.requires_confirmation) {
        setConfirmReplace({ existing: data.existing });
        setFlow('preview_ready'); // go back to preview state
        return;
      }
      if (!res.ok) throw new Error(data.error);

      setFlow('processing');
      setStage('extracting');
      setStagePercent(30);
      setPollingId(data.document_id);
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: unknown) {
      setResultMsg(err instanceof Error ? err.message : 'Upload failed');
      setFlow('error');
    }
  }

  function reset() {
    setFlow('idle');
    setPreview(null);
    setStage('');
    setStagePercent(0);
    setResultMsg('');
    setPendingFile(null);
    setSelectedClass('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const statusVariant = (s: string) =>
    s === 'ready' ? 'success' : s === 'failed' ? 'danger' : s === 'processing' ? 'warning' : 'neutral';

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold text-primary mb-2">Curriculum Upload</h1>
      <p className="text-sm text-gray-500 mb-6">
        Upload your curriculum PDF. We'll preview Week 1 first — once you approve, the full PDF is processed into daily chunks.
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-xs text-gray-400">
        {['Select & Preview', 'Approve', 'Process', 'Go to Calendar'].map((step, i) => {
          const active = (i === 0 && (flow === 'idle' || flow === 'previewing' || flow === 'preview_ready')) ||
            (i === 1 && flow === 'preview_ready') ||
            (i === 2 && (flow === 'uploading' || flow === 'processing')) ||
            (i === 3 && flow === 'done');
          const done = (i === 0 && flow !== 'idle' && flow !== 'previewing') ||
            (i === 1 && (flow === 'uploading' || flow === 'processing' || flow === 'done')) ||
            (i === 2 && flow === 'done');
          return (
            <div key={i} className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                ${done ? 'bg-green-500 text-white' : active ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'}`}>
                {done ? '✓' : i + 1}
              </span>
              <span className={active || done ? 'text-gray-700 font-medium' : ''}>{step}</span>
              {i < 3 && <span className="text-gray-200">→</span>}
            </div>
          );
        })}
      </div>

      {/* Step 1: Select file */}
      {(flow === 'idle' || flow === 'previewing') && (
        <Card className="mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Step 1 — Select PDF & Preview Week 1</h2>
          <div className="flex flex-col gap-3">
            <select
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
            >
              <option value="">Select class...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Plan starts on page</label>
                <input type="number" min={1}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={startPage} onChange={e => setStartPage(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              <p className="text-xs text-gray-400 mt-4">Skip cover pages, table of contents, and intro pages. Set this to the page where Week 1 begins.</p>
            </div>

            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setPendingFile(f); }}
            >
              <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                onChange={e => setPendingFile(e.target.files?.[0] || null)} />
              {pendingFile
                ? <p className="text-sm text-gray-700 font-medium">{pendingFile.name} ({(pendingFile.size / 1024 / 1024).toFixed(1)} MB)</p>
                : <p className="text-sm text-gray-400">Drag & drop a PDF here, or click to browse</p>
              }
            </div>

            <Button onClick={handlePreview} loading={flow === 'previewing'}
              disabled={!pendingFile || !selectedClass}>
              Preview Week 1
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Preview result */}
      {flow === 'preview_ready' && preview && (
        <Card className="mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Step 2 — Review Week 1 Preview</h2>
              <p className="text-xs text-gray-400 mt-1">
                Detected {preview.total_weeks_detected} weeks · {preview.total_days_detected} days total
                {preview.mode === 'table' ? ' · Table format ✓' : ' · Text format'}
              </p>
            </div>
            <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">← Start over</button>
          </div>

          <div className="flex flex-col gap-3 mb-4">
            {preview.days.map((day, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-primary mb-2">{day.topic_label}</p>
                <div className="flex flex-col gap-1">
                  {Object.entries(day.subjects).map(([subject, activity]) => (
                    <div key={subject} className="flex gap-2 text-xs">
                      <span className="font-medium text-gray-600 w-32 shrink-0">{subject}</span>
                      <span className="text-gray-500">{activity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {preview.failed_pages.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs text-amber-700">
              {preview.failed_pages.length} pages could not be read. Check that the start page is correct.
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-sm text-blue-700">
            Does this look correct? If yes, click <strong>Approve & Process Full PDF</strong> to load all {preview.total_days_detected} days into the system.
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={reset} className="flex-1">← Change file</Button>
            <Button onClick={() => handleUpload(false)} className="flex-1">
              Approve & Process Full PDF
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Processing */}
      {(flow === 'uploading' || flow === 'processing') && (
        <Card className="mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Step 3 — Processing Curriculum</h2>
          <ProgressBar percent={stagePercent} label={STAGE_LABEL[stage] || 'Processing...'} />
          <p className="text-xs text-gray-400 mt-3">
            This may take 1–3 minutes depending on the PDF size. You can leave this page — the processing continues in the background.
          </p>
        </Card>
      )}

      {/* Step 4: Done */}
      {flow === 'done' && (
        <Card className="mb-4">
          <div className="flex flex-col items-center text-center py-4 gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">✓</div>
            <p className="text-base font-semibold text-gray-800">{resultMsg}</p>
            <p className="text-sm text-gray-500">
              The curriculum has been split into daily chunks and is ready to use.
            </p>
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-sm text-primary w-full text-left">
              <p className="font-semibold mb-1">What to do next:</p>
              <ol className="list-decimal pl-4 flex flex-col gap-1 text-xs text-gray-600">
                <li>Go to <Link href="/admin/calendar" className="text-primary underline">Calendar</Link> and set your academic year, working days, and holidays</li>
                <li>Click <strong>Generate Day Plans</strong> to assign chunks to each working day</li>
                <li>Teachers can now see their daily plan when they log in</li>
              </ol>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="ghost" onClick={reset} className="flex-1">Upload another</Button>
              <Link href="/admin/calendar" className="flex-1">
                <Button className="w-full">Go to Calendar →</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Error */}
      {flow === 'error' && (
        <Card className="mb-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-3 text-sm text-red-700">{resultMsg}</div>
          <Button variant="ghost" onClick={reset}>← Try again</Button>
        </Card>
      )}

      {/* Replace confirmation */}
      {confirmReplace && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <Card className="w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Replace existing curriculum?</h2>
            <p className="text-sm text-gray-600 mb-4">
              A curriculum already exists for this class: <strong>{confirmReplace.existing.filename}</strong>.
              Replacing it will delete all existing chunks and day plans.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setConfirmReplace(null)} className="flex-1">Cancel</Button>
              <Button variant="danger" onClick={() => handleUpload(true)} className="flex-1">Replace</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Uploaded curricula list */}
      <Card>
        <h2 className="text-sm font-medium text-gray-700 mb-4">Uploaded Curricula</h2>
        <div className="flex flex-col gap-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{doc.filename}</p>
                <p className="text-xs text-gray-400">
                  {doc.class_name} · {doc.total_chunks ? `${doc.total_chunks} day chunks` : 'Processing...'}
                  {doc.ingestion_stage && doc.status === 'processing' && ` · ${STAGE_LABEL[doc.ingestion_stage] || doc.ingestion_stage}`}
                </p>
              </div>
              <Badge label={doc.status} variant={statusVariant(doc.status)} />
            </div>
          ))}
          {docs.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No curricula uploaded yet</p>}
        </div>
      </Card>
    </div>
  );
}

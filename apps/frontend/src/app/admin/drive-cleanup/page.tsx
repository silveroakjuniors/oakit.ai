'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Loader2, HardDrive, Trash2, Bell, ChevronLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface PreviewRow {
  entity_type: string;
  file_count: number;
  oldest: string;
  newest: string;
  total_bytes: number;
}

interface FeedClassRow {
  class_name: string;
  section_label: string;
  post_count: number;
  file_count: number;
  oldest_post: string;
}

interface Preview {
  older_than_days: number;
  total_files: number;
  total_mb: number;
  by_type: PreviewRow[];
  feed_by_class: FeedClassRow[];
}

function fmt(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function entityLabel(type: string) {
  const labels: Record<string, string> = {
    google_drive_media: 'Class Feed (teacher photos/videos)',
    teacher_media: 'Teacher Media uploads',
    social_media: 'Social Media posts',
    note: 'Student notes',
    homework: 'Homework files',
  };
  return labels[type] || type;
}

export default function DriveCleanupPage() {
  const token = getToken() || '';
  const router = useRouter();

  const [olderThanDays, setOlderThanDays] = useState(30);
  const [deleteAfterDays, setDeleteAfterDays] = useState(7);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [notifyResult, setNotifyResult] = useState('');
  const [execResult, setExecResult] = useState('');
  const [execError, setExecError] = useState('');
  const [step, setStep] = useState<'preview' | 'notify' | 'execute'>('preview');
  const [confirmText, setConfirmText] = useState('');

  async function loadPreview() {
    setPreviewing(true);
    setPreview(null);
    setNotifyResult('');
    setExecResult('');
    setExecError('');
    try {
      const data = await apiGet<Preview>(
        `/api/v1/admin/drive-cleanup/preview?older_than_days=${olderThanDays}`,
        token,
      );
      setPreview(data);
      setStep('preview');
    } catch (e: any) {
      setExecError(e?.message || 'Preview failed');
    } finally { setPreviewing(false); }
  }

  async function sendNotification() {
    setNotifying(true); setNotifyResult('');
    try {
      const r = await apiPost<any>('/api/v1/admin/drive-cleanup/notify', {
        older_than_days: olderThanDays,
        delete_after_days: deleteAfterDays,
      }, token);
      setNotifyResult(r.message);
      setStep('execute');
    } catch (e: any) {
      setNotifyResult(e?.message || 'Notification failed');
    } finally { setNotifying(false); }
  }

  async function executeCleanup() {
    if (confirmText !== 'DELETE') {
      setExecError('Type DELETE to confirm');
      return;
    }
    setExecuting(true); setExecResult(''); setExecError('');
    try {
      const r = await apiPost<any>('/api/v1/admin/drive-cleanup/execute', {
        older_than_days: olderThanDays,
        confirmed: true,
      }, token);
      setExecResult(r.message);
      setPreview(null);
      setStep('preview');
      setConfirmText('');
    } catch (e: any) {
      setExecError(e?.message || 'Cleanup failed');
    } finally { setExecuting(false); }
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-neutral-100">
          <ChevronLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <HardDrive className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-sm font-bold text-neutral-900">Google Drive Cleanup</h1>
          <p className="text-xs text-neutral-400">Remove all teacher-uploaded files from Drive</p>
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">

        {/* Warning banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Permanent action</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              This deletes files from Google Drive permanently — feed photos, teacher media, social media posts, notes, and homework files.
              Always notify parents first so they can download anything they want to keep.
              Files already saved to parents' devices are not affected.
            </p>
          </div>
        </div>

        {/* Step 1 — Configure & Preview */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">1</span>
            Configure & Preview
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">
                Delete files older than (days)
              </label>
              <input
                type="number"
                min={7}
                value={olderThanDays}
                onChange={e => setOlderThanDays(Math.max(7, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-[10px] text-neutral-400 mt-1">Minimum 7 days</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">
                Notify parents (days before delete)
              </label>
              <input
                type="number"
                min={2}
                value={deleteAfterDays}
                onChange={e => setDeleteAfterDays(Math.max(2, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-[10px] text-neutral-400 mt-1">Parents see popup for this many days</p>
            </div>
          </div>

          <button
            onClick={loadPreview}
            disabled={previewing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            {previewing ? 'Scanning Drive...' : 'Preview files to delete'}
          </button>
        </div>

        {/* Preview results */}
        {preview && (
          <>
            <div className="bg-white border border-neutral-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-neutral-800">
                  {preview.total_files} file(s) found
                </h3>
                <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-1 rounded-full">
                  {preview.total_mb} MB
                </span>
              </div>

              {preview.by_type.length === 0 ? (
                <p className="text-sm text-neutral-400">No Drive files found older than {olderThanDays} days.</p>
              ) : (
                <div className="space-y-2">
                  {preview.by_type.map((row) => (
                    <div key={row.entity_type} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-neutral-700">{entityLabel(row.entity_type)}</p>
                        <p className="text-xs text-neutral-400">{row.oldest} to {row.newest}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-neutral-800">{row.file_count} files</p>
                        <p className="text-xs text-neutral-400">{fmt(Number(row.total_bytes || 0))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Class breakdown for feed */}
              {preview.feed_by_class.length > 0 && (
                <div className="mt-3 pt-3 border-t border-neutral-100">
                  <p className="text-xs font-bold text-neutral-600 mb-2">Feed files by class (parents will be notified per class):</p>
                  <div className="space-y-1">
                    {preview.feed_by_class.map((row, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-neutral-700">{row.class_name} - {row.section_label}</span>
                        <span className="text-neutral-500">{row.file_count} files across {row.post_count} posts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2 — Notify Parents */}
            {preview.total_files > 0 && (
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">2</span>
                  Notify Parents (recommended)
                </h2>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Sends a popup to parents of each affected class telling them to download photos/videos
                  within <strong>{deleteAfterDays} days</strong>. The popup includes the Google Drive folder link.
                </p>
                <button
                  onClick={sendNotification}
                  disabled={notifying}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
                >
                  {notifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  {notifying ? 'Sending notifications...' : `Notify parents (${deleteAfterDays}-day warning)`}
                </button>
                {notifyResult && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <p className="text-xs text-emerald-700">{notifyResult}</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3 — Execute */}
            {preview.total_files > 0 && (
              <div className="bg-white border border-red-200 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">3</span>
                  Delete from Google Drive
                </h2>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  This permanently deletes <strong>{preview.total_files} file(s)</strong> ({preview.total_mb} MB) from Google Drive.
                  Type <strong>DELETE</strong> to confirm.
                </p>
                <input
                  type="text"
                  placeholder="Type DELETE to confirm"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-xl border border-red-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-300/40"
                />
                <button
                  onClick={executeCleanup}
                  disabled={executing || confirmText !== 'DELETE'}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {executing ? 'Deleting...' : `Delete ${preview.total_files} file(s) permanently`}
                </button>
                {execError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                    <p className="text-xs text-red-700">{execError}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Success result */}
        {execResult && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">{execResult}</p>
          </div>
        )}

      </div>
    </div>
  );
}

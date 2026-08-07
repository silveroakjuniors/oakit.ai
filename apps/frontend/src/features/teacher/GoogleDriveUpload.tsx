'use client';
import { useState, useRef, useEffect } from 'react';
import { Upload, FolderOpen, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { API_BASE, getApiBase } from '@/lib/api';
import { compressVideoClient, formatBytes as fmtBytes, isFFmpegSupported } from '@/lib/videoCompressClient';

interface DriveConfig {
  google_drive_enabled: boolean;
  google_drive_folder_id: string | null;
  google_drive_class_folder: string | null;
  class_folder_name: string | null;
  drive_folder_url: string | null;
  auth_configured: boolean;
}

interface GoogleDriveUploadProps {
  token: string;
  onUploadSuccess?: (file: { name: string; url: string }) => void;
  className?: string;
}

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];

export default function GoogleDriveUpload({ token, onUploadSuccess, className = '' }: GoogleDriveUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string; isVideo: boolean; name: string }[]>([]);
  const [eventName, setEventName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [compressStatus, setCompressStatus] = useState('');
  const [compressProgress, setCompressProgress] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [folderPath, setFolderPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<DriveConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [refreshConfig, setRefreshConfig] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split('T')[0];
  const base = config?.class_folder_name || config?.google_drive_class_folder || 'Class';
  const previewPath = loadingConfig
    ? 'Loading...'
    : eventName.trim()
      ? `${base} / ${today} / ${eventName.trim()}`
      : `${base} / ${today}`;

  useEffect(() => {
    const fetchConfig = async () => {
      setLoadingConfig(true);
      try {
        // cache: 'no-store' prevents the browser from serving a stale cached response
        const res = await fetch(`${getApiBase()}/api/v1/teacher/media/config`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          console.log('[GoogleDriveUpload] config:', data);
          setConfig(data);
        } else {
          console.error('[GoogleDriveUpload] config fetch failed:', res.status, await res.text());
        }
      } catch (err) {
        console.error('[GoogleDriveUpload] config error:', err);
      } finally {
        setLoadingConfig(false);
      }
    };
    if (token) fetchConfig();
  }, [token, refreshConfig]);

  function handleFiles(selected: FileList | null) {
    if (!selected) return;
    const valid = Array.from(selected).filter(
      f => ALLOWED_IMAGE.includes(f.type) || ALLOWED_VIDEO.includes(f.type)
    );
    const combined = [...files, ...valid];
    setFiles(combined);
    setPreviews(combined.map(f => ({
      url: URL.createObjectURL(f),
      isVideo: ALLOWED_VIDEO.includes(f.type),
      name: f.name,
    })));
    setError(null);
  }

  function removeFile(i: number) {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    setPreviews(next.map(f => ({
      url: URL.createObjectURL(f),
      isVideo: ALLOWED_VIDEO.includes(f.type),
      name: f.name,
    })));
  }

  async function handleSubmit() {
    if (files.length === 0) { setError('Select at least one file'); return; }
    setUploading(true);
    setError(null);
    setSuccessCount(0);
    setFolderPath('');
    setUploadProgress({ done: 0, total: files.length });

    const ffmpegOk = isFFmpegSupported();
    console.log('[DriveUpload] FFmpeg WASM supported:', ffmpegOk, '| SharedArrayBuffer:', typeof SharedArrayBuffer !== 'undefined');

    let done = 0;
    let lastFolderPath = '';

    for (const file of files) {
      try {
        let uploadFile = file;

        // Compress video on-device before uploading
        if (ALLOWED_VIDEO.includes(file.type) && ffmpegOk) {
          setIsCompressing(true);
          setCompressProgress(0);
          setCompressStatus('Loading compressor...');
          try {
            const result = await compressVideoClient(
              file,
              (s) => setCompressStatus(s),
              (p) => setCompressProgress(p),
            );
            uploadFile = result.file;
            console.log(`[DriveUpload] compressed: ${fmtBytes(result.originalSize)} → ${fmtBytes(result.compressedSize)} (${result.savingsPct}% smaller)`);
          } catch (compErr: any) {
            console.warn('[DriveUpload] compression failed, using original:', compErr.message);
          }
          setIsCompressing(false);
        }

        const fd = new FormData();
        fd.append('media', uploadFile, file.name);
        if (eventName.trim()) fd.append('event_name', eventName.trim());

        const res = await fetch(`${getApiBase()}/api/v1/teacher/media/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
          signal: AbortSignal.timeout(120000), // 2 min timeout
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Upload failed');
        }

        const data = await res.json();
        lastFolderPath = data.folder_path || '';
        done++;
        setUploadProgress({ done, total: files.length });

        onUploadSuccess?.({ name: file.name, url: data.display_url });
      } catch (err: any) {
        setError(`Failed to upload ${file.name}: ${err.message || 'Unknown error'}`);
      }
    }

    setSuccessCount(done);
    setFolderPath(lastFolderPath);
    if (done > 0) {
      setFiles([]);
      setPreviews([]);
      setEventName('');
    }
    setUploading(false);
    setUploadProgress(null);
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loadingConfig) {
    return (
      <div className={`bg-white rounded-2xl border border-neutral-100 shadow-sm ${className}`}>
        <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
          <FolderOpen size={15} className="text-emerald-600" />
          <p className="text-sm font-bold text-neutral-800">Class Photos / Videos</p>
        </div>
        <div className="p-6 flex justify-center">
          <Loader2 className="animate-spin text-neutral-300" size={22} />
        </div>
      </div>
    );
  }

  // ── Not configured ─────────────────────────────────────────────────────────
  if (!config?.google_drive_enabled) {
    return (
      <div className={`bg-white rounded-2xl border border-neutral-100 shadow-sm ${className}`}>
        <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen size={15} className="text-neutral-400" />
            <p className="text-sm font-bold text-neutral-800">Class Photos / Videos</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshConfig(Date.now())}
              className="text-[10px] text-neutral-400 hover:text-emerald-600 transition-colors underline"
            >
              Refresh
            </button>
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Not Set Up
            </span>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-neutral-500 space-y-1.5">
              <p>Google Drive uploads are not yet configured for your school. Ask your admin to enable it in Settings.</p>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 mt-2">
                <p className="font-semibold text-amber-800 mb-1">Setup requires:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-900 ml-1">
                  <li>Google Cloud Service Account JSON</li>
                  <li>Shared Google Drive Folder ID</li>
                  <li>Enable toggle in Admin Settings</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // ── Auth not configured ─────────────────────────────────────────────────────
  if (!config.auth_configured) {
    return (
      <div className={`bg-white rounded-2xl border border-neutral-100 shadow-sm ${className}`}>
        <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen size={15} className="text-amber-500" />
            <p className="text-sm font-bold text-neutral-800">Class Photos / Videos</p>
          </div>
          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Partial Config
          </span>
        </div>
        <div className="p-5 space-y-3">
          <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-neutral-500 space-y-1.5">
            <p className="font-semibold text-amber-800">Google Drive OAuth credentials missing</p>
            <p>
              The Google Drive folder ID is configured, but service account credentials are missing.
            </p>
            <p className="text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">
              Ask admin to:
              <ol className="list-decimal list-inside mt-1.5 space-y-1">
                <li>Go to Google Cloud Console → API & Services → Credentials</li>
                <li>Create a Service Account and download the JSON key</li>
                <li>Run SQL: <code className="font-mono text-[10px] bg-neutral-100 px-1 rounded">UPDATE school_settings SET google_drive_auth = '...'::jsonb WHERE school_id = '...'</code></li>
              </ol>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main upload UI ─────────────────────────────────────────────────────────
  return (
    <div className={`bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen size={15} className="text-emerald-600" />
          <p className="text-sm font-bold text-neutral-800">Class Photos / Videos</p>
        </div>
        <span className="text-[10px] text-neutral-400 bg-neutral-50 px-2 py-0.5 rounded-full font-medium">
          Google Drive
        </span>
      </div>

      <div className="px-4 pt-4 pb-3 space-y-4">
        {/* Event name */}
        <div>
          <label className="text-xs font-semibold text-neutral-600 block mb-1.5">
            Event Name <span className="font-normal text-neutral-400">(optional)</span>
          </label>
          <input
            type="text"
            value={eventName}
            onChange={e => setEventName(e.target.value)}
            placeholder="e.g. GreenDay, Sports Meet, Graduation..."
            className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
          />
          <p className="text-[10px] text-neutral-400 mt-1.5 font-mono bg-neutral-50 rounded-lg px-2 py-1">
            {previewPath}
          </p>
          <p className="text-[10px] text-neutral-400 mt-1">
            Leave blank to upload directly under today's date folder.
            Adding a name creates a sub-folder (e.g. "GreenDay").
          </p>
        </div>

        {/* Drop zone */}
        <div
          className="border-2 border-dashed border-neutral-200 rounded-xl p-5 text-center hover:border-emerald-300 transition-colors cursor-pointer"
          onClick={() => inputRef.current?.click()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          onDragOver={e => e.preventDefault()}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <Upload size={22} className="text-emerald-500 mx-auto mb-1.5" />
          <p className="text-sm font-semibold text-neutral-700">Click or drag & drop</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">Photos and Videos — any number of files</p>
        </div>

        {/* File list */}
        {previews.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {previews.map((preview, i) => (
              <div key={i} className="flex items-center gap-3 bg-neutral-50 border border-neutral-100 rounded-xl px-3 py-2">
                {preview.isVideo
                  ? <video src={preview.url} className="w-10 h-10 rounded-lg object-cover bg-black shrink-0" muted />
                  : <img src={preview.url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-neutral-800 truncate">{preview.name}</p>
                  <p className="text-[10px] text-neutral-400">{(files[i].size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button onClick={() => removeFile(i)} className="text-neutral-300 hover:text-red-400 shrink-0">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Compression progress */}
        {isCompressing && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-600 font-medium">Compressing video on device...</span>
              <span className="text-amber-600 font-bold">{compressProgress}%</span>
            </div>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${compressProgress}%` }} />
            </div>
            {compressStatus && <p className="text-[11px] text-neutral-500 text-center">{compressStatus}</p>}
          </div>
        )}

        {/* Upload progress */}
        {uploading && uploadProgress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500">Uploading {uploadProgress.done} of {uploadProgress.total}...</span>
              <span className="text-emerald-600 font-semibold">
                {Math.round((uploadProgress.done / uploadProgress.total) * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Success */}
        {successCount > 0 && !uploading && (
          <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-800">
                {successCount} file{successCount > 1 ? 's' : ''} uploaded to Google Drive
              </p>
              {folderPath && (
                <p className="text-[10px] text-emerald-700 mt-0.5 font-mono truncate">{folderPath}</p>
              )}
            </div>
          </div>
        )}

        {/* Upload button */}
        <button
          onClick={handleSubmit}
          disabled={uploading || files.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
          style={{ background: '#1B4332' }}
        >
          {uploading
            ? <><Loader2 className="animate-spin" size={15} /> Uploading...</>
            : <><Upload size={15} /> Upload {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : 'Files'}</>
          }
        </button>
      </div>
    </div>
  );
}

'use client';
import { useState, useRef } from 'react';
import { getApiBase, apiPost } from '@/lib/api';
import { compressVideoClient, formatBytes, isFFmpegSupported } from '@/lib/videoCompressClient';

interface UploadModalProps {
  token: string;
  sectionId?: string;
  onClose: () => void;
  onPosted: () => void;
}

const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_VIDEO_MB = 50; // Accept up to 50MB — we'll compress it down

type Phase = 'idle' | 'compressing' | 'uploading' | 'done';

export default function UploadModal({ token, sectionId, onClose, onPosted }: UploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string; isVideo: boolean }[]>([]);
  const [caption, setCaption] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [sizeInfo, setSizeInfo] = useState<{ original: string; compressed: string; pct: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(selected: FileList | null) {
    if (!selected) return;
    const allTypes = [...IMAGE_TYPES, ...VIDEO_TYPES];
    const valid: File[] = [];
    let videoCount = files.filter(f => VIDEO_TYPES.includes(f.type)).length;

    for (const f of Array.from(selected)) {
      if (!allTypes.includes(f.type)) continue;
      if (VIDEO_TYPES.includes(f.type)) {
        if (videoCount >= 1) { setError('Only 1 video per post allowed.'); continue; }
        if (f.size > MAX_VIDEO_MB * 1024 * 1024) {
          setError(`Video is ${(f.size / 1024 / 1024).toFixed(1)}MB — max ${MAX_VIDEO_MB}MB.`);
          continue;
        }
        videoCount++;
      }
      valid.push(f);
    }

    const combined = [...files, ...valid].slice(0, 5);
    setFiles(combined);
    setPreviews(combined.map(f => ({
      url: URL.createObjectURL(f),
      isVideo: VIDEO_TYPES.includes(f.type),
    })));
    if (valid.length > 0) setError('');
    setSizeInfo(null);
  }

  function removeFile(i: number) {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    setPreviews(next.map(f => ({ url: URL.createObjectURL(f), isVideo: VIDEO_TYPES.includes(f.type) })));
    setSizeInfo(null);
  }

  async function askOakie() {
    if (files.length === 0) { setError('Add a photo or video first'); return; }
    setAiLoading(true);
    try {
      const res = await apiPost<{ caption: string }>('/api/v1/feed/generate-caption', {
        has_video: files.some(f => VIDEO_TYPES.includes(f.type)),
        file_count: files.length,
        current_caption: caption || undefined,
      }, token);
      if (res.caption) setCaption(res.caption);
    } catch { setError('Oakie could not generate a caption right now'); }
    finally { setAiLoading(false); }
  }

  async function handleSubmit() {
    if (files.length === 0) { setError('Pick at least one photo or video'); return; }
    setError('');
    setSizeInfo(null);

    // ── Step 1: Compress video files on-device ────────────────────────────
    const readyFiles: File[] = [];
    const ffmpegOk = isFFmpegSupported();
    console.log('[upload] FFmpeg WASM supported:', ffmpegOk);

    for (const file of files) {
      if (VIDEO_TYPES.includes(file.type) && ffmpegOk) {
        setPhase('compressing');
        setProgress(0);
        setStatusMsg('Loading compressor...');
        try {
          const result = await compressVideoClient(
            file,
            (s) => setStatusMsg(s),
            (p) => setProgress(p),
          );
          readyFiles.push(result.file);
          setSizeInfo({
            original:   formatBytes(result.originalSize),
            compressed: formatBytes(result.compressedSize),
            pct:        result.savingsPct,
          });
        } catch (compressErr: any) {
          // Compression failed — use original
          console.warn('[compress] failed, using original:', compressErr.message);
          readyFiles.push(file);
        }
      } else {
        readyFiles.push(file);
      }
    }

    // ── Step 2: Upload ────────────────────────────────────────────────────
    setPhase('uploading');
    setProgress(0);
    setStatusMsg('Uploading...');

    try {
      const fd = new FormData();
      readyFiles.forEach(f => fd.append('images', f));
      if (caption.trim()) fd.append('caption', caption.trim());
      if (sectionId) fd.append('section_id', sectionId);

      // Simulate upload progress (XHR gives real progress, fetch doesn't)
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 3, 90));
      }, 500);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2 min

      const res = await fetch(`${getApiBase()}/api/v1/feed/posts`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    fd,
        signal:  controller.signal,
      });

      clearTimeout(timeout);
      clearInterval(progressInterval);
      setProgress(100);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      // Show compression info from server if available
      if (data.compressed && data.savings_pct > 0) {
        setSizeInfo({
          original:   data.original_size,
          compressed: data.final_size,
          pct:        data.savings_pct,
        });
      }

      setPhase('done');
      setTimeout(() => { onPosted(); onClose(); }, 800);
    } catch (e: any) {
      setPhase('idle');
      setError(e.name === 'AbortError'
        ? 'Upload timed out. Check your connection and try again.'
        : (e.message || 'Upload failed'));
    }
  }

  const hasVideo = files.some(f => VIDEO_TYPES.includes(f.type));
  const busy = phase === 'compressing' || phase === 'uploading';
  const isMediaRecorderAvailable = typeof MediaRecorder !== 'undefined';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
      onClick={busy ? undefined : onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
          <p className="text-sm font-semibold text-neutral-800">Post to Class Feed</p>
          {!busy && <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl leading-none">&times;</button>}
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Media grid */}
          <div className="grid grid-cols-3 gap-2">
            {previews.map((p, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-neutral-100">
                {p.isVideo
                  ? <video src={p.url} className="w-full h-full object-cover" muted playsInline />
                  : <img src={p.url} alt="" className="w-full h-full object-cover" />}
                {p.isVideo && (
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Video
                  </div>
                )}
                {!busy && (
                  <button onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center">&times;</button>
                )}
              </div>
            ))}
            {files.length < 5 && !busy && (
              <button onClick={() => inputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center gap-1 text-neutral-400 hover:border-primary-300 hover:text-primary-400 transition-colors">
                <span className="text-2xl">+</span>
                <span className="text-[10px]">{files.length === 0 ? 'Add media' : 'Add more'}</span>
              </button>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple className="hidden"
            onChange={e => handleFiles(e.target.files)} />

          {/* Compression / upload progress */}
          {(phase === 'compressing' || phase === 'uploading') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-600 font-medium">
                  {phase === 'compressing' ? 'Compressing video on device...' : 'Uploading...'}
                </span>
                <span className="text-primary-600 font-bold">{progress}%</span>
              </div>
              <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${phase === 'compressing' ? 'bg-amber-400' : 'bg-emerald-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {statusMsg && (
                <p className="text-[11px] text-neutral-500 text-center">{statusMsg}</p>
              )}
            </div>
          )}

          {/* Size info after compression */}
          {sizeInfo && sizeInfo.pct > 0 && phase !== 'compressing' && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <p className="text-[11px] text-emerald-700">
                Video compressed: <span className="font-semibold">{sizeInfo.original}</span> &rarr; <span className="font-semibold">{sizeInfo.compressed}</span> ({sizeInfo.pct}% smaller)
              </p>
            </div>
          )}

          {hasVideo && phase === 'idle' && (
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-[10px] text-emerald-800 leading-relaxed">
                {isFFmpegSupported()
                  ? 'Video will be compressed on your device before uploading — faster upload, smaller file.'
                  : isMediaRecorderAvailable
                    ? 'Video will be re-encoded on your device before uploading (Safari mode).'
                    : 'Video will be uploaded directly (compression not supported on this browser).'}
                <span className="text-emerald-600 block mt-0.5">Max size: {MAX_VIDEO_MB}MB - Kept for 5 days</span>
              </p>
            </div>
          )}

          {/* Caption */}
          {phase === 'idle' && (
            <>
              <div className="relative">
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value.slice(0, 500))}
                  placeholder="Add a caption... (optional)"
                  rows={2}
                  className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary-300 pr-20"
                />
                <button
                  onClick={askOakie}
                  disabled={aiLoading || files.length === 0}
                  className="absolute right-2 top-2 flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-semibold rounded-lg transition-all disabled:opacity-50"
                >
                  {aiLoading
                    ? <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z"/></svg>
                  }
                  Ask Oakie
                </button>
              </div>
              <p className="text-[10px] text-neutral-400 -mt-2 text-right">{caption.length}/500</p>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-xs text-red-700 leading-relaxed">{error}</p>
            </div>
          )}

          {phase !== 'done' && (
            <button
              onClick={handleSubmit}
              disabled={busy || files.length === 0}
              className="w-full py-3 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
              style={{ background: busy ? '#6b7280' : '#1B4332' }}
            >
              {busy
                ? (phase === 'compressing' ? 'Compressing...' : 'Uploading...')
                : `Share ${files.length > 0 ? `${files.length} ${hasVideo ? 'media' : `photo${files.length > 1 ? 's' : ''}`}` : ''}`
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

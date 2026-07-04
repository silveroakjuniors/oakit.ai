'use client';
import { useState, useRef } from 'react';
import { API_BASE, apiPost } from '@/lib/api';

interface UploadModalProps {
  token: string;
  sectionId?: string;
  onClose: () => void;
  onPosted: () => void;
}

const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_VIDEO_MB = 25;

export default function UploadModal({ token, sectionId, onClose, onPosted }: UploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string; isVideo: boolean }[]>([]);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(selected: FileList | null) {
    if (!selected) return;
    const allTypes = [...IMAGE_TYPES, ...VIDEO_TYPES];
    const valid: File[] = [];
    let videoCount = files.filter(f => VIDEO_TYPES.includes(f.type)).length;

    for (const f of Array.from(selected)) {
      if (!allTypes.includes(f.type)) continue;
      if (VIDEO_TYPES.includes(f.type)) {
        if (videoCount >= 1) { setError('Maximum 1 video per post'); continue; }
        if (f.size > MAX_VIDEO_MB * 1024 * 1024) { setError(`Video must be under ${MAX_VIDEO_MB}MB`); continue; }
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
  }

  function removeFile(i: number) {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    setPreviews(next.map(f => ({
      url: URL.createObjectURL(f),
      isVideo: VIDEO_TYPES.includes(f.type),
    })));
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
    setUploading(true);
    setError('');

    const MAX_RETRIES = 2;
    let attempt = 0;
    let lastErr = '';

    while (attempt <= MAX_RETRIES) {
      try {
        const fd = new FormData();
        files.forEach(f => fd.append('images', f));
        if (caption.trim()) fd.append('caption', caption.trim());
        if (sectionId) fd.append('section_id', sectionId);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000); // 90s for video

        const res = await fetch(`${API_BASE}/api/v1/feed/posts`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        onPosted();
        onClose();
        return;
      } catch (e: any) {
        lastErr = e.name === 'AbortError'
          ? 'Upload timed out. Check your internet connection and try again.'
          : (e.message || 'Upload failed');
        attempt++;
        if (attempt <= MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }

    setError(lastErr);
    setUploading(false);
  }

  const hasVideo = files.some(f => VIDEO_TYPES.includes(f.type));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
          <p className="text-sm font-semibold text-neutral-800">Post to Class Feed</p>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Media grid */}
          <div className="grid grid-cols-3 gap-2">
            {previews.map((p, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-neutral-100">
                {p.isVideo ? (
                  <video src={p.url} className="w-full h-full object-cover" muted playsInline />
                ) : (
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                )}
                {p.isVideo && (
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Video
                  </div>
                )}
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
                >&times;</button>
              </div>
            ))}
            {files.length < 5 && (
              <button
                onClick={() => inputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center gap-1 text-neutral-400 hover:border-primary-300 hover:text-primary-400 transition-colors"
              >
                <span className="text-2xl">+</span>
                <span className="text-[10px]">{files.length === 0 ? 'Add media' : 'Add more'}</span>
              </button>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple className="hidden"
            onChange={e => handleFiles(e.target.files)} />

          {hasVideo && (
            <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              Videos are limited to {MAX_VIDEO_MB}MB and will be automatically removed after 5 days to save storage.
            </p>
          )}

          {/* Caption + Ask Oakie */}
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
              {aiLoading ? (
                <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z"/>
                </svg>
              )}
              Ask Oakie
            </button>
          </div>
          <p className="text-[10px] text-neutral-400 -mt-2 text-right">{caption.length}/500</p>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={uploading || files.length === 0}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {uploading ? 'Posting…' : `Share ${files.length > 0 ? `${files.length} ${hasVideo ? 'media' : `photo${files.length > 1 ? 's' : ''}`}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

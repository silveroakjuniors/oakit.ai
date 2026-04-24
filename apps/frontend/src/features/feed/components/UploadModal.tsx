'use client';
import { useState, useRef } from 'react';
import { API_BASE } from '@/lib/api';

interface UploadModalProps {
  token: string;
  sectionId?: string;
  onClose: () => void;
  onPosted: () => void;
}

export default function UploadModal({ token, sectionId, onClose, onPosted }: UploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(selected: FileList | null) {
    if (!selected) return;
    const valid = Array.from(selected).filter(f => f.type.startsWith('image/')).slice(0, 5);
    const combined = [...files, ...valid].slice(0, 5);
    setFiles(combined);
    setPreviews(combined.map(f => URL.createObjectURL(f)));
    setError('');
  }

  function removeFile(i: number) {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    setPreviews(next.map(f => URL.createObjectURL(f)));
  }

  async function handleSubmit() {
    if (files.length === 0) { setError('Pick at least one photo'); return; }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('images', f));
      if (caption.trim()) fd.append('caption', caption.trim());
      if (sectionId) fd.append('section_id', sectionId);

      const res = await fetch(`${API_BASE}/api/v1/feed/posts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onPosted();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
          <p className="text-sm font-semibold text-neutral-800">📸 Post to Class Feed</p>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl leading-none">×</button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Photo grid */}
          <div className="grid grid-cols-3 gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-neutral-100">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
                >×</button>
              </div>
            ))}
            {files.length < 5 && (
              <button
                onClick={() => inputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center gap-1 text-neutral-400 hover:border-primary-300 hover:text-primary-400 transition-colors"
              >
                <span className="text-2xl">+</span>
                <span className="text-[10px]">{files.length === 0 ? 'Add photos' : 'Add more'}</span>
              </button>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => handleFiles(e.target.files)} />

          {/* Caption */}
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value.slice(0, 500))}
            placeholder="Add a caption… (optional)"
            rows={2}
            className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary-300"
          />
          <p className="text-[10px] text-neutral-400 -mt-2 text-right">{caption.length}/500</p>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={uploading || files.length === 0}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {uploading ? 'Posting…' : `Share ${files.length > 0 ? `${files.length} photo${files.length > 1 ? 's' : ''}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

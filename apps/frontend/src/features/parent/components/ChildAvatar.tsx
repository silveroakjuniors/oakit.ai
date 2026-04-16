'use client';
import { useState } from 'react';
import { API_BASE } from '@/lib/api';
import type { Child } from '../types';

export function ChildAvatar({ child, size = 'md', token, onUploaded }: {
  child: Child; size?: 'sm' | 'md' | 'lg';
  token?: string; onUploaded?: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const sz = size === 'sm' ? 'w-8 h-8 text-sm' : size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-10 h-10 text-base';
  const photoUrl = child.photo_url
    ? (child.photo_url.startsWith('http') ? child.photo_url : `${API_BASE}${child.photo_url}`)
    : null;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch(`${API_BASE}/api/v1/parent/child/${child.id}/photo`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUploaded?.(data.photo_url);
    } catch (err) { console.error('Photo upload failed', err); }
    finally { setUploading(false); }
  }

  return (
    <>
      {preview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="relative max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <img src={preview} alt={child.name} className="w-full rounded-2xl object-contain max-h-[70vh]" />
            <button onClick={() => setPreview(null)}
              className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70">✕</button>
            <p className="text-white text-center mt-3 font-semibold">{child.name}</p>
          </div>
        </div>
      )}
      <label className={`relative ${sz} rounded-full shrink-0 cursor-pointer group`} title="Tap to change photo">
        {photoUrl ? (
          <img src={photoUrl} alt={child.name}
            className={`${sz} rounded-full object-contain bg-white border-2 border-white/20`}
            onClick={e => { e.preventDefault(); setPreview(photoUrl); }} />
        ) : (
          <div className={`${sz} rounded-full bg-white/20 flex items-center justify-center font-bold text-white`}>
            {uploading ? <span className="text-xs animate-spin">⏳</span> : child.name[0]}
          </div>
        )}
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
          <span className="text-white text-xs">📷</span>
        </div>
        {token && <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} />}
      </label>
    </>
  );
}

'use client';
import { useState } from 'react';
import { API_BASE } from '@/lib/api';

/**
 * Convert a stored media URL to a full absolute proxy URL.
 * Stored format: /api/v1/drive-proxy?id=X&school=Y&sig=Z  (from new uploads)
 * Legacy formats: gdrive:ID, full Drive URLs, thumbnail URLs — handled gracefully.
 */
function toProxyUrl(url: string): string {
  if (!url) return '';
  // Already a full absolute URL (old direct Drive URLs or Supabase) — use as-is
  if (url.startsWith('https://') || url.startsWith('http://')) return url;
  // Relative proxy path — prepend API base
  if (url.startsWith('/api/v1/drive-proxy')) return `${API_BASE}${url}`;
  // Legacy gdrive: scheme — wrap in proxy via extract
  if (url.startsWith('gdrive:')) {
    const id = url.slice(7);
    return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
  }
  return url;
}

function toVideoUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('https://') || url.startsWith('http://')) return url;
  if (url.startsWith('/api/v1/drive-proxy')) return `${API_BASE}${url}`;
  if (url.startsWith('gdrive:')) {
    return `https://drive.google.com/uc?export=download&id=${url.slice(7)}&confirm=t`;
  }
  return url;
}

function toDownloadUrl(url: string): string {
  if (!url) return '';
  // Proxy download: append download=1
  if (url.startsWith('/api/v1/drive-proxy')) return `${API_BASE}${url}&download=1`;
  if (url.startsWith('https://drive.google.com') || url.startsWith('http://')) return url;
  if (url.startsWith('gdrive:')) {
    return `https://drive.google.com/uc?export=download&id=${url.slice(7)}&confirm=t`;
  }
  return url;
}

function toDriveOpenUrl(url: string): string {
  // Extract file ID from proxy URL for "Open in Drive" fallback
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/view`;
  if (url.startsWith('gdrive:')) return `https://drive.google.com/file/d/${url.slice(7)}/view`;
  return url;
}

function isVideoUrl(url: string, mediaType?: string): boolean {
  if (mediaType === 'video') return true;
  if (mediaType === 'image') return false;
  return ['.mp4', '.mov', '.webm', '.3gp', '.m4v'].some(ext =>
    url.toLowerCase().includes(ext)
  );
}

export default function ImageCarousel({ images, mediaTypes }: {
  images: string[];
  mediaTypes?: string[];
}) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [vidError, setVidError] = useState(false);

  if (images.length === 0) return null;

  const rawUrl     = images[idx];
  const mediaType  = mediaTypes?.[idx];
  const currentIsVideo = isVideoUrl(rawUrl, mediaType);

  const previewSrc  = currentIsVideo ? toVideoUrl(rawUrl)  : toProxyUrl(rawUrl);
  const lightboxSrc = currentIsVideo ? toVideoUrl(rawUrl)  : toProxyUrl(rawUrl);
  const downloadSrc = toDownloadUrl(rawUrl);

  return (
    <>
      <div
        className="relative w-full bg-neutral-100 cursor-pointer"
        style={{ aspectRatio: '4/3' }}
        onClick={() => setLightbox(true)}
      >
        {currentIsVideo ? (
          <div className="relative w-full h-full bg-black" onClick={() => setLightbox(true)}>
            {vidError ? (
              // Fallback: open in Drive
              <a href={toDriveOpenUrl(rawUrl)} target="_blank" rel="noopener noreferrer"
                className="w-full h-full flex flex-col items-center justify-center gap-2 bg-black"
                onClick={e => e.stopPropagation()}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white" opacity="0.6"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <span className="text-white text-xs">Tap to open video</span>
              </a>
            ) : (
              <>
                <video
                  src={previewSrc}
                  className="w-full h-full object-cover"
                  playsInline
                  preload="metadata"
                  muted
                  onError={() => setVidError(true)}
                />
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="8 5 19 12 8 19 8 5"/></svg>
                  </div>
                </div>
              </>
            )}
            <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 pointer-events-none">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Video
            </div>
          </div>
        ) : imgError ? (
          <div className="w-full h-full flex items-center justify-center bg-neutral-200">
            <span className="text-neutral-400 text-xs">Unable to load image</span>
          </div>
        ) : (
          <img
            src={previewSrc}
            alt={`Photo ${idx + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        )}

        {/* Navigation */}
        {images.length > 1 && (
          <>
            {idx > 0 && (
              <button onClick={e => { e.stopPropagation(); setIdx(i => i - 1); setImgError(false); setVidError(false); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg">&#8249;</button>
            )}
            {idx < images.length - 1 && (
              <button onClick={e => { e.stopPropagation(); setIdx(i => i + 1); setImgError(false); setVidError(false); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg">&#8250;</button>
            )}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); setImgError(false); setVidError(false); }}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white scale-125' : 'bg-white/50'}`} />
              ))}
            </div>
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
              {idx + 1}/{images.length}
            </div>
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center gap-3"
          onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center text-2xl z-10"
            style={{ marginTop: 'env(safe-area-inset-top)' }}
            onClick={() => setLightbox(false)}>&times;</button>

          {currentIsVideo ? (
            <div className="flex flex-col items-center gap-3 max-w-[95vw]" onClick={e => e.stopPropagation()}>
              <video
                src={lightboxSrc}
                className="max-w-[95vw] max-h-[75vh] rounded-lg"
                controls
                autoPlay
                playsInline
              />
              <a href={toDriveOpenUrl(rawUrl)} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-white/70 text-xs underline">
                Not playing? Open in Drive
              </a>
            </div>
          ) : (
            <img
              src={lightboxSrc}
              alt={`Photo ${idx + 1}`}
              className="max-w-[95vw] max-h-[80vh] object-contain rounded-lg"
              referrerPolicy="no-referrer"
              onClick={e => e.stopPropagation()}
            />
          )}

          {/* Download */}
          <a
            href={downloadSrc}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-xl transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </a>

          {images.length > 1 && (
            <>
              {idx > 0 && (
                <button onClick={e => { e.stopPropagation(); setIdx(i => i - 1); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center text-2xl">&#8249;</button>
              )}
              {idx < images.length - 1 && (
                <button onClick={e => { e.stopPropagation(); setIdx(i => i + 1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center text-2xl">&#8250;</button>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

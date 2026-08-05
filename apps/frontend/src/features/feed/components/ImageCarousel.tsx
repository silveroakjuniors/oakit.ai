'use client';
import { useState } from 'react';

// Extract Google Drive file ID from any URL format we store
function getDriveFileId(url: string): string | null {
  if (!url) return null;
  // gdrive:FILE_ID (old scheme)
  if (url.startsWith('gdrive:')) return url.slice(7);
  // /d/FILE_ID or file/d/FILE_ID
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m1) return m1[1];
  // ?id=FILE_ID or &id=FILE_ID
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (m2) return m2[1];
  // drive-proxy?id=FILE_ID
  const m3 = url.match(/drive-proxy\?id=([a-zA-Z0-9_-]{10,})/);
  if (m3) return m3[1];
  return null;
}

function isDriveUrl(url: string): boolean {
  return url.startsWith('gdrive:') ||
    url.includes('drive.google.com') ||
    url.includes('drive-proxy');
}

function isVideoUrl(url: string, mediaType?: string): boolean {
  if (mediaType === 'video') return true;
  const lower = url.toLowerCase();
  return lower.includes('.mp4') || lower.includes('.mov') || lower.includes('.webm') ||
    lower.includes('.3gp');
}

// Build the best displayable URL for the given stored URL
function toDisplayUrl(url: string): string {
  if (!url) return url;
  // Signed proxy URL (new) — prepend API_BASE
  if (url.startsWith('/api/v1/drive-proxy')) return `${API_BASE}${url}`;
  if (url.includes('/api/v1/drive-proxy')) return url;
  // gdrive:FILE_ID (old) — we can't sign it client-side, use thumbnail for images
  if (url.startsWith('gdrive:')) {
    const fileId = url.slice(7);
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
  }
  // Legacy Drive URL
  const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]{20,})/) || url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (idMatch) return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`;
  return url;
}

function toVideoPreviewUrl(url: string): string {
  if (!url) return url;
  // Signed proxy URL — use as-is (it streams the video directly)
  if (url.startsWith('/api/v1/drive-proxy')) return `${API_BASE}${url}`;
  if (url.includes('/api/v1/drive-proxy')) return url;
  // gdrive: or Drive URL — use iframe preview
  const idMatch =
    url.startsWith('gdrive:') ? [null, url.slice(7)] :
    url.match(/\/d\/([a-zA-Z0-9_-]{20,})/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  return url;
}

function toDownloadUrl(url: string): string {
  const idMatch =
    url.startsWith('gdrive:') ? [null, url.slice(7)] :
    url.match(/drive-proxy\?id=([a-zA-Z0-9_-]{10,})/) ||
    url.match(/\/d\/([a-zA-Z0-9_-]{20,})/) ||
    url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (idMatch) return `https://drive.google.com/uc?export=download&id=${idMatch[1]}&confirm=t`;
  return url;
}

export default function ImageCarousel({ images, mediaTypes }: {
  images: string[];
  mediaTypes?: string[];
}) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (images.length === 0) return null;

  const rawUrl = images[idx];
  const mediaType = mediaTypes?.[idx];
  const currentIsVideo = isVideoUrl(rawUrl, mediaType);

  const previewSrc = currentIsVideo ? toVideoPreviewUrl(rawUrl) : toDisplayUrl(rawUrl);
  const lightboxSrc = currentIsVideo ? toVideoPreviewUrl(rawUrl) : toDisplayUrl(rawUrl);
  const downloadSrc = toDownloadUrl(rawUrl);

  return (
    <>
      <div
        className="relative w-full bg-neutral-100 cursor-pointer"
        style={{ aspectRatio: '4/3' }}
        onClick={() => setLightbox(true)}
      >
        {currentIsVideo ? (
          // Video — show iframe preview with play overlay
          <div className="relative w-full h-full bg-black">
            <iframe
              src={previewSrc}
              className="w-full h-full"
              allow="autoplay"
              allowFullScreen
              style={{ border: 'none' }}
            />
            <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 pointer-events-none">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Video
            </div>
          </div>
        ) : (
          <img
            src={previewSrc}
            alt={`Photo ${idx + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}

        {/* Navigation for multi-media */}
        {images.length > 1 && (
          <>
            {idx > 0 && (
              <button onClick={e => { e.stopPropagation(); setIdx(i => i - 1); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg">&#8249;</button>
            )}
            {idx < images.length - 1 && (
              <button onClick={e => { e.stopPropagation(); setIdx(i => i + 1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg">&#8250;</button>
            )}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
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
            <iframe
              src={lightboxSrc}
              className="max-w-[95vw] rounded-lg"
              style={{ width: '95vw', height: '60vh', border: 'none' }}
              allow="autoplay"
              allowFullScreen
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            />
          ) : (
            <img
              src={lightboxSrc}
              alt={`Photo ${idx + 1}`}
              className="max-w-[95vw] max-h-[80vh] object-contain rounded-lg"
              referrerPolicy="no-referrer"
              onClick={e => e.stopPropagation()}
            />
          )}

          {/* Download button */}
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

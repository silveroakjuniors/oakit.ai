'use client';
import { useState } from 'react';

// Detect if a URL is a video
function isVideoUrl(url: string, mediaType?: string): boolean {
  if (mediaType === 'video') return true;
  const lower = url.toLowerCase();
  return lower.includes('.mp4') || lower.includes('.mov') || lower.includes('.webm') ||
    lower.includes('.3gp') || lower.includes('export=download');
}

// Convert any Drive URL to a publicly embeddable URL
// Files are made public (anyone reader) on upload, so no auth needed
function toDisplayUrl(url: string, isVideo: boolean): string {
  if (!url) return url;

  // Already an lh3 URL (images) — use as-is
  if (url.includes('lh3.googleusercontent.com')) return url;

  // Already an export=download URL (videos) — use as-is
  if (url.includes('export=download')) return url;

  // Extract Drive file ID from any Drive URL format
  const idMatch =
    url.match(/\/d\/([a-zA-Z0-9_-]{20,})/) ||          // /d/FILE_ID
    url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/) ||        // ?id= or &id=
    url.match(/drive-proxy\?id=([a-zA-Z0-9_-]{10,})/); // proxy URL

  if (idMatch) {
    const fileId = idMatch[1];
    return isVideo
      ? `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`
      : `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // Supabase or other URL — use as-is
  return url;
}

export default function ImageCarousel({ images, mediaTypes }: {
  images: string[];
  mediaTypes?: string[];
}) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (images.length === 0) return null;

  const currentMediaType = mediaTypes?.[idx];
  const currentIsVideo = isVideoUrl(images[idx], currentMediaType);
  const currentSrc = toDisplayUrl(images[idx], currentIsVideo);

  return (
    <>
      <div
        className="relative w-full bg-black cursor-pointer"
        style={{ aspectRatio: '4/3' }}
        onClick={() => setLightbox(true)}
      >
        {currentIsVideo ? (
          <div className="relative w-full h-full bg-black">
            <video
              src={currentSrc}
              className="w-full h-full object-cover"
              playsInline
              preload="metadata"
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <polygon points="8 5 19 12 8 19 8 5" />
                </svg>
              </div>
            </div>
            <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Video
            </div>
          </div>
        ) : (
          <img
            src={currentSrc}
            alt={`Photo ${idx + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}

        {/* Navigation dots and arrows for multi-media */}
        {images.length > 1 && (
          <>
            {idx > 0 && (
              <button
                onClick={e => { e.stopPropagation(); setIdx(i => i - 1); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg"
              >&#8249;</button>
            )}
            {idx < images.length - 1 && (
              <button
                onClick={e => { e.stopPropagation(); setIdx(i => i + 1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg"
              >&#8250;</button>
            )}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setIdx(i); }}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white scale-125' : 'bg-white/50'}`}
                />
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
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center text-2xl z-10"
            style={{ marginTop: 'env(safe-area-inset-top)' }}
            onClick={() => setLightbox(false)}
          >&times;</button>

          {currentIsVideo ? (
            <video
              src={currentSrc}
              className="max-w-[95vw] max-h-[85vh] rounded-lg"
              controls
              autoPlay
              playsInline
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <img
              src={currentSrc}
              alt={`Photo ${idx + 1}`}
              className="max-w-[95vw] max-h-[85vh] object-contain rounded-lg"
              referrerPolicy="no-referrer"
              onClick={e => e.stopPropagation()}
            />
          )}

          {images.length > 1 && (
            <>
              {idx > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); setIdx(i => i - 1); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center text-2xl"
                >&#8249;</button>
              )}
              {idx < images.length - 1 && (
                <button
                  onClick={e => { e.stopPropagation(); setIdx(i => i + 1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center text-2xl"
                >&#8250;</button>
              )}
              <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={e => { e.stopPropagation(); setIdx(i); }}
                    className={`w-2 h-2 rounded-full transition-all ${i === idx ? 'bg-white scale-125' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

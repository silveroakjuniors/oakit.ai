'use client';
import { useState } from 'react';

function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('.mp4') || lower.includes('.mov') || lower.includes('.webm') || lower.includes('.3gp') || lower.includes('video');
}

export default function ImageCarousel({ images, mediaTypes }: { images: string[]; mediaTypes?: string[] }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return null;

  const currentIsVideo = mediaTypes?.[idx] === 'video' || isVideoUrl(images[idx]);

  return (
    <div className="relative w-full bg-black" style={{ aspectRatio: '4/3' }}>
      {/* Main media */}
      {currentIsVideo ? (
        <video
          src={images[idx]}
          className="w-full h-full object-cover"
          controls
          playsInline
          preload="metadata"
        />
      ) : (
        <img
          src={images[idx]}
          alt={`Photo ${idx + 1}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}

      {/* Multi-media nav */}
      {images.length > 1 && (
        <>
          {idx > 0 && (
            <button
              onClick={() => setIdx(i => i - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg"
            >&#8249;</button>
          )}
          {idx < images.length - 1 && (
            <button
              onClick={() => setIdx(i => i + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg"
            >&#8250;</button>
          )}
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white scale-125' : 'bg-white/50'}`}
              />
            ))}
          </div>
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
            {idx + 1}/{images.length}
          </div>
        </>
      )}

      {/* Video indicator */}
      {currentIsVideo && (
        <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Video
        </div>
      )}
    </div>
  );
}

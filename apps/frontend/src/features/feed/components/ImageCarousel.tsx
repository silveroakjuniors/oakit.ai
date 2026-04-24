'use client';
import { useState } from 'react';

export default function ImageCarousel({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return null;

  return (
    <div className="relative w-full bg-black" style={{ aspectRatio: '4/3' }}>
      {/* Main image */}
      <img
        src={images[idx]}
        alt={`Photo ${idx + 1}`}
        className="w-full h-full object-cover"
        loading="lazy"
      />

      {/* Multi-image nav */}
      {images.length > 1 && (
        <>
          {/* Prev */}
          {idx > 0 && (
            <button
              onClick={() => setIdx(i => i - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg"
            >‹</button>
          )}
          {/* Next */}
          {idx < images.length - 1 && (
            <button
              onClick={() => setIdx(i => i + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg"
            >›</button>
          )}
          {/* Dots */}
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white scale-125' : 'bg-white/50'}`}
              />
            ))}
          </div>
          {/* Counter */}
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
            {idx + 1}/{images.length}
          </div>
        </>
      )}
    </div>
  );
}

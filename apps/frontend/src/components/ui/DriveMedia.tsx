'use client';

/**
 * DriveMedia — renders Google Drive proxy images and videos as blob: URLs.
 *
 * <img src="http://localhost:3001/api/v1/drive-proxy?..."> fails in Next.js
 * because:
 *   1. CSP img-src allows "https:" but not "http://localhost:3001"
 *   2. Next.js <Image> requires a configured domain
 *
 * Solution: fetch the bytes with the user's JWT (or HMAC sig), create a
 * blob: URL, set that as src. Blob URLs are always same-origin so CSP allows them.
 */

import { useEffect, useState, useRef } from 'react';
import { getToken } from '@/lib/auth';
import { getApiBase } from '@/lib/api';
import { Loader2, ImageOff, Film } from 'lucide-react';

interface Props {
  /** Relative or absolute drive-proxy URL, e.g. /api/v1/drive-proxy?id=...&school=...&sig=... */
  src: string;
  className?: string;
  /** 'image' (default) or 'video' */
  mediaType?: 'image' | 'video';
  alt?: string;
}

export function DriveMedia({ src, className = '', mediaType = 'image', alt = '' }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError]     = useState(false);
  const [loading, setLoading] = useState(true);
  const prevBlobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!src) { setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    setError(false);
    setBlobUrl(null);

    const fullUrl = src.startsWith('/') ? `${getApiBase()}${src}` : src;
    const token = getToken();

    fetch(fullUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.blob();
      })
      .then(blob => {
        if (cancelled) return;
        // Revoke previous blob to avoid memory leaks
        if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current);
        const url = URL.createObjectURL(blob);
        prevBlobRef.current = url;
        setBlobUrl(url);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setError(true); setLoading(false); }
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  // Cleanup blob on unmount
  useEffect(() => {
    return () => {
      if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current);
    };
  }, []);

  if (loading) return (
    <div className={`flex items-center justify-center bg-neutral-100 ${className}`}>
      <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
    </div>
  );

  if (error || !blobUrl) return (
    <div className={`flex items-center justify-center bg-neutral-100 ${className}`}>
      {mediaType === 'video'
        ? <Film className="w-6 h-6 text-neutral-300" />
        : <ImageOff className="w-5 h-5 text-neutral-300" />}
    </div>
  );

  if (mediaType === 'video') return (
    <video src={blobUrl} controls preload="metadata" className={className} />
  );

  return <img src={blobUrl} alt={alt} className={className} />;
}

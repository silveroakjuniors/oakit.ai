'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, Send, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import Link from 'next/link';
import type { FeedPost, FeedResponse } from '@/features/feed/types';

// ── Mini image carousel ───────────────────────────────────────────────────────
function MiniCarousel({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  if (!images.length) return null;
  return (
    <div className="relative bg-neutral-100 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
      <img src={images[idx]} alt="" className="w-full h-full object-cover" loading="lazy" />
      {images.length > 1 && (
        <>
          {idx > 0 && (
            <button onClick={() => setIdx(i => i - 1)}
              className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center">
              <ChevronLeft size={12} />
            </button>
          )}
          {idx < images.length - 1 && (
            <button onClick={() => setIdx(i => i + 1)}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center">
              <ChevronRight size={12} />
            </button>
          )}
          <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1">
            {images.map((_, i) => (
              <div key={i} className={`w-1 h-1 rounded-full ${i === idx ? 'bg-white' : 'bg-white/40'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Upload modal ──────────────────────────────────────────────────────────────
function UploadModal({ token, onClose, onPosted }: { token: string; onClose: () => void; onPosted: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fl: FileList | null) {
    if (!fl) return;
    const valid = Array.from(fl).filter(f => f.type.startsWith('image/')).slice(0, 10);
    const combined = [...files, ...valid].slice(0, 10);
    setFiles(combined);
    setPreviews(combined.map(f => URL.createObjectURL(f)));
  }

  async function submit() {
    if (!files.length) { setError('Pick at least one photo'); return; }
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('images', f));
      if (caption.trim()) fd.append('caption', caption.trim());
      // Principal posts school-wide — no section_id needed
      const res = await fetch(`${API_BASE}/api/v1/feed/posts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onPosted(); onClose();
    } catch (e: any) { setError(e.message || 'Upload failed'); }
    finally { setUploading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
          <p className="text-sm font-semibold text-neutral-800">📸 Post to School Feed</p>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-neutral-100">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button onClick={() => { const n = files.filter((_, j) => j !== i); setFiles(n); setPreviews(n.map(f => URL.createObjectURL(f))); }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center">×</button>
              </div>
            ))}
            {files.length < 10 && (
              <button onClick={() => inputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center gap-1 text-neutral-400 hover:border-[#1B4332] hover:text-[#1B4332] transition-colors">
                <Camera size={16} />
                <span className="text-[9px]">Add</span>
              </button>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          <textarea value={caption} onChange={e => setCaption(e.target.value.slice(0, 500))}
            placeholder="Caption for the school… (optional)"
            rows={2} className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:border-[#1B4332]" />
          <p className="text-[9px] text-neutral-400 text-right -mt-1">{caption.length}/500</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button onClick={submit} disabled={uploading || !files.length}
            className="w-full py-2.5 bg-[#1B4332] hover:bg-[#2d6a4f] text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50">
            {uploading ? 'Posting…' : `Share to School (${files.length} photo${files.length !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Feed card ─────────────────────────────────────────────────────────────────
function FeedItem({ post, token, onDelete }: { post: FeedPost; token: string; onDelete: (id: string) => void }) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [count, setCount] = useState(post.like_count);

  const timeAgo = (() => {
    const diff = Date.now() - new Date(post.created_at).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  })();

  async function handleLike() {
    const prev = liked;
    setLiked(!liked); setCount(c => liked ? c - 1 : c + 1);
    try {
      const res = await fetch(`${API_BASE}/api/v1/feed/posts/${post.id}/like`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setLiked(data.liked_by_me); setCount(data.like_count);
    } catch { setLiked(prev); setCount(c => liked ? c + 1 : c - 1); }
  }

  const scopeLabel = post.post_scope === 'school' ? '🏫 School-wide' : post.section_label ? `📚 ${post.section_label}` : '';

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="w-8 h-8 rounded-full bg-[#1B4332]/10 flex items-center justify-center text-sm shrink-0">
          {post.poster_role === 'principal' ? '🎓' : post.poster_role === 'admin' ? '🏫' : '👩‍🏫'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-neutral-800 truncate">{post.poster_name}</p>
          <p className="text-[10px] text-neutral-400">{scopeLabel} · {timeAgo}</p>
        </div>
        <button onClick={() => { if (confirm('Delete this post?')) onDelete(post.id); }}
          className="text-[10px] text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors">
          Delete
        </button>
      </div>
      <MiniCarousel images={post.images} />
      <div className="flex items-center gap-3 px-3 py-2">
        <button onClick={handleLike}
          className={`flex items-center gap-1 text-xs transition-all ${liked ? 'text-red-500' : 'text-neutral-400 hover:text-red-400'}`}>
          <span className={`text-base transition-transform ${liked ? 'scale-125' : ''}`}>{liked ? '❤️' : '🤍'}</span>
          {count > 0 && <span className="font-medium">{count}</span>}
        </button>
      </div>
      {post.caption && (
        <div className="px-3 pb-3">
          <p className="text-xs text-neutral-700 leading-relaxed">
            <span className="font-semibold">{post.poster_name.split(' ')[0]} </span>
            {post.caption}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
interface Props { token: string; maxPosts?: number; }

export default function SchoolFeedPanel({ token, maxPosts }: Props) {
  const [posts, setPosts]         = useState<FeedPost[]>([]);
  const [cursor, setCursor]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setMore]    = useState(false);
  const [showUpload, setUpload]   = useState(false);
  const [filter, setFilter]       = useState<'all' | 'school' | 'section'>('all');

  const loadFeed = useCallback(async (nextCursor?: string) => {
    const isFirst = !nextCursor;
    if (isFirst) setLoading(true); else setMore(true);
    try {
      const url = `${API_BASE}/api/v1/feed${nextCursor ? `?cursor=${nextCursor}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data: FeedResponse = await res.json();
      if (isFirst) setPosts(data.posts || []);
      else setPosts(p => [...p, ...(data.posts || [])]);
      setCursor(data.next_cursor);
    } catch { /* silent */ }
    finally { if (isFirst) setLoading(false); else setMore(false); }
  }, [token]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  async function handleDelete(id: string) {
    await fetch(`${API_BASE}/api/v1/feed/posts/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    setPosts(ps => ps.filter(p => p.id !== id));
  }

  const filtered = filter === 'all' ? posts
    : posts.filter(p => filter === 'school' ? p.post_scope === 'school' : p.post_scope === 'section');

  // If maxPosts set, cap the display and show "View all" link
  const displayPosts = maxPosts ? filtered.slice(0, maxPosts) : filtered;
  // Show "View all" if: we're capped AND (there are more loaded posts OR server has more)
  const hasMore = maxPosts && (filtered.length > maxPosts || cursor !== null);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">School Feed</p>
          <p className="text-[10px] text-neutral-400 mt-0.5">All classes · post school-wide moments</p>
        </div>
        <button onClick={() => setUpload(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B4332] text-white text-xs font-semibold rounded-xl hover:bg-[#2d6a4f] transition-colors">
          <Camera size={12} />
          Post
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-neutral-100 rounded-xl p-0.5 w-fit">
        {(['all', 'school', 'section'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-[10px] font-semibold transition-all capitalize ${
              filter === f ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-500'
            }`}>
            {f === 'all' ? '🌐 All' : f === 'school' ? '🏫 School' : '📚 Classes'}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-neutral-100 animate-pulse">
              <div className="h-10 bg-neutral-100 m-3 rounded-xl" />
              <div className="bg-neutral-200 mx-3 rounded-xl" style={{ aspectRatio: '16/9' }} />
              <div className="h-8 bg-neutral-100 m-3 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-100 p-8 text-center">
          <p className="text-3xl mb-2">📸</p>
          <p className="text-sm font-semibold text-neutral-600">No posts yet</p>
          <p className="text-xs text-neutral-400 mt-1">Share school moments with parents and staff</p>
          <button onClick={() => setUpload(true)}
            className="mt-3 px-4 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-xl">
            Post First Photo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {displayPosts.map(post => (
            <FeedItem key={post.id} post={post} token={token} onDelete={handleDelete} />
          ))}
          {hasMore && (
            <Link href="/principal/feed"
              className="block w-full py-2.5 text-center text-xs font-semibold text-[#1B4332] hover:bg-[#1B4332]/5 rounded-xl transition-colors border border-[#1B4332]/20">
              {filtered.length > maxPosts! ? `View all ${filtered.length} posts →` : 'View all posts →'}
            </Link>
          )}
          {!maxPosts && cursor && (
            <button onClick={() => loadFeed(cursor)} disabled={loadingMore}
              className="w-full py-2.5 text-xs text-[#1B4332] font-medium hover:bg-[#1B4332]/5 rounded-xl transition-colors disabled:opacity-50">
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}

      {showUpload && (
        <UploadModal token={token} onClose={() => setUpload(false)} onPosted={() => loadFeed()} />
      )}
    </div>
  );
}

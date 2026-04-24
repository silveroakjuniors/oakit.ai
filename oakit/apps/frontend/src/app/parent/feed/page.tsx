'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { API_BASE } from '@/lib/api';
import FeedCard from '@/features/feed/components/FeedCard';
import type { FeedPost, FeedResponse } from '@/features/feed/types';

export default function ParentFeedPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFeed = useCallback(async (nextCursor?: string) => {
    const isFirst = !nextCursor;
    if (isFirst) setLoading(true); else setLoadingMore(true);
    try {
      const url = `${API_BASE}/api/v1/feed${nextCursor ? `?cursor=${nextCursor}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data: FeedResponse = await res.json();
      if (isFirst) setPosts(data.posts || []);
      else setPosts(p => [...p, ...(data.posts || [])]);
      setCursor(data.next_cursor);
    } catch (e) { console.error(e); }
    finally { if (isFirst) setLoading(false); else setLoadingMore(false); }
  }, [token]);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    loadFeed();
  }, [token, router, loadFeed]);

  async function handleLike(postId: string) {
    const res = await fetch(`${API_BASE}/api/v1/feed/posts/${postId}/like`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setPosts(ps => ps.map(p => p.id === postId
      ? { ...p, like_count: data.like_count, liked_by_me: data.liked_by_me } : p));
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-neutral-400 hover:text-neutral-600 text-xl">‹</button>
        <p className="text-sm font-semibold text-neutral-800">📸 Class Memories</p>
      </div>

      {/* Feed */}
      <div className="max-w-md mx-auto px-4 py-4 flex flex-col gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-neutral-100 animate-pulse">
              <div className="h-12 bg-neutral-100" />
              <div className="bg-neutral-200" style={{ aspectRatio: '4/3' }} />
              <div className="h-10 bg-neutral-100" />
            </div>
          ))
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📸</p>
            <p className="text-sm font-semibold text-neutral-600">No memories yet</p>
            <p className="text-xs text-neutral-400 mt-1">Your child's teacher will post class moments here</p>
          </div>
        ) : (
          <>
            {posts.map(post => (
              <FeedCard key={post.id} post={post} onLike={handleLike} />
            ))}
            {cursor && (
              <button
                onClick={() => loadFeed(cursor)}
                disabled={loadingMore}
                className="w-full py-3 text-sm text-primary-600 font-medium hover:bg-primary-50 rounded-xl transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { API_BASE } from '@/lib/api';
import FeedCard from '@/features/feed/components/FeedCard';
import UploadModal from '@/features/feed/components/UploadModal';
import type { FeedPost, FeedResponse } from '@/features/feed/types';

export default function TeacherFeedPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [sectionId, setSectionId] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');

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
    // Get section id from context — endpoint returns array with section_id field
    fetch(`${API_BASE}/api/v1/teacher/sections`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        const list = Array.isArray(d) ? d : d.sections || [];
        if (list[0]?.section_id) setSectionId(list[0].section_id);
        else if (list[0]?.id) setSectionId(list[0].id);
      }).catch(() => {});
    // Get school instagram handle
    fetch(`${API_BASE}/api/v1/public/school-info`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d?.instagram_handle) setInstagramHandle(d.instagram_handle); })
      .catch(() => {});
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

  async function handleDelete(postId: string) {
    if (!confirm('Delete this post?')) return;
    await fetch(`${API_BASE}/api/v1/feed/posts/${postId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    setPosts(ps => ps.filter(p => p.id !== postId));
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center justify-between"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-neutral-400 hover:text-neutral-600 text-xl">&#8249;</button>
          <p className="text-sm font-semibold text-neutral-800">Class Feed</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-xl hover:bg-primary-700 transition-colors"
        >
          + Post
        </button>
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
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-neutral-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            </div>
            <p className="text-sm font-semibold text-neutral-600">No posts yet</p>
            <p className="text-xs text-neutral-400 mt-1">Share today&apos;s class moments with parents</p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-4 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl"
            >
              Post First Photo
            </button>
          </div>
        ) : (
          <>
            {posts.map(post => (
              <FeedCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onDelete={handleDelete}
                canDelete={true}
                instagramHandle={instagramHandle}
              />
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

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          token={token}
          sectionId={sectionId}
          onClose={() => setShowUpload(false)}
          onPosted={() => loadFeed()}
        />
      )}
    </div>
  );
}

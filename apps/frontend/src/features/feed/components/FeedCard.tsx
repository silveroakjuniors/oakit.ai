'use client';
import { useState } from 'react';
import ImageCarousel from './ImageCarousel';
import type { FeedPost } from '../types';

interface FeedCardProps {
  post: FeedPost;
  onLike: (id: string) => void;
  onDelete?: (id: string) => void;
  schoolName?: string;
  canDelete?: boolean;
}

export default function FeedCard({ post, onLike, onDelete, schoolName, canDelete }: FeedCardProps) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [liking, setLiking] = useState(false);

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
    if (liking) return;
    setLiking(true);
    setLiked(l => !l);
    setLikeCount(c => liked ? c - 1 : c + 1);
    try { await onLike(post.id); } catch { setLiked(l => !l); setLikeCount(c => liked ? c + 1 : c - 1); }
    finally { setLiking(false); }
  }

  function handleShare() {
    const text = `Today's moments from ${schoolName || 'school'} ❤️`;
    if (navigator.share && post.images[0]) {
      navigator.share({ text, url: post.images[0] }).catch(() => {});
    } else {
      const wa = `https://wa.me/?text=${encodeURIComponent(text + ' ' + (post.images[0] || ''))}`;
      window.open(wa, '_blank');
    }
  }

  const roleLabel = post.poster_role === 'teacher' ? '👩‍🏫' : post.poster_role === 'admin' ? '🏫' : '🎓';
  const scopeLabel = post.post_scope === 'school' ? '🏫 School' : post.section_label ? `📚 ${post.section_label}` : '';

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-neutral-100">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-lg shrink-0">
          {roleLabel}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-800 truncate">{post.poster_name}</p>
          <p className="text-xs text-neutral-400">{scopeLabel} · {timeAgo}</p>
        </div>
        {canDelete && onDelete && (
          <button
            onClick={() => onDelete(post.id)}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {/* Images */}
      <ImageCarousel images={post.images} />

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-3">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-sm font-medium transition-all ${liked ? 'text-red-500' : 'text-neutral-400 hover:text-red-400'}`}
        >
          <span className={`text-xl transition-transform ${liked ? 'scale-125' : 'scale-100'}`} style={{ transition: 'transform 0.15s' }}>
            {liked ? '❤️' : '🤍'}
          </span>
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary-500 transition-colors"
        >
          <span className="text-lg">📤</span>
        </button>
      </div>

      {/* Caption */}
      {post.caption && (
        <div className="px-4 pb-4">
          <p className="text-sm text-neutral-700 leading-relaxed">
            <span className="font-semibold text-neutral-800">{post.poster_name.split(' ')[0]} </span>
            {post.caption}
          </p>
        </div>
      )}
    </div>
  );
}

'use client';
import { useState } from 'react';
import { apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import ImageCarousel from './ImageCarousel';
import type { FeedPost } from '../types';

interface FeedCardProps {
  post: FeedPost;
  onLike: (id: string) => void;
  onDelete?: (id: string) => void;
  schoolName?: string;
  instagramHandle?: string;
  canDelete?: boolean;
}

export default function FeedCard({ post, onLike, onDelete, schoolName, instagramHandle, canDelete }: FeedCardProps) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [liking, setLiking] = useState(false);
  const [igCount, setIgCount] = useState((post as any).instagram_shares || 0);
  const [fbCount, setFbCount] = useState((post as any).facebook_shares || 0);
  const [dlCount, setDlCount] = useState((post as any).downloads || 0);

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

  async function trackEngagement(action: 'instagram_share' | 'facebook_share' | 'download') {
    const token = getToken() || '';
    try {
      const res = await apiPost<{ instagram_share: number; facebook_share: number; download: number }>(
        `/api/v1/feed/posts/${post.id}/engage`, { action }, token
      );
      setIgCount(res.instagram_share || 0);
      setFbCount(res.facebook_share || 0);
      setDlCount(res.download || 0);
    } catch { /* non-critical */ }
  }

  function shareToInstagram() {
    trackEngagement('instagram_share');
    const tag = instagramHandle ? `@${instagramHandle}` : '';
    const hashtags = '#fyp #preschool #kindergarten #earlylearning #schoollife #kidsofinstagram #playandlearn #preschoolactivities #toddlerlife #montessori #learningthroughplay #silveroakjuniors';
    const caption = [post.caption, tag, hashtags].filter(Boolean).join('\n\n');
    if (caption) navigator.clipboard?.writeText(caption).catch(() => {});

    if (navigator.share && post.images?.[0]) {
      navigator.share({ title: post.caption || 'School moment', text: caption, url: post.images[0] })
        .catch(() => { window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer'); });
      return;
    }
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    if (caption) alert(`Caption copied to clipboard:\n\n${caption}\n\nPaste it when creating your Instagram post.`);
  }

  function shareToFacebook() {
    trackEngagement('facebook_share');
    const tag = instagramHandle ? `@${instagramHandle}` : '';
    const caption = [post.caption, tag].filter(Boolean).join(' ');
    const shareUrl = post.images?.[0] || window.location.href;
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(caption)}`;
    window.open(fbUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
  }

  async function downloadImage() {
    trackEngagement('download');
    const img = post.images?.[0];
    if (!img) return;
    try {
      const response = await fetch(img);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `school-memory-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { window.open(img, '_blank'); }
  }

  const roleLabel = post.poster_role === 'teacher' ? '\uD83D\uDC69\u200D\uD83C\uDFEB' : post.poster_role === 'admin' ? '\uD83C\uDFEB' : '\uD83C\uDF93';
  const scopeLabel = post.post_scope === 'school' ? 'School' : post.section_label ? `${post.section_label}` : '';

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
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Like */}
        <button
          onClick={handleLike}
          className={`flex items-center gap-1 text-sm font-medium transition-all ${liked ? 'text-red-500' : 'text-neutral-400 hover:text-red-400'}`}
        >
          <span className={`text-lg transition-transform ${liked ? 'scale-125' : 'scale-100'}`} style={{ transition: 'transform 0.15s' }}>
            {liked ? '\u2764\uFE0F' : '\uD83E\uDD0D'}
          </span>
          {likeCount > 0 && <span className="text-xs">{likeCount}</span>}
        </button>

        {/* Instagram */}
        <button onClick={shareToInstagram} title={instagramHandle ? `Share & tag @${instagramHandle}` : 'Share to Instagram'}
          className="flex items-center gap-0.5 text-neutral-400 hover:text-pink-500 transition-colors">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white active:scale-95 transition-all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </span>
          {igCount > 0 && <span className="text-[10px] text-neutral-500">{igCount}</span>}
        </button>

        {/* Facebook */}
        <button onClick={shareToFacebook} title="Share to Facebook"
          className="flex items-center gap-0.5 text-neutral-400 hover:text-blue-500 transition-colors">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#1877F2] text-white active:scale-95 transition-all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </span>
          {fbCount > 0 && <span className="text-[10px] text-neutral-500">{fbCount}</span>}
        </button>

        {/* Download */}
        <button onClick={downloadImage} title="Download image"
          className="flex items-center gap-0.5 text-neutral-400 hover:text-neutral-600 transition-colors">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 active:scale-95 transition-all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </span>
          {dlCount > 0 && <span className="text-[10px] text-neutral-500">{dlCount}</span>}
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

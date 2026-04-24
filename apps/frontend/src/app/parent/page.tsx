'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Calendar, TrendingUp, Sparkles, MessageSquare, Bell,
  LogOut, Settings, BarChart3, Loader2, MoreHorizontal,
  ClipboardList, FileText, CreditCard, ChevronDown, User,
} from 'lucide-react';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';

// ─── Decode parent name from JWT ──────────────────────────────────────────────
function getParentNameFromToken(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.name || payload.full_name || payload.username || '';
  } catch { return ''; }
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ─── Feature imports ──────────────────────────────────────────────────────────
import { TranslationContext, translations, defaultChat } from '@/features/parent/context';
import type {
  Child, ChildCache, ChildFeed, AttendanceData, ProgressData,
  Notification, Announcement, ParentMessage, ChatMsg,
  EmergencyContact, NotificationPreference, CalendarEvent,
  ParentInsights, ChildComparison, TranslationSettings, Tab,
} from '@/features/parent/types';

import ChildAvatar from '@/features/parent/components/ChildAvatar';
import NoteModal from '@/features/parent/components/NoteModal';
import HomeTab from '@/features/parent/components/HomeTab';
import AttendanceTab from '@/features/parent/components/AttendanceTab';
import ProgressTab from '@/features/parent/components/ProgressTab';
import InsightsTab from '@/features/parent/components/InsightsTab';
import ChatTab from '@/features/parent/components/ChatTab';
import MessagesTab from '@/features/parent/components/MessagesTab';
import NotificationsTab from '@/features/parent/components/NotificationsTab';
import SettingsTab from '@/features/parent/components/SettingsTab';
import PremiumWelcomeModal from '@/features/parent/components/PremiumWelcomeModal';
import ReportsTab from '@/features/parent/components/ReportsTab';
import FeesTab from '@/features/parent/components/FeesTab';
import type { NoteItem } from '@/features/parent/types';

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS: { id: Tab; Icon: React.ElementType; label: string }[] = [
  { id: 'home',          Icon: Home,           label: 'Home' },
  { id: 'attendance',    Icon: Calendar,       label: 'Attendance' },
  { id: 'progress',      Icon: TrendingUp,     label: 'Progress' },
  { id: 'insights',      Icon: BarChart3,      label: 'Insights' },
  { id: 'chat',          Icon: Sparkles,       label: 'Oakie' },
  { id: 'messages',      Icon: MessageSquare,  label: 'Messages' },
  { id: 'notifications', Icon: Bell,           label: 'Updates' },
  { id: 'fees',          Icon: CreditCard,     label: 'Fees' },
  { id: 'reports',       Icon: FileText,       label: 'Reports' },
  { id: 'settings',      Icon: Settings,       label: 'Settings' },
];

// Mobile nav — 5 primary tabs + "More" drawer
const MOBILE_PRIMARY_TABS: { id: Tab; Icon: React.ElementType; label: string }[] = [
  { id: 'home',       Icon: Home,          label: 'Home'     },
  { id: 'attendance', Icon: Calendar,      label: 'Attend'   },
  { id: 'progress',   Icon: TrendingUp,    label: 'Progress' },
  { id: 'chat',       Icon: Sparkles,      label: 'Oakie'    },
  { id: 'messages',   Icon: MessageSquare, label: 'Messages' },
];

const DEFAULT_NOTIF_PREFS: NotificationPreference[] = [
  { type: 'homework',      enabled: true,  channels: ['push', 'email'], quietHours: { start: '22:00', end: '07:00' }, frequency: 'immediate' },
  { type: 'attendance',    enabled: true,  channels: ['push'],          quietHours: null,                             frequency: 'daily'     },
  { type: 'progress',      enabled: true,  channels: ['email'],         quietHours: null,                             frequency: 'weekly'    },
  { type: 'messages',      enabled: true,  channels: ['push', 'sms'],   quietHours: { start: '22:00', end: '07:00' }, frequency: 'immediate' },
  { type: 'announcements', enabled: false, channels: ['email'],         quietHours: null,                             frequency: 'weekly'    },
];

// ─── Photo feed mock data ─────────────────────────────────────────────────────
// (removed — feed column now fetches live from /api/v1/feed)

// ─── Live Class Feed column ───────────────────────────────────────────────────
import type { FeedPost } from '@/features/feed/types';
import { API_BASE } from '@/lib/api';
import { createPortal } from 'react-dom';

// ── Lightbox — rendered via portal so overflow:hidden parents don't clip it ──
function FeedLightbox({ post, onClose, onLike }: { post: FeedPost; onClose: () => void; onLike: (id: string) => void }) {
  const [imgIdx, setImgIdx] = React.useState(0);
  const [liked, setLiked] = React.useState(post.liked_by_me);
  const [likeCount, setLikeCount] = React.useState(post.like_count);
  const [liking, setLiking] = React.useState(false);

  async function handleLike() {
    if (liking) return;
    setLiking(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);
    try { await onLike(post.id); } catch { setLiked(wasLiked); setLikeCount(c => wasLiked ? c + 1 : c - 1); }
    finally { setLiking(false); }
  }

  function handleShare() {
    const text = `Class moment from school ❤️`;
    if (navigator.share && post.images[imgIdx]) {
      navigator.share({ text, url: post.images[imgIdx] }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + (post.images[imgIdx] || ''))}`, '_blank');
    }
  }

  // Close on backdrop click
  function onBackdrop(e: React.MouseEvent) { if (e.target === e.currentTarget) onClose(); }

  // Close on Escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const timeAgo = (() => {
    const diff = Date.now() - new Date(post.created_at).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  })();

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 99999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onBackdrop}>
      <div className="relative w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: '#fff', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg"
          style={{ background: 'rgba(0,0,0,0.5)' }}>×</button>

        {/* Image */}
        <div className="relative bg-black flex-shrink-0" style={{ aspectRatio: '4/3' }}>
          <img src={post.images[imgIdx]} alt={post.caption || 'Class photo'}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
          {post.images.length > 1 && (
            <>
              {imgIdx > 0 && (
                <button onClick={() => setImgIdx(i => i - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white text-xl font-bold"
                  style={{ background: 'rgba(0,0,0,0.5)' }}>‹</button>
              )}
              {imgIdx < post.images.length - 1 && (
                <button onClick={() => setImgIdx(i => i + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white text-xl font-bold"
                  style={{ background: 'rgba(0,0,0,0.5)' }}>›</button>
              )}
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                {post.images.map((_, i) => (
                  <button key={i} onClick={() => setImgIdx(i)}
                    className="w-1.5 h-1.5 rounded-full transition-all"
                    style={{ background: i === imgIdx ? '#fff' : 'rgba(255,255,255,0.4)', transform: i === imgIdx ? 'scale(1.3)' : 'scale(1)' }} />
                ))}
              </div>
              <div className="absolute top-3 left-3 text-white text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: 'rgba(0,0,0,0.5)' }}>{imgIdx + 1}/{post.images.length}</div>
            </>
          )}
        </div>

        {/* Info + actions */}
        <div className="px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
              style={{ background: '#E8F3EF' }}>
              {post.poster_role === 'teacher' ? '👩‍🏫' : '🏫'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{post.poster_name}</p>
              <p className="text-xs" style={{ color: '#64748B' }}>
                {post.section_label ? `📚 ${post.section_label}` : '🏫 School'} · {timeAgo}
              </p>
            </div>
          </div>
          {post.caption && (
            <p className="text-sm leading-relaxed mb-3" style={{ color: '#374151' }}>{post.caption}</p>
          )}
          <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid #E2E8F0' }}>
            <button onClick={handleLike}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all flex-1 justify-center"
              style={{ background: liked ? '#FEE2E2' : '#E8F3EF', color: liked ? '#DC2626' : '#1F7A5A', border: `1px solid ${liked ? '#FECACA' : '#A7D4C0'}` }}>
              <span className="text-lg" style={{ transform: liked ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.15s' }}>
                {liked ? '❤️' : '🤍'}
              </span>
              {likeCount > 0 ? likeCount : 'Like'}
            </button>
            <button onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm flex-1 justify-center"
              style={{ background: '#EDF2FE', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
              <span className="text-lg">📤</span>
              Share
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Feed post card (desktop column) ──────────────────────────────────────────
function FeedPostCard({ p, onLike }: { p: FeedPost; onLike: (id: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [liked, setLiked] = React.useState(p.liked_by_me);
  const [likeCount, setLikeCount] = React.useState(p.like_count);
  const [liking, setLiking] = React.useState(false);

  async function handleLike(_id?: string) {
    if (liking) return;
    setLiking(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);
    try { await onLike(p.id); } catch { setLiked(wasLiked); setLikeCount(c => wasLiked ? c + 1 : c - 1); }
    finally { setLiking(false); }
  }

  function handleShare() {
    const text = `Class moment from school ❤️`;
    if (navigator.share && p.images[0]) {
      navigator.share({ text, url: p.images[0] }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + (p.images[0] || ''))}`, '_blank');
    }
  }

  // Sync lightbox state back to card
  const postWithState: FeedPost = { ...p, liked_by_me: liked, like_count: likeCount };

  return (
    <>
      {open && <FeedLightbox post={postWithState} onClose={() => setOpen(false)} onLike={handleLike} />}
      <div className="rounded-xl overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>

        {/* Clickable image */}
        {p.images && p.images.length > 0 ? (
          <button className="block w-full relative cursor-pointer" style={{ aspectRatio: '4/3', overflow: 'hidden' }}
            onClick={() => setOpen(true)}>
            <img src={p.images[0]} alt={p.caption || 'Class photo'}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
            {p.images.length > 1 && (
              <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ background: 'rgba(0,0,0,0.5)' }}>+{p.images.length - 1}</span>
            )}
            {p.section_label && (
              <span className="absolute bottom-2 left-2 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.92)', color: '#0F172A' }}>{p.section_label}</span>
            )}
            {/* Tap hint overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(59,47,143,0.25)' }}>
              <span className="text-white text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(0,0,0,0.5)' }}>🔍 View</span>
            </div>
          </button>
        ) : (
          <div className="flex items-center justify-center" style={{ height: 100, background: '#F3F1FF' }}>
            <span className="text-4xl">📸</span>
          </div>
        )}

        {/* Caption + actions */}
        <div className="px-3 py-2.5">
          {p.caption && <p className="text-sm leading-snug mb-2" style={{ color: '#0F172A' }}>{p.caption}</p>}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: '#1F7A5A' }}>by {p.poster_name}</p>
              <p className="text-[11px]" style={{ color: '#64748B' }}>
                {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => handleLike()}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                style={{ background: liked ? '#FEE2E2' : '#F1F5F9', color: liked ? '#DC2626' : '#64748B', border: `1px solid ${liked ? '#FECACA' : '#E2E8F0'}` }}>
                <span style={{ transform: liked ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.15s', display: 'inline-block' }}>
                  {liked ? '❤️' : '🤍'}
                </span>
                {likeCount > 0 && likeCount}
              </button>
              <button onClick={handleShare}
                className="flex items-center justify-center w-7 h-7 rounded-lg text-sm"
                style={{ background: '#EDF2FE', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                📤
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function useFeedPosts(token: string) {
  const [posts, setPosts] = React.useState<FeedPost[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/v1/feed`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setPosts(d.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function toggleLike(postId: string) {
    const res = await fetch(`${API_BASE}/api/v1/feed/posts/${postId}/like`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setPosts(ps => ps.map(p => p.id === postId ? { ...p, like_count: data.like_count, liked_by_me: data.liked_by_me } : p));
  }

  return { posts, loading, toggleLike };
}

function ClassFeedColumn({ token }: { token: string }) {
  const { posts, loading, toggleLike } = useFeedPosts(token);
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3.5 flex-shrink-0"
        style={{ borderBottom: '1px solid #E2E8F0', background: '#FFFFFF' }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>📸 Class Feed</p>
          <p className="text-xs" style={{ color: '#64748B' }}>Photos from school</p>
        </div>
        <a href="/parent/feed"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: '#E8F3EF', color: '#166A4D' }}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </a>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {loading && (
          <div className="flex flex-col gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-xl overflow-hidden animate-pulse"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ aspectRatio: '4/3', background: '#E2E8F0' }} />
                <div className="p-3 space-y-2">
                  <div className="h-3 rounded-full w-3/4" style={{ background: '#E2E8F0' }} />
                  <div className="h-2 rounded-full w-1/2" style={{ background: '#F1F5F9' }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl mb-3">📸</span>
            <p className="text-sm font-semibold" style={{ color: '#334155' }}>No photos yet</p>
            <p className="text-xs mt-1" style={{ color: '#64748B' }}>Teachers will post class moments here</p>
          </div>
        )}
        {posts.map(p => <FeedPostCard key={p.id} p={p} onLike={toggleLike} />)}
      </div>
    </>
  );
}

// Mobile feed preview — horizontal scroll of cards with lightbox on tap
function MobileFeedPreview({ token }: { token: string }) {
  const { posts, loading, toggleLike } = useFeedPosts(token);
  const [openPost, setOpenPost] = React.useState<FeedPost | null>(null);

  if (loading) return (
    <div className="flex gap-3 px-4 py-3 overflow-x-auto">
      {[1,2,3].map(i => (
        <div key={i} className="rounded-xl overflow-hidden flex-shrink-0 animate-pulse"
          style={{ width: 160, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <div style={{ height: 110, background: '#E2E8F0' }} />
          <div className="p-2 space-y-1.5">
            <div className="h-2.5 rounded-full w-3/4" style={{ background: '#E2E8F0' }} />
            <div className="h-2 rounded-full w-1/2" style={{ background: '#F1F5F9' }} />
          </div>
        </div>
      ))}
    </div>
  );
  if (posts.length === 0) return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="text-3xl mb-2">📸</span>
      <p className="text-sm font-semibold" style={{ color: '#334155' }}>No photos yet</p>
      <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Teachers will post class moments here</p>
    </div>
  );

  // Keep openPost in sync with latest like state
  const openPostLive = openPost ? posts.find(p => p.id === openPost.id) ?? openPost : null;

  return (
    <>
      {openPostLive && (
        <FeedLightbox post={openPostLive} onClose={() => setOpenPost(null)} onLike={toggleLike} />
      )}
      <div className="flex gap-3 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {posts.slice(0, 6).map(p => (
          <button key={p.id} onClick={() => setOpenPost(p)}
            className="rounded-xl overflow-hidden flex-shrink-0 text-left"
            style={{ width: 160, background: '#fff', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            {p.images && p.images.length > 0 ? (
              <div className="relative" style={{ height: 110, overflow: 'hidden' }}>
                <img src={p.images[0]} alt={p.caption || ''}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                {p.section_label && (
                  <span className="absolute bottom-1.5 left-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.92)', color: '#0F172A' }}>{p.section_label}</span>
                )}
                {p.images.length > 1 && (
                  <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: 'rgba(0,0,0,0.5)' }}>+{p.images.length - 1}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center" style={{ height: 110, background: '#F3F1FF' }}>
                <span className="text-3xl">📸</span>
              </div>
            )}
            <div className="px-2.5 py-2">
              {p.caption && <p className="text-[11px] leading-snug line-clamp-2 mb-1" style={{ color: '#0F172A' }}>{p.caption}</p>}
              <div className="flex items-center justify-between">
                <p className="text-[10px]" style={{ color: '#64748B' }}>
                  {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
                <span className="text-[10px] font-semibold" style={{ color: p.liked_by_me ? '#DC2626' : '#94A3B8' }}>
                  {p.liked_by_me ? '❤️' : '🤍'} {p.like_count > 0 ? p.like_count : ''}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

// ─── Day Highlights Modal ─────────────────────────────────────────────────────
interface DayHighlights {
  date: string;
  child_name: string;
  class_name: string;
  topics: string[];
  chunks: { topic: string; snippet: string }[];
  summary: string;
  is_special_day: boolean;
}

function DayHighlightsModal({
  dateKey, studentId, token, onClose,
}: {
  dateKey: string; studentId: string; token: string; onClose: () => void;
}) {
  const [data, setData] = React.useState<DayHighlights | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setLoading(true); setError('');
    fetch(`${API_BASE}/api/v1/parent/child/${studentId}/day-highlights?date=${dateKey}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError('Could not load highlights'))
      .finally(() => setLoading(false));
  }, [dateKey, studentId, token]);

  // Close on Escape
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Format date nicely
  const [y, m, d] = dateKey.split('-').map(Number);
  const dateLabel = new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const subjectColors = [
    '#1F7A5A', '#1D4ED8', '#7C3AED', '#DB2777', '#EA580C', '#0891B2', '#65A30D', '#9333EA',
  ];

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-[99999]"
      style={{ background: 'rgba(30,16,96,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="relative w-full max-w-md rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: '#fff',
          maxHeight: '85vh',
          boxShadow: '0 24px 80px rgba(91,79,207,0.30), 0 4px 16px rgba(0,0,0,0.12)',
        }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex-shrink-0"
          style={{ background: '#1F7A5A' }}>
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all text-lg font-bold">
            ×
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📅</span>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">Day Highlights</p>
          </div>
          <h2 className="text-white font-semibold text-lg leading-tight">{dateLabel}</h2>
          {data && (
            <p className="text-white/60 text-xs mt-1">{data.class_name} · {data.child_name}</p>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#1F7A5A', borderTopColor: 'transparent' }} />
              <p className="text-sm font-medium" style={{ color: '#64748B' }}>Generating highlights…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="text-3xl mb-2">⚠️</span>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Special day */}
              {data.is_special_day && (
                <div className="rounded-2xl p-4 text-center"
                  style={{ background: 'linear-gradient(135deg,#FEF3C7,#FDE68A)', border: '1px solid #FCD34D' }}>
                  <span className="text-3xl">🎉</span>
                  <p className="text-base font-bold mt-2" style={{ color: '#92400E' }}>{data.topics[0]}</p>
                </div>
              )}

              {/* No plan */}
              {!data.is_special_day && data.topics.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <span className="text-3xl mb-2">📭</span>
                  <p className="text-sm font-semibold" style={{ color: '#334155' }}>No plan for this day</p>
                  <p className="text-xs mt-1" style={{ color: '#64748B' }}>The teacher hasn't set a plan yet</p>
                </div>
              )}

              {/* AI Summary */}
              {!data.is_special_day && data.summary && (
                <div className="rounded-xl p-4"
                  style={{ background: '#EDF2FE', border: '1px solid #BFDBFE' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">✨</span>
                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#1D4ED8' }}>
                      AI Summary
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#1E3A5F' }}>{data.summary}</p>
                </div>
              )}

              {/* Topics covered */}
              {!data.is_special_day && data.topics.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#64748B' }}>
                    📚 Topics Planned
                  </p>
                  <div className="space-y-2">
                    {data.topics.map((topic, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg p-3"
                        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                          style={{ background: subjectColors[i % subjectColors.length] }} />
                        <p className="text-sm font-medium leading-snug" style={{ color: '#0F172A' }}>{topic}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chunk snippets */}
              {!data.is_special_day && data.chunks.some(c => c.snippet) && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#64748B' }}>
                    📖 From the Curriculum
                  </p>
                  <div className="space-y-2">
                    {data.chunks.filter(c => c.snippet).map((c, i) => (
                      <div key={i} className="rounded-lg p-3"
                        style={{ background: '#F8FAFC', border: `1px solid ${subjectColors[i % subjectColors.length]}25` }}>
                        {c.topic && (
                          <p className="text-[10px] font-semibold mb-1"
                            style={{ color: subjectColors[i % subjectColors.length] }}>
                            {c.topic}
                          </p>
                        )}
                        <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
                          {c.snippet}{c.snippet.length >= 300 ? '…' : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: '#F1F5F9', color: '#334155' }}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Right panel ──────────────────────────────────────────────────────────────
function ParentRightPanel({ activeChild, progress, token }: { activeChild: Child | null; progress: ProgressData | null; token: string }) {
  const [schedule, setSchedule] = React.useState<Record<string, string[]>>({});
  const [weekStart, setWeekStart] = React.useState<string>('');
  const [schedLoading, setSchedLoading] = React.useState(false);
  const [highlightDay, setHighlightDay] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!activeChild?.id || !token) return;
    setSchedLoading(true);
    fetch(`${API_BASE}/api/v1/parent/child/${activeChild.id}/week-schedule`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setSchedule(d.days || {}); setWeekStart(d.week_start || ''); })
      .catch(() => {})
      .finally(() => setSchedLoading(false));
  }, [activeChild?.id, token]);

  // Build Mon–Fri date keys from the API's week_start (avoids browser timezone issues)
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const todayKey = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

  const weekDates: string[] = React.useMemo(() => {
    if (!weekStart) {
      // Fallback: compute locally
      const now = new Date();
      const dow = now.getDay();
      const offset = dow === 0 ? -6 : 1 - dow;
      return Array.from({ length: 5 }, (_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() + offset + i);
        return d.toLocaleDateString('en-CA');
      });
    }
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(weekStart + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().split('T')[0];
    });
  }, [weekStart]);

  const pct = progress?.coverage_pct ?? 0;

  // Format YYYY-MM-DD → "20 Apr"
  function formatDate(key: string) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  return (
    <>
      {/* Highlights modal */}
      {highlightDay && activeChild && (
        <DayHighlightsModal
          dateKey={highlightDay}
          studentId={activeChild.id}
          token={token}
          onClose={() => setHighlightDay(null)}
        />
      )}

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#64748B' }}>📆 Weekly Schedule</p>
        {schedLoading ? (
          <div className="space-y-1.5">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="rounded-lg p-2.5 animate-pulse" style={{ background: '#F1F5F9', height: 44 }} />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {weekDates.map((key, i) => {
              const isToday = key === todayKey;
              const hasTopics = (schedule[key] || []).length > 0;
              return (
                <button
                  key={key}
                  onClick={() => setHighlightDay(key)}
                  className="w-full rounded-lg p-2.5 text-left transition-all group hover:shadow-sm hover:-translate-y-0.5"
                  style={{
                    background: isToday ? '#E8F3EF' : '#F8FAFC',
                    border: `1px solid ${isToday ? '#A7D4C0' : '#E2E8F0'}`,
                  }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-wide"
                        style={{ color: isToday ? '#166A4D' : '#94A3B8' }}>
                        {dayLabels[i]}{isToday ? ' · Today' : ''}
                      </p>
                      <p className="text-xs font-semibold mt-0.5 underline decoration-dotted underline-offset-2 group-hover:no-underline"
                        style={{ color: isToday ? '#1F7A5A' : '#334155' }}>
                        {formatDate(key)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {hasTopics && (
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22C55E' }} />
                      )}
                      <span className="text-[10px] opacity-40 group-hover:opacity-80 transition-opacity"
                        style={{ color: '#334155' }}>›</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#64748B' }}>🎯 Progress</p>
        <div className="space-y-2.5">
          {[
            { label: 'Curriculum', pct, color: '#1F7A5A' },
          ].map(g => (
            <div key={g.label}>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="font-medium" style={{ color: '#64748B' }}>{g.label}</span>
                <span className="font-semibold" style={{ color: g.color }}>{g.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: '#E2E8F0' }}>
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${g.pct}%`, background: g.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#64748B' }}>✨ Quick Links</p>
        <div className="space-y-1.5">
          {[
            { icon: '📖', label: "Child's Journey", href: activeChild ? `/parent/journey?student_id=${activeChild.id}` : '/parent/journey' },
            { icon: '⭐', label: 'Premium Features', href: '/parent/premium' },
          ].map(f => (
            <a key={f.label} href={f.href}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer hover:bg-neutral-100 hover:shadow-sm hover:-translate-y-0.5 transition-all"
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <span className="text-sm">{f.icon}</span>
              <span className="text-[10px] font-medium flex-1" style={{ color: '#334155' }}>{f.label}</span>
              <span className="text-[10px] font-semibold" style={{ color: '#1F7A5A' }}>→</span>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Mobile Bottom Nav with "More" drawer ────────────────────────────────────
const MOBILE_MORE_TABS: { id: Tab; Icon: React.ElementType; label: string; badge?: number }[] = [
  { id: 'insights',      Icon: BarChart3,  label: 'Insights' },
  { id: 'notifications', Icon: Bell,       label: 'Updates'  },
  { id: 'settings',      Icon: Settings,   label: 'Settings' },
];

function MobileBottomNav({ tab, setTab, unreadMessages, unreadNotifs, t }: {
  tab: Tab; setTab: (t: Tab) => void;
  unreadMessages: number; unreadNotifs: number;
  t: (key: string, def?: string) => string;
}) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreTabIds = MOBILE_MORE_TABS.map(x => x.id);
  const moreIsActive = moreTabIds.includes(tab);

  // Per-tab active colours — bg tint + icon/text colour
  const navColors: Record<string, { bg: string; active: string }> = {
    home:          { bg: '#E8F3EF', active: '#1F7A5A' },
    attendance:    { bg: '#ECFDF5', active: '#166A4D' },
    progress:      { bg: '#EFF6FF', active: '#1D4ED8' },
    chat:          { bg: '#F5F3FF', active: '#7C3AED' },
    messages:      { bg: '#FCE7F3', active: '#9D174D' },
    insights:      { bg: '#EDE9FE', active: '#5B21B6' },
    notifications: { bg: '#FEF9C3', active: '#B45309' },
    settings:      { bg: '#F1F5F9', active: '#334155' },
  };

  const INACTIVE_COLOR = '#475569';   // slate-600 — clearly visible
  const INACTIVE_LABEL = '#64748B';   // slate-500

  return (
    <>
      {/* Backdrop */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(15,23,42,0.25)' }}
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More drawer */}
      <div
        className="lg:hidden fixed left-0 right-0 z-50 rounded-t-2xl overflow-hidden transition-all duration-300"
        style={{
          bottom: moreOpen ? 72 : -220,
          background: '#FFFFFF',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
          border: '1px solid #E2E8F0',
          borderBottom: 'none',
        }}>
        <div className="px-4 pt-3 pb-4">
          <div className="w-10 h-1 rounded-full mx-auto mb-4 bg-neutral-200" />
          <div className="grid grid-cols-3 gap-3">
            {MOBILE_MORE_TABS.map(({ id, Icon, label }) => {
              const badge = id === 'notifications' ? unreadNotifs : 0;
              const isActive = tab === id;
              const c = navColors[id] || navColors.home;
              return (
                <button
                  key={id}
                  onClick={() => { setTab(id); setMoreOpen(false); }}
                  className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl transition-all active:scale-95"
                  style={{
                    background: isActive ? c.bg : '#F8FAFC',
                    border: `1.5px solid ${isActive ? c.active + '40' : '#E2E8F0'}`,
                  }}
                  aria-current={isActive ? 'page' : undefined}>
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: isActive ? c.active : '#F1F5F9' }}>
                      <Icon size={22} style={{ color: isActive ? '#fff' : INACTIVE_COLOR }} strokeWidth={1.75} />
                    </div>
                    {badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                        style={{ background: '#EF4444' }}>{badge}</span>
                    )}
                  </div>
                  <span className="text-xs font-semibold" style={{ color: isActive ? c.active : INACTIVE_LABEL }}>
                    {t(label)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom nav bar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center"
        style={{
          background: '#FFFFFF',
          borderTop: '1px solid #E2E8F0',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          paddingTop: '6px',
          boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
        }}>
        {MOBILE_PRIMARY_TABS.map(({ id, Icon, label }) => {
          const badge = id === 'messages' ? unreadMessages : 0;
          const isActive = tab === id && !moreOpen;
          const c = navColors[id] || navColors.home;
          return (
            <button
              key={id}
              onClick={() => { setTab(id); setMoreOpen(false); }}
              className="relative flex-1 flex flex-col items-center gap-1 py-1 transition-all active:scale-95"
              aria-current={isActive ? 'page' : undefined}>
              {/* Active indicator bar */}
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                  style={{ width: 28, height: 3, background: c.active }} />
              )}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                style={{ background: isActive ? c.bg : 'transparent' }}>
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2 : 1.75}
                  style={{ color: isActive ? c.active : INACTIVE_COLOR }}
                />
              </div>
              <span
                className="text-[11px] leading-none"
                style={{
                  color: isActive ? c.active : INACTIVE_LABEL,
                  fontWeight: isActive ? 600 : 500,
                }}>
                {t(label)}
              </span>
              {badge > 0 && (
                <span className="absolute top-1 right-[calc(50%-20px)] w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                  style={{ background: '#EF4444' }}>{badge}</span>
              )}
            </button>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(o => !o)}
          className="relative flex-1 flex flex-col items-center gap-1 py-1 transition-all active:scale-95"
          aria-expanded={moreOpen}>
          {(moreIsActive || moreOpen) && (
            <span
              className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
              style={{ width: 28, height: 3, background: '#5B21B6' }} />
          )}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
            style={{ background: moreIsActive || moreOpen ? '#EDE9FE' : 'transparent' }}>
            <MoreHorizontal
              size={20}
              strokeWidth={moreIsActive || moreOpen ? 2 : 1.75}
              style={{ color: moreIsActive || moreOpen ? '#5B21B6' : INACTIVE_COLOR }}
            />
          </div>
          <span
            className="text-[11px] leading-none"
            style={{
              color: moreIsActive || moreOpen ? '#5B21B6' : INACTIVE_LABEL,
              fontWeight: moreIsActive || moreOpen ? 600 : 500,
            }}>
            More
          </span>
          {unreadNotifs > 0 && (
            <span className="absolute top-1 right-[calc(50%-20px)] w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
              style={{ background: '#EF4444' }}>{unreadNotifs}</span>
          )}
        </button>
      </nav>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ParentPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [tab, setTab] = useState<Tab>('home');
  const [children, setChildren] = useState<Child[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, ChildCache>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [messageThreads, setMessageThreads] = useState<ParentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [childLoading, setChildLoading] = useState(false);
  const [chatMap, setChatMap] = useState<Record<string, ChatMsg[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [noteModal, setNoteModal] = useState<NoteItem | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Settings state
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreference[]>(DEFAULT_NOTIF_PREFS);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [parentInsights, setParentInsights] = useState<ParentInsights | null>(null);
  const [childComparisons, setChildComparisons] = useState<ChildComparison[]>([]);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [assistantReminders, setAssistantReminders] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [translationSettings, setTranslationSettings] = useState<TranslationSettings>({
    enabled: false, targetLanguage: 'en', autoTranslate: false,
    supportedLanguages: ['en', 'hi', 'te', 'kn', 'ta', 'ml', 'gu', 'mr', 'bn', 'pa', 'ur', 'ar', 'fr', 'es'],
  });

  // t() helper — ParentPage is the Provider so can't use useTranslation()
  function t(key: string, defaultText?: string): string {
    if (!translationSettings.enabled || translationSettings.targetLanguage === 'en') return defaultText || key;
    return translations[translationSettings.targetLanguage]?.[key] || defaultText || key;
  }

  const activeChild = children.find(c => c.id === activeChildId) ?? null;
  const activeCache = activeChildId ? cache[activeChildId] : null;
  const chatMsgs = activeChildId ? (chatMap[activeChildId] ?? defaultChat(activeChild?.name)) : [];
  const unreadMessages = messageThreads.reduce((s, th) => s + Number(th.unread_count), 0);
  const unreadNotifs = notifications.length;

  useEffect(() => { if (!token) { router.push('/login'); return; } init(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMsgs]);

  async function init() {
    setLoading(true);
    try {
      const [kidsResult, notifsResult] = await Promise.allSettled([
        apiGet<Child[]>('/api/v1/parent/children', token),
        apiGet<Notification[]>('/api/v1/parent/notifications', token),
      ]);

      if (kidsResult.status === 'rejected') {
        const msg = kidsResult.reason?.message || '';
        if (msg.includes('Password change required') || msg.includes('force_password_reset')) { router.push('/auth/change-password'); return; }
        if (msg.includes('Invalid or expired token') || msg.includes('Missing authorization')) { clearToken(); router.push('/login'); return; }
        setInitError(msg || 'Failed to load data');
      }

      const kids = kidsResult.status === 'fulfilled' ? kidsResult.value : [];
      const notifs = notifsResult.status === 'fulfilled' ? notifsResult.value : [];
      setChildren(kids);
      setNotifications(notifs);
      apiGet<Announcement[]>('/api/v1/parent/announcements', token).then(setAnnouncements).catch(() => {});
      apiGet<ParentMessage[]>('/api/v1/parent/messages', token).then(setMessageThreads).catch(() => {});
      // Check voice feature status
      apiGet<{ voice_enabled: boolean }>('/api/v1/ai/voice-status', token).then(d => setVoiceEnabled(d.voice_enabled)).catch(() => {});

      // Load settings + emergency contacts
      // Always load mock insights data immediately so Insights tab never spins
      loadMockData(kids[0]?.id, kids[0]?.name);

      (async () => {
        try {
          const [rows, settings] = await Promise.all([
            apiGet<any[]>('/api/v1/parent/emergency-contacts', token),
            apiGet<any>('/api/v1/parent/settings', token),
          ]);
          setEmergencyContacts(rows.map(r => ({ id: r.id, name: r.name, relation: r.relationship || r.relation || '', phone: r.phone, priority: r.is_primary ? 1 : 2, available: true })) as EmergencyContact[]);
          if (settings?.notification_prefs?.length) setNotificationPrefs(settings.notification_prefs);
          if (typeof settings?.calendar_sync === 'boolean') setCalendarSyncEnabled(settings.calendar_sync);
          if (typeof settings?.assistant_reminders === 'boolean') setAssistantReminders(settings.assistant_reminders);
          if (typeof settings?.voice_enabled === 'boolean') setVoiceEnabled(settings.voice_enabled);
          if (settings?.translation_settings) {
            const ts = settings.translation_settings;
            setTranslationSettings({ enabled: ts.enabled ?? false, targetLanguage: ts.targetLanguage || 'en', autoTranslate: ts.autoTranslate ?? false, supportedLanguages: ts.supportedLanguages?.length ? ts.supportedLanguages : ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'gu', 'bn', 'mr', 'pa'] });
          }
        } catch { /* settings failed — mock data already loaded above */ }
      })();

      if (kids.length > 0) { setActiveChildId(kids[0].id); await fetchChildData(kids[0].id); }
    } catch { /* ignore */ }
    finally {
      setLoading(false);
      // Show premium modal once per session (not on every login — once per browser session)
      const seen = sessionStorage.getItem('oakit_premium_popup_seen');
      if (!seen) {
        setTimeout(() => setShowPremiumModal(true), 1500);
      }
    }
  }

  function loadMockData(firstChildId?: string, firstChildName?: string) {
    setEmergencyContacts([
      { id: '1', name: 'Parent 1', relation: 'Father', phone: '+91-9876543210', priority: 1, available: true },
      { id: '2', name: 'Parent 2', relation: 'Mother', phone: '+91-9876543211', priority: 2, available: true },
    ]);
    setCalendarSyncEnabled(localStorage.getItem('calendar_sync') === 'true');
    setAssistantReminders(localStorage.getItem('assistant_reminders') === 'true');
    loadInsightsForChild(firstChildId, firstChildName);
  }

  function loadInsightsForChild(childId?: string, childName?: string) {
    const name = childName?.split(' ')[0] || 'Your child';
    const firstName = childName?.split(' ')[0]?.toLowerCase() || '';

    // Rohan-specific insights
    const isRohan = firstName === 'rohan';

    const strengths = isRohan ? [
      `${name} shows exceptional creativity — art and painting are clear strengths`,
      `Fine motor skills are good — letter formation is neat and well-formed`,
      `Growing in confidence; answered a question in class for the first time this term`,
    ] : [
      `${name} shows excellent creativity and imagination — art and storytelling are clear strengths`,
      `English speaking confidence has improved noticeably over the past 2 weeks`,
      `Shows empathy and kindness towards classmates`,
    ];

    const areasForImprovement = isRohan ? [
      `${name} is very shy — needs gentle encouragement to speak up and participate`,
      `Gross motor skills need attention — tires quickly during physical activities`,
      `Energy levels are low in the afternoons — a light snack before school may help`,
    ] : [
      `Pencil grip needs correction — currently using fist grip instead of 3-finger grip`,
      `${name} has been falling asleep in afternoon sessions — sleep schedule needs attention`,
      `Focus and attention during structured activities needs improvement`,
    ];

    const teacherFeedback = isRohan ? [
      `Pairing ${name} with a confident peer during group activities — it is working well`,
      `Celebrating small wins publicly to build ${name}'s confidence in class`,
      `Encouraging outdoor play to build gross motor strength and stamina`,
      `Monitoring afternoon energy — will flag if fatigue continues`,
    ] : [
      `Introducing daily pencil grip exercises in class — will use triangular grip aids`,
      `Pairing ${name} with a confident peer during group activities to build participation`,
      `Monitoring energy levels — will flag if afternoon fatigue continues`,
      `Planning extra encouragement during circle time to build speaking confidence`,
    ];

    const areasNeedingAttention = isRohan ? [
      `Encourage ${name} to speak in full sentences at home — builds classroom confidence`,
      `Ensure ${name} has a light snack and short rest before school`,
      `Outdoor play daily — even 20 minutes helps build gross motor strength`,
      `Praise ${name} for small achievements to reinforce confidence`,
    ] : [
      `Practice pencil grip at home daily — 5 minutes before homework`,
      `Ensure ${name} gets 9-10 hours of sleep on school nights`,
      `Encourage ${name} to talk about their school day — builds communication skills`,
      `Limit screen time to 30 minutes before bedtime`,
    ];

    const goals = isRohan ? {
      academic: [
        { id: '1', title: 'Classroom Participation', description: 'Raise hand and answer at least one question per day', target: '5x/week', current: '2x/week', deadline: '2026-06-30', status: 'in_progress' as const, category: 'academic' as const },
      ],
      behavioral: [
        { id: '2', title: 'Social Confidence', description: 'Initiate conversation with a classmate during free play', target: 'Daily', current: '2x/week', deadline: '2026-06-30', status: 'in_progress' as const, category: 'behavioral' as const },
      ],
      attendance: [
        { id: '3', title: 'Full Attendance', description: 'Attend all classes with good energy levels', target: '100%', current: '92%', deadline: '2026-06-30', status: 'in_progress' as const, category: 'attendance' as const },
      ],
    } : {
      academic: [
        { id: '1', title: 'Correct Pencil Grip', description: 'Achieve consistent 3-finger pencil grip during all writing activities', target: '100%', current: '40%', deadline: '2026-06-30', status: 'in_progress' as const, category: 'academic' as const },
      ],
      behavioral: [
        { id: '2', title: 'Classroom Focus', description: 'Stay focused during structured activities without reminders', target: '80%', current: '55%', deadline: '2026-06-30', status: 'in_progress' as const, category: 'behavioral' as const },
      ],
      attendance: [
        { id: '3', title: 'Full Attendance', description: 'Attend all classes this month with no afternoon fatigue', target: '100%', current: '88%', deadline: '2026-06-30', status: 'in_progress' as const, category: 'attendance' as const },
      ],
    };

    setParentInsights({
      attendanceTrend: isRohan ? 'stable' : 'improving',
      participationScore: isRohan ? 45 : 72,
      strengths,
      areasForImprovement,
      teacherFeedback,
      predictions: {
        nextWeekAttendance: isRohan ? 95 : 92,
        endOfMonthProgress: isRohan ? 68 : 78,
        areasNeedingAttention,
      },
      goals,
    });

    setChildComparisons([
      { childId: childId || '', name: childName || 'Your Child', attendance: isRohan ? 92 : 88, progress: isRohan ? 68 : 72, participation: isRohan ? 45 : 65, rank: isRohan ? 5 : 4, trend: isRohan ? 'stable' : 'up' },
      { childId: 'avg', name: 'Class Average', attendance: 87, progress: 75, participation: 70, rank: 0, trend: 'stable' },
    ]);
  }

  const fetchChildData = useCallback(async (childId: string) => {
    if (cache[childId]?.feed) return;
    setChildLoading(true);
    try {
      const [feedRes, attRes, progRes] = await Promise.allSettled([
        apiGet<ChildFeed>(`/api/v1/parent/child/${childId}/feed`, token),
        apiGet<AttendanceData>(`/api/v1/parent/child/${childId}/attendance`, token),
        apiGet<ProgressData[]>('/api/v1/parent/progress', token),
      ]);
      const feed = feedRes.status === 'fulfilled' ? feedRes.value : null;
      const att = attRes.status === 'fulfilled' ? attRes.value : null;
      const prog = progRes.status === 'fulfilled' ? (progRes.value.find(p => p.student_id === childId) ?? null) : null;
      setCache(prev => ({ ...prev, [childId]: { feed, attendance: att, progress: prog } }));
    } finally { setChildLoading(false); }
  }, [cache, token]);

  async function switchChild(childId: string) {
    setActiveChildId(childId);
    const child = children.find(c => c.id === childId);
    loadInsightsForChild(childId, child?.name);
    await fetchChildData(childId);
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatLoading || !activeChildId || text.length > 300) return;
    setChatInput('');
    setChatMap(prev => ({ ...prev, [activeChildId]: [...(prev[activeChildId] ?? defaultChat(activeChild?.name)), { role: 'user' as const, text, ts: Date.now() }] }));
    setChatLoading(true);
    try {
      const resp = await apiPost<{ response: string }>('/api/v1/ai/parent-query', { text, student_id: activeChildId }, token);
      setChatMap(prev => ({ ...prev, [activeChildId]: [...(prev[activeChildId] ?? []), { role: 'ai' as const, text: resp.response, ts: Date.now() }] }));
    } catch {
      setChatMap(prev => ({ ...prev, [activeChildId]: [...(prev[activeChildId] ?? []), { role: 'ai' as const, text: 'Sorry, Oakie is unavailable right now.', ts: Date.now() }] }));
    } finally { setChatLoading(false); }
  }

  async function markNotifRead(id: string) {
    await apiPost(`/api/v1/parent/notifications/${id}/read`, {}, token).catch(() => {});
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  function saveCalendarSync(enabled: boolean) {
    setCalendarSyncEnabled(enabled);
    localStorage.setItem('calendar_sync', String(enabled));
    apiPut('/api/v1/parent/settings', { calendar_sync: enabled }, token).catch(() => {});
  }

  function saveAssistantReminders(enabled: boolean) {
    setAssistantReminders(enabled);
    localStorage.setItem('assistant_reminders', String(enabled));
    apiPut('/api/v1/parent/settings', { assistant_reminders: enabled }, token).catch(() => {});
  }

  // ─── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8FAFC' }}>
        <div className="text-center">
          <img src="/oakie.png" alt="Oakie" className="w-16 h-auto mx-auto mb-4" />
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" style={{ color: '#1F7A5A' }} />
          <p className="text-sm font-medium" style={{ color: '#64748B' }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-neutral-700 font-semibold mb-2">Something went wrong</p>
          <p className="text-sm text-neutral-500 mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{initError}</p>
          <button onClick={() => { setInitError(null); setLoading(true); init(); }} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium">Try again</button>
          <button onClick={() => { clearToken(); router.push('/login'); }} className="ml-3 px-4 py-2 border border-neutral-200 rounded-xl text-sm text-neutral-600">Sign out</button>
        </div>
      </div>
    );
  }

  const translationContextValue = {
    t: (key: string, defaultText?: string) => {
      if (!translationSettings.enabled || translationSettings.targetLanguage === 'en') return defaultText || key;
      return translations[translationSettings.targetLanguage]?.[key] || defaultText || key;
    },
    settings: translationSettings,
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <TranslationContext.Provider value={translationContextValue}>
      <div className="min-h-screen flex flex-col" style={{ background: '#F8FAFC' }}>
        {noteModal && <NoteModal note={noteModal} token={token} onClose={() => setNoteModal(null)} />}

        {/* ── DESKTOP FULL SIDEBAR (160px) ─────────────────────────── */}
        <aside className="hidden lg:flex fixed left-0 top-0 h-full flex-col z-40"
          style={{ width: 160, background: '#FFFFFF', borderRight: '1px solid #E2E8F0' }}>

          {/* Logo */}
          <div className="flex items-center gap-2.5 px-4 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid #E2E8F0' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#E8F3EF' }}>
              <img src="/oakie.png" alt="Oakit" className="w-5 h-5 rounded-lg object-cover" />
            </div>
            <div>
              <p className="font-bold text-sm leading-none tracking-tight" style={{ color: '#0F172A' }}>
                Oakit<span style={{ color: '#1F7A5A' }}>.ai</span>
              </p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color: '#64748B' }}>Parent Portal</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 flex flex-col gap-0.5 px-2 py-3 overflow-y-auto">
            {TABS.map(({ id, Icon, label }) => {
              const badge = id === 'messages' ? unreadMessages : id === 'notifications' ? unreadNotifs : 0;
              const isActive = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className="relative flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-left transition-all duration-150 active:scale-95 hover:bg-neutral-50 group"
                  style={{ background: isActive ? '#E8F3EF' : 'transparent' }}>
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style={{ background: '#1F7A5A' }} />}
                  <Icon size={16} strokeWidth={isActive ? 2 : 1.75} style={{ color: isActive ? '#166A4D' : '#64748B' }} className="flex-shrink-0" />
                  <span className="text-xs font-medium flex-1" style={{ color: isActive ? '#166A4D' : '#475569' }}>{t(label)}</span>
                  {badge > 0 && (
                    <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white flex-shrink-0"
                      style={{ background: '#EF4444' }}>{badge > 9 ? '9+' : badge}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Active child card at bottom */}
          {activeChild && (
            <div className="px-2 pb-3 flex-shrink-0" style={{ borderTop: '1px solid #E2E8F0', paddingTop: 10 }}>
              <button onClick={() => {}} className="w-full flex items-center gap-2 px-2 py-2 rounded-xl transition-all hover:bg-neutral-50 group">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden" style={{ border: '2px solid #E2E8F0' }}>
                    <ChildAvatar child={activeChild} size="sm" token={token} onUploaded={url => setChildren(prev => prev.map(c => c.id === activeChildId ? { ...c, photo_url: url } : c))} />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-emerald-500" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold truncate" style={{ color: '#0F172A' }}>{activeChild.name.split(' ')[0]}</p>
                  <p className="text-[10px] truncate" style={{ color: '#64748B' }}>{activeChild.class_name} · {activeChild.section_label}</p>
                </div>
                <ChevronDown size={12} style={{ color: '#94A3B8' }} className="flex-shrink-0" />
              </button>
            </div>
          )}

          {/* Sign out */}
          <div className="px-2 pb-3 flex-shrink-0">
            <button onClick={() => { clearToken(); router.push('/login'); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all hover:bg-neutral-50 active:scale-95">
              <LogOut size={15} strokeWidth={1.75} style={{ color: '#64748B' }} />
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>Log out</span>
            </button>
          </div>
        </aside>

        {/* Main content — offset by 160px sidebar */}
        <div className="lg:pl-40 flex flex-col flex-1" style={{ height: '100vh', overflow: 'hidden' }}>

          {/* ── DESKTOP TOP BAR ── */}
          <header className="hidden lg:flex items-center justify-between px-5 py-2.5 flex-shrink-0"
            style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
            {/* Left — greeting */}
            <div>
              <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                {getGreeting()}, {(children[0]?.father_name || children[0]?.mother_name || getParentNameFromToken(token) || 'Parent').split(' ')[0]} 👋
              </p>
              {activeChild && (
                <p className="text-xs" style={{ color: '#64748B' }}>
                  Here's what's happening with {activeChild.name.split(' ')[0]} today.
                </p>
              )}
            </div>
            {/* Right — premium + bell + parent avatar */}
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/parent/premium')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:shadow-sm"
                style={{ background: '#FEF9C3', color: '#92400E', border: '1px solid #FDE68A' }}>
                ✨ Premium
              </button>
              <button className="relative w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-neutral-100"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <Bell size={15} strokeWidth={1.75} style={{ color: '#475569' }} />
                {unreadNotifs > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                    style={{ background: '#EF4444' }}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</span>
                )}
              </button>
              {/* Parent avatar + name */}
              <div className="flex items-center gap-2 pl-2" style={{ borderLeft: '1px solid #E2E8F0' }}>
                {(() => {
                  const parentName = children[0]?.father_name || children[0]?.mother_name || getParentNameFromToken(token) || 'Parent';
                  return (
                    <>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: '#E8F3EF', color: '#1F7A5A' }}>
                        {parentName.charAt(0).toUpperCase()}
                      </div>
                      <div className="hidden xl:block">
                        <p className="text-xs font-semibold leading-none" style={{ color: '#0F172A' }}>
                          {parentName}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>Parent</p>
                      </div>
                    </>
                  );
                })()}
                <ChevronDown size={12} style={{ color: '#94A3B8' }} />
              </div>
            </div>
          </header>

          {/* Mobile header */}
          <header className="lg:hidden px-4 pt-10 pb-4 relative overflow-hidden flex-shrink-0"
            style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#E8F3EF' }}>
                  <img src="/oakie.png" alt="Oakie" className="w-6 h-6 rounded-lg object-cover" />
                </div>
                <div>
                  <p className="font-bold text-sm leading-none" style={{ color: '#0F172A' }}>Oakit<span style={{ color: '#1F7A5A' }}>.ai</span></p>
                  <p className="text-[11px] font-medium" style={{ color: '#64748B' }}>Parent Portal</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => router.push('/parent/premium')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold"
                  style={{ background: '#FEF9C3', color: '#92400E', border: '1px solid #FDE68A' }}>
                  ✨ Premium
                </button>
                <button onClick={() => { clearToken(); router.push('/login'); }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-neutral-100"
                  style={{ color: '#64748B' }}>
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          </header>

          {/* Tab content + side panels */}
          <div className="flex flex-1 overflow-hidden" style={{ background: '#F8FAFC' }}>

            {/* Main scrollable content */}
            <main className="flex-1 min-w-0 overflow-y-auto pb-24 lg:pb-8">
              {childLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <img src="/oakie.png" alt="Oakie" className="w-12 h-auto mx-auto mb-3 opacity-70" />
                    <Loader2 className="w-6 h-6 text-green-400 animate-spin mx-auto" />
                  </div>
                </div>
              ) : (
                <div className="p-4 lg:p-6 w-full max-w-xl lg:max-w-none tab-content">
                  {tab === 'home' && <HomeTab feed={activeCache?.feed ?? null} progress={activeCache?.progress ?? null} attendance={activeCache?.attendance ?? null} unreadMessages={unreadMessages} unreadNotifs={unreadNotifs} activeChild={activeChild} announcements={announcements} onNoteClick={setNoteModal} onTabChange={setTab} token={token} onChildUpdate={url => setChildren(prev => prev.map(c => c.id === activeChildId ? { ...c, photo_url: url } : c))} />}
                  {/* Mobile-only class feed — shown below home tab content */}
                  {tab === 'home' && (
                    <div className="lg:hidden mt-4">
                      <div className="rounded-xl overflow-hidden"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                        <div className="flex items-center justify-between px-4 py-3"
                          style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>📸 Class Feed</p>
                            <p className="text-xs" style={{ color: '#64748B' }}>Photos from school</p>
                          </div>
                          <a href="/parent/feed"
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
                            style={{ background: '#E8F3EF', color: '#166A4D' }}>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            View all
                          </a>
                        </div>
                        <MobileFeedPreview token={token} />
                      </div>
                    </div>
                  )}
                  {tab === 'attendance' && <AttendanceTab data={activeCache?.attendance ?? null} />}
                  {tab === 'progress' && <ProgressTab data={activeCache?.progress ?? null} activeChild={activeChild} token={token} />}
                  {tab === 'insights' && <InsightsTab insights={parentInsights} comparisons={childComparisons} activeChild={activeChild} />}
                  {tab === 'chat' && <ChatTab msgs={chatMsgs} input={chatInput} loading={chatLoading} onInput={setChatInput} onSend={sendChat} endRef={chatEndRef} childName={activeChild?.name.split(' ')[0] ?? 'your child'} token={token} voiceEnabled={voiceEnabled} voiceLanguage={translationSettings.enabled ? translationSettings.targetLanguage : 'en'} />}
                  {tab === 'messages' && <MessagesTab threads={messageThreads} token={token} onRefresh={() => apiGet<ParentMessage[]>('/api/v1/parent/messages', token).then(setMessageThreads).catch(() => {})} />}
                  {tab === 'notifications' && <NotificationsTab notifications={notifications} announcements={announcements} onRead={markNotifRead} />}
                  {tab === 'fees' && <FeesTab token={token} activeChild={activeChild} />}
                  {tab === 'reports' && <ReportsTab token={token} activeChild={activeChild} />}
                  {tab === 'settings' && <SettingsTab token={token} emergencyContacts={emergencyContacts} notificationPrefs={notificationPrefs} calendarEvents={calendarEvents} calendarSyncEnabled={calendarSyncEnabled} assistantReminders={assistantReminders} translationSettings={translationSettings} onEmergencyContactsChange={setEmergencyContacts} onNotificationPrefsChange={setNotificationPrefs} onCalendarSyncChange={saveCalendarSync} onAssistantRemindersChange={saveAssistantReminders} onTranslationSettingsChange={setTranslationSettings} />}
                </div>
              )}
            </main>

            {/* Photo feed column — desktop only */}
            <aside className="hidden lg:flex flex-col flex-shrink-0 overflow-hidden"
              style={{ width: 'clamp(240px, 22vw, 320px)', borderLeft: '1px solid rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(20px)' }}>
              <ClassFeedColumn token={token} />
            </aside>

            {/* Right panel — desktop only */}
            <aside className="hidden lg:flex flex-col flex-shrink-0 overflow-y-auto p-4 space-y-4"
              style={{ width: 'clamp(180px, 15vw, 220px)', background: '#FFFFFF', borderLeft: '1px solid #E2E8F0' }}>
              <ParentRightPanel activeChild={activeChild} progress={activeCache?.progress ?? null} token={token} />
              {/* ── FEES DUE CARD ── */}
              <div className="rounded-xl overflow-hidden"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div className="px-3 py-2.5 flex items-center gap-2"
                  style={{ borderBottom: '1px solid #E2E8F0', background: '#F1F5F9' }}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: '#CBD5E1' }}>
                    <CreditCard size={12} strokeWidth={2} style={{ color: '#fff' }} />
                  </div>
                  <p className="text-xs font-semibold" style={{ color: '#64748B' }}>Fees Due</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-xs" style={{ color: '#94A3B8' }}>Not set yet</p>
                  <button
                    onClick={() => setTab('fees')}
                    className="mt-2 w-full py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                    style={{ background: '#F1F5F9', color: '#64748B' }}>
                    View Fees →
                  </button>
                </div>
              </div>
            </aside>
          </div>

          {/* Mobile bottom nav — 5 tabs + More drawer */}
          <MobileBottomNav
            tab={tab}
            setTab={setTab}
            unreadMessages={unreadMessages}
            unreadNotifs={unreadNotifs}
            t={t}
          />
        </div>
      </div>

      {/* Premium welcome modal — shown once per session after login */}
      {showPremiumModal && (
        <PremiumWelcomeModal onClose={() => setShowPremiumModal(false)} />
      )}
    </TranslationContext.Provider>
  );
}

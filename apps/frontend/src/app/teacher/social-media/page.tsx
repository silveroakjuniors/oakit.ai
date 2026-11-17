'use client';

import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Wand2, Loader2, Upload, X, CheckCircle2, AlertCircle, Video, Image } from 'lucide-react';

interface Platform { platform: string; handle: string | null; }
interface Quota {
  video: { used: number; limit: number; remaining: number };
  image_carousel: { used: number; limit: number; remaining: number };
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', facebook: '📘', youtube: '▶️', twitter: '🐦', linkedin: '💼',
};

type MediaType = 'video' | 'image_carousel';

export default function TeacherSocialMediaPage() {
  const token = getToken() || '';
  const [tab, setTab] = useState<'new' | 'history'>('new');

  // Form state
  const [mediaType, setMediaType] = useState<MediaType>('video');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);
  const [rawCaption, setRawCaption] = useState('');
  const [aiCaption, setAiCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  // Data
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      apiGet<Platform[]>('/api/v1/teacher/social-media/platforms', token).catch(() => []),
      apiGet<Quota>('/api/v1/teacher/social-media/quota', token).catch(() => null),
    ]).then(([p, q]) => { setPlatforms(p || []); setQuota(q); });
  }, []);

  function loadHistory() {
    apiGet<any[]>('/api/v1/teacher/social-media/posts', token)
      .then(setPosts).catch(() => {});
  }
  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab]);

  // ── Upload media ──────────────────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    if (mediaType === 'video' && selected.length > 1) {
      setMsg('Only 1 video allowed per post'); return;
    }
    if (mediaType === 'image_carousel' && selected.length > 5) {
      setMsg('Maximum 5 images allowed'); return;
    }
    setFiles(selected);
    setMsg('');

    // Auto-upload
    setUploading(true);
    try {
      const fd = new FormData();
      selected.forEach(f => fd.append('media', f));
      const res = await fetch(`${API_BASE}/api/v1/teacher/social-media/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUploadedPaths(data.paths);
    } catch (e: any) {
      setMsg(e?.message || 'Upload failed');
      setFiles([]);
    } finally { setUploading(false); }
  }

  // ── Generate AI caption ───────────────────────────────────────────────────
  async function generateCaption() {
    if (!rawCaption.trim()) { setMsg('Write some notes first'); return; }
    setGenerating(true); setMsg('');
    try {
      const res = await apiPost<{ caption: string; hashtags: string[] }>(
        '/api/v1/teacher/social-media/posts/generate-caption',
        { raw_caption: rawCaption, media_type: mediaType, platforms: selectedPlatforms },
        token,
      );
      setAiCaption(res.caption);
      setHashtags(res.hashtags);
    } catch (e: any) { setMsg(e?.message || 'Caption generation failed'); }
    finally { setGenerating(false); }
  }

  // ── Submit post ───────────────────────────────────────────────────────────
  async function submit() {
    if (!uploadedPaths.length) { setMsg('Please upload media first'); return; }
    if (!rawCaption.trim() && !aiCaption.trim()) { setMsg('Please add a caption'); return; }
    if (!selectedPlatforms.length) { setMsg('Select at least one platform'); return; }
    setSubmitting(true); setMsg('');
    try {
      await apiPost('/api/v1/teacher/social-media/posts', {
        media_type: mediaType,
        media_paths: uploadedPaths,
        raw_caption: rawCaption,
        ai_caption: aiCaption || null,
        hashtags,
        platforms: selectedPlatforms,
      }, token);
      setMsg('Submitted for admin approval');
      // Reset form
      setFiles([]); setUploadedPaths([]); setRawCaption(''); setAiCaption('');
      setHashtags([]); setSelectedPlatforms([]);
      // Refresh quota
      apiGet<Quota>('/api/v1/teacher/social-media/quota', token).then(setQuota).catch(() => {});
    } catch (e: any) { setMsg(e?.message || 'Submit failed'); }
    finally { setSubmitting(false); }
  }

  const statusColor = (s: string) => s === 'published' ? 'text-emerald-700 bg-emerald-100'
    : s === 'failed' ? 'text-red-700 bg-red-100'
    : s === 'rejected' ? 'text-red-600 bg-red-50'
    : s === 'pending_approval' ? 'text-amber-700 bg-amber-100'
    : 'text-neutral-600 bg-neutral-100';

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <h1 className="text-base font-semibold text-neutral-900">Social Media</h1>
        <p className="text-xs text-neutral-400">Share school moments</p>
      </header>

      <div className="p-4 max-w-2xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 mb-5 w-fit">
          {(['new', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-primary shadow-sm' : 'text-neutral-500'}`}>
              {t === 'new' ? 'New Post' : 'My Posts'}
            </button>
          ))}
        </div>

        {tab === 'new' ? (
          <div className="flex flex-col gap-4">
            {/* Quota */}
            {quota && (
              <div className="bg-white border border-neutral-200 rounded-2xl px-4 py-3 flex gap-4">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-primary" />
                  <span className="text-sm text-neutral-600">
                    <strong>{quota.video.remaining}</strong> video{quota.video.remaining !== 1 ? 's' : ''} left today
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-neutral-600">
                    <strong>{quota.image_carousel.remaining}</strong> image post{quota.image_carousel.remaining !== 1 ? 's' : ''} left today
                  </span>
                </div>
              </div>
            )}

            {/* Media type */}
            <div className="flex gap-2">
              {(['video', 'image_carousel'] as MediaType[]).map(t => (
                <button key={t} onClick={() => { setMediaType(t); setFiles([]); setUploadedPaths([]); }}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${mediaType === t ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary/40'}`}>
                  {t === 'video' ? 'Video / Reel' : 'Photo Carousel (up to 5)'}
                </button>
              ))}
            </div>

            {/* Upload */}
            <div
              onClick={() => fileRef.current?.click()}
              className={`bg-white border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${files.length ? 'border-primary/40 bg-primary/5' : 'border-neutral-200 hover:border-primary/30'}`}>
              <input
                ref={fileRef}
                type="file"
                multiple={mediaType === 'image_carousel'}
                accept={mediaType === 'video' ? 'video/mp4,video/mov' : 'image/jpeg,image/png,image/webp'}
                className="hidden"
                onChange={handleFileSelect}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-neutral-500">Uploading...</p>
                </div>
              ) : files.length > 0 ? (
                <div>
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-neutral-700">{files.length} file{files.length > 1 ? 's' : ''} ready</p>
                  <p className="text-xs text-neutral-400">{files.map(f => f.name).join(', ')}</p>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-neutral-500">Tap to select {mediaType === 'video' ? 'a video' : 'photos'}</p>
                  <p className="text-xs text-neutral-400 mt-1">{mediaType === 'video' ? 'MP4 or MOV, max 500 MB' : 'JPG/PNG/WEBP, max 5 photos'}</p>
                </div>
              )}
            </div>

            {/* Raw caption */}
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1 block">Your notes / caption idea</label>
              <textarea
                value={rawCaption}
                onChange={e => setRawCaption(e.target.value)}
                placeholder="What's happening in this post? A few words or a full caption..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
              <button
                onClick={generateCaption}
                disabled={generating || !rawCaption.trim()}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {generating ? 'Generating...' : 'Generate with Oakie'}
              </button>
            </div>

            {/* AI caption result */}
            {aiCaption && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-emerald-700 mb-2">Oakie's caption (editable)</p>
                <textarea
                  value={aiCaption}
                  onChange={e => setAiCaption(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl border border-emerald-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300/40 resize-none"
                />
                {hashtags.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Hashtags</p>
                    <p className="text-xs text-emerald-600 leading-relaxed">{hashtags.join(' ')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Platform selection */}
            {platforms.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-neutral-600 mb-2 block">Post to</label>
                <div className="flex flex-wrap gap-2">
                  {platforms.map(p => (
                    <button
                      key={p.platform}
                      onClick={() => setSelectedPlatforms(prev =>
                        prev.includes(p.platform) ? prev.filter(x => x !== p.platform) : [...prev, p.platform]
                      )}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                        selectedPlatforms.includes(p.platform)
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary/40'
                      }`}
                    >
                      <span>{PLATFORM_ICONS[p.platform]}</span>
                      <span className="capitalize">{p.platform}</span>
                      {p.handle && <span className="opacity-60 text-xs">{p.handle}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {platforms.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
                No social media platforms configured yet. Ask your admin to set up platform connections.
              </div>
            )}

            {/* Status message */}
            {msg && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
                msg.includes('Submitted') ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-red-50 border border-red-200 text-red-600'
              }`}>
                {msg.includes('Submitted') ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {msg}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={submit}
              disabled={submitting || !uploadedPaths.length || !selectedPlatforms.length}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        ) : (
          /* History */
          <div className="flex flex-col gap-3">
            {posts.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-10">No posts yet</p>
            ) : posts.map(post => (
              <div key={post.id} className="bg-white border border-neutral-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-neutral-400">{new Date(post.submitted_at).toLocaleDateString('en-IN')}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(post.status)}`}>
                    {post.status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm text-neutral-700 line-clamp-2">{post.final_caption || post.ai_caption || post.raw_caption}</p>
                {post.rejection_reason && (
                  <p className="text-xs text-red-600 mt-1 bg-red-50 px-3 py-1.5 rounded-lg">
                    Rejected: {post.rejection_reason}
                  </p>
                )}
                <div className="flex gap-1 mt-2">
                  {post.platforms?.map((p: any) => (
                    <span key={p.platform} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize
                      ${p.status === 'posted' ? 'bg-emerald-100 text-emerald-700' : p.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-neutral-100 text-neutral-500'}`}>
                      {PLATFORM_ICONS[p.platform]} {p.platform}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

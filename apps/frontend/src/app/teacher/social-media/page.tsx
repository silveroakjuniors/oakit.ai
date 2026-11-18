'use client';

import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, getApiBase } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Wand2, Loader2, Upload, CheckCircle2, AlertCircle, Video, Image as ImageIcon, Zap, Clock } from 'lucide-react';

interface Platform { platform: string; handle: string | null; }
interface Quota {
  video: { used: number; limit: number; remaining: number };
  image_carousel: { used: number; limit: number; remaining: number };
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', facebook: '📘', youtube: '▶️', twitter: '🐦', linkedin: '💼',
};

type MediaType = 'video' | 'image_carousel';

// Reel constraints
const MAX_DURATION_SECONDS = 90;   // Instagram/Facebook/YouTube Shorts max
const COMPRESS_THRESHOLD_MB = 15;  // compress if over 15 MB
const MAX_UPLOAD_MB = 100;         // hard reject after compression if still over 100 MB

function formatMB(bytes: number) { return (bytes / 1024 / 1024).toFixed(1) + ' MB'; }
function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ── Read video duration from File using a hidden <video> element ──────────────
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(video.duration); };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read video metadata')); };
    video.src = url;
  });
}

// ── FFmpeg lazy loader ────────────────────────────────────────────────────────
let _ffmpegInstance: any = null;
async function getFFmpeg() {
  if (_ffmpegInstance) return _ffmpegInstance;
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');
  const ff = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ff.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  _ffmpegInstance = ff;
  return ff;
}

async function compressVideo(
  file: File,
  onProgress: (pct: number, stage: string) => void,
): Promise<File> {
  onProgress(0, 'Loading compressor...');
  const ff = await getFFmpeg();
  const { fetchFile } = await import('@ffmpeg/util');
  const ext = file.name.slice(file.name.lastIndexOf('.')) || '.mp4';
  const inputName = 'input' + ext;
  const outputName = 'output.mp4';

  ff.on('progress', ({ progress }: { progress: number }) => {
    onProgress(Math.min(99, Math.round(progress * 100)), 'Compressing...');
  });

  await ff.writeFile(inputName, await fetchFile(file));

  // 720p max, CRF 30 (smaller file, still good for phone screens), fast preset
  await ff.exec([
    '-i', inputName,
    '-vf', 'scale=min(iw\\,1280):min(ih\\,720):force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2',
    '-c:v', 'libx264',
    '-crf', '30',
    '-preset', 'fast',
    '-c:a', 'aac',
    '-b:a', '96k',
    '-movflags', '+faststart',
    outputName,
  ]);

  const data = await ff.readFile(outputName);
  await ff.deleteFile(inputName).catch(() => {});
  await ff.deleteFile(outputName).catch(() => {});

  // Copy into a plain ArrayBuffer so TypeScript accepts it as BlobPart
  const uint8 = data as Uint8Array;
  const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const compressed = new File([blob], `${baseName}_reel.mp4`, { type: 'video/mp4' });
  onProgress(100, 'Done');
  return compressed;
}

export default function TeacherSocialMediaPage() {
  const token = getToken() || '';
  const [tab, setTab] = useState<'new' | 'history'>('new');

  // Form state
  const [mediaType, setMediaType] = useState<MediaType>('video');
  const [files, setFiles] = useState<File[]>([]);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState(0);
  const [compressStage, setCompressStage] = useState('');
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
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
  const [postAction, setPostAction] = useState<{ id: string; action: 'edit' | null }>({ id: '', action: null });
  const [editCaption, setEditCaption] = useState('');
  const [editGenerating, setEditGenerating] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      apiGet<Platform[]>('/api/v1/teacher/social-media/platforms', token).catch(() => []),
      apiGet<Quota>('/api/v1/teacher/social-media/quota', token).catch(() => null),
    ]).then(([p, q]) => { setPlatforms(p || []); setQuota(q); });
  }, []);

  function loadHistory() {
    apiGet<any[]>('/api/v1/teacher/social-media/posts', token).then(setPosts).catch(() => {});
  }
  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab]);

  function resetUpload() {
    setFiles([]); setUploadedPaths([]); setVideoDuration(null);
    setOriginalSize(0); setCompressedSize(0); setMsg('');
    if (fileRef.current) fileRef.current.value = '';
  }

  // ── File select ───────────────────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    if (mediaType === 'video' && selected.length > 1) { setMsg('Only 1 video allowed per post'); return; }
    if (mediaType === 'image_carousel' && selected.length > 5) { setMsg('Maximum 5 images'); return; }

    setMsg('');
    setUploadedPaths([]);
    setCompressedSize(0);
    setOriginalSize(0);
    setVideoDuration(null);

    let filesToUpload = [...selected];

    if (mediaType === 'video') {
      const videoFile = selected[0];
      setOriginalSize(videoFile.size);

      // 1. Check duration
      let duration = 0;
      try {
        duration = await getVideoDuration(videoFile);
        setVideoDuration(duration);
      } catch {
        // Can't read duration — allow but warn
      }

      if (duration > MAX_DURATION_SECONDS) {
        setMsg(`Video is ${formatDuration(duration)} — Instagram Reels allow max ${MAX_DURATION_SECONDS} seconds. Please trim your video before uploading.`);
        setFiles([]);
        return;
      }

      // 2. Compress if over threshold
      if (videoFile.size > COMPRESS_THRESHOLD_MB * 1024 * 1024) {
        setCompressing(true);
        setCompressProgress(0);
        setCompressStage('Loading compressor...');
        setFiles([videoFile]); // show file name immediately
        try {
          const compressed = await compressVideo(videoFile, (pct, stage) => {
            setCompressProgress(pct);
            setCompressStage(stage);
          });
          setCompressedSize(compressed.size);

          // Check compressed size is still under hard limit
          if (compressed.size > MAX_UPLOAD_MB * 1024 * 1024) {
            setMsg(`Even after compression the video is ${formatMB(compressed.size)} which is too large. Please trim it to under ${MAX_DURATION_SECONDS} seconds.`);
            setCompressing(false);
            setFiles([]);
            return;
          }

          filesToUpload = [compressed];
          setFiles([compressed]);
        } catch (err: any) {
          setMsg(`Compression failed: ${err?.message || 'unknown'}. Try a shorter video.`);
          setCompressing(false);
          setFiles([]);
          return;
        } finally {
          setCompressing(false);
        }
      } else {
        setFiles(selected);
      }
    } else {
      setFiles(selected);
    }

    // 3. Upload
    setUploading(true);
    try {
      const fd = new FormData();
      filesToUpload.forEach(f => fd.append('media', f));
      const res = await fetch(`${getApiBase()}/api/v1/teacher/social-media/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      setUploadedPaths(data.paths);
    } catch (e: any) {
      setMsg(e?.message || 'Upload failed');
      setFiles([]);
    } finally {
      setUploading(false);
    }
  }

  // ── Post actions ──────────────────────────────────────────────────────────
  async function recallPost(id: string) {
    setActionMsg('');
    try {
      await apiPost(`/api/v1/teacher/social-media/posts/${id}/recall`, {}, token);
      setActionMsg('Post recalled — you can now edit or delete it');
      loadHistory();
    } catch (e: any) { setActionMsg(e?.message || 'Recall failed'); }
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post permanently?')) return;
    setActionMsg('');
    try {
      const res = await fetch(`${getApiBase()}/api/v1/teacher/social-media/posts/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionMsg('Post deleted');
      loadHistory();
    } catch (e: any) { setActionMsg(e?.message || 'Delete failed'); }
  }

  async function saveEdit(id: string) {
    setActionMsg('');
    try {
      const res = await fetch(`${getApiBase()}/api/v1/teacher/social-media/posts/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_caption: editCaption }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPostAction({ id: '', action: null });
      setActionMsg('Caption updated');
      loadHistory();
    } catch (e: any) { setActionMsg(e?.message || 'Save failed'); }
  }

  async function resubmitPost(id: string) {
    setActionMsg('');
    try {
      await apiPost(`/api/v1/teacher/social-media/posts/${id}/resubmit`, {}, token);
      setActionMsg('Resubmitted for admin approval');
      loadHistory();
    } catch (e: any) { setActionMsg(e?.message || 'Resubmit failed'); }
  }

  async function generateEditCaption(post: any) {
    if (!editCaption.trim()) { setActionMsg('Write some notes first, then generate'); return; }
    setEditGenerating(true);
    try {
      const res = await apiPost<{ caption: string; hashtags: string[] }>(
        '/api/v1/teacher/social-media/posts/generate-caption',
        {
          raw_caption: editCaption,
          media_type: post.media_type,
          platforms: (post.platforms || []).map((p: any) => p.platform),
        },
        token,
      );
      setEditCaption(res.caption);
    } catch (e: any) { setActionMsg(e?.message || 'Caption generation failed'); }
    finally { setEditGenerating(false); }
  }

  // ── Generate caption ──────────────────────────────────────────────────────
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

  // ── Submit ────────────────────────────────────────────────────────────────
  async function submit() {
    if (!uploadedPaths.length) { setMsg('Please upload media first'); return; }
    if (!rawCaption.trim() && !aiCaption.trim()) { setMsg('Please add a caption'); return; }
    if (!selectedPlatforms.length) { setMsg('Select at least one platform'); return; }
    setSubmitting(true); setMsg('');
    try {
      await apiPost('/api/v1/teacher/social-media/posts', {
        media_type: mediaType, media_paths: uploadedPaths,
        raw_caption: rawCaption, ai_caption: aiCaption || null,
        hashtags, platforms: selectedPlatforms,
      }, token);
      setMsg('Submitted for admin approval');
      resetUpload();
      setRawCaption(''); setAiCaption(''); setHashtags([]); setSelectedPlatforms([]);
      apiGet<Quota>('/api/v1/teacher/social-media/quota', token).then(setQuota).catch(() => {});
    } catch (e: any) { setMsg(e?.message || 'Submit failed'); }
    finally { setSubmitting(false); }
  }

  const statusColor = (s: string) =>
    s === 'published' ? 'text-emerald-700 bg-emerald-100'
    : s === 'failed' ? 'text-red-700 bg-red-100'
    : s === 'rejected' ? 'text-red-600 bg-red-50'
    : s === 'pending_approval' ? 'text-amber-700 bg-amber-100'
    : 'text-neutral-600 bg-neutral-100';

  // ── Upload zone content ───────────────────────────────────────────────────
  function UploadZoneContent() {
    if (compressing) return (
      <div className="flex flex-col items-center gap-3">
        <Zap className="w-8 h-8 text-amber-500" />
        <p className="text-sm font-semibold text-neutral-700">{compressStage}</p>
        <div className="w-full max-w-xs bg-neutral-100 rounded-full h-2">
          <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${compressProgress}%` }} />
        </div>
        <p className="text-xs text-neutral-400">{compressProgress}% — please wait</p>
        {originalSize > 0 && <p className="text-xs text-neutral-400">Original: {formatMB(originalSize)}</p>}
      </div>
    );

    if (uploading) return (
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-neutral-500">Uploading...</p>
        {compressedSize > 0 && (
          <p className="text-xs text-neutral-400">
            {formatMB(originalSize)} compressed to {formatMB(compressedSize)}
          </p>
        )}
      </div>
    );

    if (uploadedPaths.length > 0) return (
      <div className="flex flex-col items-center gap-1.5">
        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        <p className="text-sm font-semibold text-neutral-700">
          {files.length} file{files.length > 1 ? 's' : ''} uploaded
        </p>
        {videoDuration && (
          <p className="text-xs text-neutral-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {formatDuration(videoDuration)}
          </p>
        )}
        {compressedSize > 0 && (
          <p className="text-xs text-emerald-600 font-medium">
            Compressed: {formatMB(originalSize)} → {formatMB(compressedSize)}
          </p>
        )}
        <button onClick={e => { e.stopPropagation(); resetUpload(); }}
          className="text-xs text-neutral-400 hover:text-red-500 underline mt-1">
          Remove
        </button>
      </div>
    );

    return (
      <div>
        <Upload className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
        {mediaType === 'video' ? (
          <>
            <p className="text-sm font-medium text-neutral-500">Tap to select a video</p>
            <p className="text-xs text-neutral-400 mt-1">MP4 or MOV · Max 90 seconds · Auto-compressed if over 15 MB</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-neutral-500">Tap to select photos</p>
            <p className="text-xs text-neutral-400 mt-1">JPG / PNG / WEBP · Up to 5 photos</p>
          </>
        )}
      </div>
    );
  }

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

            {/* Reel rules banner */}
            {mediaType === 'video' && (
              <div className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-2.5 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-primary/80 leading-relaxed">
                  <strong>Reel guidelines:</strong> Max 90 seconds · 9:16 vertical recommended · Auto-compressed to 720p if over 15 MB
                </p>
              </div>
            )}

            {/* Quota */}
            {quota && (
              <div className="bg-white border border-neutral-200 rounded-2xl px-4 py-3 flex gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-primary" />
                  <span className="text-sm text-neutral-600">
                    <strong>{quota.video.remaining}</strong> video{quota.video.remaining !== 1 ? 's' : ''} left today
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-neutral-600">
                    <strong>{quota.image_carousel.remaining}</strong> photo post{quota.image_carousel.remaining !== 1 ? 's' : ''} left today
                  </span>
                </div>
              </div>
            )}

            {/* Media type */}
            <div className="flex gap-2">
              {(['video', 'image_carousel'] as MediaType[]).map(t => (
                <button key={t} onClick={() => { setMediaType(t); resetUpload(); }}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${mediaType === t ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary/40'}`}>
                  {t === 'video' ? 'Video / Reel' : 'Photo Carousel'}
                </button>
              ))}
            </div>

            {/* Upload zone */}
            <div
              onClick={() => !compressing && !uploading && uploadedPaths.length === 0 && fileRef.current?.click()}
              className={`bg-white border-2 border-dashed rounded-2xl p-8 text-center transition-colors
                ${compressing || uploading ? 'cursor-wait border-amber-200' :
                  uploadedPaths.length ? 'border-emerald-200 bg-emerald-50/30 cursor-default' :
                  'border-neutral-200 hover:border-primary/30 cursor-pointer'}`}>
              <input
                ref={fileRef}
                type="file"
                multiple={mediaType === 'image_carousel'}
                accept={mediaType === 'video' ? 'video/mp4,video/quicktime,video/mov' : 'image/jpeg,image/png,image/webp'}
                className="hidden"
                onChange={handleFileSelect}
              />
              <UploadZoneContent />
            </div>

            {/* Error / status */}
            {msg && (
              <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-sm font-medium
                ${msg.includes('Submitted') ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-600'}`}>
                {msg.includes('Submitted') ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                <span>{msg}</span>
              </div>
            )}

            {/* Caption */}
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

            {/* AI caption */}
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
            {platforms.length > 0 ? (
              <div>
                <label className="text-xs font-semibold text-neutral-600 mb-2 block">Post to</label>
                <div className="flex flex-wrap gap-2">
                  {platforms.map(p => (
                    <button key={p.platform}
                      onClick={() => setSelectedPlatforms(prev =>
                        prev.includes(p.platform) ? prev.filter(x => x !== p.platform) : [...prev, p.platform]
                      )}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                        selectedPlatforms.includes(p.platform)
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary/40'
                      }`}>
                      <span>{PLATFORM_ICONS[p.platform]}</span>
                      <span className="capitalize">{p.platform}</span>
                      {p.handle && <span className="opacity-60 text-xs">{p.handle}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
                No social media platforms configured yet. Ask your admin to set up platform connections.
              </div>
            )}

            {/* Submit */}
            <button
              onClick={submit}
              disabled={submitting || !uploadedPaths.length || !selectedPlatforms.length || compressing || uploading}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </button>

          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {actionMsg && (
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                ${actionMsg.includes('deleted') || actionMsg.includes('failed') ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                {actionMsg.includes('failed') ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {actionMsg}
              </div>
            )}
            {posts.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-10">No posts yet</p>
            ) : posts.map(post => {
              const canRecall = ['pending_approval', 'rejected', 'failed'].includes(post.status);
              const canEdit   = ['recalled', 'rejected', 'failed'].includes(post.status);
              const canDelete = ['recalled', 'rejected', 'failed'].includes(post.status);
              const canResend = ['recalled', 'rejected', 'failed'].includes(post.status);
              const isLocked  = ['approved', 'published', 'partially_published'].includes(post.status);
              const isEditing = postAction.id === post.id && postAction.action === 'edit';

              return (
                <div key={post.id} className="bg-white border border-neutral-200 rounded-2xl p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-400">{new Date(post.submitted_at).toLocaleDateString('en-IN')}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor(post.status)}`}>
                      {post.status?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Media preview */}
                  {post.media_urls?.length > 0 && !post.media_deleted && (
                    <div className="mb-2 rounded-xl overflow-hidden bg-neutral-100">
                      {post.media_type === 'video' ? (
                        <video
                          src={post.media_urls[0].startsWith('/') ? `${getApiBase()}${post.media_urls[0]}` : post.media_urls[0]}
                          controls preload="metadata"
                          className="w-full max-h-48 object-contain bg-black rounded-xl"
                        />
                      ) : (
                        <div className="flex gap-1">
                          {post.media_urls.slice(0, 4).map((url: string, i: number) => (
                            <img key={i}
                              src={url.startsWith('/') ? `${getApiBase()}${url}` : url}
                              alt="" className="w-16 h-16 object-cover rounded-lg"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Caption / edit mode */}
                  {isEditing ? (
                    <div className="mb-3">
                      <label className="text-xs font-semibold text-neutral-500 mb-1 block">Edit caption</label>
                      <textarea
                        value={editCaption}
                        onChange={e => setEditCaption(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      />
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button
                          onClick={() => generateEditCaption(post)}
                          disabled={editGenerating || !editCaption.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
                        >
                          {editGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          {editGenerating ? 'Generating...' : 'Generate with Oakie'}
                        </button>
                        <button onClick={() => saveEdit(post.id)}
                          className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors">
                          Save
                        </button>
                        <button onClick={() => setPostAction({ id: '', action: null })}
                          className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-600 text-xs font-semibold hover:bg-neutral-50 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-700 line-clamp-2 mb-2">
                      {post.final_caption || post.ai_caption || post.raw_caption}
                    </p>
                  )}

                  {/* Rejection reason */}
                  {post.rejection_reason && (
                    <p className="text-xs text-red-600 mb-2 bg-red-50 px-3 py-1.5 rounded-lg">
                      Rejected: {post.rejection_reason}
                    </p>
                  )}

                  {/* Platforms */}
                  <div className="flex gap-1 mb-3">
                    {post.platforms?.map((p: any) => (
                      <span key={p.platform} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize
                        ${p.status === 'posted' ? 'bg-emerald-100 text-emerald-700' : p.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-neutral-100 text-neutral-500'}`}>
                        {PLATFORM_ICONS[p.platform]} {p.platform}
                      </span>
                    ))}
                  </div>

                  {/* Action buttons — not shown for approved/published */}
                  {!isLocked && !isEditing && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100">
                      {canRecall && (
                        <button onClick={() => recallPost(post.id)}
                          className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-700 text-xs font-semibold hover:bg-neutral-50 transition-colors">
                          Recall
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => { setEditCaption(post.raw_caption || ''); setPostAction({ id: post.id, action: 'edit' }); }}
                          className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors">
                          Edit Caption
                        </button>
                      )}
                      {canResend && (
                        <button onClick={() => resubmitPost(post.id)}
                          className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors">
                          Resubmit
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => deletePost(post.id)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors">
                          Delete
                        </button>
                      )}
                    </div>
                  )}

                  {/* Locked notice */}
                  {isLocked && (
                    <p className="text-[11px] text-neutral-400 pt-2 border-t border-neutral-100">
                      {post.status === 'approved' ? 'Approved by admin — publishing in progress' : 'Published — no changes allowed'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

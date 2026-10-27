/**
 * Client-side video compression.
 *
 * Strategy:
 * 1. If FFmpeg WASM is available (SharedArrayBuffer supported) — use FFmpeg for best compression
 * 2. Fallback: use browser MediaRecorder to re-encode at lower bitrate (works on Safari iOS 14+)
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading = false;

async function getFFmpeg(onProgress?: (pct: number) => void): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (ffmpegLoading) {
    await new Promise<void>(resolve => {
      const check = setInterval(() => {
        if (!ffmpegLoading) { clearInterval(check); resolve(); }
      }, 100);
    });
    return ffmpegInstance!;
  }

  ffmpegLoading = true;
  const ff = new FFmpeg();

  // Load from our own domain — avoids CORS/COEP issues
  const base = '/ffmpeg';
  await ff.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`,   'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  if (onProgress) {
    ff.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));
  }

  ffmpegInstance = ff;
  ffmpegLoading = false;
  return ff;
}

export interface CompressResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savingsPct: number;
  method: 'ffmpeg' | 'mediarecorder' | 'none';
}

/** Check if FFmpeg WASM is available (requires SharedArrayBuffer / COEP headers) */
export function isFFmpegSupported(): boolean {
  return typeof SharedArrayBuffer !== 'undefined';
}

/** Check if MediaRecorder can encode video (Safari iOS 14+, Chrome, Firefox) */
function isMediaRecorderSupported(): boolean {
  if (typeof MediaRecorder === 'undefined') return false;
  // Check if any video codec is supported
  const codecs = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp8', 'video/webm'];
  return codecs.some(c => {
    try { return MediaRecorder.isTypeSupported(c); } catch { return false; }
  });
}

/** Get best supported MediaRecorder mime type */
function getBestMimeType(): string {
  const types = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=h264',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const t of types) {
    try { if (MediaRecorder.isTypeSupported(t)) return t; } catch { /* skip */ }
  }
  return 'video/webm';
}

/**
 * Compress using browser's MediaRecorder — works on Safari iOS 14+, Chrome, Firefox.
 * Quality is lower than FFmpeg but it's native and doesn't need WASM.
 */
async function compressWithMediaRecorder(
  file: File,
  onStatus: (s: string) => void,
  onProgress: (pct: number) => void,
): Promise<CompressResult> {
  onStatus('Preparing video...');
  onProgress(5);

  // Create a video element and load the file
  const videoEl = document.createElement('video');
  videoEl.muted = true;
  videoEl.playsInline = true;
  const objectUrl = URL.createObjectURL(file);
  videoEl.src = objectUrl;

  await new Promise<void>((resolve, reject) => {
    videoEl.onloadedmetadata = () => resolve();
    videoEl.onerror = () => reject(new Error('Video load failed'));
    setTimeout(() => reject(new Error('Video load timeout')), 15000);
  });

  const duration = videoEl.duration;
  onProgress(10);
  onStatus('Setting up compression...');

  // Draw video frames to canvas at reduced resolution (max 480p)
  const canvas = document.createElement('canvas');
  const scale  = Math.min(1, 854 / Math.max(videoEl.videoWidth, 1));
  canvas.width  = Math.round(videoEl.videoWidth  * scale);
  canvas.height = Math.round(videoEl.videoHeight * scale);
  const ctx = canvas.getContext('2d')!;

  const mimeType = getBestMimeType();

  // Target bitrate: ~600kbps for good quality at 480p
  const stream     = canvas.captureStream(25); // 25fps
  const recorder  = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 600_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  onStatus('Compressing...');
  onProgress(15);

  // Play video and record canvas output
  let lastProgress = 15;
  videoEl.currentTime = 0;
  await new Promise<void>((resolve, reject) => {
    recorder.start(100); // collect data every 100ms
    videoEl.play();

    const progressInterval = setInterval(() => {
      if (duration > 0) {
        const pct = Math.min(90, 15 + Math.round((videoEl.currentTime / duration) * 75));
        if (pct > lastProgress) {
          lastProgress = pct;
          onProgress(pct);
          onStatus(`Compressing ${pct}%`);
        }
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      }
    }, 100);

    videoEl.onended = () => {
      clearInterval(progressInterval);
      recorder.stop();
    };
    videoEl.onerror = () => { clearInterval(progressInterval); reject(new Error('Video error')); };

    recorder.onstop = () => resolve();
    setTimeout(() => { recorder.stop(); resolve(); }, (duration + 5) * 1000);
  });

  URL.revokeObjectURL(objectUrl);
  onProgress(95);
  onStatus('Finalising...');

  const ext  = mimeType.startsWith('video/mp4') ? '.mp4' : '.webm';
  const blob = new Blob(chunks, { type: mimeType });
  const compressedFile = new File([blob], `compressed${ext}`, { type: mimeType });
  const savingsPct = Math.round((1 - blob.size / file.size) * 100);

  onProgress(100);
  onStatus(`Done - ${formatBytes(file.size)} → ${formatBytes(blob.size)} (${savingsPct}% smaller)`);

  if (blob.size >= file.size) {
    return { file, originalSize: file.size, compressedSize: file.size, savingsPct: 0, method: 'none' };
  }

  return { file: compressedFile, originalSize: file.size, compressedSize: blob.size, savingsPct, method: 'mediarecorder' };
}

/**
 * Compress a video file using the best available method.
 * FFmpeg WASM → MediaRecorder → original (no compression)
 */
export async function compressVideoClient(
  file: File,
  onStatus: (s: string) => void,
  onProgress: (pct: number) => void,
): Promise<CompressResult> {

  // ── Method 1: FFmpeg WASM (best quality, requires SharedArrayBuffer) ──────
  if (isFFmpegSupported()) {
    try {
      onStatus('Loading FFmpeg...');
      onProgress(0);

      const ff = await getFFmpeg((pct) => {
        onStatus(`Compressing ${pct}%`);
        onProgress(pct);
      });

      const inputName  = 'input' + getExt(file.name);
      const outputName = 'output.mp4';

      onStatus('Reading file...');
      await ff.writeFile(inputName, await fetchFile(file));

      onStatus('Compressing video...');
      await ff.exec([
        '-i',        inputName,
        '-vcodec',   'libx264',
        '-crf',      '32',
        '-preset',   'fast',
        '-vf',       'scale=min(854\\,iw):-2',
        '-acodec',   'aac',
        '-b:a',      '96k',
        '-movflags', '+faststart',
        '-f',        'mp4',
        outputName,
      ]);

      onStatus('Finalising...');
      const data = await ff.readFile(outputName);
      const plain = new Uint8Array(data as Uint8Array).buffer as ArrayBuffer;
      const blob  = new Blob([plain], { type: 'video/mp4' });

      await ff.deleteFile(inputName).catch(() => {});
      await ff.deleteFile(outputName).catch(() => {});

      const compressedFile = new File([blob], 'output.mp4', { type: 'video/mp4' });
      const savingsPct     = Math.round((1 - blob.size / file.size) * 100);

      onProgress(100);
      onStatus(`Done - ${formatBytes(file.size)} → ${formatBytes(blob.size)} (${savingsPct}% smaller)`);

      if (blob.size >= file.size) {
        return { file, originalSize: file.size, compressedSize: file.size, savingsPct: 0, method: 'none' };
      }

      return { file: compressedFile, originalSize: file.size, compressedSize: blob.size, savingsPct, method: 'ffmpeg' };
    } catch (err: any) {
      console.warn('[compress] FFmpeg failed, trying MediaRecorder:', err.message);
    }
  }

  // ── Method 2: MediaRecorder (Safari iOS 14+, works without COEP) ─────────
  if (isMediaRecorderSupported()) {
    try {
      return await compressWithMediaRecorder(file, onStatus, onProgress);
    } catch (err: any) {
      console.warn('[compress] MediaRecorder failed:', err.message);
    }
  }

  // ── Method 3: No compression — return original ───────────────────────────
  onStatus('Compression not available — uploading original');
  onProgress(100);
  return { file, originalSize: file.size, compressedSize: file.size, savingsPct: 0, method: 'none' };
}

function getExt(filename: string): string {
  const m = filename.match(/\.[^.]+$/);
  return m ? m[0] : '.mp4';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Client-side video compression using @ffmpeg/ffmpeg (WebAssembly).
 * Runs entirely in the browser — no server involvement.
 *
 * Target: H.264 + AAC MP4, CRF 28, max 720p, +faststart for mobile streaming.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let loading = false;

/** Load FFmpeg WASM (cached after first load). */
async function getFFmpeg(onProgress?: (pct: number) => void): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (loading) {
    // Wait for in-progress load
    await new Promise<void>(resolve => {
      const check = setInterval(() => {
        if (!loading) { clearInterval(check); resolve(); }
      }, 100);
    });
    return ffmpegInstance!;
  }

  loading = true;
  const ff = new FFmpeg();

  // Load from CDN — unpkg hosts the exact wasm/worker files
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
  await ff.load({
    coreURL:   await toBlobURL(`${baseURL}/ffmpeg-core.js`,   'text/javascript'),
    wasmURL:   await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
  });

  if (onProgress) {
    ff.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));
  }

  ffmpegInstance = ff;
  loading = false;
  return ff;
}

export interface CompressResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savingsPct: number;
}

/**
 * Compress a video file in the browser.
 * @param file       Input video File
 * @param onStatus   Called with status string ('Loading FFmpeg...', 'Compressing 42%...', etc.)
 * @param onProgress Called with 0-100 progress
 */
export async function compressVideoClient(
  file: File,
  onStatus: (s: string) => void,
  onProgress: (pct: number) => void,
): Promise<CompressResult> {
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
    '-crf',      '28',           // Good quality, ~40-60% smaller
    '-preset',   'fast',
    '-vf',       'scale=min(1280\\,iw):-2',  // Max 720p wide
    '-acodec',   'aac',
    '-b:a',      '128k',
    '-movflags', '+faststart',   // Mobile streaming
    '-f',        'mp4',
    outputName,
  ]);

  onStatus('Finalising...');
  const data = await ff.readFile(outputName);
  // Copy into a plain ArrayBuffer — FileData may be backed by SharedArrayBuffer
  // which TypeScript (and some browsers) won't accept directly in new Blob()
  const plain = new Uint8Array(data as Uint8Array).buffer as ArrayBuffer;
  const blob = new Blob([plain], { type: 'video/mp4' });

  // Cleanup WASM virtual filesystem
  await ff.deleteFile(inputName).catch(() => {});
  await ff.deleteFile(outputName).catch(() => {});

  const compressedFile = new File([blob], outputName, { type: 'video/mp4' });
  const savingsPct = Math.round((1 - blob.size / file.size) * 100);

  onProgress(100);
  onStatus(`Done - ${formatBytes(file.size)} → ${formatBytes(blob.size)} (${savingsPct}% smaller)`);

  // If compression made it larger, return original
  if (blob.size >= file.size) {
    return { file, originalSize: file.size, compressedSize: file.size, savingsPct: 0 };
  }

  return { file: compressedFile, originalSize: file.size, compressedSize: blob.size, savingsPct };
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

/** Check if browser supports SharedArrayBuffer (required for FFmpeg WASM) */
export function isFFmpegSupported(): boolean {
  return typeof SharedArrayBuffer !== 'undefined';
}

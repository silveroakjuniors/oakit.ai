/**
 * Video compression using FFmpeg.
 *
 * Target: H.264 + AAC in MP4, CRF 23 (high quality, ~30-50% smaller)
 * - Handles any input format (MOV, WebM, 3GP, MP4) → always outputs MP4
 * - Max 1280x720 (720p) — sharp enough for preschool activity clips
 * - +faststart: moves moov atom to front so mobile can play before fully downloaded
 * - scale with -2: keeps aspect ratio, ensures dimensions are even (required by libx264)
 */
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

export async function compressVideo(
  inputPath: string
): Promise<{ outputPath: string; inputSize: number; outputSize: number }> {
  const inputSize = fs.statSync(inputPath).size;
  const outputPath = inputPath.replace(/(\.[^.]+)?$/, '_c.mp4');

  await new Promise<void>((resolve, reject) => {
    execFile(
      FFMPEG,
      [
        '-i',        inputPath,
        // Video: H.264, CRF 23 (good quality), fast preset for server-side encoding
        '-vcodec',   'libx264',
        '-crf',      '23',
        '-preset',   'fast',
        // Scale to max 720p wide, keep aspect ratio, ensure even dimensions
        '-vf',       'scale=min(1280\\,iw):-2',
        // Audio: AAC 128kbps stereo
        '-acodec',   'aac',
        '-b:a',      '128k',
        '-ac',       '2',
        // MP4 fast-start: moov atom at the front so mobile streams without full download
        '-movflags', '+faststart',
        // Force MP4 container (handles MOV, WebM, 3GP input)
        '-f',        'mp4',
        '-y',        // overwrite output
        outputPath,
      ],
      { timeout: 180000 },  // 3 min max (large videos on slow servers)
      (err) => {
        if (err) reject(new Error(`FFmpeg failed: ${err.message}`));
        else resolve();
      }
    );
  });

  // Verify output was created and is valid
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024) {
    throw new Error('FFmpeg produced an empty or missing output file');
  }

  const outputSize = fs.statSync(outputPath).size;

  // If compression made it larger (e.g. already optimised MP4), keep original
  if (outputSize >= inputSize) {
    fs.unlink(outputPath, () => {});
    return { outputPath: inputPath, inputSize, outputSize: inputSize };
  }

  // Remove the original temp file
  fs.unlink(inputPath, () => {});

  return { outputPath, inputSize, outputSize };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns true if FFmpeg is installed and runnable. */
export async function isFfmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(FFMPEG, ['-version'], { timeout: 5000 }, (err) => resolve(!err));
  });
}

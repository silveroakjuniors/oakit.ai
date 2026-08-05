/**
 * Video compression using FFmpeg.
 * Target: H.264/AAC in MP4 container, CRF 28 (good quality, ~40-60% size reduction)
 * Max resolution: 1280x720 (720p) — preserves quality for school videos
 */
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

export async function compressVideo(inputPath: string): Promise<{ outputPath: string; inputSize: number; outputSize: number }> {
  const inputSize = fs.statSync(inputPath).size;
  const outputPath = inputPath + '_compressed.mp4';

  await new Promise<void>((resolve, reject) => {
    execFile(FFMPEG, [
      '-i', inputPath,
      '-vcodec', 'libx264',
      '-crf', '28',              // Quality: 0=lossless, 51=worst. 28=good balance
      '-preset', 'fast',         // Encoding speed (fast = less CPU time)
      '-vf', 'scale=1280:-2',    // Max 1280px wide, maintain aspect ratio
      '-acodec', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',  // Enables streaming playback (moov at front)
      '-y',                       // Overwrite output
      outputPath,
    ], { timeout: 120000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const outputSize = fs.statSync(outputPath).size;

  // If compression made it larger (rare), use original
  if (outputSize >= inputSize) {
    fs.unlink(outputPath, () => {});
    return { outputPath: inputPath, inputSize, outputSize: inputSize };
  }

  // Delete original temp file
  fs.unlink(inputPath, () => {});

  return { outputPath, inputSize, outputSize };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Check if FFmpeg is available
export async function isFfmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(FFMPEG, ['-version'], { timeout: 5000 }, (err) => resolve(!err));
  });
}

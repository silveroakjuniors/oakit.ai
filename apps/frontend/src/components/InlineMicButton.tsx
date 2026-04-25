'use client';
/**
 * InlineMicButton — compact mic for textareas throughout the teacher module.
 * Max 60 seconds. Shows a countdown. Works on Chrome/Edge/Firefox (HTTPS or localhost).
 * Transcribes via /api/v1/ai/voice and calls onTranscript with the result.
 */
import { useState, useRef, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { API_BASE } from '@/lib/api';

const MAX_MS = 60_000; // 1 minute

interface Props {
  token: string;
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function InlineMicButton({ token, onTranscript, disabled, className = '' }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'processing' | 'error'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(60);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check browser support
  const isSupported = typeof window !== 'undefined' &&
    (!!navigator.mediaDevices?.getUserMedia) &&
    (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
  }, []);

  const start = useCallback(async () => {
    if (!isSupported || disabled) return;
    chunksRef.current = [];
    setSecondsLeft(60);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 500) { setState('idle'); return; }

        setState('processing');
        try {
          const fd = new FormData();
          fd.append('audio', blob, 'recording.webm');
          fd.append('language', 'en');
          const res = await fetch(`${API_BASE}/api/v1/ai/voice`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          const data = await res.json();
          if (data.transcript) onTranscript(data.transcript);
        } catch { /* silently fail */ }
        setState('idle');
        setSecondsLeft(60);
      };

      recorder.start(100);
      setState('recording');

      // Countdown timer
      timerRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) { stop(); return 0; }
          return s - 1;
        });
      }, 1000);

      // Hard stop at 60s
      stopTimeoutRef.current = setTimeout(stop, MAX_MS);

    } catch (err) {
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  }, [token, disabled, isSupported, stop, onTranscript]);

  if (!isSupported) return null;

  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
      {state === 'idle' && (
        <button type="button" onClick={start} disabled={disabled}
          title="Record voice (max 1 min) — Chrome/Edge/Firefox supported"
          className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center hover:bg-emerald-100 hover:border-emerald-400 transition-all active:scale-95 disabled:opacity-40">
          <Mic size={13} className="text-emerald-600" />
        </button>
      )}
      {state === 'recording' && (
        <button type="button" onClick={stop}
          title="Stop recording"
          className="w-7 h-7 rounded-full bg-red-500 border border-red-600 flex items-center justify-center hover:bg-red-600 transition-colors relative">
          <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-50" />
          <Square size={11} className="text-white relative z-10 fill-white" />
        </button>
      )}
      {state === 'processing' && (
        <div className="w-7 h-7 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
          <Loader2 size={13} className="animate-spin text-amber-600" />
        </div>
      )}
      {state === 'error' && (
        <div className="w-7 h-7 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
          <Mic size={13} className="text-red-400" />
        </div>
      )}
      {state === 'recording' && (
        <span className="text-[9px] font-bold text-red-600 tabular-nums">{secondsLeft}s</span>
      )}
      {state === 'idle' && (
        <span className="text-[9px] text-neutral-400">Speak</span>
      )}
    </div>
  );
}

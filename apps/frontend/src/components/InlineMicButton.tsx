'use client';
/**
 * InlineMicButton — compact mic for textareas throughout the teacher module.
 * Uses the browser's Web Speech API (SpeechRecognition) as primary — no server needed.
 * Falls back to server-side transcription if Web Speech is unavailable.
 * Max 60 seconds. Works in Chrome and Edge natively.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { API_BASE } from '@/lib/api';

const MAX_MS = 60_000;

interface Props {
  token: string;
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

// Detect Web Speech API support (Chrome, Edge)
function getSpeechRecognition(): typeof window.SpeechRecognition | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export default function InlineMicButton({ token, onTranscript, disabled, className = '' }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'processing' | 'error'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [errorMsg, setErrorMsg] = useState('');

  // Web Speech API refs
  const recognitionRef = useRef<any>(null);
  // MediaRecorder refs (fallback)
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interimRef = useRef('');

  const SpeechRecognition = getSpeechRecognition();
  const useWebSpeech = !!SpeechRecognition;

  // HTTPS or localhost check
  const isSupported = typeof window !== 'undefined' && (
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
  }, []);

  const startCountdown = useCallback(() => {
    setSecondsLeft(60);
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { stop(); return 0; }
        return s - 1;
      });
    }, 1000);
    stopTimeoutRef.current = setTimeout(() => stop(), MAX_MS);
  }, []);

  // ── Web Speech API path ────────────────────────────────────────────────────
  const startWebSpeech = useCallback(() => {
    const SR = getSpeechRecognition()!;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    recognitionRef.current = recognition;
    interimRef.current = '';

    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      interimRef.current = interim;
      if (final) {
        onTranscript(final.trim());
      }
    };

    recognition.onerror = (event: any) => {
      clearTimers();
      if (event.error === 'not-allowed') {
        setErrorMsg('Microphone permission denied');
      } else if (event.error === 'no-speech') {
        // Silently ignore — user just didn't speak
      } else {
        setErrorMsg('Voice error: ' + event.error);
      }
      setState('error');
      setTimeout(() => { setState('idle'); setErrorMsg(''); }, 3000);
    };

    recognition.onend = () => {
      clearTimers();
      // If there's any interim text left, commit it
      if (interimRef.current.trim()) {
        onTranscript(interimRef.current.trim());
        interimRef.current = '';
      }
      setState('idle');
      setSecondsLeft(60);
    };

    try {
      recognition.start();
      setState('recording');
      startCountdown();
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  }, [onTranscript, clearTimers, startCountdown]);

  const stopWebSpeech = useCallback(() => {
    clearTimers();
    recognitionRef.current?.stop();
  }, [clearTimers]);

  // ── MediaRecorder + server fallback path ──────────────────────────────────
  const startMediaRecorder = useCallback(async () => {
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
        clearTimers();
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
          else if (data.error) setErrorMsg(data.error);
        } catch { setErrorMsg('Transcription failed'); }
        setState('idle');
        setSecondsLeft(60);
        setTimeout(() => setErrorMsg(''), 3000);
      };

      recorder.start(100);
      setState('recording');
      startCountdown();
    } catch {
      setErrorMsg('Microphone access denied');
      setState('error');
      setTimeout(() => { setState('idle'); setErrorMsg(''); }, 3000);
    }
  }, [token, onTranscript, clearTimers, startCountdown]);

  const stopMediaRecorder = useCallback(() => {
    clearTimers();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, [clearTimers]);

  // ── Unified start/stop ────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (disabled) return;
    setErrorMsg('');
    if (useWebSpeech) startWebSpeech();
    else startMediaRecorder();
  }, [disabled, useWebSpeech, startWebSpeech, startMediaRecorder]);

  const stop = useCallback(() => {
    if (useWebSpeech) stopWebSpeech();
    else stopMediaRecorder();
  }, [useWebSpeech, stopWebSpeech, stopMediaRecorder]);

  // Cleanup on unmount
  useEffect(() => () => {
    clearTimers();
    recognitionRef.current?.abort();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, [clearTimers]);

  if (!isSupported) return null;

  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
      {state === 'idle' && (
        <button type="button" onClick={start} disabled={disabled}
          title={useWebSpeech ? 'Tap to speak (Chrome/Edge)' : 'Record voice (max 1 min)'}
          className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center hover:bg-emerald-100 hover:border-emerald-400 transition-all active:scale-95 disabled:opacity-40">
          <Mic size={13} className="text-emerald-600" />
        </button>
      )}
      {state === 'recording' && (
        <button type="button" onClick={stop} title="Stop recording"
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
        <div className="w-7 h-7 rounded-full bg-red-50 border border-red-200 flex items-center justify-center" title={errorMsg}>
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

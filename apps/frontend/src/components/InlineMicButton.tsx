'use client';
/**
 * InlineMicButton — uses the browser's Web Speech API only.
 * Supported on Chrome and Safari. Shows a clear message on unsupported browsers.
 * No server call needed — transcription happens entirely in the browser.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, MicOff } from 'lucide-react';

const MAX_MS = 60_000;

interface Props {
  token?: string; // kept for API compatibility, not used
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export default function InlineMicButton({ onTranscript, disabled, className = '' }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'unsupported'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(60);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SR = getSpeechRecognition();

  // If not supported, show a static disabled button with tooltip
  if (!SR) {
    return (
      <div className={`flex flex-col items-center gap-0.5 ${className}`}>
        <div
          title="Voice input is only supported on Chrome and Safari browsers"
          className="w-7 h-7 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center cursor-not-allowed">
          <MicOff size={13} className="text-neutral-400" />
        </div>
        <span className="text-[9px] text-neutral-300 text-center leading-tight max-w-[40px]">Chrome only</span>
      </div>
    );
  }

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
  };

  const stop = useCallback(() => {
    clearTimers();
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (disabled) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false; // only fire on final results
    recognition.lang = 'en-IN';
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript.trim()) onTranscript(transcript.trim());
    };

    recognition.onerror = (event: any) => {
      clearTimers();
      setState('idle');
      setSecondsLeft(60);
      if (event.error === 'not-allowed') {
        alert('Microphone permission denied. Please allow microphone access in your browser settings.');
      }
      // other errors (no-speech, aborted) — silently reset
    };

    recognition.onend = () => {
      clearTimers();
      setState('idle');
      setSecondsLeft(60);
    };

    try {
      recognition.start();
      setState('recording');
      setSecondsLeft(60);

      // Countdown
      timerRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) { stop(); return 0; }
          return s - 1;
        });
      }, 1000);

      // Hard stop at 60s
      stopTimeoutRef.current = setTimeout(stop, MAX_MS);
    } catch {
      setState('idle');
    }
  }, [disabled, onTranscript, stop]);

  // Cleanup on unmount
  useEffect(() => () => {
    clearTimers();
    recognitionRef.current?.abort();
  }, []);

  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
      {state === 'idle' && (
        <button type="button" onClick={start} disabled={disabled}
          title="Tap to speak — Chrome and Safari supported"
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
      {state === 'recording' && (
        <span className="text-[9px] font-bold text-red-600 tabular-nums">{secondsLeft}s</span>
      )}
      {state === 'idle' && (
        <span className="text-[9px] text-neutral-400">Speak</span>
      )}
    </div>
  );
}

'use client';
import { Mic, Square, Loader2, MicOff } from 'lucide-react';
import type { VoiceState } from '@/hooks/useVoiceInput';

interface VoiceMicButtonProps {
  state: VoiceState;
  onStart: () => void;
  onStop: () => void;
  className?: string;
  size?: 'sm' | 'md';
}

export default function VoiceMicButton({ state, onStart, onStop, className = '', size = 'md' }: VoiceMicButtonProps) {
  const sz = size === 'sm' ? 'w-9 h-9' : 'w-11 h-11';
  const iconSz = size === 'sm' ? 15 : 18;

  // ── Processing — spinner ──────────────────────────────────────────────────
  if (state === 'processing') {
    return (
      <div className={`flex flex-col items-center gap-1 ${className}`}>
        <div className={`${sz} rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center shrink-0`}>
          <Loader2 size={iconSz} className="animate-spin text-amber-600" />
        </div>
        <span className="text-[9px] text-amber-600 font-semibold whitespace-nowrap">Processing…</span>
      </div>
    );
  }

  // ── Recording — pulsing red STOP button ───────────────────────────────────
  if (state === 'recording') {
    return (
      <div className={`flex flex-col items-center gap-1 ${className}`}>
        <button
          type="button"
          onClick={onStop}
          className={`${sz} rounded-full bg-red-500 border-2 border-red-600 flex items-center justify-center shrink-0 hover:bg-red-600 transition-colors relative`}
          title="Tap to stop recording"
        >
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-60" />
          <Square size={iconSz - 2} className="text-white relative z-10 fill-white" />
        </button>
        <span className="text-[9px] text-red-600 font-bold whitespace-nowrap animate-pulse">● Recording…</span>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className={`flex flex-col items-center gap-1 ${className}`}>
        <div className={`${sz} rounded-full bg-red-100 border-2 border-red-200 flex items-center justify-center shrink-0`}>
          <MicOff size={iconSz} className="text-red-400" />
        </div>
        <span className="text-[9px] text-red-500 font-semibold whitespace-nowrap">Try again</span>
      </div>
    );
  }

  // ── Idle — tap to start ───────────────────────────────────────────────────
  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={onStart}
        className={`${sz} rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center shrink-0 hover:bg-emerald-100 hover:border-emerald-400 transition-all active:scale-95`}
        title="Tap to start voice recording"
      >
        <Mic size={iconSz} className="text-emerald-600" />
      </button>
      <span className="text-[9px] text-emerald-600 font-semibold whitespace-nowrap">Speak</span>
    </div>
  );
}

'use client';
import { Mic, MicOff, Loader2 } from 'lucide-react';
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
  const iconSz = size === 'sm' ? 14 : 18;

  if (state === 'processing') {
    return (
      <div className={`${sz} rounded-full bg-amber-100 flex items-center justify-center shrink-0 ${className}`}>
        <Loader2 size={iconSz} className="animate-spin text-amber-600" />
      </div>
    );
  }

  if (state === 'recording') {
    return (
      <button
        type="button"
        onClick={onStop}
        className={`${sz} rounded-full bg-red-500 flex items-center justify-center shrink-0 shadow-lg shadow-red-500/40 animate-pulse hover:bg-red-600 transition-colors ${className}`}
        title="Tap to stop recording"
      >
        <MicOff size={iconSz} className="text-white" />
      </button>
    );
  }

  if (state === 'error') {
    return (
      <div className={`${sz} rounded-full bg-red-100 flex items-center justify-center shrink-0 ${className}`}
        title="Voice error — try again">
        <MicOff size={iconSz} className="text-red-500" />
      </div>
    );
  }

  // idle
  return (
    <button
      type="button"
      onClick={onStart}
      className={`${sz} rounded-full bg-neutral-100 hover:bg-emerald-100 flex items-center justify-center shrink-0 transition-colors border border-neutral-200 hover:border-emerald-300 ${className}`}
      title="Tap to speak"
    >
      <Mic size={iconSz} className="text-neutral-500 hover:text-emerald-600" />
    </button>
  );
}

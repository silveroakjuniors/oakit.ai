'use client';
import { useState, useRef, useCallback } from 'react';
import { API_BASE } from '@/lib/api';

export type VoiceState = 'idle' | 'recording' | 'processing' | 'error';

interface UseVoiceInputOptions {
  token: string;
  language?: string;
  maxDurationMs?: number;
  onTranscript: (text: string) => void;
  onResponse?: (data: any) => void; // if you want the full AI response back
}

export function useVoiceInput({
  token,
  language = 'en',
  maxDurationMs = 30000,
  onTranscript,
  onResponse,
}: UseVoiceInputOptions) {
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    setState('recording');
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick the best supported format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        if (audioBlob.size < 500) {
          setState('idle');
          return; // too short, ignore
        }

        setState('processing');
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          formData.append('language', language);

          const res = await fetch(`${API_BASE}/api/v1/ai/voice`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Voice processing failed' }));
            throw new Error(err.error || `HTTP ${res.status}`);
          }

          const data = await res.json();
          if (data.transcript) {
            onTranscript(data.transcript);
          }
          if (onResponse) {
            onResponse(data);
          }
          setState('idle');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Voice processing failed';
          setError(msg);
          setState('error');
          setTimeout(() => setState('idle'), 3000);
        }
      };

      recorder.start(100); // collect data every 100ms

      // Auto-stop after maxDurationMs
      timeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, maxDurationMs);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      setError(msg.includes('Permission') || msg.includes('NotAllowed')
        ? 'Microphone permission denied. Please allow microphone access.'
        : msg);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }, [token, language, maxDurationMs, onTranscript, onResponse]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // isSupported: true on HTTPS, true on localhost (browsers allow mic on localhost over HTTP)
  // false only on non-localhost HTTP in production
  const isSupported = typeof window !== 'undefined' && (
    !!navigator.mediaDevices?.getUserMedia ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );

  return { state, error, startRecording, stopRecording, isSupported };
}

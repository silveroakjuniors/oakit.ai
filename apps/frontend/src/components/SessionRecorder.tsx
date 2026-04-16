'use client';

/**
 * SessionRecorder — Live classroom session transcription
 *
 * Uses the browser's built-in Web Speech API (Chrome/Edge only).
 * TEST MODE: clearly labelled, teacher reviews before sending.
 *
 * Flow:
 *   1. Teacher taps "Start Recording" → browser streams audio to Google STT
 *   2. Words appear live on screen as teacher speaks
 *   3. Teacher taps "Stop" → reviews / edits raw transcript
 *   4. Teacher taps "Format with Oakie" → Gemini cleans it up
 *   5. Teacher previews formatted notes → Download PDF or Send to Parents
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Square, Loader2, Send, Download, X, CheckCircle2, AlertCircle, Edit3, Eye } from 'lucide-react';
import { API_BASE, apiPost } from '@/lib/api';

type RecorderStep = 'idle' | 'recording' | 'review' | 'formatting' | 'formatted' | 'sending' | 'done';

interface SessionRecorderProps {
  token: string;
  sectionId?: string;
  onClose: () => void;
}

// Extend Window for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function SessionRecorder({ token, sectionId, onClose }: SessionRecorderProps) {
  const [step, setStep] = useState<RecorderStep>('idle');
  const [liveText, setLiveText] = useState('');          // interim (grey)
  const [finalText, setFinalText] = useState('');        // confirmed words
  const [editedTranscript, setEditedTranscript] = useState('');
  const [formattedNotes, setFormattedNotes] = useState('');
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [sendMsg, setSendMsg] = useState('');

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef('');  // always up-to-date for onstop

  // Check browser support
  const isSupported = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  // Duration timer
  useEffect(() => {
    if (step === 'recording') {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step]);

  // Word count
  useEffect(() => {
    const text = editedTranscript || finalText;
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
  }, [editedTranscript, finalText]);

  function formatDuration(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  const startRecording = useCallback(() => {
    setError('');
    setFinalText('');
    setLiveText('');
    setDuration(0);
    transcriptRef.current = '';

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';  // Indian English — better for classroom context
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interim = '';
      let newFinal = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinal += transcript + ' ';
        } else {
          interim = transcript;
        }
      }
      if (newFinal) {
        transcriptRef.current += newFinal;
        setFinalText(transcriptRef.current);
      }
      setLiveText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return; // ignore silence
      if (event.error === 'not-allowed') {
        setError('Microphone permission denied. Please allow microphone access in your browser.');
        setStep('idle');
      } else if (event.error === 'network') {
        setError('Network error. Web Speech API requires internet connection.');
        setStep('idle');
      } else {
        console.warn('[SessionRecorder] speech error:', event.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still in recording state (Chrome stops after ~60s silence)
      if (step === 'recording') {
        try { recognition.start(); } catch { /* already stopped */ }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setStep('recording');
    } catch (e) {
      setError('Could not start recording. Make sure you are using Chrome or Edge.');
    }
  }, [step]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // prevent auto-restart
      recognitionRef.current.stop();
    }
    const captured = transcriptRef.current.trim();
    setEditedTranscript(captured);
    setLiveText('');
    setStep('review');
  }, []);

  async function formatWithOakie() {
    const raw = editedTranscript.trim();
    if (!raw) return;
    setStep('formatting');
    try {
      const res = await apiPost<{ formatted: string }>(
        '/api/v1/teacher/notes/format-session',
        { raw_transcript: raw, section_id: sectionId },
        token
      );
      setFormattedNotes(res.formatted);
      setStep('formatted');
    } catch (e: any) {
      setError(e.message || 'Formatting failed. Please try again.');
      setStep('review');
    }
  }

  async function sendToParents() {
    const content = formattedNotes || editedTranscript;
    if (!content.trim()) return;
    setStep('sending');
    setSendMsg('');
    try {
      await apiPost('/api/v1/teacher/notes', {
        note_text: content,
        ...(sectionId ? { section_id: sectionId } : {}),
      }, token);
      setStep('done');
      setSendMsg('✅ Session notes sent to parents successfully!');
    } catch (e: any) {
      setError(e.message || 'Failed to send notes.');
      setStep('formatted');
    }
  }

  function downloadTranscript() {
    const content = formattedNotes || editedTranscript;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-notes-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={step === 'idle' || step === 'done' ? onClose : undefined}>
      <div className="relative w-full lg:w-[600px] lg:max-h-[85vh] bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
              <Mic className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-800">Session Recorder</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  🧪 TEST MODE
                </span>
                <span className="text-[10px] text-neutral-400">Chrome / Edge only</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* ── Test mode notice ── */}
        <div className="mx-5 mt-4 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 shrink-0">
          <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Test Mode:</strong> Uses your browser's built-in speech recognition (Chrome/Edge). Audio is processed by Google's servers. Works best in English. Full multilingual support coming in Phase 2.
          </p>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── IDLE ── */}
          {step === 'idle' && !isSupported && (
            <div className="flex flex-col items-center py-8 text-center gap-3">
              <MicOff size={40} className="text-neutral-300" />
              <p className="text-sm font-semibold text-neutral-700">Browser not supported</p>
              <p className="text-xs text-neutral-400 max-w-xs">Session recording requires Chrome or Edge. Please open this page in Chrome to use this feature.</p>
            </div>
          )}

          {step === 'idle' && isSupported && (
            <div className="flex flex-col items-center py-6 text-center gap-4">
              <div className="w-20 h-20 rounded-full bg-red-50 border-4 border-red-100 flex items-center justify-center">
                <Mic size={36} className="text-red-500" />
              </div>
              <div>
                <p className="text-base font-bold text-neutral-800 mb-1">Ready to record your session</p>
                <p className="text-xs text-neutral-500 max-w-xs leading-relaxed">
                  Tap Start Recording, then speak naturally. Your words will appear on screen in real time. You can review and edit before sending to parents.
                </p>
              </div>
              <div className="w-full space-y-2 text-left">
                {[
                  '🎤 Speak clearly — the mic picks up your voice',
                  '👁 Watch words appear live on screen',
                  '✏️ Review and edit before sending',
                  '📤 Oakie formats it into clean notes for parents',
                ].map((tip, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-neutral-600 bg-neutral-50 rounded-lg px-3 py-2">
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── RECORDING ── */}
          {step === 'recording' && (
            <div className="space-y-3">
              {/* Status bar */}
              <div className="flex items-center justify-between px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="text-sm font-bold text-red-700">Recording</span>
                  <span className="text-xs text-red-500 font-mono">{formatDuration(duration)}</span>
                </div>
                <span className="text-xs text-neutral-500">{wordCount} words</span>
              </div>

              {/* Live transcript */}
              <div className="min-h-[200px] max-h-[300px] overflow-y-auto bg-neutral-50 border border-neutral-200 rounded-xl p-4">
                <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
                  {finalText}
                  {liveText && <span className="text-neutral-400 italic">{liveText}</span>}
                  {!finalText && !liveText && (
                    <span className="text-neutral-400 italic">Listening… start speaking</span>
                  )}
                </p>
              </div>

              <p className="text-xs text-neutral-400 text-center">
                Speak naturally. Tap Stop when done.
              </p>
            </div>
          )}

          {/* ── REVIEW ── */}
          {(step === 'review') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
                  <Edit3 size={14} className="text-neutral-500" />
                  Review & Edit Transcript
                </p>
                <span className="text-xs text-neutral-400">{wordCount} words · {formatDuration(duration)}</span>
              </div>
              <p className="text-xs text-neutral-500">Read through the transcript. Fix any errors before sending to Oakie for formatting.</p>
              <textarea
                value={editedTranscript}
                onChange={e => setEditedTranscript(e.target.value)}
                rows={10}
                className="w-full border border-neutral-200 rounded-xl px-3 py-3 text-sm text-neutral-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none bg-white"
                placeholder="Your transcript will appear here..."
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          )}

          {/* ── FORMATTING ── */}
          {step === 'formatting' && (
            <div className="flex flex-col items-center py-10 gap-4">
              <Loader2 size={36} className="animate-spin text-emerald-600" />
              <p className="text-sm font-semibold text-neutral-700">Oakie is formatting your notes…</p>
              <p className="text-xs text-neutral-400">Converting your transcript into clean, structured class notes for parents.</p>
            </div>
          )}

          {/* ── FORMATTED ── */}
          {step === 'formatted' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-emerald-600" />
                <p className="text-sm font-semibold text-neutral-800">Formatted Notes — Preview</p>
                <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Ready to send</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 max-h-[300px] overflow-y-auto">
                <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">{formattedNotes}</p>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          )}

          {/* ── SENDING ── */}
          {step === 'sending' && (
            <div className="flex flex-col items-center py-10 gap-4">
              <Loader2 size={36} className="animate-spin text-emerald-600" />
              <p className="text-sm font-semibold text-neutral-700">Sending to parents…</p>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center py-8 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <p className="text-base font-bold text-neutral-800">Notes sent to parents!</p>
              <p className="text-xs text-neutral-500 max-w-xs">Parents will see the session notes in their portal. Notes auto-expire after 14 days.</p>
              {sendMsg && <p className="text-xs text-emerald-600 font-medium">{sendMsg}</p>}
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div className="px-5 py-4 border-t border-neutral-100 shrink-0 space-y-2">

          {step === 'idle' && isSupported && (
            <button onClick={startRecording}
              className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
              <Mic size={18} /> Start Recording
            </button>
          )}

          {step === 'recording' && (
            <button onClick={stopRecording}
              className="w-full py-3 bg-neutral-800 hover:bg-neutral-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
              <Square size={16} className="fill-white" /> Stop Recording
            </button>
          )}

          {step === 'review' && (
            <div className="space-y-2">
              <button onClick={formatWithOakie} disabled={!editedTranscript.trim()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
                ✨ Format with Oakie
              </button>
              <div className="flex gap-2">
                <button onClick={downloadTranscript}
                  className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl flex items-center justify-center gap-1.5 hover:bg-neutral-50 transition-colors">
                  <Download size={14} /> Download Raw
                </button>
                <button onClick={() => { setStep('idle'); setFinalText(''); setEditedTranscript(''); setDuration(0); }}
                  className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-colors">
                  Record Again
                </button>
              </div>
            </div>
          )}

          {step === 'formatted' && (
            <div className="space-y-2">
              <button onClick={sendToParents}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
                <Send size={16} /> Send to Parents
              </button>
              <div className="flex gap-2">
                <button onClick={downloadTranscript}
                  className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl flex items-center justify-center gap-1.5 hover:bg-neutral-50 transition-colors">
                  <Download size={14} /> Download Notes
                </button>
                <button onClick={() => setStep('review')}
                  className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-colors">
                  ← Edit Transcript
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <button onClick={onClose}
              className="w-full py-3 bg-neutral-800 hover:bg-neutral-900 text-white font-bold rounded-xl transition-colors">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

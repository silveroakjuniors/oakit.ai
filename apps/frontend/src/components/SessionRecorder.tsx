'use client';

/**
 * SessionRecorder — Live classroom session transcription
 *
 * Uses the browser's built-in Web Speech API (Chrome/Edge only).
 * TEST MODE: clearly labelled, teacher reviews before sending.
 *
 * Flow:
 *   1. Teacher selects today's topics being covered
 *   2. Taps "Start Recording" → browser streams audio to Google STT
 *   3. Words appear live on screen as teacher speaks
 *   4. Teacher taps "Stop" → reviews / edits raw transcript
 *   5. Teacher taps "Format with Oakie" → Gemini cleans it up
 *   6. Teacher previews → Download or Send to Parents (saved against today's date)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Square, Loader2, Send, Download, X,
  CheckCircle2, AlertCircle, Edit3, Eye, Calendar, BookOpen,
} from 'lucide-react';
import { apiPost } from '@/lib/api';

type RecorderStep = 'setup' | 'recording' | 'review' | 'formatting' | 'formatted' | 'sending' | 'done';

export interface SessionTopic {
  id: string;
  label: string;
}

interface SessionRecorderProps {
  token: string;
  sectionId?: string;
  today: string;                  // ISO date string e.g. "2026-06-16"
  topics?: SessionTopic[];        // today's plan chunks
  onClose: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function SessionRecorder({ token, sectionId, today, topics = [], onClose }: SessionRecorderProps) {
  const [step, setStep] = useState<RecorderStep>('setup');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);   // topic ids
  const [liveText, setLiveText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [editedTranscript, setEditedTranscript] = useState('');
  const [formattedNotes, setFormattedNotes] = useState('');
  const [formattedEdited, setFormattedEdited] = useState(false); // true if teacher edited the AI output
  const [originalFormatted, setOriginalFormatted] = useState(''); // snapshot to detect changes
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [sendMsg, setSendMsg] = useState('');

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef('');

  const isSupported = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  // Format date nicely
  const dateLabel = new Date(today + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

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

  function toggleTopic(id: string) {
    setSelectedTopics(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
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
    recognition.lang = 'en-IN';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interim = '';
      let newFinal = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) newFinal += t + ' ';
        else interim = t;
      }
      if (newFinal) {
        transcriptRef.current += newFinal;
        setFinalText(transcriptRef.current);
      }
      setLiveText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      if (event.error === 'not-allowed') {
        setError('Microphone permission denied. Please allow microphone access in your browser.');
        setStep('setup');
      } else if (event.error === 'network') {
        setError('Network error. Web Speech API requires internet connection.');
        setStep('setup');
      }
    };

    recognition.onend = () => {
      // Auto-restart if still recording (Chrome stops after ~60s silence)
      if (recognitionRef.current && step === 'recording') {
        try { recognition.start(); } catch { /* already stopped */ }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setStep('recording');
    } catch {
      setError('Could not start recording. Make sure you are using Chrome or Edge.');
    }
  }, [step]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
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

    const selectedLabels = topics
      .filter(t => selectedTopics.includes(t.id))
      .map(t => t.label);

    try {
      const res = await apiPost<{ formatted: string }>(
        '/api/v1/teacher/notes/format-session',
        {
          raw_transcript: raw,
          section_id: sectionId,
          topics_covered: selectedLabels,
          session_date: today,
        },
        token
      );
      setFormattedNotes(res.formatted);
      setOriginalFormatted(res.formatted);
      setFormattedEdited(false);
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
      // Save note with today's date so it maps to the correct day's plan
      await apiPost('/api/v1/teacher/notes', {
        note_text: content,
        note_date: today,                          // maps to today's plan date
        chunk_ids: selectedTopics,                 // links to specific topics
        note_type: 'session_transcript',
        ...(sectionId ? { section_id: sectionId } : {}),
      }, token);
      setStep('done');
      setSendMsg('✅ Session notes sent to parents and saved against today\'s plan!');
    } catch (e: any) {
      setError(e.message || 'Failed to send notes.');
      setStep('formatted');
    }
  }

  function downloadTranscript() {
    const content = formattedNotes || editedTranscript;
    const selectedLabels = topics.filter(t => selectedTopics.includes(t.id)).map(t => t.label);
    const header = `Session Notes — ${dateLabel}\nTopics: ${selectedLabels.join(', ') || 'Not specified'}\n${'─'.repeat(50)}\n\n`;
    const blob = new Blob([header + content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-notes-${today}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={step === 'setup' || step === 'done' ? onClose : undefined}>
      <div className="relative w-full lg:w-[600px] lg:max-h-[90vh] bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
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
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* ── Date bar — always visible ── */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-neutral-50 border-b border-neutral-100 shrink-0">
          <Calendar size={13} className="text-neutral-400 shrink-0" />
          <span className="text-xs font-semibold text-neutral-700">{dateLabel}</span>
        </div>

        {/* ── Test mode notice ── */}
        <div className="mx-5 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 shrink-0">
          <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Test Mode:</strong> Uses browser speech recognition (Chrome/Edge). Works best in English. Full multilingual support in Phase 2.
          </p>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── SETUP — topic selection ── */}
          {step === 'setup' && (
            <div className="space-y-4">
              {/* Topic selector */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen size={14} className="text-neutral-500" />
                  <p className="text-sm font-semibold text-neutral-800">Select topics you are covering today</p>
                </div>
                {topics.length === 0 ? (
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3">
                    <p className="text-xs text-neutral-500 italic">No topics found for today's plan. You can still record — topics will be marked as "General Session".</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topics.map(topic => (
                      <button key={topic.id} onClick={() => toggleTopic(topic.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                          selectedTopics.includes(topic.id)
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-neutral-200 bg-white hover:border-neutral-300'
                        }`}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selectedTopics.includes(topic.id)
                            ? 'border-emerald-500 bg-emerald-500'
                            : 'border-neutral-300'
                        }`}>
                          {selectedTopics.includes(topic.id) && (
                            <CheckCircle2 size={12} className="text-white" />
                          )}
                        </div>
                        <span className="text-sm text-neutral-800 font-medium">{topic.label}</span>
                      </button>
                    ))}
                    <button onClick={() => setSelectedTopics(topics.map(t => t.id))}
                      className="text-xs text-emerald-600 font-semibold hover:underline">
                      Select all
                    </button>
                  </div>
                )}
              </div>

              {/* Instructions */}
              {isSupported ? (
                <div className="space-y-2">
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
              ) : (
                <div className="flex flex-col items-center py-6 text-center gap-3">
                  <MicOff size={36} className="text-neutral-300" />
                  <p className="text-sm font-semibold text-neutral-700">Browser not supported</p>
                  <p className="text-xs text-neutral-400 max-w-xs">Session recording requires Chrome or Edge. Please open this page in Chrome.</p>
                </div>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          )}

          {/* ── RECORDING ── */}
          {step === 'recording' && (
            <div className="space-y-3">
              {/* Selected topics reminder */}
              {selectedTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {topics.filter(t => selectedTopics.includes(t.id)).map(t => (
                    <span key={t.id} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      {t.label}
                    </span>
                  ))}
                </div>
              )}

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
              <div className="min-h-[200px] max-h-[280px] overflow-y-auto bg-neutral-50 border border-neutral-200 rounded-xl p-4">
                <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
                  {finalText}
                  {liveText && <span className="text-neutral-400 italic">{liveText}</span>}
                  {!finalText && !liveText && (
                    <span className="text-neutral-400 italic">Listening… start speaking</span>
                  )}
                </p>
              </div>
              <p className="text-xs text-neutral-400 text-center">Speak naturally. Tap Stop when done.</p>
            </div>
          )}

          {/* ── REVIEW ── */}
          {step === 'review' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
                  <Edit3 size={14} className="text-neutral-500" />
                  Review & Edit Transcript
                </p>
                <span className="text-xs text-neutral-400">{wordCount} words · {formatDuration(duration)}</span>
              </div>

              {/* Topics covered summary */}
              {selectedTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-xs text-emerald-700 font-semibold mr-1">Topics:</span>
                  {topics.filter(t => selectedTopics.includes(t.id)).map(t => (
                    <span key={t.id} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{t.label}</span>
                  ))}
                </div>
              )}

              <p className="text-xs text-neutral-500">Fix any errors before sending to Oakie for formatting.</p>
              <textarea
                value={editedTranscript}
                onChange={e => setEditedTranscript(e.target.value)}
                rows={9}
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
              <p className="text-xs text-neutral-400 text-center">Converting your transcript into clean, structured class notes for parents.</p>
            </div>
          )}

          {/* ── FORMATTED ── */}
          {step === 'formatted' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-emerald-600" />
                <p className="text-sm font-semibold text-neutral-800">Formatted Notes</p>
                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${formattedEdited ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {formattedEdited ? '✏️ Edited' : 'Ready to send'}
                </span>
              </div>
              <p className="text-xs text-neutral-400">Edit directly below. Changes are highlighted.</p>

              {/* Date + topics header */}
              <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <Calendar size={11} />
                  <span className="font-medium">{dateLabel}</span>
                </div>
                {selectedTopics.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {topics.filter(t => selectedTopics.includes(t.id)).map(t => (
                      <span key={t.id} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">{t.label}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-1 max-h-[260px] overflow-y-auto">
                <textarea
                  value={formattedNotes}
                  onChange={e => {
                    setFormattedNotes(e.target.value);
                    setFormattedEdited(e.target.value !== originalFormatted);
                  }}
                  rows={10}
                  className="w-full bg-transparent px-3 py-3 text-sm text-neutral-800 leading-relaxed focus:outline-none resize-none"
                  placeholder="Formatted notes will appear here..."
                />
              </div>
              {formattedEdited && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="text-blue-500 text-sm shrink-0">✏️</span>
                  <p className="text-xs text-blue-700">You've edited the notes. You can re-format with Oakie or send as-is.</p>
                </div>
              )}
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
              <p className="text-xs text-neutral-500 max-w-xs">
                Session notes saved against <strong>{dateLabel}</strong> and sent to parents. Notes auto-expire after 14 days.
              </p>
              {sendMsg && <p className="text-xs text-emerald-600 font-medium">{sendMsg}</p>}
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div className="px-5 py-4 border-t border-neutral-100 shrink-0 space-y-2">

          {step === 'setup' && isSupported && (
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
                <button onClick={() => { setStep('setup'); setFinalText(''); setEditedTranscript(''); setDuration(0); }}
                  className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-colors">
                  Record Again
                </button>
              </div>
            </div>
          )}

          {step === 'formatted' && (
            <div className="space-y-2">
              {/* Primary action changes based on whether notes were edited */}
              {formattedEdited ? (
                <button onClick={formatWithOakie} disabled={!formattedNotes.trim()}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
                  ✨ Re-format with Oakie
                </button>
              ) : (
                <button onClick={sendToParents}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
                  <Send size={16} /> Send to Parents
                </button>
              )}
              {/* If edited, also show send-as-is option */}
              {formattedEdited && (
                <button onClick={sendToParents}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors text-sm">
                  <Send size={14} /> Send As-Is to Parents
                </button>
              )}
              <div className="flex gap-2">
                <button onClick={downloadTranscript}
                  className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl flex items-center justify-center gap-1.5 hover:bg-neutral-50 transition-colors">
                  <Download size={14} /> Download
                </button>
                <button onClick={() => setStep('review')}
                  className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 text-sm font-medium rounded-xl hover:bg-neutral-50 transition-colors">
                  ← Raw Transcript
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

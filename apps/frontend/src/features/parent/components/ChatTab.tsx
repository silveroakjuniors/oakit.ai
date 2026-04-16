'use client';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import VoiceMicButton from '@/components/VoiceMicButton';
import type { ChatMsg } from '../types';

export default function ChatTab({ msgs, input, loading, onInput, onSend, endRef, childName, token, voiceEnabled, voiceLanguage }: {
  msgs: ChatMsg[]; input: string; loading: boolean;
  onInput: (v: string) => void; onSend: () => void;
  endRef: React.RefObject<HTMLDivElement>; childName: string;
  token: string; voiceEnabled?: boolean; voiceLanguage?: string;
}) {
  const { state: voiceState, error: voiceError, startRecording, stopRecording, isSupported } = useVoiceInput({
    token,
    language: voiceLanguage || 'en',
    onTranscript: (text) => {
      onInput(text);
    },
    onResponse: (data) => {
      // If demo mode, auto-send the mock transcript
      if (data?.demo_mode && data?.transcript) {
        onInput(data.transcript);
      }
    },
  });

  const showMic = isSupported;
  const isRecording = voiceState === 'recording';
  const isProcessing = voiceState === 'processing';

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] lg:h-[600px] bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 bg-[#0f2417] text-white flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Sparkles size={16} className="text-emerald-300" />
        </div>
        <div>
          <p className="font-bold text-sm">Oakie AI</p>
          <p className="text-xs text-white/50">Ask about {childName}</p>
        </div>
        {showMic && (
          <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            🎤 Voice
          </span>
        )}
      </div>

      {/* Recording banner — shown when actively recording */}
      {isRecording && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-sm font-semibold text-red-700">Listening… speak now</span>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors"
          >
            Stop
          </button>
        </div>
      )}

      {/* Processing banner */}
      {isProcessing && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200">
          <Loader2 size={14} className="animate-spin text-amber-600 shrink-0" />
          <span className="text-sm font-semibold text-amber-700">Transcribing your voice…</span>
        </div>
      )}

      {/* Voice error banner */}
      {voiceState === 'error' && voiceError && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border-b border-red-200">
          <span className="text-red-500 text-sm">⚠️</span>
          <span className="text-xs text-red-700 font-medium">{voiceError}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-50/50">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white text-neutral-800 shadow-sm border border-neutral-100 rounded-bl-sm'}`}>
              <p className="whitespace-pre-wrap">{m.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-neutral-100 rounded-bl-sm">
              <Loader2 size={16} className="animate-spin text-neutral-400" />
            </div>
          </div>
        )}
        {msgs.length <= 1 && !isRecording && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {[`What did ${childName} study today?`, `How is ${childName}'s attendance?`, `Any homework today?`].map(q => (
                <button key={q} onClick={() => onInput(q)}
                  className="text-xs bg-white border border-neutral-200 text-neutral-600 px-3 py-2 rounded-full hover:bg-neutral-50 transition-colors">
                  {q}
                </button>
              ))}
            </div>
            {showMic && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <span className="text-base">🎤</span>
                <p className="text-xs text-emerald-700">
                  <strong>Voice tip:</strong> Tap the mic button below, speak your question, then tap <strong>Stop</strong> when done.
                </p>
              </div>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 bg-white border-t border-neutral-100">
        {/* When recording — show big stop button */}
        {isRecording ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-sm text-red-700 font-medium">Recording… tap Stop when done</span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
            >
              ⏹ Stop
            </button>
          </div>
        ) : (
          <div className="flex gap-2 items-end">
            {showMic && (
              <VoiceMicButton
                state={voiceState}
                onStart={startRecording}
                onStop={stopRecording}
                size="sm"
              />
            )}
            <input
              value={input}
              onChange={e => onInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              placeholder={isProcessing ? 'Transcribing…' : `Ask about ${childName}…`}
              maxLength={300}
              disabled={isProcessing}
              className="flex-1 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
            />
            <button
              onClick={onSend}
              disabled={!input.trim() || loading || isProcessing}
              className="px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center gap-1.5 min-w-[52px] justify-center shrink-0"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

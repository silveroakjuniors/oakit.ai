'use client';
import { Loader2, Send, Mic } from 'lucide-react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import VoiceMicButton from '@/components/VoiceMicButton';
import type { ChatMsg } from '../types';

// ── Design tokens ──────────────────────────────────────────────────────────────
const P = {
  brand:       '#1F7A5A',
  brandDark:   '#166A4D',
  brandSoft:   '#E8F3EF',
  brandBorder: '#A7D4C0',
  bg:          '#F8FAFC',
  card:        '#F8FAFC',
  border:      '#E4E4E7',
  text:        '#18181B',
  textSub:     '#3F3F46',
  textMuted:   '#71717A',
};

const cardStyle: React.CSSProperties = {
  background: P.card,
  border: `1px solid ${P.border}`,
  borderRadius: 12,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
};

export default function ChatTab({ msgs, input, loading, onInput, onSend, endRef, childName, token, voiceEnabled, voiceLanguage }: {
  msgs: ChatMsg[]; input: string; loading: boolean;
  onInput: (v: string) => void; onSend: () => void;
  endRef: React.RefObject<HTMLDivElement>; childName: string;
  token: string; voiceEnabled?: boolean; voiceLanguage?: string;
}) {
  const { state: voiceState, error: voiceError, startRecording, stopRecording, isSupported } = useVoiceInput({
    token, language: voiceLanguage || 'en',
    onTranscript: (text) => onInput(text),
    onResponse: (data) => { if (data?.demo_mode && data?.transcript) onInput(data.transcript); },
  });

  const isRecording  = voiceState === 'recording';
  const isProcessing = voiceState === 'processing';

  return (
    <div className="flex flex-col overflow-hidden"
      style={{ ...cardStyle, height: 'calc(100vh - 280px)', minHeight: 480 }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: P.brandSoft, borderBottom: `1px solid ${P.brandBorder}` }}>
        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white">
          <img src="/oakie.png" alt="Oakie" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: P.brandDark }}>Oakie AI</p>
          <p className="text-xs" style={{ color: P.brand }}>Ask about {childName}</p>
        </div>
        {isSupported && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: P.brandSoft, color: P.brand, border: `1px solid ${P.brandBorder}` }}>
            Voice
          </span>
        )}
      </div>

      {/* Status banners */}
      {isRecording && (
        <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
          style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-red-700">Listening… speak now</span>
          </div>
          <button onClick={stopRecording}
            className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg">Stop</button>
        </div>
      )}
      {isProcessing && (
        <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
          style={{ background: '#FFFBEB', borderBottom: '1px solid #FDE68A' }}>
          <Loader2 size={14} className="animate-spin text-amber-600" />
          <span className="text-sm font-medium text-amber-700">Transcribing…</span>
        </div>
      )}
      {voiceState === 'error' && voiceError && (
        <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
          style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
          <span className="text-xs text-red-700 font-medium">{voiceError}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: P.bg }}>
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role === 'ai' && (
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mt-0.5 border border-neutral-200">
                <img src="/oakie.png" alt="Oakie" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="max-w-xs px-4 py-2.5 text-sm"
              style={m.role === 'ai'
                ? { background: P.card, color: P.text, borderRadius: '16px 16px 16px 4px', border: `1px solid ${P.border}`, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
                : { background: P.brand, color: '#fff', borderRadius: '16px 16px 4px 16px' }}>
              <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-3" style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: '16px 16px 16px 4px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <Loader2 size={16} className="animate-spin" style={{ color: P.brand }} />
            </div>
          </div>
        )}
        {msgs.length <= 1 && !isRecording && (
          <div className="flex flex-wrap gap-2 mt-2">
            {[`What did ${childName} study today?`, `How is ${childName}'s attendance?`, `Any homework today?`].map(q => (
              <button key={q} onClick={() => onInput(q)}
                className="text-xs px-3 py-2 rounded-full transition-colors hover:bg-neutral-100"
                style={{ background: P.card, border: `1px solid ${P.border}`, color: P.textSub }}>
                {q}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 flex-shrink-0"
        style={{ background: P.card, borderTop: `1px solid ${P.border}` }}>
        {isRecording ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-red-700 font-medium">Recording… tap Stop when done</span>
            </div>
            <button onClick={stopRecording}
              className="px-4 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5">
              Stop
            </button>
          </div>
        ) : (
          <div className="flex gap-2 items-end">
            {isSupported && (
              <VoiceMicButton state={voiceState} onStart={startRecording} onStop={stopRecording} size="sm" />
            )}
            <input value={input} onChange={e => onInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              placeholder={isProcessing ? 'Transcribing…' : `Ask Oakie about ${childName}…`}
              maxLength={300} disabled={isProcessing}
              className="flex-1 px-4 py-2.5 text-sm rounded-xl outline-none disabled:opacity-50"
              style={{ background: P.bg, border: `1.5px solid ${P.border}`, color: P.text }} />
            <button onClick={onSend} disabled={!input.trim() || loading || isProcessing}
              className="px-4 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-40 flex items-center gap-1.5 min-w-[52px] justify-center text-white"
              style={{ background: P.brand }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

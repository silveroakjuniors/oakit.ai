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
  const { state: voiceState, startRecording, stopRecording, isSupported } = useVoiceInput({
    token,
    language: voiceLanguage || 'en',
    onTranscript: (text) => {
      onInput(text);
    },
  });

  const showMic = voiceEnabled && isSupported;
  return (
    <div className="flex flex-col h-[calc(100vh-280px)] lg:h-[600px] bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-[#0f2417] text-white flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Sparkles size={16} className="text-emerald-300" />
        </div>
        <div>
          <p className="font-bold text-sm">Oakie AI</p>
          <p className="text-xs text-white/50">Ask about {childName}</p>
        </div>
      </div>
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
        {msgs.length <= 1 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {[`What did ${childName} study today?`, `How is ${childName}'s attendance?`, `Any homework today?`].map(q => (
              <button key={q} onClick={() => onInput(q)}
                className="text-xs bg-white border border-neutral-200 text-neutral-600 px-3 py-2 rounded-full hover:bg-neutral-50 transition-colors">
                {q}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="px-4 py-3 bg-white border-t border-neutral-100 flex gap-2 items-center">
        {showMic && (
          <VoiceMicButton
            state={voiceState}
            onStart={startRecording}
            onStop={stopRecording}
            size="sm"
          />
        )}
        <input value={input} onChange={e => onInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={`Ask about ${childName}...`} maxLength={300}
          className="flex-1 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
        <button onClick={onSend} disabled={!input.trim() || loading}
          className="px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center gap-1.5 min-w-[52px] justify-center">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}

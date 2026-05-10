'use client';
import { useState, useRef, useEffect, FormEvent } from 'react';
import { X, Send, Sparkles, Minimize2 } from 'lucide-react';
import { apiPost } from '@/lib/api';
import type { Message } from './types';

const SUGGESTED = [
  'Which sections are lagging behind?',
  "Who hasn't submitted attendance today?",
  'What is the overall curriculum progress?',
  'Which teachers have low engagement?',
  'Show me pending fee collections',
];

interface Props {
  initialMessages: Message[];
  token: string;
}

export default function OakieFloatingChat({ initialMessages, token }: Props) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const chatEndRef              = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  // Sync initial messages when they arrive
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 100);
    }
  }, [open, messages]);

  async function sendMessage(e?: FormEvent, override?: string) {
    e?.preventDefault();
    const userMsg = (override || input).trim();
    if (!userMsg || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const res = await apiPost<{ response: string }>('/api/v1/ai/query', { text: userMsg }, token);
      setMessages(m => [...m, { role: 'assistant', text: res.response }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: 'Sorry, something went wrong. Try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ── Floating button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #1B4332, #2d6a4f)' }}
        title="Ask Oakie"
      >
        {open ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <div className="relative">
            <Sparkles className="w-6 h-6 text-white" />
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full animate-ping opacity-30"
              style={{ background: '#74c69d' }} />
          </div>
        )}
      </button>

      {/* ── Chat popup ── */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden"
          style={{ width: 380, height: 560 }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{ background: 'linear-gradient(135deg, #0a1f14, #1a3c2e)' }}>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-[#74c69d]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Ask Oakie</p>
              <p className="text-[10px] text-white/40">Attendance, coverage, any section</p>
            </div>
            <button onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <Minimize2 className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-neutral-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5 self-start"
                    style={{ background: 'linear-gradient(135deg, #1B4332, #2d6a4f)' }}>
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap shadow-sm ${
                  msg.role === 'user'
                    ? 'text-white rounded-br-sm'
                    : 'bg-white text-neutral-800 rounded-bl-sm border border-neutral-100'
                }`}
                  style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #1B4332, #2d6a4f)' } : {}}>
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mr-2"
                  style={{ background: 'linear-gradient(135deg, #1B4332, #2d6a4f)' }}>
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
                <div className="bg-white border border-neutral-100 px-3.5 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center shadow-sm">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-neutral-300 animate-bounce inline-block"
                      style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Suggested questions — only show when few messages */}
          {messages.length <= 2 && (
            <div className="px-3 py-2 bg-white border-t border-neutral-100 flex flex-col gap-1 shrink-0">
              <p className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wide px-1 mb-0.5">Quick questions</p>
              <div className="flex flex-wrap gap-1">
                {SUGGESTED.slice(0, 3).map(q => (
                  <button key={q} onClick={() => sendMessage(undefined, q)}
                    className="text-[10px] px-2.5 py-1 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-[#1B4332]/30 hover:text-[#1B4332] transition-colors text-left">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={sendMessage}
            className="flex gap-2 px-3 py-3 bg-white border-t border-neutral-100 shrink-0">
            <input
              ref={inputRef}
              className="flex-1 px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]/40 bg-neutral-50 placeholder:text-neutral-400"
              placeholder="Ask about your school…"
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 hover:scale-105 active:scale-95 shrink-0"
              style={{ background: 'linear-gradient(135deg, #1B4332, #2d6a4f)' }}
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

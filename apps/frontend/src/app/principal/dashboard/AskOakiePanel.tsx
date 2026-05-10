'use client';
import { useState, useRef, FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui';
import { apiPost } from '@/lib/api';
import type { Message } from './types';

const SUGGESTED = [
  'Which sections are lagging behind?',
  "Who hasn't submitted attendance today?",
  'What is the overall curriculum progress?',
  'Which teachers have low engagement?',
];

interface Props {
  initialMessages: Message[];
  token: string;
}

export default function AskOakiePanel({ initialMessages, token }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      setMessages(m => [...m, { role: 'assistant', text: 'Sorry, try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }

  return (
    <div
      className="flex flex-col bg-white border-l border-neutral-100"
      style={{ height: '100%' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-100 shrink-0 bg-gradient-to-r from-[#1B4332]/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1B4332] to-[#2d6a4f] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-800">Ask Oakie</p>
            <p className="text-[10px] text-neutral-400">Attendance, coverage, any section</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-[#1B4332]/10 flex items-center justify-center shrink-0 mr-2 mt-0.5 self-start">
                <Sparkles className="w-3 h-3 text-[#1B4332]" />
              </div>
            )}
            <div
              className={`max-w-[85%] px-3 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#1B4332] text-white rounded-br-sm'
                  : 'bg-neutral-100 text-neutral-800 rounded-bl-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-[#1B4332]/10 flex items-center justify-center shrink-0 mr-2">
              <Sparkles className="w-3 h-3 text-[#1B4332]" />
            </div>
            <div className="bg-neutral-100 px-3 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center">
              {[0, 150, 300].map(d => (
                <span
                  key={d}
                  className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce inline-block"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested */}
      <div className="px-3 py-2 border-t border-neutral-100 flex flex-col gap-1.5 shrink-0">
        {SUGGESTED.map(q => (
          <button
            key={q}
            onClick={() => sendMessage(undefined, q)}
            className="text-left text-xs px-3 py-2 rounded-xl border border-neutral-100 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-200 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t border-neutral-100 p-3 flex gap-2 shrink-0">
        <input
          className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 bg-neutral-50 placeholder:text-neutral-400"
          placeholder="Ask about your school…"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <Button type="submit" size="sm" loading={loading} disabled={!input.trim()}>→</Button>
      </form>
    </div>
  );
}

'use client';
import { useState, useRef, FormEvent } from 'react';
import { Sparkles, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { apiPost } from '@/lib/api';
import type { Message } from './types';

const QUESTION_GROUPS = [
  {
    icon: '💰', label: 'Fees',
    questions: ['Show me fee pending details', 'Total fee collected', 'Who hasn\'t paid?', 'Show me top defaulters'],
  },
  {
    icon: '📋', label: 'Attendance',
    questions: ['Today\'s attendance summary', 'Who is absent today?', 'Which sections haven\'t submitted attendance?'],
  },
  {
    icon: '👨‍🎓', label: 'Students',
    questions: ['How many students do we have?', 'Students per class', 'Total student strength'],
  },
  {
    icon: '👩‍🏫', label: 'Teachers',
    questions: ['Which teachers haven\'t submitted their plan today?', 'Teacher activity status', 'Show me teacher streaks'],
  },
  {
    icon: '📚', label: 'Curriculum',
    questions: ['Curriculum coverage status', 'Which class is lagging behind?', 'Overall syllabus progress'],
  },
  {
    icon: '👨‍👩‍👧', label: 'Parents',
    questions: ['How many parents have logged in?', 'Parents who never logged in'],
  },
  {
    icon: '💸', label: 'Expenses',
    questions: ['Total expenses this month', 'Spending by category'],
  },
];

interface Props {
  initialMessages: Message[];
  token: string;
}

export default function AskOakiePanel({ initialMessages, token }: Props) {
  const [messages, setMessages]       = useState<Message[]>(initialMessages);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [showGuide, setShowGuide]     = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  async function sendMessage(e?: FormEvent, override?: string) {
    e?.preventDefault();
    const userMsg = (override || input).trim();
    if (!userMsg || loading) return;
    setInput('');
    setShowGuide(false);
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

  const isFirstMessage = messages.length === 0;

  return (
    <div className="flex flex-col bg-white border-l border-neutral-100" style={{ height: '100%' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-100 shrink-0 bg-gradient-to-r from-[#1B4332]/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1B4332] to-[#2d6a4f] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-neutral-800">Ask Oakie</p>
            <p className="text-[10px] text-neutral-400">Fees, attendance, coverage & more</p>
          </div>
          <button
            onClick={() => { setShowGuide(g => !g); setActiveGroup(null); }}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
              showGuide
                ? 'bg-[#1B4332] text-white border-[#1B4332]'
                : 'border-neutral-200 text-neutral-500 hover:border-[#1B4332]/40 hover:text-[#1B4332]'
            }`}
          >
            💡 Help
          </button>
        </div>
      </div>

      {/* Guide panel */}
      {showGuide ? (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 bg-neutral-50">
          <p className="text-[11px] font-semibold text-neutral-500 px-1 mb-1">
            Tap any question to ask Oakie instantly 👇
          </p>
          {QUESTION_GROUPS.map(group => (
            <div key={group.label} className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
              <button
                onClick={() => setActiveGroup(activeGroup === group.label ? null : group.label)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-neutral-50 transition-colors"
              >
                <span className="text-xs font-semibold text-neutral-700">{group.icon} {group.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${activeGroup === group.label ? 'rotate-180' : ''}`} />
              </button>
              {activeGroup === group.label && (
                <div className="border-t border-neutral-100 flex flex-col">
                  {group.questions.map(q => (
                    <button key={q} onClick={() => sendMessage(undefined, q)}
                      className="text-left text-xs px-4 py-2 text-neutral-600 hover:bg-[#1B4332]/5 hover:text-[#1B4332] transition-colors border-b border-neutral-50 last:border-0">
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Messages */
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
          {isFirstMessage && (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #1B4332, #2d6a4f)' }}>
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-neutral-800">Hi, I'm Oakie 👋</p>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  Ask me about fees, attendance,<br />students, teachers, or curriculum.
                </p>
              </div>
              <button
                onClick={() => { setShowGuide(true); setActiveGroup(null); }}
                className="text-xs font-semibold px-4 py-2 rounded-xl border-2 border-dashed border-[#1B4332]/30 text-[#1B4332] hover:bg-[#1B4332]/5 transition-colors"
              >
                💡 See what I can answer
              </button>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-[#1B4332]/10 flex items-center justify-center shrink-0 mr-2 mt-0.5 self-start">
                  <Sparkles className="w-3 h-3 text-[#1B4332]" />
                </div>
              )}
              <div className={`max-w-[85%] px-3 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#1B4332] text-white rounded-br-sm'
                  : 'bg-neutral-100 text-neutral-800 rounded-bl-sm'
              }`}>
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
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce inline-block"
                    style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t border-neutral-100 p-3 flex gap-2 shrink-0">
        <input
          className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 bg-neutral-50 placeholder:text-neutral-400"
          placeholder="Ask about fees, attendance, students…"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <Button type="submit" size="sm" loading={loading} disabled={!input.trim()}>→</Button>
      </form>
    </div>
  );
}

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

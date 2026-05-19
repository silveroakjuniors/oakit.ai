'use client';
import { useState, useRef, useEffect, FormEvent } from 'react';
import { X, Send, Sparkles, Minimize2, ChevronDown } from 'lucide-react';
import { apiPost } from '@/lib/api';
import type { Message } from './types';

// ── All questions Oakie can answer, grouped by category ──────────────────────
const QUESTION_GROUPS = [
  {
    icon: '💰',
    label: 'Fees',
    questions: [
      'Show me fee pending details',
      'What is the total fee collected?',
      'Which students haven\'t paid?',
      'Fee collection summary',
      'Show me top defaulters',
    ],
  },
  {
    icon: '📋',
    label: 'Attendance',
    questions: [
      'Today\'s attendance summary',
      'Who is absent today?',
      'Which sections haven\'t submitted attendance?',
      'Attendance percentage today',
    ],
  },
  {
    icon: '👨‍🎓',
    label: 'Students',
    questions: [
      'How many students do we have?',
      'Students per class',
      'Total student strength',
    ],
  },
  {
    icon: '👩‍🏫',
    label: 'Teachers',
    questions: [
      'Which teachers haven\'t submitted their plan today?',
      'Teacher activity status',
      'Show me teacher streaks',
      'How many teachers are active?',
    ],
  },
  {
    icon: '📚',
    label: 'Curriculum',
    questions: [
      'Curriculum coverage status',
      'Which class is lagging behind?',
      'Overall syllabus progress',
      'Coverage percentage by section',
    ],
  },
  {
    icon: '👨‍👩‍👧',
    label: 'Parents',
    questions: [
      'How many parents have logged in?',
      'Parents who never logged in',
      'Parent engagement status',
    ],
  },
  {
    icon: '💸',
    label: 'Expenses',
    questions: [
      'Total expenses this month',
      'Show me expense summary',
      'Spending by category',
    ],
  },
];

interface Props {
  initialMessages: Message[];
  token: string;
}

export default function OakieFloatingChat({ initialMessages, token }: Props) {
  const [open, setOpen]               = useState(false);
  const [messages, setMessages]       = useState<Message[]>(initialMessages);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [showGuide, setShowGuide]     = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const chatEndRef                    = useRef<HTMLDivElement>(null);
  const inputRef                      = useRef<HTMLInputElement>(null);

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
    setShowGuide(false);
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

  const isFirstMessage = messages.length === 0;

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
            <span className="absolute inset-0 rounded-full animate-ping opacity-30"
              style={{ background: '#74c69d' }} />
          </div>
        )}
      </button>

      {/* ── Chat popup ── */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden"
          style={{ width: 380, height: showGuide ? 580 : 560 }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{ background: 'linear-gradient(135deg, #0a1f14, #1a3c2e)' }}>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-[#74c69d]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Ask Oakie</p>
              <p className="text-[10px] text-white/40">Fees, attendance, coverage & more</p>
            </div>
            <button
              onClick={() => { setShowGuide(g => !g); setActiveGroup(null); }}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors mr-1"
              title="What can I ask?"
            >
              💡 Help
            </button>
            <button onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <Minimize2 className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>

          {/* ── Guide panel — shown when Help is clicked ── */}
          {showGuide ? (
            <div className="flex-1 overflow-y-auto bg-neutral-50 p-3 flex flex-col gap-2">
              <p className="text-[11px] font-semibold text-neutral-500 px-1 mb-1">
                Tap any question to ask Oakie instantly 👇
              </p>
              {QUESTION_GROUPS.map(group => (
                <div key={group.label} className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
                  <button
                    onClick={() => setActiveGroup(activeGroup === group.label ? null : group.label)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-neutral-50 transition-colors"
                  >
                    <span className="text-xs font-semibold text-neutral-700">
                      {group.icon} {group.label}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${activeGroup === group.label ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {activeGroup === group.label && (
                    <div className="border-t border-neutral-100 flex flex-col">
                      {group.questions.map(q => (
                        <button
                          key={q}
                          onClick={() => sendMessage(undefined, q)}
                          className="text-left text-xs px-4 py-2 text-neutral-600 hover:bg-[#1B4332]/5 hover:text-[#1B4332] transition-colors border-b border-neutral-50 last:border-0"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-neutral-50">
                {/* Empty state — shown before first message */}
                {isFirstMessage && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 py-6">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #1B4332, #2d6a4f)' }}>
                      <Sparkles className="w-7 h-7 text-white" />
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

              {/* Quick questions — shown after first message */}
              {!isFirstMessage && messages.length <= 3 && (
                <div className="px-3 py-2 bg-white border-t border-neutral-100 shrink-0">
                  <p className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wide px-1 mb-1">Try asking</p>
                  <div className="flex flex-wrap gap-1">
                    {['Fee pending details', 'Today\'s attendance', 'Curriculum coverage'].map(q => (
                      <button key={q} onClick={() => sendMessage(undefined, q)}
                        className="text-[10px] px-2.5 py-1 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-[#1B4332]/30 hover:text-[#1B4332] transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Input */}
          <form onSubmit={sendMessage}
            className="flex gap-2 px-3 py-3 bg-white border-t border-neutral-100 shrink-0">
            <input
              ref={inputRef}
              className="flex-1 px-3.5 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]/40 bg-neutral-50 placeholder:text-neutral-400"
              placeholder="Ask about fees, attendance, students…"
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

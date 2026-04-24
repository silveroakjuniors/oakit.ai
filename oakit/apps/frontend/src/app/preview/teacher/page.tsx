'use client';
import { useState } from 'react';

const MOBILE_TABS = [
  { id: 'plan', label: 'Plan', icon: '📋' },
  { id: 'oakie', label: 'Oakie', icon: '🤖' },
  { id: 'help', label: 'Help', icon: '❓' },
];

export default function TeacherPreview() {
  const [mobileTab, setMobileTab] = useState('plan');
  const [topics, setTopics] = useState({ english: true, math: false, circle: false, art: false });

  const toggleTopic = (k: keyof typeof topics) => setTopics(p => ({ ...p, [k]: !p[k] }));

  return (
    <div className="min-h-screen" style={{ background: '#F0FDF4', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── DESKTOP LAYOUT ── */}
      <div className="hidden md:flex flex-col h-screen overflow-hidden">
        <TeacherHeader />
        <div className="flex flex-1 overflow-hidden">
          <LeftPlanPanel topics={topics} toggleTopic={toggleTopic} />
          <CenterOakieChat />
          <RightInfoPanel />
        </div>
      </div>

      {/* ── MOBILE LAYOUT ── */}
      <div className="md:hidden flex flex-col min-h-screen pb-16">
        <TeacherHeader />
        <div className="flex-1 overflow-y-auto">
          {mobileTab === 'plan' && (
            <div className="p-4 space-y-4">
              <LeftPlanPanel topics={topics} toggleTopic={toggleTopic} />
            </div>
          )}
          {mobileTab === 'oakie' && (
            <div className="flex flex-col h-full">
              <CenterOakieChat fullScreen />
            </div>
          )}
          {mobileTab === 'help' && (
            <div className="p-4 space-y-4">
              <RightInfoPanel />
            </div>
          )}
        </div>
        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 flex justify-around items-center py-2 z-50"
          style={{ background: '#fff', borderTop: '1px solid #BBF7D0' }}>
          {MOBILE_TABS.map(t => (
            <button key={t.id} onClick={() => setMobileTab(t.id)}
              className="flex flex-col items-center gap-0.5 text-xs"
              style={{ color: mobileTab === t.id ? '#22C55E' : '#9CA3AF' }}>
              <span className="text-xl">{t.icon}</span>
              <span className="text-[10px] font-medium">{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function TeacherHeader() {
  return (
    <header className="flex items-center gap-4 px-6 py-4 flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)' }}>
      <img src="/oakie.png" alt="Oakie" className="w-14 h-14 rounded-full border-4 border-white shadow-lg" />
      <div className="flex-1">
        <p className="text-green-100 text-xs">Teacher Portal</p>
        <h1 className="text-white text-xl font-bold">Ms. Priya</h1>
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold mt-0.5"
          style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>Nursery A</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.15)' }}>
        <span className="text-xl">🔥</span>
        <div className="text-white">
          <p className="text-lg font-bold leading-none">5</p>
          <p className="text-xs opacity-80">day streak</p>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-3">
        <div className="text-right text-white">
          <p className="text-xs opacity-70">Today</p>
          <p className="text-sm font-semibold">Mon, Jan 27</p>
        </div>
      </div>
    </header>
  );
}

function LeftPlanPanel({ topics, toggleTopic }: {
  topics: Record<string, boolean>;
  toggleTopic: (k: any) => void;
}) {
  const topicList = [
    { key: 'english', label: 'English Speaking', icon: '📖' },
    { key: 'math', label: 'Math', icon: '🔢' },
    { key: 'circle', label: 'Circle Time', icon: '⭕' },
    { key: 'art', label: 'Art', icon: '🎨' },
  ];

  return (
    <aside className="md:w-64 flex-shrink-0 overflow-y-auto p-4 space-y-4"
      style={{ background: '#F0FDF4', borderRight: '1px solid #BBF7D0' }}>

      {/* Date */}
      <div className="rounded-2xl px-4 py-3" style={{ background: '#DCFCE7' }}>
        <p className="text-xs text-green-600 font-semibold">📅 Today's Plan</p>
        <p className="text-sm font-bold text-green-800">Monday, January 27</p>
      </div>

      {/* Topics Checklist */}
      <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff' }}>
        <p className="text-sm font-bold text-gray-700 mb-3">Topics Checklist</p>
        <div className="space-y-2">
          {topicList.map(t => (
            <label key={t.key} className="flex items-center gap-3 cursor-pointer group">
              <div onClick={() => toggleTopic(t.key)}
                className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  borderColor: topics[t.key] ? '#22C55E' : '#D1D5DB',
                  background: topics[t.key] ? '#22C55E' : '#fff',
                }}>
                {topics[t.key] && <span className="text-white text-xs font-bold">✓</span>}
              </div>
              <span className="text-sm" style={{ color: topics[t.key] ? '#16A34A' : '#374151',
                textDecoration: topics[t.key] ? 'line-through' : 'none' }}>
                {t.icon} {t.label}
              </span>
            </label>
          ))}
        </div>
        <button className="mt-4 w-full py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)' }}>
          ✓ Mark Complete
        </button>
      </div>

      {/* Quick Links */}
      <div className="space-y-2">
        {[
          { icon: '📝', label: 'Homework & Notes', color: '#FFF3E0', text: '#F97316' },
          { icon: '🧒', label: 'Child Journey', color: '#EDE9FE', text: '#7C3AED' },
          { icon: '📢', label: 'Class Feed', color: '#DBEAFE', text: '#2563EB' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer"
            style={{ background: l.color }}>
            <span className="text-lg">{l.icon}</span>
            <span className="text-sm font-semibold" style={{ color: l.text }}>{l.label}</span>
            <span className="ml-auto text-xs" style={{ color: l.text }}>→</span>
          </div>
        ))}
      </div>

      {/* Pending Work */}
      <div className="rounded-2xl p-3 shadow-sm" style={{ background: '#fff' }}>
        <p className="text-xs font-bold text-gray-500 mb-2">⏳ Pending from Previous Days</p>
        <div className="space-y-1">
          {['Fri: Art activity incomplete', 'Thu: Math worksheet pending'].map(p => (
            <div key={p} className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#F59E0B' }} />
              {p}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function CenterOakieChat({ fullScreen = false }: { fullScreen?: boolean }) {
  const subjects = ['English', 'Math', 'Circle Time', 'Art'];
  const messages = [
    {
      role: 'oakie',
      text: "Good morning Ms. Priya! 🌟 Ready to plan today's session for Nursery A? I've loaded last week's progress.",
    },
    {
      role: 'user',
      text: "What topics should I focus on for Math today?",
    },
    {
      role: 'oakie',
      text: "Based on last week, 6 students need more practice with number recognition (11–15). I suggest:\n✅ Number song activity\n✅ Counting with blocks\n✅ Number tracing worksheet\n\nShall I add these to today's plan?",
      chips: ['English ✓', 'Math', 'Circle Time', 'Art'],
    },
  ];

  return (
    <main className={`flex flex-col flex-1 ${fullScreen ? 'h-full' : ''}`}
      style={{ background: '#fff' }}>
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: '#BBF7D0', background: '#F0FDF4' }}>
        <img src="/oakie.png" alt="Oakie" className="w-9 h-9 rounded-full" />
        <div className="flex-1">
          <p className="text-sm font-bold text-green-800">Oakie AI Assistant</p>
          <p className="text-xs text-green-600">● Online · Nursery A</p>
        </div>
        <button className="px-3 py-1.5 rounded-xl text-xs font-semibold border"
          style={{ borderColor: '#22C55E', color: '#16A34A', background: '#fff' }}>
          📄 Raw Plan
        </button>
        <button className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
          style={{ background: '#F97316' }}>
          🎙 Record Session
        </button>
      </div>

      {/* Subject Chips */}
      <div className="flex gap-2 px-4 py-2 border-b flex-shrink-0" style={{ borderColor: '#F0FDF4' }}>
        {subjects.map(s => (
          <span key={s} className="px-3 py-1 rounded-full text-xs font-semibold cursor-pointer"
            style={{ background: '#DCFCE7', color: '#16A34A' }}>{s}</span>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role === 'oakie' && (
              <img src="/oakie.png" alt="Oakie" className="w-8 h-8 rounded-full flex-shrink-0 mt-1" />
            )}
            <div className={`max-w-sm rounded-2xl px-4 py-3 text-sm ${
              m.role === 'user'
                ? 'rounded-tr-none text-white'
                : 'rounded-tl-none'
            }`} style={{
              background: m.role === 'user' ? '#22C55E' : '#F0FDF4',
              color: m.role === 'user' ? '#fff' : '#166534',
            }}>
              <p style={{ whiteSpace: 'pre-line' }}>{m.text}</p>
              {m.chips && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {m.chips.map(c => (
                    <span key={c} className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: c.includes('✓') ? '#22C55E' : '#fff',
                               color: c.includes('✓') ? '#fff' : '#16A34A',
                               border: '1px solid #BBF7D0' }}>{c}</span>
                  ))}
                </div>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-1"
                style={{ background: '#16A34A' }}>P</div>
            )}
          </div>
        ))}
      </div>

      {/* Chat Input */}
      <div className="flex gap-2 p-4 border-t flex-shrink-0" style={{ borderColor: '#BBF7D0' }}>
        <button className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: '#DCFCE7', color: '#16A34A' }}>🎙</button>
        <input className="flex-1 rounded-xl px-3 py-2 text-sm border outline-none"
          style={{ borderColor: '#BBF7D0', background: '#F0FDF4' }}
          placeholder="Ask Oakie or describe your session..." />
        <button className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: '#22C55E' }}>Send</button>
      </div>
    </main>
  );
}

function RightInfoPanel() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const schedule: Record<string, string> = {
    Mon: 'English · Math · Circle',
    Tue: 'Art · Music · Story',
    Wed: 'Math · English · PE',
    Thu: 'Science · Art · Circle',
    Fri: 'English · Show & Tell',
    Sat: '—',
    Sun: '—',
  };

  return (
    <aside className="md:w-64 flex-shrink-0 overflow-y-auto p-4 space-y-4"
      style={{ background: '#F0FDF4', borderLeft: '1px solid #BBF7D0' }}>

      {/* Weekly Schedule */}
      <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff' }}>
        <p className="text-sm font-bold text-gray-700 mb-3">📆 Weekly Schedule</p>
        <div className="space-y-1.5">
          {days.map(d => (
            <div key={d} className="flex items-start gap-2 rounded-xl px-2 py-1.5"
              style={{ background: d === 'Mon' ? '#DCFCE7' : 'transparent' }}>
              <span className="text-xs font-bold w-7 flex-shrink-0"
                style={{ color: d === 'Mon' ? '#16A34A' : '#6B7280' }}>{d}</span>
              <span className="text-xs" style={{ color: d === 'Mon' ? '#166534' : '#9CA3AF' }}>
                {schedule[d]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Streak Card */}
      <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff' }}>
        <p className="text-sm font-bold text-gray-700 mb-3">🔥 Streak Info</p>
        <div className="flex gap-3">
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: '#FFF3E0' }}>
            <p className="text-2xl font-bold" style={{ color: '#F97316' }}>5</p>
            <p className="text-xs text-gray-500">Current</p>
          </div>
          <div className="flex-1 rounded-xl p-3 text-center" style={{ background: '#DCFCE7' }}>
            <p className="text-2xl font-bold" style={{ color: '#22C55E' }}>12</p>
            <p className="text-xs text-gray-500">Best</p>
          </div>
        </div>
        <p className="text-xs text-center text-gray-400 mt-2">Keep it up! 7 more days to beat your record 🏆</p>
      </div>

      {/* Quick Stats */}
      <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff' }}>
        <p className="text-sm font-bold text-gray-700 mb-3">📊 Quick Stats</p>
        <div className="space-y-2">
          {[
            { label: 'Topics covered today', value: '1 / 4', color: '#22C55E' },
            { label: 'Pending topics', value: '3', color: '#F59E0B' },
            { label: 'Students present', value: '18 / 20', color: '#3B82F6' },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-xs text-gray-600">{s.label}</span>
              <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Optional Resources */}
      <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff' }}>
        <p className="text-sm font-bold text-gray-700 mb-3">✨ Optional Resources</p>
        <div className="space-y-2">
          {[
            { icon: '🎵', label: 'Number Songs Library' },
            { icon: '📚', label: 'Story Book Collection' },
            { icon: '🎮', label: 'Learning Games' },
            { icon: '🖨️', label: 'Printable Worksheets' },
          ].map(r => (
            <div key={r.label} className="flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer"
              style={{ background: '#F0FDF4' }}>
              <span>{r.icon}</span>
              <span className="text-xs text-gray-600">{r.label}</span>
              <span className="ml-auto text-xs text-green-500">→</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

'use client';
import { useState } from 'react';

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#f0fdf4',
  green: '#22c55e',
  greenDk: '#16a34a',
  greenLt: '#bbf7d0',
  greenXl: '#dcfce7',
  text: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  card: '#ffffff',
};

// ── Mock Data ─────────────────────────────────────────────────────────────────
const SUBJECTS = ['Math', 'Science', 'English', 'History', 'Art', 'PE'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const TEACHER_CHAT = [
  { from: 'oakie', text: 'Good morning! Ready to plan today? 🌱' },
  { from: 'me', text: 'Yes! What should I focus on first?' },
  { from: 'oakie', text: 'You have 3 topics pending from yesterday. Want to carry them over? 📋' },
  { from: 'me', text: 'Sure, let\'s do that.' },
  { from: 'oakie', text: 'Done! I\'ve added them to today\'s plan. You\'re on a 7-day streak 🔥' },
];
const PARENT_CHAT = [
  { from: 'oakie', text: 'Hi! Arjun had a great day today 🌟' },
  { from: 'me', text: 'How did he do in Math?' },
  { from: 'oakie', text: 'He completed 4 out of 5 topics and scored well on the quiz! 📊' },
  { from: 'me', text: 'Any homework tonight?' },
  { from: 'oakie', text: 'Yes — 2 Math worksheets and reading Chapter 3 of English. Due tomorrow! 📚' },
];
const ATTENDANCE = Array.from({ length: 30 }, (_, i) => {
  const r = Math.random();
  return r > 0.85 ? 'A' : r > 0.75 ? 'L' : 'P';
});
const GOALS = [
  { label: 'Complete 20 Math topics', pct: 72 },
  { label: 'Read 5 books this term', pct: 40 },
  { label: 'Improve Science score', pct: 85 },
];
const MESSAGES = [
  { name: 'Ms. Priya', preview: 'Arjun did wonderfully in today\'s class!', time: '2h', unread: 2 },
  { name: 'School Admin', preview: 'Parent-teacher meeting on Friday at 4pm', time: '1d', unread: 0 },
  { name: 'Ms. Rekha', preview: 'Please bring the art supplies tomorrow', time: '2d', unread: 1 },
];
const TOPICS = [
  { id: 1, label: 'Fractions', done: true },
  { id: 2, label: 'Decimals', done: false },
  { id: 3, label: 'Geometry', done: true },
  { id: 4, label: 'Algebra', done: false },
  { id: 5, label: 'Statistics', done: false },
  { id: 6, label: 'Probability', done: false },
];

// ── Shared Components ─────────────────────────────────────────────────────────

function Ring({ pct, size = 80, stroke = 10, color = C.green }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.greenXl} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

function Oakie({ size = 40 }: { size?: number }) {
  return (
    <img src="/oakie.png" alt="Oakie" width={size} height={size}
      style={{ borderRadius: '50%', border: `2px solid ${C.greenLt}`, objectFit: 'cover' }} />
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 16, ...style }}>
      {children}
    </div>
  );
}

function Pill({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
      background: active ? C.green : C.greenXl, color: active ? '#fff' : C.greenDk, transition: 'all .15s',
    }}>
      {children}
    </button>
  );
}

// ── Teacher Preview ───────────────────────────────────────────────────────────

function TeacherPreview() {
  const [tab, setTab] = useState<'plan' | 'chat' | 'help'>('plan');
  const [topics, setTopics] = useState(TOPICS);
  const [chatInput, setChatInput] = useState('');
  const [chatMsgs, setChatMsgs] = useState(TEACHER_CHAT);

  const toggleTopic = (id: number) =>
    setTopics(t => t.map(x => x.id === id ? { ...x, done: !x.done } : x));

  const sendChat = () => {
    if (!chatInput.trim()) return;
    setChatMsgs(m => [...m, { from: 'me', text: chatInput }]);
    setChatInput('');
    setTimeout(() => setChatMsgs(m => [...m, { from: 'oakie', text: 'Got it! I\'ll update your plan accordingly 🌿' }]), 600);
  };

  const done = topics.filter(t => t.done).length;
  const pct = Math.round((done / topics.length) * 100);

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', maxWidth: 1100, margin: '0 auto', padding: '0 16px 80px' }}>
      {/* Main column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${C.greenDk} 0%, ${C.green} 100%)`,
          borderRadius: 20, padding: '20px 20px 16px', marginBottom: 16, color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Oakie size={52} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Good morning, Ms. Priya! 👋</div>
              <div style={{ fontSize: 13, opacity: .85 }}>Class 5A · Monday, 9 Jan 2025</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>🔥 7 streak</span>
              <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>⭐ 340 XP</span>
              <span style={{ background: 'rgba(255,255,255,.25)', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>✅ 92% attendance</span>
            </div>
          </div>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { icon: '📚', label: 'Topics Today', val: '6' },
              { icon: '✅', label: 'Done', val: `${done}/${topics.length}` },
              { icon: '🔥', label: 'Streak', val: '7 days' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,.15)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 22 }}>{s.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{s.val}</div>
                <div style={{ fontSize: 11, opacity: .8 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['plan', 'chat', 'help'] as const).map(t => (
            <Pill key={t} active={tab === t} onClick={() => setTab(t)}>
              {t === 'plan' ? '📋 Plan' : t === 'chat' ? '🤖 Oakie' : '❓ Help'}
            </Pill>
          ))}
        </div>

        {/* Plan tab */}
        {tab === 'plan' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative', width: 80, height: 80 }}>
                <Ring pct={pct} size={80} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, color: C.greenDk }}>
                  {pct}%
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>Today's Progress</div>
                <div style={{ color: C.muted, fontSize: 13 }}>{done} of {topics.length} topics completed</div>
                <div style={{ marginTop: 6 }}>
                  <Pill active>{done > 0 ? '🚀 On track!' : '⏳ Let\'s start'}</Pill>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ fontWeight: 700, marginBottom: 12, color: C.text }}>📚 Today's Topics</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                {topics.map(t => (
                  <button key={t.id} onClick={() => toggleTopic(t.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                    borderRadius: 12, border: `2px solid ${t.done ? C.green : C.border}`,
                    background: t.done ? C.greenXl : C.card, cursor: 'pointer', textAlign: 'left',
                    transition: 'all .15s',
                  }}>
                    <span style={{ fontSize: 18 }}>{t.done ? '✅' : '⭕'}</span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: t.done ? C.greenDk : C.text }}>{t.label}</span>
                  </button>
                ))}
              </div>
              <button style={{
                marginTop: 14, width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                background: `linear-gradient(90deg, ${C.greenDk}, ${C.green})`, color: '#fff',
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}>
                Submit Today's Plan ✅
              </button>
            </Card>

            <Card>
              <div style={{ fontWeight: 700, marginBottom: 10, color: C.text }}>⏳ Pending Work</div>
              {['Review Algebra homework', 'Upload Science worksheet', 'Mark attendance'].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 16 }}>📌</span>
                  <span style={{ fontSize: 14, color: C.text }}>{item}</span>
                  <button style={{ marginLeft: 'auto', fontSize: 12, color: C.green, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Done</button>
                </div>
              ))}
            </Card>

            <Card>
              <div style={{ fontWeight: 700, marginBottom: 10, color: C.text }}>⚡ Quick Links</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['📊 Reports', '📅 Calendar', '👥 Students', '📝 Homework', '🔔 Alerts'].map(l => (
                  <Pill key={l}>{l}</Pill>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Chat tab */}
        {tab === 'chat' && (
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, background: C.greenXl }}>
              <Oakie size={36} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Oakie AI Assistant</div>
                <div style={{ fontSize: 12, color: C.greenDk }}>🟢 Online · Your teaching companion</div>
              </div>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 280, maxHeight: 340, overflowY: 'auto' }}>
              {chatMsgs.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                  {m.from === 'oakie' && <Oakie size={28} />}
                  <div style={{
                    maxWidth: '75%', padding: '10px 14px', borderRadius: m.from === 'me' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: m.from === 'me' ? C.green : C.greenXl,
                    color: m.from === 'me' ? '#fff' : C.text, fontSize: 14,
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['What\'s pending?', 'Show streak', 'Help me plan'].map(q => (
                <button key={q} onClick={() => setChatInput(q)} style={{
                  fontSize: 12, padding: '4px 10px', borderRadius: 999, border: `1px solid ${C.green}`,
                  background: C.greenXl, color: C.greenDk, cursor: 'pointer',
                }}>{q}</button>
              ))}
            </div>
            <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Ask Oakie anything…" style={{
                  flex: 1, padding: '10px 14px', borderRadius: 999, border: `1px solid ${C.border}`,
                  fontSize: 14, outline: 'none', background: C.bg,
                }} />
              <button onClick={sendChat} style={{
                padding: '10px 18px', borderRadius: 999, border: 'none',
                background: C.green, color: '#fff', fontWeight: 700, cursor: 'pointer',
              }}>Send</button>
            </div>
          </Card>
        )}

        {/* Help tab */}
        {tab === 'help' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
              {[
                { icon: '📖', title: 'How to use Oakie', desc: 'Learn to plan lessons with AI' },
                { icon: '📊', title: 'Reading Reports', desc: 'Understand student analytics' },
                { icon: '📅', title: 'Calendar Tips', desc: 'Manage your schedule better' },
                { icon: '🎯', title: 'Setting Goals', desc: 'Track class milestones' },
              ].map(h => (
                <Card key={h.title} style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{h.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{h.title}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{h.desc}</div>
                </Card>
              ))}
            </div>
            <Card>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>📚 Resources</div>
              {['Teacher Handbook 2025', 'Curriculum Guide', 'Assessment Templates', 'Parent Communication Tips'].map(r => (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span>📄</span>
                  <span style={{ fontSize: 14, color: C.text }}>{r}</span>
                  <span style={{ marginLeft: 'auto', color: C.green, fontSize: 13, fontWeight: 600 }}>Open →</span>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>

      {/* Desktop right sidebar */}
      <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <div style={{ textAlign: 'center' }}>
            <Oakie size={56} />
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>Ms. Priya Sharma</div>
            <div style={{ color: C.muted, fontSize: 13 }}>Class 5A Teacher</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10 }}>
              <span style={{ background: C.greenXl, color: C.greenDk, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>🔥 7 streak</span>
              <span style={{ background: C.greenXl, color: C.greenDk, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>⭐ 340 XP</span>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>📅 This Week</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4 }}>
            {DAYS.map((d, i) => (
              <div key={d} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{d}</div>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i === 0 ? C.green : i < 3 ? C.greenXl : C.bg,
                  color: i === 0 ? '#fff' : C.text, fontWeight: 700, fontSize: 13, margin: '0 auto',
                }}>{i + 9}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>📋 Today's Plan</div>
          {topics.slice(0, 4).map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
              <span>{t.done ? '✅' : '⭕'}</span>
              <span style={{ fontSize: 13, color: t.done ? C.muted : C.text }}>{t.label}</span>
            </div>
          ))}
        </Card>

        <Card style={{ background: `linear-gradient(135deg, ${C.greenDk}, ${C.green})`, color: '#fff' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🔥 7-Day Streak!</div>
          <div style={{ fontSize: 13, opacity: .85 }}>Keep it up! You're in the top 10% of teachers this week.</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 4 }}>
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                🔥
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

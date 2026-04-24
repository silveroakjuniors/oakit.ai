'use client';

import { useState } from 'react';

// ── Design tokens — Beigua palette ────────────────────────────────────────
// Soft lavender-white background, vivid rounded cards, glassmorphism panels
const G: Record<number, string> = {
  900: '#3B2F8F',  // deep indigo — sidebar base
  800: '#4C3BAF',  // sidebar mid
  700: '#5B4FCF',  // sidebar light
  600: '#7C6FE8',  // primary interactive / active
  500: '#A89FF0',  // muted purple
  400: '#C8C2F8',  // very light purple
  200: '#E8E5FF',  // purple tint border
  100: '#F3F1FF',  // purple wash bg
  50:  '#F8F7FF',  // page bg
};

// Vivid card colours from the palette
const PALETTE = {
  teal:    '#2EC4B6',
  purple:  '#9B5DE5',
  amber:   '#F4B942',
  blue:    '#4A90D9',
  indigo:  '#6B7FD4',
  coral:   '#F4845F',
  pink:    '#E84393',
  violet:  '#C264E8',
  cyan:    '#3ECFCF',
  emerald: '#2ECC8A',
};

const SIDEBAR_BG = 'linear-gradient(160deg,#2A1F6E 0%,#3B2F8F 50%,#4C3BAF 100%)';
const PAGE_BG    = 'linear-gradient(135deg,#EEF0FF 0%,#F5F0FF 40%,#EAF4FF 100%)';
const CARD_BG    = 'rgba(255,255,255,0.85)';
const ACCENT     = PALETTE.teal;

const NAV_TABS = [
  { id: 'home',          label: 'Home',       icon: '🏠' },
  { id: 'attendance',    label: 'Attendance', icon: '📅' },
  { id: 'progress',      label: 'Progress',   icon: '📈' },
  { id: 'insights',      label: 'Insights',   icon: '💡' },
  { id: 'oakie',         label: 'Oakie',      icon: '✨' },
  { id: 'messages',      label: 'Messages',   icon: '💬' },
  { id: 'updates',       label: 'Updates',    icon: '🔔' },
  { id: 'settings',      label: 'Settings',   icon: '⚙️' },
];

// ── Shared primitives ──────────────────────────────────────────────────────
function Ring({ pct, color, size = 100, stroke = 10 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${(pct/100)*c} ${c}`} strokeLinecap="round" />
    </svg>
  );
}

function Card({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-2xl p-5 ${className}`}
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 2px 4px rgba(80,60,180,0.06), 0 8px 24px rgba(80,60,180,0.08), inset 0 1px 0 rgba(255,255,255,0.95)',
        border: '1px solid rgba(255,255,255,0.7)',
        ...style,
      }}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: G[600] }}>{children}</p>;
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.6)' }}>
      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}60` }} />
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div className="w-11 h-6 rounded-full relative flex-shrink-0 transition-colors"
      style={{ background: on ? PALETTE.teal : '#C8C2F8' }}>
      <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all"
        style={{ left: on ? '22px' : '2px' }} />
    </div>
  );
}

// ── Root page ──────────────────────────────────────────────────────────────
export default function ParentPreview() {
  const [tab, setTab] = useState('home');
  const unread = { messages: 3, updates: 2 };

  return (
    <div style={{ background: PAGE_BG, fontFamily: "'Inter',-apple-system,sans-serif", minHeight: '100vh' }}>

      {/* ════════════════ DESKTOP (md+) ════════════════ */}
      <div className="hidden md:flex" style={{ height: '100vh', overflow: 'hidden' }}>

        {/* Sidebar */}
        <aside className="flex flex-col flex-shrink-0 relative overflow-hidden"
          style={{ width: 220, background: 'linear-gradient(160deg,#B8D8F8 0%,#C4B8F0 50%,#B8E0F8 100%)' }}>

          {/* Soft colour blobs */}
          <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle,#7EC8F880 0%,transparent 70%)' }} />
          <div className="absolute bottom-20 -right-8 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle,#A888F870 0%,transparent 70%)' }} />

          {/* Logo */}
          <div className="relative flex items-center gap-3 px-5 py-6"
            style={{ borderBottom: '1px solid rgba(80,60,180,0.20)' }}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#A78BFA,#7C6FE8)', boxShadow: '0 4px 16px rgba(124,111,232,0.40)' }}>
              <img src="/oakie.png" alt="Oakie" className="w-7 h-7 rounded-xl object-cover" />
            </div>
            <div>
              <p className="font-black text-base leading-none tracking-tight" style={{ color: '#1E1060' }}>
                Oakit<span style={{ color: PALETTE.amber }}>.ai</span>
              </p>
              <p className="text-[10px] font-semibold mt-0.5" style={{ color: '#5B4FA0' }}>Parent Portal</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
            {NAV_TABS.map((t, i) => {
              const badge = t.id === 'messages' ? unread.messages : t.id === 'updates' ? unread.updates : 0;
              const active = tab === t.id;
              // Each nav item gets its own pastel colour
              const navColors = [
                { bg:'#93C5FD', active:'#1D4ED8', dot:'#3B82F6' },  // home — blue
                { bg:'#6EE7B7', active:'#065F46', dot:'#10B981' },  // attendance — mint
                { bg:'#FCD34D', active:'#92400E', dot:'#F59E0B' },  // progress — amber
                { bg:'#C4B5FD', active:'#4C1D95', dot:'#7C3AED' },  // insights — violet
                { bg:'#99F6E4', active:'#134E4A', dot:'#14B8A6' },  // oakie — teal
                { bg:'#F9A8D4', active:'#9D174D', dot:'#EC4899' },  // messages — pink
                { bg:'#FDBA74', active:'#7C2D12', dot:'#F97316' },  // updates — orange
                { bg:'#7DD3FC', active:'#0C4A6E', dot:'#0EA5E9' },  // settings — sky
              ];
              const c = navColors[i] || navColors[0];
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold text-left transition-all"
                  style={{
                    background: active ? c.bg : 'rgba(60,40,160,0.12)',
                    color: active ? c.active : '#4A3880',
                    boxShadow: active ? `0 2px 12px ${c.dot}40` : 'none',
                  }}>
                  {/* Coloured icon pill */}
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                    style={{ background: active ? c.active : 'rgba(107,95,160,0.10)' }}>
                    <span style={{ filter: active ? 'brightness(10)' : 'none', fontSize: 14 }}>{t.icon}</span>
                  </div>
                  <span className="flex-1">{t.label}</span>
                  {badge > 0 && (
                    <span className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center text-white"
                      style={{ background: c.active }}>{badge}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Child card */}
          <div className="px-3 pb-4 pt-3" style={{ borderTop: '1px solid rgba(80,60,180,0.18)' }}>
            <div className="flex items-center gap-3 px-3 py-3 rounded-2xl"
              style={{ background: 'linear-gradient(135deg,#C4B5FD,#93C5FD)', border: '1px solid rgba(109,40,217,0.30)' }}>
              <div className="relative flex-shrink-0">
                <img src="/oakie.png" alt="child" className="w-9 h-9 rounded-full"
                  style={{ border: '2px solid #A78BFA' }} />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                  style={{ background: PALETTE.emerald }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate" style={{ color: '#1E1060' }}>Aryan Sharma</p>
                <p className="text-[10px] truncate" style={{ color: '#5B4FA0' }}>Nursery A · Sec B</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto" style={{ background: PAGE_BG }}>
          <div className="p-6 space-y-5 max-w-3xl">
            <DesktopHeader />
            <StatsRow />
            {tab === 'home'       && <HomeContent />}
            {tab === 'attendance' && <AttendanceContent />}
            {tab === 'progress'   && <ProgressContent />}
            {tab === 'insights'   && <InsightsContent />}
            {tab === 'oakie'      && <OakieChatContent />}
            {tab === 'messages'   && <MessagesContent />}
            {tab === 'updates'    && <UpdatesContent />}
            {tab === 'settings'   && <SettingsContent />}
          </div>
        </main>

        {/* Photo feed column */}
        <aside className="flex-shrink-0 flex flex-col overflow-hidden"
          style={{ width: 440, borderLeft: '1px solid rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.7)' }}>
            <div>
              <p className="text-sm font-black" style={{ color: G[900] }}>📸 Class Feed</p>
              <p className="text-xs" style={{ color: G[600] }}>Photos from school today</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: PALETTE.teal, color: '#fff' }}>
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Live
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {FEED_PHOTOS.map(p => (
              <div key={p.id} className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.8)',
                         boxShadow: '0 4px 16px rgba(91,79,207,0.10)' }}>
                <div className="flex items-center justify-center relative"
                  style={{ height: 200, background: p.bg }}>
                  <span style={{ fontSize: 88 }}>{p.emoji}</span>
                  <span className="absolute bottom-3 left-3 text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.92)', color: G[900],
                             boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}>{p.label}</span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm leading-snug mb-2" style={{ color: '#1A1A2E' }}>{p.caption}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium" style={{ color: G[600] }}>by {p.teacher}</p>
                      <p className="text-[11px]" style={{ color: G[500] }}>{p.time}</p>
                    </div>
                    <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl"
                      style={{ background: PALETTE.pink + '18', color: PALETTE.pink, border: `1px solid ${PALETTE.pink}30` }}>
                      ❤️ {p.likes}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Right panel */}
        <aside className="flex-shrink-0 overflow-y-auto p-4 space-y-4"
          style={{ width: 220, background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(20px)', borderLeft: '1px solid rgba(255,255,255,0.6)' }}>
          <RightPanel />
        </aside>
      </div>

      {/* ════════════════ MOBILE ════════════════ */}
      <div className="md:hidden flex flex-col" style={{ minHeight: '100vh', paddingBottom: 72 }}>
        <MobileHeader />
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <StatsRow />
          {tab === 'home'       && <HomeContent />}
          {tab === 'attendance' && <AttendanceContent />}
          {tab === 'progress'   && <ProgressContent />}
          {tab === 'insights'   && <InsightsContent />}
          {tab === 'oakie'      && <OakieChatContent />}
          {tab === 'messages'   && <MessagesContent />}
          {tab === 'updates'    && <UpdatesContent />}
          {tab === 'settings'   && <SettingsContent />}
        </div>
        {/* Bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 flex z-50"
          style={{ background: 'rgba(255,255,255,0.92)', borderTop: '1px solid rgba(255,255,255,0.6)', paddingBottom: 'env(safe-area-inset-bottom)',
                   boxShadow: '0 -4px 20px rgba(91,79,207,0.10)', backdropFilter: 'blur(20px)' }}>
          {NAV_TABS.map(t => {
            const active = tab === t.id;
            const badge = t.id === 'messages' ? 3 : t.id === 'updates' ? 2 : 0;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex-1 flex flex-col items-center py-2 gap-0.5 relative">
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full" style={{ background: G[500] }} />}
                <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                  style={{ background: active ? G[500] : 'transparent' }}>
                  <span className="text-base leading-none">{t.icon}</span>
                </div>
                <span className="text-[9px] font-semibold" style={{ color: active ? G[600] : '#9CA3AF' }}>{t.label}</span>
                {badge > 0 && (
                  <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center"
                    style={{ background: '#C0392B', color: '#fff' }}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// ── Headers ────────────────────────────────────────────────────────────────
function DesktopHeader() {
  return (
    <div className="rounded-2xl p-6 flex items-center gap-5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg,#3B2F8F 0%,#5B4FCF 50%,#7C6FE8 100%)',
        boxShadow: '0 8px 40px rgba(91,79,207,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
      }}>
      {/* Blobs */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${PALETTE.teal}30 0%, transparent 65%)` }} />
      <div className="absolute -bottom-8 left-1/3 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${PALETTE.pink}20 0%, transparent 65%)` }} />
      {/* Oakie */}
      <div className="absolute top-2 right-4 pointer-events-none">
        <img src="/oakie.png" alt="" className="w-20 h-20 object-contain"
          style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.3))' }} />
      </div>
      {/* Avatar */}
      <div className="w-16 h-16 rounded-2xl flex-shrink-0 overflow-hidden"
        style={{ border: '2px solid rgba(255,255,255,0.4)', boxShadow: '0 0 24px rgba(255,255,255,0.2)' }}>
        <img src="/oakie.png" alt="child" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Welcome back 👋</p>
        <h1 className="text-white text-2xl font-black tracking-tight">Aryan Sharma</h1>
        <div className="flex items-center gap-2 mt-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>Nursery A · Section B</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
            style={{ background: PALETTE.emerald, color: '#fff' }}>✓ Present</span>
        </div>
      </div>
      <div className="text-right hidden lg:block flex-shrink-0 mr-20">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>Monday</p>
        <p className="text-white font-bold text-sm mt-0.5">Jan 27, 2026</p>
        <p className="text-xs mt-1" style={{ color: PALETTE.amber }}>Arrived 8:45 AM</p>
      </div>
    </div>
  );
}

function MobileHeader() {
  return (
    <div className="flex items-center gap-3 px-4 py-5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg,#3B2F8F 0%,#5B4FCF 55%,#7C6FE8 100%)',
        boxShadow: '0 4px 24px rgba(91,79,207,0.4)',
      }}>
      <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${PALETTE.teal}25 0%, transparent 65%)` }} />
      <div className="absolute right-3 bottom-0 pointer-events-none">
        <img src="/oakie.png" alt="" className="w-16 h-16 object-contain"
          style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }} />
      </div>
      <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden"
        style={{ border: '2px solid rgba(255,255,255,0.4)', boxShadow: '0 0 16px rgba(255,255,255,0.15)' }}>
        <img src="/oakie.png" alt="child" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Welcome back 👋</p>
        <h1 className="text-white text-xl font-black tracking-tight">Aryan Sharma</h1>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>Nursery A</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: G[500], color: '#fff' }}>✓ Present</span>
        </div>
      </div>
    </div>
  );
}

// ── Stats row ──────────────────────────────────────────────────────────────
function StatsRow() {
  const stats = [
    { label: 'Attendance', value: '92%', color: '#fff', bg: PALETTE.teal,    shadow: PALETTE.teal },
    { label: 'Progress',   value: '74%', color: '#fff', bg: PALETTE.amber,   shadow: PALETTE.amber },
    { label: 'Messages',   value: '3',   color: '#fff', bg: PALETTE.purple,  shadow: PALETTE.purple },
    { label: 'Updates',    value: '2',   color: '#fff', bg: PALETTE.coral,   shadow: PALETTE.coral },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map(s => (
        <div key={s.label} className="rounded-2xl p-4 text-center"
          style={{ background: s.bg, boxShadow: `0 4px 20px ${s.shadow}50` }}>
          <p className="text-2xl font-black leading-none text-white">{s.value}</p>
          <p className="text-[11px] font-semibold mt-1 text-white/80">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Home ───────────────────────────────────────────────────────────────────
function HomeContent() {
  return (
    <div className="space-y-4">
      {/* Today's feed */}
      <Card>
        <Label>📋 Today's Feed</Label>
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: G[100], color: '#5C4A1E' }}>✓ Present · 8:45 AM</span>
          <span className="text-xs" style={{ color: '#9B8A6A' }}>On time</span>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9B8A6A' }}>Today's Topics</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {['📖 English','🔢 Math','⭕ Circle Time','🎨 Art'].map(t => (
            <span key={t} className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: G[100], color: '#5C4A1E', border: `1px solid ${G[100]}` }}>{t}</span>
          ))}
        </div>
        <div className="rounded-xl p-4" style={{ background: G[100], border: `1px solid ${G[100]}` }}>
          <p className="text-xs font-bold mb-1.5" style={{ color: '#5C4A1E' }}>📝 Homework</p>
          <p className="text-sm text-stone-600 leading-relaxed">Practice counting 1–20 using the number chart. Read pages 4–6 of the English reader. Bring a leaf for tomorrow's nature activity.</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Progress ring */}
        <Card>
          <Label>📊 Curriculum Progress</Label>
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center flex-shrink-0">
              <Ring pct={74} color={G[500]} size={88} stroke={9} />
              <div className="absolute text-center">
                <p className="text-xl font-black leading-none" style={{ color: ACCENT }}>74%</p>
              </div>
            </div>
            <div className="space-y-2.5 flex-1">
              {[['English',80,'#3B82F6'],['Math',70,'#D97706'],['Art',65,'#7C3AED']].map(([s,v,c]) => (
                <div key={s as string}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-500 font-medium">{s as string}</span>
                    <span className="font-bold" style={{ color: c as string }}>{v as number}%</span>
                  </div>
                  <Bar pct={v as number} color={c as string} />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Weekly attendance */}
        <Card>
          <Label>📅 This Week</Label>
          <div className="flex justify-between mb-3">
            {[['M','✓',G[500]],['T','✓',G[500]],['W','✓',G[500]],['T','✗','#C0392B'],['F','✓',G[500]],['S','–','#D1D5DB'],['S','–','#D1D5DB']].map(([d,s,c],i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-semibold" style={{ color: '#9B8A6A' }}>{d as string}</span>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: `${c}18`, color: c as string, border: `1.5px solid ${c}40` }}>{s as string}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 text-xs pt-2" style={{ borderTop: `1px solid ${G[100]}` }}>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{background:G[500]}}/>Present</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{background:'#C0392B'}}/>Absent</span>
            <span className="ml-auto font-bold" style={{ color: ACCENT }}>4/5 days</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Attendance ─────────────────────────────────────────────────────────────
function AttendanceContent() {
  return (
    <Card>
      <Label>📅 Attendance — January 2026</Label>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <span key={d} className="text-[10px] font-bold" style={{ color: '#9B8A6A' }}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({length:31}).map((_,i) => {
          const absent = [3,10,17].includes(i);
          const future = i > 22;
          const weekend = (i%7===5)||(i%7===6);
          return (
            <div key={i} className="aspect-square rounded-lg flex items-center justify-center text-xs font-semibold"
              style={{ background: future?'#F9FAFB':weekend?'#F3F4F6':absent?'#FEE2E2':G[100],
                       color: future?'#D1D5DB':weekend?'#9CA3AF':absent?'#C0392B':G[700] }}>
              {i+1}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-4 pt-3 text-xs" style={{ borderTop: `1px solid ${G[100]}` }}>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{background:G[500]}}/>Present (19)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{background:'#C0392B'}}/>Absent (3)</span>
        <span className="ml-auto text-sm font-black" style={{ color: ACCENT }}>92%</span>
      </div>
    </Card>
  );
}

// ── Progress ───────────────────────────────────────────────────────────────
function ProgressContent() {
  return (
    <div className="space-y-4">
      <Card>
        <Label>🎯 Goals</Label>
        {[
          { label:'Correct Pencil Grip', pct:40, color:'#D97706', cat:'Academic' },
          { label:'Classroom Focus',     pct:55, color:'#7C3AED', cat:'Behavioral' },
          { label:'Full Attendance',     pct:92, color:G[500],    cat:'Attendance' },
        ].map(g => (
          <div key={g.label} className="mb-4 last:mb-0">
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-stone-700">{g.label}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: G[100], color: '#5C4A1E', border: `1px solid ${G[100]}` }}>{g.cat}</span>
              </div>
              <span className="text-sm font-black" style={{ color: g.color }}>{g.pct}%</span>
            </div>
            <Bar pct={g.pct} color={g.color} />
          </div>
        ))}
      </Card>
      <Card>
        <Label>📊 Curriculum Coverage</Label>
        <div className="flex items-center justify-center gap-10">
          <div className="relative flex items-center justify-center">
            <Ring pct={74} color={G[500]} size={120} stroke={11} />
            <div className="absolute text-center">
              <p className="text-3xl font-black leading-none" style={{ color: ACCENT }}>74%</p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color: '#9B8A6A' }}>covered</p>
            </div>
          </div>
          <div className="space-y-4">
            {[['Total Topics','48','#374151'],['Covered','36',G[600]],['Remaining','12','#D97706']].map(([l,v,c]) => (
              <div key={l as string}>
                <p className="text-xs text-stone-400 font-medium">{l as string}</p>
                <p className="text-2xl font-black leading-tight" style={{ color: c as string }}>{v as string}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Insights ───────────────────────────────────────────────────────────────
function InsightsContent() {
  return (
    <div className="space-y-4">
      <Card>
        <Label>💡 AI Insights</Label>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: ACCENT }}>Strengths</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {['Creative Thinking ✨','Listening Skills 👂','Circle Time 🙋','Art & Craft 🎨'].map(s => (
            <span key={s} className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: G[100], color: '#5C4A1E', border: `1px solid ${G[100]}` }}>{s}</span>
          ))}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#D97706' }}>Areas for Improvement</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {['Number Recognition 🔢','Writing Grip ✏️','Focus Duration ⏱️'].map(s => (
            <span key={s} className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>{s}</span>
          ))}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#6B7280' }}>Teacher's Actions</p>
        <div className="space-y-2">
          {['Daily pencil grip exercises introduced in class','Pairing Aryan with a confident peer during group work','Monitoring afternoon energy levels'].map(f => (
            <div key={f} className="flex items-start gap-2 text-xs text-stone-500">
              <span className="flex-shrink-0 mt-0.5 font-bold" style={{ color: ACCENT }}>✓</span>{f}
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <Label>🔮 Predictions</Label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label:'Next Week Attendance', value:'95%', color:G[600] },
            { label:'End of Month Progress', value:'78%', color:'#D97706' },
            { label:'Participation Score', value:'72', color:'#2563EB' },
          ].map(p => (
            <div key={p.label} className="rounded-xl p-3 text-center"
              style={{ background: G[100], border: `1px solid ${G[100]}` }}>
              <p className="text-xl font-black" style={{ color: p.color }}>{p.value}</p>
              <p className="text-[10px] text-stone-400 mt-0.5 leading-tight">{p.label}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Oakie Chat ─────────────────────────────────────────────────────────────
function OakieChatContent() {
  return (
    <Card style={{ minHeight: 420 }} className="flex flex-col">
      <div className="flex items-center gap-3 pb-4 mb-4" style={{ borderBottom: `1px solid ${G[100]}` }}>
        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0" style={{ border: `2px solid ${G[400]}` }}>
          <img src="/oakie.png" alt="Oakie" className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="font-bold text-sm text-stone-800">Oakie AI</p>
          <p className="text-xs font-medium" style={{ color: ACCENT }}>● Online · Ready to help</p>
        </div>
        <span className="ml-auto px-2.5 py-1 rounded-full text-[10px] font-bold"
          style={{ background: G[100], color: '#5C4A1E', border: `1px solid ${G[100]}` }}>Premium</span>
      </div>
      <div className="flex-1 space-y-3 mb-4">
        {[
          { role:'ai', text:"Hi! 🌟 Aryan had a great day today! He participated actively in Circle Time and showed wonderful creativity in Art." },
          { role:'user', text:"How is he doing with numbers?" },
          { role:'ai', text:"He can count up to 15 confidently! We're working on 16–20. Try the number chart at home 📊 — even 5 minutes a day helps a lot!" },
        ].map((m,i) => (
          <div key={i} className={`flex gap-2.5 ${m.role==='user'?'justify-end':''}`}>
            {m.role==='ai' && (
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mt-0.5" style={{ border: `1.5px solid ${G[200]}` }}>
                <img src="/oakie.png" alt="Oakie" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="max-w-xs rounded-2xl px-4 py-2.5 text-sm"
              style={m.role==='ai'
                ? { background: G[100], color: G[800], borderRadius:'16px 16px 16px 4px', border:`1px solid ${G[100]}` }
                : { background: G[900], color:'#fff', borderRadius:'16px 16px 4px 16px' }}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
          style={{ background: G[100], border: `1.5px solid ${G[100]}`, color: '#374151' }}
          placeholder="Ask Oakie anything about Aryan…" readOnly />
        <button className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold"
          style={{ background: G[900], boxShadow: `0 4px 12px ${G[600]}40` }}>Send</button>
      </div>
    </Card>
  );
}

// ── Messages ───────────────────────────────────────────────────────────────
function MessagesContent() {
  return (
    <Card>
      <Label>💬 Messages</Label>
      <div className="space-y-3">
        {[
          { name:'Ms. Priya', role:'Class Teacher', msg:"Aryan did wonderfully in today's English session. Please encourage him to practice the new words at home. 😊", time:'2h ago', unread:true },
          { name:'Ms. Kavya', role:'Art Teacher', msg:'Aryan made a beautiful leaf collage today! He has a great eye for colours.', time:'Yesterday', unread:false },
        ].map(m => (
          <div key={m.name} className="rounded-xl p-4"
            style={{ background: m.unread ? G[50] : '#FAFAFA', border: `1px solid ${m.unread ? G[200] : '#F3F4F6'}` }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: G[900] }}>{m.name[3]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-800">{m.name}</p>
                <p className="text-xs text-stone-400">{m.role}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-stone-400">{m.time}</span>
                {m.unread && <span className="w-2 h-2 rounded-full" style={{ background: G[500] }} />}
              </div>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed ml-12">{m.msg}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Updates ────────────────────────────────────────────────────────────────
function UpdatesContent() {
  return (
    <div className="space-y-4">
      <Card>
        <Label>📢 Announcements</Label>
        <div className="space-y-3">
          {[
            { title:'Annual Sports Day – Feb 15', body:'All students wear sports uniform. Event starts 9 AM on the school ground.', author:'Admin', time:'Jan 25' },
            { title:'Parent-Teacher Meeting – Feb 3', body:'Scheduled from 10 AM to 1 PM. Please book your slot via the app.', author:'Principal', time:'Jan 22' },
          ].map(a => (
            <div key={a.title} className="rounded-xl p-4" style={{ background: G[100], border: `1px solid ${G[100]}` }}>
              <div className="flex items-start gap-2 mb-1.5">
                <span className="text-base flex-shrink-0">📢</span>
                <p className="text-sm font-semibold text-stone-800">{a.title}</p>
              </div>
              <p className="text-sm text-stone-500 ml-6 leading-relaxed">{a.body}</p>
              <p className="text-xs mt-2 ml-6" style={{ color: '#9B8A6A' }}>By {a.author} · {a.time}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <Label>🔔 Notifications</Label>
        <div className="space-y-1">
          {[
            { icon:'✅', text:'Aryan marked Present today at 8:45 AM', time:'8:45 AM', color:G[600] },
            { icon:'📝', text:'Homework sent by Ms. Priya for today', time:'9:00 AM', color:'#2563EB' },
            { icon:'📊', text:'Math topic covered: Counting 11–15', time:'11:30 AM', color:'#D97706' },
          ].map(n => (
            <div key={n.text} className="flex items-center gap-3 py-2.5" style={{ borderBottom: `1px solid ${G[50]}` }}>
              <span className="text-base flex-shrink-0">{n.icon}</span>
              <p className="text-sm text-stone-600 flex-1">{n.text}</p>
              <span className="text-xs flex-shrink-0" style={{ color: '#9B8A6A' }}>{n.time}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────
function SettingsContent() {
  return (
    <div className="space-y-4">
      <Card>
        <Label>🔔 Notification Preferences</Label>
        {[
          { label:'Homework Reminders', on:true,  ch:'Push · Email' },
          { label:'Attendance Alerts',  on:true,  ch:'Push' },
          { label:'Progress Updates',   on:false, ch:'Email' },
          { label:'Messages',           on:true,  ch:'Push · SMS' },
          { label:'Announcements',      on:false, ch:'Email' },
        ].map(n => (
          <div key={n.label} className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${G[50]}` }}>
            <div>
              <p className="text-sm font-medium text-stone-700">{n.label}</p>
              <p className="text-xs text-stone-400">{n.ch}</p>
            </div>
            <Toggle on={n.on} />
          </div>
        ))}
      </Card>
      <Card>
        <Label>🚨 Emergency Contacts</Label>
        {[
          { name:'Rahul Sharma', rel:'Father', phone:'+91 98765 43210', p:1 },
          { name:'Sunita Sharma', rel:'Mother', phone:'+91 87654 32109', p:2 },
        ].map(c => (
          <div key={c.name} className="flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${G[50]}` }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
              style={{ background: G[900] }}>{c.name[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-800">{c.name}</p>
              <p className="text-xs text-stone-400">{c.rel} · {c.phone}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{ background: G[100], color: '#5C4A1E' }}>P{c.p}</span>
          </div>
        ))}
      </Card>
      <Card>
        <Label>Translation Language</Label>
        <div className="flex flex-wrap gap-2">
          {['English','Hindi','Telugu','Tamil','Kannada','Malayalam'].map(l => (
            <span key={l} className="px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
              style={{ background: l==='English' ? G[600] : G[50],
                       color: l==='English' ? '#fff' : G[700],
                       border: `1px solid ${l==='English' ? G[600] : G[100]}` }}>{l}</span>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Photo feed data ────────────────────────────────────────────────────────
const FEED_PHOTOS = [
  { id:1, emoji:'🎨', bg: PALETTE.teal    + '30', label:'Art & Craft',   caption:'Aryan made a leaf collage today!',                              time:'Today · 11:20 AM', likes:5,  teacher:'Ms. Kavya' },
  { id:2, emoji:'📖', bg: PALETTE.indigo  + '30', label:'Story Time',    caption:'Listening to "The Friendly Giraffe" with full attention 🦒',    time:'Today · 10:00 AM', likes:8,  teacher:'Ms. Priya' },
  { id:3, emoji:'⭕', bg: PALETTE.violet  + '30', label:'Circle Time',   caption:'Aryan raised his hand and answered a question! 🙌',             time:'Yesterday · 9:15 AM', likes:12, teacher:'Ms. Priya' },
  { id:4, emoji:'🔢', bg: PALETTE.amber   + '30', label:'Math Activity', caption:'Counting blocks up to 15 — getting there!',                     time:'Yesterday · 11:00 AM', likes:4, teacher:'Ms. Priya' },
  { id:5, emoji:'🌿', bg: PALETTE.emerald + '30', label:'Nature Walk',   caption:"Collected leaves for tomorrow's activity 🍃",                   time:'Mon · 3:00 PM', likes:9,  teacher:'Ms. Kavya' },
];

// ── Right panel ────────────────────────────────────────────────────────────
function RightPanel() {
  const days = ['Mon','Tue','Wed','Thu','Fri'];
  const sched: Record<string,string[]> = {
    Mon:['English','Math','Circle Time'],
    Tue:['Art','Music','Story Time'],
    Wed:['Math','English','PE'],
    Thu:['Science','Art','Circle Time'],
    Fri:['English','Math','Show & Tell'],
  };
  return (
    <>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: ACCENT }}>📆 Weekly Schedule</p>
        <div className="space-y-2">
          {days.map(d => (
            <div key={d} className="rounded-xl p-3"
              style={{ background: d==='Mon' ? G[50] : '#FAFAFA', border: `1px solid ${d==='Mon' ? G[200] : '#F3F4F6'}` }}>
              <p className="text-[10px] font-bold mb-1.5" style={{ color: d==='Mon' ? G[600] : '#9CA3AF' }}>
                {d}{d==='Mon' ? ' · Today' : ''}
              </p>
              <div className="flex flex-wrap gap-1">
                {sched[d].map(s => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: G[100], color: '#5C4A1E' }}>{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: ACCENT }}>🎯 Child Goals</p>
        <div className="space-y-3">
          {[
            { label:'Pencil Grip', pct:40, color:'#D97706' },
            { label:'Participation', pct:65, color:G[500] },
            { label:'Attendance', pct:92, color:'#2563EB' },
          ].map(g => (
            <div key={g.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-stone-600">{g.label}</span>
                <span className="font-bold" style={{ color: g.color }}>{g.pct}%</span>
              </div>
              <Bar pct={g.pct} color={g.color} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: ACCENT }}>✨ Features</p>
        <div className="space-y-1.5">
          {[
            { icon:'📖', label:'Growth Journal' },
            { icon:'🗓️', label:'Calendar Sync' },
            { icon:'🎙️', label:'Voice Assistant' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer"
              style={{ background: G[100], border: `1px solid ${G[100]}` }}>
              <span className="text-base">{f.icon}</span>
              <span className="text-xs font-medium text-stone-600 flex-1">{f.label}</span>
              <span className="text-xs font-bold" style={{ color: ACCENT }}>→</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}


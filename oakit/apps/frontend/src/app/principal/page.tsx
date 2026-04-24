'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';

// -- Animated counter ------------------------------------------
function AnimatedNumber({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined') { setDisplay(value); return; }
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * ease));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);
  return <>{display}</>;
}
import { Button } from '@/components/ui';
import OakitLogo from '@/components/OakitLogo';
import ThemeToggle from '@/components/ThemeToggle';
import { apiGet, apiPost } from '@/lib/api';
import { getToken, clearToken, getRoleRedirect } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

// -- Types ----------------------------------------------------
interface SectionSummary {
  section_id: string; section_label: string; class_name: string;
  class_teacher_name: string | null; total_students: number;
  present_today: number; absent_today: number; attendance_submitted: boolean;
  plan_completed: boolean; homework_sent: boolean;
  coverage_pct: number | null; coverage_total: number; coverage_covered: number;
}
interface TeacherStreak { teacher_id: string; teacher_name: string; current_streak: number; best_streak: number; }
interface EngagementTeacher {
  id: string; name: string; role_name: string;
  current_streak: number; best_streak: number; last_completed_date: string | null;
  completions_30d: number; completion_rate_30d: number; days_since_last: number; amber_warning: boolean;
}
interface BirthdayKid { id: string; name: string; class_name: string; section_label: string; days_until: number; }
interface PrincipalContext {
  principal_name: string; greeting: string; thought_for_day: string; today: string;
  sections: SectionSummary[]; teacher_streaks: TeacherStreak[];
  summary: {
    total_students: number; total_present: number; total_absent: number;
    attendance_submitted: number; plans_completed: number; homework_sent: number; total_sections: number;
  };
}
interface Message { role: 'user' | 'assistant'; text: string; }

const SUGGESTED = [
  'Which sections are lagging behind?',
  "Who hasn't submitted attendance today?",
  'What is the overall curriculum progress?',
];

// -- Mini donut (SVG, animated) ---------------------------------
function Donut({ pct, color, size = 64 }: { pct: number; color: string; size?: number }) {
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimPct(pct), 200); return () => clearTimeout(t); }, [pct]);
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(animPct, 100) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-subtle)" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)', filter: `drop-shadow(0 0 4px ${color}60)` }} />
      <text x={size/2} y={size/2+4} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--text-primary)">{animPct}%</text>
    </svg>
  );
}

// -- Collapsible wrapper ---------------------------------------
function Collapsible({ title, subtitle, badge, defaultOpen = false, children, accent }:
  { title: string; subtitle?: string; badge?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode; accent?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm ${accent || 'border-neutral-100'}`}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50/60 transition-colors">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-bold text-neutral-800 truncate">{title}</p>
            {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
          {badge}
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-400 shrink-0 ml-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-neutral-100">{children}</div>}
    </div>
  );
}

// -- Main component --------------------------------------------
export default function PrincipalDashboard() {
  const router = useRouter();
  const token = getToken() || '';
  const [ctx, setCtx] = useState<PrincipalContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [safetyAlerts, setSafetyAlerts] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Birthday state
  const [birthdays, setBirthdays] = useState<BirthdayKid[]>([]);
  const [engagement, setEngagement] = useState<EngagementTeacher[]>([]);
  const [schoolDays30d, setSchoolDays30d] = useState(0);
  const [engagementDrillDown, setEngagementDrillDown] = useState<string | null>(null);
  const [birthdayMsg, setBirthdayMsg] = useState('');
  const [formattedBirthdayMsg, setFormattedBirthdayMsg] = useState('');
  const [formattingBirthday, setFormattingBirthday] = useState(false);
  const [sendingBirthday, setSendingBirthday] = useState(false);
  const [birthdaySent, setBirthdaySent] = useState('');

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    const role = localStorage.getItem('oakit_role');
    if (role && !['principal', 'admin'].includes(role.toLowerCase())) {
      router.push(getRoleRedirect(role)); return;
    }
    apiGet<PrincipalContext>('/api/v1/principal/context', token)
      .then(data => {
        setCtx(data);
        setMessages([{ role: 'assistant', text: `${data.greeting}\n\n?? ${data.thought_for_day}` }]);
      })
      .catch(() => setMessages([{ role: 'assistant', text: 'Hello! Ask me about your school.' }]))
      .finally(() => setLoading(false));
    apiGet<{ alerts: any[] }>('/api/v1/admin/audit/safety-alerts', token)
      .then(d => setSafetyAlerts(d.alerts)).catch(() => {});
    apiGet<BirthdayKid[]>('/api/v1/principal/birthdays?days=7', token)
      .then(data => {
        // Only set if data looks like real student records (has name + days_until is a number)
        const valid = (data || []).filter(k => k.name && typeof k.days_until === 'number' && k.id);
        setBirthdays(valid);
      }).catch(() => {});
    apiGet<{ teachers: EngagementTeacher[]; school_days_30d: number }>('/api/v1/principal/teachers/engagement', token)
      .then(d => { setEngagement(d.teachers || []); setSchoolDays30d(d.school_days_30d || 0); })
      .catch(() => {});
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function sendMessage(e?: FormEvent, override?: string) {
    e?.preventDefault();
    const userMsg = (override || input).trim();
    if (!userMsg || aiLoading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: userMsg }]);
    setAiLoading(true);
    try {
      const res = await apiPost<{ response: string }>('/api/v1/ai/query', { text: userMsg }, token);
      setMessages(m => [...m, { role: 'assistant', text: res.response }]);
    } catch { setMessages(m => [...m, { role: 'assistant', text: 'Sorry, try again.' }]); }
    finally { setAiLoading(false); }
  }

  const todayLabel = ctx?.today
    ? new Date(ctx.today + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  // Group sections by class
  const byClass: Record<string, SectionSummary[]> = {};
  (ctx?.sections || []).forEach(s => {
    if (!byClass[s.class_name]) byClass[s.class_name] = [];
    byClass[s.class_name].push(s);
  });

  // School health derived stats
  const totalSections = ctx?.summary.total_sections ?? 0;
  const attPct = ctx ? Math.round((ctx.summary.attendance_submitted / Math.max(totalSections, 1)) * 100) : 0;
  const planPct = ctx ? Math.round(((ctx.summary.plans_completed ?? 0) / Math.max(totalSections, 1)) * 100) : 0;
  const avgCovPct = ctx?.sections.length
    ? Math.round(ctx.sections.reduce((s, sec) => s + (sec.coverage_pct ?? 0), 0) / ctx.sections.length)
    : 0;

  const todayBirthdays = birthdays.filter(b => b.days_until === 0);
  const upcomingBirthdays = birthdays.filter(b => b.days_until > 0);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F4F6F8' }}>
      {/* ── Hero Header ── */}
      <header className="relative overflow-hidden text-white shrink-0"
        style={{ background: 'linear-gradient(135deg, #0a1f14 0%, #1a3c2e 50%, #2d6a4f 100%)', paddingBottom: '1px' }}>
        {/* Decorative blobs */}
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #52b788, transparent)' }} />
        <div className="absolute top-0 left-1/3 w-32 h-32 rounded-full opacity-5 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #74c69d, transparent)' }} />

        <div className="relative z-10 px-4 pt-4 pb-5">
          <div className="flex items-center justify-between mb-4">
            <OakitLogo size="xs" variant="light" />
            <div className="flex items-center gap-3">
              {ctx && <span className="text-xs text-white/60 hidden sm:block">{ctx.principal_name}</span>}
              <ThemeToggle variant="icon" />
              <button onClick={() => { clearToken(); router.push('/login'); }}
                className="text-xs text-white/40 hover:text-white/70 transition-colors">Sign out</button>
            </div>
          </div>

          {ctx && (
            <div className="mb-4">
              <p className="text-white/50 text-xs">{todayLabel}</p>
              <p className="text-white font-bold text-lg mt-0.5 leading-snug">{ctx.greeting}</p>
            </div>
          )}

          {/* ── 3 big stat pills ── */}
          {ctx && (
            <div className="grid grid-cols-3 gap-2 stagger">
              {[
                { label: 'Students', value: ctx.summary.total_students, sub: `${totalSections} sections`, emoji: '👥', glow: 'rgba(255,255,255,0.1)' },
                { label: 'Present', value: ctx.summary.total_present, sub: `${ctx.summary.total_students > 0 ? Math.round((ctx.summary.total_present/ctx.summary.total_students)*100) : 0}% today`, emoji: '✅', glow: 'rgba(74,222,128,0.2)' },
                { label: 'Absent', value: ctx.summary.total_absent, sub: 'today', emoji: '❌', glow: 'rgba(248,113,113,0.2)' },
              ].map((s, i) => (
                <div key={i} className="rounded-2xl p-3 border border-white/10 slide-in-up"
                  style={{ background: `radial-gradient(circle at top right, ${s.glow}, rgba(255,255,255,0.06))`, backdropFilter: 'blur(8px)' }}>
                  <p className="text-xl">{s.emoji}</p>
                  <p className="text-white font-black text-2xl leading-none mt-1 number-shimmer">
                    <AnimatedNumber value={s.value} />
                  </p>
                  <p className="text-white/50 text-[10px] mt-0.5">{s.label}</p>
                  <p className="text-white/30 text-[9px]">{s.sub}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom fade */}
        <div className="h-4" style={{ background: 'linear-gradient(to bottom, transparent, #F4F6F8)' }} />
      </header>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* -- Left / Main -- */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-4 space-y-3">

            {/* Safety alerts */}
            {safetyAlerts.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <span className="text-xl shrink-0">🚨</span>
                <div>
                  <p className="text-sm font-bold text-red-800">{safetyAlerts.length} Content Alert{safetyAlerts.length > 1 ? 's' : ''}</p>
                  <p className="text-xs text-red-600 mt-0.5">Review in Admin → Audit Log</p>
                </div>
              </div>
            )}

            {/* ── School Health ── */}
            {ctx && (
              <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">School Health Today</p>
                </div>
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Curriculum', pct: avgCovPct, color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700' },
                      { label: 'Attendance\nSubmitted', pct: attPct, color: '#6366f1', bg: 'bg-indigo-50', text: 'text-indigo-700' },
                      { label: 'Plans\nCompleted', pct: planPct, color: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-700' },
                    ].map((s, i) => (
                      <div key={i} className={`${s.bg} rounded-2xl p-3 flex flex-col items-center gap-2`}>
                        <Donut pct={s.pct} color={s.color} size={60} />
                        <p className={`text-[10px] font-semibold ${s.text} text-center whitespace-pre-line leading-tight`}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { emoji: '🎓', label: 'Students', value: ctx.summary.total_students },
                      { emoji: '👩‍🏫', label: 'Teachers', value: ctx.sections.filter(s => s.class_teacher_name).length },
                      { emoji: '🏫', label: 'Classes', value: Object.keys(byClass).length },
                    ].map((s, i) => (
                      <div key={i} className="bg-neutral-50 rounded-2xl p-3 text-center border border-neutral-100">
                        <p className="text-xl">{s.emoji}</p>
                        <p className="text-xl font-black text-neutral-800 leading-none mt-1">{s.value}</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Status row: Attendance / Plans / Homework ── */}
            {ctx && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Attendance', value: `${ctx.summary.attendance_submitted}/${totalSections}`, done: ctx.summary.attendance_submitted === totalSections, emoji: '📋' },
                  { label: 'Plans Done', value: `${ctx.summary.plans_completed ?? 0}/${totalSections}`, done: (ctx.summary.plans_completed ?? 0) === totalSections, emoji: '📚' },
                  { label: 'Homework', value: `${ctx.summary.homework_sent ?? 0}/${totalSections}`, done: (ctx.summary.homework_sent ?? 0) === totalSections, emoji: '✏️' },
                ].map((s, i) => (
                  <div key={i} className={`rounded-2xl p-3 border text-center ${s.done ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-neutral-100'}`}>
                    <p className="text-lg">{s.emoji}</p>
                    <p className={`text-base font-black leading-none mt-1 ${s.done ? 'text-emerald-700' : 'text-neutral-800'}`}>{s.value}</p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Quick nav */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { href: '/principal/attendance', label: 'Attendance', icon: '📋', color: 'from-indigo-500 to-indigo-600' },
                { href: '/principal/teachers',   label: 'Teachers',   icon: '👩‍🏫', color: 'from-emerald-500 to-emerald-600' },
                { href: '/principal/coverage',   label: 'Coverage',   icon: '📊', color: 'from-amber-500 to-amber-600' },
                { href: '/principal/overview',   label: 'Reports',    icon: '📈', color: 'from-purple-500 to-purple-600' },
              ].map(({ href, label, icon, color }) => (
                <Link key={href} href={href}
                  className="bg-white border border-neutral-100 rounded-2xl p-3 flex flex-col items-center gap-1.5 hover:shadow-md hover:-translate-y-0.5 transition-all text-center shadow-sm">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
                    <span className="text-base">{icon}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-neutral-600">{label}</span>
                </Link>
              ))}
            </div>

            {/* -- Birthdays � collapsible -- */}
            {birthdays.length > 0 && (
              <Collapsible
                title={todayBirthdays.length > 0 ? ` Birthdays Today (${todayBirthdays.length})` : `?? Upcoming Birthdays`}
                subtitle={todayBirthdays.length > 0 ? 'Tap to send wishes' : `${upcomingBirthdays.length} in next 7 days`}
                defaultOpen={todayBirthdays.length > 0}
                accent={todayBirthdays.length > 0 ? 'border-pink-200' : 'border-neutral-100'}
              >
                <div className="p-4 space-y-2">
                  {birthdays.map(kid => (
                    <div key={kid.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${kid.days_until === 0 ? 'bg-pink-50 border border-pink-100' : 'bg-neutral-50'}`}>
                      <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-xs font-bold text-pink-700 shrink-0">
                        {kid.name?.[0] ?? '⏳'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-800 truncate">{kid.name}</p>
                        <p className="text-[10px] text-neutral-400">{kid.class_name} � {kid.section_label}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${kid.days_until === 0 ? 'bg-pink-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
                        {kid.days_until === 0 ? '🎂 Today' : `in ${kid.days_until}d`}
                      </span>
                    </div>
                  ))}

                  {todayBirthdays.length > 0 && (
                    <div className="pt-2 border-t border-pink-100">
                      {!formattedBirthdayMsg ? (
                        <div className="flex gap-2">
                          <input value={birthdayMsg} onChange={e => setBirthdayMsg(e.target.value)}
                            placeholder="Write a birthday wish � Oakie will format it"
                            className="flex-1 px-3 py-2 border border-pink-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-pink-300/40" />
                          <button onClick={async () => {
                            if (!birthdayMsg.trim()) return;
                            setFormattingBirthday(true);
                            try {
                              const names = todayBirthdays.map(k => k.name).join(', ');
                              const res = await apiPost<{ response: string }>('/api/v1/ai/query', {
                                text: `Write a warm birthday message for ${names} from the school principal. Under 50 words, joyful, school-appropriate. Birthday message only.`,
                              }, token);
                              setFormattedBirthdayMsg(res.response.split('\n\n')[0].trim() || birthdayMsg);
                            } catch { setFormattedBirthdayMsg(birthdayMsg); }
                            finally { setFormattingBirthday(false); }
                          }} disabled={formattingBirthday || !birthdayMsg.trim()}
                            className="px-3 py-2 bg-pink-500 text-white rounded-xl text-xs font-bold hover:bg-pink-600 disabled:opacity-50 shrink-0">
                            {formattingBirthday ? '�' : '⏳'}
                          </button>
                        </div>
                      ) : (
                        <div className="bg-white border border-pink-200 rounded-xl p-3">
                          <p className="text-xs font-semibold text-pink-700 mb-1.5">Review before sending</p>
                          <p className="text-sm text-neutral-800 leading-relaxed">{formattedBirthdayMsg}</p>
                          <div className="flex gap-2 mt-3">
                            <button onClick={async () => {
                              setSendingBirthday(true);
                              try {
                                await apiPost('/api/v1/principal/birthdays/send', {
                                  student_ids: todayBirthdays.map(b => b.id), message: formattedBirthdayMsg,
                                }, token);
                                setBirthdaySent(`? Sent to ${todayBirthdays.length} student${todayBirthdays.length > 1 ? 's' : ''} and parents!`);
                                setFormattedBirthdayMsg(''); setBirthdayMsg('');
                              } catch { setBirthdaySent('Failed � try again'); }
                              finally { setSendingBirthday(false); }
                            }} disabled={sendingBirthday}
                              className="flex-1 py-2 bg-pink-500 text-white rounded-xl text-xs font-bold hover:bg-pink-600 disabled:opacity-50">
                              {sendingBirthday ? '�' : '?? Send'}
                            </button>
                            <button onClick={() => setFormattedBirthdayMsg('')}
                              className="px-3 py-2 border border-neutral-200 rounded-xl text-xs text-neutral-600">Edit</button>
                          </div>
                        </div>
                      )}
                      {birthdaySent && <p className="text-xs text-emerald-600 font-medium mt-2">{birthdaySent}</p>}
                    </div>
                  )}
                </div>
              </Collapsible>
            )}

            {/* ── Teaching Consistency — collapsible ── */}
            {ctx?.teacher_streaks && ctx.teacher_streaks.length > 0 && (
              <Collapsible title="🏆 Teaching Consistency" subtitle={`Daily plan completion · top ${Math.min(ctx.teacher_streaks.length, 5)}`} defaultOpen={false}>
                <div className="divide-y divide-neutral-50">
                  <div className="px-4 py-2 bg-amber-50/60 border-b border-amber-100">
                    <p className="text-[10px] text-amber-700">Consistency = consecutive school days with a completed lesson plan. Resets if a plan is missed on a working day.</p>
                  </div>
                  {ctx.teacher_streaks.slice(0, 5).map((t, i) => (
                    <div key={t.teacher_id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-500'}`}>{i + 1}</div>
                      <p className="text-sm text-neutral-700 flex-1 truncate">{t.teacher_name}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-sm font-black text-amber-600">{t.current_streak ?? 0}</span>
                        <span className="text-xs text-neutral-400">days</span>
                        {(t.best_streak ?? 0) > (t.current_streak ?? 0) && (
                          <span className="text-[10px] text-neutral-400 ml-1">� best {t.best_streak}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Collapsible>
            )}

            {/* -- Teaching Engagement (30d) � collapsible -- */}
            {engagement.length > 0 && (
              <Collapsible
                title=" Teaching Engagement (30d)"
                subtitle={`Plan completion rate over last ${schoolDays30d} school days`}
                defaultOpen={false}
              >
                <div className="divide-y divide-neutral-50">
                  {/* How it's calculated */}
                  <div className="px-4 py-2.5 bg-primary-50/60 border-b border-primary-100">
                    <p className="text-[10px] text-primary-700 font-medium mb-0.5">How it's calculated</p>
                    <p className="text-[10px] text-primary-600 leading-relaxed">
                      Engagement % = (lesson plans completed � school working days in last 30 days) � 100.
                      A plan counts if it was marked complete on that day. Weekends & holidays are excluded.
                    </p>
                  </div>
                  {engagement.map(t => (
                    <div key={t.id}>
                      <button
                        onClick={() => setEngagementDrillDown(engagementDrillDown === t.id ? null : t.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-neutral-800">{t.name}</p>
                            {t.amber_warning && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                ? {t.days_since_last}d no plan
                              </span>
                            )}
                            {t.current_streak >= 5 && (
                              <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                                 {t.current_streak} consistency
                              </span>
                            )}
                          </div>
                          {/* Mini progress bar */}
                          <div className="mt-1.5 w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all ${t.completion_rate_30d >= 80 ? 'bg-emerald-500' : t.completion_rate_30d >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                              style={{ width: `${t.completion_rate_30d}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-base font-black ${t.completion_rate_30d >= 80 ? 'text-emerald-600' : t.completion_rate_30d >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                            {t.completion_rate_30d}%
                          </p>
                          <p className="text-[9px] text-neutral-400">{t.completions_30d}/{schoolDays30d} days</p>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-neutral-300 shrink-0 transition-transform duration-200 ${engagementDrillDown === t.id ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Drill-down */}
                      {engagementDrillDown === t.id && (
                        <div className="px-4 pb-3 bg-neutral-50/60 border-t border-neutral-100">
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="bg-white rounded-xl p-2.5 border border-neutral-100">
                              <p className="text-[9px] text-neutral-400 uppercase tracking-wide">Plans completed</p>
                              <p className="text-lg font-black text-neutral-800">{t.completions_30d}</p>
                              <p className="text-[9px] text-neutral-400">out of {schoolDays30d} school days</p>
                            </div>
                            <div className="bg-white rounded-xl p-2.5 border border-neutral-100">
                              <p className="text-[9px] text-neutral-400 uppercase tracking-wide">Current streak</p>
                              <p className="text-lg font-black text-amber-600">{t.current_streak} <span className="text-xs font-normal text-neutral-400">days</span></p>
                              <p className="text-[9px] text-neutral-400">best: {t.best_streak} days</p>
                            </div>
                            <div className="bg-white rounded-xl p-2.5 border border-neutral-100">
                              <p className="text-[9px] text-neutral-400 uppercase tracking-wide">Last plan</p>
                              <p className="text-sm font-bold text-neutral-700">{t.last_completed_date ?? 'Never'}</p>
                              <p className="text-[9px] text-neutral-400">{t.days_since_last < 999 ? `${t.days_since_last}d ago` : 'no record'}</p>
                            </div>
                            <div className={`rounded-xl p-2.5 border ${t.completion_rate_30d >= 80 ? 'bg-emerald-50 border-emerald-100' : t.completion_rate_30d >= 50 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
                              <p className="text-[9px] text-neutral-400 uppercase tracking-wide">Status</p>
                              <p className={`text-sm font-bold ${t.completion_rate_30d >= 80 ? 'text-emerald-700' : t.completion_rate_30d >= 50 ? 'text-amber-700' : 'text-red-600'}`}>
                                {t.completion_rate_30d >= 80 ? '? Excellent' : t.completion_rate_30d >= 50 ? '~ Moderate' : '? Needs attention'}
                              </p>
                              <p className="text-[9px] text-neutral-400">30-day engagement</p>
                            </div>
                          </div>
                          <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">
                            <strong>Formula:</strong> {t.completions_30d} plans � {schoolDays30d} school days � 100 = <strong>{t.completion_rate_30d}%</strong>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Collapsible>
            )}

            {/* -- Classes & Sections � single collapsible, collapsed by default -- */}
            {loading ? (
              <div className="py-8 text-center"><p className="text-sm text-neutral-400">Loading�</p></div>
            ) : (
              <Collapsible
                title=" Classes & Sections"
                subtitle={`${Object.keys(byClass).length} classes � ${(ctx?.sections || []).length} sections � ${ctx?.summary.total_students ?? 0} students`}
                defaultOpen={false}
              >
                <div className="divide-y divide-neutral-50">
                  {Object.entries(byClass).map(([className, sections]) => {
                    const allAttDone = sections.every(s => s.attendance_submitted);
                    const classCovPct = sections.length > 0
                      ? Math.round(sections.reduce((s, sec) => s + (sec.coverage_pct ?? 0), 0) / sections.length)
                      : 0;
                    return (
                      <details key={className} className="group">
                        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none hover:bg-neutral-50 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <ChevronDown className="w-3.5 h-3.5 text-neutral-300 shrink-0 transition-transform group-open:rotate-180" />
                            <div>
                              <p className="text-sm font-bold text-neutral-800">{className}</p>
                              <p className="text-[10px] text-neutral-400">
                                {sections.length} section{sections.length !== 1 ? 's' : ''} � {sections.reduce((s, sec) => s + sec.total_students, 0)} students
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${allAttDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {allAttDone ? '✓ Att' : '✓ Att'}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${classCovPct >= 75 ? 'bg-emerald-100 text-emerald-700' : classCovPct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-500'}`}>
                              {classCovPct}% cov
                            </span>
                          </div>
                        </summary>

                        {/* Sections inside this class */}
                        <div className="border-t border-neutral-50 divide-y divide-neutral-50 bg-neutral-50/30">
                          {sections.map(sec => {
                            const attPctSec = sec.total_students > 0 ? Math.round((sec.present_today / sec.total_students) * 100) : 0;
                            const covPctSec = sec.coverage_pct ?? 0;
                            return (
                              <details key={sec.section_id} className="group/sec">
                                <summary className="flex items-center justify-between pl-10 pr-4 py-2.5 cursor-pointer list-none hover:bg-neutral-100/50 transition-colors">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <ChevronDown className="w-3 h-3 text-neutral-300 shrink-0 transition-transform group-open/sec:rotate-180" />
                                    <div className="min-w-0">
                                      <span className="text-xs font-semibold text-neutral-700">Section {sec.section_label}</span>
                                      <span className="text-[10px] text-neutral-400 ml-2">
                                        {sec.class_teacher_name ? `????? ${sec.class_teacher_name}` : ' No teacher'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sec.attendance_submitted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {sec.attendance_submitted ? '✓ Att' : '⏳'}
                                    </span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sec.plan_completed ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                                      {sec.plan_completed ? '? Plan' : '� Plan'}
                                    </span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sec.homework_sent ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-500'}`}>
                                      {sec.homework_sent ? '? HW' : '� HW'}
                                    </span>
                                  </div>
                                </summary>

                                {/* Section metrics */}
                                <div className="pl-10 pr-4 pb-3 pt-1 grid grid-cols-3 gap-3">
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] text-neutral-400">Attendance</span>
                                      <span className={`text-[10px] font-bold ${attPctSec >= 90 ? 'text-emerald-600' : attPctSec >= 75 ? 'text-amber-600' : 'text-red-500'}`}>
                                        {sec.attendance_submitted ? `${attPctSec}%` : '�'}
                                      </span>
                                    </div>
                                    <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                                      <div className="h-1.5 rounded-full" style={{ width: sec.attendance_submitted ? `${attPctSec}%` : '0%', background: attPctSec >= 90 ? '#10b981' : attPctSec >= 75 ? '#f59e0b' : '#ef4444' }} />
                                    </div>
                                    {sec.attendance_submitted && <p className="text-[9px] text-neutral-400 mt-0.5">{sec.present_today}P � {sec.absent_today}A of {sec.total_students}</p>}
                                  </div>
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] text-neutral-400">Curriculum</span>
                                      <span className={`text-[10px] font-bold ${covPctSec >= 75 ? 'text-emerald-600' : covPctSec >= 40 ? 'text-amber-600' : covPctSec > 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                                        {sec.coverage_total > 0 ? `${covPctSec}%` : 'No data'}
                                      </span>
                                    </div>
                                    <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                                      <div className="h-1.5 rounded-full" style={{ width: `${Math.min(covPctSec, 100)}%`, background: covPctSec >= 75 ? '#10b981' : covPctSec >= 40 ? '#f59e0b' : '#ef4444' }} />
                                    </div>
                                    {sec.coverage_total > 0 && <p className="text-[9px] text-neutral-400 mt-0.5">{sec.coverage_covered}/{sec.coverage_total} topics</p>}
                                  </div>
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[10px] text-neutral-400">Students</span>
                                      <span className="text-[10px] font-bold text-neutral-600">{sec.total_students}</span>
                                    </div>
                                    <div className="w-full bg-neutral-200 rounded-full h-1.5" />
                                    <p className="text-[9px] text-neutral-400 mt-0.5">enrolled</p>
                                  </div>
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </Collapsible>
            )}
          </div>
        </div>

        {/* -- Right: Ask Oakie -- */}
        <div className="lg:w-80 xl:w-96 shrink-0 flex flex-col bg-white border-t lg:border-t-0 lg:border-l border-neutral-100"
          style={{ height: 'calc(100vh - 56px)', position: 'sticky', top: '56px' }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-neutral-100 shrink-0">
            <p className="text-sm font-bold text-neutral-800">Ask Oakie</p>
            <p className="text-xs text-neutral-400 mt-0.5">Attendance, coverage, any section</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mr-2 mt-0.5 self-start">
                    <span className="text-xs">🌳</span>
                  </div>
                )}
                <div className={`max-w-[85%] px-3 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-neutral-100 text-neutral-800 rounded-bl-sm'
                }`}>{msg.text}</div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mr-2">
                  <span className="text-xs">🌳</span>
                </div>
                <div className="bg-neutral-100 px-3 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                  {[0,150,300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce inline-block" style={{ animationDelay: `${d}ms` }} />)}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Suggested questions */}
          <div className="px-3 py-2 border-t border-neutral-100 flex flex-col gap-1.5 shrink-0">
            {SUGGESTED.map(q => (
              <button key={q} onClick={() => sendMessage(undefined, q)}
                className="text-left text-xs px-3 py-2 rounded-xl border border-neutral-100 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-200 transition-colors">
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="border-t border-neutral-100 p-3 flex gap-2 shrink-0">
            <input
              className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400/20 bg-neutral-50 placeholder:text-neutral-400"
              placeholder="Ask about your school�"
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <Button type="submit" size="sm" loading={aiLoading} disabled={!input.trim()}>→</Button>
          </form>
        </div>
      </div>
    </div>
  );
}

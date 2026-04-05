'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import ProgressBar from '@/components/ui/ProgressBar';
import OakitLogo from '@/components/OakitLogo';
import { apiGet, apiPost } from '@/lib/api';
import { getToken, clearToken, getRoleRedirect } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SectionSummary {
  section_id: string;
  section_label: string;
  class_name: string;
  class_teacher_name: string | null;
  total_students: number;
  present_today: number;
  absent_today: number;
  attendance_submitted: boolean;
}
interface PrincipalContext {
  principal_name: string;
  greeting: string;
  thought_for_day: string;
  today: string;
  sections: SectionSummary[];
  summary: {
    total_students: number;
    total_present: number;
    total_absent: number;
    attendance_submitted: number;
    total_sections: number;
  };
}
interface Message { role: 'user' | 'assistant'; text: string; }

const SUGGESTED = [
  'Which sections are lagging behind?',
  "Who hasn't submitted attendance today?",
  'What is the overall curriculum progress?',
  'Which sections are flagged?',
];

export default function PrincipalDashboard() {
  const router = useRouter();
  const token = getToken() || '';
  const [ctx, setCtx] = useState<PrincipalContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [safetyAlerts, setSafetyAlerts] = useState<{ id: string; actor_name: string; actor_role: string; query_text: string; created_at: string }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    const role = localStorage.getItem('oakit_role');
    if (role && !['principal', 'admin'].includes(role.toLowerCase())) {
      router.push(getRoleRedirect(role)); return;
    }
    apiGet<PrincipalContext>('/api/v1/principal/context', token)
      .then(data => {
        setCtx(data);
        setMessages([{ role: 'assistant', text: `${data.greeting}\n\n💡 ${data.thought_for_day}` }]);
      })
      .catch(() => setMessages([{ role: 'assistant', text: 'Hello! Ask me about your school.' }]))
      .finally(() => setLoading(false));
    // Load safety alerts
    apiGet<{ alerts: any[]; unread_count: number }>('/api/v1/admin/audit/safety-alerts', token)
      .then(d => setSafetyAlerts(d.alerts))
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
    } catch (err: any) {
      setMessages(m => [...m, { role: 'assistant', text: 'Sorry, try again.' }]);
    } finally { setAiLoading(false); }
  }

  const today = ctx?.today ? new Date(ctx.today + 'T12:00:00') : new Date();
  const todayLabel = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  // Group sections by class
  const byClass: Record<string, SectionSummary[]> = {};
  (ctx?.sections || []).forEach(s => {
    if (!byClass[s.class_name]) byClass[s.class_name] = [];
    byClass[s.class_name].push(s);
  });

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="text-white px-4 py-3 flex items-center justify-between shrink-0"
        style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)', boxShadow: '0 1px 12px rgba(0,0,0,0.15)' }}>
        <OakitLogo size="xs" variant="light" />
        <div className="flex items-center gap-3">
          {ctx && <span className="text-sm text-white/80 hidden sm:block">Welcome, {ctx.principal_name}</span>}
          <button onClick={() => { clearToken(); router.push('/login'); }}
            className="text-xs text-white/55 hover:text-white/80 transition-colors">Sign out</button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

        {/* ── Left / Main ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Welcome banner */}
          {ctx && (
            <div className="bg-white border-b border-neutral-100 px-5 py-3">
              <p className="text-xs text-neutral-400">{todayLabel}</p>
              <p className="text-sm font-semibold text-neutral-800 mt-0.5">{ctx.greeting}</p>
              <p className="text-xs text-neutral-500 italic mt-0.5">"{ctx.thought_for_day}"</p>
            </div>
          )}

          <div className="p-4 space-y-4">
            {/* Safety alerts */}
            {safetyAlerts.length > 0 && (
              <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl animate-pulse">🚨</span>
                  <div>
                    <p className="text-sm font-bold text-red-800">{safetyAlerts.length} Inappropriate Content Alert{safetyAlerts.length > 1 ? 's' : ''}</p>
                    <p className="text-xs text-red-600">Review in Admin → Audit Log</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {safetyAlerts.slice(0, 3).map(alert => (
                    <div key={alert.id} className="bg-white border border-red-200 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-red-800">{alert.actor_name}</span>
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full capitalize">{alert.actor_role}</span>
                        <span className="text-xs text-neutral-400 ml-auto">
                          {new Date(alert.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-red-700 font-medium">"{alert.query_text}"</p>
                    </div>
                  ))}
                  {safetyAlerts.length > 3 && <p className="text-xs text-red-500 text-center">+{safetyAlerts.length - 3} more alerts</p>}
                </div>
              </div>
            )}

            {/* Summary stat cards */}
            {ctx && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-neutral-100 rounded-2xl p-4 shadow-sm">
                  <p className="text-xs text-neutral-500 mb-1">Students</p>
                  <p className="text-2xl font-bold text-neutral-800">{ctx.summary.total_students}</p>
                </div>
                <div className={`border rounded-2xl p-4 shadow-sm ${ctx.summary.total_present > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-neutral-100'}`}>
                  <p className="text-xs text-neutral-500 mb-1">Present</p>
                  <p className="text-2xl font-bold text-emerald-700">{ctx.summary.total_present}</p>
                </div>
                <div className={`border rounded-2xl p-4 shadow-sm ${ctx.summary.total_absent > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-neutral-100'}`}>
                  <p className="text-xs text-neutral-500 mb-1">Absent</p>
                  <p className="text-2xl font-bold text-red-600">{ctx.summary.total_absent}</p>
                </div>
                <div className={`border rounded-2xl p-4 shadow-sm ${ctx.summary.attendance_submitted === ctx.summary.total_sections ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                  <p className="text-xs text-neutral-500 mb-1">Attendance</p>
                  <p className={`text-2xl font-bold ${ctx.summary.attendance_submitted === ctx.summary.total_sections ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {ctx.summary.attendance_submitted}/{ctx.summary.total_sections}
                  </p>
                  <p className="text-xs text-neutral-400">sections</p>
                </div>
              </div>
            )}

            {/* Quick nav */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { href: '/principal/attendance', label: 'Attendance', icon: '📋' },
                { href: '/principal/teachers', label: 'Teachers', icon: '👩‍🏫' },
                { href: '/principal/coverage', label: 'Coverage', icon: '📊' },
              ].map(({ href, label, icon }) => (
                <Link key={href} href={href}
                  className="bg-white border border-neutral-200 rounded-2xl p-3 flex flex-col items-center gap-1.5 hover:shadow-md hover:-translate-y-0.5 transition-all text-center">
                  <span className="text-2xl">{icon}</span>
                  <span className="text-xs font-semibold text-neutral-700">{label}</span>
                </Link>
              ))}
            </div>
                <p className="text-lg font-bold text-gray-800">{ctx.summary.attendance_submitted}/{ctx.summary.total_sections}</p>
              </div>
            </div>
          )}

          {/* Section cards by class */}
          {loading ? (
            <p className="px-4 text-sm text-gray-400">Loading...</p>
          ) : (
            <div className="px-4 pb-6 flex flex-col gap-4">
              {Object.entries(byClass).map(([className, sections]) => (
                <div key={className}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{className}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sections.map(sec => (
                      <div key={sec.section_id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {sec.class_name} – Section {sec.section_label}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {sec.class_teacher_name ? `👩‍🏫 ${sec.class_teacher_name}` : '⚠ No class teacher'}
                            </p>
                          </div>
                          {sec.attendance_submitted
                            ? <Badge label="✓ Attendance" variant="success" />
                            : <Badge label="⏳ Pending" variant="warning" />}
                        </div>

                        {/* Student count */}
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-gray-500 text-xs">Students:</span>
                          <span className="font-semibold text-gray-800">{sec.total_students}</span>
                          {sec.attendance_submitted && (
                            <>
                              <span className="text-green-600 text-xs font-medium">{sec.present_today}P</span>
                              <span className="text-red-500 text-xs font-medium">{sec.absent_today}A</span>
                            </>
                          )}
                        </div>

                        {/* Attendance bar */}
                        {sec.attendance_submitted && sec.total_students > 0 && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className="bg-green-500 h-1.5 rounded-full"
                                style={{ width: `${Math.round((sec.present_today / sec.total_students) * 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {Math.round((sec.present_today / sec.total_students) * 100)}% present
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!loading && Object.keys(byClass).length === 0 && (
                <p className="text-sm text-gray-400">No sections found</p>
              )}
            </div>
          )}
        </div>

        {/* ── Right: AI Chat ── */}
        <div className="lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col bg-white" style={{ minHeight: '300px', maxHeight: '100vh' }}>
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Ask Oakie</p>
            <p className="text-xs text-gray-400">Ask about attendance, coverage, or any section</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2" style={{ maxHeight: '400px' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'
                }`}>{msg.text}</div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-3 py-2 rounded-xl text-xs text-gray-400">Thinking...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Suggested questions */}
          <div className="px-3 py-2 flex flex-col gap-1.5 border-t border-gray-100">
            {SUGGESTED.map(q => (
              <button key={q} onClick={() => sendMessage(undefined, q)}
                className="text-left text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                {q}
              </button>
            ))}
          </div>

          <form onSubmit={sendMessage} className="border-t border-gray-100 p-3 flex gap-2">
            <input
              className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Ask about your school..."
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <Button type="submit" size="sm" loading={aiLoading}>→</Button>
          </form>
        </div>
      </div>
    </div>
  );
}

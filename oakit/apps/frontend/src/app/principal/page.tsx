'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import OakitLogo from '@/components/OakitLogo';
import { apiGet, apiPost } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Section {
  section_id: string; section_label: string; class_name: string;
  completion_pct: number; last_log_date: string | null; is_inactive: boolean;
}
interface TimelineEntry {
  plan_date: string; plan_status: string; log_text: string | null; flagged: boolean;
}
interface Message { role: 'user' | 'assistant'; text: string; }

function fetcher(url: string, token: string) {
  return fetch(`${API_BASE}${url}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
}

export default function PrincipalDashboard() {
  const router = useRouter();
  const token = getToken() || '';
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: "Hello! Ask me about curriculum progress, which sections are lagging, or what a teacher covered today." }
  ]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: sections = [] } = useSWR<Section[]>(
    ['/api/v1/principal/dashboard', token],
    ([url, t]) => fetcher(url as string, t as string),
    { refreshInterval: 30000 }
  );

  useEffect(() => {
    if (!token) router.push('/login');
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadTimeline(sectionId: string) {
    setSelectedSection(sectionId);
    try {
      const data = await apiGet<TimelineEntry[]>(`/api/v1/principal/sections/${sectionId}/timeline`, token);
      setTimeline(data);
    } catch (err) { console.error(err); }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || aiLoading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', text: userMsg }]);
    setAiLoading(true);
    try {
      // Assemble principal context: low-coverage sections, pending attendance, flagged sections
      let context: Record<string, any> | undefined;
      try {
        const [coverageData, attendanceData] = await Promise.all([
          apiGet<any[]>('/api/v1/principal/coverage', token),
          apiGet<any[]>('/api/v1/principal/attendance/overview', token),
        ]);
        context = {
          low_coverage_sections: coverageData.filter((s: any) => s.coverage_pct < 50).map((s: any) => ({ name: s.section_name, coverage_pct: s.coverage_pct })),
          pending_attendance: attendanceData.filter((s: any) => s.status === 'pending').map((s: any) => s.section_name),
          flagged_sections: coverageData.filter((s: any) => s.flagged).map((s: any) => ({ name: s.section_name, note: s.flag_note })),
        };
      } catch { /* context is optional */ }

      const res = await apiPost<{ response: string }>('/api/v1/ai/query', { text: userMsg, context }, token);
      setMessages(m => [...m, { role: 'assistant', text: res.response }]);
    } catch (err: any) {
      const msg = err?.message?.includes('503') || err?.message?.includes('unavailable')
        ? 'AI service is currently unavailable. Please try again later.'
        : 'Sorry, could not process that.';
      setMessages(m => [...m, { role: 'assistant', text: msg }]);
    } finally { setAiLoading(false); }
  }

  // Group sections by class
  const byClass: Record<string, Section[]> = {};
  sections.forEach(s => {
    if (!byClass[s.class_name]) byClass[s.class_name] = [];
    byClass[s.class_name].push(s);
  });

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="bg-primary text-white px-6 py-3 flex items-center justify-between">
        <OakitLogo size="sm" variant="light" />
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/70">Principal Dashboard</span>
          <button onClick={() => { clearToken(); router.push('/login'); }} className="text-sm text-white/60 hover:text-white">Sign out</button>
        </div>
      </header>

      {/* Navigation cards */}
      <div className="px-6 pt-5 pb-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: '/principal/attendance', label: 'Attendance Overview', icon: '📋' },
          { href: '/principal/teachers', label: 'Teacher Activity', icon: '👩‍🏫' },
          { href: '/principal/coverage', label: 'Coverage Report', icon: '📊' },
        ].map(({ href, label, icon }) => (
          <a key={href} href={href} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
            <span className="text-2xl">{icon}</span>
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </a>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Progress grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <h1 className="text-xl font-semibold text-primary mb-4">Curriculum Progress</h1>
          {Object.entries(byClass).map(([className, secs]) => (
            <div key={className} className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{className}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {secs.map(s => (
                  <div key={s.section_id} onClick={() => loadTimeline(s.section_id)} className="cursor-pointer">
                  <Card
                    className={`transition-shadow hover:shadow-md ${selectedSection === s.section_id ? 'ring-2 ring-primary' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-800">Section {s.section_label}</span>
                      {s.is_inactive && <Badge label="Inactive" variant="danger" />}
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                      <div
                        className={`h-1.5 rounded-full transition-all ${s.completion_pct < 30 ? 'bg-red-400' : s.completion_pct < 70 ? 'bg-amber-400' : 'bg-primary'}`}
                        style={{ width: `${s.completion_pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">{s.completion_pct}% · Last log: {s.last_log_date || 'Never'}</p>
                  </Card>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Timeline drill-down */}
          {selectedSection && timeline.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Section Timeline</h2>
              <div className="flex flex-col gap-2">
                {timeline.map((entry, i) => (
                  <div key={i} className="flex gap-3 items-start text-sm">
                    <span className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">{entry.plan_date}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge
                          label={entry.plan_status}
                          variant={entry.plan_status === 'carried_forward' ? 'warning' : entry.log_text ? 'success' : 'neutral'}
                        />
                        {entry.flagged && <Badge label="Flagged" variant="danger" />}
                      </div>
                      {entry.log_text && <p className="text-xs text-gray-600 line-clamp-2">{entry.log_text}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: AI Chat */}
        <div className="w-80 shrink-0 border-l border-gray-200 flex flex-col bg-surface">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">AI Assistant</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${
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
          <form onSubmit={sendMessage} className="border-t border-gray-100 p-3 flex gap-2">
            <input
              className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Ask about progress..."
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

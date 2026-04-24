'use client';
import { useState, useEffect } from 'react';
import { ChevronRight, Loader2, BookOpen, Target, Trophy, BookMarked } from 'lucide-react';
import { apiGet } from '@/lib/api';
import type { ProgressData, Child, HomeworkRecord } from '../types';

const P = {
  brand: '#1F7A5A', brandDark: '#166A4D', brandSoft: '#E8F3EF', brandBorder: '#A7D4C0',
  bg: '#F8FAFC', card: '#F8FAFC', border: '#E4E4E7',
  text: '#18181B', textSub: '#3F3F46', textMuted: '#71717A',
};

const cardStyle: React.CSSProperties = {
  background: P.card, border: `1px solid ${P.border}`,
  borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', padding: 20,
  transition: 'box-shadow 0.18s ease, transform 0.18s ease',
};

const cardHoverClass = 'hover:shadow-md hover:-translate-y-0.5';

function SectionLabel({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={14} strokeWidth={1.75} style={{ color: P.textMuted }} />
      <p className="text-sm font-semibold" style={{ color: P.textSub }}>{text}</p>
    </div>
  );
}

function Ring({ pct, color, size = 130, stroke = 12 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const [a, setA] = useState(0);
  useEffect(() => { const id = setTimeout(() => setA(pct), 120); return () => clearTimeout(id); }, [pct]);
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={P.border} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${(a/100)*c} ${c}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
    </svg>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const id = setTimeout(() => setW(pct), 150); return () => clearTimeout(id); }, [pct]);
  return (
    <div className="h-1.5 rounded-full" style={{ background: P.border }}>
      <div className="h-1.5 rounded-full" style={{ width: `${w}%`, background: color, transition: 'width 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
    </div>
  );
}

export default function ProgressTab({ data, activeChild, token }: {
  data: ProgressData | null; activeChild: Child | null; token: string;
}) {
  const [milestoneData, setMilestoneData] = useState<{ completion_pct: number; achieved: number; total: number; class_level: string } | null>(null);
  const [hwHistory, setHwHistory] = useState<HomeworkRecord[]>([]);
  const [hwLoading, setHwLoading] = useState(false);

  useEffect(() => {
    if (!activeChild?.id || !token) return;
    apiGet<any>(`/api/v1/teacher/milestones/${activeChild.id}`, token)
      .then(d => setMilestoneData({ completion_pct: d.completion_pct, achieved: d.achieved, total: d.total, class_level: d.class_level }))
      .catch(() => {});
    setHwLoading(true);
    apiGet<HomeworkRecord[]>(`/api/v1/parent/homework/history?student_id=${activeChild.id}`, token)
      .then(d => setHwHistory(d || []))
      .catch(() => {})
      .finally(() => setHwLoading(false));
  }, [activeChild?.id]);

  if (!data) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: P.brandSoft }}>
        <BookOpen size={28} strokeWidth={1.5} style={{ color: P.brand }} />
      </div>
      <p className="text-sm font-semibold mb-1" style={{ color: P.text }}>No progress data yet</p>
      <p className="text-sm" style={{ color: P.textMuted }}>Progress will appear once curriculum is assigned</p>
    </div>
  );

  const pct = data.coverage_pct;
  const ringColor = pct >= 75 ? P.brand : pct >= 40 ? '#B45309' : '#DC2626';
  const missedCount    = hwHistory.filter(h => h.status !== 'completed').length;
  const completedCount = hwHistory.filter(h => h.status === 'completed').length;

  return (
    <div className="space-y-4 pb-6">

      {/* Curriculum ring */}
      <div className={cardHoverClass} style={cardStyle}>
        <SectionLabel icon={BookOpen} text="Curriculum Coverage" />
        <div className="flex items-center justify-center gap-10">
          <div className="relative flex items-center justify-center">
            <Ring pct={pct} color={ringColor} />
            <div className="absolute text-center">
              <p className="text-3xl font-semibold leading-none" style={{ color: ringColor }}>{pct}%</p>
              <p className="text-[10px] mt-0.5" style={{ color: P.textMuted }}>covered</p>
            </div>
          </div>
          <div className="space-y-4">
            {[
              ['Total Topics', String(data.total_chunks ?? '—'), P.text],
              ['Covered',      String(data.covered ?? '—'),      P.brand],
              ['Remaining',    String((data.total_chunks ?? 0) - (data.covered ?? 0)), '#B45309'],
            ].map(([l, v, c]) => (
              <div key={l}>
                <p className="text-xs" style={{ color: P.textMuted }}>{l}</p>
                <p className="text-2xl font-semibold leading-tight" style={{ color: c }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
        {!data.has_curriculum && (
          <p className="text-xs text-center mt-3" style={{ color: P.textMuted }}>No curriculum assigned yet</p>
        )}
      </div>

      {/* Milestones */}
      {milestoneData && (
        <div className={cardHoverClass} style={cardStyle}>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel icon={Trophy} text="Milestones" />
            <span className="text-sm font-semibold" style={{ color: P.brand }}>{milestoneData.completion_pct}%</span>
          </div>
          <Bar pct={milestoneData.completion_pct} color={P.brand} />
          <p className="text-xs mt-2" style={{ color: P.textMuted }}>
            {milestoneData.achieved} of {milestoneData.total} {milestoneData.class_level} milestones achieved
          </p>
        </div>
      )}

      {/* Goals */}
      <div className={cardHoverClass} style={cardStyle}>
        <SectionLabel icon={Target} text="Goals" />
        {[
          { label: 'Curriculum Coverage', pct, color: ringColor },
          { label: 'Homework Completion', pct: completedCount > 0 ? Math.round((completedCount / (completedCount + missedCount)) * 100) : 0, color: '#1D4ED8' },
        ].map(g => (
          <div key={g.label} className="mb-4 last:mb-0">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm font-medium" style={{ color: P.textSub }}>{g.label}</span>
              <span className="text-sm font-semibold" style={{ color: g.color }}>{g.pct}%</span>
            </div>
            <Bar pct={g.pct} color={g.color} />
          </div>
        ))}
      </div>

      {/* Homework history */}
      <div className={cardHoverClass} style={cardStyle}>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel icon={BookMarked} text="Homework History" />
          {hwHistory.length > 0 && (
            <div className="flex gap-2 text-xs">
              <span className="font-semibold" style={{ color: P.brand }}>{completedCount} done</span>
              {missedCount > 0 && <span className="font-semibold" style={{ color: '#DC2626' }}>{missedCount} missed</span>}
            </div>
          )}
        </div>
        {hwLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 size={20} className="animate-spin" style={{ color: P.brand }} />
          </div>
        ) : hwHistory.length === 0 ? (
          <div className="flex items-center gap-2 py-2" style={{ color: P.brand }}>
            <p className="text-sm font-medium">No homework records yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hwHistory.map((hw, i) => {
              const rawDate = (hw.homework_date || '').toString().split('T')[0];
              const dateStr = rawDate
                ? new Date(rawDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
                : '—';
              const cfg = ({
                completed:     { label: 'Done',          bg: P.brandSoft,  color: P.brandDark, border: P.brandBorder },
                partial:       { label: 'Partial',        bg: '#FEF9C3',    color: '#B45309',   border: '#FDE68A' },
                not_submitted: { label: 'Not submitted',  bg: '#FEF2F2',    color: '#DC2626',   border: '#FECACA' },
              } as Record<string, { label: string; bg: string; color: string; border: string }>)[hw.status]
                || { label: hw.status, bg: P.bg, color: P.textMuted, border: P.border };
              return (
                <details key={i} className="rounded-lg group transition-all hover:shadow-sm hover:-translate-y-0.5" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                  <summary className="flex items-center justify-between px-3 py-2.5 cursor-pointer list-none select-none">
                    <div className="flex items-center gap-2">
                      <ChevronRight size={13} className="shrink-0 transition-transform group-open:rotate-90" style={{ color: cfg.color }} />
                      <span className="text-xs font-medium" style={{ color: P.textSub }}>{dateStr}</span>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                  </summary>
                  <div className="px-3 pb-3 pt-1" style={{ borderTop: `1px solid ${cfg.border}` }}>
                    {hw.homework_text
                      ? <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: P.textSub }}>{hw.homework_text}</p>
                      : <p className="text-xs italic" style={{ color: P.textMuted }}>No homework text recorded</p>}
                    {hw.teacher_note && <p className="text-xs mt-1 italic" style={{ color: P.textMuted }}>Note: {hw.teacher_note}</p>}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

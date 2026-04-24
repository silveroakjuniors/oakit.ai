'use client';
import { useState, useEffect } from 'react';
import {
  ChevronRight, Bell, CheckCircle2, BarChart2, MessageCircle,
  ClipboardList, BookOpen, Calendar, Paperclip,
  Sparkles, User, BookMarked,
} from 'lucide-react';
import ChildAvatar from './ChildAvatar';
import { useTranslation } from '../context';
import type { ChildFeed, ProgressData, AttendanceData, Child, Announcement, NoteItem, Tab } from '../types';

// ── Shared card style ──────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: '#F8FAFC',
  border: '1px solid #E4E4E7',
  borderRadius: 12,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  transition: 'box-shadow 0.18s ease, transform 0.18s ease',
};

const cardHoverClass = 'hover:shadow-md hover:-translate-y-0.5';

// ── Section label — Lucide icon + text ────────────────────────────────────────
function SectionLabel({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={14} className="text-neutral-400" strokeWidth={1.75} />
      <p className="text-sm font-semibold text-neutral-700">{text}</p>
    </div>
  );
}

// ── Animated ring ──────────────────────────────────────────────────────────────
function Ring({ pct, color = '#1F7A5A', size = 100, stroke = 10 }: {
  pct: number; color?: string; size?: number; stroke?: number;
}) {
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => { const id = setTimeout(() => setAnimPct(pct), 120); return () => clearTimeout(id); }, [pct]);
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E4E4E7" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${(animPct/100)*c} ${c}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
    </svg>
  );
}

// ── Bar ────────────────────────────────────────────────────────────────────────
function Bar({ pct, color }: { pct: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const id = setTimeout(() => setW(pct), 150); return () => clearTimeout(id); }, [pct]);
  return (
    <div className="h-1.5 rounded-full bg-neutral-100">
      <div className="h-1.5 rounded-full" style={{ width: `${w}%`, background: color, transition: 'width 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
    </div>
  );
}

export default function HomeTab({ feed, progress, attendance, unreadMessages, unreadNotifs, activeChild, announcements, onNoteClick, onTabChange, token, onChildUpdate }: {
  feed: ChildFeed | null; progress: ProgressData | null; attendance: AttendanceData | null;
  unreadMessages?: number; unreadNotifs?: number;
  activeChild: Child | null;
  announcements: Announcement[]; onNoteClick: (n: NoteItem) => void; onTabChange: (t: Tab) => void;
  token: string; onChildUpdate: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [topicSummary, setTopicSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Cache AI topic summary in localStorage — one fetch per child per day per completion state
  useEffect(() => {
    const topics = feed?.topics;
    if (!topics || topics.length === 0 || !token || !activeChild) { setTopicSummary(null); return; }

    const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const isCompleted = !!feed?.completion;
    const cacheKey = `topic_summary_${activeChild.id}_${todayKey}_${isCompleted ? 'done' : 'plan'}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached !== null) { setTopicSummary(cached || null); return; }

    setSummaryLoading(true);
    setTopicSummary(null);
    const params = new URLSearchParams({
      topics: topics.join(','),
      class_name: activeChild.class_name,
      child_name: activeChild.name.split(' ')[0],
      completed: String(isCompleted),
    });
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/ai/topic-summary?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        const summary = d.summary || '';
        localStorage.setItem(cacheKey, summary);
        setTopicSummary(summary || null);
      })
      .catch(() => setTopicSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [feed?.topics?.join(','), feed?.completion, activeChild?.id, token]);

  if (!activeChild) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
        <User size={28} className="text-neutral-400" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-semibold text-neutral-800 mb-1">No child selected</p>
      <p className="text-sm text-neutral-400">Select a child from the sidebar</p>
    </div>
  );

  // Derive parent name from child record
  const parentName = [activeChild.father_name, activeChild.mother_name].filter(Boolean).join(' & ') || null;

  const att        = feed?.attendance;
  const isPresent  = att?.status === 'present' && !att?.is_late;
  const isLate     = att?.status === 'present' && att?.is_late;
  const pct        = progress?.coverage_pct ?? 0;
  const attLabel   = !att ? 'Not marked' : isPresent ? 'Present' : isLate ? 'Late' : 'Absent';
  const attColor   = !att ? 'text-neutral-400' : isPresent ? 'text-emerald-600' : isLate ? 'text-amber-600' : 'text-red-500';
  const attBg      = !att ? 'bg-neutral-100' : isPresent ? 'bg-emerald-50' : isLate ? 'bg-amber-50' : 'bg-red-50';
  const arrivalTime = att?.arrived_at ? `Arrived ${att.arrived_at}` : null;
  const weekDays   = ['M','T','W','T','F','S','S'];

  return (
    <div className="space-y-4 pb-6">

      {/* ── Profile Modal ──────────────────────────────────────────── */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowProfile(false)}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: '#fff', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 pt-5 pb-4" style={{ background: '#1F7A5A' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.65)' }}>Child Profile</p>
                <button onClick={() => setShowProfile(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all text-lg font-bold">×</button>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-white/30 flex-shrink-0">
                  <ChildAvatar child={activeChild} size="lg" token={token} onUploaded={onChildUpdate} />
                </div>
                <div>
                  <p className="text-white font-bold text-lg leading-tight">{activeChild.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {activeChild.class_name} · Section {activeChild.section_label}
                  </p>
                </div>
              </div>
            </div>
            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              {/* Attendance status */}
              <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p className="text-xs font-medium" style={{ color: '#64748B' }}>Today's Attendance</p>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${attBg} ${attColor}`}>{attLabel}</span>
              </div>
              {/* Parent names */}
              {activeChild.father_name && (
                <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <p className="text-xs font-medium" style={{ color: '#64748B' }}>Father</p>
                  <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>{activeChild.father_name}</p>
                </div>
              )}
              {activeChild.mother_name && (
                <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <p className="text-xs font-medium" style={{ color: '#64748B' }}>Mother</p>
                  <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>{activeChild.mother_name}</p>
                </div>
              )}
              {/* Class info */}
              <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p className="text-xs font-medium" style={{ color: '#64748B' }}>Class</p>
                <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>{activeChild.class_name} · Section {activeChild.section_label}</p>
              </div>
            </div>
            <div className="px-5 pb-5">
              <button onClick={() => setShowProfile(false)}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: '#F1F5F9', color: '#334155' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className={`rounded-xl p-4 ${cardHoverClass}`} style={cardStyle}>
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative shrink-0" title={activeChild.name}>
            <div className="rounded-xl overflow-hidden border border-neutral-200">
              <ChildAvatar child={activeChild} size="lg" token={token} onUploaded={onChildUpdate} />
            </div>
            <span
              title={isPresent ? 'Present today' : 'Not present'}
              className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${isPresent ? 'bg-emerald-500' : 'bg-neutral-300'}`}
            />
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-neutral-900 truncate">{activeChild.name}</h1>
            <p className="text-xs text-neutral-500 mt-0.5">{activeChild.class_name} · Section {activeChild.section_label}</p>
            {parentName && (
              <p className="text-xs mt-0.5 truncate" style={{ color: '#64748B' }}>
                👨‍👩‍👧 {parentName}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                title={`Attendance status: ${attLabel}`}
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${attBg} ${attColor}`}>
                ● {attLabel}
              </span>
            </div>
          </div>
          {/* View Profile */}
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-1 text-xs font-medium shrink-0 transition-all hover:opacity-70"
            style={{ color: '#1F7A5A' }}>
            View Profile
            <ChevronRight size={12} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ── STATS ROW — pastel tinted cards ─────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {([
          { label: 'Attendance', value: `${attendance?.attendance_pct ?? '—'}%`, cardBg: '#F0FDF4', cardBorder: '#D1FAE5', iconBg: '#DCFCE7', iconColor: '#166A4D', Icon: CheckCircle2,  onClick: undefined,                          title: 'Attendance rate this term' },
          { label: 'Progress',   value: `${pct}%`,                               cardBg: '#EFF6FF', cardBorder: '#DBEAFE', iconBg: '#DBEAFE', iconColor: '#1D4ED8', Icon: BarChart2,      onClick: undefined,                          title: 'Curriculum coverage progress' },
          { label: 'Messages',   value: unreadMessages != null ? String(unreadMessages) : '—', cardBg: '#F5F3FF', cardBorder: '#EDE9FE', iconBg: '#EDE9FE', iconColor: '#7C3AED', Icon: MessageCircle, onClick: () => onTabChange('messages'),       title: 'Unread messages from teachers' },
          { label: 'Updates',    value: unreadNotifs   != null ? String(unreadNotifs)   : '—', cardBg: '#FEFCE8', cardBorder: '#FEF08A', iconBg: '#FEF9C3', iconColor: '#B45309', Icon: Bell,          onClick: () => onTabChange('notifications'), title: 'Unread notifications and updates' },
        ] as const).map(s => (
          <button
            key={s.label}
            onClick={s.onClick}
            title={s.title}
            className="rounded-xl p-3 text-left transition-all active:scale-95 hover:shadow-md hover:-translate-y-0.5 hover:brightness-[0.97]"
            style={{ background: s.cardBg, border: `1px solid ${s.cardBorder}`, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
              style={{ background: s.iconBg }}>
              <s.Icon size={15} style={{ color: s.iconColor }} strokeWidth={1.75} />
            </div>
            <p className="text-lg font-semibold text-neutral-900 leading-none">{s.value}</p>
            <p className="text-xs text-neutral-400 mt-1">{s.label}</p>
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT — 2 columns ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* LEFT — Today's Feed */}
        <div className={`p-4 ${cardHoverClass}`} style={cardStyle}>
          <SectionLabel icon={ClipboardList} text={
            feed?.feed_date
              ? (() => {
                  const [y, m, d] = feed.feed_date.split('-').map(Number);
                  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
                })()
              : new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
          } />

          {/* Attendance pill */}
          {att && (
            <div className="flex items-center gap-2 mb-3">
              <span
                title={`Attendance: ${attLabel}`}
                className={`px-3 py-1 rounded-full text-xs font-medium ${attBg} ${attColor}`}>
                {attLabel}{arrivalTime ? ` · ${att.arrived_at}` : ''}
              </span>
              {isPresent && <span className="text-xs text-neutral-400">On time</span>}
            </div>
          )}

          {/* Topics */}
          {feed?.topics && feed.topics.length > 0 && (
            <div className="mb-3">
              {summaryLoading ? (
                <div className="rounded-lg px-4 py-3 animate-pulse bg-neutral-100">
                  <div className="h-3 rounded-full w-3/4 mb-2 bg-neutral-200" />
                  <div className="h-3 rounded-full w-1/2 bg-neutral-200" />
                </div>
              ) : topicSummary ? (
                /* AI summary replaces the label — it already contains the full sentence */
                <div className={`rounded-lg px-3 py-2.5 mb-2 ${feed.completion ? 'bg-emerald-50 border border-emerald-100' : 'bg-blue-50 border border-blue-100'}`}>
                  <div className="flex items-start gap-2">
                    <Sparkles size={13} className={`shrink-0 mt-0.5 ${feed.completion ? 'text-emerald-500' : 'text-blue-400'}`} strokeWidth={1.75} />
                    <p className="text-xs leading-relaxed text-neutral-700">{topicSummary}</p>
                  </div>
                </div>
              ) : (
                /* No AI summary — show label + topic pills */
                <>
                  {(() => {
                    const isCompleted = !!feed.completion;
                    const childFirst = activeChild?.name?.split(' ')[0] ?? 'Your child';
                    return (
                      <p className="text-xs font-medium mb-2" style={{ color: isCompleted ? '#166A4D' : '#64748B' }}>
                        {isCompleted ? `Today ${childFirst} learned` : `Today ${childFirst} will be learning`}
                      </p>
                    );
                  })()}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {feed.topics.map((topic, i) => (
                      <span key={i} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${feed.completion ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-neutral-100 text-neutral-600 border-neutral-200'}`}>
                        {topic}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Special label */}
          {feed?.special_label && (
            <div className="rounded-lg px-3 py-2 mb-3 bg-yellow-50 border border-yellow-100">
              <p className="text-xs font-medium text-neutral-800">{feed.special_label}</p>
            </div>
          )}

          {/* Homework */}
          {feed?.homework ? (
            <div className="rounded-lg p-3 bg-neutral-50 border border-neutral-200">
              <div className="flex items-center gap-1.5 mb-1">
                <BookMarked size={11} className="text-neutral-400" strokeWidth={1.75} />
                <p className="text-xs font-semibold text-neutral-500">Homework</p>
              </div>
              <p className="text-xs leading-relaxed text-neutral-700">
                {feed.homework.formatted_text || feed.homework.raw_text}
              </p>
            </div>
          ) : (
            <div className="rounded-lg px-3 py-2 bg-emerald-50 border border-emerald-100 flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" strokeWidth={1.75} />
              <p className="text-xs font-medium text-emerald-700">No pending homework</p>
            </div>
          )}

          {/* Teacher Notes — inline, below homework */}
          {feed?.notes && feed.notes.length > 0 && (
            <div className="mt-3 pt-3 border-t border-neutral-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Bell size={11} className="text-amber-500" strokeWidth={1.75} />
                <p className="text-xs font-semibold text-neutral-500">Teacher Notes</p>
              </div>
              <div className="space-y-1.5">
                {feed.notes.map(note => {
                  const dl = Math.ceil((new Date(note.expires_at).getTime() - Date.now()) / 86400000);
                  return (
                    <button
                      key={note.id}
                      onClick={() => onNoteClick(note)}
                      title="View note details"
                      className="w-full text-left rounded-lg px-3 py-2 flex items-start gap-2 transition-all hover:bg-amber-50 hover:shadow-sm border border-amber-100 bg-amber-50/50">
                      <div className="flex-1 min-w-0">
                        {note.note_text && <p className="text-xs line-clamp-2 text-neutral-700">{note.note_text}</p>}
                        {note.file_name && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Paperclip size={10} className="text-neutral-400 shrink-0" strokeWidth={1.75} />
                            <p className="text-[11px] font-medium truncate text-neutral-500">{note.file_name}</p>
                          </div>
                        )}
                        <p className={`text-[11px] mt-0.5 font-medium ${dl <= 3 ? 'text-red-500' : 'text-neutral-400'}`}>
                          {dl <= 0 ? 'Expires today' : `Expires in ${dl}d`}
                        </p>
                      </div>
                      <ChevronRight size={12} className="text-neutral-300 shrink-0 mt-0.5" strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Curriculum Progress + This Week stacked */}
        <div className="flex flex-col gap-4">

          {/* Curriculum progress */}
          <div className={`p-4 ${cardHoverClass}`} style={cardStyle}>
            <SectionLabel icon={BookOpen} text="Curriculum Progress" />
            <div className="flex items-center gap-4">
              <div className="relative flex items-center justify-center flex-shrink-0">
                <Ring pct={pct} color="#1F7A5A" size={80} stroke={8} />
                <div className="absolute text-center">
                  <p className="text-lg font-semibold text-neutral-900">{pct}%</p>
                </div>
              </div>
              <div className="space-y-2.5 flex-1">
                {(progress as any)?.subjects && ((progress as any).subjects as any[]).length > 0
                  ? ((progress as any).subjects as any[]).slice(0, 3).map((s: any) => {
                      const name  = s.subject_name || s.name || 'Subject';
                      const val   = s.coverage_pct ?? s.pct ?? 0;
                      const subjectColors = ['#1F7A5A', '#1D4ED8', '#B45309', '#7C3AED', '#DC2626'];
                      const color = s.color ?? subjectColors[((progress as any).subjects as any[]).indexOf(s) % subjectColors.length];
                      return (
                        <div key={name} title={`${name}: ${val}% covered`}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-neutral-500">{name}</span>
                            <span className="font-medium text-neutral-700">{val}%</span>
                          </div>
                          <Bar pct={val} color={color} />
                        </div>
                      );
                    })
                  : (
                    <div className="flex flex-col justify-center h-full">
                      <p className="text-xs text-neutral-500">
                        {pct > 0 ? `${pct}% of curriculum covered this term` : 'No subject breakdown available'}
                      </p>
                      {pct > 0 && <div className="mt-2"><Bar pct={pct} color="#1F7A5A" /></div>}
                    </div>
                  )
                }
              </div>
            </div>
          </div>

          {/* This week attendance */}
          <div className={`p-4 ${cardHoverClass}`} style={cardStyle}>
            <SectionLabel icon={Calendar} text="This Week" />
            <div className="flex justify-between mb-2">
              {weekDays.map((d, i) => {
                const now = new Date();
                const dayOfWeek = now.getDay();
                const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                const weekDate = new Date(now);
                weekDate.setDate(now.getDate() + mondayOffset + i);
                const dateKey = weekDate.toISOString().split('T')[0];
                const rec = attendance?.records?.find(r => r.attend_date === dateKey);
                const isWeekend = i >= 5;
                const isFuture = weekDate > now;
                const status = isWeekend ? '–' : isFuture ? '·' : rec?.status === 'present' ? '✓' : rec?.status === 'absent' ? '✗' : '·';
                const color  = isWeekend || isFuture ? '#D4D4D8' : status === '✓' ? '#1F7A5A' : status === '✗' ? '#DC2626' : '#A1A1AA';
                const dayTitle = isWeekend ? 'Weekend' : isFuture ? 'Upcoming' : status === '✓' ? 'Present' : status === '✗' ? 'Absent' : 'No record';
                return (
                  <div key={i} className="flex flex-col items-center gap-1" title={`${d} — ${dayTitle}`}>
                    <span className="text-[11px] font-medium text-neutral-400">{d}</span>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all hover:scale-110"
                      style={{ background: `${color}12`, color, border: `1.5px solid ${color}30` }}>
                      {status}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 text-xs pt-2 border-t border-neutral-100">
              <span className="flex items-center gap-1.5 text-neutral-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />Present
              </span>
              <span className="flex items-center gap-1.5 text-neutral-500">
                <span className="w-2 h-2 rounded-full bg-red-500" />Absent
              </span>
              <span className="ml-auto font-semibold text-neutral-700">
                {attendance?.stats?.present ?? '—'}/{attendance?.stats?.total ?? 5} days
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

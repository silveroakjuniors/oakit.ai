'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, AlertCircle, Calendar, Sparkles } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

interface CalDay {
  date: string;
  day: number;
  dow: number;
  is_today: boolean;
  is_past: boolean;
  day_type: 'weekend' | 'holiday' | 'special' | 'half_day_special' | 'completed' | 'missed' | 'scheduled' | 'no_plan';
  plan_status: string | null;
  chunk_count: number;
  covered_count: number;
  completed: boolean;
  holiday_label: string | null;
  special_label: string | null;
  special_type: string | null;
  activity_note: string | null;
}

interface CalStats {
  total_working: number;
  completed: number;
  missed: number;
  pending: number;
  completion_pct: number;
}

interface Section {
  section_id: string;
  section_label: string;
  class_name: string;
  role: string;
}

const DAY_STYLES: Record<string, { bg: string; text: string; dot?: string; label?: string }> = {
  weekend:          { bg: 'bg-gray-50',       text: 'text-gray-300' },
  holiday:          { bg: 'bg-red-50',         text: 'text-red-500',     dot: 'bg-red-400',     label: '🎉' },
  special:          { bg: 'bg-blue-50',        text: 'text-blue-600',    dot: 'bg-blue-400',    label: '📌' },
  half_day_special: { bg: 'bg-indigo-50',      text: 'text-indigo-600',  dot: 'bg-indigo-400',  label: '½' },
  completed:        { bg: 'bg-emerald-50',     text: 'text-emerald-700', dot: 'bg-emerald-500', label: '✓' },
  missed:           { bg: 'bg-amber-50',       text: 'text-amber-700',   dot: 'bg-amber-400',   label: '!' },
  scheduled:        { bg: 'bg-white',          text: 'text-gray-700' },
  no_plan:          { bg: 'bg-gray-50',        text: 'text-gray-400' },
};

export default function TeacherCalendarPage() {
  const router = useRouter();
  const token = getToken() || '';

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [days, setDays]   = useState<CalDay[]>([]);
  const [stats, setStats] = useState<CalStats | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CalDay | null>(null);

  // Load sections once
  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    apiGet<Section[]>('/api/v1/teacher/sections', token)
      .then(data => {
        setSections(data);
        if (data.length > 0) setSectionId(data[0].section_id);
      })
      .catch(() => {});
  }, [token]);

  const loadCalendar = useCallback(async () => {
    if (!sectionId) return;
    setLoading(true);
    try {
      const data = await apiGet<any>(
        `/api/v1/teacher/calendar?month=${month}&year=${year}&section_id=${sectionId}`,
        token
      );
      setDays(data.days || []);
      setStats(data.stats || null);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [month, year, sectionId, token]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelected(null);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelected(null);
  }

  // Pad days array with empty cells for the first week
  const firstDow = days[0]?.dow ?? 0;
  const paddedDays = [...Array(firstDow).fill(null), ...days];

  const currentSection = sections.find(s => s.section_id === sectionId);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 p-1">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900">My Calendar</p>
            {currentSection && (
              <p className="text-xs text-gray-400">{currentSection.class_name} · Section {currentSection.section_label}</p>
            )}
          </div>
          <div className="w-7" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 flex flex-col gap-4">

        {/* Section switcher — only shown when teacher has multiple sections */}
        {sections.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sections.map(s => (
              <button
                key={s.section_id}
                onClick={() => { setSectionId(s.section_id); setSelected(null); }}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  sectionId === s.section_id
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {s.class_name} {s.section_label}
                {s.role === 'class_teacher' && <span className="ml-1 opacity-60">★</span>}
              </button>
            ))}
          </div>
        )}

        {/* Month navigator */}
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
          <button onClick={prevMonth} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <p className="text-sm font-bold text-gray-900">{MONTHS[month - 1]} {year}</p>
          <button onClick={nextMonth} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Working', value: stats.total_working, color: 'text-gray-700', bg: 'bg-white' },
              { label: 'Done', value: stats.completed, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Missed', value: stats.missed, color: 'text-amber-700', bg: 'bg-amber-50' },
              { label: 'Pending', value: stats.pending, color: 'text-blue-700', bg: 'bg-blue-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl px-2 py-2.5 text-center border border-gray-100`}>
                <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Calendar grid */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DOW.map(d => (
              <div key={d} className="py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
          ) : (
            <div className="grid grid-cols-7">
              {paddedDays.map((day, i) => {
                if (!day) return <div key={`pad-${i}`} className="aspect-square" />;
                const style = DAY_STYLES[day.day_type] || DAY_STYLES.scheduled;
                const isSelected = selected?.date === day.date;
                return (
                  <button
                    key={day.date}
                    onClick={() => setSelected(isSelected ? null : day)}
                    className={`aspect-square flex flex-col items-center justify-center gap-0.5 relative transition-all
                      ${style.bg} ${style.text}
                      ${day.is_today ? 'ring-2 ring-inset ring-primary-500' : ''}
                      ${isSelected ? 'ring-2 ring-inset ring-primary-400 scale-95' : ''}
                      ${day.day_type === 'weekend' ? 'cursor-default' : 'hover:opacity-80 active:scale-95'}
                    `}
                  >
                    <span className={`text-xs font-semibold ${day.is_today ? 'text-primary-600' : ''}`}>
                      {day.day}
                    </span>
                    {style.label && (
                      <span className="text-[9px] leading-none">{style.label}</span>
                    )}
                    {style.dot && !style.label && (
                      <span className={`w-1 h-1 rounded-full ${style.dot}`} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 px-1">
          {[
            { label: 'Completed', dot: 'bg-emerald-500' },
            { label: 'Missed', dot: 'bg-amber-400' },
            { label: 'Holiday', dot: 'bg-red-400' },
            { label: 'Special Day', dot: 'bg-blue-400' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${l.dot}`} />
              <span className="text-[11px] text-gray-500">{l.label}</span>
            </div>
          ))}
        </div>

        {/* Day detail panel */}
        {selected && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {new Date(selected.date + 'T12:00:00').toLocaleDateString('en-IN', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </p>
                {selected.is_today && (
                  <span className="text-[10px] font-bold text-primary-600 uppercase tracking-wide">Today</span>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100">✕</button>
            </div>

            {/* Holiday */}
            {selected.holiday_label && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <span className="text-lg">🎉</span>
                <div>
                  <p className="text-xs font-semibold text-red-700">Holiday</p>
                  <p className="text-sm text-red-800">{selected.holiday_label}</p>
                </div>
              </div>
            )}

            {/* Special day */}
            {selected.special_label && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                <span className="text-lg">📌</span>
                <div>
                  <p className="text-xs font-semibold text-blue-700 capitalize">
                    {selected.special_type?.replace(/_/g, ' ')}
                    {selected.day_type === 'half_day_special' && ' · Half Day'}
                  </p>
                  <p className="text-sm text-blue-800">{selected.special_label}</p>
                  {selected.activity_note && (
                    <p className="text-xs text-blue-600 mt-1">{selected.activity_note}</p>
                  )}
                </div>
              </div>
            )}

            {/* Plan status */}
            {!['weekend', 'holiday', 'no_plan'].includes(selected.day_type) && (
              <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
                selected.completed
                  ? 'bg-emerald-50 border-emerald-200'
                  : selected.day_type === 'missed'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-gray-50 border-gray-200'
              }`}>
                {selected.completed
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  : selected.day_type === 'missed'
                    ? <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    : <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                }
                <div>
                  <p className={`text-xs font-semibold ${
                    selected.completed ? 'text-emerald-700' : selected.day_type === 'missed' ? 'text-amber-700' : 'text-gray-600'
                  }`}>
                    {selected.completed ? 'Plan completed' : selected.day_type === 'missed' ? 'Plan not completed' : 'Plan scheduled'}
                  </p>
                  {selected.chunk_count > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {selected.covered_count} / {selected.chunk_count} topics covered
                    </p>
                  )}
                </div>
              </div>
            )}

            {selected.day_type === 'no_plan' && !selected.holiday_label && !selected.special_label && (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <Calendar className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-500">No plan generated for this day</p>
              </div>
            )}

            {/* Go to plan button for today or future scheduled days */}
            {(selected.is_today || (!selected.is_past && selected.day_type === 'scheduled')) && (
              <button
                onClick={() => router.push('/teacher')}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg,#1a4a2e 0%,#1F7A5A 100%)' }}
              >
                <Sparkles className="w-4 h-4" />
                {selected.is_today ? 'Go to Today\'s Plan' : 'View Plan'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

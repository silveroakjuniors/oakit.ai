'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, FileText, ChevronLeft, ChevronRight, Calendar, Download } from 'lucide-react';
import { API_BASE, apiGet } from '@/lib/api';

interface Chunk { id: string; topic_label: string; content: string; activity_ids?: string[] }
interface WeekDay {
  date: string;
  day_name: string;
  day_short: string;
  is_today: boolean;
  is_past: boolean;
  holiday_label: string | null;
  special_label: string | null;
  special_type: string | null;
  status: string;
  chunks: Chunk[];
  admin_note: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  token: string;
  sectionId: string;
  today: string;
}

// Get Monday of the week containing a given date
function getMondayOf(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function addDays(dateStr: string, n: number): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function WeeklyPlanModal({ open, onClose, token, sectionId, today }: Props) {
  const [mode, setMode] = useState<'week' | 'range'>('week');
  const [weekFrom, setWeekFrom] = useState(getMondayOf(today));
  const [rangeFrom, setRangeFrom] = useState(today);
  const [rangeTo, setRangeTo] = useState(addDays(today, 4));
  const [days, setDays] = useState<WeekDay[]>([]);
  const [weekLabel, setWeekLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sectionId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ section_id: sectionId });
      if (mode === 'week') {
        params.set('from', weekFrom);
      } else {
        params.set('from', rangeFrom);
        params.set('to', rangeTo);
      }
      const data = await apiGet<{ days: WeekDay[]; week_label: string }>(
        `/api/v1/teacher/plan/week?${params}`, token
      );
      setDays(data.days || []);
      setWeekLabel(data.week_label || '');
      // Auto-expand today or first day
      const todayDay = data.days?.find(d => d.is_today);
      setExpandedDay(todayDay?.date || data.days?.[0]?.date || null);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [sectionId, token, mode, weekFrom, rangeFrom, rangeTo]);

  useEffect(() => { if (open) load(); }, [open, load]);

  function prevWeek() { setWeekFrom(d => addDays(d, -7)); }
  function nextWeek() { setWeekFrom(d => addDays(d, 7)); }

  async function downloadPdf() {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ section_id: sectionId });
      if (mode === 'week') params.set('from', weekFrom);
      else { params.set('from', rangeFrom); params.set('to', rangeTo); }

      const res = await fetch(`${API_BASE}/api/v1/teacher/plan/week/pdf?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `weekly-plan-${mode === 'week' ? weekFrom : rangeFrom}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert(e.message || 'Download failed'); }
    finally { setDownloading(false); }
  }

  if (!open) return null;

  const totalTopics = days.reduce((sum, d) => sum + (d.chunks?.length || 0), 0);
  const workingDays = days.filter(d => !d.holiday_label && !['holiday', 'special', 'no_plan'].includes(d.status) || d.chunks?.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col" style={{ maxHeight: 'calc(100dvh - 2rem)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Weekly Plan</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {mode === 'week' ? weekLabel : `${fmtDate(rangeFrom)} → ${fmtDate(rangeTo)}`}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode toggle + navigation */}
        <div className="px-5 pt-3 pb-2 shrink-0 flex flex-col gap-2">
          {/* Week / Custom Range toggle */}
          <div className="flex gap-1 bg-neutral-100 rounded-xl p-1">
            {(['week', 'range'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  mode === m ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500'
                }`}>
                {m === 'week' ? '📅 This Week' : '📆 Custom Range'}
              </button>
            ))}
          </div>

          {mode === 'week' ? (
            /* Week navigator */
            <div className="flex items-center justify-between bg-neutral-50 rounded-xl px-3 py-2">
              <button onClick={prevWeek} className="p-1 rounded-lg hover:bg-neutral-200 transition-colors">
                <ChevronLeft className="w-4 h-4 text-neutral-500" />
              </button>
              <div className="text-center">
                <p className="text-xs font-semibold text-neutral-700">{weekLabel || 'Loading…'}</p>
                {weekFrom === getMondayOf(today) && (
                  <p className="text-[10px] text-primary-600 font-medium">Current week</p>
                )}
                {weekFrom === getMondayOf(addDays(today, 7)) && (
                  <p className="text-[10px] text-emerald-600 font-medium">Next week</p>
                )}
              </div>
              <button onClick={nextWeek} className="p-1 rounded-lg hover:bg-neutral-200 transition-colors">
                <ChevronRight className="w-4 h-4 text-neutral-500" />
              </button>
            </div>
          ) : (
            /* Custom date range */
            <div className="flex gap-2 items-center">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">From</label>
                <input type="date" value={rangeFrom}
                  onChange={e => setRangeFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs bg-white focus:outline-none focus:border-primary-400" />
              </div>
              <span className="text-neutral-400 mt-4">→</span>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">To</label>
                <input type="date" value={rangeTo} min={rangeFrom}
                  onChange={e => setRangeTo(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-xs bg-white focus:outline-none focus:border-primary-400" />
              </div>
              <button onClick={load}
                className="mt-4 px-3 py-2 bg-primary-600 text-white rounded-xl text-xs font-semibold hover:bg-primary-700 transition-colors">
                Go
              </button>
            </div>
          )}

          {/* Summary bar */}
          {!loading && days.length > 0 && (
            <div className="flex gap-3 text-xs text-neutral-500 px-1">
              <span>📅 {workingDays.length} working days</span>
              <span>📚 {totalTopics} topics</span>
              {days.some(d => d.holiday_label) && (
                <span>🎉 {days.filter(d => d.holiday_label).length} holiday{days.filter(d => d.holiday_label).length !== 1 ? 's' : ''}</span>
              )}
              {days.some(d => d.special_label) && (
                <span>📌 {days.filter(d => d.special_label).length} special day{days.filter(d => d.special_label).length !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}
        </div>

        {/* Day list */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-3 flex flex-col gap-2 -webkit-overflow-scrolling-touch">
          {loading ? (
            <div className="py-10 text-center text-sm text-neutral-400">Loading plan…</div>
          ) : days.length === 0 ? (
            <div className="py-10 text-center text-sm text-neutral-400">No plans found for this period</div>
          ) : days.map(day => {
            const isExpanded = expandedDay === day.date;
            const hasContent = day.chunks?.length > 0;
            const isHoliday = !!day.holiday_label;
            const isSpecial = !!day.special_label;

            return (
              <div key={day.date}
                className={`rounded-2xl border transition-all ${
                  day.is_today ? 'border-primary-300 ring-1 ring-primary-200' :
                  isHoliday ? 'border-red-200 bg-red-50/50' :
                  isSpecial ? 'border-blue-200 bg-blue-50/50' :
                  hasContent ? 'border-neutral-200 bg-white' :
                  'border-neutral-100 bg-neutral-50'
                }`}>
                {/* Day header — always visible */}
                <button
                  onClick={() => setExpandedDay(isExpanded ? null : day.date)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                      day.is_today ? 'bg-primary-600 text-white' :
                      isHoliday ? 'bg-red-100 text-red-600' :
                      isSpecial ? 'bg-blue-100 text-blue-600' :
                      hasContent ? 'bg-neutral-100 text-neutral-700' :
                      'bg-neutral-100 text-neutral-400'
                    }`}>
                      {new Date(day.date + 'T12:00:00').getDate()}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${day.is_today ? 'text-primary-700' : 'text-neutral-800'}`}>
                        {day.day_name}
                        {day.is_today && <span className="ml-1.5 text-[10px] font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-full">Today</span>}
                      </p>
                      <p className="text-[11px] text-neutral-400">{day.day_short}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isHoliday && <span className="text-xs text-red-600 font-medium">🎉 {day.holiday_label}</span>}
                    {isSpecial && !isHoliday && <span className="text-xs text-blue-600 font-medium">📌 {day.special_label}</span>}
                    {!isHoliday && !isSpecial && hasContent && (
                      <span className="text-[11px] text-neutral-400">{day.chunks.length} topic{day.chunks.length !== 1 ? 's' : ''}</span>
                    )}
                    {!isHoliday && !isSpecial && !hasContent && (
                      <span className="text-[11px] text-neutral-400">No plan</span>
                    )}
                    <span className={`text-neutral-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-neutral-100 px-4 pb-3 pt-2 flex flex-col gap-2">
                    {/* Special day note */}
                    {isSpecial && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-700">
                        <span className="font-semibold capitalize">{day.special_type?.replace(/_/g, ' ')}: </span>
                        {day.special_label}
                      </div>
                    )}
                    {/* Admin note */}
                    {day.admin_note && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                        📌 <span className="font-semibold">Admin note: </span>{day.admin_note}
                      </div>
                    )}
                    {/* Topics */}
                    {day.chunks?.length > 0 ? day.chunks.map((chunk, i) => (
                      <div key={chunk.id} className="bg-neutral-50 rounded-xl px-3 py-2.5 border border-neutral-100">
                        <p className="text-xs font-semibold text-neutral-800 mb-1">{chunk.topic_label || `Topic ${i + 1}`}</p>
                        {chunk.content && (
                          <p className="text-[11px] text-neutral-500 leading-relaxed whitespace-pre-wrap break-words">{chunk.content}</p>
                        )}
                        {chunk.activity_ids?.length ? (
                          <p className="text-[10px] text-primary-600 mt-1">📎 {chunk.activity_ids.join(', ')}</p>
                        ) : null}
                      </div>
                    )) : !isHoliday && !isSpecial ? (
                      <p className="text-xs text-neutral-400 text-center py-2">No curriculum plan for this day</p>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer — download */}
        <div className="px-5 pb-5 pt-3 border-t border-neutral-100 shrink-0">
          <button
            onClick={downloadPdf}
            disabled={downloading || loading || days.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg,#1a4a2e 0%,#1F7A5A 100%)' }}
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Generating PDF…' : `Download ${mode === 'week' ? 'Week' : 'Range'} Plan PDF`}
          </button>
        </div>
      </div>
    </div>
  );
}

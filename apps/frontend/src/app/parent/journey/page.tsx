'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { ChevronLeft, Calendar, BookOpen, Search } from 'lucide-react';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';

interface JourneyEntry {
  id: string;
  entry_date: string;
  entry_type: 'daily' | 'weekly' | 'highlight';
  beautified_text: string;
  created_at: string;
}
interface JourneyData {
  student: { id: string; name: string };
  entries: JourneyEntry[];
  total: number;
}
interface Snapshot {
  snapshot: string;
  student_name: string;
  age: string;
  generated_at: string;
}

const TYPE_LABELS = {
  daily:     { label: 'Daily',        color: 'bg-blue-50 text-blue-700 border-blue-100' },
  weekly:    { label: 'Weekly',       color: 'bg-purple-50 text-purple-700 border-purple-100' },
  highlight: { label: '⭐ Highlight', color: 'bg-amber-50 text-amber-700 border-amber-100' },
};

export default function ChildJourneyParentPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-50 flex items-center justify-center"><div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" /></div>}>
      <ChildJourneyParentPage />
    </Suspense>
  );
}

function ChildJourneyParentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('student_id') || '';
  const token = getToken() || '';
  const { academicStart } = useAcademicCalendar(token);

  const [data, setData] = useState<JourneyData | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [effectiveToday, setEffectiveToday] = useState<string>('');

  // Draft dates — only committed on "Show" click
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  function applyFilter() {
    loadEntries(fromDate, toDate);
  }

  useEffect(() => {
    if (!token || !studentId) { router.push('/parent'); return; }

    // Fetch the child feed to get the time-machine-aware "today"
    apiGet<{ feed_date?: string }>(`/api/v1/parent/child/${studentId}/feed`, token)
      .then(feed => {
        const today = feed?.feed_date || new Date().toISOString().split('T')[0];
        setEffectiveToday(today);
        const d = new Date(today);
        d.setDate(d.getDate() - 30);
        const from = d.toISOString().split('T')[0];
        setFromDate(from);
        setToDate(today);
        // Trigger initial load directly with the resolved dates
        loadEntries(from, today);
      })
      .catch(() => {
        const today = new Date().toISOString().split('T')[0];
        setEffectiveToday(today);
        const d = new Date(today);
        d.setDate(d.getDate() - 30);
        const from = d.toISOString().split('T')[0];
        setFromDate(from);
        setToDate(today);
        loadEntries(from, today);
      });

    // Load snapshot once (cached per day)
    setSnapshotLoading(true);
    apiGet<Snapshot>(`/api/v1/parent/child-journey/parent/${studentId}/snapshot`, token)
      .then(setSnapshot).catch(() => {}).finally(() => setSnapshotLoading(false));
  }, [studentId]);

  async function loadEntries(from: string, to: string) {
    if (!from || !to) return;
    setLoading(true);
    try {
      const d = await apiGet<JourneyData>(
        `/api/v1/parent/child-journey/parent/${studentId}?from=${from}&to=${to}`,
        token
      );
      setData(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  const studentName = data?.student?.name || snapshot?.student_name || 'Your child';
  const firstName = studentName.split(' ')[0];

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-neutral-400 hover:text-neutral-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-neutral-900">{firstName}'s Journey</h1>
          <p className="text-xs text-neutral-500">Notes from the classroom</p>
        </div>
      </header>

      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">

        {/* ── Daily Snapshot ── */}
        {snapshotLoading ? (
          <div className="bg-white border border-neutral-100 rounded-2xl p-4 animate-pulse">
            <div className="h-3 bg-neutral-100 rounded w-1/3 mb-3" />
            <div className="h-3 bg-neutral-100 rounded w-full mb-2" />
            <div className="h-3 bg-neutral-100 rounded w-5/6 mb-2" />
            <div className="h-3 bg-neutral-100 rounded w-4/5" />
          </div>
        ) : snapshot?.snapshot ? (
          <div className="bg-gradient-to-br from-primary-50 to-emerald-50 border border-primary-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                <span className="text-base">🌱</span>
              </div>
              <div>
                <p className="text-sm font-bold text-primary-800">{firstName} today</p>
                {snapshot.age && (
                  <p className="text-[10px] text-primary-500">{snapshot.age} old</p>
                )}
              </div>
            </div>
            <p className="text-sm text-neutral-800 leading-relaxed">{snapshot.snapshot}</p>
          </div>
        ) : null}

        {/* Date range filter */}
        <div className="bg-white border border-neutral-100 rounded-xl px-3 py-2.5">
          <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            Filter by date range
          </p>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={fromDate}
              min={academicStart ?? undefined}
              max={toDate}
              onChange={e => setFromDate(e.target.value)}
              className="flex-1 text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <span className="text-neutral-300 text-xs shrink-0">→</span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              max={effectiveToday || undefined}
              onChange={e => setToDate(e.target.value)}
              className="flex-1 text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <button
              onClick={applyFilter}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50 shrink-0"
            >
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              Show
            </button>
          </div>
        </div>

        {/* Journey entries */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-neutral-100 rounded-2xl p-4 animate-pulse">
                <div className="h-3 bg-neutral-100 rounded w-1/3 mb-2" />
                <div className="h-3 bg-neutral-100 rounded w-full mb-1" />
                <div className="h-3 bg-neutral-100 rounded w-4/5" />
              </div>
            ))}
          </div>
        ) : data?.entries?.length === 0 ? (
          <div className="bg-white border border-neutral-100 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-6 h-6 text-primary-400" />
            </div>
            <p className="text-sm font-semibold text-neutral-800 mb-1">
              {firstName}'s journey is just beginning!
            </p>
            <p className="text-xs text-neutral-500 leading-relaxed">
              No specific highlights have been recorded for this period yet.
              Check back soon as the teacher shares more moments from the classroom.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data?.entries?.map(entry => {
              const typeStyle = TYPE_LABELS[entry.entry_type] || TYPE_LABELS.daily;
              const rawDate = (entry.entry_date || '').split('T')[0];
              const dateStr = rawDate
                ? new Date(rawDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
                : '—';
              return (
                <div key={entry.id} className="bg-white border border-neutral-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-neutral-600">{dateStr}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeStyle.color}`}>
                      {typeStyle.label}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-800 leading-relaxed">{entry.beautified_text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

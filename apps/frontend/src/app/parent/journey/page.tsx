'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { ChevronLeft, Sparkles, Calendar, BookOpen } from 'lucide-react';

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

const TYPE_LABELS = {
  daily: { label: 'Daily', color: 'bg-blue-50 text-blue-700 border-blue-100' },
  weekly: { label: 'Weekly', color: 'bg-purple-50 text-purple-700 border-purple-100' },
  highlight: { label: '⭐ Highlight', color: 'bg-amber-50 text-amber-700 border-amber-100' },
};

export default function ChildJourneyParentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('student_id') || '';
  const token = getToken() || '';

  const [data, setData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!token || !studentId) { router.push('/parent'); return; }
    load();
  }, [studentId, fromDate, toDate]);

  async function load() {
    setLoading(true);
    try {
      const d = await apiGet<JourneyData>(
        `/api/v1/parent/child-journey/${studentId}?from=${fromDate}&to=${toDate}`,
        token
      );
      setData(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  const studentName = data?.student?.name || 'Your child';

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-neutral-400 hover:text-neutral-600">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-neutral-900">{studentName}'s Journey</h1>
          <p className="text-xs text-neutral-500">How {studentName.split(' ')[0]} is growing at school</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
          <Sparkles className="w-3 h-3" />
          by Oakie
        </div>
      </header>

      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
        {/* Date range filter */}
        <div className="flex gap-2 items-center bg-white border border-neutral-100 rounded-xl px-3 py-2.5">
          <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="flex-1 text-xs text-neutral-700 bg-transparent focus:outline-none" />
          <span className="text-neutral-300 text-xs">→</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="flex-1 text-xs text-neutral-700 bg-transparent focus:outline-none" />
        </div>

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
              {studentName.split(' ')[0]}'s journey is just beginning!
            </p>
            <p className="text-xs text-neutral-500 leading-relaxed">
              {studentName.split(' ')[0]} is doing wonderfully — no specific highlights have been recorded for this period yet.
              Check back soon as the teacher shares more moments from the classroom.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data?.entries?.map(entry => {
              const typeStyle = TYPE_LABELS[entry.entry_type] || TYPE_LABELS.daily;
              const dateStr = new Date(entry.entry_date + 'T12:00:00').toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long',
              });
              return (
                <div key={entry.id} className="bg-white border border-neutral-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-neutral-600">{dateStr}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeStyle.color}`}>
                      {typeStyle.label}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-800 leading-relaxed">{entry.beautified_text}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Sparkles className="w-3 h-3 text-primary-400" />
                    <span className="text-[10px] text-primary-400">Written by Oakie</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

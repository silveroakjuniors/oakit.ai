'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { ChevronLeft, ChevronRight, BookOpen, Loader2, CheckCircle2 } from 'lucide-react';

interface ReportListItem {
  id: string; student_id: string; term: string; academic_year: string;
  student_name: string; class_name: string; section_label: string;
  shared_at: string; updated_at: string;
}

interface SubItem   { id: string; label: string; }
interface Domain    { id: string; label: string; sub_items: SubItem[]; }
interface ReportDetail extends ReportListItem {
  developmental_ratings: Record<string, Record<string, string>>;
  subject_grades: Record<string, string>;
  teacher_comment: string;
  teacher_comment_raw: string;
  school_name: string;
  domains: Domain[];
}

const TERM_LABELS: Record<string, string> = {
  mid_term: 'Mid-Term', final_term: 'Final Term',
};

const RATING_FULL: Record<string, string> = {
  E: 'Excellent', V: 'Very Good', G: 'Good', S: 'Satisfactory', P: 'Progressive',
};

const RATING_COLOR: Record<string, string> = {
  E: '#1B4332', V: '#2D6A4F', G: '#40916C', S: '#E8960C', P: '#888888',
};

export default function ParentHolisticReportPage() {
  const router = useRouter();
  const token = getToken() || '';

  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [selected, setSelected] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet<ReportListItem[]>('/api/v1/parent/holistic-report', token);
      setReports(data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function openReport(id: string) {
    setLoadingDetail(true);
    try {
      const data = await apiGet<ReportDetail>(`/api/v1/parent/holistic-report/${id}`, token);
      setSelected(data);
    } catch { /* ignore */ }
    finally { setLoadingDetail(false); }
  }

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selected) {
    const termLabel = TERM_LABELS[selected.term] || selected.term;
    const comment = selected.teacher_comment || selected.teacher_comment_raw;

    return (
      <div className="min-h-screen bg-neutral-50 pb-20">
        <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-neutral-100">
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-neutral-900">Progress Report</h1>
            <p className="text-xs text-neutral-400">{termLabel} — {selected.academic_year}</p>
          </div>
        </header>

        <div className="p-4 max-w-lg mx-auto flex flex-col gap-4">

          {/* Student info card */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-4">
            <p className="text-xs text-neutral-400 mb-1">{selected.school_name}</p>
            <p className="text-xs text-neutral-400 mb-3">Holistic Progress Report — Based on NCFES</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {selected.student_name.charAt(0)}
              </div>
              <div>
                <p className="text-base font-bold text-neutral-900">{selected.student_name}</p>
                <p className="text-sm text-neutral-500">{selected.class_name} — {selected.section_label}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-1 rounded-lg">{termLabel}</span>
              <span className="text-xs bg-neutral-100 text-neutral-500 font-medium px-2 py-1 rounded-lg">{selected.academic_year}</span>
            </div>
          </div>

          {/* Rating key */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
            <p className="text-xs font-semibold text-amber-800 mb-1">Rating Key</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(RATING_FULL).map(([k, v]) => (
                <span key={k} className="text-xs text-neutral-700">
                  <span className="font-bold" style={{ color: RATING_COLOR[k] }}>{k}</span> = {v}
                </span>
              ))}
            </div>
          </div>

          {/* Section A — Developmental */}
          {selected.domains.filter(d => d.sub_items?.length > 0).map(domain => {
            const domainRatings = selected.developmental_ratings?.[domain.id] || {};
            const rated = domain.sub_items.filter(i => domainRatings[i.id]);
            if (!rated.length) return null;

            return (
              <div key={domain.id} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-primary/5 border-b border-neutral-100">
                  <p className="text-sm font-semibold text-primary">{domain.label}</p>
                </div>
                <div className="divide-y divide-neutral-50">
                  {domain.sub_items.map((item, idx) => {
                    const rating = domainRatings[item.id] || '';
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between px-4 py-3 ${idx % 2 === 1 ? 'bg-neutral-50/40' : ''}`}
                      >
                        <p className="text-sm text-neutral-700 flex-1 pr-3">{item.label}</p>
                        {rating ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: RATING_COLOR[rating] || '#888' }}
                            >
                              {rating}
                            </span>
                            <span className="text-xs text-neutral-500">{RATING_FULL[rating]}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-300">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Section B — Subject Grades */}
          {Object.keys(selected.subject_grades || {}).length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-primary/5 border-b border-neutral-100">
                <p className="text-sm font-semibold text-primary">Result of Assessment Activities</p>
              </div>
              <div className="divide-y divide-neutral-50">
                {Object.entries(selected.subject_grades).filter(([, v]) => v).map(([subject, grade], idx) => (
                  <div
                    key={subject}
                    className={`flex items-center justify-between px-4 py-3 ${idx % 2 === 1 ? 'bg-neutral-50/40' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-neutral-400" />
                      <p className="text-sm text-neutral-700">{subject}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: RATING_COLOR[grade] || '#888' }}
                      >
                        {grade}
                      </span>
                      <span className="text-xs text-neutral-500">{RATING_FULL[grade]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teacher comment */}
          {comment && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-neutral-500 mb-2">Teacher's Comment</p>
              <p className="text-sm text-neutral-700 leading-relaxed">{comment}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1 rounded-lg hover:bg-neutral-100">
          <ChevronLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <h1 className="text-base font-semibold text-neutral-900">Progress Reports</h1>
      </header>

      <div className="p-4 max-w-lg mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-neutral-400">No reports shared yet</p>
            <p className="text-xs text-neutral-300 mt-1">Your child's teacher will share reports here</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map(r => (
              <button
                key={r.id}
                onClick={() => openReport(r.id)}
                className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-center gap-3 text-left hover:border-primary/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                  {r.student_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-800">{r.student_name}</p>
                  <p className="text-xs text-neutral-400">{r.class_name} — {r.section_label}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-lg">
                      {TERM_LABELS[r.term] || r.term}
                    </span>
                    <span className="text-xs text-neutral-300">{r.academic_year}</span>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  </div>
                </div>
                {loadingDetail ? (
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-300" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-neutral-300" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

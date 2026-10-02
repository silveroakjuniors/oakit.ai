'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { ChevronLeft, BookOpen, Loader2, FileText } from 'lucide-react';

interface ReportListItem {
  id: string; student_id: string; term: string; academic_year: string;
  student_name: string; class_name: string; section_label: string;
  shared_at: string; updated_at: string;
}
interface SubItem { id: string; label: string; }
interface Domain { id: string; label: string; sub_items: SubItem[]; }
interface ReportDetail extends ReportListItem {
  developmental_ratings: Record<string, Record<string, string>>;
  subject_grades: Record<string, string>;
  teacher_comment: string;
  teacher_comment_raw: string;
  school_name: string;
  domains: Domain[];
  strengths?: string; developing_skills?: string;
  at_school_support?: string; at_home_support?: string;
  silver_oak_moment?: string; attendance?: string;
}

const TERM_LABELS: Record<string, string> = { mid_term: 'Mid-Term', final_term: 'Final Term' };
const G = '#1B4332';
const A = '#E8960C';

// Growth Statements (PG/Nursery) — codes E, G, B, I
const GROWTH: Record<string, { label: string; color: string }> = {
  E: { label: 'Exploring',          color: '#6B9E7A' },
  G: { label: 'Growing',            color: '#4A8C6A' },
  B: { label: 'Becoming Confident', color: '#2D7A5A' },
  I: { label: 'Independent',        color: '#1B4332' },
  // Legacy codes from before the rename — still display correctly
  V: { label: 'Growing',            color: '#4A8C6A' },
  S: { label: 'Independent',        color: '#1B4332' },
};
// Standard scale (Jr/Sr KG)
const STANDARD: Record<string, { label: string; color: string }> = {
  E: { label: 'Excellent',    color: '#1B4332' },
  V: { label: 'Very Good',    color: '#2D6A4F' },
  G: { label: 'Good',         color: '#40916C' },
  S: { label: 'Satisfactory', color: '#E8960C' },
  P: { label: 'Progressive',  color: '#888888' },
};

const PG_NURSERY = new Set(['playgroup', 'play group', 'nursery', 'pg']);
function isPgNursery(cn: string) { return PG_NURSERY.has((cn || '').toLowerCase().trim()); }
function getRatingInfo(code: string, isPN: boolean) {
  return isPN ? (GROWTH[code] || null) : (STANDARD[code] || null);
}

function ParentHolisticReportInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const autoOpenId   = searchParams?.get('id') || null;
  const token        = getToken() || '';

  const [reports,       setReports]       = useState<ReportListItem[]>([]);
  const [selected,      setSelected]      = useState<ReportDetail | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError,   setDetailError]   = useState('');

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    (async () => {
      setLoading(true);
      try {
        const data = await apiGet<ReportListItem[]>('/api/v1/parent/holistic-report', token);
        setReports(data || []);
        if (autoOpenId) {
          await openReport(autoOpenId);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  async function openReport(id: string) {
    setLoadingDetail(true);
    setDetailError('');
    try {
      const data = await apiGet<ReportDetail>(`/api/v1/parent/holistic-report/${id}`, token);
      setSelected(data);
    } catch (e: any) {
      setDetailError(e?.message || 'Could not load report');
    }
    finally { setLoadingDetail(false); }
  }

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (loadingDetail) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (detailError) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center gap-4 p-6">
        <FileText className="w-12 h-12 text-neutral-300" />
        <p className="text-sm font-medium text-neutral-600 text-center">{detailError}</p>
        <button onClick={() => setDetailError('')}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: G }}>Go Back</button>
      </div>
    );
  }

  if (selected) {
    const r = selected;
    const termLabel = TERM_LABELS[r.term] || r.term;
    const comment   = r.teacher_comment || r.teacher_comment_raw;
    const isPN      = isPgNursery(r.class_name);
    const scaleKey  = isPN ? GROWTH : STANDARD;

    return (
      <div className="min-h-screen bg-neutral-50 pb-20">
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${G} 0%, #2d6a4f 100%)` }} className="sticky top-0 z-10 px-4 py-4">
          <div className="flex items-center gap-3 max-w-2xl mx-auto">
            <button onClick={() => setSelected(null)} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/60 uppercase tracking-widest font-semibold">Holistic Progress Report</p>
              <p className="text-base font-bold text-white truncate">{r.student_name}</p>
              <p className="text-xs text-white/70">{r.class_name} — {r.section_label} &nbsp;|&nbsp; {termLabel} {r.academic_year}</p>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4">

          {/* School + philosophy */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-4">
            <p className="text-xs font-semibold text-neutral-500">{r.school_name}</p>
            <p className="text-xs text-neutral-400 mt-1 italic leading-relaxed">
              "There is no race in childhood. Every child has their own rhythm of growth."
            </p>
          </div>

          {/* Scale key — horizontal chips */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex flex-wrap gap-x-3 gap-y-1.5 items-center">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide mr-1">Scale:</span>
            {Object.entries(scaleKey).filter(([code]) => !['V','S'].includes(code)).map(([code, info]) => (
              <div key={code} className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: info.color }}>{code}</span>
                <span className="text-xs text-neutral-600">{info.label}</span>
              </div>
            ))}
          </div>

          {/* Developmental domains */}
          {(r.domains || []).filter(d => d.sub_items?.length > 0).map(domain => {
            const dr = r.developmental_ratings?.[domain.id] || {};
            if (!domain.sub_items.some(i => dr[i.id])) return null;
            return (
              <div key={domain.id} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-2" style={{ background: '#EBF5EE' }}>
                  <p className="text-sm font-semibold" style={{ color: G }}>{domain.label}</p>
                </div>
                <div className="divide-y divide-neutral-100">
                  {domain.sub_items.map((item, idx) => {
                    const code = (dr[item.id] || '').toUpperCase();
                    const info = getRatingInfo(code, isPN);
                    if (!info) return null; // skip unrated items
                    const label = item.label.replace(/^\[(Gross|Fine) Motor\] /, '');
                    return (
                      <div key={item.id} className={`flex items-center justify-between px-4 py-2 ${idx % 2 === 1 ? 'bg-neutral-50/50' : ''}`}>
                        <p className="text-sm text-neutral-700 flex-1 pr-3 leading-snug">{label}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                            style={{ backgroundColor: info.color }}>{code}</span>
                          <span className="text-xs text-neutral-500 w-20 text-right">{info.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Subject grades */}
          {Object.keys(r.subject_grades || {}).length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-2" style={{ background: '#EBF5EE' }}>
                <p className="text-sm font-semibold" style={{ color: G }}>Academic Assessment</p>
              </div>
              <div className="divide-y divide-neutral-100">
                {Object.entries(r.subject_grades).filter(([, v]) => v).map(([subject, grade], idx) => {
                  const info = getRatingInfo(grade, isPN);
                  return (
                    <div key={subject} className={`flex items-center justify-between px-4 py-2 ${idx % 2 === 1 ? 'bg-neutral-50/50' : ''}`}>
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <p className="text-sm text-neutral-700">{subject}</p>
                      </div>
                      {info ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                            style={{ backgroundColor: info.color }}>{grade}</span>
                          <span className="text-xs text-neutral-500 w-20 text-right">{info.label}</span>
                        </div>
                      ) : <span className="text-xs text-neutral-300">—</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Teacher observation */}
          {comment && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-4">
              <p className="text-xs font-semibold mb-2" style={{ color: G }}>
                {isPN ? "Teacher's Observation" : "Teacher's Comment"}
              </p>
              <p className="text-sm text-neutral-700 leading-relaxed">{comment}</p>
            </div>
          )}

          {/* PG/Nursery narrative sections */}
          {isPN && [
            ['My Strengths', r.strengths],
            ['Developing Skills', r.developing_skills],
            ['Support at School', r.at_school_support],
            ['Support at Home', r.at_home_support],
            ['My Silver Oak Moment', r.silver_oak_moment],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label as string} className="bg-white border border-neutral-200 rounded-2xl p-4">
              <p className="text-xs font-semibold mb-1.5" style={{ color: G }}>{label as string}</p>
              <p className="text-sm text-neutral-700 leading-relaxed">{value as string}</p>
            </div>
          ))}

          {/* Footer */}
          <div className="rounded-2xl px-4 py-4 flex justify-between items-center" style={{ background: G }}>
            <div>
              <p className="text-[10px] text-white/60">School</p>
              <p className="text-xs font-semibold text-white">{r.school_name}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/60">Term</p>
              <p className="text-xs font-semibold text-white">{termLabel} {r.academic_year}</p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3" style={{ background: G }}>
        <button onClick={() => router.back()} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h1 className="text-base font-bold text-white">Progress Reports</h1>
          <p className="text-xs text-white/70">Holistic Assessment Reports</p>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: G }} />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <FileText className="w-12 h-12 text-neutral-200 mb-3" />
            <p className="text-sm font-medium text-neutral-500">No reports shared yet</p>
            <p className="text-xs text-neutral-400 mt-1">Reports will appear here once your child's teacher shares them</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-2">
            {reports.map(r => (
              <button key={r.id} onClick={() => openReport(r.id)}
                className="bg-white border border-neutral-200 rounded-2xl p-4 flex items-center gap-3 text-left hover:border-primary/30 transition-colors w-full">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                  style={{ background: G }}>
                  {r.student_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-neutral-800">{r.student_name}</p>
                  <p className="text-xs text-neutral-500">{r.class_name} — {r.section_label}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-lg text-white"
                      style={{ background: G }}>
                      {TERM_LABELS[r.term] || r.term}
                    </span>
                    <span className="text-xs text-neutral-400">{r.academic_year}</span>
                  </div>
                </div>
                <div className="shrink-0">
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-xl text-white" style={{ background: A }}>
                    View
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ParentHolisticReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <ParentHolisticReportInner />
    </Suspense>
  );
}

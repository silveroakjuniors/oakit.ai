'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, apiDelete, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  ChevronLeft, ChevronDown, ChevronUp, BookOpen,
  Wand2, Loader2, Send, CheckCircle2, FileDown, Search,
  FileText, Pencil, Trash2, Eye, Plus,
} from 'lucide-react';
import { Button } from '@/UIComponents';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Student {
  id: string; name: string; photo_url?: string;
  class_id: string; class_name: string;
  section_id: string; section_label: string;
}
interface SubItem { id: string; label: string; sort_order: number; }
interface Domain  { id: string; label: string; sort_order: number; sub_items: SubItem[]; }
interface ReportData {
  id: string | null; student_id: string; student_name: string;
  class_name: string; section_label: string; academic_year: string; term: string;
  status: 'draft' | 'shared'; report_format?: 'pg_nursery' | 'standard';
  developmental_ratings: Record<string, Record<string, string>>;
  subject_grades: Record<string, string>;
  teacher_comment_raw: string; teacher_comment: string;
  strengths?: string; developing_skills?: string;
  at_school_support?: string; at_home_support?: string;
  silver_oak_moment?: string; attendance?: string;
}

interface StudentStats {
  from: string;
  to: string;
  attendance: { present: number; absent: number; total: number; pct: number | null; label: string };
  homework:   { completed: number; partial: number; not_submitted: number; total: number; pct: number | null };
}
interface SavedItem {
  id: string; student_id: string; student_name: string;
  class_name: string; section_label: string;
  term: string; status: 'draft' | 'shared';
  academic_year: string; updated_at: string;
}

type Term   = 'mid_term' | 'final_term';
type Rating = 'E' | 'V' | 'G' | 'S' | 'P' | 'B' | 'I' | '';
type View   = 'list' | 'pick' | 'form' | 'detail';

// ── Scale definitions ─────────────────────────────────────────────────────────

// PG/Nursery: Growth Statements — codes E, G, B, I (first letter of each label)
const GROWTH_STATEMENTS: { value: Rating; label: string; statement: string; color: string }[] = [
  { value: 'E', label: 'Exploring',          statement: 'I am beginning to discover this.',             color: '#6B9E7A' },
  { value: 'G', label: 'Growing',            statement: 'I am developing this with encouragement.',     color: '#4A8C6A' },
  { value: 'B', label: 'Becoming Confident', statement: 'I am using this skill more consistently.',     color: '#2D7A5A' },
  { value: 'I', label: 'Independent',        statement: 'I can use this skill confidently on my own.', color: '#1B4332' },
];

// Jr.KG / Sr.KG / All other classes: E/V/G/S/P (unchanged)
const STANDARD_RATINGS: { value: Rating; label: string; color: string }[] = [
  { value: 'E', label: 'Excellent',    color: '#1B4332' },
  { value: 'V', label: 'Very Good',    color: '#2D6A4F' },
  { value: 'G', label: 'Good',         color: '#40916C' },
  { value: 'S', label: 'Satisfactory', color: '#E8960C' },
  { value: 'P', label: 'Progressive',  color: '#888888' },
];

// Alias so existing code still works
const JRKG_RATINGS = STANDARD_RATINGS;

const TERM_LABELS: Record<Term, string> = { mid_term: 'Mid-Term', final_term: 'Final Term' };
const PG_NURSERY_NAMES  = new Set(['playgroup', 'play group', 'nursery', 'pg']);
const JRKG_NAMES        = new Set(['jr. kg', 'jr.kg', 'jrkg', 'junior kg', 'lkg']);
const SRKG_NAMES        = new Set(['sr. kg', 'sr.kg', 'srkg', 'senior kg', 'ukg']);

function isPgNursery(className: string) {
  return PG_NURSERY_NAMES.has((className || '').toLowerCase().trim());
}
function isJrOrSrKg(className: string) {
  const n = (className || '').toLowerCase().trim();
  return JRKG_NAMES.has(n) || SRKG_NAMES.has(n);
}
// Returns the right rating scale for the class
function getScale(className: string) {
  if (isPgNursery(className)) return GROWTH_STATEMENTS;
  return STANDARD_RATINGS; // Jr.KG, Sr.KG and all others use E/V/G/S/P
}
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

// ── Rating row used in the form ───────────────────────────────────────────────
function RatingRow({ label, value, className, onChange, idx }: {
  label: string; value: Rating; className: string;
  onChange: (v: Rating) => void; idx: number;
}) {
  const ratings = getScale(className);
  const isPN = isPgNursery(className);
  const cleanLabel = label.replace(/^\[(Gross|Fine) Motor\] /, '');

  if (isPN) {
    // PG/Nursery: full-width pill buttons showing label text — no single-letter codes
    return (
      <div className={`px-4 py-3 ${idx % 2 === 1 ? 'bg-neutral-50/40' : ''}`}>
        <p className="text-xs text-neutral-700 mb-2 font-medium">{cleanLabel}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(ratings as typeof GROWTH_STATEMENTS).map(r => {
            const selected = value === r.value;
            return (
              <button key={r.value}
                onClick={() => onChange(value === r.value ? '' : r.value)}
                title={r.statement}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all border ${
                  selected
                    ? 'border-transparent text-white shadow-sm'
                    : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300'
                }`}
                style={selected ? { backgroundColor: r.color, borderColor: r.color } : {}}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${selected ? 'bg-white/25 text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                  {r.value}
                </span>
                <span className="text-xs font-semibold leading-tight">{r.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Standard (Jr.KG / Sr.KG / others): letter-square buttons in a row
  return (
    <div className={`flex items-center px-4 py-2.5 ${idx % 2 === 1 ? 'bg-neutral-50/40' : ''}`}>
      <p className="flex-1 text-xs text-neutral-700 pr-2">{cleanLabel}</p>
      {(ratings as typeof STANDARD_RATINGS).map(r => (
        <button key={r.value}
          onClick={() => onChange(value === r.value ? '' : r.value)}
          title={r.label}
          className={`w-10 h-7 flex items-center justify-center rounded-lg mx-0.5 text-xs font-bold transition-all ${
            value === r.value ? 'text-white shadow-sm scale-105' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
          }`}
          style={value === r.value ? { backgroundColor: r.color } : {}}>
          {r.value}
        </button>
      ))}
    </div>
  );
}

// ── Printable holistic report card — matches ReportCardV2 visual style ────────
function HolisticReportPrint({ report, domains, stats, id }: {
  report: ReportData; domains: Domain[]; stats: StudentStats | null; id: string;
}) {
  const G = '#1B4332';
  const A = '#E8960C';
  const termLabel = TERM_LABELS[report.term as Term] || report.term;
  const isPN = isPgNursery(report.class_name);
  const scaleItems = getScale(report.class_name);

  return (
    <div id={`holistic-report-print-${id}`} style={{ fontFamily: "'Inter', system-ui, sans-serif", maxWidth: 760, margin: '0 auto' }}>

      {/* Header — matches ReportCardV2 */}
      <div style={{ background: `linear-gradient(135deg, ${G} 0%, #2d6a4f 100%)`, borderRadius: 20, padding: '24px 20px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0, border: '2px solid rgba(255,255,255,0.4)', color: '#fff', fontWeight: 800 }}>
          {report.student_name?.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, margin: '0 0 2px', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Holistic Progress Report</p>
          <p style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: '0 0 4px' }}>{report.student_name}</p>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, margin: 0 }}>{report.class_name} — Sec {report.section_label}</p>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, margin: '4px 0 0' }}>{termLabel} | {report.academic_year}</p>
        </div>
      </div>

      {/* Stat cards — Attendance % | Days Present | Homework % */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Attendance', value: stats.attendance.pct !== null ? `${stats.attendance.pct}%` : '-', color: '#16a34a', sub: `${stats.attendance.present}/${stats.attendance.total} days present` },
            { label: 'Days Present', value: `${stats.attendance.present}/${stats.attendance.total}`, color: G, sub: `${stats.attendance.absent} absent` },
            { label: 'Homework', value: stats.homework.pct !== null ? `${stats.homework.pct}%` : '-', color: '#7c3aed', sub: `${stats.homework.completed}/${stats.homework.total} submitted` },
          ].map((c, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4, fontWeight: 600 }}>{c.label}</div>
              <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Scale key */}
      <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '8px 12px', marginBottom: 16, display: 'flex', flexWrap: 'wrap' as const, gap: '0 16px' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: G, marginRight: 6 }}>Scale:</span>
        {scaleItems.map(s => (
          <span key={s.value} style={{ fontSize: 10, color: '#374151' }}>
            <strong style={{ color: s.color }}>{s.value}</strong> = {s.label}
            {isPN && <span style={{ color: '#9ca3af' }}> — {(s as any).statement}</span>}
          </span>
        ))}
      </div>

      {/* Developmental domains */}
      {domains.filter(d => d.sub_items?.length > 0).map(domain => {
        const dr = (report.developmental_ratings as any)?.[domain.id] || {};
        const hasAny = domain.sub_items.some(i => dr[i.id]);
        if (!hasAny) return null;
        return (
          <div key={domain.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', padding: '8px 14px' }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: G, textTransform: 'uppercase' as const, margin: 0, letterSpacing: 0.6 }}>{domain.label}</p>
            </div>
            <div style={{ padding: 0 }}>
              {domain.sub_items.map((item, idx) => {
                const rating = dr[item.id] || '';
                const sc = scaleItems.find(x => x.value === rating);
                const label = item.label.replace(/^\[(Gross|Fine) Motor\] /, '');
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', background: idx % 2 === 1 ? '#fafafa' : '#fff', borderBottom: idx < domain.sub_items.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <span style={{ fontSize: 11, color: '#374151', flex: 1 }}>{label}</span>
                    {sc ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: sc.color, color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{rating}</span>
                        <span style={{ fontSize: 10, color: '#6b7280' }}>{sc.label}</span>
                      </div>
                    ) : <span style={{ fontSize: 10, color: '#d1d5db' }}>—</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Subject grades (standard only) */}
      {!isPN && Object.keys(report.subject_grades || {}).length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', padding: '8px 14px' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: G, textTransform: 'uppercase' as const, margin: 0, letterSpacing: 0.6 }}>Result of Assessment Activities</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: 12 }}>
            {Object.entries(report.subject_grades).filter(([, v]) => v).map(([subject, grade]) => {
              const sc = scaleItems.find(x => x.value === grade);
              return (
                <div key={subject} style={{ background: '#f8fbf9', border: '1px solid #e2e8e5', borderRadius: 10, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#374151' }}>{subject}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: sc?.color || '#888' }}>{grade}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comment / Observation */}
      {(report.teacher_comment || report.teacher_comment_raw) && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', padding: '8px 14px' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: G, textTransform: 'uppercase' as const, margin: 0, letterSpacing: 0.6 }}>{isPN ? "Teacher's Observation" : "Teacher's Comment"}</p>
          </div>
          <p style={{ fontSize: 13, color: '#1f2937', lineHeight: 1.7, margin: 0, padding: '12px 14px', fontStyle: 'italic' }}>{report.teacher_comment || report.teacher_comment_raw}</p>
        </div>
      )}

      {/* PG/Nursery narrative sections */}
      {isPN && [
        ['My Strengths', report.strengths],
        ['Developing Skills', report.developing_skills],
        ['Support at School', report.at_school_support],
        ['Support at Home', report.at_home_support],
        ['My Silver Oak Moment', report.silver_oak_moment],
      ].filter(([, v]) => v).map(([label, value]) => (
        <div key={label as string} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', padding: '8px 14px' }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: G, textTransform: 'uppercase' as const, margin: 0, letterSpacing: 0.6 }}>{label as string}</p>
          </div>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.65, margin: 0, padding: '12px 14px' }}>{value as string}</p>
        </div>
      ))}

      {/* Footer — matches ReportCardV2 exactly */}
      <div style={{ background: G, borderRadius: 16, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 12, marginTop: 8 }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, margin: 0 }}>Class Teacher</p>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 12, margin: '2px 0 0' }}>{'—'}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, margin: 0 }}>Silver Oak Juniors</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, margin: '2px 0 0' }}>Generated {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, margin: 0 }}>Principal</p>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 12, margin: '2px 0 0' }}>_____________</p>
        </div>
      </div>

    </div>
  );
}

export default function HolisticReportPage() {
  const router = useRouter();
  const token  = getToken() || '';

  const [view,         setView]         = useState<View>('list');
  const [academicYear, setAcademicYear] = useState('');
  const academicYearRef = useRef('');

  // list
  const [saved,        setSaved]        = useState<SavedItem[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false); // starts false — set true only when we actually fetch
  const [filterTerm,   setFilterTerm]   = useState<Term | ''>('');

  // pick
  const [students, setStudents] = useState<Student[]>([]);
  const [search,   setSearch]   = useState('');
  const [pickTerm, setPickTerm] = useState<Term>('mid_term');

  // form
  const [selStudent,   setSelStudent]   = useState<Student | null>(null);
  const [selTerm,      setSelTerm]      = useState<Term>('mid_term');
  const [domains,      setDomains]      = useState<Domain[]>([]);
  const [subjects,     setSubjects]     = useState<string[]>([]);
  const [report,       setReport]       = useState<ReportData | null>(null);
  const [pgMode,       setPgMode]       = useState(false);
  const [studentStats, setStudentStats] = useState<StudentStats | null>(null);
  const [devRatings,   setDevRatings]   = useState<Record<string, Record<string, Rating>>>({});
  const [subGrades,    setSubGrades]    = useState<Record<string, Rating>>({});
  const [commentRaw,   setCommentRaw]   = useState('');
  const [commentFmt,   setCommentFmt]   = useState('');
  const [useFmt,       setUseFmt]       = useState(false);
  const [strengths,    setStrengths]    = useState('');
  const [devSkills,    setDevSkills]    = useState('');
  const [atSchool,     setAtSchool]     = useState('');
  const [atHome,       setAtHome]       = useState('');
  const [silverMoment, setSilverMoment] = useState('');
  const [attendance,   setAttendance]   = useState('');
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set());
  const [loadingForm,  setLoadingForm]  = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [sharing,      setSharing]      = useState(false);
  const [reformatting, setReformatting] = useState(false);
  const [reformattingField, setReformattingField] = useState<string | null>(null);
  const [exporting,    setExporting]    = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [msg,          setMsg]          = useState('');

  // detail
  const [viewingId,     setViewingId]     = useState<string | null>(null);
  const [detailReport,  setDetailReport]  = useState<ReportData | null>(null);
  const [detailDomains, setDetailDomains] = useState<Domain[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    (async () => {
      try {
        const [ctx, studs] = await Promise.all([
          apiGet<any>('/api/v1/teacher/context', token),
          apiGet<Student[]>('/api/v1/teacher/holistic-report/students', token),
        ]);
        const year = ctx.academic_year || '';
        setAcademicYear(year);
        academicYearRef.current = year;
        setStudents(studs || []);
        // Load saved list immediately once year is known
        if (year) loadSaved(year);
      } catch {
        setLoadingSaved(false);
      }
    })();
  }, []);

  // ── load saved ─────────────────────────────────────────────────────────────
  const loadSaved = useCallback(async (year: string) => {
    const activeYear = year || academicYearRef.current;
    setLoadingSaved(true);
    try {
      // Backend auto-detects year if not provided — always call even if year is empty
      const yearParam = activeYear ? `?year=${activeYear}` : '';
      const termParam = filterTerm ? `${yearParam ? '&' : '?'}term=${filterTerm}` : '';
      const url = `/api/v1/teacher/holistic-report/list${yearParam}${termParam}`;
      setSaved(await apiGet<SavedItem[]>(url, token) || []);
    } catch { setSaved([]); }
    finally { setLoadingSaved(false); }
  }, [filterTerm, token]);

  useEffect(() => {
    if (view === 'list') loadSaved(academicYear || academicYearRef.current || '');
  }, [academicYear, view, filterTerm]);

  // ── open detail ────────────────────────────────────────────────────────────
  async function openDetail(item: SavedItem) {
    setViewingId(item.id);
    setView('detail');
    setLoadingDetail(true);
    // Use the year from the saved item — this is the authoritative source
    const year = (item as any).academic_year || academicYearRef.current || academicYear;
    try {
      const student = students.find(s => s.id === item.student_id);
      const classId = student?.class_id || '';
      const yearParam = year ? `?year=${year}` : '';
      const [rd, td, statsData] = await Promise.all([
        apiGet<ReportData>(`/api/v1/teacher/holistic-report/${item.student_id}/${item.term}${yearParam}`, token)
          .catch(() => null),
        classId
          ? apiGet<{ domains: Domain[] }>(`/api/v1/teacher/holistic-report/template/${classId}${yearParam}`, token).catch(() => ({ domains: [] as Domain[] }))
          : Promise.resolve({ domains: [] as Domain[] }),
        apiGet<StudentStats>(`/api/v1/teacher/holistic-report/stats/${item.student_id}?to=${new Date().toISOString().split('T')[0]}`, token).catch(() => null),
      ]);
      setDetailReport(rd);
      setDetailDomains(td.domains || []);
      setStudentStats(statsData);
    } catch (e) {
      console.error('[openDetail]', e);
      setDetailReport(null);
    }
    finally { setLoadingDetail(false); }
  }

  // ── open edit ──────────────────────────────────────────────────────────────
  async function openEdit(item: SavedItem) {
    const student = students.find(s => s.id === item.student_id);
    if (!student) return;
    // Use class_name from the saved item (always available) to set pgMode immediately
    setPgMode(isPgNursery(item.class_name));
    setSelStudent(student);
    setSelTerm(item.term as Term);
    setView('form');
    // Always use the report's own academic_year — not the calendar year — to avoid mismatch
    const reportYear = item.academic_year || academicYearRef.current || academicYear;
    await loadForm(student, item.term as Term, reportYear);
  }

  // ── load form ──────────────────────────────────────────────────────────────
  const loadForm = useCallback(async (student: Student, term: Term, year?: string) => {
    const activeYear = year || academicYearRef.current || academicYear;
    setLoadingForm(true); setMsg('');
    // pgMode is based solely on class name — PG/Nursery get narrative fields, all others don't
    const isPN = isPgNursery(student.class_name);
    setPgMode(isPN);
    try {
      const yearParam = activeYear ? `?year=${activeYear}` : '';
      const [td, sd, rd, stats] = await Promise.all([
        apiGet<{ domains: Domain[] }>(`/api/v1/teacher/holistic-report/template/${student.class_id}${yearParam}`, token)
          .catch(() => ({ domains: [] as Domain[] })),
        apiGet<{ subjects: string[] }>(`/api/v1/teacher/holistic-report/subjects/${student.class_id}`, token)
          .catch(() => ({ subjects: [] as string[] })),
        activeYear
          ? apiGet<ReportData>(`/api/v1/teacher/holistic-report/${student.id}/${term}${yearParam}`, token).catch(() => null)
          : Promise.resolve(null),
        apiGet<StudentStats>(`/api/v1/teacher/holistic-report/stats/${student.id}?to=${new Date().toISOString().split('T')[0]}`, token).catch(() => ({
          from: '', to: '',
          attendance: { present: 0, absent: 0, total: 0, pct: null, label: 'No records' },
          homework: { completed: 0, partial: 0, not_submitted: 0, total: 0, pct: null },
        } as StudentStats)),
      ]);
      setDomains(td.domains || []);
      // For Jr.KG / Sr.KG: always use standard subject list, rename Regional Language → Kannada
      let fetchedSubjects = sd.subjects || [];
      if (isJrOrSrKg(student.class_name)) {
        // Hard-coded standard subjects for KG classes — ensures all subjects always show
        const KG_SUBJECTS = ['English Speaking', 'English', 'Math', 'GK', 'Writing', 'Kannada'];
        // If DB returned subjects, use them but rename Regional Language → Kannada
        const dbSubjects = fetchedSubjects
          .map(s => s.toLowerCase().includes('regional') ? 'Kannada' : s)
          .filter((s, i, arr) => arr.indexOf(s) === i);
        // Merge: use DB subjects if they have more than just Kannada, otherwise use hardcoded list
        fetchedSubjects = dbSubjects.length > 1 ? dbSubjects : KG_SUBJECTS;
        // Ensure Kannada is always present
        if (!fetchedSubjects.includes('Kannada')) fetchedSubjects = [...fetchedSubjects, 'Kannada'];
      }
      setSubjects(fetchedSubjects);
      setReport(rd);
      setDevRatings((rd?.developmental_ratings as any) || {});
      setSubGrades((rd?.subject_grades as any) || {});
      setCommentRaw(rd?.teacher_comment_raw || '');
      setCommentFmt(rd?.teacher_comment || '');
      setUseFmt(!!(rd?.teacher_comment));
      setStrengths(rd?.strengths || '');
      setDevSkills(rd?.developing_skills || '');
      setAtSchool(rd?.at_school_support || '');
      setAtHome(rd?.at_home_support || '');
      setSilverMoment(rd?.silver_oak_moment || '');
      // Pre-fill attendance from stats if not already set
      if (stats) {
        setStudentStats(stats);
        if (!rd?.attendance && stats.attendance.total > 0) {
          setAttendance(stats.attendance.label);
        } else {
          setAttendance(rd?.attendance || '');
        }
      } else {
        setAttendance(rd?.attendance || '');
      }
      setExpanded(new Set((td.domains || []).map((d: Domain) => d.id)));
    } catch { setMsg('Failed to load report'); }
    finally { setLoadingForm(false); }
  }, [academicYear, token]);

  useEffect(() => {
    if (view === 'form' && selStudent) {
      loadForm(selStudent, selTerm, academicYearRef.current || academicYear);
    }
  }, [selTerm]); // eslint-disable-line

  // ── actions ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selStudent) return;
    const yearToUse = academicYearRef.current || academicYear;
    setSaving(true); setMsg('');
    try {
      const res = await apiPost<any>('/api/v1/teacher/holistic-report/save', {
        student_id: selStudent.id,
        academic_year: yearToUse || undefined, // send undefined if empty — backend auto-detects
        term: selTerm,
        developmental_ratings: devRatings, subject_grades: subGrades,
        teacher_comment_raw: commentRaw,
        teacher_comment: useFmt ? commentFmt : commentRaw,
        strengths:         pgMode ? strengths    : null,
        developing_skills: pgMode ? devSkills    : null,
        at_school_support: pgMode ? atSchool     : null,
        at_home_support:   pgMode ? atHome       : null,
        silver_oak_moment: pgMode ? silverMoment : null,
        attendance:        pgMode ? attendance   : null,
      }, token);
      // Update academic year from response if it was auto-detected
      if (res.academic_year && !academicYearRef.current) {
        academicYearRef.current = res.academic_year;
        setAcademicYear(res.academic_year);
      }
      setReport(p => p ? { ...p, id: res.id, status: 'draft' } : { ...({} as ReportData), id: res.id, status: 'draft' } as any);
      setMsg('Draft saved');
      loadSaved(academicYearRef.current || academicYear);
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  async function handleReformat() {
    if (!commentRaw.trim()) return;
    setReformatting(true); setReformattingField('comment'); setMsg('');
    try {
      const res = await apiPost<{ comment: string }>('/api/v1/teacher/holistic-report/reformat-comment', {
        student_name: selStudent?.name, class_name: selStudent?.class_name,
        term: selTerm, raw_comment: commentRaw,
      }, token);
      setCommentFmt(res.comment); setUseFmt(true);
    } catch { setMsg('Failed to reformat comment'); }
    finally { setReformatting(false); setReformattingField(null); }
  }

  async function reformatField(fieldId: string, rawText: string, onDone: (result: string) => void) {
    if (!rawText.trim()) return;
    setReformattingField(fieldId);
    try {
      const res = await apiPost<{ comment: string }>('/api/v1/teacher/holistic-report/reformat-comment', {
        student_name: selStudent?.name,
        raw_comment: rawText,
        field_type: fieldId,  // sends 'strengths', 'at_school', 'at_home', 'silver_moment', etc.
      }, token);
      if (res.comment) onDone(res.comment);
    } catch { setMsg('Failed to reformat'); }
    finally { setReformattingField(null); }
  }

  async function handleShare(reportId: string) {
    if (!confirm('Send this report to the parent? They will receive a notification.')) return;
    setSharing(true); setMsg('');
    try {
      const res = await apiPost<any>(`/api/v1/teacher/holistic-report/${reportId}/share`, {}, token);
      setReport(p => p ? { ...p, status: 'shared' } : p);
      setSaved(p => p.map(r => r.id === reportId ? { ...r, status: 'shared' as const } : r));
      const n = res.parents_notified ?? 0;
      setMsg(n > 0 ? `Sent - ${n} parent(s) notified` : 'Report sent (no linked parents found — check parent accounts)');
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : 'Failed to share'); }
    finally { setSharing(false); }
  }

  async function handleRecall(reportId: string) {
    if (!confirm('Recall this report? The parent will no longer be able to see it. You can resend it after making changes.')) return;
    setSharing(true); setMsg('');
    try {
      await apiPost<any>(`/api/v1/teacher/holistic-report/${reportId}/recall`, {}, token);
      setReport(p => p ? { ...p, status: 'draft' } : p);
      setSaved(p => p.map(r => r.id === reportId ? { ...r, status: 'draft' as const } : r));
      setMsg('Recalled - parent can no longer see this report');
    } catch (e: unknown) { setMsg(e instanceof Error ? e.message : 'Failed to recall'); }
    finally { setSharing(false); }
  }

  async function handleDelete(reportId: string, name: string) {
    if (!confirm(`Delete report for ${name}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/v1/teacher/holistic-report/${reportId}`, token);
      setSaved(p => p.filter(r => r.id !== reportId));
      if (view === 'detail') setView('list');
    } catch { setMsg('Failed to delete'); }
    finally { setDeleting(false); }
  }

  function handlePdf(reportId: string, name: string, term: Term) {
    // Give React a tick to ensure the hidden print div is in the DOM
    setTimeout(() => {
      const printContent = document.getElementById(`holistic-report-print-${reportId}`);
      if (!printContent) {
        setMsg('Open the report first, then export PDF');
        return;
      }
      const w = window.open('', '_blank');
      if (!w) { setMsg('PDF blocked — allow popups and try again'); return; }
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>Holistic Report — ${name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { margin: 0; padding: 20px; background: #f8f7f4; font-family: 'Inter', system-ui, sans-serif; }
          @media print { body { padding: 8px; } }
        </style></head><body>${printContent.innerHTML}</body></html>`);
      w.document.close();
      setTimeout(() => w.print(), 800);
    }, 100);
  }

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.class_name.toLowerCase().includes(search.toLowerCase()),
  );

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  if (view === 'detail') {
    const r       = detailReport;
    const item    = saved.find(s => s.id === viewingId);
    const isPN    = isPgNursery(r?.class_name || '');
    const comment = r?.teacher_comment || r?.teacher_comment_raw;
    const scaleForDetail = getScale(r?.class_name || '');

    return (
      <div className="min-h-screen bg-neutral-50 pb-24">
        <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setView('list')} className="p-1 rounded-lg hover:bg-neutral-100">
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-neutral-900">{r?.student_name || 'Report'}</h1>
            <p className="text-xs text-neutral-400">{r ? TERM_LABELS[r.term as Term] : ''} - {r?.academic_year}</p>
          </div>
          {r?.status === 'shared' && (
            <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Shared
            </span>
          )}
        </header>
        <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : !r ? (
            <p className="text-sm text-neutral-400 text-center py-8">Could not load report</p>
          ) : (
            <>
              {/* Hidden printable version — used by browser print */}
              {r.id && (
                <div style={{ display: 'none' }}>
                  <HolisticReportPrint
                    report={r}
                    domains={detailDomains}
                    stats={studentStats}
                    id={r.id}
                  />
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {item && <Button size="sm" variant="secondary" onClick={() => openEdit(item)}><Pencil className="w-3.5 h-3.5 mr-1" />Edit</Button>}
                <Button size="sm" variant="secondary" onClick={() => r.id && handlePdf(r.id, r.student_name, r.term as Term)} loading={exporting} disabled={!r.id}>
                  <FileDown className="w-3.5 h-3.5 mr-1" />PDF
                </Button>
                {r.status !== 'shared' && r.id && (
                  <Button size="sm" variant="secondary" onClick={() => r.id && handleShare(r.id)} loading={sharing}>
                    <Send className="w-3.5 h-3.5 mr-1" />Share to Parent
                  </Button>
                )}
                {r.status === 'shared' && r.id && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => r.id && handleShare(r.id)} loading={sharing}>
                      <Send className="w-3.5 h-3.5 mr-1" />Resend
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => r.id && handleRecall(r.id)} loading={sharing}>
                      <span className="text-amber-600">Recall</span>
                    </Button>
                  </>
                )}
                {r.id && (
                  <Button size="sm" variant="secondary" onClick={() => r.id && handleDelete(r.id, r.student_name)} loading={deleting}>
                    <Trash2 className="w-3.5 h-3.5 mr-1 text-red-400" /><span className="text-red-500">Delete</span>
                  </Button>
                )}
              </div>
              {msg && <p className={`text-sm font-medium ${msg.includes('shared') || msg.includes('notified') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</p>}

              {/* Attendance display on detail view */}
              {r.attendance && (
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 flex items-center gap-3">
                  <p className="text-xs font-semibold text-neutral-500">Attendance</p>
                  <p className="text-sm font-medium text-neutral-800">{r.attendance}</p>
                </div>
              )}

              {/* Scale key */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 flex flex-wrap gap-x-3 gap-y-1">
                {scaleForDetail.map(rt => (
                  <span key={rt.value} className="text-xs">
                    <span className="font-bold" style={{ color: rt.color }}>{rt.value}</span> {rt.label}
                    {isPN && <span className="text-neutral-400 ml-1">— {(rt as any).statement}</span>}
                  </span>
                ))}
              </div>

              {/* Domains */}
              {detailDomains.filter(d => d.sub_items?.length > 0).map(domain => {
                const dr = r.developmental_ratings?.[domain.id] || {};
                if (!domain.sub_items.some(i => dr[i.id])) return null;
                return (
                  <div key={domain.id} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-primary/5"><p className="text-sm font-semibold text-primary">{domain.label}</p></div>
                    <div className="divide-y divide-neutral-50">
                      {domain.sub_items.map((item, idx) => {
                        const rating = dr[item.id] || '';
                        const rInfo  = scaleForDetail.find(x => x.value === rating);
                        const label  = item.label.replace(/^\[(Gross|Fine) Motor\] /, '');
                        return (
                          <div key={item.id} className={`flex items-center justify-between px-4 py-2.5 ${idx % 2 === 1 ? 'bg-neutral-50/40' : ''}`}>
                            <p className="text-sm text-neutral-700 flex-1 pr-3">{label}</p>
                            {rating && rInfo ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: rInfo.color }}>{rating}</span>
                                <span className="text-xs text-neutral-400 hidden sm:block">{rInfo.label}</span>
                              </div>
                            ) : <span className="text-xs text-neutral-300">-</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Subject grades — standard only */}
              {!isPN && Object.keys(r.subject_grades || {}).length > 0 && (
                <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-primary/5"><p className="text-sm font-semibold text-primary">Result of Assessment Activities</p></div>
                  <div className="divide-y divide-neutral-50">
                    {Object.entries(r.subject_grades).filter(([, v]) => v).map(([subject, grade], idx) => (
                      <div key={subject} className={`flex items-center justify-between px-4 py-2.5 ${idx % 2 === 1 ? 'bg-neutral-50/40' : ''}`}>
                        <div className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-neutral-400" /><p className="text-sm text-neutral-700">{subject}</p></div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: STANDARD_RATINGS.find(x => x.value === grade)?.color || '#888' }}>{grade}</span>
                          <span className="text-xs text-neutral-400 hidden sm:block">{STANDARD_RATINGS.find(x => x.value === grade)?.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {comment && (
                <div className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-neutral-500 mb-2">Teacher's {isPN ? 'Observation' : 'Comment'}</p>
                  <p className="text-sm text-neutral-700 leading-relaxed">{comment}</p>
                </div>
              )}

              {/* PG/Nursery narrative fields */}
              {isPN && [
                ['My Strengths', r.strengths],
                ['Developing Skills', r.developing_skills],
                ['Support at School', r.at_school_support],
                ['Support at Home', r.at_home_support],
                ['My Silver Oak Moment', r.silver_oak_moment],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-primary mb-1">{label as string}</p>
                  <p className="text-sm text-neutral-700 leading-relaxed">{value as string}</p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  // ── PICK VIEW ──────────────────────────────────────────────────────────────
  if (view === 'pick') {
    return (
      <div className="min-h-screen bg-neutral-50 pb-24">
        <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setView('list')} className="p-1 rounded-lg hover:bg-neutral-100">
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-neutral-900">New Report</h1>
            <p className="text-xs text-neutral-400">Select student and term</p>
          </div>
        </header>
        <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4">
          <div className="flex gap-2">
            {(['mid_term', 'final_term'] as Term[]).map(t => (
              <button key={t} onClick={() => setPickTerm(t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border ${pickTerm === t ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary/40'}`}>
                {TERM_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
            <input type="text" placeholder="Search by name or class..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
          </div>
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            {filtered.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-8">No students found</p>
            ) : (
              <div className="divide-y divide-neutral-50">
                {filtered.map(s => (
                  <button key={s.id}
                    onClick={async () => { setSelStudent(s); setSelTerm(pickTerm); setView('form'); await loadForm(s, pickTerm, academicYearRef.current || academicYear); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors text-left">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">{s.name.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800">{s.name}</p>
                      <p className="text-xs text-neutral-400">{s.class_name} - {s.section_label}</p>
                      {isPgNursery(s.class_name) && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Growth Statements format</span>
                      )}
                    </div>
                    <ChevronLeft className="w-4 h-4 text-neutral-300 rotate-180" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── FORM VIEW ──────────────────────────────────────────────────────────────
  if (view === 'form') {
    const scaleForForm = getScale(selStudent?.class_name || '');

    return (
      <div className="min-h-screen bg-neutral-50 pb-24">
        <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => { setView('list'); setSelStudent(null); setMsg(''); }} className="p-1 rounded-lg hover:bg-neutral-100">
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-neutral-900">{report?.id ? 'Edit' : 'New'} Report - {selStudent?.name}</h1>
            <p className="text-xs text-neutral-400">{selStudent?.class_name} - {selStudent?.section_label}
              {pgMode && <span className="ml-2 text-emerald-600 font-medium">Growth Statements</span>}
            </p>
          </div>
          {report?.status === 'shared' && <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Shared</span>}
        </header>

        <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4">
          {/* Term switcher */}
          <div className="flex gap-2">
            {(['mid_term', 'final_term'] as Term[]).map(t => (
              <button key={t} onClick={() => setSelTerm(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${selTerm === t ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary/40'}`}>
                {TERM_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Stats cards — shown for ALL classes */}
          {studentStats ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <p className="text-xs font-semibold text-emerald-700 mb-1">Attendance</p>
                <p className="text-3xl font-bold text-emerald-800">
                  {studentStats.attendance.pct !== null ? `${studentStats.attendance.pct}%` : '-'}
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">{studentStats.attendance.label}</p>
                <div className="flex gap-3 mt-2">
                  <span className="text-[11px] font-medium text-emerald-700">{studentStats.attendance.present} present</span>
                  <span className="text-[11px] font-medium text-red-500">{studentStats.attendance.absent} absent</span>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-xs font-semibold text-amber-700 mb-1">Homework</p>
                <p className="text-3xl font-bold text-amber-800">
                  {studentStats.homework.pct !== null ? `${studentStats.homework.pct}%` : '-'}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">{studentStats.homework.completed}/{studentStats.homework.total} done</p>
                <div className="flex gap-3 mt-2">
                  <span className="text-[11px] font-medium text-amber-700">{studentStats.homework.partial} partial</span>
                  <span className="text-[11px] font-medium text-red-500">{studentStats.homework.not_submitted} missed</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 animate-pulse">
                <p className="text-xs font-semibold text-neutral-400 mb-1">Attendance</p>
                <p className="text-3xl font-bold text-neutral-300">—</p>
                <p className="text-xs text-neutral-300 mt-0.5">Loading from records...</p>
              </div>
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 animate-pulse">
                <p className="text-xs font-semibold text-neutral-400 mb-1">Homework</p>
                <p className="text-3xl font-bold text-neutral-300">—</p>
                <p className="text-xs text-neutral-300 mt-0.5">Loading from records...</p>
              </div>
            </div>
          )}

          {/* Attendance string (PG/Nursery only — stored for PDF, auto-filled from stats) */}

          {loadingForm ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : (
            <>
              {/* Scale key */}
              {pgMode ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-emerald-800 mb-2">Growth Statements Scale</p>
                  <div className="flex flex-col gap-1.5">
                    {GROWTH_STATEMENTS.map(g => (
                      <div key={g.value} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: g.color }}>{g.value}</span>
                        <span className="text-xs font-medium" style={{ color: g.color }}>{g.label}</span>
                        <span className="text-xs text-neutral-500">— {g.statement}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 flex flex-wrap gap-x-4 gap-y-1">
                  {STANDARD_RATINGS.map(r => (
                    <span key={r.value} className="text-xs"><span className="font-bold" style={{ color: r.color }}>{r.value}</span> = {r.label}</span>
                  ))}
                </div>
              )}

              {/* Section A — Developmental */}
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-primary">
                  <p className="text-sm font-semibold text-white">{pgMode ? 'MY GROWTH AT SILVER OAK' : 'Section A - Developmental Assessment'}</p>
                </div>
                {domains.filter(d => d.sub_items?.length > 0).map(domain => {
                  const isPhysical  = domain.id === 'physical_motor';
                  const grossItems  = isPhysical ? domain.sub_items.filter(i => i.label.startsWith('[Gross Motor]')) : [];
                  const fineItems   = isPhysical ? domain.sub_items.filter(i => i.label.startsWith('[Fine Motor]'))  : [];
                  const regItems    = isPhysical ? [] : domain.sub_items;
                  const isExp       = expanded.has(domain.id);

                  return (
                    <div key={domain.id} className="border-b border-neutral-100 last:border-0">
                      <button onClick={() => setExpanded(p => { const n = new Set(p); if (n.has(domain.id)) n.delete(domain.id); else n.add(domain.id); return n; })}
                        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition-colors">
                        <p className="text-sm font-semibold text-primary">{domain.label}</p>
                        {isExp ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                      </button>
                      {isExp && (
                        <div className="divide-y divide-neutral-50">
                          {/* Column headers — only for standard (letter-square) format */}
                          {!pgMode && (
                            <div className="flex items-center px-4 py-1.5 bg-neutral-50/50">
                              <p className="flex-1 text-xs text-neutral-400">Development Area</p>
                              {scaleForForm.map(r => (
                                <div key={r.value} className="w-10 text-center">
                                  <span className="text-[10px] font-bold" style={{ color: r.color }}>{r.value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {isPhysical && grossItems.length > 0 && (
                            <>
                              <div className="px-4 py-1 bg-neutral-100"><p className="text-xs font-semibold text-neutral-500">Gross Motor</p></div>
                              {grossItems.map((item, idx) => (
                                <RatingRow key={item.id} label={item.label} idx={idx} className={selStudent?.class_name || ''}
                                  value={(devRatings[domain.id]?.[item.id] as Rating) || ''}
                                  onChange={v => setDevRatings(p => ({ ...p, [domain.id]: { ...(p[domain.id] || {}), [item.id]: v } }))} />
                              ))}
                              <div className="px-4 py-1 bg-neutral-100"><p className="text-xs font-semibold text-neutral-500">Fine Motor</p></div>
                              {fineItems.map((item, idx) => (
                                <RatingRow key={item.id} label={item.label} idx={idx} className={selStudent?.class_name || ''}
                                  value={(devRatings[domain.id]?.[item.id] as Rating) || ''}
                                  onChange={v => setDevRatings(p => ({ ...p, [domain.id]: { ...(p[domain.id] || {}), [item.id]: v } }))} />
                              ))}
                            </>
                          )}
                          {regItems.map((item, idx) => (
                            <RatingRow key={item.id} label={item.label} idx={idx} className={selStudent?.class_name || ''}
                              value={(devRatings[domain.id]?.[item.id] as Rating) || ''}
                              onChange={v => setDevRatings(p => ({ ...p, [domain.id]: { ...(p[domain.id] || {}), [item.id]: v } }))} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {domains.every(d => !d.sub_items?.length) && (
                  <p className="text-sm text-neutral-400 text-center py-6 px-4">Sub-categories not configured. Ask admin to set up the template for this class.</p>
                )}
              </div>

              {/* Section B — Subject Grades (standard only) */}
              {!pgMode && subjects.length > 0 && (
                <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-primary"><p className="text-sm font-semibold text-white">
                    {isJrOrSrKg(selStudent?.class_name || '') ? 'Academic Assessment' : 'Section B - Result of Assessment Activities'}
                  </p></div>
                  <div className="flex items-center px-4 py-1.5 bg-neutral-50">
                    <p className="flex-1 text-xs text-neutral-400">Subject</p>
                    {STANDARD_RATINGS.map(r => (
                      <div key={r.value} className="w-10 text-center"><span className="text-[10px] font-bold" style={{ color: r.color }}>{r.value}</span></div>
                    ))}
                  </div>
                  <div className="divide-y divide-neutral-50">
                    {subjects.map((subject, idx) => {
                      const cur = subGrades[subject] as Rating || '';
                      return (
                        <div key={subject} className={`flex items-center px-4 py-2.5 ${idx % 2 === 1 ? 'bg-neutral-50/40' : ''}`}>
                          <div className="flex-1 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-neutral-400 shrink-0" /><p className="text-xs font-medium text-neutral-700">{subject}</p></div>
                          {STANDARD_RATINGS.map(r => (
                            <button key={r.value}
                              onClick={() => setSubGrades(p => ({ ...p, [subject]: cur === r.value ? '' : r.value }))}
                              className={`w-10 h-7 flex items-center justify-center rounded-lg mx-0.5 text-xs font-bold transition-all ${cur === r.value ? 'text-white shadow-sm scale-105' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'}`}
                              style={cur === r.value ? { backgroundColor: r.color } : {}}>{r.value}</button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section C — Comment / Observation */}
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-primary">
                  <p className="text-sm font-semibold text-white">{pgMode ? "Teacher's Observation" : "Teacher's Comment"}</p>
                </div>
                <div className="p-4 flex flex-col gap-3">
                  <textarea value={commentRaw} onChange={e => { setCommentRaw(e.target.value); setUseFmt(false); }}
                    placeholder={pgMode ? "A few words about the child's journey this term..." : 'Write your observations about the student...'}
                    rows={4} className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                  <Button onClick={handleReformat} loading={reformatting} disabled={!commentRaw.trim()} variant="secondary" size="sm">
                    <Wand2 className="w-3.5 h-3.5 mr-1.5" />Reformat with Oakie
                  </Button>
                  {commentFmt && (
                    <div className={`rounded-xl border p-3 ${useFmt ? 'border-emerald-300 bg-emerald-50' : 'border-neutral-200 bg-neutral-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-neutral-600">Oakie's version</p>
                        <button onClick={() => setUseFmt(v => !v)} className={`text-xs font-medium px-2 py-0.5 rounded-full ${useFmt ? 'bg-emerald-200 text-emerald-800' : 'bg-neutral-200 text-neutral-600'}`}>
                          {useFmt ? 'Using this' : 'Use this'}
                        </button>
                      </div>
                      <p className="text-sm text-neutral-700 leading-relaxed">{commentFmt}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* PG/Nursery narrative sections */}
              {pgMode && (
                <>
                  {[
                    { id: 'strengths',  label: 'My Strengths', placeholder: 'What does the child enjoy or demonstrate particularly well?', value: strengths, set: setStrengths },
                    { id: 'devskills', label: 'Developing Skills', placeholder: 'What is the child currently working towards?', value: devSkills, set: setDevSkills },
                  ].map(({ id, label, placeholder, value, set }) => (
                    <div key={label} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 bg-primary/10"><p className="text-sm font-semibold text-primary">{label}</p></div>
                      <div className="p-4 flex flex-col gap-2">
                        <textarea value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                          rows={3} className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                        <button
                          onClick={() => reformatField(id, value, set)}
                          disabled={!value.trim() || reformattingField === id}
                          className="self-start flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80 disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors">
                          {reformattingField === id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          Reformat with Oakie
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-primary/10"><p className="text-sm font-semibold text-primary">How We Can Support the Child Together</p></div>
                    <div className="p-4 flex flex-col gap-3">
                      <div>
                        <p className="text-xs font-medium text-neutral-500 mb-1">At School</p>
                        <textarea value={atSchool} onChange={e => setAtSchool(e.target.value)} placeholder="Support strategies at school..."
                          rows={2} className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                        <button
                          onClick={() => reformatField('atschool', atSchool, setAtSchool)}
                          disabled={!atSchool.trim() || reformattingField === 'atschool'}
                          className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80 disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors mt-1">
                          {reformattingField === 'atschool' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          Reformat with Oakie
                        </button>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-neutral-500 mb-1">At Home</p>
                        <textarea value={atHome} onChange={e => setAtHome(e.target.value)} placeholder="Ways parents can support at home..."
                          rows={2} className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                        <button
                          onClick={() => reformatField('athome', atHome, setAtHome)}
                          disabled={!atHome.trim() || reformattingField === 'athome'}
                          className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80 disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors mt-1">
                          {reformattingField === 'athome' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          Reformat with Oakie
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-amber-50 border-b border-amber-100"><p className="text-sm font-semibold text-amber-800">My Silver Oak Moment</p></div>
                    <div className="p-4 flex flex-col gap-2">
                      <textarea value={silverMoment} onChange={e => setSilverMoment(e.target.value)}
                        placeholder="Something special we noticed about this child..."
                        rows={3} className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                      <button
                        onClick={() => reformatField('silvermoment', silverMoment, setSilverMoment)}
                        disabled={!silverMoment.trim() || reformattingField === 'silvermoment'}
                        className="self-start flex items-center gap-1.5 text-xs text-amber-700 font-medium hover:text-amber-900 disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors">
                        {reformattingField === 'silvermoment' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        Reformat with Oakie
                      </button>
                    </div>
                  </div>
                </>
              )}

              {msg && <p className={`text-sm font-medium text-center ${msg === 'Draft saved' || msg.includes('notified') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</p>}

              <div className="flex flex-col gap-2">
                <Button onClick={handleSave} loading={saving} fullWidth>Save Draft</Button>
                <div className="flex gap-2">
                  <Button onClick={() => report?.id && handlePdf(report.id, selStudent?.name || '', selTerm)} loading={exporting} disabled={!report?.id} variant="secondary" fullWidth>
                    <FileDown className="w-4 h-4 mr-1.5" />Export PDF
                  </Button>
                  <Button onClick={() => report?.id && handleShare(report.id)} loading={sharing} disabled={!report?.id || report.status === 'shared'} variant="secondary" fullWidth>
                    <Send className="w-4 h-4 mr-1.5" />{report?.status === 'shared' ? 'Shared' : 'Share to Parent'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  // Sort: shared first, then by updated_at desc
  const sortedSaved = [...saved].sort((a, b) => {
    if (a.status === b.status) return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    return a.status === 'shared' ? -1 : 1;
  });

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1 rounded-lg hover:bg-neutral-100">
          <ChevronLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-neutral-900">Mid / Final Term Reports</h1>
          <p className="text-xs text-neutral-400">Holistic Progress Report</p>
        </div>
        <Button size="sm" onClick={() => { setSearch(''); setView('pick'); }}>
          <Plus className="w-4 h-4 mr-1" />New
        </Button>
      </header>

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4">
        {/* Term filter */}
        <div className="flex gap-2">
          {([['', 'All'], ['mid_term', 'Mid-Term'], ['final_term', 'Final']] as [Term | '', string][]).map(([k, label]) => (
            <button key={k} onClick={() => setFilterTerm(k)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${filterTerm === k ? 'bg-primary text-white border-primary' : 'border-neutral-200 text-neutral-500 hover:border-primary/40'}`}>
              {label}
            </button>
          ))}
        </div>

        {loadingSaved ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : sortedSaved.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center">
            <FileText className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-500">No reports yet</p>
            <p className="text-xs text-neutral-400 mt-1">Tap New to create the first report</p>
            <button onClick={() => { setSearch(''); setView('pick'); }}
              className="mt-4 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium flex items-center gap-2 mx-auto">
              <Plus className="w-4 h-4" />Create First Report
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedSaved.map(r => {
              const isShared = r.status === 'shared';
              return (
                <div key={r.id}
                  className={`bg-white rounded-2xl overflow-hidden border transition-colors ${isShared ? 'border-emerald-200' : 'border-neutral-200'}`}
                  style={isShared ? { borderLeftWidth: 4, borderLeftColor: '#10b981' } : { borderLeftWidth: 4, borderLeftColor: '#e5e7eb' }}>

                  {/* Top row — student info + view/edit/delete icons */}
                  <div className="px-4 pt-3.5 pb-2 flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isShared ? 'bg-emerald-100 text-emerald-800' : 'bg-primary/10 text-primary'}`}>
                      {r.student_name.charAt(0)}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-800 truncate">{r.student_name}</p>
                      <p className="text-xs text-neutral-400">{r.class_name} - {r.section_label}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-lg">{TERM_LABELS[r.term as Term] || r.term}</span>
                        {isShared ? (
                          <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />Sent to Parents
                          </span>
                        ) : (
                          <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            Draft
                          </span>
                        )}
                        <span className="text-xs text-neutral-300">{fmtDate(r.updated_at)}</span>
                      </div>
                    </div>

                    {/* Icon actions */}
                    <div className="flex gap-0.5 shrink-0 mt-0.5">
                      <button onClick={() => openDetail(r)} title="View" className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-primary transition-colors"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(r)} title="Edit" className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-primary transition-colors"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(r.id, r.student_name)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  {/* Bottom action bar */}
                  <div className={`px-4 pb-3 flex items-center gap-2 ${isShared ? 'border-t border-emerald-100 pt-2 bg-emerald-50/40' : 'border-t border-neutral-50 pt-2'}`}>
                    {isShared ? (
                      <>
                        {/* Shared: show Resend + Recall */}
                        <button
                          onClick={() => handleShare(r.id)}
                          disabled={sharing}
                          className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50">
                          <Send className="w-3.5 h-3.5" />Resend
                        </button>
                        <button
                          onClick={() => handleRecall(r.id)}
                          disabled={sharing}
                          className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50">
                          <span className="w-3 h-3 inline-block border-2 border-amber-600 rounded-sm" />Recall
                        </button>
                        <span className="text-[10px] text-neutral-400 ml-1">Recall hides report from parent</span>
                      </>
                    ) : (
                      <>
                        {/* Draft: show Send to Parents */}
                        <button
                          onClick={() => handleShare(r.id)}
                          disabled={sharing}
                          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50">
                          <Send className="w-3.5 h-3.5" />Send to Parents
                        </button>
                        <span className="text-[10px] text-neutral-400">Parent will be notified</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {msg && <p className={`text-sm font-medium text-center ${msg.includes('notified') || msg.includes('shared') ? 'text-emerald-600' : msg.includes('recalled') ? 'text-amber-600' : 'text-red-500'}`}>{msg}</p>}
      </div>
    </div>
  );
}


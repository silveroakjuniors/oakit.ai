'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import { ChevronLeft, Download, Calendar, Users, BookOpen, AlertCircle } from 'lucide-react';
import OakitLogo from '@/components/OakitLogo';

interface ClassStat {
  class_id: string; class_name: string; total_students: number;
  total_sections: number; class_teachers: number; supporting_teachers: number;
  avg_coverage_pct: number;
}
interface SpecialDay { day_date: string; label: string; day_type: string; activity_note?: string; }
interface Holiday { holiday_date: string; event_name: string; }
interface OverviewData {
  school_name: string;
  summary: { total_students: number; total_sections: number; total_teachers: number; assigned_teachers: number; avg_coverage_pct: number; total_classes: number; };
  classes: ClassStat[];
  upcoming_special_days: SpecialDay[];
  upcoming_holidays: Holiday[];
}
interface Section { section_id: string; section_label: string; class_name: string; }
interface ReportData {
  school_name: string; class_name: string; section_label: string;
  class_teacher: string; supporting_teachers: string;
  from_date: string; to_date: string;
  completions: { date: string; teacher: string; topics_covered: number }[];
  covered_topics: { label: string; document: string }[];
  special_days: SpecialDay[]; holidays: Holiday[];
  attendance: { days_marked: number; total_present: number; total_absent: number };
  total_days_completed: number; total_topics_covered: number;
}

// ── Mini donut chart (SVG, no deps) ──────────────────────────
function DonutChart({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#111">{pct}%</text>
    </svg>
  );
}

// ── Bar chart (SVG) ───────────────────────────────────────────
function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[10px] font-bold text-neutral-600">{d.value}</span>
          <div className="w-full rounded-t-lg transition-all" style={{ height: `${(d.value / max) * 72}px`, backgroundColor: d.color, minHeight: 4 }} />
          <span className="text-[9px] text-neutral-400 text-center leading-tight">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

const DAY_TYPE_COLORS: Record<string, string> = {
  settling: 'bg-green-100 text-green-700',
  revision: 'bg-purple-100 text-purple-700',
  exam: 'bg-red-100 text-red-700',
  event: 'bg-blue-100 text-blue-700',
  holiday: 'bg-amber-100 text-amber-700',
};

export default function PrincipalOverviewPage() {
  const router = useRouter();
  const token = getToken() || '';
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  // Report generator state
  const [reportSection, setReportSection] = useState('');
  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [reportTo, setReportTo] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMsg, setReportMsg] = useState('');

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    Promise.all([
      apiGet<OverviewData>('/api/v1/admin/reports/school-overview', token),
      apiGet<Section[]>('/api/v1/principal/sections', token).catch(() => []),
    ]).then(([ov, secs]) => {
      setOverview(ov);
      setSections(Array.isArray(secs) ? secs : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function generateReport() {
    if (!reportSection) { setReportMsg('Please select a section'); return; }
    setReportLoading(true); setReportMsg(''); setReportData(null);
    try {
      const data = await apiGet<ReportData>(
        `/api/v1/admin/reports/class-coverage?section_id=${reportSection}&from=${reportFrom}&to=${reportTo}`,
        token
      );
      setReportData(data);
    } catch (e: any) { setReportMsg(e.message || 'Failed to generate report'); }
    finally { setReportLoading(false); }
  }

  async function downloadReport() {
    if (!reportData) return;
    // Build a formatted text report and trigger download
    const lines = [
      `CLASS COVERAGE REPORT`,
      `School: ${reportData.school_name}`,
      `Class: ${reportData.class_name} — Section ${reportData.section_label}`,
      `Class Teacher: ${reportData.class_teacher || '—'}`,
      `Supporting Teachers: ${reportData.supporting_teachers || 'None'}`,
      `Period: ${reportData.from_date} to ${reportData.to_date}`,
      `Generated: ${new Date().toLocaleDateString('en-IN')}`,
      ``,
      `SUMMARY`,
      `Days with completion logged: ${reportData.total_days_completed}`,
      `Total topics covered: ${reportData.total_topics_covered}`,
      `Attendance days marked: ${reportData.attendance?.days_marked ?? 0}`,
      ``,
      `DAILY COMPLETIONS`,
      ...reportData.completions.map(c => `  ${c.date}  |  ${c.teacher}  |  ${c.topics_covered} topics`),
      ``,
      `TOPICS COVERED`,
      ...reportData.covered_topics.map((t, i) => `  ${i + 1}. ${t.label}`),
      ``,
      `SPECIAL DAYS IN PERIOD`,
      ...(reportData.special_days.length > 0
        ? reportData.special_days.map(s => `  ${s.day_date}  ${s.label} (${s.day_type})`)
        : ['  None']),
      ``,
      `HOLIDAYS IN PERIOD`,
      ...(reportData.holidays.length > 0
        ? reportData.holidays.map(h => `  ${h.holiday_date}  ${h.event_name}`)
        : ['  None']),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${reportData.class_name}_${reportData.section_label}_${reportData.from_date}_${reportData.to_date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-400">Loading school overview…</p>
        </div>
      </div>
    );
  }

  const ov = overview;

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 text-white px-4 py-3 flex items-center gap-3"
        style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}>
        <button onClick={() => router.back()} className="text-white/70 hover:text-white">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-white">School Overview</h1>
          <p className="text-xs text-white/60">{ov?.school_name}</p>
        </div>
        <button onClick={() => { clearToken(); router.push('/login'); }} className="text-xs text-white/50 hover:text-white/80">Sign out</button>
      </header>

      <div className="p-4 flex flex-col gap-5 max-w-2xl mx-auto">

        {/* ── SCHOOL HEALTH CHARTS ── */}
        {ov && (
          <div className="bg-white border border-neutral-100 rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-bold text-neutral-800 mb-4">🏫 School Health</p>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="flex flex-col items-center gap-1">
                <DonutChart pct={ov.summary.avg_coverage_pct} color="#10b981" />
                <p className="text-xs text-neutral-500 text-center">Curriculum<br/>Coverage</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <DonutChart pct={ov.summary.total_teachers > 0 ? Math.round((ov.summary.assigned_teachers / ov.summary.total_teachers) * 100) : 0} color="#6366f1" />
                <p className="text-xs text-neutral-500 text-center">Teachers<br/>Assigned</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <DonutChart pct={ov.summary.total_sections > 0 ? Math.round((ov.summary.total_sections / ov.summary.total_sections) * 100) : 0} color="#f59e0b" size={80} />
                <p className="text-xs text-neutral-500 text-center">Sections<br/>Active</p>
              </div>
            </div>

            {/* Summary pills */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Students', value: ov.summary.total_students, icon: '🎓' },
                { label: 'Teachers', value: ov.summary.total_teachers, icon: '👩‍🏫' },
                { label: 'Classes', value: ov.summary.total_classes, icon: '🏫' },
              ].map((s, i) => (
                <div key={i} className="bg-neutral-50 rounded-xl p-3 text-center">
                  <p className="text-lg">{s.icon}</p>
                  <p className="text-xl font-black text-neutral-800">{s.value}</p>
                  <p className="text-[10px] text-neutral-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CLASS BREAKDOWN BAR CHART ── */}
        {ov && ov.classes.length > 0 && (
          <div className="bg-white border border-neutral-100 rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-bold text-neutral-800 mb-4">📊 Coverage by Class</p>
            <BarChart data={ov.classes.map(c => ({
              label: c.class_name,
              value: c.avg_coverage_pct,
              color: c.avg_coverage_pct >= 75 ? '#10b981' : c.avg_coverage_pct >= 40 ? '#f59e0b' : '#ef4444',
            }))} />
            <div className="mt-4 space-y-2">
              {ov.classes.map(c => (
                <div key={c.class_id} className="flex items-center gap-3 text-xs">
                  <span className="w-16 font-medium text-neutral-700 shrink-0">{c.class_name}</span>
                  <span className="text-neutral-400">{c.total_students} students</span>
                  <span className="text-neutral-400">{c.total_sections} sections</span>
                  <span className="text-neutral-400">
                    {c.class_teachers} class teacher{c.class_teachers !== 1 ? 's' : ''}
                    {c.supporting_teachers > 0 ? ` + ${c.supporting_teachers} support` : ''}
                  </span>
                  <span className={`ml-auto font-bold ${c.avg_coverage_pct >= 75 ? 'text-emerald-600' : c.avg_coverage_pct >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                    {c.avg_coverage_pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── UPCOMING SPECIAL DAYS ── */}
        {ov && (ov.upcoming_special_days.length > 0 || ov.upcoming_holidays.length > 0) && (
          <div className="bg-white border border-neutral-100 rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-bold text-neutral-800 mb-3">📅 Upcoming (Next 30 Days)</p>
            <div className="space-y-2">
              {ov.upcoming_holidays.map((h, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                  <span className="text-lg shrink-0">🎉</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-800">{h.event_name}</p>
                    <p className="text-xs text-neutral-400">
                      {new Date(h.holiday_date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Holiday</span>
                </div>
              ))}
              {ov.upcoming_special_days.map((s, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${DAY_TYPE_COLORS[s.day_type] || 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                  <span className="text-lg shrink-0">
                    {s.day_type === 'exam' ? '📝' : s.day_type === 'revision' ? '📚' : s.day_type === 'settling' ? '🌱' : '🎪'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-800">{s.label}</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(s.day_date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {s.activity_note && ` · ${s.activity_note}`}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${DAY_TYPE_COLORS[s.day_type] || ''}`}>{s.day_type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CLASS REPORT GENERATOR ── */}
        <div className="bg-white border border-neutral-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-primary-500" />
            <p className="text-sm font-bold text-neutral-800">Class Coverage Report</p>
          </div>
          <p className="text-xs text-neutral-400 mb-3">Generate a detailed report of what was covered in a class between two dates.</p>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1 block">Section</label>
              <select value={reportSection} onChange={e => setReportSection(e.target.value)}
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30">
                <option value="">Select a section…</option>
                {sections.map(s => (
                  <option key={s.section_id} value={s.section_id}>{s.class_name} — Section {s.section_label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-neutral-600 mb-1 block">From</label>
                <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)}
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-neutral-600 mb-1 block">To</label>
                <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)}
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400/30" />
              </div>
            </div>
            {reportMsg && <p className="text-xs text-red-500">{reportMsg}</p>}
            <button onClick={generateReport} disabled={reportLoading || !reportSection}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
              {reportLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <BookOpen className="w-4 h-4" />}
              Generate Report
            </button>
          </div>

          {/* Report preview */}
          {reportData && (
            <div className="mt-4 border border-neutral-100 rounded-xl overflow-hidden">
              <div className="bg-neutral-50 px-4 py-3 flex items-center justify-between border-b border-neutral-100">
                <div>
                  <p className="text-sm font-bold text-neutral-800">{reportData.class_name} — Section {reportData.section_label}</p>
                  <p className="text-xs text-neutral-400">{reportData.from_date} → {reportData.to_date}</p>
                </div>
                <button onClick={downloadReport}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              </div>

              <div className="px-4 py-3 space-y-3">
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Days logged', value: reportData.total_days_completed },
                    { label: 'Topics covered', value: reportData.total_topics_covered },
                    { label: 'Att. days', value: reportData.attendance?.days_marked ?? 0 },
                  ].map((s, i) => (
                    <div key={i} className="bg-neutral-50 rounded-xl p-2.5 text-center">
                      <p className="text-lg font-black text-primary-700">{s.value}</p>
                      <p className="text-[10px] text-neutral-400">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Teacher info */}
                <div className="text-xs text-neutral-500 space-y-0.5">
                  <p>👩‍🏫 Class teacher: <span className="font-medium text-neutral-700">{reportData.class_teacher || '—'}</span></p>
                  {reportData.supporting_teachers && <p>👥 Supporting: <span className="font-medium text-neutral-700">{reportData.supporting_teachers}</span></p>}
                </div>

                {/* Topics covered */}
                {reportData.covered_topics.length > 0 && (
                  <details className="group">
                    <summary className="text-xs font-semibold text-neutral-700 cursor-pointer list-none flex items-center gap-1">
                      <span className="transition-transform group-open:rotate-90">›</span>
                      {reportData.covered_topics.length} topics covered
                    </summary>
                    <div className="mt-2 space-y-1 pl-3">
                      {reportData.covered_topics.map((t, i) => (
                        <p key={i} className="text-xs text-neutral-600">✓ {t.label}</p>
                      ))}
                    </div>
                  </details>
                )}

                {/* Special days */}
                {reportData.special_days.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-700 mb-1">Special days in period</p>
                    {reportData.special_days.map((s, i) => (
                      <p key={i} className="text-xs text-neutral-500">📅 {s.day_date} — {s.label}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

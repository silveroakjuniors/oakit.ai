'use client';
import { useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { X, BookOpen } from 'lucide-react';
import Link from 'next/link';
import type { SectionSummary } from './types';

interface Props {
  sections: SectionSummary[];
  byClass: Record<string, SectionSummary[]>;
}

const RADIAN = Math.PI / 180;
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.1) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
    fontSize={9} fontWeight={700}>{`${(percent * 100).toFixed(0)}%`}</text>;
}

const covColor = (pct: number) =>
  pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : pct > 0 ? '#f87171' : '#e5e7eb';

// ── Full drill-down popup ─────────────────────────────────────────────────────
function CoverageDrillDown({
  sections, byClass, avgCovPct, onClose,
}: {
  sections: SectionSummary[];
  byClass: Record<string, SectionSummary[]>;
  avgCovPct: number;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'sections' | 'classes'>('sections');

  const sectionsWithData = sections.filter(s => s.coverage_total > 0);

  // Stacked bar per section
  const barData = sectionsWithData.map(s => ({
    name: `${s.class_name.slice(0, 3)} ${s.section_label}`,
    full: `${s.class_name} ${s.section_label}`,
    covered:   s.coverage_covered,
    remaining: s.coverage_total - s.coverage_covered,
    pct:       s.coverage_pct ?? 0,
  }));

  // Class-level averages
  const classData = Object.entries(byClass).map(([name, secs]) => {
    const withData = secs.filter(s => s.coverage_total > 0);
    const avg = withData.length
      ? Math.round(withData.reduce((s, sec) => s + (sec.coverage_pct ?? 0), 0) / withData.length)
      : 0;
    return { name, avg, sections: secs.length, withData: withData.length };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
          <div>
            <p className="text-sm font-bold text-neutral-800">Curriculum Coverage</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              {sectionsWithData.length} of {sections.length} sections have curriculum data · avg {avgCovPct}%
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/principal/coverage"
              className="text-xs font-semibold text-[#1B4332] hover:underline">
              Full report →
            </Link>
            <button onClick={onClose}
              className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 shrink-0">
          {(['sections', 'classes'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all capitalize ${
                tab === t ? 'bg-[#1B4332] text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
              }`}>
              {t === 'sections' ? '📚 By Section' : '🏫 By Class'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {tab === 'sections' && (
            <>
              {barData.length > 0 ? (
                <>
                  {/* Stacked bar chart */}
                  <div style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={18}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                          formatter={(v: any, name: any, p: any) => [
                            `${v} topics (${p.payload.pct}%)`,
                            name === 'covered' ? '✓ Covered' : '○ Remaining',
                          ]} />
                        <Bar dataKey="covered"   name="Covered"   stackId="a" fill="#10b981" />
                        <Bar dataKey="remaining" name="Remaining" stackId="a" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Section rows */}
                  <div className="space-y-2">
                    {sectionsWithData
                      .sort((a, b) => (b.coverage_pct ?? 0) - (a.coverage_pct ?? 0))
                      .map(s => {
                        const pct = s.coverage_pct ?? 0;
                        return (
                          <div key={s.section_id}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-neutral-800">
                                  {s.class_name} · Section {s.section_label}
                                </p>
                                <span className="text-[10px] font-black ml-2 shrink-0"
                                  style={{ color: covColor(pct) }}>{pct}%</span>
                              </div>
                              <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                                <div className="h-1.5 rounded-full transition-all"
                                  style={{ width: `${pct}%`, background: covColor(pct) }} />
                              </div>
                              <p className="text-[9px] text-neutral-400 mt-0.5">
                                {s.coverage_covered}/{s.coverage_total} topics covered
                                {s.class_teacher_name && ` · ${s.class_teacher_name}`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              ) : (
                <div className="text-center py-10">
                  <p className="text-3xl mb-2">📚</p>
                  <p className="text-sm font-semibold text-neutral-600">No curriculum data yet</p>
                  <p className="text-xs text-neutral-400 mt-1">Upload curriculum PDFs to track coverage</p>
                  <Link href="/principal/curriculum"
                    className="mt-3 inline-block px-4 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-xl">
                    Upload Curriculum →
                  </Link>
                </div>
              )}
            </>
          )}

          {tab === 'classes' && (
            <div className="space-y-2">
              {classData.map(c => (
                <div key={c.name}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-neutral-800">{c.name}</p>
                      <span className="text-[10px] font-black ml-2 shrink-0"
                        style={{ color: covColor(c.avg) }}>{c.avg}%</span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                      <div className="h-1.5 rounded-full transition-all"
                        style={{ width: `${c.avg}%`, background: covColor(c.avg) }} />
                    </div>
                    <p className="text-[9px] text-neutral-400 mt-0.5">
                      {c.sections} section{c.sections !== 1 ? 's' : ''} · {c.withData} with curriculum data
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Compact highlight card ────────────────────────────────────────────────────
export default function CoverageChart({ sections, byClass }: Props) {
  const [showDrill, setShowDrill] = useState(false);

  if (sections.length === 0) return null;

  const sectionsWithData = sections.filter(s => s.coverage_total > 0);
  const avgCovPct = sectionsWithData.length
    ? Math.round(sectionsWithData.reduce((s, sec) => s + (sec.coverage_pct ?? 0), 0) / sectionsWithData.length)
    : 0;

  // Status buckets for donut
  const buckets = [
    { name: 'On track ≥75%', value: 0, color: '#10b981' },
    { name: 'Moderate 40–74%', value: 0, color: '#f59e0b' },
    { name: 'Behind <40%', value: 0, color: '#f87171' },
    { name: 'No data', value: 0, color: '#e5e7eb' },
  ];
  sections.forEach(s => {
    const pct = s.coverage_pct ?? 0;
    if (s.coverage_total === 0) buckets[3].value++;
    else if (pct >= 75) buckets[0].value++;
    else if (pct >= 40) buckets[1].value++;
    else buckets[2].value++;
  });
  const donutData = buckets.filter(b => b.value > 0);

  const onTrack  = buckets[0].value;
  const behind   = buckets[2].value;
  const noData   = buckets[3].value;

  return (
    <>
      {/* ── Compact highlight card ── */}
      <button
        onClick={() => setShowDrill(true)}
        className="w-full bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 hover:border-[#1B4332]/30 hover:shadow-md transition-all text-left group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-800">Curriculum Coverage</p>
              <p className="text-[9px] text-neutral-400">
                {sectionsWithData.length} sections · avg {avgCovPct}%
              </p>
            </div>
          </div>
          <span className="text-[10px] text-neutral-400 group-hover:text-[#1B4332] transition-colors">
            Drill down →
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Mini donut */}
          <div className="w-20 h-20 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%"
                  innerRadius={22} outerRadius={36}
                  dataKey="value" labelLine={false} label={PieLabel}>
                  {donutData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }}
                  formatter={(v: any, name: string) => [`${v} sections`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Stats */}
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <p className="text-[10px] text-neutral-600">On track</p>
              </div>
              <p className="text-[10px] font-bold text-emerald-600">{onTrack} sections</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <p className="text-[10px] text-neutral-600">Behind</p>
              </div>
              <p className="text-[10px] font-bold text-red-500">{behind} sections</p>
            </div>
            {noData > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-neutral-300" />
                  <p className="text-[10px] text-neutral-600">No data</p>
                </div>
                <p className="text-[10px] font-bold text-neutral-400">{noData} sections</p>
              </div>
            )}
            <div className="pt-1 border-t border-neutral-100">
              <div className="w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                <div className="h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${avgCovPct}%`, background: covColor(avgCovPct) }} />
              </div>
              <p className="text-[9px] text-neutral-400 mt-0.5">School average: {avgCovPct}%</p>
            </div>
          </div>
        </div>
      </button>

      {/* ── Drill-down popup ── */}
      {showDrill && (
        <CoverageDrillDown
          sections={sections}
          byClass={byClass}
          avgCovPct={avgCovPct}
          onClose={() => setShowDrill(false)}
        />
      )}
    </>
  );
}

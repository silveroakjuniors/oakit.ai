'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Badge } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface PlanMonth { plan_year: number; plan_month: number; days_count: number; }
interface SupportingTeacher { id: string; name: string; }
interface SectionPlan {
  section_id: string; section_label: string;
  class_id: string; class_name: string;
  class_teacher_name: string | null; class_teacher_id: string | null;
  supporting_teachers: SupportingTeacher[];
  curriculum_filename: string | null; total_chunks: number | null; curriculum_status: string | null;
  plans: PlanMonth[];
}
interface Holiday { id: string; holiday_date: string; event_name: string; }
interface SpecialDayGroup {
  ids: string[]; from_date: string; to_date: string;
  day_type: 'settling' | 'revision' | 'exam' | 'event';
  label: string; activity_note?: string; count: number;
}

const DAY_TYPE_CONFIG = {
  settling: { label: 'Settling', color: 'bg-blue-100 text-blue-700', icon: '🌱' },
  revision:  { label: 'Revision', color: 'bg-amber-100 text-amber-700', icon: '📝' },
  exam:      { label: 'Exam',     color: 'bg-red-100 text-red-700',    icon: '📋' },
  event:     { label: 'Event',    color: 'bg-purple-100 text-purple-700', icon: '🎉' },
};

function parseDate(iso: string) {
  const [y, m, d] = (iso || '').split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtShort(iso: string) {
  return parseDate(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function PlansPage() {
  const token = getToken() || '';
  const [sections, setSections] = useState<SectionPlan[]>([]);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [academicYear, setAcademicYear] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [specialDays, setSpecialDays] = useState<SpecialDayGroup[]>([]);
  // track which month rows are expanded to show holiday/special day detail
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiGet<any[]>('/api/v1/admin/calendar', token)
      .then(rows => { if (rows.length > 0) setAcademicYear(rows[0].academic_year); })
      .catch(console.error);
    apiGet<SectionPlan[]>('/api/v1/admin/calendar/plans', token)
      .then(setSections).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!academicYear) return;
    apiGet<Holiday[]>(`/api/v1/admin/calendar/${academicYear}/holidays`, token)
      .then(setHolidays).catch(console.error);
    apiGet<SpecialDayGroup[]>(`/api/v1/admin/calendar/${academicYear}/special-days`, token)
      .then(setSpecialDays).catch(console.error);
  }, [academicYear]);

  // holidays that fall in a given month/year
  function holidaysInMonth(month: number, year: number) {
    return holidays.filter(h => {
      const d = parseDate(h.holiday_date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });
  }

  // special day groups that overlap a given month/year
  function specialDaysInMonth(month: number, year: number) {
    return specialDays.filter(g => {
      const from = parseDate(g.from_date);
      const to = parseDate(g.to_date);
      const mStart = new Date(year, month - 1, 1);
      const mEnd = new Date(year, month, 0);
      return from <= mEnd && to >= mStart;
    });
  }

  function toggleMonth(key: string) {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function exportPdf(sectionId: string, month: number, year: number, className: string, label: string) {
    const key = `${sectionId}-${month}-${year}`;
    setExportingId(key);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/admin/calendar/plans/${sectionId}/export?month=${month}&year=${year}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `plan-${className}-${label}-${year}-${month}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally { setExportingId(null); }
  }

  const byClass = sections.reduce<Record<string, SectionPlan[]>>((acc, s) => {
    if (!acc[s.class_id]) acc[s.class_id] = [];
    acc[s.class_id].push(s);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold text-primary mb-2">Plans</h1>
      <p className="text-sm text-gray-500 mb-6">Curriculum plans by class and section — teachers assigned and monthly exports.</p>

      {loading && <p className="text-sm text-gray-400">Loading...</p>}

      {!loading && sections.length === 0 && (
        <Card className="text-center py-12 text-gray-400">
          No plans generated yet. Go to Calendar to generate plans.
        </Card>
      )}

      <div className="flex flex-col gap-6">
        {Object.values(byClass).map(classSections => {
          const className = classSections[0].class_name;
          const curriculum = classSections[0].curriculum_filename;
          const curriculumStatus = classSections[0].curriculum_status;

          return (
            <Card key={classSections[0].class_id}>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">{className}</h2>
                  {curriculum ? (
                    <p className="text-xs text-gray-400 mt-0.5">
                      📄 {curriculum}
                      {classSections[0].total_chunks && ` · ${classSections[0].total_chunks} chunks`}
                      {curriculumStatus && <Badge label={curriculumStatus} variant={curriculumStatus === 'ready' ? 'success' : 'warning'} />}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-500 mt-0.5">⚠ No curriculum uploaded</p>
                  )}
                </div>
                <span className="text-xs text-gray-400">{classSections.length} section{classSections.length > 1 ? 's' : ''}</span>
              </div>

              <div className="flex flex-col gap-4">
                {classSections.map(sec => {
                  return (
                    <div key={sec.section_id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex flex-wrap gap-3 mb-3 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500">Class Teacher:</span>
                          {sec.class_teacher_name ? (
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{sec.class_teacher_name}</span>
                          ) : (
                            <span className="text-amber-500">Not assigned</span>
                          )}
                        </div>
                        {sec.supporting_teachers.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-gray-500">Supporting:</span>
                            {sec.supporting_teachers.map(t => (
                              <span key={t.id} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{t.name}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {sec.plans.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-xs text-gray-500 mb-1">Generated Plans</p>
                          {sec.plans.map(p => {
                            const key = `${sec.section_id}-${p.plan_month}-${p.plan_year}`;
                            const monthHolidays = holidaysInMonth(p.plan_month, p.plan_year);
                            const monthSpecial = specialDaysInMonth(p.plan_month, p.plan_year);
                            const totalSpecialDays = monthSpecial.reduce((sum, g) => sum + g.count, 0);
                            const expanded = expandedMonths.has(key);

                            return (
                              <div key={key} className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                                {/* Month row */}
                                <div className="flex items-center justify-between px-3 py-2">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <span className="text-sm font-medium text-gray-700">
                                      {MONTHS[p.plan_month - 1]} {p.plan_year}
                                    </span>
                                    <span className="text-xs text-gray-400">· {p.days_count} working days</span>
                                    {monthHolidays.length > 0 && (
                                      <span className="text-xs text-red-500">🎉 {monthHolidays.length} holiday{monthHolidays.length > 1 ? 's' : ''}</span>
                                    )}
                                    {totalSpecialDays > 0 && (
                                      <span className="text-xs text-blue-500">📌 {totalSpecialDays} special day{totalSpecialDays > 1 ? 's' : ''}</span>
                                    )}
                                    {(monthHolidays.length > 0 || monthSpecial.length > 0) && (
                                      <button
                                        onClick={() => toggleMonth(key)}
                                        className="text-xs text-gray-400 hover:text-gray-600 underline"
                                      >
                                        {expanded ? 'hide' : 'details'}
                                      </button>
                                    )}
                                  </div>
                                  <Button
                                    size="sm" variant="ghost"
                                    loading={exportingId === key}
                                    onClick={() => exportPdf(sec.section_id, p.plan_month, p.plan_year, sec.class_name, sec.section_label)}
                                  >
                                    Export PDF
                                  </Button>
                                </div>

                                {/* Expanded detail */}
                                {expanded && (
                                  <div className="border-t border-gray-100 px-3 py-2 flex flex-col gap-2">
                                    {monthHolidays.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-gray-500 mb-1">Holidays</p>
                                        <div className="flex flex-col gap-0.5">
                                          {monthHolidays.map(h => (
                                            <div key={h.id} className="flex items-center gap-2 text-xs">
                                              <span className="text-red-400 w-16 shrink-0">{fmtShort(h.holiday_date)}</span>
                                              <span className="text-gray-700">{h.event_name}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {monthSpecial.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-gray-500 mb-1">Special Days</p>
                                        <div className="flex flex-col gap-0.5">
                                          {monthSpecial.map((g, i) => {
                                            const cfg = DAY_TYPE_CONFIG[g.day_type];
                                            const range = g.from_date === g.to_date
                                              ? fmtShort(g.from_date)
                                              : `${fmtShort(g.from_date)} – ${fmtShort(g.to_date)}`;
                                            return (
                                              <div key={i} className="flex items-center gap-2 text-xs">
                                                <span className={`px-1.5 py-0.5 rounded-full shrink-0 ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
                                                <span className="text-gray-700">{g.label}</span>
                                                <span className="text-gray-400">{range}{g.count > 1 ? ` · ${g.count} days` : ''}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">No plans generated yet for this section.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

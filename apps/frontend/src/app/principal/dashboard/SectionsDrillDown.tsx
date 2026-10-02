'use client';
import { ChevronDown } from 'lucide-react';
import type { SectionSummary } from './types';

interface Props {
  byClass: Record<string, SectionSummary[]>;
  totalStudents: number;
}

export default function SectionsDrillDown({ byClass, totalStudents }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-neutral-50">
        <p className="text-sm font-bold text-neutral-800">Classes & Sections</p>
        <p className="text-[10px] text-neutral-400 mt-0.5">
          {Object.keys(byClass).length} classes · {Object.values(byClass).flat().length} sections · {totalStudents} students
        </p>
      </div>

      <div className="divide-y divide-neutral-50 max-h-96 overflow-y-auto">
        {Object.entries(byClass).map(([className, sections]) => {
          const allAttDone = sections.every(s => s.attendance_submitted);
          const classCovPct = sections.length > 0
            ? Math.round(sections.reduce((s, sec) => s + (sec.coverage_pct ?? 0), 0) / sections.length)
            : 0;
          const classStudents = sections.reduce((s, sec) => s + sec.total_students, 0);
          const classPresent = sections.reduce((s, sec) => s + sec.present_today, 0);

          return (
            <details key={className} className="group">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none hover:bg-neutral-50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-300 shrink-0 transition-transform group-open:rotate-180" />
                  <div>
                    <p className="text-sm font-bold text-neutral-800">{className}</p>
                    <p className="text-[10px] text-neutral-400">
                      {sections.length} section{sections.length !== 1 ? 's' : ''} · {classStudents} students · {classPresent} present
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${allAttDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {allAttDone ? 'Att done' : 'Att pending'}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${classCovPct >= 75 ? 'bg-emerald-100 text-emerald-700' : classCovPct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-500'}`}>
                    {classCovPct}% cov
                  </span>
                </div>
              </summary>

              <div className="border-t border-neutral-50 divide-y divide-neutral-50 bg-neutral-50/30">
                {sections.map(sec => {
                  const attPctSec = sec.total_students > 0
                    ? Math.round((sec.present_today / sec.total_students) * 100)
                    : 0;
                  const covPctSec = sec.coverage_pct ?? 0;

                  return (
                    <details key={sec.section_id} className="group/sec">
                      <summary className="flex items-center justify-between pl-10 pr-4 py-2.5 cursor-pointer list-none hover:bg-neutral-100/50 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronDown className="w-3 h-3 text-neutral-300 shrink-0 transition-transform group-open/sec:rotate-180" />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-neutral-700">Section {sec.section_label}</span>
                            <span className="text-[10px] text-neutral-400 ml-2">
                              {sec.class_teacher_name ?? 'No teacher'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sec.attendance_submitted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {sec.attendance_submitted ? 'Att' : 'No att'}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sec.plan_completed ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                            {sec.plan_completed ? 'Plan done' : 'Plan pending'}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sec.homework_sent ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-500'}`}>
                            {sec.homework_sent ? 'HW sent' : 'No HW'}
                          </span>
                        </div>
                      </summary>

                      <div className="pl-10 pr-4 pb-3 pt-2 grid grid-cols-3 gap-3">
                        {/* Attendance */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-neutral-400">Attendance</span>
                            <span className={`text-[10px] font-bold ${attPctSec >= 90 ? 'text-emerald-600' : attPctSec >= 75 ? 'text-amber-600' : 'text-red-500'}`}>
                              {sec.attendance_submitted ? `${attPctSec}%` : '–'}
                            </span>
                          </div>
                          <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: sec.attendance_submitted ? `${attPctSec}%` : '0%',
                                background: attPctSec >= 90 ? '#10b981' : attPctSec >= 75 ? '#f59e0b' : '#ef4444',
                              }}
                            />
                          </div>
                          {sec.attendance_submitted && (
                            <p className="text-[9px] text-neutral-400 mt-0.5">
                              {sec.present_today}P · {sec.absent_today}A of {sec.total_students}
                            </p>
                          )}
                        </div>

                        {/* Curriculum */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-neutral-400">Curriculum</span>
                            <span className={`text-[10px] font-bold ${covPctSec >= 75 ? 'text-emerald-600' : covPctSec >= 40 ? 'text-amber-600' : covPctSec > 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                              {sec.coverage_total > 0 ? `${covPctSec}%` : 'No data'}
                            </span>
                          </div>
                          <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${Math.min(covPctSec, 100)}%`,
                                background: covPctSec >= 75 ? '#10b981' : covPctSec >= 40 ? '#f59e0b' : '#ef4444',
                              }}
                            />
                          </div>
                          {sec.coverage_total > 0 && (
                            <p className="text-[9px] text-neutral-400 mt-0.5">
                              {sec.coverage_covered}/{sec.coverage_total} topics
                            </p>
                          )}
                        </div>

                        {/* Students */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-neutral-400">Students</span>
                            <span className="text-[10px] font-bold text-neutral-600">{sec.total_students}</span>
                          </div>
                          <div className="w-full bg-neutral-200 rounded-full h-1.5" />
                          <p className="text-[9px] text-neutral-400 mt-0.5">enrolled</p>
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

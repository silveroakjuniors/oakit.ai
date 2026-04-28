'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import Link from 'next/link';

interface ClassFeeStat {
  class_id: string;
  class_name: string;
  total_students: number;
  students_assigned: number;
  students_unassigned: number;
  by_fee_type: Record<string, number>;
  has_primary_fee: boolean;
}

interface FeeSummary {
  academic_year: string | null;
  totals: {
    total_students: number;
    students_assigned: number;
    students_unassigned: number;
  };
  by_class: ClassFeeStat[];
}

export default function FeeSummaryCard({ token }: { token: string }) {
  const [data, setData] = useState<FeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    apiGet<FeeSummary>('/api/v1/admin/dashboard/fee-summary', token)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 animate-pulse h-28" />
    );
  }

  if (!data) return null;

  const { totals, by_class, academic_year } = data;
  const assignedPct =
    totals.total_students > 0
      ? Math.round((totals.students_assigned / totals.total_students) * 100)
      : 0;

  const classesWithoutFee = by_class.filter(c => !c.has_primary_fee);
  const allAssigned = totals.students_unassigned === 0 && classesWithoutFee.length === 0;

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <span className="text-base">₹</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-neutral-800">Fee Assignment</p>
              {academic_year && (
                <span className="text-[10px] text-neutral-400 font-medium">{academic_year}</span>
              )}
              {!allAssigned && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  Action needed
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {totals.students_assigned} of {totals.total_students} students assigned
            </p>
          </div>
        </div>

        {/* Progress pill */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 bg-neutral-100 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  allAssigned ? 'bg-emerald-500' : assignedPct > 50 ? 'bg-amber-400' : 'bg-red-400'
                }`}
                style={{ width: `${assignedPct}%` }}
              />
            </div>
            <span
              className={`text-[11px] font-bold ${
                allAssigned ? 'text-emerald-600' : assignedPct > 50 ? 'text-amber-600' : 'text-red-500'
              }`}
            >
              {assignedPct}%
            </span>
          </div>
          <svg
            className={`w-4 h-4 text-neutral-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Alert: classes without primary fee */}
      {classesWithoutFee.length > 0 && (
        <div className="mx-5 mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 flex items-start gap-2">
          <span className="text-red-500 text-sm shrink-0 mt-0.5">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-red-800">
              {classesWithoutFee.length} class{classesWithoutFee.length > 1 ? 'es' : ''} missing tuition fee
            </p>
            <p className="text-[11px] text-red-600 mt-0.5">
              {classesWithoutFee.map(c => c.class_name).join(', ')} — students cannot be onboarded until a fee is set up.
            </p>
          </div>
          <Link
            href="/admin/finance/fee-structures"
            className="text-[11px] font-bold text-red-700 hover:text-red-900 whitespace-nowrap shrink-0"
            onClick={e => e.stopPropagation()}
          >
            Fix →
          </Link>
        </div>
      )}

      {/* Expanded: per-class breakdown */}
      {expanded && (
        <div className="border-t border-neutral-100">
          {/* School-wide summary row */}
          <div className="px-5 py-3 bg-neutral-50 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
              All Classes
            </span>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="text-emerald-600 font-semibold">
                ✓ {totals.students_assigned} assigned
              </span>
              {totals.students_unassigned > 0 && (
                <span className="text-red-500 font-semibold">
                  ✗ {totals.students_unassigned} unassigned
                </span>
              )}
            </div>
          </div>

          {/* Per-class rows */}
          <div className="divide-y divide-neutral-100 max-h-72 overflow-y-auto">
            {by_class.map(cls => {
              const pct =
                cls.total_students > 0
                  ? Math.round((cls.students_assigned / cls.total_students) * 100)
                  : 0;
              const feeTypes = Object.entries(cls.by_fee_type || {});

              return (
                <div key={cls.class_id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] font-semibold text-neutral-700 truncate">
                        {cls.class_name}
                      </span>
                      {!cls.has_primary_fee && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium shrink-0">
                          No fee set
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 bg-neutral-100 rounded-full h-1">
                          <div
                            className={`h-1 rounded-full ${
                              pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-neutral-500 font-medium">
                          {cls.students_assigned}/{cls.total_students}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fee type breakdown */}
                  {feeTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {feeTypes.map(([type, count]) => (
                        <span
                          key={type}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-primary/8 text-primary font-medium capitalize"
                          style={{ background: 'rgba(27,67,50,0.07)' }}
                        >
                          {type}: {count}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Unassigned warning */}
                  {cls.students_unassigned > 0 && (
                    <p className="text-[10px] text-amber-600 mt-1.5">
                      {cls.students_unassigned} student{cls.students_unassigned > 1 ? 's' : ''} not yet assigned
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50">
            <Link
              href="/admin/finance/fee-structures"
              className="text-[12px] font-semibold text-primary hover:underline"
            >
              Manage fee structures →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

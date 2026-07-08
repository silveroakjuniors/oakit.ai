'use client';

import { Badge, EmptyState } from '@/UIComponents';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Instalment {
  instalment_number: number;
  label: string;
  amount: number;
  due_date: string;
  status?: 'paid' | 'pending' | 'overdue';
}

interface InstalmentScheduleProps {
  instalments: Instalment[];
  feeHeadName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral';

function statusBadgeVariant(status?: Instalment['status']): StatusVariant {
  switch (status) {
    case 'paid':
      return 'success';
    case 'pending':
      return 'warning';
    case 'overdue':
      return 'danger';
    default:
      return 'neutral';
  }
}

function statusLabel(status?: Instalment['status']): string {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'pending':
      return 'Pending';
    case 'overdue':
      return 'Overdue';
    default:
      return 'Unknown';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InstalmentSchedule({ instalments, feeHeadName }: InstalmentScheduleProps) {
  if (instalments.length === 0) {
    return (
      <EmptyState
        title="No instalments"
        description={
          feeHeadName
            ? `No instalment schedule has been set up for ${feeHeadName}.`
            : 'No instalment schedule has been set up yet.'
        }
      />
    );
  }

  const sorted = [...instalments].sort((a, b) => a.instalment_number - b.instalment_number);

  return (
    <div className="w-full">
      {feeHeadName && (
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-4">
          {feeHeadName}
        </p>
      )}

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-neutral-200" aria-hidden="true" />

        <ol className="space-y-0">
          {sorted.map((ins, idx) => {
            const isLast = idx === sorted.length - 1;
            const variant = statusBadgeVariant(ins.status);

            // Dot color based on status
            const dotClass =
              ins.status === 'paid'
                ? 'bg-emerald-500 border-emerald-200'
                : ins.status === 'overdue'
                ? 'bg-red-500 border-red-200'
                : ins.status === 'pending'
                ? 'bg-[#E8960C] border-amber-200'
                : 'bg-neutral-300 border-neutral-200';

            return (
              <li key={ins.instalment_number} className={`relative flex gap-4 ${isLast ? '' : 'pb-5'}`}>
                {/* Timeline dot */}
                <div
                  className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white ${dotClass}`}
                  aria-label={`Instalment ${ins.instalment_number}`}
                >
                  {ins.instalment_number}
                </div>

                {/* Content card */}
                <div className="flex-1 min-w-0 bg-white border border-neutral-100 rounded-xl px-4 py-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-800 truncate">{ins.label}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">Due: {formatDate(ins.due_date)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-[#1B4332]">{formatAmount(ins.amount)}</span>
                      {ins.status && (
                        <Badge
                          label={statusLabel(ins.status)}
                          variant={variant}
                          size="sm"
                          dot
                        />
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export default InstalmentSchedule;

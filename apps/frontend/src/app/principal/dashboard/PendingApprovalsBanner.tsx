'use client';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { PendingApprovals } from './types';

interface Props {
  pending: PendingApprovals;
}

export default function PendingApprovalsBanner({ pending }: Props) {
  const total = pending.concessions + pending.overrides + pending.cancellations;
  if (total === 0) return null;

  const items = [
    pending.concessions > 0 && {
      href: '/principal/finance/concessions',
      emoji: '🎁',
      label: 'Fee Concessions',
      sub: `${pending.concessions} request${pending.concessions !== 1 ? 's' : ''} awaiting approval`,
      count: pending.concessions,
    },
    pending.overrides > 0 && {
      href: '/principal/finance/overrides',
      emoji: '🔑',
      label: 'Duplicate Reference Overrides',
      sub: `${pending.overrides} payment${pending.overrides !== 1 ? 's' : ''} with duplicate ref`,
      count: pending.overrides,
    },
    pending.cancellations > 0 && {
      href: '/principal/finance/cancellations',
      emoji: '🗑️',
      label: 'Receipt Cancellations',
      sub: `${pending.cancellations} receipt${pending.cancellations !== 1 ? 's' : ''} requested for cancellation`,
      count: pending.cancellations,
    },
  ].filter(Boolean) as { href: string; emoji: string; label: string; sub: string; count: number }[];

  return (
    <div className="rounded-2xl overflow-hidden border-2 border-red-200 shadow-sm">
      <div className="bg-gradient-to-r from-red-600 to-rose-500 px-4 py-2.5 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-white shrink-0" />
        <p className="text-white text-sm font-bold">
          {total} Finance Approval{total !== 1 ? 's' : ''} Needed
        </p>
      </div>
      <div className="bg-red-50 divide-y divide-red-100">
        {items.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between px-4 py-3 hover:bg-red-100/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{item.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-red-800">{item.label}</p>
                <p className="text-xs text-red-500">{item.sub}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {item.count}
              </span>
              <span className="text-red-400 text-lg">›</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

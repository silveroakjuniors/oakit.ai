/**
 * Student Module - Homework Tab Component
 * Displays homework history and status
 */

import React, { useMemo } from 'react';
import { Loader2, RefreshCw, BookOpen } from 'lucide-react';
import { HomeworkRecord, HomeworkStatus } from '../../types';
import { formatDate } from '../../utils';

interface HomeworkTabProps {
  records: HomeworkRecord[];
  loading: boolean;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<HomeworkStatus, { label: string; color: string; icon: string }> = {
  completed: {
    label: 'Completed',
    color: 'bg-emerald-100 text-emerald-700',
    icon: '✓',
  },
  partial: {
    label: 'Partial',
    color: 'bg-amber-100 text-amber-700',
    icon: '~',
  },
  not_submitted: {
    label: 'Not Submitted',
    color: 'bg-red-100 text-red-600',
    icon: '✗',
  },
};

/**
 * Pure component for homework history display
 */
export const HomeworkTab = React.memo<HomeworkTabProps>(
  ({ records, loading, onRefresh }) => {
    const isEmpty = !loading && records.length === 0;
    const hasRecords = !loading && records.length > 0;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-800">Homework History</h2>
          <button
            onClick={onRefresh}
            className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors"
            aria-label="Refresh homework list"
          >
            <RefreshCw size={14} className="text-neutral-500" />
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-7 h-7 text-neutral-300 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="bg-neutral-50 rounded-2xl p-8 text-center border border-neutral-100">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-neutral-500 text-sm">
              No homework records for the last 30 days.
            </p>
          </div>
        )}

        {/* Records list */}
        {hasRecords && (
          <div className="space-y-2">
            {records.map((record, idx) => (
              <HomeworkRecordItem key={idx} record={record} />
            ))}
          </div>
        )}
      </div>
    );
  }
);

HomeworkTab.displayName = 'HomeworkTab';

/**
 * Individual homework record item
 */
interface HomeworkRecordItemProps {
  record: HomeworkRecord;
}

const HomeworkRecordItem = React.memo<HomeworkRecordItemProps>(({ record }) => {
  const cfg = STATUS_CONFIG[record.status];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 px-4 py-3 flex items-start gap-3">
      {/* Status icon */}
      <div
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${cfg.color}`}
      >
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Date and status badge */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-xs text-neutral-400">{formatDate(record.homework_date)}</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        {/* Homework text */}
        {record.homework_text && (
          <p className="text-sm text-neutral-700 leading-relaxed">{record.homework_text}</p>
        )}

        {/* Teacher note */}
        {record.teacher_note && (
          <p className="text-xs text-neutral-400 mt-1 italic">
            Note: {record.teacher_note}
          </p>
        )}
      </div>
    </div>
  );
});

HomeworkRecordItem.displayName = 'HomeworkRecordItem';

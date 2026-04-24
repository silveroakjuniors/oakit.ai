'use client';
import { FileText, Music, X } from 'lucide-react';

interface Chunk { id: string; topic_label: string; content: string; }
interface SupplementaryActivity { plan_id: string; pool_name: string; activity_title: string; activity_description?: string; }

interface RawPlanModalProps {
  open: boolean;
  onClose: () => void;
  dateLabel: string;
  chunks: Chunk[];
  supplementaryActivities?: SupplementaryActivity[];
  onExportPdf: () => void;
  exporting?: boolean;
}

/**
 * Modal showing today's raw plan from the curriculum database.
 * Shows full chunk content + supplementary activities + PDF export.
 */
export function RawPlanModal({
  open, onClose, dateLabel, chunks, supplementaryActivities = [], onExportPdf, exporting = false,
}: RawPlanModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Today's Plan</h2>
            <p className="text-xs text-neutral-500 mt-0.5">{dateLabel} · from curriculum</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-80 overflow-y-auto flex flex-col gap-2">
          {chunks.length > 0 ? chunks.map((chunk, i) => (
            <div key={chunk.id} className="px-3 py-2.5 bg-neutral-50 rounded-xl border border-neutral-100">
              <p className="text-sm font-semibold text-neutral-800 mb-1">{chunk.topic_label || `Topic ${i + 1}`}</p>
              {chunk.content && (
                <p className="text-xs text-neutral-500 leading-relaxed whitespace-pre-wrap">{chunk.content}</p>
              )}
            </div>
          )) : (
            <p className="text-sm text-neutral-400 text-center py-4">No plan for today</p>
          )}
          {supplementaryActivities.map(sa => (
            <div key={sa.plan_id} className="px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-xs text-amber-700 font-semibold mb-0.5 flex items-center gap-1"><Music className="w-3 h-3" /> {sa.pool_name}</p>
              <p className="text-sm font-medium text-neutral-800">{sa.activity_title}</p>
              {sa.activity_description && <p className="text-xs text-neutral-500 mt-0.5">{sa.activity_description}</p>}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2 border-t border-neutral-100">
          <button
            onClick={onExportPdf}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {exporting ? 'Downloading…' : '↓ Download as PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RawPlanModal;

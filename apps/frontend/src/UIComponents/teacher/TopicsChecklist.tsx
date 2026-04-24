'use client';
import { BookOpen, Check, CheckCircle2, ChevronDown, Clock, FileText, Pencil, Play, FileEdit } from 'lucide-react';
import { Button } from '@/UIComponents/primitives/Button';

interface Activity { chunkId: string; label: string; subjectKey: string; }

interface TopicsChecklistProps {
  activities: Activity[];
  selectedChunks: string[];
  onToggle: (key: string) => void;
  onSelectAll: () => void;
  onSubmit: () => void;
  onAsk: (label: string) => void;
  onPlayVideo?: (label: string) => void;
  onExportPdf: () => void;
  onHomework?: (chunkId: string, label: string) => void;
  homeworkSentChunks?: Set<string>;
  submitting?: boolean;
  exporting?: boolean;
  completionMsg?: string;
  open: boolean;
  onToggleOpen: () => void;
  chunkLabelOverrides?: Record<string, string>;
  completed?: boolean;
}

/**
 * Collapsible checklist of today's topics.
 * Same style as Homework & Notes panel.
 */
export function TopicsChecklist({
  activities, selectedChunks, onToggle, onSelectAll, onSubmit, onAsk, onPlayVideo, onExportPdf,
  onHomework, homeworkSentChunks = new Set(),
  submitting = false, exporting = false, completionMsg, open, onToggleOpen, chunkLabelOverrides = {},
  completed = false,
}: TopicsChecklistProps) {
  const allKeys = activities.map(a => a.subjectKey);
  const checkedCount = completed ? allKeys.length : allKeys.filter(k => selectedChunks.includes(k)).length;
  const uncheckedCount = completed ? 0 : allKeys.length - checkedCount;
  const allChecked = completed || (allKeys.length > 0 && checkedCount === allKeys.length);

  return (
    <div className="border border-neutral-200 rounded-2xl overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={onToggleOpen}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-neutral-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-primary-500" />
          <span className="text-sm font-semibold text-neutral-800">Today's Topics</span>
          {completed ? (
              <span className="text-xs font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Check className="w-3 h-3" /> All done
            </span>
          ) : checkedCount > 0 && (
            <span className="text-xs font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              {checkedCount}/{activities.length} done
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Mark All row — hidden when completed */}
          {!completed && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 border-t border-neutral-100 border-b border-neutral-100">
            <span className="text-xs text-neutral-500">{activities.length} topic{activities.length !== 1 ? 's' : ''} today</span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-neutral-500 font-medium">Mark all</span>
              <div
                onClick={onSelectAll}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                  allChecked ? 'bg-emerald-500 border-emerald-500' : 'border-neutral-300 hover:border-emerald-400'
                }`}
              >
                {allChecked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
            </label>
          </div>
          )}

          {/* Topic rows */}
          {activities.map(act => {
            const checked = completed || selectedChunks.includes(act.subjectKey);
            return (
              <div key={act.subjectKey}
                className={`flex items-center gap-3 px-4 py-3 border-b border-neutral-50 last:border-0 transition-colors ${
                  checked ? 'bg-emerald-50/60' : 'bg-white hover:bg-neutral-50'
                }`}>
                {/* Done icon when completed */}
                {completed && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                {/* Mark done checkbox — only shown when not completed */}
                {!completed && (
                  <div
                    onClick={() => onToggle(act.subjectKey)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      checked ? 'bg-emerald-500 border-emerald-500' : 'border-neutral-300 hover:border-emerald-400'
                    }`}
                  >
                    {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                )}
                <span
                  onClick={() => !completed && onToggle(act.subjectKey)}
                  className={`text-sm flex-1 ${completed ? 'text-emerald-700 cursor-default' : checked ? 'text-emerald-700 line-through opacity-60 cursor-pointer' : 'text-neutral-800 cursor-pointer'} transition-all`}
                >
                  {act.label}
                  {chunkLabelOverrides[act.chunkId] && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 font-medium ml-1"><Pencil className="w-2.5 h-2.5" /> Updated</span>
                  )}
                </span>
                {/* Play Video button — always shown */}
                {onPlayVideo && (
                  <button
                    type="button"
                    onClick={() => onPlayVideo(act.label)}
                    title="Play video for this topic"
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Play className="w-3 h-3 fill-red-500" />
                    Video
                  </button>
                )}
                {/* Homework button */}
                {onHomework && (
                  <button
                    type="button"
                    onClick={() => onHomework(act.chunkId, act.label)}
                    className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      homeworkSentChunks.has(act.chunkId)
                        ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                        : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                    }`}
                    title={homeworkSentChunks.has(act.chunkId) ? 'View / Edit Homework' : 'Generate Homework'}
                  >
                    {homeworkSentChunks.has(act.chunkId)
                      ? <><Check className="w-3 h-3" /> HW</>
                      : <><FileEdit className="w-3 h-3" /> HW</>
                    }
                  </button>
                )}
                {/* Ask Oakie button — always shown */}
                <button
                  type="button"
                  onClick={() => onAsk(act.label)}
                  className="text-xs text-primary-500 hover:text-primary-700 px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors shrink-0"
                >
                  Ask
                </button>
              </div>
            );
          })}

          {/* Footer */}
          <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-100">
            {completed ? (
              <p className="text-xs text-emerald-600 text-center font-medium flex items-center justify-center gap-1">
                <Check className="w-3.5 h-3.5" /> All topics completed today · Tap "Ask" to ask Oakie about any topic
              </p>
            ) : checkedCount === 0 ? (
              <p className="text-xs text-neutral-400 text-center">Tick topics as you complete them today</p>
            ) : (
              <div className="flex flex-col gap-2">
                {uncheckedCount > 0 && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      <strong>{uncheckedCount} topic{uncheckedCount > 1 ? 's' : ''}</strong> not ticked will move to <strong>tomorrow's plan</strong>.
                    </p>
                  </div>
                )}
                {completionMsg && (
                  <p className={`text-xs text-center font-medium ${completionMsg.startsWith('✅') || completionMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>
                    {completionMsg}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={onSubmit}
                    loading={submitting}
                    variant={allChecked ? 'success' : 'primary'}
                    fullWidth
                  >
                    {allChecked
                      ? <><Check className="w-3.5 h-3.5" /> Mark All as Done — Parents Notified</>
                      : <><Check className="w-3.5 h-3.5" /> Submit — {checkedCount} done, {uncheckedCount} carry forward</>
                    }
                  </Button>
                  <button
                    onClick={onExportPdf}
                    disabled={exporting}
                    className="flex items-center justify-center gap-1 px-3 py-2 border border-neutral-200 rounded-xl text-xs text-neutral-500 hover:bg-neutral-50 transition-colors disabled:opacity-50 shrink-0"
                    title="Download today's plan as PDF"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default TopicsChecklist;

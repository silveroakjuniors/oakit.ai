'use client';

interface Chunk { id: string; topic_label: string; content?: string; }
interface PendingDay {
  plan_date: string;
  chunks: Chunk[];
  is_special_day?: boolean;
  special_day_label?: string;
  special_day_type?: string;
}

interface PendingWorkListProps {
  items: PendingDay[];
  selectedChunks: string[];
  onToggleChunk: (chunkId: string) => void;
  onMarkSpecialDayComplete?: (planDate: string) => void;
}

export default function PendingWorkList({ items, selectedChunks, onToggleChunk, onMarkSpecialDayComplete }: PendingWorkListProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {items.map(day => (
        <div key={day.plan_date}
          className={`rounded-2xl p-4 border ${day.is_special_day ? 'bg-purple-50/80 border-purple-200/60' : 'bg-amber-50/80 border-amber-200/60'}`}>
          <p className={`text-xs font-semibold mb-3 flex items-center gap-1.5 ${day.is_special_day ? 'text-purple-700' : 'text-amber-700'}`}>
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${day.is_special_day ? 'bg-purple-500' : 'bg-amber-500'}`} />
            {new Date((day.plan_date || '').split('T')[0] + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            {day.is_special_day && day.special_day_label && (
              <span className="ml-1 text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                🎉 {day.special_day_label}
              </span>
            )}
          </p>

          {day.is_special_day ? (
            <div className="flex items-center justify-between">
              <p className="text-xs text-purple-600">
                {day.special_day_label || 'Special Day'} — mark as completed
              </p>
              {onMarkSpecialDayComplete && (
                <button
                  onClick={() => onMarkSpecialDayComplete(day.plan_date)}
                  className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
                >
                  ✓ Done
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {day.chunks.map(chunk => (
                <label key={chunk.id}
                  className="flex items-start gap-3 cursor-pointer group">
                  <div className={`
                    mt-0.5 w-4 h-4 rounded-md border-2 shrink-0 flex items-center justify-center
                    transition-all duration-150
                    ${selectedChunks.includes(chunk.id)
                      ? 'bg-primary-600 border-primary-600'
                      : 'border-amber-300 group-hover:border-amber-500'
                    }
                  `}>
                    {selectedChunks.includes(chunk.id) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    <input
                      type="checkbox"
                      checked={selectedChunks.includes(chunk.id)}
                      onChange={() => onToggleChunk(chunk.id)}
                      className="sr-only"
                    />
                  </div>
                  <span className="text-xs text-neutral-700 leading-relaxed">{chunk.topic_label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

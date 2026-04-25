'use client';

interface Chunk { id: string; topic_label: string; content?: string; }
interface PendingDay { plan_date: string; chunks: Chunk[]; }

interface PendingWorkListProps {
  items: PendingDay[];
  selectedChunks: string[];
  onToggleChunk: (chunkId: string) => void;
}

export default function PendingWorkList({ items, selectedChunks, onToggleChunk }: PendingWorkListProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {items.map(day => (
        <div key={day.plan_date}
          className="bg-amber-50/80 rounded-2xl p-4 border border-amber-200/60">
          <p className="text-xs font-semibold text-amber-700 mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
            {new Date((day.plan_date || '').split('T')[0] + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
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
        </div>
      ))}
    </div>
  );
}

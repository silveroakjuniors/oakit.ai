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
      <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Pending Work</h3>
      {items.map(day => (
        <div key={day.plan_date} className="bg-amber-50 rounded-lg p-3 border border-amber-100">
          <p className="text-xs font-medium text-amber-800 mb-2">
            {new Date(day.plan_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
          {day.chunks.map(chunk => (
            <label key={chunk.id} className="flex items-start gap-2 cursor-pointer mb-1">
              <input
                type="checkbox"
                checked={selectedChunks.includes(chunk.id)}
                onChange={() => onToggleChunk(chunk.id)}
                className="mt-0.5 accent-primary"
              />
              <span className="text-xs text-gray-700">{chunk.topic_label}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

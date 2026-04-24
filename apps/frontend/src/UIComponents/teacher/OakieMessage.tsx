'use client';
import { FileText, Play, Sparkles } from 'lucide-react';

interface OakieMessageProps {
  text: string;
  onExportPdf?: () => void;
  exporting?: boolean;
  isSettling?: boolean;
  settlingDay?: number;
  settlingTotal?: number;
  children?: React.ReactNode;
}

/**
 * Renders a single Oakie (assistant) message bubble with:
 * - "OAKIE SAYS" label + PDF download button in the header
 * - Formatted message content via OakieMessageText
 * - Optional settling day badge
 * - Optional children (completion buttons, etc.)
 */
export function OakieMessage({
  text,
  onExportPdf,
  exporting = false,
  isSettling,
  settlingDay,
  settlingTotal,
  children,
}: OakieMessageProps) {
  return (
    <div className="bg-white border border-neutral-200/60 text-neutral-800 rounded-2xl rounded-bl-sm overflow-hidden shadow-sm max-w-[88%]">
      {/* Header: Oakie says + PDF */}
      <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-primary-400" />
          <span className="text-[10px] font-semibold text-primary-500 uppercase tracking-wide">Oakie says</span>
        </div>
        {onExportPdf && (
          <button
            onClick={onExportPdf}
            disabled={exporting}
            className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-primary-600 transition-colors disabled:opacity-50"
          >
            <FileText className="w-3 h-3" />
            PDF
          </button>
        )}
      </div>

      {/* Settling badge */}
      {isSettling && settlingDay && (
        <div className="px-4 pb-1">
          <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
            🌱 Settling Day {settlingDay} of {settlingTotal}
          </span>
        </div>
      )}

      {/* Message content */}
      <div className="px-4 py-3">
        <OakieMessageText text={text} />
      </div>

      {/* Optional action area (completion buttons, etc.) */}
      {children}
    </div>
  );
}

/**
 * Renders Oakie's formatted text response.
 * Handles: emoji headings, bullet points, numbered lists,
 * key-value labels, bold text, break markers, warning banners.
 */
export function OakieMessageText({ text, onVideoHelp }: { text: string; onVideoHelp?: (topic: string) => void }) {
  const lines = text.split('\n');

  // Pre-scan: build a map of heading index → topic line that follows it
  // so Video button can pass a richer search query
  const topicAfterHeading: Record<number, string> = {};
  for (let idx = 0; idx < lines.length; idx++) {
    const t = lines[idx].trim();
    const emojiMatch = t.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*(.+)/u);
    if (emojiMatch) {
      // Look ahead for a "Topic:" line within the next 4 lines
      for (let j = idx + 1; j < Math.min(idx + 5, lines.length); j++) {
        const next = lines[j].trim();
        const topicMatch = next.match(/^Topic:\s*(.+)/i);
        if (topicMatch) { topicAfterHeading[idx] = topicMatch[1].trim(); break; }
      }
    }
  }

  return (
    <div className="flex flex-col gap-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        // Emoji heading (not 💡 or ☕ or warning)
        const emojiHeadingMatch = trimmed.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*(.+)/u);
        const isHeading = emojiHeadingMatch &&
          !trimmed.startsWith('💡') && !trimmed.startsWith('☕') &&
          !trimmed.startsWith('⚠') && !trimmed.startsWith('🚨');

        if (isHeading) {
          const emoji = emojiHeadingMatch[1];
          const label = emojiHeadingMatch[2].trim();
          // Don't show Video button on non-subject headings
          const isNonSubject = /planner|week\s*\d|day\s*\d|section\s+[a-z]|objective|offline\s+support|teacher\s+note|resources?:|materials?:|tip:|note:/i.test(label);
          // Build a richer search query: "SubjectName TopicName"
          const subTopic = topicAfterHeading[i];
          const videoQuery = subTopic ? `${label} ${subTopic}` : label;
          return (
            <div key={i} className="flex items-center gap-2 mt-3 first:mt-0 rounded-xl px-3 py-2.5 bg-primary-50/60 border border-primary-100">
              <span className="text-base shrink-0">{emoji}</span>
              <span className="font-semibold text-primary-700 text-sm flex-1">{label}</span>
              {onVideoHelp && !isNonSubject && (
                <button
                  type="button"
                  onClick={() => onVideoHelp(videoQuery)}
                  title="Play video for this topic"
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Play className="w-3 h-3 fill-red-500" />
                  Video
                </button>
              )}
            </div>
          );
        }

        if (trimmed.startsWith('💡')) {
          return (
            <div key={i} className="flex items-start gap-2 mt-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <span className="text-base shrink-0">💡</span>
              <span className="text-xs text-amber-800">{trimmed.replace(/^💡\s*/, '')}</span>
            </div>
          );
        }
        if (trimmed.startsWith('☕')) {
          return (
            <div key={i} className="flex items-center gap-2 my-1">
              <div className="flex-1 h-px bg-neutral-100" />
              <span className="text-xs text-neutral-400">☕ Break</span>
              <div className="flex-1 h-px bg-neutral-100" />
            </div>
          );
        }
        if (trimmed.startsWith('⚠️') || trimmed.startsWith('🚨')) {
          return (
            <div key={i} className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <span className="text-base shrink-0">{trimmed[0]}</span>
              <span className="text-xs text-red-700 font-medium">{trimmed.replace(/^[⚠️🚨]\s*/u, '')}</span>
            </div>
          );
        }

        const labelMatch = trimmed.match(/^(What to do|Ask children|Tip|Objective|Materials|Note|✅ Offline Support|Resources):\s*(.*)/i);
        if (labelMatch) {
          return (
            <div key={i} className="flex items-start gap-1.5 pl-3">
              <span className="text-xs font-semibold text-neutral-500 shrink-0 mt-0.5 min-w-[90px]">{labelMatch[1]}:</span>
              <span className="text-xs text-neutral-700">{labelMatch[2]}</span>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={i} className="flex items-start gap-2 pl-3">
              <span className="text-xs font-bold text-primary-400 shrink-0 w-4 mt-0.5">{numMatch[1]}.</span>
              <span className="text-xs text-neutral-700">{numMatch[2]}</span>
            </div>
          );
        }

        if (trimmed.startsWith('·') || trimmed.startsWith('•') || trimmed.startsWith('- ')) {
          return (
            <div key={i} className="flex items-start gap-2 pl-3">
              <span className="text-primary-300 shrink-0 mt-0.5 text-xs">•</span>
              <span className="text-xs text-neutral-700">{trimmed.replace(/^[·•\-]\s*/, '')}</span>
            </div>
          );
        }

        if (trimmed.startsWith('---')) return <hr key={i} className="border-neutral-100 my-1" />;

        // Render lines containing URLs (YouTube links etc.) as clickable
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        if (urlRegex.test(trimmed)) {
          const urlParts = trimmed.split(/(https?:\/\/[^\s]+)/g);
          return (
            <p key={i} className="text-xs text-neutral-700 break-all">
              {urlParts.map((part, j) =>
                part.match(/^https?:\/\//) ? (
                  <a key={j} href={part} target="_blank" rel="noopener noreferrer"
                    className="text-primary-600 underline break-all">
                    {part.includes('youtube.com') ? '▶ Open YouTube Search' : part}
                  </a>
                ) : <span key={j}>{part}</span>
              )}
            </p>
          );
        }

        const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
        if (parts.some(p => p.startsWith('**'))) {
          return (
            <p key={i} className="text-xs text-neutral-700">
              {parts.map((p, j) => p.startsWith('**') && p.endsWith('**')
                ? <strong key={j} className="font-semibold text-neutral-800">{p.slice(2, -2)}</strong>
                : <span key={j}>{p}</span>)}
            </p>
          );
        }

        return <p key={i} className="text-xs text-neutral-700">{trimmed}</p>;
      })}
    </div>
  );
}

export default OakieMessage;

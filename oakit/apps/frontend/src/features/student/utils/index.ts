/**
 * Student Module - Utility Functions
 * Pure, testable functions for date manipulation and formatting
 */

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Add days to a date string (ISO format)
 */
export function addDays(dateStr: string, n: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + n);
  return date.toISOString().split('T')[0];
}

/**
 * Format ISO date to localized format
 * @example formatDate('2024-04-14') => '14 Apr 2024'
 */
export function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Get human-readable day label
 * @example getDayLabel('2024-04-14') => 'Today' | 'Yesterday' | 'Sun, 14 Apr'
 */
export function getDayLabel(iso: string): string {
  const today = getTodayISO();
  const yesterday = addDays(today, -1);

  if (iso === today) return 'Today';
  if (iso === yesterday) return 'Yesterday';

  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format seconds to MM:SS format
 * @example formatTimer(125) => '02:05'
 */
export function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Calculate quiz percentage score
 */
export function calculateScorePct(scored: number, total: number): number {
  return total > 0 ? Math.round((scored / total) * 100) : 0;
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Validate date range
 */
export function isValidDateRange(from: string, to: string): boolean {
  return from.length > 0 && to.length > 0 && from <= to && to <= getTodayISO();
}

/**
 * Get timer color based on remaining time
 */
export function getTimerColor(seconds: number): 'text-red-600' | 'text-neutral-700' {
  return seconds < 120 ? 'text-red-600' : 'text-neutral-700';
}

/**
 * Group topics by subject
 */
export function groupTopicsBySubject<T extends { subject: string }>(
  topics: T[]
): Record<string, T[]> {
  return topics.reduce(
    (acc, topic) => {
      if (!acc[topic.subject]) {
        acc[topic.subject] = [];
      }
      acc[topic.subject].push(topic);
      return acc;
    },
    {} as Record<string, T[]>
  );
}

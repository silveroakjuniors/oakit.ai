/**
 * Student Module - Today Tab Component
 * Displays daily topics and homework
 */

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Loader2, BookOpen } from 'lucide-react';
import { FeedDay, TopicCard } from '../../types';
import { formatDate, getDayLabel, addDays, getTodayISO, groupTopicsBySubject } from '../../utils';

interface TodayTabProps {
  feedDate: string;
  feed: FeedDay | null;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  maxDate: string;
}

/**
 * Pure component for displaying daily feed
 */
export const TodayTab = React.memo<TodayTabProps>(
  ({ feedDate, feed, loading, onPrev, onNext, maxDate }) => {
    const today = getTodayISO();
    const isToday = feedDate === today;
    const isFuture = feedDate > today;
    const atMax = feedDate >= maxDate;

    // Memoize topic grouping to avoid re-renders
    const topicsBySubject = useMemo(
      () => groupTopicsBySubject(feed?.topics ?? []),
      [feed?.topics]
    );

    return (
      <div className="space-y-4">
        {/* Date navigator */}
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-neutral-100">
          <button
            onClick={onPrev}
            className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors"
            aria-label="Previous day"
          >
            <ChevronLeft size={18} className="text-neutral-600" />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-neutral-800">{getDayLabel(feedDate)}</p>
            <p className="text-xs text-neutral-400">{formatDate(feedDate)}</p>
          </div>
          <button
            onClick={onNext}
            disabled={atMax}
            className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors disabled:opacity-30"
            aria-label="Next day"
          >
            <ChevronRight size={18} className="text-neutral-600" />
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-7 h-7 text-neutral-300 animate-spin" />
          </div>
        )}

        {/* Future date warning */}
        {!loading && isFuture && feedDate > addDays(today, 5) && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-center">
            <p className="text-amber-700 text-sm font-medium">
              Topics for this date are not yet available.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !isFuture && feed?.topics.length === 0 && (
          <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-8 text-center">
            <p className="text-3xl mb-2">📚</p>
            <p className="text-neutral-500 text-sm">Nothing was covered on this date.</p>
          </div>
        )}

        {/* Topics by subject */}
        {!loading && Object.keys(topicsBySubject).length > 0 && (
          <div className="space-y-3">
            {Object.entries(topicsBySubject).map(([subject, topics]) => (
              <TopicSection key={subject} subject={subject} topics={topics} />
            ))}
          </div>
        )}

        {/* Homework card */}
        {!loading && feed?.homework && (
          <HomeworkCard homework={feed.homework} />
        )}

        {/* No homework message */}
        {!loading &&
          !feed?.homework &&
          feed?.topics &&
          feed.topics.length > 0 && (
            <div className="bg-neutral-50 rounded-2xl px-4 py-3 border border-neutral-100">
              <p className="text-xs text-neutral-400 text-center">
                No homework for this date.
              </p>
            </div>
          )}
      </div>
    );
  }
);

TodayTab.displayName = 'TodayTab';

/**
 * Memoized topic section component
 */
interface TopicSectionProps {
  subject: string;
  topics: TopicCard[];
}

const TopicSection = React.memo<TopicSectionProps>(({ subject, topics }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
    <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100">
      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
        {subject}
      </p>
    </div>
    <div className="divide-y divide-neutral-50">
      {topics.map((topic) => (
        <TopicItem key={topic.chunk_id} topic={topic} />
      ))}
    </div>
  </div>
));

TopicSection.displayName = 'TopicSection';

/**
 * Individual topic item
 */
interface TopicItemProps {
  topic: TopicCard;
}

const TopicItem = React.memo<TopicItemProps>(({ topic }) => (
  <div className="px-4 py-3">
    <p className="text-sm font-semibold text-neutral-800">{topic.topic_name}</p>
    {topic.notes && (
      <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{topic.notes}</p>
    )}
  </div>
));

TopicItem.displayName = 'TopicItem';

/**
 * Homework card component
 */
interface HomeworkCardProps {
  homework: { formatted_text: string; raw_text: string };
}

const HomeworkCard = React.memo<HomeworkCardProps>(({ homework }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
    <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
      <BookOpen size={14} className="text-blue-600" />
      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">
        Homework
      </p>
    </div>
    <div className="px-4 py-3">
      <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
        {homework.formatted_text}
      </p>
    </div>
  </div>
));

HomeworkCard.displayName = 'HomeworkCard';

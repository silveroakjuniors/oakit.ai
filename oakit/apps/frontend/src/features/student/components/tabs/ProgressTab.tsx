/**
 * Student Module - Progress Tab Component
 * Student performance analytics and progress tracking
 */

import React from 'react';
import { Loader2, RefreshCw, BarChart2 } from 'lucide-react';
import { ProgressStats } from '../../types';
import { formatDate, calculateScorePct } from '../../utils';

interface ProgressTabProps {
  data: ProgressStats | null;
  loading: boolean;
  onRefresh: () => void;
}

/**
 * Pure component for progress display
 */
export const ProgressTab = React.memo<ProgressTabProps>(
  ({ data, loading, onRefresh }) => {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-800">My Progress</h2>
          <button
            onClick={onRefresh}
            className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors"
            aria-label="Refresh progress"
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
        {!loading && !data && (
          <div className="bg-neutral-50 rounded-2xl p-8 text-center border border-neutral-100">
            <p className="text-3xl mb-2">🏆</p>
            <p className="text-neutral-500 text-sm">
              Complete at least one quiz to see your progress.
            </p>
          </div>
        )}

        {/* Progress content */}
        {!loading && data && (
          <>
            <ProgressSummary data={data} />
            {data.subject_breakdown.length > 0 && <SubjectBreakdown data={data} />}
            {data.weak_areas.length > 0 && <WeakAreasSection data={data} />}
            {data.recent_quizzes.length > 0 && <RecentQuizzesSection data={data} />}
          </>
        )}
      </div>
    );
  }
);

ProgressTab.displayName = 'ProgressTab';

/**
 * Summary statistics component
 */
interface ProgressSummaryProps {
  data: ProgressStats;
}

const ProgressSummary = React.memo<ProgressSummaryProps>(({ data }) => (
  <div className="grid grid-cols-2 gap-3">
    {/* Total quizzes card */}
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4 text-center">
      <p className="text-xs text-neutral-400 mb-1">Total Quizzes</p>
      <p className="text-3xl font-black text-neutral-800">{data.total_quizzes}</p>
    </div>

    {/* Average score card */}
    <div
      className={`rounded-2xl shadow-sm border p-4 text-center ${
        data.average_score_pct >= 50
          ? 'bg-emerald-50 border-emerald-100'
          : 'bg-red-50 border-red-100'
      }`}
    >
      <p className="text-xs text-neutral-400 mb-1">Average Score</p>
      <p
        className={`text-3xl font-black ${
          data.average_score_pct >= 50 ? 'text-emerald-700' : 'text-red-600'
        }`}
      >
        {data.average_score_pct}%
      </p>
    </div>
  </div>
));

ProgressSummary.displayName = 'ProgressSummary';

/**
 * Subject breakdown component
 */
interface SubjectBreakdownProps {
  data: ProgressStats;
}

const SubjectBreakdown = React.memo<SubjectBreakdownProps>(({ data }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
    <div className="px-4 py-3 border-b border-neutral-50 flex items-center gap-2">
      <BarChart2 size={14} className="text-neutral-400" />
      <p className="text-xs font-bold text-neutral-600 uppercase tracking-wide">
        Subject Breakdown
      </p>
    </div>
    <div className="divide-y divide-neutral-50">
      {data.subject_breakdown.map((subject, idx) => (
        <SubjectBreakdownItem key={idx} subject={subject} />
      ))}
    </div>
  </div>
));

SubjectBreakdown.displayName = 'SubjectBreakdown';

/**
 * Individual subject breakdown item
 */
interface SubjectBreakdownItemProps {
  subject: { subject: string; avg_pct: number; quiz_count: number };
}

const SubjectBreakdownItem = React.memo<SubjectBreakdownItemProps>(({ subject }) => (
  <div className="px-4 py-3">
    <div className="flex items-center justify-between mb-1.5">
      <p className="text-sm font-semibold text-neutral-800">{subject.subject}</p>
      <span
        className={`text-xs font-bold ${
          subject.avg_pct >= 50 ? 'text-emerald-600' : 'text-red-500'
        }`}
      >
        {subject.avg_pct}%
      </span>
    </div>
    <div className="w-full bg-neutral-100 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all ${
          subject.avg_pct >= 50 ? 'bg-emerald-500' : 'bg-red-400'
        }`}
        style={{ width: `${subject.avg_pct}%` }}
      />
    </div>
    <p className="text-[10px] text-neutral-400 mt-1">
      {subject.quiz_count} quiz{subject.quiz_count !== 1 ? 'zes' : ''}
    </p>
  </div>
));

SubjectBreakdownItem.displayName = 'SubjectBreakdownItem';

/**
 * Weak areas section
 */
interface WeakAreasSectionProps {
  data: ProgressStats;
}

const WeakAreasSection = React.memo<WeakAreasSectionProps>(({ data }) => (
  <div className="bg-amber-50 border border-amber-100 rounded-2xl overflow-hidden">
    <div className="px-4 py-3 border-b border-amber-100">
      <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
        Needs Revision
      </p>
    </div>
    <div className="divide-y divide-amber-100">
      {data.weak_areas.map((area, idx) => (
        <div key={idx} className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-900">{area.subject}</p>
            {area.chapter && <p className="text-xs text-amber-600">{area.chapter}</p>}
          </div>
          <span className="text-xs font-bold text-red-500">{area.avg_pct}%</span>
        </div>
      ))}
    </div>
  </div>
));

WeakAreasSection.displayName = 'WeakAreasSection';

/**
 * Recent quizzes section
 */
interface RecentQuizzesSectionProps {
  data: ProgressStats;
}

const RecentQuizzesSection = React.memo<RecentQuizzesSectionProps>(({ data }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
    <div className="px-4 py-3 border-b border-neutral-50">
      <p className="text-xs font-bold text-neutral-600 uppercase tracking-wide">
        Recent Quizzes
      </p>
    </div>
    <div className="divide-y divide-neutral-50">
      {data.recent_quizzes.map((quiz, idx) => {
        const pct = calculateScorePct(quiz.scored_marks, quiz.total_marks);
        return (
          <div key={idx} className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-800">{quiz.subject}</p>
              <p className="text-xs text-neutral-400">
                {formatDate(quiz.created_at)} · {quiz.q_count} questions
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-sm font-bold ${
                  pct >= 50 ? 'text-emerald-600' : 'text-red-500'
                }`}
              >
                {quiz.scored_marks}/{quiz.total_marks}
              </p>
              <p className="text-[10px] text-neutral-400">{pct}%</p>
            </div>
          </div>
        );
      })}
    </div>
  </div>
));

RecentQuizzesSection.displayName = 'RecentQuizzesSection';

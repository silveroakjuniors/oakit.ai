/**
 * Student Module - Quiz Tab Component
 * Quiz interface with creation flow and test-taking
 */

import React, { useMemo } from 'react';
import {
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import {
  QuizQuestion,
  QuizResult,
  AssignedTest,
  QuizTopic,
  QuizQuestionType,
} from '../../types';
import { formatDate, formatTimer, calculateScorePct, getTodayISO } from '../../utils';

interface QuizTabProps {
  step: string;
  subject: string;
  from: string;
  to: string;
  topics: QuizTopic[];
  selectedTopics: string[];
  selectedQTypes: QuizQuestionType[];
  questions: QuizQuestion[];
  answers: Record<string, string>;
  results: QuizResult[];
  loading: boolean;
  error: string;
  assignedTests: AssignedTest[];
  activeTestId: string | null;
  testTimer: number;
  onSubjectChange: (v: string) => void;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onLoadTopics: () => void;
  onToggleTopic: (id: string) => void;
  onToggleQType: (id: string) => void;
  onGenerate: () => void;
  onAnswerChange: (qid: string, val: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  onStartAssigned: (t: AssignedTest) => void;
  onStepChange: (s: string) => void;
}

const Q_TYPES: Array<{ id: QuizQuestionType; label: string }> = [
  { id: 'fill_blank', label: 'Fill in the Blank' },
  { id: '1_mark', label: '1 Mark' },
  { id: '2_mark', label: '2 Mark' },
  { id: 'descriptive', label: 'Descriptive' },
];

/**
 * Pure component for quiz interface
 */
export const QuizTab = React.memo<QuizTabProps>(
  (props) => {
    if (props.step === 'taking') {
      return <QuizTakingView {...props} />;
    }

    if (props.step === 'results') {
      return <QuizResultsView {...props} />;
    }

    return <QuizFlowView {...props} />;
  }
);

QuizTab.displayName = 'QuizTab';

/**
 * Quiz taking interface
 */
interface QuizTakingViewProps extends QuizTabProps {}

const QuizTakingView = React.memo<QuizTakingViewProps>(
  ({
    questions,
    answers,
    loading,
    error,
    activeTestId,
    testTimer,
    onAnswerChange,
    onSubmit,
  }) => {
    return (
      <div className="space-y-4">
        {/* Header with timer */}
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-neutral-100">
          <p className="text-sm font-bold text-neutral-800">
            {activeTestId ? '📋 Assigned Test' : '✏️ Self Test'}
          </p>
          {activeTestId && (
            <div
              className={`flex items-center gap-1.5 text-sm font-bold ${
                testTimer < 120 ? 'text-red-600' : 'text-neutral-700'
              }`}
            >
              <Clock size={14} />
              {formatTimer(testTimer)}
            </div>
          )}
        </div>

        {/* Questions */}
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={idx}
              answer={answers[q.id] ?? ''}
              onChange={(val) => onAnswerChange(q.id, val)}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
        )}

        {/* Submit button */}
        <button
          onClick={onSubmit}
          disabled={loading}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Submitting…' : 'Submit Quiz'}
        </button>
      </div>
    );
  }
);

QuizTakingView.displayName = 'QuizTakingView';

/**
 * Question card component
 */
interface QuestionCardProps {
  question: QuizQuestion;
  index: number;
  answer: string;
  onChange: (value: string) => void;
}

const QuestionCard = React.memo<QuestionCardProps>(
  ({ question, index, answer, onChange }) => {
    const isShortForm = question.q_type === 'fill_blank' || question.q_type === '1_mark';

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-neutral-800 leading-relaxed">
            <span className="text-neutral-400 mr-1">Q{index + 1}.</span>
            {question.question}
          </p>
          <span className="shrink-0 text-[10px] font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
            {question.marks}m
          </span>
        </div>

        {isShortForm ? (
          <input
            value={answer}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Your answer…"
            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        ) : (
          <textarea
            value={answer}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write your answer…"
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
          />
        )}
      </div>
    );
  }
);

QuestionCard.displayName = 'QuestionCard';

/**
 * Quiz results view
 */
interface QuizResultsViewProps extends QuizTabProps {}

const QuizResultsView = React.memo<QuizResultsViewProps>(({ results, onReset }) => {
  const totalMarks = results.reduce((s, r) => s + r.marks, 0);
  const scoredMarks = results.reduce((s, r) => s + r.marks_awarded, 0);
  const scorePct = calculateScorePct(scoredMarks, totalMarks);
  const weakResults = results.filter((r) => !r.is_correct);

  return (
    <div className="space-y-4">
      {/* Score card */}
      <div
        className={`rounded-2xl p-5 text-center ${
          scorePct >= 50 ? 'bg-emerald-600' : 'bg-red-500'
        }`}
      >
        <p className="text-white/70 text-xs font-medium mb-1">Your Score</p>
        <p className="text-white text-4xl font-black">
          {scoredMarks}/{totalMarks}
        </p>
        <p className="text-white/80 text-sm mt-1">{scorePct}%</p>
      </div>

      {/* Weak areas message */}
      {scorePct < 50 && weakResults.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <p className="text-amber-800 text-sm font-semibold mb-1">
            💡 You may want to revise these topics:
          </p>
          <ul className="text-xs text-amber-700 space-y-0.5 list-disc pl-4">
            {weakResults.slice(0, 3).map((r, i) => (
              <li key={i}>{r.question.slice(0, 60)}…</li>
            ))}
          </ul>
        </div>
      )}

      {/* Results list */}
      <div className="space-y-2">
        {results.map((r, i) => (
          <ResultItem key={i} result={r} />
        ))}
      </div>

      {/* Retry button */}
      <button
        onClick={onReset}
        className="w-full py-3 border border-neutral-200 text-neutral-700 font-semibold rounded-xl text-sm hover:bg-neutral-50 transition-colors"
      >
        Take Another Quiz
      </button>
    </div>
  );
});

QuizResultsView.displayName = 'QuizResultsView';

/**
 * Individual result item
 */
interface ResultItemProps {
  result: QuizResult;
}

const ResultItem = React.memo<ResultItemProps>(({ result }) => (
  <div
    className={`bg-white rounded-2xl shadow-sm border px-4 py-3 ${
      result.is_correct ? 'border-emerald-100' : 'border-red-100'
    }`}
  >
    <div className="flex items-start gap-2 mb-2">
      {result.is_correct ? (
        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
      ) : (
        <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
      )}
      <p className="text-sm text-neutral-800 leading-relaxed flex-1">{result.question}</p>
      <span className="shrink-0 text-xs font-bold text-neutral-500">
        {result.marks_awarded}/{result.marks}
      </span>
    </div>

    {!result.is_correct && (
      <div className="ml-6 space-y-1">
        <p className="text-xs text-neutral-500">
          Your answer:{' '}
          <span className="text-neutral-700">{result.student_answer || '(blank)'}</span>
        </p>
        <p className="text-xs text-emerald-700">
          Correct: <span className="font-medium">{result.correct_answer}</span>
        </p>
        {result.ai_feedback && (
          <p className="text-xs text-neutral-400 italic">{result.ai_feedback}</p>
        )}
      </div>
    )}
  </div>
));

ResultItem.displayName = 'ResultItem';

/**
 * Quiz flow view (setup steps)
 */
interface QuizFlowViewProps extends QuizTabProps {}

const QuizFlowView = React.memo<QuizFlowViewProps>(
  ({
    step,
    subject,
    from,
    to,
    topics,
    selectedTopics,
    selectedQTypes,
    loading,
    error,
    assignedTests,
    onSubjectChange,
    onFromChange,
    onToChange,
    onLoadTopics,
    onToggleTopic,
    onToggleQType,
    onGenerate,
    onReset,
    onStartAssigned,
    onStepChange,
  }) => {
    const today = getTodayISO();
    const pendingTests = useMemo(
      () => assignedTests.filter((t) => t.status !== 'completed'),
      [assignedTests]
    );

    return (
      <div className="space-y-4">
        {/* Assigned tests section */}
        {pendingTests.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                Assigned Tests
              </p>
            </div>
            <div className="divide-y divide-neutral-50">
              {pendingTests.map((test) => (
                <AssignedTestItem
                  key={test.quiz_id}
                  test={test}
                  loading={loading}
                  onStart={() => onStartAssigned(test)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Self-test section */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
              Self Test
            </p>
          </div>
          <div className="p-4 space-y-4">
            {/* Subject and date range selection */}
            {(step === 'idle' || step === 'subject' || step === 'daterange') && (
              <SubjectDateRangeForm
                subject={subject}
                from={from}
                to={to}
                loading={loading}
                error={error}
                onSubjectChange={onSubjectChange}
                onFromChange={onFromChange}
                onToChange={onToChange}
                onLoadTopics={onLoadTopics}
                today={today}
              />
            )}

            {/* Topics selection */}
            {step === 'topics' && (
              <TopicsForm
                topics={topics}
                selectedTopics={selectedTopics}
                onToggleTopic={onToggleTopic}
                onBack={onReset}
                onNext={() => onStepChange('qtypes')}
              />
            )}

            {/* Question types selection */}
            {step === 'qtypes' && (
              <QuestionTypesForm
                selectedQTypes={selectedQTypes}
                onToggleQType={onToggleQType}
                onBack={() => onStepChange('topics')}
                onGenerate={onGenerate}
                loading={loading}
              />
            )}
          </div>
        </div>
      </div>
    );
  }
);

QuizFlowView.displayName = 'QuizFlowView';

/**
 * Assigned test item
 */
interface AssignedTestItemProps {
  test: AssignedTest;
  loading: boolean;
  onStart: () => void;
}

const AssignedTestItem = React.memo<AssignedTestItemProps>(
  ({ test, loading, onStart }) => (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-neutral-800">{test.subject}</p>
        <p className="text-xs text-neutral-400">
          <Clock size={10} className="inline mr-1" />
          {test.time_limit_minutes} min · Due {formatDate(test.due_date)}
        </p>
      </div>
      <button
        onClick={onStart}
        disabled={loading}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
      >
        Start
      </button>
    </div>
  )
);

AssignedTestItem.displayName = 'AssignedTestItem';

/**
 * Subject and date range form
 */
interface SubjectDateRangeFormProps {
  subject: string;
  from: string;
  to: string;
  loading: boolean;
  error: string;
  onSubjectChange: (v: string) => void;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onLoadTopics: () => void;
  today: string;
}

const SubjectDateRangeForm = React.memo<SubjectDateRangeFormProps>(
  ({
    subject,
    from,
    to,
    loading,
    error,
    onSubjectChange,
    onFromChange,
    onToChange,
    onLoadTopics,
    today,
  }) => (
    <>
      <div>
        <label className="text-xs font-medium text-neutral-500 mb-1 block">
          Subject
        </label>
        <input
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="e.g. Mathematics"
          className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-neutral-500 mb-1 block">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            max={today}
            className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500 mb-1 block">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            max={today}
            className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}
      <button
        onClick={onLoadTopics}
        disabled={loading || !subject || !from || !to}
        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {loading ? 'Loading topics…' : 'Find Topics →'}
      </button>
    </>
  )
);

SubjectDateRangeForm.displayName = 'SubjectDateRangeForm';

/**
 * Topics form
 */
interface TopicsFormProps {
  topics: QuizTopic[];
  selectedTopics: string[];
  onToggleTopic: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}

const TopicsForm = React.memo<TopicsFormProps>(
  ({ topics, selectedTopics, onToggleTopic, onBack, onNext }) => (
    <>
      <div>
        <p className="text-xs font-medium text-neutral-500 mb-2">
          Select topics to include ({selectedTopics.length}/{topics.length})
        </p>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {topics.map((topic) => (
            <label
              key={topic.chunk_id}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-neutral-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedTopics.includes(topic.chunk_id)}
                onChange={() => onToggleTopic(topic.chunk_id)}
                className="w-4 h-4 rounded accent-emerald-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-800 truncate">{topic.topic_name}</p>
                <p className="text-[10px] text-neutral-400">{formatDate(topic.covered_date)}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
      {topics.length === 0 && (
        <p className="text-sm text-neutral-500 text-center py-2">
          No topics found for this subject and date range.
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 font-semibold rounded-xl text-sm hover:bg-neutral-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={selectedTopics.length === 0}
          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </>
  )
);

TopicsForm.displayName = 'TopicsForm';

/**
 * Question types form
 */
interface QuestionTypesFormProps {
  selectedQTypes: QuizQuestionType[];
  onToggleQType: (id: QuizQuestionType) => void;
  onBack: () => void;
  onGenerate: () => void;
  loading: boolean;
}

const QuestionTypesForm = React.memo<QuestionTypesFormProps>(
  ({ selectedQTypes, onToggleQType, onBack, onGenerate, loading }) => (
    <>
      <div>
        <p className="text-xs font-medium text-neutral-500 mb-2">
          Select question types
        </p>
        <div className="grid grid-cols-2 gap-2">
          {Q_TYPES.map((qt) => (
            <label
              key={qt.id}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                selectedQTypes.includes(qt.id)
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedQTypes.includes(qt.id)}
                onChange={() => onToggleQType(qt.id)}
                className="w-4 h-4 rounded accent-emerald-600"
              />
              <span className="text-sm text-neutral-700">{qt.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 font-semibold rounded-xl text-sm hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2"
        >
          <ChevronLeft size={14} /> Back
        </button>
        <button
          onClick={onGenerate}
          disabled={loading || selectedQTypes.length === 0}
          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? 'Generating…' : 'Generate Quiz'}
        </button>
      </div>
    </>
  )
);

QuestionTypesForm.displayName = 'QuestionTypesForm';

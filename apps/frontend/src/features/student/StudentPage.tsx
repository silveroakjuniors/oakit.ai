/**
 * Student Module - Refactored Main Page
 * Production-grade Next.js + TypeScript + Custom Hooks + API Services
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Tab } from './types';
import {
  TodayTab,
  HomeworkTab,
  AskOakieTab,
  QuizTab,
  ProgressTab,
  StudentLayout,
} from './components';
import {
  useStudentAuth,
  useQuizState,
  useChat,
  useTimer,
} from './hooks';
import {
  StudentAuthService,
  studentFeedService,
  studentHomeworkService,
  studentChatService,
  studentQuizService,
  studentAuthService,
} from './api';
import {
  getTodayISO,
  addDays,
  isValidDateRange,
} from './utils';
import { FeedDay, HomeworkRecord, AssignedTest, ProgressStats } from './types';

/**
 * Main Student Portal Page
 * Handles all orchestration between hooks, services, and components
 */
export default function StudentPage() {
  const { isAuthenticated, profile, loading: authLoading, logout } = useStudentAuth();
  const quizState = useQuizState();
  const chatState = useChat();

  // Tab and navigation state
  const [currentTab, setCurrentTab] = useState<Tab>('today');

  // Today tab state
  const [feedDate, setFeedDate] = useState(getTodayISO());
  const [feed, setFeed] = useState<FeedDay | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);

  // Homework tab state
  const [hwHistory, setHwHistory] = useState<HomeworkRecord[]>([]);
  const [hwLoading, setHwLoading] = useState(false);

  // Chat state (from hook)
  const chatLoading = false;

  // Quiz state (from hook)
  const [quizLoading, setQuizLoading] = useState(false);
  const [assignedTests, setAssignedTests] = useState<AssignedTest[]>([]);

  // Progress state
  const [progress, setProgress] = useState<ProgressStats | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);

  // Timer for quizzes
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * ─── Initialization ──────────────────────────────────────────────────────
   */
  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    const token = StudentAuthService.getToken();
    if (!token) return;

    // Load initial data
    loadFeed(getTodayISO(), token);
    loadAssignedTests(token);
  }, [isAuthenticated, authLoading]);

  /**
   * ─── Timer Management ────────────────────────────────────────────────────
   */
  useEffect(() => {
    if (quizState.state.activeTestId && quizState.state.testTimer > 0) {
      timerRef.current = setInterval(() => {
        quizState.decrementTimer();
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [quizState.state.activeTestId, quizState.state.testTimer, quizState]);

  /**
   * ─── Auto-submit when timer reaches 0 ──────────────────────────────────
   */
  useEffect(() => {
    if (
      quizState.state.activeTestId &&
      quizState.state.testTimer === 0
    ) {
      handleSubmitQuiz(true);
    }
  }, [quizState.state.testTimer, quizState.state.activeTestId]);

  /**
   * ─── Tab Change Handler ──────────────────────────────────────────────────
   */
  const handleTabChange = useCallback((tab: Tab) => {
    // Guard: don't allow navigation away from active test
    if (quizState.state.activeTestId && tab !== 'quiz') {
      alert(
        '⚠ You have an active test. Please complete or submit it before navigating away.'
      );
      return;
    }

    setCurrentTab(tab);

    // Load data on tab change
    const token = StudentAuthService.getToken();
    if (!token) return;

    if (tab === 'homework' && hwHistory.length === 0) {
      loadHomework(token);
    }

    if (tab === 'progress' && !progress) {
      loadProgress(token);
    }
  }, [quizState.state.activeTestId, hwHistory, progress]);

  /**
   * ─── Today Tab Handlers ──────────────────────────────────────────────────
   */
  const loadFeed = async (date: string, token: string) => {
    setFeedLoading(true);
    try {
      const data = await studentFeedService.getFeed(date, token);
      setFeed(data);
    } catch (error) {
      console.error('Failed to load feed:', error);
      setFeed(null);
    } finally {
      setFeedLoading(false);
    }
  };

  const handleChangeDate = (delta: number) => {
    const today = getTodayISO();
    const maxFuture = addDays(today, 5);
    const next = addDays(feedDate, delta);

    if (next > maxFuture) return;

    setFeedDate(next);
    const token = StudentAuthService.getToken();
    if (token) loadFeed(next, token);
  };

  /**
   * ─── Homework Tab Handlers ───────────────────────────────────────────────
   */
  const loadHomework = async (token: string) => {
    if (hwHistory.length > 0) return;
    setHwLoading(true);
    try {
      const data = await studentHomeworkService.getHistory(token);
      setHwHistory(data);
    } catch (error) {
      console.error('Failed to load homework:', error);
      setHwHistory([]);
    } finally {
      setHwLoading(false);
    }
  };

  const handleRefreshHomework = () => {
    setHwHistory([]);
    const token = StudentAuthService.getToken();
    if (token) loadHomework(token);
  };

  /**
   * ─── Chat Handlers ───────────────────────────────────────────────────────
   */
  const handleSendChat = async () => {
    const text = chatState.input.trim();
    if (!text || text.length > 400 || quizState.state.activeTestId) return;

    chatState.setInput('');
    chatState.addMessage({ role: 'user', text, ts: Date.now() });

    const token = StudentAuthService.getToken();
    if (!token) return;

    try {
      const response = await studentChatService.sendQuery(text, token);
      chatState.addMessage({ role: 'ai', text: response.response, ts: Date.now() });
    } catch (error) {
      console.error('Chat error:', error);
      chatState.addMessage({
        role: 'ai',
        text: 'Oakie is unavailable right now. Please try again shortly.',
        ts: Date.now(),
      });
    }
  };

  /**
   * ─── Quiz Handlers ───────────────────────────────────────────────────────
   */
  const handleLoadQuizTopics = async () => {
    const { subject, from, to } = quizState.state;

    if (!subject || !from || !to || !isValidDateRange(from, to)) {
      quizState.setError('Please fill in all fields');
      return;
    }

    setQuizLoading(true);
    quizState.setError('');

    const token = StudentAuthService.getToken();
    if (!token) return;

    try {
      const topics = await studentQuizService.getTopics(subject, from, to, token);
      quizState.setTopics(topics);
      quizState.setStep('topics');

      // Pre-select all topics
      const allTopicIds = topics.map((t) => t.chunk_id);
      topics.forEach(() => {
        // This will be set through the UI
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load topics';
      quizState.setError(message);
    } finally {
      setQuizLoading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    const { selectedTopics, selectedQTypes } = quizState.state;

    if (selectedTopics.length === 0 || selectedQTypes.length === 0) {
      quizState.setError('Please select topics and question types');
      return;
    }

    setQuizLoading(true);
    quizState.setError('');

    const token = StudentAuthService.getToken();
    if (!token) return;

    try {
      const response = await studentQuizService.generateQuiz(
        { chunk_ids: selectedTopics, q_types: selectedQTypes },
        token
      );

      quizState.setQuizId(response.quiz_id);
      quizState.setQuestions(response.questions);
      quizState.setAnswers({});
      quizState.setStep('taking');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate quiz';
      quizState.setError(message);
    } finally {
      setQuizLoading(false);
    }
  };

  const handleStartAssignedTest = async (test: AssignedTest) => {
    setQuizLoading(true);
    quizState.setError('');

    const token = StudentAuthService.getToken();
    if (!token) return;

    try {
      const response = await studentQuizService.startAssignedTest(test.quiz_id, token);
      quizState.setQuizId(response.quiz_id);
      quizState.setQuestions(response.questions);
      quizState.setAnswers({});
      quizState.setActiveTestId(test.quiz_id);
      quizState.setTestTimer(test.time_limit_minutes * 60);
      quizState.setStep('taking');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start test';
      quizState.setError(message);
    } finally {
      setQuizLoading(false);
    }
  };

  const handleSubmitQuiz = async (auto = false) => {
    if (timerRef.current) clearInterval(timerRef.current);

    setQuizLoading(true);

    const token = StudentAuthService.getToken();
    if (!token) return;

    try {
      const answers = quizState.state.questions.map((q) => ({
        question_id: q.id,
        answer: quizState.state.answers[q.id] ?? '',
      }));

      const response = await studentQuizService.submitQuiz(
        quizState.state.quizId,
        { answers },
        token
      );

      quizState.setResults(response.results);
      quizState.setStep('results');
      quizState.setActiveTestId(null);

      // Invalidate progress cache
      setProgress(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit quiz';
      quizState.setError(message);
    } finally {
      setQuizLoading(false);
    }
  };

  const loadAssignedTests = async (token: string) => {
    try {
      const tests = await studentQuizService.getAssignedTests(token);
      setAssignedTests(tests);
    } catch (error) {
      console.error('Failed to load assigned tests:', error);
    }
  };

  /**
   * ─── Progress Handlers ───────────────────────────────────────────────────
   */
  const loadProgress = async (token: string) => {
    if (progress) return;

    setProgressLoading(true);
    try {
      const data = await studentQuizService.getProgress(token);
      setProgress(data);
    } catch (error) {
      console.error('Failed to load progress:', error);
      setProgress(null);
    } finally {
      setProgressLoading(false);
    }
  };

  const handleRefreshProgress = () => {
    setProgress(null);
    const token = StudentAuthService.getToken();
    if (token) loadProgress(token);
  };

  /**
   * ─── Loading State ───────────────────────────────────────────────────────
   */
  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0f2417 0%, #1e5c3a 100%)' }}
      >
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-white/40 animate-spin mx-auto mb-3" />
          <p className="text-white/60 text-sm">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  /**
   * ─── Render ──────────────────────────────────────────────────────────────
   */
  return (
    <StudentLayout
      currentTab={currentTab}
      studentName={profile.name}
      className={profile.class_name}
      sectionLabel={profile.section_label}
      onTabChange={handleTabChange}
      onLogout={logout}
    >
      {currentTab === 'today' && (
        <TodayTab
          feedDate={feedDate}
          feed={feed}
          loading={feedLoading}
          onPrev={() => handleChangeDate(-1)}
          onNext={() => handleChangeDate(1)}
          maxDate={addDays(getTodayISO(), 5)}
        />
      )}

      {currentTab === 'homework' && (
        <HomeworkTab
          records={hwHistory}
          loading={hwLoading}
          onRefresh={handleRefreshHomework}
        />
      )}

      {currentTab === 'ask' && (
        <AskOakieTab
          messages={chatState.messages}
          input={chatState.input}
          loading={chatLoading}
          disabled={!!quizState.state.activeTestId}
          onInput={chatState.setInput}
          onSend={handleSendChat}
          endRef={chatState.endRef}
        />
      )}

      {currentTab === 'quiz' && (
        <QuizTab
          step={quizState.state.step}
          subject={quizState.state.subject}
          from={quizState.state.from}
          to={quizState.state.to}
          topics={quizState.state.topics}
          selectedTopics={quizState.state.selectedTopics}
          selectedQTypes={quizState.state.selectedQTypes}
          questions={quizState.state.questions}
          answers={quizState.state.answers}
          results={quizState.state.results}
          loading={quizLoading}
          error={quizState.state.error}
          assignedTests={assignedTests}
          activeTestId={quizState.state.activeTestId}
          testTimer={quizState.state.testTimer}
          onSubjectChange={quizState.setSubject}
          onFromChange={quizState.setFrom}
          onToChange={quizState.setTo}
          onLoadTopics={handleLoadQuizTopics}
          onToggleTopic={quizState.toggleTopic}
          onToggleQType={quizState.toggleQType}
          onGenerate={handleGenerateQuiz}
          onAnswerChange={quizState.updateAnswer}
          onSubmit={() => handleSubmitQuiz(false)}
          onReset={quizState.reset}
          onStartAssigned={handleStartAssignedTest}
          onStepChange={quizState.setStep}
        />
      )}

      {currentTab === 'progress' && (
        <ProgressTab
          data={progress}
          loading={progressLoading}
          onRefresh={handleRefreshProgress}
        />
      )}
    </StudentLayout>
  );
}

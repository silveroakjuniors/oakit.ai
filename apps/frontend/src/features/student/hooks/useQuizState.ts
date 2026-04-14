/**
 * Student Module - Quiz State Hook
 * Centralized quiz state management and operations
 */

import { useState, useCallback } from 'react';
import { QuizState, QuizStep, QuizQuestionType, QuizQuestion } from '../types';
import { getTodayISO } from '../utils';

const INITIAL_QUIZ_STATE: QuizState = {
  step: 'idle',
  subject: '',
  from: '',
  to: getTodayISO(),
  topics: [],
  selectedTopics: [],
  selectedQTypes: ['fill_blank', '1_mark'],
  questions: [],
  answers: {},
  results: [],
  quizId: '',
  error: '',
  activeTestId: null,
  testTimer: 0,
};

export function useQuizState() {
  const [state, setState] = useState<QuizState>(INITIAL_QUIZ_STATE);

  const setStep = useCallback((step: QuizStep) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const setSubject = useCallback((subject: string) => {
    setState((prev) => ({ ...prev, subject }));
  }, []);

  const setFrom = useCallback((from: string) => {
    setState((prev) => ({ ...prev, from }));
  }, []);

  const setTo = useCallback((to: string) => {
    setState((prev) => ({ ...prev, to }));
  }, []);

  const setTopics = useCallback((topics: QuizState['topics']) => {
    setState((prev) => ({ ...prev, topics }));
  }, []);

  const toggleTopic = useCallback((topicId: string) => {
    setState((prev) => ({
      ...prev,
      selectedTopics: prev.selectedTopics.includes(topicId)
        ? prev.selectedTopics.filter((id) => id !== topicId)
        : [...prev.selectedTopics, topicId],
    }));
  }, []);

  const toggleQType = useCallback((qType: QuizQuestionType) => {
    setState((prev) => ({
      ...prev,
      selectedQTypes: prev.selectedQTypes.includes(qType)
        ? prev.selectedQTypes.filter((t) => t !== qType)
        : [...prev.selectedQTypes, qType],
    }));
  }, []);

  const setQuestions = useCallback((questions: QuizQuestion[]) => {
    setState((prev) => ({ ...prev, questions }));
  }, []);

  const setAnswers = useCallback((answers: Record<string, string>) => {
    setState((prev) => ({ ...prev, answers }));
  }, []);

  const updateAnswer = useCallback((questionId: string, answer: string) => {
    setState((prev) => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: answer },
    }));
  }, []);

  const setQuizId = useCallback((quizId: string) => {
    setState((prev) => ({ ...prev, quizId }));
  }, []);

  const setResults = useCallback((results: QuizState['results']) => {
    setState((prev) => ({ ...prev, results }));
  }, []);

  const setError = useCallback((error: string) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const setActiveTestId = useCallback((testId: string | null) => {
    setState((prev) => ({ ...prev, activeTestId: testId }));
  }, []);

  const setTestTimer = useCallback((timer: number) => {
    setState((prev) => ({ ...prev, testTimer: timer }));
  }, []);

  const decrementTimer = useCallback(() => {
    setState((prev) => ({
      ...prev,
      testTimer: Math.max(0, prev.testTimer - 1),
    }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_QUIZ_STATE);
  }, []);

  return {
    state,
    setStep,
    setSubject,
    setFrom,
    setTo,
    setTopics,
    toggleTopic,
    toggleQType,
    setQuestions,
    setAnswers,
    updateAnswer,
    setQuizId,
    setResults,
    setError,
    setActiveTestId,
    setTestTimer,
    decrementTimer,
    reset,
  };
}

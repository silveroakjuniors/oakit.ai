/**
 * Student Module - Quiz API Service
 * Handles quiz generation, submission, progress tracking, and assigned tests
 */

import {
  QuizTopic,
  QuizGenerateRequest,
  QuizGenerateResponse,
  QuizSubmitRequest,
  QuizSubmitResponse,
  AssignedTest,
  ProgressStats,
} from '../types';

export class StudentQuizService {
  async getTopics(
    subject: string,
    from: string,
    to: string,
    token: string
  ): Promise<QuizTopic[]> {
    const params = new URLSearchParams({
      subject,
      from,
      to,
    });

    const response = await fetch(`/api/v1/student/quiz/topics?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch quiz topics: ${response.statusText}`);
    }

    return response.json();
  }

  async generateQuiz(
    payload: QuizGenerateRequest,
    token: string
  ): Promise<QuizGenerateResponse> {
    const response = await fetch('/api/v1/student/quiz/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate quiz: ${response.statusText}`);
    }

    return response.json();
  }

  async submitQuiz(
    quizId: string,
    payload: QuizSubmitRequest,
    token: string
  ): Promise<QuizSubmitResponse> {
    const response = await fetch(`/api/v1/student/quiz/${quizId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit quiz: ${response.statusText}`);
    }

    return response.json();
  }

  async startAssignedTest(
    quizId: string,
    token: string
  ): Promise<QuizGenerateResponse> {
    const response = await fetch(`/api/v1/student/quiz/${quizId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Failed to start test: ${response.statusText}`);
    }

    return response.json();
  }

  async getAssignedTests(token: string): Promise<AssignedTest[]> {
    const response = await fetch('/api/v1/student/quiz/assigned', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch assigned tests: ${response.statusText}`);
    }

    return response.json();
  }

  async getProgress(token: string): Promise<ProgressStats> {
    const response = await fetch('/api/v1/student/quiz/results', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch progress: ${response.statusText}`);
    }

    return response.json();
  }
}

export const studentQuizService = new StudentQuizService();

/**
 * Student Module - Homework API Service
 * Handles fetching homework history and records
 */

import { HomeworkRecord } from '../types';

export class StudentHomeworkService {
  async getHistory(token: string): Promise<HomeworkRecord[]> {
    const response = await fetch('/api/v1/student/homework/history', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch homework history: ${response.statusText}`);
    }

    return response.json();
  }
}

export const studentHomeworkService = new StudentHomeworkService();

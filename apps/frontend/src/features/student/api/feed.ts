/**
 * Student Module - Feed API Service
 * Handles fetching daily topics and homework
 */

import { FeedDay } from '../types';

export class StudentFeedService {
  async getFeed(date: string, token: string): Promise<FeedDay> {
    const response = await fetch(
      `/api/v1/student/feed?date=${encodeURIComponent(date)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.statusText}`);
    }

    return response.json();
  }
}

export const studentFeedService = new StudentFeedService();

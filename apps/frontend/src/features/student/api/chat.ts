/**
 * Student Module - Chat API Service
 * Handles AI assistant queries for Ask Oakie feature
 */

import { ChatResponse } from '../types';

export class StudentChatService {
  async sendQuery(text: string, token: string): Promise<ChatResponse> {
    const response = await fetch('/api/v1/ai/student-query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send chat query: ${response.statusText}`);
    }

    return response.json();
  }
}

export const studentChatService = new StudentChatService();

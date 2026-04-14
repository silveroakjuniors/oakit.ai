/**
 * Student Module - Authentication API Service
 * Handles student authentication and profile management
 */

import { StudentProfile } from '../types';

export class StudentAuthService {
  static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('student_token');
  }

  static setToken(token: string): void {
    localStorage.setItem('student_token', token);
  }

  static clearToken(): void {
    localStorage.removeItem('student_token');
  }

  static isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  async getProfile(token: string): Promise<StudentProfile> {
    const response = await fetch('/api/v1/student/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.statusText}`);
    }

    return response.json();
  }
}

export const studentAuthService = new StudentAuthService();

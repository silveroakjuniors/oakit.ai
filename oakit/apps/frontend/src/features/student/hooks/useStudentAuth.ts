/**
 * Student Module - Authentication Hook
 * Manages student auth state and redirects
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StudentProfile } from '../types';
import { studentAuthService } from '../api';

export interface UseStudentAuthReturn {
  isAuthenticated: boolean;
  profile: StudentProfile | null;
  loading: boolean;
  logout: () => void;
}

export function useStudentAuth(): UseStudentAuthReturn {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = studentAuthService.getToken();

    if (!token) {
      router.push('/student/login');
      return;
    }

    setIsAuthenticated(true);

    // Fetch profile
    studentAuthService
      .getProfile(token)
      .catch((error) => {
        console.error('Auth error:', error);
        const message = error instanceof Error ? error.message : '';

        if (
          message.includes('Invalid') ||
          message.includes('expired') ||
          message.includes('Missing') ||
          message.includes('disabled')
        ) {
          studentAuthService.clearToken();
          router.push('/student/login');
        }
      })
      .then((data) => {
        if (data) setProfile(data);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const logout = () => {
    studentAuthService.clearToken();
    router.push('/student/login');
  };

  return { isAuthenticated, profile, loading, logout };
}

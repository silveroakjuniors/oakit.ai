'use client';
import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';

export interface AcademicCalendar {
  /** Time-machine-aware today (YYYY-MM-DD) */
  today: string;
  /** Academic year start date (YYYY-MM-DD), or null if not configured */
  academicStart: string | null;
  /** Academic year end date (YYYY-MM-DD), or null if not configured */
  academicEnd: string | null;
}

/**
 * Fetches time-machine-aware today + academic year bounds from the backend.
 * Use the returned values as `min` / `max` on all <input type="date"> elements.
 *
 * - min = academicStart (never before the academic year)
 * - max = today         (never allow future / past-today selection)
 * - max for end-of-range pickers = academicEnd
 */
export function useAcademicCalendar(token: string | null): AcademicCalendar {
  const fallbackToday = new Date().toISOString().split('T')[0];
  const [data, setData] = useState<AcademicCalendar>({
    today: fallbackToday,
    academicStart: null,
    academicEnd: null,
  });

  useEffect(() => {
    if (!token) return;
    apiGet<{ today: string; academic_start: string | null; academic_end: string | null }>(
      '/api/v1/shared/today-context',
      token
    )
      .then(r => setData({ today: r.today, academicStart: r.academic_start, academicEnd: r.academic_end }))
      .catch(() => {}); // silently fall back to browser date
  }, [token]);

  return data;
}

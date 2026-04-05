'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface AcademicYearSelectProps {
  value: string;
  onChange: (year: string) => void;
  className?: string;
}

export default function AcademicYearSelect({ value, onChange, className = '' }: AcademicYearSelectProps) {
  const [years, setYears] = useState<string[]>([]);
  const token = getToken() || '';

  useEffect(() => {
    apiGet<string[]>('/api/v1/admin/calendar/academic-years', token)
      .then(setYears)
      .catch(() => {
        // Fallback: generate locally
        const current = new Date().getFullYear();
        const fallback = Array.from({ length: 10 }, (_, i) => {
          const y = current + i;
          return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
        });
        setYears(fallback);
      });
  }, []);

  return (
    <select
      className={`px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${className}`}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">Select academic year...</option>
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}

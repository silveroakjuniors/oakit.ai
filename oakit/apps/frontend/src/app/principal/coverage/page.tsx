'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import ProgressBar from '@/components/ui/ProgressBar';
import Badge from '@/components/ui/Badge';

interface CoverageItem {
  section_id: string;
  section_name: string;
  coverage_pct: number;
  has_curriculum: boolean;
  last_completion_date: string | null;
  flagged: boolean;
  flag_note: string | null;
}

export default function CoverageReportPage() {
  const [items, setItems] = useState<CoverageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<CoverageItem[]>('/api/v1/principal/coverage', token)
      .then(setItems)
      .catch(() => setError('Failed to load coverage'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <a href="/principal" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
        <h1 className="text-2xl font-bold text-gray-900">Coverage Report</h1>
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.section_id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-semibold text-gray-800">{item.section_name}</h2>
                  {item.flagged && (
                    <p className="text-xs text-red-500 mt-0.5">⚑ {item.flag_note || 'Flagged'}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!item.has_curriculum && <Badge label="No curriculum" variant="neutral" />}
                  {item.flagged && <Badge label="Flagged" variant="danger" />}
                </div>
              </div>
              <ProgressBar percent={item.coverage_pct} />
              {item.last_completion_date && (
                <p className="text-xs text-gray-400 mt-2">
                  Last completion: {new Date(item.last_completion_date).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
          {items.length === 0 && <p className="text-gray-400">No sections found</p>}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth';
import { apiGet } from '@/lib/api';

interface PlatformStats {
  total_schools: number;
  active_schools: number;
  total_teachers: number;
  total_students: number;
  total_day_plans: number;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<PlatformStats>('/api/v1/super-admin/stats', token)
      .then(setStats)
      .catch(() => setError('Failed to load stats'));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Platform Dashboard</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Schools', value: stats.total_schools },
            { label: 'Active Schools', value: stats.active_schools },
            { label: 'Teachers', value: stats.total_teachers },
            { label: 'Students', value: stats.total_students },
            { label: 'Day Plans', value: stats.total_day_plans },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
            </div>
          ))}
        </div>
      ) : (
        !error && <p className="text-gray-400">Loading...</p>
      )}
    </div>
  );
}

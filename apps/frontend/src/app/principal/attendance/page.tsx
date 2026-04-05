'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth';
import { apiGet, apiPost } from '@/lib/api';
import Badge from '@/components/ui/Badge';

interface AttendanceItem {
  section_id: string;
  section_label: string;
  class_name: string;
  class_teacher_name: string | null;
  status: 'submitted' | 'pending';
  present_count: number;
  absent_count: number;
  flagged: boolean;
  flag_note: string | null;
}

export default function AttendanceOverviewPage() {
  const [items, setItems] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<AttendanceItem[]>('/api/v1/principal/attendance/overview', token)
      .then(setItems)
      .catch(() => setError('Failed to load attendance'))
      .finally(() => setLoading(false));
  }, []);

  async function toggleFlag(item: AttendanceItem) {
    const token = getToken();
    if (!token) return;
    try {
      if (item.flagged) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/principal/flags/${item.section_id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        setItems(prev => prev.map(i => i.section_id === item.section_id ? { ...i, flagged: false, flag_note: null } : i));
      } else {
        const note = prompt('Flag note (optional):') ?? '';
        await apiPost(`/api/v1/principal/flags/${item.section_id}`, { flag_note: note }, token);
        setItems(prev => prev.map(i => i.section_id === item.section_id ? { ...i, flagged: true, flag_note: note } : i));
      }
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <a href="/principal" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
        <h1 className="text-2xl font-bold text-gray-900">Attendance Overview</h1>
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Class</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Section</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Class Teacher</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Present</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Absent</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Flag</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.section_id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-800">{item.class_name}</td>
                  <td className="px-4 py-3 text-gray-700">
                    Section {item.section_label}
                    {item.flagged && <span className="ml-2 text-xs text-red-500">⚑ {item.flag_note}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{item.class_teacher_name || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3">
                    <Badge label={item.status} variant={item.status === 'submitted' ? 'success' : 'warning'} />
                  </td>
                  <td className="px-4 py-3 text-green-700">{item.present_count}</td>
                  <td className="px-4 py-3 text-red-600">{item.absent_count}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleFlag(item)}
                      className={`text-xs px-2 py-1 rounded ${item.flagged ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {item.flagged ? 'Unflag' : 'Flag'}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No sections found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import Badge from '@/components/ui/Badge';

interface SectionActivity {
  section_id: string;
  section_name: string;
  status: 'submitted' | 'behind' | 'not_working_day';
  chunks_covered: number;
}

interface TeacherActivity {
  teacher_id: string;
  teacher_name: string;
  sections: SectionActivity[];
}

const statusVariant = (s: string) =>
  s === 'submitted' ? 'success' : s === 'behind' ? 'danger' : 'neutral';

export default function TeacherActivityPage() {
  const [teachers, setTeachers] = useState<TeacherActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<TeacherActivity[]>('/api/v1/principal/teachers/activity', token)
      .then(setTeachers)
      .catch(() => setError('Failed to load teacher activity'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <a href="/principal" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</a>
        <h1 className="text-2xl font-bold text-gray-900">Teacher Activity</h1>
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <div className="flex flex-col gap-4">
          {teachers.map((teacher) => (
            <div key={teacher.teacher_id} className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">{teacher.teacher_name}</h2>
              <div className="flex flex-col gap-2">
                {teacher.sections.map((sec) => (
                  <div key={sec.section_id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{sec.section_name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-xs">{sec.chunks_covered} chunks</span>
                      <Badge label={sec.status.replace('_', ' ')} variant={statusVariant(sec.status)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {teachers.length === 0 && <p className="text-gray-400">No teacher data available</p>}
        </div>
      )}
    </div>
  );
}

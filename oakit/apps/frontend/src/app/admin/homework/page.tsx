'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface HomeworkItem {
  id: string;
  topic_label: string;
  homework_date: string;
  raw_text: string;
  formatted_text?: string;
  teacher_comments?: string;
  teacher_name: string;
  class_name: string;
  section_label: string;
}

interface ClassOption { id: string; name: string; }

export default function AdminHomeworkPage() {
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [classId, setClassId] = useState('');
  const token = getToken();

  useEffect(() => {
    if (!token) return;
    apiGet<{ id: string; name: string }[]>('/api/v1/admin/classes', token)
      .then(setClasses).catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ date });
    if (classId) params.set('class_id', classId);
    apiGet<HomeworkItem[]>(`/api/v1/admin/homework?${params}`, token)
      .then(setItems).catch(console.error).finally(() => setLoading(false));
  }, [token, date, classId]);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Homework</h1>
        <p className="text-sm text-gray-500 mt-1">View homework assigned by teachers across all classes</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 bg-white" />
        <select value={classId} onChange={e => setClassId(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 bg-white appearance-none">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : !items.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
          No homework found for this date
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(hw => (
            <div key={hw.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{hw.topic_label}</p>
                  <p className="text-xs text-gray-500">{hw.class_name} – Section {hw.section_label} · {hw.teacher_name}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(hw.homework_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              {hw.formatted_text ? (
                <div className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: hw.formatted_text }} />
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed">{hw.raw_text}</p>
              )}
              {hw.teacher_comments && (
                <p className="text-xs text-gray-500 mt-2 italic">Note: {hw.teacher_comments}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

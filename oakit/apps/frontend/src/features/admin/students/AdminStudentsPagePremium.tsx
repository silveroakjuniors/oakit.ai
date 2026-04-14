'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Search, Plus, Download, Eye, Edit2, Trash2 } from 'lucide-react';
import { PremiumHeader, PremiumCard, PremiumButton, PremiumBadge } from '@/components/PremiumComponents';
import { getToken } from '@/lib/auth';

interface StudentRecord {
  id: string;
  name: string;
  email: string;
  className: string;
  section: string;
  parentName?: string;
  attendance: number;
  progress: number;
  status: 'active' | 'inactive';
}

export default function AdminStudentsPagePremium() {
  const { palette } = useTheme();
  const token = getToken() || '';
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');

  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/students', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setStudents(await response.json());
      }
    } catch (error) {
      console.error('Failed to load students:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = !filterClass || s.className === filterClass;
    return matchesSearch && matchesClass;
  });

  const classes = [...new Set(students.map(s => s.className))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-100">
      <PremiumHeader
        title="Students"
        subtitle="View and manage student records"
        icon="👨‍🎓"
        action={
          <div className="flex gap-2">
            <PremiumButton variant="secondary" size="md" icon={<Download className="w-4 h-4" />}>
              Export
            </PremiumButton>
            <PremiumButton variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
              Add
            </PremiumButton>
          </div>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl mx-auto space-y-6">
        {/* Filters */}
        <PremiumCard>
          <div className="p-4 sm:p-6 space-y-3 sm:space-y-0 sm:flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{ focusRingColor: palette.primary }}
              />
            </div>
            <select
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
              className="px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 bg-white"
              style={{ focusRingColor: palette.primary }}
            >
              <option value="">All Classes</option>
              {classes.map(cls => <option key={cls} value={cls}>{cls}</option>)}
            </select>
          </div>
        </PremiumCard>

        {/* Students Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-neutral-200 rounded-lg animate-pulse" />)}
          </div>
        ) : filteredStudents.length === 0 ? (
          <PremiumCard>
            <div className="p-12 text-center">
              <p className="text-3xl mb-2">👨‍🎓</p>
              <p className="text-neutral-600 text-sm">No students found</p>
            </div>
          </PremiumCard>
        ) : (
          <div className="space-y-2 overflow-x-auto">
            {filteredStudents.map(student => (
              <PremiumCard key={student.id} className="hover:shadow-md transition-all">
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-neutral-900">{student.name}</h3>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <PremiumBadge label={student.className} variant="primary" size="sm" />
                        <PremiumBadge label={`Section ${student.section}`} variant="neutral" size="sm" />
                        <PremiumBadge label={student.status === 'active' ? 'Active' : 'Inactive'} variant={student.status === 'active' ? 'success' : 'neutral'} size="sm" />
                      </div>
                      <p className="text-xs text-neutral-500 mt-2">{student.email}</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="text-center flex-1 sm:flex-none">
                        <p className="text-sm font-bold" style={{ color: palette.primary }}>{student.attendance}%</p>
                        <p className="text-xs text-neutral-500">Attendance</p>
                      </div>
                      <div className="text-center flex-1 sm:flex-none">
                        <p className="text-sm font-bold" style={{ color: palette.primary }}>{student.progress}%</p>
                        <p className="text-xs text-neutral-500">Progress</p>
                      </div>
                      <div className="flex gap-1">
                        <button className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
                          <Eye className="w-4 h-4 text-neutral-500" />
                        </button>
                        <button className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4 text-neutral-500" />
                        </button>
                        <button className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </PremiumCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

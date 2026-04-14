'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Plus, Users, BookOpen, Edit2, Trash2, ChevronRight } from 'lucide-react';
import { PremiumHeader, PremiumCard, PremiumButton, PremiumBadge } from '@/components/PremiumComponents';
import { getToken } from '@/lib/auth';

interface ClassData {
  id: string;
  name: string;
  sections: number;
  totalStudents: number;
  teachersCount: number;
  status: 'active' | 'archived';
}

export default function AdminClassesPagePremium() {
  const { palette } = useTheme();
  const token = getToken() || '';
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/classes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setClasses(await response.json());
      }
    } catch (error) {
      console.error('Failed to load classes:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredClasses = classes.filter(cls =>
    cls.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-100">
      <PremiumHeader
        title="Classes"
        subtitle="Manage classes and sections"
        icon="🎓"
        action={
          <PremiumButton variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
            New Class
          </PremiumButton>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-6xl mx-auto space-y-6">
        {/* Search */}
        <PremiumCard>
          <div className="p-4 sm:p-6">
            <input
              type="text"
              placeholder="Search classes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2"
            />
          </div>
        </PremiumCard>

        {/* Classes Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-neutral-200 rounded-lg animate-pulse" />)}
          </div>
        ) : filteredClasses.length === 0 ? (
          <PremiumCard>
            <div className="p-12 text-center">
              <p className="text-3xl mb-2">🎓</p>
              <p className="text-neutral-600 text-sm">No classes found</p>
            </div>
          </PremiumCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClasses.map(cls => (
              <PremiumCard key={cls.id} className="cursor-pointer hover:shadow-lg transition-all" gradient>
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-neutral-900">{cls.name}</h3>
                      <PremiumBadge
                        label={cls.status === 'active' ? 'Active' : 'Archived'}
                        variant={cls.status === 'active' ? 'success' : 'neutral'}
                        size="sm"
                      />
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <Users className="w-4 h-4" style={{ color: palette.primary }} />
                      <span>{cls.totalStudents} students</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <BookOpen className="w-4 h-4" style={{ color: palette.primary }} />
                      <span>{cls.sections} sections</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t border-neutral-200">
                    <button className="flex-1 py-2 text-xs font-semibold rounded-lg transition-colors" style={{backgroundColor: palette.primaryLightest, color: palette.primary}}>
                      <Edit2 className="w-3 h-3 inline mr-1" />
                      Edit
                    </button>
                    <button className="flex-1 py-2 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                      <Trash2 className="w-3 h-3 inline mr-1" />
                      Delete
                    </button>
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

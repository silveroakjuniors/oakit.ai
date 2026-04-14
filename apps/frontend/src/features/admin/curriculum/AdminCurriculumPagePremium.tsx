'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Plus, Search, BookOpen, Clock, Users, Edit2, Trash2, Check } from 'lucide-react';
import { PremiumHeader, PremiumCard, PremiumButton, PremiumBadge } from '@/components/PremiumComponents';
import { getToken } from '@/lib/auth';

interface CurriculumItem {
  id: string;
  title: string;
  subject: string;
  class: string;
  weekNumber: number;
  topics: number;
  status: 'draft' | 'active' | 'completed';
  progress: number;
}

export default function AdminCurriculumPagePremium() {
  const { palette } = useTheme();
  const token = getToken() || '';
  const [items, setItems] = useState<CurriculumItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  useEffect(() => {
    loadCurriculum();
  }, []);

  async function loadCurriculum() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/curriculum', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setItems(await response.json());
      }
    } catch (error) {
      console.error('Failed to load curriculum:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = !filterSubject || item.subject === filterSubject;
    return matchesSearch && matchesSubject;
  });

  const subjects = [...new Set(items.map(i => i.subject))];

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'success';
    if (status === 'active') return 'primary';
    return 'neutral';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-100">
      <PremiumHeader
        title="Curriculum"
        subtitle="Plan and manage curriculum content"
        icon="📚"
        action={
          <PremiumButton variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
            New Unit
          </PremiumButton>
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
                placeholder="Search curriculum..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2"
              />
            </div>
            <select
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
              className="px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 bg-white"
            >
              <option value="">All Subjects</option>
              {subjects.map(subj => <option key={subj} value={subj}>{subj}</option>)}
            </select>
          </div>
        </PremiumCard>

        {/* Curriculum List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-neutral-200 rounded-lg animate-pulse" />)}
          </div>
        ) : filteredItems.length === 0 ? (
          <PremiumCard>
            <div className="p-12 text-center">
              <p className="text-3xl mb-2">📚</p>
              <p className="text-neutral-600 text-sm">No curriculum found</p>
            </div>
          </PremiumCard>
        ) : (
          <div className="space-y-3">
            {filteredItems.map(item => (
              <PremiumCard key={item.id} className="hover:shadow-md transition-all">
                <div className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4 flex-col sm:flex-row mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-base font-bold text-neutral-900">{item.title}</h3>
                        <PremiumBadge label={item.status} variant={getStatusColor(item.status) as any} size="sm" />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <PremiumBadge label={item.subject} variant="neutral" size="sm" />
                        <PremiumBadge label={item.class} variant="neutral" size="sm" />
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4 text-neutral-500" />
                      </button>
                      <button className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-lg font-bold" style={{ color: palette.primary }}>Week {item.weekNumber}</p>
                      <p className="text-xs text-neutral-500">Week</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold" style={{ color: palette.primary }}>{item.topics}</p>
                      <p className="text-xs text-neutral-500">Topics</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold" style={{ color: palette.primary }}>{item.progress}%</p>
                      <p className="text-xs text-neutral-500">Progress</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${item.progress}%`,
                        backgroundColor: palette.primary,
                      }}
                    />
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

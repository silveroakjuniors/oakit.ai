'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Plus, Search, Send, Edit2, Trash2, Calendar } from 'lucide-react';
import { PremiumHeader, PremiumCard, PremiumButton, PremiumBadge } from '@/components/PremiumComponents';
import { getToken } from '@/lib/auth';

interface Announcement {
  id: string;
  title: string;
  content: string;
  audience: string;
  date: string;
  status: 'draft' | 'published' | 'archived';
}

export default function AdminAnnouncementsPagePremium() {
  const { palette } = useTheme();
  const token = getToken() || '';
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  async function loadAnnouncements() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/announcements', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setAnnouncements(await response.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-100">
      <PremiumHeader
        title="Announcements"
        subtitle="Create and manage announcements"
        icon="📢"
        action={
          <PremiumButton variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
            New Announcement
          </PremiumButton>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl mx-auto space-y-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-24 bg-neutral-200 rounded-lg animate-pulse" />)}
          </div>
        ) : announcements.length === 0 ? (
          <PremiumCard>
            <div className="p-12 text-center">
              <p className="text-3xl mb-2">📢</p>
              <p className="text-neutral-600 text-sm">No announcements yet</p>
            </div>
          </PremiumCard>
        ) : (
          <div className="space-y-3">
            {announcements.map(ann => (
              <PremiumCard key={ann.id} className="hover:shadow-md transition-all">
                <div className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4 flex-col sm:flex-row mb-3">
                    <div>
                      <h3 className="text-base font-bold text-neutral-900 mb-1">{ann.title}</h3>
                      <PremiumBadge label={ann.status} variant={ann.status === 'published' ? 'success' : 'neutral'} size="sm" />
                    </div>
                    <div className="flex gap-1">
                      <button className="p-2 hover:bg-neutral-100 rounded-lg">
                        <Edit2 className="w-4 h-4 text-neutral-500" />
                      </button>
                      <button className="p-2 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-600 line-clamp-2 mb-2">{ann.content}</p>
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {ann.date}
                    </span>
                    <span>{ann.audience}</span>
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

'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Plus, Calendar, Users, Edit2, Trash2 } from 'lucide-react';
import { PremiumHeader, PremiumCard, PremiumButton, PremiumBadge } from '@/components/PremiumComponents';
import { getToken } from '@/lib/auth';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'holiday' | 'event' | 'deadline';
  description: string;
}

export default function AdminCalendarPagePremium() {
  const { palette } = useTheme();
  const token = getToken() || '';
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/calendar', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setEvents(await response.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const getTypeColor = (type: string) => {
    if (type === 'holiday') return 'error';
    if (type === 'deadline') return 'warning';
    return 'primary';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-100">
      <PremiumHeader
        title="Calendar"
        subtitle="Manage school calendar and events"
        icon="📆"
        action={
          <PremiumButton variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
            Add Event
          </PremiumButton>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-4xl mx-auto space-y-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-neutral-200 rounded-lg animate-pulse" />)}
          </div>
        ) : events.length === 0 ? (
          <PremiumCard>
            <div className="p-12 text-center">
              <p className="text-3xl mb-2">📆</p>
              <p className="text-neutral-600 text-sm">No events scheduled</p>
            </div>
          </PremiumCard>
        ) : (
          <div className="space-y-3">
            {events.map(event => (
              <PremiumCard key={event.id} className="hover:shadow-md transition-all">
                <div className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4 flex-col sm:flex-row mb-2">
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-neutral-900 mb-1">{event.title}</h3>
                      <p className="text-sm text-neutral-600">{event.description}</p>
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
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm text-neutral-500">{event.date}</span>
                    <PremiumBadge label={event.type} variant={getTypeColor(event.type) as any} size="sm" />
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

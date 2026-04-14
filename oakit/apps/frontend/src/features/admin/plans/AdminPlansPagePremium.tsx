'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Plus, Search, Calendar, Users, Edit2, Trash2 } from 'lucide-react';
import { PremiumHeader, PremiumCard, PremiumButton, PremiumBadge } from '@/components/PremiumComponents';
import { getToken } from '@/lib/auth';

interface PlanRecord {
  id: string;
  name: string;
  class: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'completed';
  coverage: number;
}

export default function AdminPlansPagePremium() {
  const { palette } = useTheme();
  const token = getToken() || '';
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/plans', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setPlans(await response.json());
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-100">
      <PremiumHeader
        title="Plans"
        subtitle="Manage curriculum plans"
        icon="📅"
        action={
          <PremiumButton variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
            New Plan
          </PremiumButton>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-6xl mx-auto space-y-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-neutral-200 rounded-lg animate-pulse" />)}
          </div>
        ) : plans.length === 0 ? (
          <PremiumCard>
            <div className="p-12 text-center">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-neutral-600 text-sm">No plans created yet</p>
            </div>
          </PremiumCard>
        ) : (
          <div className="space-y-3">
            {plans.map(plan => (
              <PremiumCard key={plan.id} className="hover:shadow-md transition-all">
                <div className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
                    <div className="flex-1">
                      <h3 className="text-base font-bold text-neutral-900 mb-2">{plan.name}</h3>
                      <div className="flex gap-2 mb-3 flex-wrap">
                        <PremiumBadge label={plan.class} variant="primary" size="sm" />
                        <PremiumBadge label={plan.status} variant={plan.status === 'active' ? 'success' : 'neutral'} size="sm" />
                      </div>
                      <div className="text-xs text-neutral-500 space-y-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {plan.startDate} to {plan.endDate}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-lg font-bold" style={{color: palette.primary}}>{plan.coverage}%</p>
                        <p className="text-xs text-neutral-500">Coverage</p>
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

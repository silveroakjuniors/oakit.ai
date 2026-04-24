'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import { School, Users, BookOpen, BarChart3, TrendingUp, Activity, Loader2 } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<PlatformStats>('/api/v1/super-admin/stats', token)
      .then(s => { setStats(s); setLoading(false); })
      .catch(() => { setError('Failed to load stats'); setLoading(false); });
  }, []);

  const tiles = stats ? [
    { label: 'Total Schools',  value: stats.total_schools,  icon: School,    color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)' },
    { label: 'Active Schools', value: stats.active_schools, icon: Activity,  color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
    { label: 'Teachers',       value: stats.total_teachers, icon: Users,     color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)' },
    { label: 'Students',       value: stats.total_students, icon: BookOpen,  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
    { label: 'Day Plans',      value: stats.total_day_plans,icon: BarChart3, color: '#EC4899', bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.2)' },
  ] : [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-white/40 text-sm mt-1">Real-time stats across all schools</p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-white/40">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading stats…</span>
        </div>
      )}

      {error && (
        <div className="rounded-2xl px-4 py-3 text-sm text-red-400"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {tiles.map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className="rounded-2xl p-5 transition-all hover:scale-[1.02]"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: bg, border: `1px solid ${border}` }}>
                <Icon size={18} style={{ color }} />
              </div>
              <p className="text-3xl font-black text-white leading-none">{value.toLocaleString()}</p>
              <p className="text-xs font-medium mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {stats && (
        <div className="mt-8 rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Platform Health
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-2 rounded-full transition-all"
                style={{ width: `${Math.round((stats.active_schools / Math.max(stats.total_schools, 1)) * 100)}%`, background: 'linear-gradient(90deg,#10B981,#34D399)' }} />
            </div>
            <span className="text-sm font-bold text-white/60">
              {Math.round((stats.active_schools / Math.max(stats.total_schools, 1)) * 100)}% active
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

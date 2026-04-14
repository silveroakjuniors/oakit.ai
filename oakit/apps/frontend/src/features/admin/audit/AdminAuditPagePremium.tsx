'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Search, User, Clock, Activity } from 'lucide-react';
import { PremiumHeader, PremiumCard, PremiumBadge } from '@/components/PremiumComponents';
import { getToken } from '@/lib/auth';

interface AuditLog {
  id: string;
  user: string;
  action: string;
  details: string;
  timestamp: string;
  status: 'success' | 'error';
}

export default function AdminAuditPagePremium() {
  const { palette } = useTheme();
  const token = getToken() || '';
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/audit', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setLogs(await response.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter(log =>
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.user.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/30 to-neutral-100">
      <PremiumHeader
        title="Audit Log"
        subtitle="Track all system activities and changes"
        icon="📊"
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-6xl mx-auto space-y-6">
        {/* Search */}
        <PremiumCard>
          <div className="p-4 sm:p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{ focusRingColor: palette.primary }}
              />
            </div>
          </div>
        </PremiumCard>

        {/* Logs */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-neutral-200 rounded-lg animate-pulse" />)}
          </div>
        ) : filteredLogs.length === 0 ? (
          <PremiumCard>
            <div className="p-12 text-center">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-neutral-600 text-sm">No activity logs found</p>
            </div>
          </PremiumCard>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map(log => (
              <PremiumCard key={log.id} className="hover:shadow-md transition-all">
                <div className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-neutral-900 mb-2">{log.action}</h3>
                      <p className="text-sm text-neutral-600 mb-2">{log.details}</p>
                      <div className="flex gap-3 flex-wrap text-xs text-neutral-500">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {log.user}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {log.timestamp}
                        </div>
                      </div>
                    </div>
                    <PremiumBadge
                      label={log.status === 'success' ? 'Success' : 'Error'}
                      variant={log.status === 'success' ? 'success' : 'error'}
                      size="sm"
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

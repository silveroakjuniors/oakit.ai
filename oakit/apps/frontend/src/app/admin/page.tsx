'use client';

import { useEffect, useState } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface Section {
  section_id: string; section_label: string; class_name: string;
  completion_pct: number; last_log_date: string | null; is_inactive: boolean;
}
interface TimeMachine {
  active: boolean; mock_date: string | null; expires_at: string | null; ttl_seconds: number;
}

export default function AdminDashboard() {
  const [sections, setSections]       = useState<Section[]>([]);
  const [tm, setTm]                   = useState<TimeMachine | null>(null);
  const [tmDate, setTmDate]           = useState('');
  const [tmHours, setTmHours]         = useState(24);
  const [tmLoading, setTmLoading]     = useState(false);
  const [tmMsg, setTmMsg]             = useState('');
  const token = getToken() || '';

  useEffect(() => {
    apiGet<Section[]>('/api/v1/principal/dashboard', token).then(setSections).catch(console.error);
    loadTm();
  }, []);

  async function loadTm() {
    try { setTm(await apiGet<TimeMachine>('/api/v1/admin/time-machine', token)); } catch {}
  }

  async function activateTm() {
    if (!tmDate) return;
    setTmLoading(true); setTmMsg('');
    try {
      const res = await apiPost<TimeMachine>('/api/v1/admin/time-machine', { date: tmDate, ttl_hours: tmHours }, token);
      setTm(res);
      setTmMsg(`✅ Time machine active — system will use ${tmDate} as today until ${new Date(res.expires_at!).toLocaleString()}`);
    } catch (e: any) { setTmMsg(`❌ ${e.message}`); }
    finally { setTmLoading(false); }
  }

  async function deactivateTm() {
    setTmLoading(true); setTmMsg('');
    try {
      await fetch('/api/v1/admin/time-machine', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setTm({ active: false, mock_date: null, expires_at: null, ttl_seconds: 0 });
      setTmMsg('✅ Time machine disabled — system is using real date again.');
    } catch (e: any) { setTmMsg(`❌ ${e.message}`); }
    finally { setTmLoading(false); }
  }

  const hoursLeft = tm?.ttl_seconds ? Math.ceil(tm.ttl_seconds / 3600) : 0;

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-primary">School Overview</h1>

      {/* ── Time Machine ── */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🕰️</span>
          <span className="font-semibold text-gray-800">Time Machine</span>
          {tm?.active
            ? <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">ACTIVE — {hoursLeft}h left</span>
            : <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">OFF</span>
          }
        </div>

        {tm?.active ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-600">
              System is using <strong>{tm.mock_date}</strong> as today's date.
              Auto-resets at <strong>{tm.expires_at ? new Date(tm.expires_at).toLocaleString() : '—'}</strong>.
            </p>
            <Button size="sm" variant="ghost" onClick={deactivateTm} loading={tmLoading} className="w-fit">
              Disable Time Machine
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500">
              Set a mock date for testing. The entire system will treat this as "today".
              Auto-expires after the set duration — no manual cleanup needed.
            </p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Mock Date</label>
                <input type="date" value={tmDate} onChange={e => setTmDate(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Auto-reset after</label>
                <select value={tmHours} onChange={e => setTmHours(Number(e.target.value))}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value={1}>1 hour</option>
                  <option value={4}>4 hours</option>
                  <option value={8}>8 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>72 hours</option>
                </select>
              </div>
              <Button size="sm" onClick={activateTm} loading={tmLoading} disabled={!tmDate}>
                Activate
              </Button>
            </div>
          </div>
        )}
        {tmMsg && <p className="text-xs mt-2 text-gray-600">{tmMsg}</p>}
      </Card>

      {/* ── Section Overview ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map(s => (
          <Card key={s.section_id}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-800">{s.class_name} — {s.section_label}</span>
              {s.is_inactive && <Badge label="Inactive" variant="danger" />}
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${s.completion_pct}%` }} />
            </div>
            <p className="text-xs text-gray-500">{s.completion_pct}% covered · Last log: {s.last_log_date || 'Never'}</p>
          </Card>
        ))}
        {sections.length === 0 && (
          <p className="text-gray-400 col-span-3 text-center py-12">No sections found. Set up classes and generate plans first.</p>
        )}
      </div>
    </div>
  );
}

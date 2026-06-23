'use client';

import { Bell, BellOff, BellRing } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function PushNotificationToggle({ compact = false }: { compact?: boolean }) {
  const { status, error, subscribe, unsubscribe } = usePushNotifications();

  if (status === 'unsupported') return null; // Don't show on unsupported browsers
  if (status === 'loading') return null;

  if (status === 'denied') {
    return compact ? null : (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl">
        <BellOff size={14} className="text-red-400" />
        <p className="text-[11px] text-red-600">Notifications blocked. Enable in browser settings.</p>
      </div>
    );
  }

  if (status === 'subscribed') {
    return (
      <button
        onClick={unsubscribe}
        className={`flex items-center gap-2 ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} bg-emerald-50 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-colors`}
      >
        <BellRing size={compact ? 12 : 14} className="text-emerald-600" />
        {!compact && <span className="text-[11px] text-emerald-700 font-medium">Notifications on</span>}
      </button>
    );
  }

  // unsubscribed or prompt
  return (
    <button
      onClick={subscribe}
      className={`flex items-center gap-2 ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100 transition-colors`}
    >
      <Bell size={compact ? 12 : 14} className="text-amber-600" />
      {!compact && <span className="text-[11px] text-amber-700 font-medium">Enable notifications</span>}
      {error && !compact && <span className="text-[9px] text-red-500 ml-1">{error}</span>}
    </button>
  );
}

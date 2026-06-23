'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/UIComponents';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnmappedClass {
  id: string;
  name: string;
}

interface FeeAlertsResponse {
  fee_alerts: {
    unmapped_classes: UnmappedClass[];
  };
}

interface DashboardAlertBannerProps {
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardAlertBanner({ className }: DashboardAlertBannerProps) {
  const token = getToken() || '';
  const [unmappedClasses, setUnmappedClasses] = useState<UnmappedClass[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiGet<FeeAlertsResponse>('/api/v1/admin/dashboard/fee-alerts', token)
      .then((data) => {
        setUnmappedClasses(data.fee_alerts?.unmapped_classes ?? []);
      })
      .catch(() => {
        // Silently ignore — banner is non-critical
      })
      .finally(() => setLoaded(true));
  }, [token]);

  // Render nothing while loading or when there are no unmapped classes
  if (!loaded || unmappedClasses.length === 0) return null;

  const classNames = unmappedClasses.map((c) => c.name).join(', ');
  const count = unmappedClasses.length;

  const message = (
    <span>
      <strong>{count} class{count !== 1 ? 'es' : ''}</strong> {count !== 1 ? 'have' : 'has'} no fee
      structure mapped for the current academic year:{' '}
      <span className="font-medium">{classNames}</span>.{' '}
      <Link
        href="/admin/fees"
        className="underline underline-offset-2 font-semibold hover:no-underline"
      >
        Set up fee structures →
      </Link>
    </span>
  );

  return (
    <div className={className}>
      <Alert
        variant="warning"
        title="Fee Structure Missing"
        message={message}
      />
    </div>
  );
}

export default DashboardAlertBanner;

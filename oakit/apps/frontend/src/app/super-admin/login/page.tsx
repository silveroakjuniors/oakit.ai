'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminLoginRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login?superadmin=1');
  }, [router]);

  return null;
}

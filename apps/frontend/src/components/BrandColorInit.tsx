'use client';

import { useEffect } from 'react';
import { applyBrandColor, loadSavedBrandColor, saveTagline } from '@/lib/branding';
import { getToken } from '@/lib/auth';

export default function BrandColorInit() {
  useEffect(() => {
    loadSavedBrandColor();

    const token = getToken();
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.primary_color) applyBrandColor(data.primary_color);
        if (data?.tagline !== undefined) saveTagline(data.tagline || '');
      })
      .catch(() => {});
  }, []);
  return null;
}

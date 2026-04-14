'use client';

import { useEffect } from 'react';
import { applyBrandColor, loadSavedBrandColor, saveTagline } from '@/lib/branding';
import { getRole, getToken } from '@/lib/auth';
import { API_BASE } from '@/lib/api';

export default function BrandColorInit() {
  useEffect(() => {
    loadSavedBrandColor();

    const token = getToken();
    if (!token) return;
    const role = (getRole() || '').toLowerCase();
    const canReadSettings = ['admin', 'principal', 'head teacher', 'vice principal', 'center head', 'super_admin'].includes(role);
    if (!canReadSettings) return;
    fetch(`${API_BASE}/api/v1/admin/settings`, {
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

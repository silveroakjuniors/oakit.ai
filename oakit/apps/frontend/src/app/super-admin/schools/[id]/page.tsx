'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getToken, setToken, setRole } from '@/lib/auth';
import { apiGet, apiPost } from '@/lib/api';
import Badge from '@/components/ui/Badge';

interface SchoolDetail {
  id: string;
  name: string;
  subdomain: string;
  status: 'active' | 'inactive';
  plan_type: string;
  billing_status: string;
  plan_updated_at: string | null;
  created_at: string;
}

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const isImpersonating = typeof window !== 'undefined' && !!localStorage.getItem('oakit_impersonation_token');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<SchoolDetail>(`/api/v1/super-admin/schools/${id}`, token)
      .then(setSchool)
      .catch(() => setError('Failed to load school'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleActivate() {
    const token = getToken();
    if (!token || !school) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/v1/super-admin/schools/${id}/activate`, {}, token);
      setSchool({ ...school, status: 'active' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeactivate() {
    const token = getToken();
    if (!token || !school) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/v1/super-admin/schools/${id}/deactivate`, {}, token);
      setSchool({ ...school, status: 'inactive' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleImpersonate() {
    const token = getToken();
    if (!token) return;
    setActionLoading(true);
    try {
      const { token: scopedToken } = await apiPost<{ token: string; expires_at: string }>(
        `/api/v1/super-admin/impersonate/${id}`, {}, token
      );
      // Store original token for exit, set scoped token as active
      localStorage.setItem('oakit_impersonation_token', token);
      setToken(scopedToken);
      setRole('admin');
      router.push('/admin');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExitImpersonation() {
    const originalToken = localStorage.getItem('oakit_impersonation_token');
    const currentToken = getToken();
    if (!currentToken) return;
    setActionLoading(true);
    try {
      await apiPost('/api/v1/super-admin/impersonate/exit', {}, currentToken);
    } catch { /* ignore */ }
    if (originalToken) {
      setToken(originalToken);
      setRole('super_admin');
      localStorage.removeItem('oakit_impersonation_token');
    }
    router.push('/super-admin');
    setActionLoading(false);
  }

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;
  if (!school) return <div className="p-8 text-red-500">{error || 'School not found'}</div>;

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-4">← Back</button>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
          <p className="text-sm text-gray-400">{school.subdomain}</p>
        </div>
        <Badge label={school.status} variant={school.status === 'active' ? 'success' : 'danger'} />
      </div>

      {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Plan</span>
          <span className="capitalize font-medium">{school.plan_type}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Billing</span>
          <span className="capitalize">{school.billing_status}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Created</span>
          <span>{new Date(school.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {school.status === 'inactive' ? (
          <button
            onClick={handleActivate}
            disabled={actionLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
          >
            Activate School
          </button>
        ) : (
          <button
            onClick={handleDeactivate}
            disabled={actionLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
          >
            Deactivate School
          </button>
        )}

        {isImpersonating ? (
          <button
            onClick={handleExitImpersonation}
            disabled={actionLoading}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50"
          >
            Exit Impersonation
          </button>
        ) : (
          <button
            onClick={handleImpersonate}
            disabled={actionLoading || school.status !== 'active'}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
          >
            Impersonate as Admin
          </button>
        )}
      </div>
    </div>
  );
}

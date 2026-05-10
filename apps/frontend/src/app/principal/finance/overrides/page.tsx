'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';

interface PendingOverride {
  id: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  reference_number: string;
  receipt_number: string;
  override_reason: string;
  created_at: string;
  student_name: string;
  class_name: string;
  fee_head_name: string;
  requested_by_name: string;
  requested_by_role: string;
}

export default function OverrideApprovalsPage() {
  const token = getToken() || '';
  const [overrides, setOverrides] = useState<PendingOverride[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-row action state
  const [acting, setActing] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet<PendingOverride[]>('/api/v1/financial/payments/pending-overrides', token);
      setOverrides(Array.isArray(data) ? data : []);
    } catch { setOverrides([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(id: string) {
    setActing(id);
    setError('');
    try {
      await apiPost(`/api/v1/financial/payments/${id}/approve-override`, { action: 'approve' }, token);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve.');
    } finally { setActing(null); }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) { setError('Enter a rejection reason.'); return; }
    setActing(id);
    setError('');
    try {
      await apiPost(`/api/v1/financial/payments/${id}/approve-override`,
        { action: 'reject', rejection_reason: rejectReason.trim() }, token);
      setRejectId(null);
      setRejectReason('');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject.');
    } finally { setActing(null); }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-800">Override Approvals</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Payments recorded with a duplicate reference number — review and approve or reject each one.
        </p>
      </div>

      {error && <p className="text-xs text-red-500 mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
      ) : overrides.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-400 py-6 text-center">✓ No pending override approvals</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {overrides.map(o => (
            <Card key={o.id} className="border-l-4 border-l-red-400">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-800">{o.student_name}</span>
                    {o.class_name && <span className="text-xs text-gray-400">{o.class_name}</span>}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
                      Duplicate ref
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">₹{Number(o.amount).toLocaleString('en-IN')}</span>
                    {' · '}{o.payment_mode.toUpperCase()}
                    {' · '}{new Date(o.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Fee: {o.fee_head_name}
                    {' · '}Ref: <span className="font-mono">{o.reference_number}</span>
                    {' · '}Receipt: <span className="font-mono">{o.receipt_number}</span>
                  </p>
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-amber-700">Override reason:</p>
                    <p className="text-xs text-amber-800 mt-0.5">{o.override_reason || '—'}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Requested by <span className="font-medium text-gray-600">{o.requested_by_name}</span>
                    {' '}({o.requested_by_role?.replace('_', ' ')})
                    {' · '}{new Date(o.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={acting === o.id}
                    onClick={() => handleApprove(o.id)}
                  >
                    {acting === o.id ? '…' : '✓ Approve'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    disabled={acting === o.id}
                    onClick={() => { setRejectId(o.id); setRejectReason(''); setError(''); }}
                  >
                    ✕ Reject
                  </Button>
                </div>
              </div>

              {/* Inline reject reason input */}
              {rejectId === o.id && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Rejection reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                    rows={2}
                    placeholder="Why is this override being rejected?"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                  />
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white"
                      disabled={acting === o.id}
                      onClick={() => handleReject(o.id)}
                    >
                      {acting === o.id ? '…' : 'Confirm Reject'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setRejectId(null); setRejectReason(''); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

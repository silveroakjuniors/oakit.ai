'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';

interface PendingCancellation {
  id: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  reference_number?: string;
  receipt_number: string;
  receipt_url?: string;
  cancel_reason: string;
  cancel_requested_at: string;
  student_name: string;
  class_name?: string;
  fee_head_name: string;
  requested_by_name: string;
  requested_by_role: string;
}

export default function CancellationApprovalsPage() {
  const token = getToken() || '';
  const [items, setItems] = useState<PendingCancellation[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet<PendingCancellation[]>('/api/v1/financial/payments/pending-cancellations', token);
      setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(id: string, receiptNumber: string) {
    setActing(id); setError('');
    try {
      await apiPost(`/api/v1/financial/payments/${id}/approve-cancel`, { action: 'approve' }, token);
      setSuccessMsg(`✓ Receipt ${receiptNumber} cancelled. Payment deleted and balance restored.`);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve.');
    } finally { setActing(null); }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) { setError('Enter a rejection reason.'); return; }
    setActing(id); setError('');
    try {
      await apiPost(`/api/v1/financial/payments/${id}/approve-cancel`,
        { action: 'reject', rejection_reason: rejectReason.trim() }, token);
      setRejectId(null); setRejectReason('');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject.');
    } finally { setActing(null); }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-800">Receipt Cancellation Approvals</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Review cancellation requests from admin staff. Approving permanently deletes the payment and restores the student's outstanding balance.
        </p>
      </div>

      {successMsg && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}
      {error && <p className="text-xs text-red-500 mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-400 py-6 text-center">✓ No pending cancellation requests</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <Card key={item.id} className="border-l-4 border-l-red-400">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-800">{item.student_name}</span>
                    {item.class_name && <span className="text-xs text-gray-400">{item.class_name}</span>}
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{item.receipt_number}</span>
                  </div>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">₹{Number(item.amount).toLocaleString('en-IN')}</span>
                    {' · '}{item.payment_mode.toUpperCase()}
                    {' · '}{new Date(item.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}{item.fee_head_name}
                  </p>
                  {item.reference_number && (
                    <p className="text-xs text-gray-500 mt-0.5">Ref: <span className="font-mono">{item.reference_number}</span></p>
                  )}
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-red-700">Cancellation reason:</p>
                    <p className="text-xs text-red-800 mt-0.5">{item.cancel_reason}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Requested by <span className="font-medium text-gray-600">{item.requested_by_name}</span>
                    {' '}({item.requested_by_role?.replace('_', ' ')})
                    {' · '}{new Date(item.cancel_requested_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {item.receipt_url && (
                    <a href={item.receipt_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 underline mt-1 inline-block">View Receipt</a>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    disabled={acting === item.id}
                    onClick={() => handleApprove(item.id, item.receipt_number)}
                  >
                    {acting === item.id ? '…' : '✓ Approve Cancel'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-600 hover:bg-gray-100"
                    disabled={acting === item.id}
                    onClick={() => { setRejectId(item.id); setRejectReason(''); setError(''); }}
                  >
                    ✕ Reject
                  </Button>
                </div>
              </div>

              {rejectId === item.id && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Rejection reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
                    rows={2}
                    placeholder="Why is this cancellation request being rejected?"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="ghost" className="bg-gray-600 hover:bg-gray-700 text-white"
                      disabled={acting === item.id} onClick={() => handleReject(item.id)}>
                      {acting === item.id ? '…' : 'Confirm Reject'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setRejectId(null); setRejectReason(''); }}>
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

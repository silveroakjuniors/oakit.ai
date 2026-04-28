'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';

interface CashPayment {
  id: string;
  sl_no: number;
  amount: number;
  payment_date: string;
  receipt_number: string;
  reference_number?: string;
  student_name: string;
  class_name?: string;
  fee_head_name: string;
}

interface CashLog {
  id: string;
  date: string;
  total_cash: number;
  expected_cash: number;
  variance: number;
  status: string;
}

export default function ReconciliationPage() {
  const token = getToken() || '';
  const { today } = useAcademicCalendar(token);

  const [canPerform, setCanPerform] = useState(false);
  const [canView, setCanView] = useState(false);
  const [permsLoaded, setPermsLoaded] = useState(false);

  // Pending cash payments
  const [pendingPayments, setPendingPayments] = useState<CashPayment[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmError, setConfirmError] = useState('');

  // History
  const [cashLogs, setCashLogs] = useState<CashLog[]>([]);
  const [cashLogsLoading, setCashLogsLoading] = useState(false);

  useEffect(() => {
    apiGet<{ permissions: string[] }>('/api/v1/financial/permissions', token)
      .then(d => {
        const perms = d.permissions || [];
        setCanView(perms.includes('VIEW_RECONCILIATION'));
        setCanPerform(perms.includes('PERFORM_RECONCILIATION'));
        setPermsLoaded(true);
      })
      .catch(() => setPermsLoaded(true));
  }, []);

  useEffect(() => {
    if (permsLoaded && (canView || canPerform)) {
      loadPendingPayments();
      loadCashLogs();
    }
  }, [permsLoaded]);

  async function loadPendingPayments() {
    setPendingLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const data = await apiGet<{ payments: CashPayment[]; total_pending: number }>(
        `/api/v1/financial/reconciliation/cash/pending?${params.toString()}`, token
      );
      setPendingPayments(data.payments || []);
      setPendingTotal(data.total_pending || 0);
      setSelected(new Set());
    } catch { setPendingPayments([]); setPendingTotal(0); }
    finally { setPendingLoading(false); }
  }

  async function loadCashLogs() {
    setCashLogsLoading(true);
    try {
      const data = await apiGet<CashLog[]>('/api/v1/financial/reconciliation/cash', token);
      setCashLogs(Array.isArray(data) ? data : []);
    } catch { setCashLogs([]); }
    finally { setCashLogsLoading(false); }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(
      selected.size === pendingPayments.length
        ? new Set()
        : new Set(pendingPayments.map(p => p.id))
    );
  }

  const selectedTotal = pendingPayments
    .filter(p => selected.has(p.id))
    .reduce((sum, p) => sum + Number(p.amount), 0);

  async function handleConfirm() {
    if (selected.size === 0) return;
    setConfirmError('');
    setConfirmMsg('');
    setConfirmLoading(true);
    try {
      const result = await apiPost<{ reconciled_count: number; total_confirmed: number }>(
        '/api/v1/financial/reconciliation/cash/confirm',
        { payment_ids: Array.from(selected) },
        token
      );
      setConfirmMsg(
        `✓ ${result.reconciled_count} payment${result.reconciled_count !== 1 ? 's' : ''} reconciled — ₹${Number(result.total_confirmed).toLocaleString('en-IN')} confirmed.`
      );
      await loadPendingPayments();
      await loadCashLogs();
    } catch (err: unknown) {
      setConfirmError(err instanceof Error ? err.message : 'Failed to confirm.');
    } finally { setConfirmLoading(false); }
  }

  if (permsLoaded && !canView && !canPerform) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
        <p className="text-4xl mb-3">🔒</p>
        <p className="text-base font-semibold text-gray-700 mb-1">Access Restricted</p>
        <p className="text-sm text-gray-400">You don't have permission to view reconciliation data.<br />Contact the Principal to request access.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-semibold text-primary">Cash Reconciliation</h1>

      {/* Summary banner */}
      <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Total Pending Reconciliation</p>
          <p className="text-3xl font-black text-amber-800 mt-0.5">
            ₹{pendingTotal.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            {pendingPayments.length} cash payment{pendingPayments.length !== 1 ? 's' : ''} collected but not yet reconciled
          </p>
        </div>
        {selected.size > 0 && (
          <div className="text-right">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">Selected to confirm</p>
            <p className="text-3xl font-black text-primary mt-0.5">₹{selectedTotal.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{selected.size} payment{selected.size !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>

      {/* Date filter */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input type="date" className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
              value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input type="date" max={today} className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
              value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <Button size="sm" onClick={loadPendingPayments} disabled={pendingLoading}>
            {pendingLoading ? 'Loading…' : 'Apply'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setFromDate(''); setToDate(''); }}>
            Clear
          </Button>
        </div>
      </Card>

      {/* Payments table */}
      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            {pendingPayments.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                <input type="checkbox" className="rounded"
                  checked={selected.size === pendingPayments.length && pendingPayments.length > 0}
                  onChange={toggleAll}
                />
                Select all
              </label>
            )}
            {selected.size > 0 && (
              <span className="text-xs text-primary font-medium">
                {selected.size} selected · ₹{selectedTotal.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          {canPerform && selected.size > 0 && (
            <Button size="sm" onClick={handleConfirm} disabled={confirmLoading}>
              {confirmLoading ? 'Confirming…' : `✓ Confirm ₹${selectedTotal.toLocaleString('en-IN')}`}
            </Button>
          )}
        </div>

        {confirmMsg && (
          <div className="mb-3 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700 font-medium">
            {confirmMsg}
          </div>
        )}
        {confirmError && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
            {confirmError}
          </div>
        )}

        {pendingLoading ? (
          <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
        ) : pendingPayments.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-3xl mb-2">✓</p>
            <p className="text-sm font-semibold text-gray-600">All cash payments reconciled</p>
            <p className="text-xs text-gray-400 mt-1">No pending cash payments found for the selected period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-500">
                  <th className="py-2 px-2 w-8"></th>
                  <th className="py-2 px-2 w-8 text-center">#</th>
                  <th className="text-left py-2 px-3">Student</th>
                  <th className="text-left py-2 px-3">Fee Head</th>
                  <th className="text-center py-2 px-3">Date</th>
                  <th className="text-left py-2 px-3">Receipt</th>
                  <th className="text-right py-2 px-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.map((p, idx) => (
                  <tr key={p.id}
                    className={`border-b border-gray-50 cursor-pointer transition-colors ${selected.has(p.id) ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
                    onClick={() => toggleSelect(p.id)}
                  >
                    <td className="py-2 px-2 text-center">
                      <input type="checkbox" className="rounded pointer-events-none"
                        checked={selected.has(p.id)} readOnly />
                    </td>
                    <td className="py-2 px-2 text-center text-xs text-gray-400">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <p className="font-medium text-gray-800">{p.student_name}</p>
                      {p.class_name && <p className="text-xs text-gray-400">{p.class_name}</p>}
                    </td>
                    <td className="py-2 px-3 text-gray-600 text-xs">{p.fee_head_name}</td>
                    <td className="py-2 px-3 text-center text-xs text-gray-500">
                      {new Date(p.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-500">{p.receipt_number || '—'}</td>
                    <td className="py-2 px-3 text-right font-semibold text-gray-800">
                      ₹{Number(p.amount).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={6} className="py-2 px-3 text-xs font-semibold text-gray-600 text-right">
                    Total pending
                  </td>
                  <td className="py-2 px-3 text-right font-black text-gray-800">
                    ₹{pendingTotal.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Reconciliation history */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Reconciliation History</h2>
        {cashLogsLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : cashLogs.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No reconciliation history yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-500">
                  <th className="text-left py-2 px-3">Date</th>
                  <th className="text-right py-2 px-3">Confirmed</th>
                  <th className="text-right py-2 px-3">Expected</th>
                  <th className="text-right py-2 px-3">Variance</th>
                  <th className="text-center py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {cashLogs.map(log => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-600 text-xs">
                      {new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700">₹{Number(log.total_cash).toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right text-gray-700">₹{Number(log.expected_cash).toLocaleString('en-IN')}</td>
                    <td className={`py-2 px-3 text-right font-medium ${Number(log.variance) < 0 ? 'text-red-600' : Number(log.variance) > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {Number(log.variance) >= 0 ? '+' : ''}₹{Number(log.variance).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        log.status === 'matched' ? 'bg-green-100 text-green-700' :
                        log.status === 'mismatch' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{log.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

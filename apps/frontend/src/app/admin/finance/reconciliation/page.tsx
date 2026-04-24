'use client';

import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';

interface BankItem {
  id: string;
  transaction_date: string;
  amount: number;
  reference: string;
  match_status: 'matched' | 'partial' | 'unmatched';
}

interface BankUploadStatus {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  items: BankItem[];
  matched_count: number;
  partial_count: number;
  unmatched_count: number;
}

interface CashLog {
  id: string;
  date: string;
  total_cash: number;
  expected_cash: number;
  variance: number;
  status: string;
}

const MATCH_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  matched:   { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Matched'   },
  partial:   { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Partial'   },
  unmatched: { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Unmatched' },
};

export default function ReconciliationPage() {
  const token = getToken() || '';

  // Bank upload
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [bankStatus, setBankStatus] = useState<BankUploadStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cash reconciliation
  const [cashDate, setCashDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalCash, setTotalCash] = useState('');
  const [cashLoading, setCashLoading] = useState(false);
  const [cashError, setCashError] = useState('');
  const [cashSuccess, setCashSuccess] = useState('');
  const [cashLogs, setCashLogs] = useState<CashLog[]>([]);
  const [cashLogsLoading, setCashLogsLoading] = useState(false);

  // Permissions
  const [canPerform, setCanPerform] = useState(false);
  const [canView, setCanView] = useState(false);
  const [permsLoaded, setPermsLoaded] = useState(false);

  useEffect(() => {
    apiGet<{ permissions: string[] }>('/api/v1/financial/permissions', token)
      .then(d => {
        const perms = d.permissions || [];
        setCanView(perms.includes('VIEW_RECONCILIATION'));
        setCanPerform(perms.includes('PERFORM_RECONCILIATION'));
        setPermsLoaded(true);
      })
      .catch(() => setPermsLoaded(true));
    loadCashLogs();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function loadCashLogs() {
    setCashLogsLoading(true);
    try {
      const data = await apiGet<CashLog[]>('/api/v1/financial/reconciliation/cash', token);
      setCashLogs(Array.isArray(data) ? data : []);
    } catch { setCashLogs([]); }
    finally { setCashLogsLoading(false); }
  }

  async function handleBankUpload() {
    if (!bankFile) { setUploadError('Select a file first.'); return; }
    const ext = bankFile.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'csv'].includes(ext || '')) {
      setUploadError('Only PDF or CSV files are allowed.');
      return;
    }
    setUploadError('');
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', bankFile);
      const res = await fetch(`${API_BASE}/api/v1/financial/reconciliation/bank/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploadId(data.upload_id || data.id);
      startPolling(data.upload_id || data.id);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadLoading(false);
    }
  }

  function startPolling(id: string) {
    setPolling(true);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiGet<BankUploadStatus>(`/api/v1/financial/reconciliation/bank/${id}`, token);
        setBankStatus(data);
        if (data.status === 'completed' || data.status === 'failed') {
          setPolling(false);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* ignore */ }
    }, 2000);
  }

  async function handleConfirm() {
    if (!uploadId) return;
    setConfirmLoading(true);
    setConfirmMsg('');
    try {
      await apiPost(`/api/v1/financial/reconciliation/bank/${uploadId}/confirm`, {}, token);
      setConfirmMsg('✓ Reconciliation confirmed.');
    } catch (err: unknown) {
      setConfirmMsg(err instanceof Error ? err.message : 'Failed to confirm.');
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleCashSubmit() {
    setCashError('');
    setCashSuccess('');
    const cash = parseFloat(totalCash);
    if (!cash || cash < 0) { setCashError('Enter a valid cash amount.'); return; }
    setCashLoading(true);
    try {
      await apiPost('/api/v1/financial/reconciliation/cash', {
        date: cashDate,
        total_cash: cash,
      }, token);
      setCashSuccess('✓ Cash reconciliation logged.');
      setTotalCash('');
      await loadCashLogs();
    } catch (err: unknown) {
      setCashError(err instanceof Error ? err.message : 'Failed to log cash.');
    } finally {
      setCashLoading(false);
    }
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-primary">Reconciliation</h1>
      </div>

      {/* Bank statement upload — only for users with PERFORM_RECONCILIATION */}
      {canPerform && (
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Bank Statement Upload</h2>
        <div className="flex items-center gap-3 mb-4">
          <input
            type="file"
            accept=".pdf,.csv"
            className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            onChange={e => setBankFile(e.target.files?.[0] || null)}
          />
          <Button size="sm" onClick={handleBankUpload} disabled={uploadLoading || !bankFile}>
            {uploadLoading ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
        {uploadError && <p className="text-xs text-red-500 mb-3">{uploadError}</p>}

        {polling && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
            <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-primary animate-spin" />
            Processing bank statement…
          </div>
        )}

        {bankStatus && bankStatus.status === 'completed' && (
          <>
            <div className="flex gap-4 mb-4 text-sm">
              <span className="text-green-700 font-medium">✓ {bankStatus.matched_count} matched</span>
              <span className="text-yellow-700 font-medium">~ {bankStatus.partial_count} partial</span>
              <span className="text-red-700 font-medium">✗ {bankStatus.unmatched_count} unmatched</span>
            </div>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Date</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Amount</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Reference</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bankStatus.items.map(item => {
                    const badge = MATCH_BADGE[item.match_status] || MATCH_BADGE.unmatched;
                    return (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-600 text-xs">
                          {new Date(item.transaction_date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-gray-800">
                          ₹{item.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3 text-gray-600 text-xs">{item.reference}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {bankStatus.items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-gray-400 text-sm">No transactions found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {confirmMsg ? (
              <p className="text-sm text-green-600">{confirmMsg}</p>
            ) : (
              <Button onClick={handleConfirm} disabled={confirmLoading}>
                {confirmLoading ? 'Confirming…' : 'Confirm Reconciliation'}
              </Button>
            )}
          </>
        )}

        {bankStatus && bankStatus.status === 'failed' && (
          <p className="text-sm text-red-500">Processing failed. Please try again.</p>
        )}
      </Card>
      )} {/* end canPerform */}

      {/* Cash reconciliation — only for users with PERFORM_RECONCILIATION */}
      {canPerform && (
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Cash Reconciliation</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={cashDate}
              onChange={e => setCashDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Total Cash (₹)</label>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="0"
              value={totalCash}
              onChange={e => setTotalCash(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleCashSubmit} disabled={cashLoading}>
              {cashLoading ? 'Logging…' : 'Log Cash'}
            </Button>
          </div>
        </div>
        {cashError && <p className="text-xs text-red-500 mb-2">{cashError}</p>}
        {cashSuccess && <p className="text-xs text-green-600 mb-2">{cashSuccess}</p>}
      </Card>
      )} {/* end canPerform */}

      {/* Cash logs table — visible to anyone with VIEW_RECONCILIATION or PERFORM_RECONCILIATION */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Cash Reconciliation Logs</h2>
        {cashLogsLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Date</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Total Cash</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Expected</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Variance</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {cashLogs.map(log => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-600 text-xs">
                      {new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700">₹{log.total_cash.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right text-gray-700">₹{log.expected_cash.toLocaleString('en-IN')}</td>
                    <td className={`py-2 px-3 text-right font-medium ${log.variance < 0 ? 'text-red-600' : log.variance > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {log.variance >= 0 ? '+' : ''}₹{log.variance.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        log.status === 'approved' ? 'bg-green-100 text-green-700' :
                        log.status === 'flagged' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{log.status}</span>
                    </td>
                  </tr>
                ))}
                {cashLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400 text-sm">No cash logs yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

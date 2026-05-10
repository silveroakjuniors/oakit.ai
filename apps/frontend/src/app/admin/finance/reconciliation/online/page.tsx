'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';

interface PendingProof {
  id: string;
  sl_no: number;
  transaction_id: string;
  amount: number;
  payment_mode: string;
  submitted_at: string;
  notes?: string;
  student_name: string;
  class_name?: string;
  fee_head_name: string;
  outstanding_balance?: number;
}

interface PendingPaymentRow {
  id: string;
  student_name: string;
  class_name?: string;
  fee_head_name: string;
  amount: number;
  receipt_number: string;
}

interface PendingPaymentGroup {
  reference_number: string | null;
  total_amount: number;
  payment_mode: string;
  payment_date: string;
  payment_ids: string[];
  rows: PendingPaymentRow[];
  // set after matching
  match_status?: 'unmatched' | 'auto_matched' | 'manual';
  bank_date?: string;
}

type MatchStatus = 'unmatched' | 'auto_matched' | 'manual';

interface ProofState extends PendingProof {
  match_status: MatchStatus;
  bank_date: string;
  manual_note?: string;
}

export default function OnlineReconciliationPage() {
  const token = getToken() || '';

  const [canPerform, setCanPerform] = useState(false);
  const [canView, setCanView] = useState(false);
  const [permsLoaded, setPermsLoaded] = useState(false);

  const [proofs, setProofs] = useState<ProofState[]>([]);
  const [loading, setLoading] = useState(false);

  // Admin-recorded UPI/bank payments pending reconciliation (grouped by reference)
  const [pendingGroups, setPendingGroups] = useState<PendingPaymentGroup[]>([]);
  const [adminBankFile, setAdminBankFile] = useState<File | null>(null);
  const [adminMatchLoading, setAdminMatchLoading] = useState(false);
  const [adminMatchDone, setAdminMatchDone] = useState(false);
  const [adminMatchSummary, setAdminMatchSummary] = useState<{ matched: number; unmatched: number } | null>(null);
  const [adminConfirmLoading, setAdminConfirmLoading] = useState(false);
  const [adminConfirmMsg, setAdminConfirmMsg] = useState('');
  const [adminConfirmError, setAdminConfirmError] = useState('');

  // Bank statement upload
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [bankRows, setBankRows] = useState<{ transaction_id: string; amount: number; date: string }[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchDone, setMatchDone] = useState(false);
  const [matchSummary, setMatchSummary] = useState<{ matched: number; unmatched: number } | null>(null);

  // Confirm
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmError, setConfirmError] = useState('');

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<ProofState | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

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
    if (permsLoaded && (canView || canPerform)) loadProofs();
  }, [permsLoaded]);

  async function loadProofs() {
    setLoading(true);
    setMatchDone(false);
    setBankRows([]);
    setMatchSummary(null);
    setAdminMatchDone(false);
    setAdminMatchSummary(null);
    setAdminConfirmMsg('');
    setAdminConfirmError('');
    try {
      const [data, pending] = await Promise.all([
        apiGet<PendingProof[]>('/api/v1/financial/reconciliation/online/pending', token),
        apiGet<{ payments: PendingPaymentGroup[] }>('/api/v1/financial/reports/reconciliation-pending', token).catch(() => ({ payments: [] })),
      ]);
      setProofs(
        (Array.isArray(data) ? data : []).map(p => ({
          ...p,
          match_status: 'unmatched',
          bank_date: new Date().toISOString().split('T')[0],
        }))
      );
      setPendingGroups((pending.payments || []).map(g => ({
        ...g,
        match_status: 'unmatched' as const,
        bank_date: new Date().toISOString().split('T')[0],
      })));
    } catch { setProofs([]); setPendingGroups([]); }
    finally { setLoading(false); }
  }

  // Parse uploaded bank statement CSV/text client-side
  // Looks for columns: transaction_id (or UTR/ref), amount, date
  async function handleBankUpload() {
    if (!bankFile) return;
    setMatchLoading(true);
    setConfirmMsg('');
    setConfirmError('');

    try {
      const text = await bankFile.text();
      const parsed = parseBankStatement(text);
      setBankRows(parsed);

      // Call backend match endpoint
      const result = await apiPost<{
        results: Array<{ proof_id: string; matched: boolean; bank_date: string | null }>;
        matched: number;
        unmatched: number;
      }>('/api/v1/financial/reconciliation/online/match', { bank_rows: parsed }, token);

      // Update proof states
      setProofs(prev =>
        prev.map(p => {
          const match = result.results.find(r => r.proof_id === p.id);
          if (match?.matched && match.bank_date) {
            return { ...p, match_status: 'auto_matched', bank_date: match.bank_date };
          }
          return p;
        })
      );

      setMatchSummary({ matched: result.matched, unmatched: result.unmatched });
      setMatchDone(true);
    } catch (err: unknown) {
      setConfirmError(err instanceof Error ? err.message : 'Failed to process bank statement.');
    } finally {
      setMatchLoading(false);
    }
  }

  // Simple CSV parser — looks for transaction ID + amount + date in each row
  function parseBankStatement(text: string): { transaction_id: string; amount: number; date: string }[] {
    const rows: { transaction_id: string; amount: number; date: string }[] = [];
    const lines = text.split('\n').filter(l => l.trim());

    for (const line of lines) {
      // Split by comma or tab
      const cols = line.split(/[,\t]/).map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 3) continue;

      // Try to find a transaction ID (alphanumeric, 8+ chars), amount (numeric), date
      let txnId = '';
      let amount = 0;
      let date = '';

      for (const col of cols) {
        // Transaction ID: alphanumeric, 8-30 chars, no spaces
        if (!txnId && /^[A-Z0-9]{8,30}$/i.test(col)) txnId = col;
        // Amount: numeric with optional decimals
        if (!amount && /^\d+(\.\d{1,2})?$/.test(col.replace(/,/g, ''))) {
          const n = parseFloat(col.replace(/,/g, ''));
          if (n > 0) amount = n;
        }
        // Date: various formats
        if (!date) {
          const d = parseDate(col);
          if (d) date = d;
        }
      }

      if (txnId && amount && date) {
        rows.push({ transaction_id: txnId, amount, date });
      }
    }
    return rows;
  }

  function parseDate(s: string): string | null {
    // Try DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
    const patterns = [
      /^(\d{2})\/(\d{2})\/(\d{4})$/,  // DD/MM/YYYY
      /^(\d{2})-(\d{2})-(\d{4})$/,    // DD-MM-YYYY
      /^(\d{4})-(\d{2})-(\d{2})$/,    // YYYY-MM-DD
    ];
    for (const p of patterns) {
      const m = s.match(p);
      if (m) {
        if (p === patterns[2]) return s; // already YYYY-MM-DD
        return `${m[3]}-${m[2]}-${m[1]}`; // convert to YYYY-MM-DD
      }
    }
    return null;
  }

  function setManual(proofId: string, bankDate: string) {
    setProofs(prev =>
      prev.map(p =>
        p.id === proofId
          ? { ...p, match_status: 'manual', bank_date: bankDate }
          : p
      )
    );
  }

  function unmark(proofId: string) {
    setProofs(prev =>
      prev.map(p =>
        p.id === proofId
          ? { ...p, match_status: 'unmatched', bank_date: new Date().toISOString().split('T')[0] }
          : p
      )
    );
  }

  const toConfirm = proofs.filter(p => p.match_status === 'auto_matched' || p.match_status === 'manual');
  const unmatched = proofs.filter(p => p.match_status === 'unmatched');

  async function handleConfirm() {
    if (toConfirm.length === 0) return;
    setConfirmError('');
    setConfirmMsg('');
    setConfirmLoading(true);
    try {
      const result = await apiPost<{ confirmed_count: number }>(
        '/api/v1/financial/reconciliation/online/confirm',
        {
          confirmations: toConfirm.map(p => ({
            proof_id: p.id,
            bank_date: p.bank_date,
          })),
        },
        token
      );
      setConfirmMsg(
        `✓ ${result.confirmed_count} payment${result.confirmed_count !== 1 ? 's' : ''} reconciled. Receipts have been generated.`
      );
      await loadProofs();
    } catch (err: unknown) {
      setConfirmError(err instanceof Error ? err.message : 'Failed to confirm.');
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setRejectLoading(true);
    try {
      await apiPost(
        `/api/v1/financial/reconciliation/online/${rejectTarget.id}/reject`,
        { reason: rejectReason.trim() || undefined },
        token
      );
      setRejectTarget(null);
      setRejectReason('');
      await loadProofs();
    } catch { /* ignore */ }
    finally { setRejectLoading(false); }
  }

  if (permsLoaded && !canView && !canPerform) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
        <p className="text-4xl mb-3">🔒</p>
        <p className="text-base font-semibold text-gray-700 mb-1">Access Restricted</p>
        <p className="text-sm text-gray-400">Contact the Principal to request access.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Online Payment Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Verify student online payments against your bank statement before releasing receipts
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={loadProofs} disabled={loading}>
          ↻ Refresh
        </Button>
      </div>

      {/* Summary */}
      {proofs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-center">
            <p className="text-2xl font-black text-amber-800">{proofs.length}</p>
            <p className="text-xs text-amber-600 mt-0.5">Pending verification</p>
          </div>
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-center">
            <p className="text-2xl font-black text-green-800">{toConfirm.length}</p>
            <p className="text-xs text-green-600 mt-0.5">Ready to confirm</p>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-center">
            <p className="text-2xl font-black text-gray-700">{unmatched.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Needs manual review</p>
          </div>
        </div>
      )}

      {/* Bank statement upload */}
      {canPerform && proofs.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Step 1 — Upload Bank Statement</h2>
          <p className="text-xs text-gray-500 mb-3">
            Upload your bank statement as CSV. The system will match each pending payment by
            <strong> transaction ID + amount in the same row</strong>. Unmatched ones can be reconciled manually below.
          </p>
          <div className="flex items-center gap-3">
            <input type="file" accept=".csv,.txt"
              className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              onChange={e => { setBankFile(e.target.files?.[0] || null); setMatchDone(false); }} />
            <Button size="sm" onClick={handleBankUpload} disabled={matchLoading || !bankFile}>
              {matchLoading ? 'Matching…' : 'Match Transactions'}
            </Button>
          </div>

          {matchDone && matchSummary && (
            <div className="mt-3 flex items-center gap-4">
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 bg-green-500 rounded-full transition-all duration-700"
                  style={{ width: `${proofs.length > 0 ? (matchSummary.matched / proofs.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-green-700 shrink-0">
                {matchSummary.matched}/{proofs.length} matched
              </span>
            </div>
          )}

          {matchDone && matchSummary && (
            <div className="mt-2 space-y-1">
              {proofs.map(p => (
                <div key={p.id} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${
                  p.match_status === 'auto_matched' ? 'bg-green-50 text-green-700' :
                  p.match_status === 'manual' ? 'bg-blue-50 text-blue-700' :
                  'bg-gray-50 text-gray-500'
                }`}>
                  <span className="shrink-0">
                    {p.match_status === 'auto_matched' ? '✓' : p.match_status === 'manual' ? '✎' : '—'}
                  </span>
                  <span className="font-medium">{p.student_name}</span>
                  <span className="text-gray-400">·</span>
                  <span>{p.fee_head_name}</span>
                  <span className="text-gray-400">·</span>
                  <span>₹{Number(p.amount).toLocaleString('en-IN')}</span>
                  <span className="text-gray-400">·</span>
                  <span className="font-mono">{p.transaction_id}</span>
                  {p.match_status === 'auto_matched' && (
                    <span className="ml-auto text-green-600">Found in statement · {p.bank_date}</span>
                  )}
                  {p.match_status === 'unmatched' && (
                    <span className="ml-auto text-amber-600">Not found — manual review needed</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Pending proofs table */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
      ) : proofs.length === 0 && pendingGroups.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <p className="text-3xl mb-2">✓</p>
            <p className="text-sm font-semibold text-gray-600">No pending online payments</p>
            <p className="text-xs text-gray-400 mt-1">All submitted payments have been reconciled</p>
          </div>
        </Card>
      ) : proofs.length === 0 ? null : (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Step 2 — Review &amp; Reconcile
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-500">
                  <th className="text-left py-2 px-3">Student</th>
                  <th className="text-left py-2 px-3">Fee Head</th>
                  <th className="text-left py-2 px-3">Transaction ID</th>
                  <th className="text-right py-2 px-3">Amount</th>
                  <th className="text-center py-2 px-3">Submitted</th>
                  <th className="text-center py-2 px-3">Status</th>
                  <th className="text-center py-2 px-3">Bank Date</th>
                  <th className="text-center py-2 px-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {proofs.map(p => (
                  <tr key={p.id} className={`border-b border-gray-50 ${
                    p.match_status === 'auto_matched' ? 'bg-green-50/40' :
                    p.match_status === 'manual' ? 'bg-blue-50/40' : ''
                  }`}>
                    <td className="py-2 px-3">
                      <p className="font-medium text-gray-800">{p.student_name}</p>
                      {p.class_name && <p className="text-xs text-gray-400">{p.class_name}</p>}
                    </td>
                    <td className="py-2 px-3 text-gray-600 text-xs">{p.fee_head_name}</td>
                    <td className="py-2 px-3">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {p.transaction_id}
                      </span>
                      {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-gray-800">
                      ₹{Number(p.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 px-3 text-center text-xs text-gray-500">
                      {new Date(p.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.match_status === 'auto_matched' ? 'bg-green-100 text-green-700' :
                        p.match_status === 'manual' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {p.match_status === 'auto_matched' ? '✓ Auto matched' :
                         p.match_status === 'manual' ? '✎ Manual' : '⏳ Pending'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {(p.match_status === 'auto_matched' || p.match_status === 'manual') ? (
                        <input type="date"
                          className="px-2 py-1 rounded border border-gray-300 text-xs w-32"
                          value={p.bank_date}
                          onChange={e => setProofs(prev => prev.map(x => x.id === p.id ? { ...x, bank_date: e.target.value } : x))}
                        />
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {p.match_status === 'unmatched' && canPerform && (
                          <button
                            onClick={() => setManual(p.id, new Date().toISOString().split('T')[0])}
                            className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 whitespace-nowrap"
                            title="Manually mark as verified"
                          >
                            ✎ Manual
                          </button>
                        )}
                        {(p.match_status === 'auto_matched' || p.match_status === 'manual') && (
                          <button
                            onClick={() => unmark(p.id)}
                            className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                            title="Undo"
                          >
                            ✕
                          </button>
                        )}
                        {canPerform && (
                          <button
                            onClick={() => { setRejectTarget(p); setRejectReason(''); }}
                            className="text-xs px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200"
                            title="Reject this payment"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Confirm button */}
      {canPerform && toConfirm.length > 0 && (
        <Card>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Step 3 — Confirm &amp; Release Receipts
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {toConfirm.length} payment{toConfirm.length !== 1 ? 's' : ''} ready ·
                Total ₹{toConfirm.reduce((s, p) => s + Number(p.amount), 0).toLocaleString('en-IN')}
              </p>
            </div>
            <Button onClick={handleConfirm} disabled={confirmLoading}>
              {confirmLoading ? 'Processing…' : `✓ Confirm & Release ${toConfirm.length} Receipt${toConfirm.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
          {confirmMsg && (
            <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-700 font-medium">
              {confirmMsg}
            </div>
          )}
          {confirmError && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              {confirmError}
            </div>
          )}
        </Card>
      )}

      {/* ── Admin-recorded UPI/bank payments pending reconciliation ─────── */}
      {pendingGroups.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Admin-Recorded Payments — Pending Bank Match</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                UPI / bank transfer payments recorded by staff. Payments with the same reference number are grouped
                (e.g. siblings paying together). Upload your bank statement to auto-match by reference + total amount.
              </p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">
              {pendingGroups.length} group{pendingGroups.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Bank statement upload */}
          {canPerform && (
            <div className="mb-4 p-3 bg-gray-50 rounded-xl">
              <p className="text-xs font-medium text-gray-600 mb-2">
                Upload bank statement CSV — system matches by <strong>reference number + total amount in the same row</strong>
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <input type="file" accept=".csv,.txt"
                  className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  onChange={e => { setAdminBankFile(e.target.files?.[0] || null); setAdminMatchDone(false); setAdminMatchSummary(null); }}
                />
                <Button size="sm" disabled={adminMatchLoading || !adminBankFile}
                  onClick={async () => {
                    if (!adminBankFile) return;
                    setAdminMatchLoading(true);
                    setAdminConfirmMsg('');
                    setAdminConfirmError('');
                    try {
                      const text = await adminBankFile.text();
                      // Parse CSV: find reference (alphanumeric 8-30 chars), amount, date per row
                      const bankRows: { reference: string; amount: number; date: string }[] = [];
                      for (const line of text.split('\n').filter(l => l.trim())) {
                        const cols = line.split(/[,\t]/).map(c => c.trim().replace(/^"|"$/g, ''));
                        let ref = '', amount = 0, date = '';
                        for (const col of cols) {
                          if (!ref && /^[A-Z0-9]{8,30}$/i.test(col)) ref = col;
                          if (!amount) { const n = parseFloat(col.replace(/,/g, '')); if (n > 0) amount = n; }
                          if (!date) {
                            const m = col.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/) || col.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
                            if (m) date = col.includes('-') && col.length === 10 && col[4] === '-' ? col : `${m[3]}-${m[2]}-${m[1]}`;
                          }
                        }
                        if (ref && amount && date) bankRows.push({ reference: ref, amount, date });
                      }
                      const result = await apiPost<{
                        matches: Array<{ reference_number: string | null; payment_ids: string[]; total_amount: number; matched: boolean; bank_date: string | null }>;
                        matched_count: number; unmatched_count: number;
                      }>('/api/v1/financial/reconciliation/admin-payments/match', { bank_rows: bankRows }, token);

                      setPendingGroups(prev => prev.map(g => {
                        const match = result.matches.find(m =>
                          m.reference_number === g.reference_number &&
                          Math.abs(m.total_amount - g.total_amount) < 0.01
                        );
                        if (match?.matched && match.bank_date) {
                          return { ...g, match_status: 'auto_matched' as const, bank_date: match.bank_date };
                        }
                        return g;
                      }));
                      setAdminMatchSummary({ matched: result.matched_count, unmatched: result.unmatched_count });
                      setAdminMatchDone(true);
                    } catch (err: unknown) {
                      setAdminConfirmError(err instanceof Error ? err.message : 'Failed to process bank statement.');
                    } finally { setAdminMatchLoading(false); }
                  }}
                >
                  {adminMatchLoading ? 'Matching…' : 'Match Transactions'}
                </Button>
              </div>
              {adminMatchDone && adminMatchSummary && (
                <p className="text-xs mt-2 text-gray-600">
                  <span className="text-green-700 font-medium">{adminMatchSummary.matched} matched</span>
                  {' · '}
                  <span className="text-amber-600">{adminMatchSummary.unmatched} not found — mark manually below</span>
                </p>
              )}
            </div>
          )}

          {/* Groups table */}
          <div className="space-y-3">
            {pendingGroups.map((g, idx) => (
              <div key={idx} className={`rounded-xl border p-3 ${
                g.match_status === 'auto_matched' ? 'bg-green-50 border-green-200' :
                g.match_status === 'manual' ? 'bg-blue-50 border-blue-200' :
                'bg-white border-gray-200'
              }`}>
                {/* Group header */}
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded font-medium">
                      {g.reference_number || 'No reference'}
                    </span>
                    <span className="text-sm font-bold text-gray-800">
                      ₹{Number(g.total_amount).toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{g.payment_mode}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(g.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {g.rows.length > 1 && (
                      <span className="text-xs text-gray-400">{g.rows.length} payments (split)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {g.match_status === 'auto_matched' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✓ Auto matched</span>
                    )}
                    {g.match_status === 'manual' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">✎ Manual</span>
                    )}
                    {g.match_status === 'unmatched' && canPerform && (
                      <button
                        className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                        onClick={() => setPendingGroups(prev => prev.map((x, i) => i === idx ? { ...x, match_status: 'manual' as const, bank_date: new Date().toISOString().split('T')[0] } : x))}
                      >
                        ✎ Mark manually
                      </button>
                    )}
                    {(g.match_status === 'auto_matched' || g.match_status === 'manual') && (
                      <>
                        <input type="date"
                          className="px-2 py-1 rounded border border-gray-300 text-xs"
                          value={g.bank_date || ''}
                          onChange={e => setPendingGroups(prev => prev.map((x, i) => i === idx ? { ...x, bank_date: e.target.value } : x))}
                        />
                        <button
                          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
                          onClick={() => setPendingGroups(prev => prev.map((x, i) => i === idx ? { ...x, match_status: 'unmatched' as const } : x))}
                        >✕</button>
                      </>
                    )}
                  </div>
                </div>
                {/* Individual rows */}
                <div className="space-y-1">
                  {g.rows.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-xs text-gray-600 px-1">
                      <span>{r.student_name} · {r.fee_head_name}</span>
                      <span className="font-medium">₹{Number(r.amount).toLocaleString('en-IN')} · {r.receipt_number}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Confirm button */}
          {canPerform && (() => {
            const toConfirm = pendingGroups.filter(g => g.match_status === 'auto_matched' || g.match_status === 'manual');
            if (toConfirm.length === 0) return null;
            return (
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs text-gray-500">
                  {toConfirm.length} group{toConfirm.length !== 1 ? 's' : ''} ready ·
                  Total ₹{toConfirm.reduce((s, g) => s + g.total_amount, 0).toLocaleString('en-IN')}
                </p>
                <Button size="sm" disabled={adminConfirmLoading}
                  onClick={async () => {
                    setAdminConfirmLoading(true);
                    setAdminConfirmMsg('');
                    setAdminConfirmError('');
                    try {
                      const result = await apiPost<{ confirmed_payment_count: number }>(
                        '/api/v1/financial/reconciliation/admin-payments/confirm',
                        { confirmations: toConfirm.map(g => ({ payment_ids: g.payment_ids, bank_date: g.bank_date! })) },
                        token
                      );
                      setAdminConfirmMsg(`✓ ${result.confirmed_payment_count} payment${result.confirmed_payment_count !== 1 ? 's' : ''} reconciled.`);
                      await loadProofs();
                    } catch (err: unknown) {
                      setAdminConfirmError(err instanceof Error ? err.message : 'Failed to confirm.');
                    } finally { setAdminConfirmLoading(false); }
                  }}
                >
                  {adminConfirmLoading ? 'Confirming…' : `✓ Confirm & Reconcile ${toConfirm.length} Group${toConfirm.length !== 1 ? 's' : ''}`}
                </Button>
              </div>
            );
          })()}
          {adminConfirmMsg && <p className="text-xs text-green-600 mt-2">{adminConfirmMsg}</p>}
          {adminConfirmError && <p className="text-xs text-red-500 mt-2">{adminConfirmError}</p>}
        </Card>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-1">Reject Payment</h2>
            <p className="text-xs text-gray-500 mb-4">
              <strong>{rejectTarget.student_name}</strong> · {rejectTarget.fee_head_name} ·
              ₹{Number(rejectTarget.amount).toLocaleString('en-IN')} · Txn: {rejectTarget.transaction_id}
            </p>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3"
              rows={2}
              placeholder="e.g. Transaction not found in bank statement"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setRejectTarget(null)}>Cancel</Button>
              <Button size="sm" onClick={handleReject} disabled={rejectLoading}
                className="bg-red-600 hover:bg-red-700 text-white">
                {rejectLoading ? 'Rejecting…' : 'Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

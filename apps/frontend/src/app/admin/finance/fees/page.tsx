'use client';

import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';

interface Student {
  id: string;
  name: string;
  class_name?: string;
  parent_contact?: string;
}

interface Instalment {
  id: string;
  instalment_number: number;
  label?: string;
  amount: number;
  due_date: string;
}

interface FeeAccount {
  id: string;
  fee_head_id: string;
  fee_head_name: string;
  fee_head_type: string;
  assigned_amount: number;
  outstanding_balance: number;
  status: string;
  pricing_model: string;
  academic_year?: string;
  class_name?: string;
  instalments?: Instalment[];
  next_instalment?: Instalment | null;
  total_instalments?: number;
  pending_instalments_count?: number;
}

interface Concession {
  id: string;
  fee_head_id: string;
  fee_head_name: string;
  type: 'fixed' | 'percentage';
  value: number;
  reason: string;
}

interface Invoice {
  accounts: FeeAccount[];
  concessions: Concession[];
  credit_balance: number;
  gross_payable: number;
  net_payable: number;
  total_assigned: number;
  total_paid: number;
  confirmed_paid: number;
  total_concessions: number;
  reconciliation_pending_amount: number;
  reconciliation_pending_count: number;
}

interface Payment {
  id: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  receipt_number: string;
  receipt_url?: string;
  fee_head_name?: string;
  needs_reconciliation?: boolean;
  collected_by_name?: string;
  collected_by_role?: string;
  reconciled_at?: string;
  reconciled_by_name?: string;
  reconciled_by_role?: string;
  cancel_status?: string;
  cancel_reason?: string;
  cancel_requested_by_name?: string;
  cancel_approved_by_name?: string;
  created_at?: string;
}

interface CancelledPayment {
  id: string;
  receipt_number: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  fee_head_name?: string;
  cancel_reason: string;
  requested_by_name?: string;
  approved_by_name?: string;
  approved_at: string;
}

interface DuplicateInfo {
  student_name: string;
  amount: number;
  payment_date: string;
  receipt_number?: string;
}

export default function FeesPage() {
  const token = getToken() || '';
  const { today } = useAcademicCalendar(token);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const [selectedAccount, setSelectedAccount] = useState<FeeAccount | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [screenshotUploading, setScreenshotUploading] = useState(false);

  // Duplicate reference state
  const [dupChecking, setDupChecking] = useState(false);
  const [dupInfo, setDupInfo] = useState<DuplicateInfo | null>(null);
  const [dupOverride, setDupOverride] = useState(false); // admin chose to proceed anyway
  const [dupOverrideComment, setDupOverrideComment] = useState('');

  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [payResult, setPayResult] = useState<{ receipt_url?: string; receipt_number?: string; needs_reconciliation?: boolean } | null>(null);

  const [history, setHistory] = useState<Payment[]>([]);
  const [cancellations, setCancellations] = useState<CancelledPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // Cancel request state
  const [cancelTarget, setCancelTarget] = useState<Payment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMsg, setCancelMsg] = useState('');

  const needsRef = ['upi', 'online', 'bank_transfer'].includes(paymentMode);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(async () => {
      try {
        const data = await apiGet<Student[]>(`/api/v1/admin/students?search=${encodeURIComponent(searchQuery)}`, token);
        setSearchResults(Array.isArray(data) ? data : []);
        setShowDropdown(true);
      } catch { setSearchResults([]); }
    }, 300);
  }, [searchQuery]);

  // Check duplicate reference with debounce
  useEffect(() => {
    if (!referenceNumber.trim() || !needsRef) { setDupInfo(null); setDupOverride(false); return; }
    const t = setTimeout(async () => {
      setDupChecking(true);
      try {
        const data = await apiGet<{ is_duplicate: boolean; existing_payment: DuplicateInfo | null }>(
          `/api/v1/financial/payments/check-reference?reference_number=${encodeURIComponent(referenceNumber.trim())}`, token
        );
        setDupInfo(data.is_duplicate ? data.existing_payment : null);
        if (!data.is_duplicate) setDupOverride(false);
      } catch { setDupInfo(null); }
      finally { setDupChecking(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [referenceNumber, needsRef]);

  async function selectStudent(student: Student) {
    setSelectedStudent(student);
    setShowDropdown(false);
    setSearchQuery(student.name);
    setPayResult(null);
    setPayError('');
    setSelectedAccount(null);
    setAmount('');
    setReferenceNumber('');
    setDupInfo(null);
    setDupOverride(false);
    setDupOverrideComment('');
    await loadInvoice(student.id);
    await loadHistory(student.id);
  }

  async function loadInvoice(studentId: string) {
    setInvoiceLoading(true);
    try {
      const data = await apiGet<Invoice>(`/api/v1/financial/payments/invoice/${studentId}`, token);
      setInvoice(data);
      const firstPending = data.accounts.find(a => a.status !== 'paid');
      if (firstPending) {
        setSelectedAccount(firstPending);
        const suggested = firstPending.next_instalment
          ? firstPending.next_instalment.amount
          : firstPending.outstanding_balance;
        setAmount(String(suggested));
      }
    } catch { setInvoice(null); }
    finally { setInvoiceLoading(false); }
  }

  async function loadHistory(studentId: string) {
    setHistoryLoading(true);
    try {
      const data = await apiGet<{ payments: Payment[]; cancellations: CancelledPayment[] }>(
        `/api/v1/financial/payments/student/${studentId}`, token
      );
      setHistory(Array.isArray(data.payments) ? data.payments : []);
      setCancellations(Array.isArray(data.cancellations) ? data.cancellations : []);
    } catch { setHistory([]); setCancellations([]); }
    finally { setHistoryLoading(false); }
  }

  function selectAccount(acc: FeeAccount) {
    setSelectedAccount(acc);
    setPayError('');
    setPayResult(null);
    const suggested = acc.next_instalment ? acc.next_instalment.amount : acc.outstanding_balance;
    setAmount(String(suggested));
  }

  async function handleScreenshotUpload(file: File) {
    setScreenshotFile(file);
    setScreenshotUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/v1/financial/payments/upload-screenshot`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) setScreenshotUrl(data.url);
    } catch { /* ignore — screenshot is optional */ }
    finally { setScreenshotUploading(false); }
  }

  const amtNum = parseFloat(amount) || 0;
  const nextInstAmt = selectedAccount?.next_instalment?.amount ?? 0;
  const outstanding = selectedAccount?.outstanding_balance ?? 0;
  const hasInstalments = (selectedAccount?.instalments?.length ?? 0) > 0;

  // Compute how the payment gets distributed across pending instalments
  const instBreakdown: { label: string; applied: number; remaining: number }[] = [];
  if (hasInstalments && amtNum > 0 && selectedAccount?.instalments) {
    let remaining = amtNum;
    for (const inst of selectedAccount.instalments) {
      if (remaining <= 0) break;
      const instAmt = Number(inst.amount);
      const applied = Math.min(remaining, instAmt);
      instBreakdown.push({
        label: inst.label || `Instalment ${inst.instalment_number}`,
        applied,
        remaining: instAmt - applied,
      });
      remaining -= applied;
    }
    // Any leftover beyond all instalments
    if (remaining > 0) {
      instBreakdown.push({ label: 'Credit balance', applied: remaining, remaining: 0 });
    }
  }

  let amountWarning = '';
  let amountInfo = '';
  if (selectedAccount && amtNum > 0) {
    if (!hasInstalments) {
      if (amtNum > outstanding) {
        const excess = amtNum - outstanding;
        amountInfo = `₹${excess.toLocaleString('en-IN')} will be added as credit balance.`;
      } else if (amtNum < outstanding) {
        amountInfo = `Partial payment. ₹${(outstanding - amtNum).toLocaleString('en-IN')} will remain outstanding.`;
      }
    } else if (nextInstAmt > 0 && amtNum < nextInstAmt) {
      amountWarning = `Less than next instalment (₹${nextInstAmt.toLocaleString('en-IN')}). Recorded as partial payment.`;
    }
  }

  const canSubmit = amtNum > 0 && selectedAccount && selectedAccount.status !== 'paid'
    && (!needsRef || referenceNumber.trim())
    && (!dupInfo || (dupOverride && dupOverrideComment.trim()))
    && !dupChecking;

  async function handlePayment() {
    if (!selectedStudent || !selectedAccount) return;
    setPayError('');
    setPayResult(null);
    if (!amtNum || amtNum <= 0) { setPayError('Enter a valid amount.'); return; }
    if (needsRef && !referenceNumber.trim()) { setPayError('Reference / UTR number is required for this payment mode.'); return; }
    if (dupInfo && !dupOverride) { setPayError('Duplicate reference number. Tick the override checkbox to proceed.'); return; }
    if (dupInfo && dupOverride && !dupOverrideComment.trim()) { setPayError('Enter a reason for the override.'); return; }

    setPayLoading(true);
    try {
      const result = await apiPost<{ receipt_url?: string; receipt_number?: string; needs_reconciliation?: boolean }>(
        '/api/v1/financial/payments',
        {
          student_id: selectedStudent.id,
          fee_head_id: selectedAccount.fee_head_id,
          amount: amtNum,
          payment_mode: paymentMode,
          payment_date: paymentDate,
          reference_number: referenceNumber.trim() || undefined,
          screenshot_url: screenshotUrl || undefined,
          allow_duplicate: dupOverride || undefined,
          override_reason: dupOverride ? dupOverrideComment.trim() : undefined,
        },
        token
      );
      setPayResult(result);
      setAmount('');
      setReferenceNumber('');
      setScreenshotFile(null);
      setScreenshotUrl('');
      setDupInfo(null);
      setDupOverride(false);
      setDupOverrideComment('');
      await loadInvoice(selectedStudent.id);
      await loadHistory(selectedStudent.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment failed.';
      setPayError(msg);
    } finally {
      setPayLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-semibold text-primary">Fee Collection</h1>

      <div className="p-3 rounded-lg border border-red-300 bg-red-50">
        <p className="text-xs font-semibold text-red-700">⚠️ Fees once paid cannot be refunded under any circumstances.</p>
      </div>

      {/* Student search */}
      <Card>
        <h2 className="text-sm font-medium text-gray-700 mb-3">Search Student</h2>
        <div className="relative">
          <input
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Type student name, parent name, or phone…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
          />
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map(s => (
                <button key={s.id} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                  onClick={() => selectStudent(s)}>
                  <span className="font-medium text-gray-800">{s.name}</span>
                  {s.class_name && <span className="text-gray-500 ml-2 text-xs">{s.class_name}</span>}
                  {s.parent_contact && <span className="text-gray-400 ml-2 text-xs">{s.parent_contact}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {selectedStudent && (
        <>
          {invoiceLoading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Loading fee details…</p>
          ) : invoice ? (
            <>
              {/* Fee accounts */}
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">Fee Summary — {selectedStudent.name}</h2>
                </div>

                {/* Summary stats bar */}
                {(() => {
                  const paidPct = invoice.total_assigned > 0
                    ? Math.round((invoice.total_paid / invoice.total_assigned) * 100) : 0;
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Total Assigned</p>
                        <p className="text-sm font-bold text-gray-800">₹{Number(invoice.total_assigned).toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Paid</p>
                        <p className="text-sm font-bold text-green-700">₹{Number(invoice.total_paid).toLocaleString('en-IN')}</p>
                        <p className="text-xs text-gray-400">{paidPct}% collected</p>
                        {invoice.reconciliation_pending_amount > 0 && (
                          <p className="text-xs text-amber-500 mt-0.5">
                            incl. ₹{Number(invoice.reconciliation_pending_amount).toLocaleString('en-IN')} pending bank match
                          </p>
                        )}
                      </div>
                      {invoice.total_concessions > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Concessions</p>
                          <p className="text-sm font-bold text-blue-600">− ₹{Number(invoice.total_concessions).toLocaleString('en-IN')}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Outstanding</p>
                        <p className="text-sm font-bold text-primary">₹{Number(invoice.net_payable).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Progress bar — paid (green) + recon pending portion (amber) */}
                {invoice.total_assigned > 0 && (
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-4 flex">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${Math.round(((Number(invoice.total_paid) - Number(invoice.reconciliation_pending_amount)) / invoice.total_assigned) * 100)}%` }}
                    />
                    <div
                      className="h-full bg-amber-400 transition-all"
                      style={{ width: `${Math.round((Number(invoice.reconciliation_pending_amount) / invoice.total_assigned) * 100)}%` }}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  {invoice.accounts.map(acc => {
                    const isSelected = selectedAccount?.fee_head_id === acc.fee_head_id;
                    const isPaid = acc.status === 'paid';
                    return (
                      <button key={acc.fee_head_id} onClick={() => !isPaid && selectAccount(acc)} disabled={isPaid}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          isPaid ? 'bg-gray-50 border-gray-100 opacity-60 cursor-default' :
                          isSelected ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' :
                          'bg-white border-gray-200 hover:border-primary/30 hover:bg-primary/5'
                        }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-800">{acc.fee_head_name}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                isPaid ? 'bg-green-100 text-green-700' :
                                acc.status === 'overdue' ? 'bg-red-100 text-red-700' :
                                acc.status === 'partially_paid' ? 'bg-blue-100 text-blue-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>{isPaid ? '✓ Paid' : acc.status.replace('_', ' ')}</span>
                            </div>
                            {/* Pending instalments */}
                            {acc.instalments && acc.instalments.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                {acc.instalments.slice(0, 3).map((inst, i) => (
                                  <div key={inst.id} className={`flex items-center justify-between text-xs px-2 py-1 rounded-lg ${
                                    i === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
                                  }`}>
                                    <span className={i === 0 ? 'font-semibold text-amber-800' : 'text-gray-500'}>
                                      {i === 0 ? '→ ' : ''}{inst.label || `Instalment ${inst.instalment_number}`}
                                      {inst.due_date && ` · Due ${new Date(inst.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                                    </span>
                                    <span className={i === 0 ? 'font-bold text-amber-800' : 'text-gray-500'}>
                                      ₹{Number(inst.amount).toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                ))}
                                {(acc.pending_instalments_count ?? 0) > 3 && (
                                  <p className="text-xs text-gray-400 pl-2">+{(acc.pending_instalments_count ?? 0) - 3} more pending</p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-gray-800">₹{Number(acc.outstanding_balance).toLocaleString('en-IN')}</p>
                            <p className="text-xs text-gray-400">outstanding</p>
                            {/* Show approved concessions for this fee head */}
                            {invoice.concessions.filter(c => c.fee_head_id === acc.fee_head_id).map(c => {
                              const concAmt = c.type === 'fixed'
                                ? Number(c.value)
                                : (Number(c.value) / 100) * Number(acc.assigned_amount);
                              return (
                                <p key={c.id} className="text-xs text-green-600 mt-0.5">
                                  − ₹{concAmt.toLocaleString('en-IN')}
                                  {c.type === 'percentage' && ` (${c.value}%)`} concession
                                </p>
                              );
                            })}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {invoice.credit_balance > 0 && (
                  <p className="text-xs text-green-600 mt-3 px-1">✓ Credit balance: ₹{invoice.credit_balance.toLocaleString('en-IN')} available</p>
                )}
              </Card>

              {/* Payment form */}
              {selectedAccount && selectedAccount.status !== 'paid' && (
                <Card>
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Record Payment — {selectedAccount.fee_head_name}</h2>

                  {selectedAccount.next_instalment && (
                    <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                      <p className="text-xs font-semibold text-amber-800">
                        Next instalment: {selectedAccount.next_instalment.label || `Instalment ${selectedAccount.next_instalment.instalment_number}`}
                        {' '}— ₹{Number(selectedAccount.next_instalment.amount).toLocaleString('en-IN')}
                        {selectedAccount.next_instalment.due_date && ` · Due ${new Date(selectedAccount.next_instalment.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      </p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        Total outstanding (all instalments): ₹{Number(selectedAccount.outstanding_balance).toLocaleString('en-IN')}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
                      <input type="number" min="1"
                        className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${amountWarning ? 'border-amber-400' : 'border-gray-300'}`}
                        placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
                      {amountWarning && <p className="text-xs text-amber-600 mt-1">⚠ {amountWarning}</p>}
                      {amountInfo && !amountWarning && <p className="text-xs text-blue-600 mt-1">ℹ {amountInfo}</p>}
                      {/* Instalment breakdown when paying more than one instalment */}
                      {hasInstalments && instBreakdown.length > 1 && amtNum > 0 && (
                        <div className="mt-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 space-y-1">
                          <p className="text-xs font-semibold text-blue-800">Payment breakdown:</p>
                          {instBreakdown.map((b, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className={b.label === 'Credit balance' ? 'text-gray-500' : 'text-blue-700'}>
                                {b.label}
                                {b.remaining > 0 && <span className="text-gray-400 ml-1">(partial — ₹{b.remaining.toLocaleString('en-IN')} still due)</span>}
                                {b.remaining === 0 && b.label !== 'Credit balance' && <span className="text-green-600 ml-1">✓ fully covered</span>}
                              </span>
                              <span className="font-semibold text-blue-800">₹{b.applied.toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
                      <select className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={paymentMode} onChange={e => { setPaymentMode(e.target.value); setReferenceNumber(''); setDupInfo(null); setDupOverride(false); }}>
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="online">Online</option>
                        <option value="bank_transfer">Bank Transfer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date</label>
                      <input type="date" max={today}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                    </div>
                    {needsRef && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Reference / UTR <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input type="text"
                          className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                            dupInfo ? 'border-red-400 bg-red-50' : 'border-gray-300'
                          }`}
                          placeholder="Required — UTR / transaction ID"
                          value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} />
                        {dupChecking && <span className="absolute right-2 top-2 text-xs text-gray-400">Checking…</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        💡 Tip: Ask parent to add <strong>{selectedStudent.name} {selectedAccount.class_name || ''}</strong> in transaction remarks
                      </p>
                      {dupInfo && (
                        <div className="mt-2 rounded-lg bg-red-50 border border-red-300 px-3 py-2">
                          <p className="text-xs font-semibold text-red-700">⚠ Duplicate reference number</p>
                          <p className="text-xs text-red-600 mt-0.5">
                            Already used for {dupInfo.student_name} · ₹{Number(dupInfo.amount).toLocaleString('en-IN')} · {new Date(dupInfo.payment_date).toLocaleDateString('en-IN')}
                          </p>
                          <label className="flex items-center gap-2 mt-2 cursor-pointer">
                            <input type="checkbox" checked={dupOverride} onChange={e => setDupOverride(e.target.checked)} className="rounded" />
                            <span className="text-xs text-red-700 font-medium">
                              Override — send to principal for approval before reconciliation
                            </span>
                          </label>
                          {dupOverride && (
                            <div className="mt-2">
                              <label className="block text-xs font-medium text-red-700 mb-1">
                                Reason for override <span className="text-red-500">*</span>
                              </label>
                              <textarea
                                className="w-full px-2 py-1.5 rounded-lg border border-red-300 text-xs focus:outline-none focus:ring-2 focus:ring-red-300/40 bg-white"
                                rows={2}
                                placeholder="Explain why this duplicate reference should be allowed…"
                                value={dupOverrideComment}
                                onChange={e => setDupOverrideComment(e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    )}
                  </div>

                  {/* Screenshot upload — for UPI/online/bank */}
                  {needsRef && (
                    <div className="mt-4">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Transaction Screenshot (optional)
                      </label>
                      <input type="file" accept="image/*,.pdf"
                        className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleScreenshotUpload(f); }} />
                      {screenshotUploading && <p className="text-xs text-gray-400 mt-1">Uploading…</p>}
                      {screenshotUrl && <p className="text-xs text-green-600 mt-1">✓ Screenshot uploaded</p>}
                    </div>
                  )}

                  {/* Reconciliation notice for online payments */}
                  {needsRef && (
                    <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
                      <p className="text-xs font-semibold text-blue-800">ℹ Receipt generated after reconciliation</p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        For UPI/online/bank payments, the receipt is released only after the payment is verified against the bank statement.
                      </p>
                    </div>
                  )}

                  {payError && <p className="text-xs text-red-500 mt-3">{payError}</p>}

                  {payResult && (
                    <div className={`mt-3 p-3 rounded-lg border ${payResult.needs_reconciliation ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                      <p className={`text-xs font-semibold mb-1 ${payResult.needs_reconciliation ? 'text-amber-700' : 'text-green-700'}`}>
                        {payResult.needs_reconciliation
                          ? `⏳ Payment recorded — Receipt #${payResult.receipt_number} pending reconciliation`
                          : `✓ Payment recorded — Receipt #${payResult.receipt_number}`}
                      </p>
                      {payResult.receipt_url && (
                        <a href={payResult.receipt_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 underline font-medium">Download Receipt</a>
                      )}
                      {payResult.needs_reconciliation && (
                        <p className="text-xs text-amber-600 mt-1">Receipt will be available after bank reconciliation.</p>
                      )}
                    </div>
                  )}

                  <div className="mt-4">
                    <Button onClick={handlePayment} disabled={payLoading || !canSubmit}>
                      {payLoading ? 'Processing…' : `Record ₹${amtNum > 0 ? amtNum.toLocaleString('en-IN') : '0'} Payment`}
                    </Button>
                  </div>
                </Card>
              )}
            </>
          ) : null}

          {/* Payment history */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Payment History</h2>
            {cancelMsg && <p className="text-xs text-green-600 mb-3">{cancelMsg}</p>}
            {historyLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-medium text-gray-500">
                      <th className="py-2 px-2 w-8">#</th>
                      <th className="text-left py-2 px-3">Receipt #</th>
                      <th className="text-left py-2 px-3">Fee Head</th>
                      <th className="text-right py-2 px-3">Amount</th>
                      <th className="text-center py-2 px-3">Mode</th>
                      <th className="text-center py-2 px-3">Date</th>
                      <th className="text-left py-2 px-3">Collected by</th>
                      <th className="text-left py-2 px-3">Reconciled</th>
                      <th className="text-center py-2 px-3">Receipt</th>
                      <th className="text-center py-2 px-3">Cancel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((p, idx) => (
                      <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50 ${p.cancel_status === 'pending_approval' ? 'bg-red-50/30' : ''}`}>
                        <td className="py-2 px-2 text-center text-xs text-gray-400">{idx + 1}</td>
                        <td className="py-2 px-3 text-gray-600 text-xs font-mono">{p.receipt_number}</td>
                        <td className="py-2 px-3 text-gray-700 text-xs">{p.fee_head_name || '—'}</td>
                        <td className="py-2 px-3 text-right font-semibold text-gray-800">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{p.payment_mode}</span>
                        </td>
                        <td className="py-2 px-3 text-center text-gray-600 text-xs">
                          {new Date(p.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-2 px-3 text-xs">
                          {p.collected_by_name ? (
                            <div>
                              <p className="text-gray-700 font-medium">{p.collected_by_name}</p>
                              <p className="text-gray-400 capitalize">{p.collected_by_role?.replace('_', ' ')}</p>
                              {p.created_at && (
                                <p className="text-gray-400">
                                  {new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">Online / System</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs">
                          {p.needs_reconciliation ? (
                            p.reconciled_at ? (
                              <div>
                                <p className="text-green-700 font-medium">✓ Reconciled</p>
                                <p className="text-gray-500">
                                  {new Date(p.reconciled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  {p.reconciled_by_name && ` · ${p.reconciled_by_name}`}
                                  {p.reconciled_by_role && ` (${p.reconciled_by_role.replace(/_/g, ' ')})`}
                                </p>
                              </div>
                            ) : (
                              <span className="text-amber-600 font-medium">⏳ Pending</span>
                            )
                          ) : (
                            <span className="text-gray-400 text-xs">Cash — N/A</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {p.receipt_url ? (
                            <a href={p.receipt_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 underline">Download</a>
                          ) : p.needs_reconciliation && !p.reconciled_at ? (
                            <span className="text-xs text-amber-500">After reconciliation</span>
                          ) : '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {p.cancel_status === 'pending_approval' ? (
                            <span className="text-xs text-red-500 font-medium">⏳ Pending principal</span>
                          ) : !p.cancel_status ? (
                            <button
                              onClick={() => { setCancelTarget(p); setCancelReason(''); setCancelMsg(''); }}
                              className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                            >
                              Request Cancel
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                    {/* Cancelled payments audit trail */}
                    {cancellations.map(c => (
                      <tr key={c.id} className="border-b border-gray-50 bg-red-50/20">
                        <td className="py-2 px-2 text-center text-xs text-gray-300">—</td>
                        <td className="py-2 px-3 text-xs font-mono text-red-400 line-through">{c.receipt_number}</td>
                        <td className="py-2 px-3 text-xs text-gray-400">{c.fee_head_name || '—'}</td>
                        <td className="py-2 px-3 text-right text-xs text-red-400 line-through">₹{Number(c.amount).toLocaleString('en-IN')}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-500">cancelled</span>
                        </td>
                        <td className="py-2 px-3 text-center text-xs text-gray-400">
                          {new Date(c.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-400" colSpan={2}>
                          <p>Cancelled by {c.requested_by_name || '—'}</p>
                          <p>Approved by {c.approved_by_name || '—'} · {new Date(c.approved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          <p className="text-red-400 italic">Reason: {c.cancel_reason}</p>
                        </td>
                        <td className="py-2 px-3 text-center text-xs text-gray-300">—</td>
                        <td />
                      </tr>
                    ))}
                    {history.length === 0 && cancellations.length === 0 && (
                      <tr><td colSpan={10} className="py-6 text-center text-gray-400 text-sm">No payment history</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Cancel request modal */}
          {cancelTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border-2 border-red-200">
                <h2 className="font-bold text-red-700 text-lg mb-1">Request Receipt Cancellation</h2>
                <p className="text-sm text-gray-600 mb-1">
                  Receipt <span className="font-mono font-medium">{cancelTarget.receipt_number}</span>
                  {' · '}₹{Number(cancelTarget.amount).toLocaleString('en-IN')}
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-700">
                  This will be sent to the Principal for approval. Once approved, the payment will be permanently deleted and the student's outstanding balance will be restored.
                </div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Reason for cancellation <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none mb-3"
                  rows={3}
                  placeholder="Explain why this receipt needs to be cancelled…"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setCancelTarget(null)} disabled={cancelLoading}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
                    disabled={!cancelReason.trim() || cancelLoading}
                    onClick={async () => {
                      setCancelLoading(true);
                      try {
                        await apiPost(`/api/v1/financial/payments/${cancelTarget.id}/request-cancel`, { reason: cancelReason.trim() }, token);
                        setCancelMsg(`✓ Cancellation request sent to Principal for ${cancelTarget.receipt_number}`);
                        setCancelTarget(null);
                        if (selectedStudent) await loadHistory(selectedStudent.id);
                      } catch (err: unknown) {
                        setCancelMsg(err instanceof Error ? err.message : 'Failed to submit request.');
                      } finally {
                        setCancelLoading(false);
                      }
                    }}
                  >
                    {cancelLoading ? 'Submitting…' : 'Submit Request'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

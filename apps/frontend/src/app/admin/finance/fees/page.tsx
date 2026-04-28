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
  const [historyLoading, setHistoryLoading] = useState(false);

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
      const data = await apiGet<Payment[]>(`/api/v1/financial/payments/student/${studentId}`, token);
      setHistory(Array.isArray(data) ? data : []);
    } catch { setHistory([]); }
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
                  <span className="text-xs text-gray-500">
                    Total outstanding: <strong className="text-primary">₹{invoice.net_payable.toLocaleString('en-IN')}</strong>
                  </span>
                </div>
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
                      <th className="text-center py-2 px-3">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((p, idx) => (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
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
                        <td className="py-2 px-3 text-center">
                          {p.receipt_url ? (
                            <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">Download</a>
                          ) : p.needs_reconciliation ? (
                            <span className="text-xs text-amber-600">Pending</span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr><td colSpan={7} className="py-6 text-center text-gray-400 text-sm">No payment history</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

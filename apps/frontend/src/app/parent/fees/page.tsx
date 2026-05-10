'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button } from '@/components/ui';

interface FeeLineItem {
  id: string;
  fee_head_name: string;
  fee_type: string;
  assigned_amount: number;
  outstanding_balance: number;
  status: string;
  due_date?: string;
}

interface Concession {
  id: string;
  fee_head_name: string;
  type: string;
  value: number;
  status: string;
}

interface Invoice {
  student_id: string;
  student_name: string;
  class_name: string;
  accounts: FeeLineItem[];
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
}

interface PaymentProof {
  id: string;
  transaction_id: string;
  amount: number;
  payment_mode: string;
  status: 'pending' | 'matched' | 'rejected';
  submitted_at: string;
  bank_statement_date?: string;
  rejection_reason?: string;
  fee_head_name: string;
  receipt_url?: string;
}

interface SiblingFees {
  student_id: string;
  student_name: string;
  class_name: string;
  outstanding: number;
}

function FeesContent() {
  const token = getToken() || '';
  const searchParams = useSearchParams();
  const studentIdParam = searchParams.get('studentId') || '';

  const [studentId, setStudentId] = useState(studentIdParam);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [history, setHistory] = useState<Payment[]>([]);
  const [siblings, setSiblings] = useState<SiblingFees[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Payment modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payFeeHeadId, setPayFeeHeadId] = useState('');
  const [payTransactionId, setPayTransactionId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('upi');
  const [payNotes, setPayNotes] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');

  // Payment proofs
  const [proofs, setProofs] = useState<PaymentProof[]>([]);

  useEffect(() => {
    if (studentId) {
      loadInvoice(studentId);
      loadHistory(studentId);
      loadProofs(studentId);
    }
    loadSiblings();
  }, [studentId]);

  async function loadInvoice(sid: string) {
    setLoading(true);
    try {
      const data = await apiGet<Invoice>(`/api/v1/parent/fees/invoice/${sid}`, token);
      setInvoice(data);
    } catch { setInvoice(null); }
    finally { setLoading(false); }
  }

  async function loadHistory(sid: string) {
    setHistoryLoading(true);
    try {
      const data = await apiGet<Payment[]>(`/api/v1/parent/fees/history/${sid}`, token);
      setHistory(Array.isArray(data) ? data : []);
    } catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  }

  async function loadSiblings() {
    try {
      const data = await apiGet<SiblingFees[]>('/api/v1/parent/fees/siblings', token);
      setSiblings(Array.isArray(data) ? data : []);
    } catch { setSiblings([]); }
  }

  async function loadProofs(sid: string) {
    try {
      const data = await apiGet<PaymentProof[]>(`/api/v1/parent/fees/payment-proofs/${sid}`, token);
      setProofs(Array.isArray(data) ? data : []);
    } catch { setProofs([]); }
  }

  async function handleSubmitPayment() {
    setPayError('');
    if (!payFeeHeadId) { setPayError('Select a fee head.'); return; }
    if (!payTransactionId.trim()) { setPayError('Enter your transaction / UTR ID.'); return; }
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { setPayError('Enter the amount you paid.'); return; }
    setPayLoading(true);
    try {
      await apiPost('/api/v1/parent/fees/payment-proof', {
        student_id: studentId,
        fee_head_id: payFeeHeadId,
        transaction_id: payTransactionId.trim(),
        amount: amt,
        payment_mode: payMode,
        notes: payNotes.trim() || undefined,
      }, token);
      setPaySuccess('✓ Payment submitted for verification. Your receipt will be released once verified by the school.');
      setShowPayModal(false);
      setPayTransactionId('');
      setPayAmount('');
      setPayNotes('');
      await loadProofs(studentId);
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setPayLoading(false);
    }
  }

  if (!studentId) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-semibold text-primary mb-4">My Fees</h1>
        <Card>
          <p className="text-sm text-gray-500 mb-3">Enter your student ID to view fees:</p>
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm"
              placeholder="Student ID"
              onKeyDown={e => { if (e.key === 'Enter') setStudentId((e.target as HTMLInputElement).value); }}
            />
            <Button size="sm" onClick={(e) => {
              const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
              if (input) setStudentId(input.value);
            }}>View</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-primary">My Fees</h1>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading fee details…</p>
      ) : invoice ? (
        <>
          {/* Invoice header */}
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-gray-800">{invoice.student_name}</p>
                <p className="text-xs text-gray-500">{invoice.class_name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Net Payable</p>
                <p className="text-2xl font-bold text-primary">₹{invoice.net_payable.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-2 mb-4">
              {invoice.accounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{acc.fee_head_name}</p>
                    <p className="text-xs text-gray-500">
                      {acc.fee_type}
                      {acc.due_date && ` · Due ${new Date(acc.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">₹{acc.outstanding_balance.toLocaleString('en-IN')}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      acc.status === 'paid' ? 'bg-green-100 text-green-700' :
                      acc.status === 'overdue' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{acc.status}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Concessions */}
            {invoice.concessions.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-600 mb-2">Concessions Applied</p>
                {invoice.concessions.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm py-1">
                    <span className="text-gray-600">{c.fee_head_name} ({c.type === 'fixed' ? `₹${c.value}` : `${c.value}%`})</span>
                    <span className="text-green-600 font-medium">- Applied</span>
                  </div>
                ))}
              </div>
            )}

            {/* Credit balance */}
            {invoice.credit_balance > 0 && (
              <div className="flex items-center justify-between text-sm py-2 border-t border-gray-100">
                <span className="text-gray-600">Credit Balance</span>
                <span className="text-green-600 font-medium">- ₹{invoice.credit_balance.toLocaleString('en-IN')}</span>
              </div>
            )}

            {/* Totals */}
            <div className="border-t border-gray-100 pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Gross Payable</span>
                <span className="text-gray-800">₹{invoice.gross_payable.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span className="text-gray-800">Net Payable</span>
                <span className="text-primary">₹{invoice.net_payable.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Pay button */}
            {invoice.net_payable > 0 && (
              <div className="mt-4">
                <Button onClick={() => {
                  setShowPayModal(true);
                  setPayFeeHeadId(invoice.accounts.find(a => a.status !== 'paid')?.id || '');
                  setPayAmount('');
                  setPayTransactionId('');
                  setPayError('');
                }}>
                  Submit Online Payment
                </Button>
              </div>
            )}
            {paySuccess && <p className="text-xs text-green-600 mt-2">{paySuccess}</p>}
          </Card>

          {/* Payment history */}
          <Card className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Payment History</h2>
            {historyLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : (
              <div className="space-y-2">
                {history.map(p => (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                    (p as any).needs_reconciliation && !p.receipt_url
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-gray-50 border-gray-100'
                  }`}>
                    <div>
                      <p className="text-sm font-medium text-gray-800">₹{p.amount.toLocaleString('en-IN')}</p>
                      <p className="text-xs text-gray-500">
                        {p.payment_mode} · {new Date(p.payment_date).toLocaleDateString('en-IN')}
                        {p.fee_head_name && ` · ${p.fee_head_name}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">#{p.receipt_number}</p>
                      {p.receipt_url ? (
                        <a href={p.receipt_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 underline">Receipt</a>
                      ) : (p as any).needs_reconciliation ? (
                        <div>
                          <span className="text-xs text-amber-600 font-medium">⏳ Reconciliation pending</span>
                          <p className="text-xs text-amber-500 mt-0.5">Contact school admin</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                  <p className="text-sm text-gray-400 py-4 text-center">No payment history</p>
                )}
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <p className="text-sm text-gray-400 py-6 text-center">No fee details found.</p>
        </Card>
      )}

      {/* Payment submission status */}
      {proofs.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Submitted Payments</h2>
          <div className="space-y-2">
            {proofs.map(p => (
              <div key={p.id} className={`flex items-start justify-between p-3 rounded-lg border ${
                p.status === 'matched' ? 'bg-green-50 border-green-200' :
                p.status === 'rejected' ? 'bg-red-50 border-red-200' :
                'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{p.fee_head_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.status === 'matched' ? 'bg-green-100 text-green-700' :
                      p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {p.status === 'matched' ? '✓ Verified' : p.status === 'rejected' ? '✗ Rejected' : '⏳ Pending verification'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ₹{Number(p.amount).toLocaleString('en-IN')} · Txn: {p.transaction_id} · {p.payment_mode.toUpperCase()}
                  </p>
                  {p.status === 'rejected' && p.rejection_reason && (
                    <p className="text-xs text-red-600 mt-1">Reason: {p.rejection_reason}</p>
                  )}
                  {p.status === 'matched' && p.bank_statement_date && (
                    <p className="text-xs text-green-600 mt-1">
                      Verified on {new Date(p.bank_statement_date).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
                {p.status === 'matched' && p.receipt_url && (
                  <a href={p.receipt_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 underline ml-3 shrink-0">Receipt</a>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Sibling view */}
      {siblings.length > 1 && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">All Children — Outstanding Summary</h2>
          <div className="space-y-2">
            {siblings.map(s => (
              <div key={s.student_id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.student_name}</p>
                  <p className="text-xs text-gray-500">{s.class_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">₹{s.outstanding.toLocaleString('en-IN')}</p>
                  {s.student_id !== studentId && (
                    <button onClick={() => setStudentId(s.student_id)}
                      className="text-xs text-blue-600 underline">View</button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-700">Total Outstanding</span>
              <span className="text-sm font-bold text-primary">
                ₹{siblings.reduce((sum, s) => sum + s.outstanding, 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Non-refundable notice modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Submit Online Payment</h2>
            <p className="text-xs text-gray-500 mb-4">
              After paying via UPI or bank transfer, enter your transaction details below. The school will verify and release your receipt.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fee Head</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={payFeeHeadId} onChange={e => setPayFeeHeadId(e.target.value)}>
                  <option value="">Select fee head…</option>
                  {invoice?.accounts.filter(a => a.status !== 'paid').map(a => (
                    <option key={a.id} value={a.id}>
                      {a.fee_head_name} — ₹{Number(a.outstanding_balance).toLocaleString('en-IN')} due
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={payMode} onChange={e => setPayMode(e.target.value)}>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer / NEFT / RTGS</option>
                  <option value="online">Other Online</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Transaction / UTR / Reference ID
                </label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. 123456789012 or UPI ref"
                  value={payTransactionId} onChange={e => setPayTransactionId(e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">This must exactly match what appears in your bank statement</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount Paid (₹)</label>
                <input type="number" min="1" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="0"
                  value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Any additional info for the school"
                  value={payNotes} onChange={e => setPayNotes(e.target.value)} />
              </div>
            </div>

            {payError && <p className="text-xs text-red-500 mt-3">{payError}</p>}
            <div className="flex gap-3 mt-4">
              <Button onClick={handleSubmitPayment} disabled={payLoading}>
                {payLoading ? 'Submitting…' : 'Submit Payment'}
              </Button>
              <Button variant="ghost" onClick={() => setShowPayModal(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ParentFeesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading…</div>}>
      <FeesContent />
    </Suspense>
  );
}

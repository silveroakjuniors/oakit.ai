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
  const [acknowledged, setAcknowledged] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');

  useEffect(() => {
    if (studentId) {
      loadInvoice(studentId);
      loadHistory(studentId);
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

  async function handlePay() {
    if (!acknowledged) { setPayError('Please acknowledge the non-refundable notice.'); return; }
    setPayError('');
    setPayLoading(true);
    try {
      const result = await apiPost<{ payment_url?: string; message?: string }>(
        `/api/v1/parent/fees/pay/${studentId}`,
        { acknowledged: true },
        token
      );
      if (result.payment_url) {
        window.location.href = result.payment_url;
      } else {
        setPaySuccess(result.message || 'Payment initiated.');
        setShowPayModal(false);
      }
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : 'Payment failed.');
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
                <Button onClick={() => { setShowPayModal(true); setAcknowledged(false); setPayError(''); }}>
                  Pay Online
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
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-800">₹{p.amount.toLocaleString('en-IN')}</p>
                      <p className="text-xs text-gray-500">
                        {p.payment_mode} · {new Date(p.payment_date).toLocaleDateString('en-IN')}
                        {p.fee_head_name && ` · ${p.fee_head_name}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">#{p.receipt_number}</p>
                      {p.receipt_url && (
                        <a href={p.receipt_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 underline">Receipt</a>
                      )}
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
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Online Payment</h2>
            <div className="p-4 rounded-lg border-2 border-red-400 bg-red-50 mb-4">
              <p className="text-sm font-semibold text-red-700 mb-2">⚠️ Non-Refundable Notice</p>
              <p className="text-sm text-red-600">
                Fees once paid cannot be refunded under any circumstances. Please ensure the amount is correct before proceeding.
              </p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={e => setAcknowledged(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm text-gray-700">
                I have read and understood the non-refundable policy and wish to proceed with the payment.
              </span>
            </label>
            {payError && <p className="text-xs text-red-500 mb-3">{payError}</p>}
            <div className="flex gap-3">
              <Button onClick={handlePay} disabled={payLoading || !acknowledged}>
                {payLoading ? 'Processing…' : 'Proceed to Pay'}
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

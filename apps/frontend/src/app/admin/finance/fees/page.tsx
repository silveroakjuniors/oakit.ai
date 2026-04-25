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
}

interface FeeAccount {
  id: string;
  fee_head_id: string;
  fee_head_name: string;
  assigned_amount: number;
  outstanding_balance: number;
  status: string;
}

interface Invoice {
  student_id: string;
  student_name: string;
  accounts: FeeAccount[];
  total_outstanding: number;
  credit_balance: number;
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

export default function FeesPage() {
  const token = getToken() || '';
  const { today } = useAcademicCalendar(token);

  // Student search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Invoice
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // Payment form
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [feeHeadId, setFeeHeadId] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');

  // Payment history
  const [history, setHistory] = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Search students with debounce
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

  async function selectStudent(student: Student) {
    setSelectedStudent(student);
    setShowDropdown(false);
    setSearchQuery(student.name);
    setReceiptUrl('');
    setPayError('');
    await loadInvoice(student.id);
    await loadHistory(student.id);
  }

  async function loadInvoice(studentId: string) {
    setInvoiceLoading(true);
    try {
      const data = await apiGet<Invoice>(`/api/v1/financial/payments/invoice/${studentId}`, token);
      setInvoice(data);
      if (data.accounts.length > 0) setFeeHeadId(data.accounts[0].fee_head_id);
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

  async function handlePayment() {
    if (!selectedStudent) return;
    setPayError('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setPayError('Enter a valid amount.'); return; }
    if (!feeHeadId) { setPayError('Select a fee head.'); return; }
    setPayLoading(true);
    try {
      const result = await apiPost<{ receipt_url?: string; receipt_number?: string }>(
        '/api/v1/financial/payments',
        {
          student_id: selectedStudent.id,
          fee_head_id: feeHeadId,
          amount: amt,
          payment_mode: paymentMode,
          payment_date: paymentDate,
          reference_number: referenceNumber || undefined,
        },
        token
      );
      setReceiptUrl(result.receipt_url || '');
      setAmount('');
      setReferenceNumber('');
      await loadInvoice(selectedStudent.id);
      await loadHistory(selectedStudent.id);
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : 'Payment failed.');
    } finally {
      setPayLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-primary">Fee Collection</h1>
      </div>

      {/* Non-refundable notice */}
      <div className="mb-6 p-4 rounded-lg border-2 border-red-400 bg-red-50">
        <p className="text-sm font-semibold text-red-700">
          ⚠️ Please note: Fees once paid cannot be refunded under any circumstances.
        </p>
      </div>

      {/* Student search */}
      <Card className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Search Student</h2>
        <div className="relative">
          <input
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Type student name…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
          />
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map(s => (
                <button
                  key={s.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                  onClick={() => selectStudent(s)}
                >
                  <span className="font-medium text-gray-800">{s.name}</span>
                  {s.class_name && <span className="text-gray-500 ml-2 text-xs">{s.class_name}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Invoice */}
      {selectedStudent && (
        <>
          {invoiceLoading ? (
            <p className="text-sm text-gray-400 mb-4">Loading invoice…</p>
          ) : invoice ? (
            <Card className="mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Outstanding Balance — {invoice.student_name}
              </h2>
              <div className="space-y-2 mb-4">
                {invoice.accounts.map(acc => (
                  <div key={acc.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{acc.fee_head_name}</p>
                      <p className="text-xs text-gray-500">Assigned: ₹{acc.assigned_amount.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-800">
                        ₹{acc.outstanding_balance.toLocaleString('en-IN')}
                      </p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        acc.status === 'paid' ? 'bg-green-100 text-green-700' :
                        acc.status === 'overdue' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{acc.status}</span>
                    </div>
                  </div>
                ))}
              </div>
              {invoice.credit_balance > 0 && (
                <p className="text-xs text-green-600 mb-2">
                  Credit balance: ₹{invoice.credit_balance.toLocaleString('en-IN')} (will be applied)
                </p>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <span className="text-sm font-semibold text-gray-700">Net Payable</span>
                <span className="text-lg font-bold text-primary">
                  ₹{invoice.net_payable.toLocaleString('en-IN')}
                </span>
              </div>
            </Card>
          ) : null}

          {/* Payment form */}
          <Card className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Record Payment</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fee Head</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={feeHeadId}
                  onChange={e => setFeeHeadId(e.target.value)}
                >
                  {invoice?.accounts.map(acc => (
                    <option key={acc.fee_head_id} value={acc.fee_head_id}>{acc.fee_head_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Mode</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="online">Online</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Date</label>
                <input
                  type="date"
                  max={today}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Reference Number (optional)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="UTR / transaction ID"
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                />
              </div>
            </div>
            {payError && <p className="text-xs text-red-500 mt-3">{payError}</p>}
            {receiptUrl && (
              <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <p className="text-xs text-green-700 font-medium mb-1">✓ Payment recorded successfully</p>
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 underline"
                >
                  Download Receipt
                </a>
              </div>
            )}
            <div className="mt-4">
              <Button onClick={handlePayment} disabled={payLoading}>
                {payLoading ? 'Processing…' : 'Record Payment'}
              </Button>
            </div>
          </Card>

          {/* Payment history */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Payment History</h2>
            {historyLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-2 px-2 text-xs font-medium text-gray-400 w-8">#</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Receipt #</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Fee Head</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Amount</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Mode</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Date</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((p, idx) => (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-2 text-center text-xs text-gray-400">{idx + 1}</td>
                        <td className="py-2 px-3 text-gray-600 text-xs">{p.receipt_number}</td>
                        <td className="py-2 px-3 text-gray-700">{p.fee_head_name || '—'}</td>
                        <td className="py-2 px-3 text-right font-medium text-gray-800">
                          ₹{p.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {p.payment_mode}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center text-gray-600 text-xs">
                          {new Date(p.payment_date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {p.receipt_url ? (
                            <a href={p.receipt_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 underline">Download</a>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-gray-400 text-sm">
                          No payment history
                        </td>
                      </tr>
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

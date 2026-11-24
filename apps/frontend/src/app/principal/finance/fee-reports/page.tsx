'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card } from '@/components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClassRow    { class_name: string; total_collected: number; total_pending: number }
interface FeeTypeRow  { fee_type: string; fee_head_name: string; student_count: number; total_assigned: number; total_paid: number; total_outstanding: number; collection_pct: number }
interface InstRow     { class_name: string; fee_head_name: string; instalment_label: string; instalment_number: number; due_date: string; instalment_amount: number; total_students: number; students_paid: number; students_pending: number; amount_collected: number; amount_pending: number }
interface PaidRow     { sl_no: number; receipt_number: string; student_name: string; class_name: string; fee_head_name: string; fee_type: string; amount: number; payment_mode: string; payment_date: string; reference_number: string; reconciliation_status: string; notes?: string }
interface PendingRow  { sl_no: number; student_name: string; class_name: string; fee_head_name: string; fee_type: string; assigned_amount: number; outstanding_balance: number; total_paid: number; status: string; next_due_date?: string; next_instalment_label?: string; next_instalment_amount?: number }
interface SummaryData { total_collected: number; total_assigned: number; total_outstanding: number; instalments: any[] }

type Tab = 'summary' | 'class' | 'fee-type' | 'instalment' | 'paid' | 'pending';

const TABS: { id: Tab; label: string }[] = [
  { id: 'summary',    label: 'Overview' },
  { id: 'class',      label: 'Class-wise' },
  { id: 'fee-type',   label: 'Fee Type-wise' },
  { id: 'instalment', label: 'Instalment Status' },
  { id: 'paid',       label: 'Paid Detail' },
  { id: 'pending',    label: 'Pending Detail' },
];

function fmt(n: number | string) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function pct(paid: number, total: number) {
  if (!total) return '0%';
  return Math.round(paid / total * 100) + '%';
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid:           'bg-green-100 text-green-700',
    partially_paid: 'bg-blue-100 text-blue-700',
    pending:        'bg-yellow-100 text-yellow-700',
    overdue:        'bg-red-100 text-red-700',
    cancelled:      'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${map[status] || 'bg-gray-100 text-gray-500'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function FeeReportsPage() {
  const token = getToken() || '';
  const [tab, setTab] = useState<Tab>('summary');

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');
  const [classFilter, setClassFilter] = useState('');

  // Data
  const [summary,    setSummary]    = useState<SummaryData | null>(null);
  const [classData,  setClassData]  = useState<ClassRow[]>([]);
  const [feeTypes,   setFeeTypes]   = useState<FeeTypeRow[]>([]);
  const [instData,   setInstData]   = useState<InstRow[]>([]);
  const [paidData,   setPaidData]   = useState<PaidRow[]>([]);
  const [pendingData,setPendingData]= useState<PendingRow[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  // Classes for filter
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    apiGet<{ id: string; name: string }[]>('/api/v1/admin/classes', token)
      .then(d => setClasses(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [tab, fromDate, toDate, classFilter]);

  async function load() {
    setError(''); setLoading(true);
    try {
      const p = new URLSearchParams();
      if (fromDate)    p.set('from', fromDate);
      if (toDate)      p.set('to',   toDate);
      if (classFilter) p.set('class_id', classFilter);

      switch (tab) {
        case 'summary':
          setSummary(await apiGet<SummaryData>(`/api/v1/financial/reports/fee-summary`, token));
          break;
        case 'class':
          setClassData(await apiGet<ClassRow[]>(`/api/v1/financial/reports/class-collection?${p}`, token));
          break;
        case 'fee-type':
          setFeeTypes(await apiGet<FeeTypeRow[]>(`/api/v1/financial/reports/fee-type-collection?${p}`, token));
          break;
        case 'instalment':
          setInstData(await apiGet<InstRow[]>(`/api/v1/financial/reports/instalment-status?${p}`, token));
          break;
        case 'paid':
          setPaidData(await apiGet<PaidRow[]>(`/api/v1/financial/reports/paid-detail?${p}`, token));
          break;
        case 'pending':
          setPendingData(await apiGet<PendingRow[]>(`/api/v1/financial/reports/pending-detail?${p}`, token));
          break;
      }
    } catch (e: any) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  // ── Summary helpers ──────────────────────────────────────────────────────────
  const collectionPct = summary
    ? Math.round(summary.total_collected / (summary.total_assigned || 1) * 100)
    : 0;

  return (
    <div className="p-4 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-primary">Fee Reports</h1>
        <p className="text-xs text-gray-400 mt-0.5">Comprehensive fee collection analysis — visible to Principal only</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto bg-neutral-100 rounded-xl p-1 mb-5 no-scrollbar">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${tab === t.id ? 'bg-white text-primary shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters (shown on relevant tabs) */}
      {['paid','pending','class','fee-type','instalment'].includes(tab) && (
        <div className="flex flex-wrap gap-3 mb-4 items-end">
          {['paid'].includes(tab) && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                <input type="date" className="px-3 py-2 rounded-lg border border-gray-200 text-xs"
                  value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                <input type="date" className="px-3 py-2 rounded-lg border border-gray-200 text-xs"
                  value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </>
          )}
          {['pending','instalment','class','fee-type'].includes(tab) && classes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Class</label>
              <select className="px-3 py-2 rounded-lg border border-gray-200 text-xs"
                value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>}
      {loading && <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>}

      {!loading && (
        <>
          {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
          {tab === 'summary' && summary && (
            <div className="space-y-5">
              {/* Top stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <p className="text-xs text-gray-400 font-medium">Total Assigned</p>
                  <p className="text-xl font-bold text-gray-800 mt-1">{fmt(summary.total_assigned)}</p>
                </Card>
                <Card>
                  <p className="text-xs text-gray-400 font-medium">Total Collected</p>
                  <p className="text-xl font-bold text-green-600 mt-1">{fmt(summary.total_collected)}</p>
                </Card>
                <Card>
                  <p className="text-xs text-gray-400 font-medium">Outstanding</p>
                  <p className="text-xl font-bold text-amber-600 mt-1">{fmt(summary.total_outstanding)}</p>
                </Card>
                <Card>
                  <p className="text-xs text-gray-400 font-medium">Collection Rate</p>
                  <p className={`text-xl font-bold mt-1 ${collectionPct >= 75 ? 'text-green-600' : collectionPct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{collectionPct}%</p>
                </Card>
              </div>

              {/* Collection bar */}
              <Card>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Overall Collection Progress</p>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${collectionPct >= 75 ? 'bg-green-500' : collectionPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${collectionPct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                  <span>{fmt(summary.total_collected)} collected</span>
                  <span>{fmt(summary.total_outstanding)} pending</span>
                </div>
              </Card>

              {/* Instalment-wise summary */}
              {summary.instalments.length > 0 && (
                <Card>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Instalment-wise Summary</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-400">
                          <th className="text-left py-2 px-3">Instalment</th>
                          <th className="text-left py-2 px-3">Fee Head</th>
                          <th className="text-center py-2 px-3">Due Date</th>
                          <th className="text-center py-2 px-3">Students</th>
                          <th className="text-right py-2 px-3">Total Due</th>
                          <th className="text-right py-2 px-3">Collected</th>
                          <th className="text-right py-2 px-3">Pending</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.instalments.map((inst, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-3 font-semibold text-gray-700">{inst.label}</td>
                            <td className="py-2 px-3 text-gray-500">{inst.fee_head_name}</td>
                            <td className="py-2 px-3 text-center text-gray-500">
                              {inst.due_date ? new Date(inst.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                            </td>
                            <td className="py-2 px-3 text-center text-gray-600">{inst.student_count}</td>
                            <td className="py-2 px-3 text-right font-medium text-gray-700">{fmt(inst.total_instalment_amount)}</td>
                            <td className="py-2 px-3 text-right font-bold text-green-600">{fmt(inst.total_paid)}</td>
                            <td className={`py-2 px-3 text-right font-bold ${inst.total_pending > 0 ? 'text-amber-600' : 'text-green-500'}`}>{fmt(inst.total_pending)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ── CLASS-WISE ───────────────────────────────────────────────────── */}
          {tab === 'class' && (
            <Card>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Collection by Class</p>
              {classData.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center">No data</p> : (
                <div className="space-y-3">
                  {classData.map((row, i) => {
                    const total = row.total_collected + row.total_pending;
                    const p = total > 0 ? Math.round(row.total_collected / total * 100) : 0;
                    return (
                      <div key={i} className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-bold text-gray-800">{row.class_name || 'No Class'}</p>
                          <span className={`text-xs font-bold ${p >= 75 ? 'text-green-600' : 'text-amber-600'}`}>{p}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                          <div className={`h-full rounded-full ${p >= 75 ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${p}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Collected: <span className="font-semibold text-green-600">{fmt(row.total_collected)}</span></span>
                          <span>Pending: <span className="font-semibold text-amber-600">{fmt(row.total_pending)}</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* ── FEE TYPE-WISE ────────────────────────────────────────────────── */}
          {tab === 'fee-type' && (
            <Card>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Collection by Fee Type</p>
              {feeTypes.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center">No data</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400">
                        <th className="text-left py-2 px-3">Fee Head</th>
                        <th className="text-left py-2 px-3">Type</th>
                        <th className="text-center py-2 px-3">Students</th>
                        <th className="text-right py-2 px-3">Assigned</th>
                        <th className="text-right py-2 px-3">Collected</th>
                        <th className="text-right py-2 px-3">Outstanding</th>
                        <th className="text-center py-2 px-3">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeTypes.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-3 font-semibold text-gray-700">{r.fee_head_name}</td>
                          <td className="py-2 px-3">
                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium capitalize">{r.fee_type?.replace(/_/g,' ')}</span>
                          </td>
                          <td className="py-2 px-3 text-center text-gray-600">{r.student_count}</td>
                          <td className="py-2 px-3 text-right text-gray-600">{fmt(r.total_assigned)}</td>
                          <td className="py-2 px-3 text-right font-bold text-green-600">{fmt(r.total_paid)}</td>
                          <td className={`py-2 px-3 text-right font-bold ${Number(r.total_outstanding) > 0 ? 'text-amber-600' : 'text-green-500'}`}>{fmt(r.total_outstanding)}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`font-bold ${Number(r.collection_pct) >= 75 ? 'text-green-600' : 'text-amber-600'}`}>{r.collection_pct}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* ── INSTALMENT STATUS ────────────────────────────────────────────── */}
          {tab === 'instalment' && (
            <Card>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Instalment-wise Paid vs Pending</p>
              {instData.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center">No instalment data</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400">
                        <th className="text-left py-2 px-3">Class</th>
                        <th className="text-left py-2 px-3">Fee Head</th>
                        <th className="text-left py-2 px-3">Instalment</th>
                        <th className="text-center py-2 px-3">Due</th>
                        <th className="text-right py-2 px-3">Per Student</th>
                        <th className="text-center py-2 px-3">Paid</th>
                        <th className="text-center py-2 px-3">Pending</th>
                        <th className="text-right py-2 px-3">Collected</th>
                        <th className="text-right py-2 px-3">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instData.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-700">{r.class_name}</td>
                          <td className="py-2 px-3 text-gray-500">{r.fee_head_name}</td>
                          <td className="py-2 px-3 font-semibold text-gray-700">{r.instalment_label}</td>
                          <td className="py-2 px-3 text-center text-gray-500">
                            {r.due_date ? new Date(r.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-600">{fmt(r.instalment_amount)}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="text-green-600 font-bold">{r.students_paid}</span>
                            <span className="text-gray-400">/{r.total_students}</span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`font-bold ${r.students_pending > 0 ? 'text-amber-600' : 'text-green-500'}`}>{r.students_pending}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-green-600">{fmt(r.amount_collected)}</td>
                          <td className={`py-2 px-3 text-right font-bold ${Number(r.amount_pending) > 0 ? 'text-amber-600' : 'text-green-500'}`}>{fmt(r.amount_pending)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* ── PAID DETAIL ──────────────────────────────────────────────────── */}
          {tab === 'paid' && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">All Paid Transactions</p>
                <span className="text-xs text-gray-400">{paidData.length} records · Total: <span className="font-bold text-green-600">{fmt(paidData.reduce((s,r)=>s+Number(r.amount),0))}</span></span>
              </div>
              {paidData.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center">No payments found</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400">
                        <th className="text-left py-2 px-2">#</th>
                        <th className="text-left py-2 px-3">Receipt</th>
                        <th className="text-left py-2 px-3">Student</th>
                        <th className="text-left py-2 px-3">Class</th>
                        <th className="text-left py-2 px-3">Fee Head</th>
                        <th className="text-right py-2 px-3">Amount</th>
                        <th className="text-center py-2 px-3">Mode</th>
                        <th className="text-center py-2 px-3">Date</th>
                        <th className="text-left py-2 px-3">Reference</th>
                        <th className="text-left py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paidData.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-2 text-gray-400">{r.sl_no}</td>
                          <td className="py-2 px-3 font-mono text-gray-600">{r.receipt_number}</td>
                          <td className="py-2 px-3 font-semibold text-gray-700">{r.student_name}</td>
                          <td className="py-2 px-3 text-gray-500">{r.class_name}</td>
                          <td className="py-2 px-3 text-gray-500">{r.fee_head_name}</td>
                          <td className="py-2 px-3 text-right font-bold text-gray-800">{fmt(r.amount)}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium capitalize">{r.payment_mode?.replace(/_/g,' ')}</span>
                          </td>
                          <td className="py-2 px-3 text-center text-gray-500">
                            {new Date(r.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </td>
                          <td className="py-2 px-3 text-gray-400 font-mono">{r.reference_number || '—'}</td>
                          <td className="py-2 px-3">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${r.reconciliation_status === 'Reconciled' ? 'bg-green-100 text-green-700' : r.reconciliation_status?.includes('Pending') ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                              {r.reconciliation_status}
                            </span>
                            {r.notes && <span className="ml-1 text-[9px] text-gray-400 italic">{r.notes}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* ── PENDING DETAIL ───────────────────────────────────────────────── */}
          {tab === 'pending' && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">All Pending Fees</p>
                <span className="text-xs text-gray-400">{pendingData.length} records · Outstanding: <span className="font-bold text-amber-600">{fmt(pendingData.reduce((s,r)=>s+Number(r.outstanding_balance),0))}</span></span>
              </div>
              {pendingData.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center">No pending fees</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400">
                        <th className="text-left py-2 px-2">#</th>
                        <th className="text-left py-2 px-3">Student</th>
                        <th className="text-left py-2 px-3">Class</th>
                        <th className="text-left py-2 px-3">Fee Head</th>
                        <th className="text-right py-2 px-3">Assigned</th>
                        <th className="text-right py-2 px-3">Paid</th>
                        <th className="text-right py-2 px-3">Outstanding</th>
                        <th className="text-center py-2 px-3">Status</th>
                        <th className="text-left py-2 px-3">Next Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingData.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-2 text-gray-400">{r.sl_no}</td>
                          <td className="py-2 px-3 font-semibold text-gray-700">{r.student_name}</td>
                          <td className="py-2 px-3 text-gray-500">{r.class_name}</td>
                          <td className="py-2 px-3 text-gray-500">{r.fee_head_name}</td>
                          <td className="py-2 px-3 text-right text-gray-600">{fmt(r.assigned_amount)}</td>
                          <td className="py-2 px-3 text-right font-bold text-green-600">{fmt(r.total_paid)}</td>
                          <td className="py-2 px-3 text-right font-bold text-amber-600">{fmt(r.outstanding_balance)}</td>
                          <td className="py-2 px-3 text-center"><StatusBadge status={r.status} /></td>
                          <td className="py-2 px-3 text-gray-500">
                            {r.next_instalment_label && (
                              <span>
                                {r.next_instalment_label}
                                {r.next_due_date && ` · ${new Date(r.next_due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                                {r.next_instalment_amount && <span className="font-semibold text-amber-600 ml-1">({fmt(r.next_instalment_amount)})</span>}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

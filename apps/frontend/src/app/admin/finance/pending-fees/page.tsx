'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card } from '@/components/ui';

interface PendingRow {
  sl_no: number;
  student_name: string;
  class_name: string;
  fee_head_name: string;
  fee_type: string;
  assigned_amount: number;
  outstanding_balance: number;
  total_paid: number;
  status: string;
  approved_concession_amount?: number;
  concession_type?: string;
  concession_value?: number;
  next_due_date?: string;
  next_instalment_label?: string;
  next_instalment_amount?: number;
}

function fmt(n: number | string) {
  return 'â‚¹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid:           'bg-green-100 text-green-700',
    partially_paid: 'bg-blue-100 text-blue-700',
    pending:        'bg-yellow-100 text-yellow-700',
    overdue:        'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${map[status] || 'bg-gray-100 text-gray-500'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function AdminPendingFeesPage() {
  const token = getToken() || '';
  const [data, setData] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [feeTypeFilter, setFeeTypeFilter] = useState('');
  const FEE_TYPES = [
    { value: 'tuition', label: 'Tuition' },
    { value: 'admission', label: 'Admission' },
    { value: 'transport', label: 'Transport' },
    { value: 'activity', label: 'Activity' },
    { value: 'custom', label: 'Custom' },
    { value: 'daycare', label: 'Daycare' },
    { value: 'bags_and_books', label: 'Bags & Books' },
  ];
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiGet<{ id: string; name: string }[]>('/api/v1/admin/classes', token)
      .then(d => setClasses(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [classFilter]);

  async function load() {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams();
      if (classFilter) p.set('class_id', classFilter);
      const rows = await apiGet<PendingRow[]>(`/api/v1/financial/reports/pending-detail?${p}`, token);
      setData(Array.isArray(rows) ? rows : []);
    } catch (e: any) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }

  const filtered = search.trim()
    ? data.filter(r => r.student_name.toLowerCase().includes(search.toLowerCase()))
    : data;

  const totalOutstanding = filtered.reduce((s, r) => s + Number(r.outstanding_balance), 0);

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-primary">Pending Fee Report</h1>
        <p className="text-xs text-gray-400 mt-0.5">Students with outstanding fee balances</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Search Student</label>
          <input type="text" className="px-3 py-2 rounded-lg border border-gray-200 text-xs w-44"
            placeholder="Nameâ€¦" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {classes.length > 0 && (
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

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            </p>
            <span className="text-xs text-gray-400">
              Total outstanding: <span className="font-bold text-amber-600">{fmt(totalOutstanding)}</span>
            </span>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No pending fees found</p>
          ) : (
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
                    <th className="text-right py-2 px-3">Concession</th>
                    <th className="text-right py-2 px-3">Outstanding</th>
                    <th className="text-center py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Next Due</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${r.status === 'overdue' ? 'bg-red-50/30' : ''}`}>
                      <td className="py-2 px-2 text-gray-400">{r.sl_no}</td>
                      <td className="py-2 px-3 font-semibold text-gray-700">{r.student_name}</td>
                      <td className="py-2 px-3 text-gray-500">{r.class_name}</td>
                      <td className="py-2 px-3 text-gray-500">{r.fee_head_name}</td>
                      <td className="py-2 px-3 text-right text-gray-600">{fmt(r.assigned_amount)}</td>
                      <td className="py-2 px-3 text-right font-bold text-green-600">{fmt(r.total_paid)}</td>
                      <td className="py-2 px-3 text-right font-bold text-violet-600">
                        {Number(r.approved_concession_amount) > 0
                          ? <span title={r.concession_type === 'percentage' ? `${r.concession_value}%` : undefined}>{fmt(r.approved_concession_amount)}</span>
                          : <span className="text-gray-300">â‚¹0</span>}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-amber-600">{fmt(r.outstanding_balance)}</td>
                      <td className="py-2 px-3 text-center"><StatusBadge status={r.status} /></td>
                      <td className="py-2 px-3 text-gray-500 text-[10px]">
                        {r.next_instalment_label ? (
                          <span>
                            {r.next_instalment_label}
                            {r.next_due_date && ` Â· ${new Date(r.next_due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                            {r.next_instalment_amount && <span className="font-semibold text-amber-600 ml-1">({fmt(r.next_instalment_amount)})</span>}
                          </span>
                        ) : 'â€”'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={7} className="py-2 px-3 text-xs font-bold text-gray-500 text-right">Total Outstanding</td>
                    <td className="py-2 px-3 text-right text-sm font-bold text-amber-600">{fmt(totalOutstanding)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

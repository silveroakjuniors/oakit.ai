'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface DailyCollection { total: number; count: number; }
interface StudentPending { total_pending: number; student_count: number; }

const QUICK_LINKS = [
  { href: '/principal/finance/fee-structures', label: 'Fee Structures', icon: '🏷️', desc: 'Create & assign fee structures' },
  { href: '/principal/finance/concessions',    label: 'Concessions',    icon: '🎁', desc: 'Approve pending concessions' },
  { href: '/principal/finance/expenses',       label: 'Expenses',       icon: '🧾', desc: 'View & add school expenses' },
  { href: '/principal/finance/salary',         label: 'Salary',         icon: '👔', desc: 'Manage staff salaries' },
  { href: '/principal/finance/reconciliation', label: 'Reconciliation', icon: '🔍', desc: 'Bank & cash reconciliation' },
  { href: '/principal/finance/reports',        label: 'Reports',        icon: '📈', desc: 'Financial reports & insights' },
  { href: '/principal/finance/permissions',    label: 'Permissions',    icon: '🔐', desc: 'Assign finance roles to staff' },
];

export default function PrincipalFinanceOverview() {
  const token = getToken() || '';
  const router = useRouter();
  const [daily, setDaily] = useState<DailyCollection | null>(null);
  const [pending, setPending] = useState<StudentPending | null>(null);
  const [pendingConcessions, setPendingConcessions] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      apiGet<DailyCollection>(`/api/v1/financial/reports/daily-collection?date=${today}`, token).catch(() => ({ total: 0, count: 0 })),
      apiGet<StudentPending>('/api/v1/financial/reports/student-pending', token).catch(() => ({ total_pending: 0, student_count: 0 })),
      apiGet<any[]>('/api/v1/financial/concessions/pending', token).catch(() => []),
    ]).then(([d, p, conc]) => {
      setDaily(d);
      setPending(p);
      setPendingConcessions(Array.isArray(conc) ? conc.length : 0);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-800">Finance Overview</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Principal view — full access to all financial operations</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          <p className="text-xs text-neutral-400 font-medium mb-1">Today's Collections</p>
          <p className="text-2xl font-black text-neutral-800">
            {loading ? '—' : `₹${(daily?.total || 0).toLocaleString('en-IN')}`}
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">{daily?.count || 0} payments</p>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
          <p className="text-xs text-neutral-400 font-medium mb-1">Total Pending</p>
          <p className="text-2xl font-black text-amber-600">
            {loading ? '—' : `₹${(pending?.total_pending || 0).toLocaleString('en-IN')}`}
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">{pending?.student_count || 0} students</p>
        </div>
        <div
          className={`bg-white rounded-2xl border shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow ${pendingConcessions > 0 ? 'border-amber-200' : 'border-neutral-100'}`}
          onClick={() => router.push('/principal/finance/concessions')}
        >
          <p className="text-xs text-neutral-400 font-medium mb-1">Pending Concessions</p>
          <p className={`text-2xl font-black ${pendingConcessions > 0 ? 'text-amber-600' : 'text-neutral-800'}`}>
            {loading ? '—' : pendingConcessions}
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">awaiting approval</p>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {QUICK_LINKS.map(({ href, label, icon, desc }) => (
          <Link
            key={href}
            href={href}
            className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-4 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col gap-2"
          >
            <span className="text-2xl">{icon}</span>
            <div>
              <p className="text-sm font-semibold text-neutral-800">{label}</p>
              <p className="text-xs text-neutral-400 leading-snug mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

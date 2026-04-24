'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button, StatCard } from '@/components/ui';
import { useRouter } from 'next/navigation';

interface DailyCollection {
  total: number;
  count: number;
}

interface StudentPending {
  total_pending: number;
  student_count: number;
}

interface RecentTransaction {
  id: string;
  student_name: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
}

interface CashReconciliation {
  id: string;
  date: string;
  variance: number;
  status: string;
}

export default function FinanceDashboardPage() {
  const token = getToken() || '';
  const router = useRouter();

  const [dailyCollection, setDailyCollection] = useState<DailyCollection | null>(null);
  const [studentPending, setStudentPending] = useState<StudentPending | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [cashTasks, setCashTasks] = useState<CashReconciliation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [daily, pending, cash] = await Promise.all([
        apiGet<DailyCollection>(`/api/v1/financial/reports/daily-collection?date=${today}`, token).catch(() => ({ total: 0, count: 0 })),
        apiGet<StudentPending>('/api/v1/financial/reports/student-pending', token).catch(() => ({ total_pending: 0, student_count: 0 })),
        apiGet<CashReconciliation[]>('/api/v1/financial/reconciliation/cash', token).catch(() => []),
      ]);
      setDailyCollection(daily);
      setStudentPending(pending);
      setCashTasks(cash.filter(c => c.status === 'pending').slice(0, 5));

      // Fetch recent transactions (last 10)
      const txns = await apiGet<RecentTransaction[]>(`/api/v1/financial/reports/daily-collection?date=${today}&limit=10`, token).catch(() => []);
      setRecentTransactions(Array.isArray(txns) ? txns : []);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <p className="text-gray-500 text-sm">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-primary">Financial Dashboard</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <StatCard
          label="Today's Collections"
          value={`₹${dailyCollection?.total.toLocaleString('en-IN') || 0}`}
          sub={`${dailyCollection?.count || 0} payments`}
          colorScheme="green"
        />
        <StatCard
          label="Total Pending"
          value={`₹${studentPending?.total_pending.toLocaleString('en-IN') || 0}`}
          sub={`${studentPending?.student_count || 0} students`}
          colorScheme="amber"
        />
      </div>

      {/* Recent transactions */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Student</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Amount</th>
                <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Mode</th>
                <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map(txn => (
                <tr key={txn.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium text-gray-800">{txn.student_name}</td>
                  <td className="py-2 px-3 text-right text-gray-700">
                    ₹{txn.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {txn.payment_mode}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center text-gray-600 text-xs">
                    {new Date(txn.payment_date).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
              {recentTransactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400 text-sm">
                    No transactions today
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Reconciliation tasks */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Reconciliation Tasks Pending Review</h2>
        </div>
        <div className="space-y-2">
          {cashTasks.map(task => (
            <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {new Date(task.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-xs text-gray-500">
                  Variance: ₹{Math.abs(task.variance).toLocaleString('en-IN')}
                </p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                {task.status}
              </span>
            </div>
          ))}
          {cashTasks.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No pending tasks</p>
          )}
        </div>
      </Card>

      {/* Navigation links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => router.push('/admin/finance/fees')}
          className="p-4 rounded-xl bg-white border border-gray-200 hover:border-primary hover:shadow-md transition-all text-left"
        >
          <span className="text-2xl block mb-2">💳</span>
          <p className="text-sm font-semibold text-gray-800">Fee Collection</p>
        </button>
        <button
          onClick={() => router.push('/admin/finance/concessions')}
          className="p-4 rounded-xl bg-white border border-gray-200 hover:border-primary hover:shadow-md transition-all text-left"
        >
          <span className="text-2xl block mb-2">🎁</span>
          <p className="text-sm font-semibold text-gray-800">Concessions</p>
        </button>
        <button
          onClick={() => router.push('/admin/finance/reconciliation')}
          className="p-4 rounded-xl bg-white border border-gray-200 hover:border-primary hover:shadow-md transition-all text-left"
        >
          <span className="text-2xl block mb-2">🔍</span>
          <p className="text-sm font-semibold text-gray-800">Reconciliation</p>
        </button>
        <button
          onClick={() => router.push('/admin/finance/enquiries')}
          className="p-4 rounded-xl bg-white border border-gray-200 hover:border-primary hover:shadow-md transition-all text-left"
        >
          <span className="text-2xl block mb-2">📝</span>
          <p className="text-sm font-semibold text-gray-800">Enquiries</p>
        </button>
      </div>
    </div>
  );
}

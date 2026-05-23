'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Card, Button, StatCard } from '@/components/ui';

interface ProfitLoss {
  total_income: number;
  total_expenses: number;
  net_profit: number;
}

interface ClassCollection {
  class_name: string;
  total_collected: number;
  total_pending: number;
}

interface ActivityRevenue {
  activity_name: string;
  revenue: number;
}

interface Insights {
  revenue_trends: string[];
  expense_patterns: string[];
  default_risk_alerts: string[];
  collection_suggestions: string[];
}

export default function ProfitabilityPage() {
  const token = getToken() || '';

  const [profitLoss, setProfitLoss] = useState<ProfitLoss | null>(null);
  const [classCollection, setClassCollection] = useState<ClassCollection[]>([]);
  const [activityRevenue, setActivityRevenue] = useState<ActivityRevenue[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);

  // AI Assistant
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [pl, cc, ar, ins] = await Promise.all([
        apiGet<ProfitLoss>('/api/v1/financial/reports/profit-loss', token).catch(() => ({ total_income: 0, total_expenses: 0, net_profit: 0 })),
        apiGet<ClassCollection[]>('/api/v1/financial/reports/class-collection', token).catch(() => []),
        apiGet<ActivityRevenue[]>('/api/v1/financial/reports/activity-revenue', token).catch(() => []),
        apiGet<Insights>('/api/v1/financial/insights', token).catch(() => null),
      ]);
      setProfitLoss(pl);
      setClassCollection(Array.isArray(cc) ? cc : []);
      setActivityRevenue(Array.isArray(ar) ? ar : []);
      setInsights(ins);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleAssistantQuery() {
    if (!query.trim()) return;
    setAssistantError('');
    setAnswer('');
    setAssistantLoading(true);
    try {
      const result = await apiPost<{ answer: string }>('/api/v1/financial/assistant', { query: query.trim() }, token);
      setAnswer(result.answer || 'No answer available.');
    } catch (err: unknown) {
      setAssistantError(err instanceof Error ? err.message : 'Failed to get answer.');
    } finally {
      setAssistantLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <p className="text-gray-500 text-sm">Loading profitability dashboard…</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-primary">Profitability Dashboard</h1>
      </div>

      {/* Summary cards */}
      {profitLoss && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Total Income"
            value={`₹${profitLoss.total_income.toLocaleString('en-IN')}`}
            color="success"
          />
          <StatCard
            label="Total Expenses"
            value={`₹${profitLoss.total_expenses.toLocaleString('en-IN')}`}
            color="warning"
          />
          <StatCard
            label="Net Profit"
            value={`₹${profitLoss.net_profit.toLocaleString('en-IN')}`}
            color={profitLoss.net_profit >= 0 ? 'success' : 'danger'}
          />
        </div>
      )}

      {/* Class drill-down */}
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Collection by Class</h2>
        {classCollection.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Class</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Collected</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Pending</th>
                </tr>
              </thead>
              <tbody>
                {classCollection.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-800">{c.class_name}</td>
                    <td className="py-2 px-3 text-right text-green-700">₹{c.total_collected.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-right text-yellow-700">₹{c.total_pending.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Activity revenue */}
      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Revenue by Activity</h2>
        {activityRevenue.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No activity revenue data</p>
        ) : (
          <div className="space-y-2">
            {activityRevenue.map((a, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-sm font-medium text-gray-800">{a.activity_name}</span>
                <span className="text-sm font-bold text-primary">₹{a.revenue.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* AI Insights */}
      {insights && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">AI Insights</h2>
          <div className="space-y-4">
            {insights.revenue_trends.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Revenue Trends</p>
                <ul className="list-disc list-inside space-y-1">
                  {insights.revenue_trends.map((t, i) => (
                    <li key={i} className="text-sm text-gray-700">{t}</li>
                  ))}
                </ul>
              </div>
            )}
            {insights.expense_patterns.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Expense Patterns</p>
                <ul className="list-disc list-inside space-y-1">
                  {insights.expense_patterns.map((p, i) => (
                    <li key={i} className="text-sm text-gray-700">{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {insights.default_risk_alerts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 mb-2">Default Risk Alerts</p>
                <ul className="list-disc list-inside space-y-1">
                  {insights.default_risk_alerts.map((a, i) => (
                    <li key={i} className="text-sm text-red-700">{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {insights.collection_suggestions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-green-600 mb-2">Collection Suggestions</p>
                <ul className="list-disc list-inside space-y-1">
                  {insights.collection_suggestions.map((s, i) => (
                    <li key={i} className="text-sm text-green-700">{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* AI Financial Assistant */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">AI Financial Assistant</h2>
        <div className="flex gap-3 mb-4">
          <input
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Ask a financial question…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAssistantQuery()}
          />
          <Button onClick={handleAssistantQuery} disabled={assistantLoading}>
            {assistantLoading ? 'Asking…' : 'Ask'}
          </Button>
        </div>
        {assistantError && <p className="text-xs text-red-500 mb-3">{assistantError}</p>}
        {answer && (
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-sm text-gray-800 leading-relaxed">{answer}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
